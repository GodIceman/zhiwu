import Capacitor
import Foundation
import UIKit

@objc(ZhiwuNativePlugin)
public final class ZhiwuNativePlugin: CAPPlugin, CAPBridgedPlugin,
    UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
    public let identifier = "ZhiwuNativePlugin"
    public let jsName = "ZhiwuNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveTextFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAppearance", returnType: CAPPluginReturnPromise)
    ]

    private let exportQueue = DispatchQueue(label: "app.zhiwu.mobile.export", qos: .userInitiated)
    private let exportRoot = FileManager.default.temporaryDirectory
        .appendingPathComponent("ZhiwuExports", isDirectory: true)
    // All session state is accessed on the main queue. Holding the call keeps
    // its promise alive until the system picker reports an actual outcome.
    private var pendingCall: CAPPluginCall?
    private var temporaryDirectory: URL?
    private var activePicker: UIDocumentPickerViewController?

    public override func load() {
        super.load()
        let root = exportRoot
        // A force-quit can skip delegate cleanup. This queue also handles new
        // writes, so stale cleanup finishes before the next export begins.
        exportQueue.async { try? FileManager.default.removeItem(at: root) }
    }

    @objc public func saveTextFile(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename"),
              let text = call.getString("text"),
              let mimeType = call.getString("mimeType"),
              Self.isSupportedFile(filename: filename, mimeType: mimeType) else {
            call.reject("请选择有效的 JSON 或 CSV 文件名。", "INVALID_EXPORT")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self else {
                call.reject("导出服务不可用。", "UNAVAILABLE")
                return
            }
            guard self.pendingCall == nil else {
                call.reject("请先完成或取消正在进行的导出。", "EXPORT_BUSY")
                return
            }
            guard let presenter = self.bridge?.viewController,
                  presenter.viewIfLoaded?.window != nil,
                  UIApplication.shared.applicationState == .active,
                  presenter.presentedViewController == nil else {
                call.reject("暂时无法打开文件保存窗口。", "PRESENTATION_UNAVAILABLE")
                return
            }

            presenter.view.endEditing(true)
            self.pendingCall = call
            let directory = self.exportRoot.appendingPathComponent(UUID().uuidString, isDirectory: true)
            let fileURL = directory.appendingPathComponent(filename, isDirectory: false)
            self.temporaryDirectory = directory

            self.exportQueue.async { [weak self] in
                do {
                    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                    try Data(text.utf8).write(to: fileURL, options: .atomic)
                } catch {
                    DispatchQueue.main.async {
                        guard let self else {
                            try? FileManager.default.removeItem(at: directory)
                            call.reject("导出服务不可用。", "UNAVAILABLE")
                            return
                        }
                        self.failExport(message: "无法创建导出文件，请检查存储空间。", code: "WRITE_FAILED", error: error)
                    }
                    return
                }
                DispatchQueue.main.async {
                    guard let self else {
                        try? FileManager.default.removeItem(at: directory)
                        call.reject("导出服务不可用。", "UNAVAILABLE")
                        return
                    }
                    self.presentExport(fileURL: fileURL)
                }
            }
        }
    }

    @objc public func setAppearance(_ call: CAPPluginCall) {
        guard let dark = call.getBool("dark"),
              let followSystem = call.getBool("followSystem") else {
            call.reject("主题参数无效。", "INVALID_APPEARANCE")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let controller = self?.bridge?.viewController as? ZhiwuViewController else {
                call.reject("主题服务不可用。", "UNAVAILABLE")
                return
            }
            controller.applyAppearance(dark: dark, followSystem: followSystem)
            call.resolve()
        }
    }

    private static func isSupportedFile(filename: String, mimeType: String) -> Bool {
        guard !filename.isEmpty, filename.utf8.count <= 240,
              filename == filename.trimmingCharacters(in: .whitespacesAndNewlines),
              !filename.contains("/"), !filename.contains("\\"), !filename.contains(":"),
              filename.rangeOfCharacter(from: .controlCharacters) == nil else { return false }
        let fileExtension = (filename as NSString).pathExtension.lowercased()
        let type = mimeType.split(separator: ";", maxSplits: 1).first?
            .trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return (fileExtension == "json" && type == "application/json")
            || (fileExtension == "csv" && type == "text/csv")
    }

    private func presentExport(fileURL: URL) {
        guard let presenter = bridge?.viewController,
              presenter.viewIfLoaded?.window != nil,
              UIApplication.shared.applicationState == .active,
              presenter.presentedViewController == nil else {
            failExport(message: "暂时无法打开文件保存窗口。", code: "PRESENTATION_UNAVAILABLE")
            return
        }
        let picker = UIDocumentPickerViewController(forExporting: [fileURL], asCopy: true)
        picker.delegate = self
        picker.allowsMultipleSelection = false
        // A form sheet supports iPad without requiring a popover anchor.
        picker.modalPresentationStyle = .formSheet
        picker.overrideUserInterfaceStyle = presenter.overrideUserInterfaceStyle
        activePicker = picker
        picker.presentationController?.delegate = self
        presenter.present(picker, animated: true) { [weak self, weak picker] in
            guard let self, let picker, self.activePicker === picker else { return }
            picker.presentationController?.delegate = self
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard controller === activePicker else { return }
        if urls.isEmpty {
            failExport(message: "文件未能保存。", code: "EXPORT_FAILED")
        } else {
            // In export mode these URLs refer to the destination copies. The
            // source can now be removed; no access to the external URL is needed.
            finishExport(status: "saved")
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard controller === activePicker else { return }
        finishExport(status: "cancelled")
    }

    public func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        guard presentationController.presentedViewController === activePicker else { return }
        // Covers swipe-to-dismiss on iPhone/iPad as well as the Cancel button.
        finishExport(status: "cancelled")
    }

    private func finishExport(status: String) {
        let call = pendingCall
        cleanUpExport()
        call?.resolve(["status": status])
    }

    private func failExport(message: String, code: String, error: Error? = nil) {
        let call = pendingCall
        cleanUpExport()
        call?.reject(message, code, error)
    }

    private func cleanUpExport() {
        let directory = temporaryDirectory
        pendingCall = nil
        temporaryDirectory = nil
        activePicker?.delegate = nil
        activePicker?.presentationController?.delegate = nil
        activePicker = nil
        if let directory {
            exportQueue.async { try? FileManager.default.removeItem(at: directory) }
        }
    }
}
