import Capacitor
import Foundation
import OSLog
import UIKit
import UniformTypeIdentifiers

@objc(ZhiwuNativePlugin)
public final class ZhiwuNativePlugin: CAPPlugin, CAPBridgedPlugin,
    UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
    public let identifier = "ZhiwuNativePlugin"
    public let jsName = "ZhiwuNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveTextFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickBackupFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAppearance", returnType: CAPPluginReturnPromise)
    ]

    private enum FileOperation { case save, open }
#if DEBUG
    private static let pickerLog = Logger(subsystem: "app.zhiwu.mobile", category: "FilePicker")
#endif
    private static func traceImport(_ event: StaticString) {
#if DEBUG
        pickerLog.notice("\(String(describing: event), privacy: .public)")
#endif
    }
    private let fileQueue = DispatchQueue(label: "app.zhiwu.mobile.files", qos: .userInitiated)
    private let exportRoot = FileManager.default.temporaryDirectory
        .appendingPathComponent("ZhiwuExports", isDirectory: true)
    // Session state stays on the main queue until the picker and file I/O finish.
    private var pending: (call: CAPPluginCall, operation: FileOperation)?
    private var temporaryDirectory: URL?
    private var activePicker: UIDocumentPickerViewController?

    public override func load() {
        super.load()
        let root = exportRoot
        fileQueue.async { try? FileManager.default.removeItem(at: root) }
    }

    @objc public func saveTextFile(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename"),
              let text = call.getString("text"),
              let mimeType = call.getString("mimeType"),
              Self.isSupportedFile(filename: filename, mimeType: mimeType) else {
            call.reject("请选择有效的 JSON 或 CSV 文件名。", "INVALID_EXPORT")
            return
        }

        DispatchQueue.main.async {
            guard self.begin(call, operation: .save) else { return }
            let directory = self.exportRoot.appendingPathComponent(UUID().uuidString, isDirectory: true)
            let fileURL = directory.appendingPathComponent(filename, isDirectory: false)
            self.temporaryDirectory = directory
            self.fileQueue.async {
                do {
                    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                    try Data(text.utf8).write(to: fileURL, options: .atomic)
                    DispatchQueue.main.async {
                        self.present(UIDocumentPickerViewController(forExporting: [fileURL], asCopy: true))
                    }
                } catch {
                    DispatchQueue.main.async {
                        self.fail(message: "无法创建导出文件，请检查存储空间。", code: "WRITE_FAILED", error: error)
                    }
                }
            }
        }
    }

    @objc public func pickBackupFile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.begin(call, operation: .open) else { return }
            self.present(UIDocumentPickerViewController(forOpeningContentTypes: [.json], asCopy: false))
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

    private var availablePresenter: UIViewController? {
        guard let presenter = bridge?.viewController,
              presenter.viewIfLoaded?.window != nil,
              UIApplication.shared.applicationState == .active,
              presenter.presentedViewController == nil else { return nil }
        return presenter
    }

    private func begin(_ call: CAPPluginCall, operation: FileOperation) -> Bool {
        guard pending == nil else {
            call.reject("请先完成或取消正在进行的文件操作。", operation == .save ? "EXPORT_BUSY" : "IMPORT_BUSY")
            return false
        }
        guard let presenter = availablePresenter else {
            call.reject("暂时无法打开文件窗口。", "PRESENTATION_UNAVAILABLE")
            return false
        }
        presenter.view.endEditing(true)
        pending = (call, operation)
        return true
    }

    private func present(_ picker: UIDocumentPickerViewController) {
        guard let presenter = availablePresenter else {
            fail(message: "暂时无法打开文件窗口。", code: "PRESENTATION_UNAVAILABLE")
            return
        }
        picker.delegate = self
        picker.allowsMultipleSelection = false
        let traits = presenter.traitCollection
        let phoneImport = pending?.operation == .open && traits.userInterfaceIdiom == .phone
            && traits.horizontalSizeClass == .compact
        picker.modalPresentationStyle = phoneImport ? .fullScreen : .formSheet
        picker.overrideUserInterfaceStyle = presenter.overrideUserInterfaceStyle
        activePicker = picker
        picker.presentationController?.delegate = self
        presenter.present(picker, animated: true) { [weak self, weak picker] in
            guard let self, let picker, self.activePicker === picker else { return }
            picker.presentationController?.delegate = self
            if self.pending?.operation == .open {
                Self.traceImport(phoneImport ? "Import picker presented fullscreen" : "Import picker presented as sheet")
            }
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard controller === activePicker, let operation = pending?.operation else { return }
        switch operation {
        case .save:
            if urls.isEmpty {
                fail(message: "文件未能保存。", code: "EXPORT_FAILED")
            } else {
                finish(["status": "saved"])
            }
        case .open:
            Self.traceImport("Import selection delegate called")
            guard let url = urls.first else {
                Self.traceImport("Import selection had no document")
                fail(message: "未收到备份文件。", code: "READ_FAILED")
                return
            }
            // The picker may dismiss while the document is being read. Its dismissal
            // must not resolve the pending import as a cancellation.
            detachPicker()
            fileQueue.async {
                do {
                    let text = try Self.readBackup(at: url)
                    Self.traceImport("Import document read successfully")
                    DispatchQueue.main.async { self.finish(["status": "selected", "text": text]) }
                } catch {
                    Self.traceImport("Import document could not be read")
                    DispatchQueue.main.async {
                        self.fail(message: "无法读取 JSON 备份文件。", code: "READ_FAILED", error: error)
                    }
                }
            }
        }
    }

    private static func readBackup(at url: URL) throws -> String {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }

        var coordinationError: NSError?
        var readResult: Result<String, Error>?
        NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: url, options: [], error: &coordinationError) { readableURL in
            readResult = Result { try String(contentsOf: readableURL, encoding: .utf8) }
        }
        if let coordinationError { throw coordinationError }
        guard let readResult else { throw CocoaError(.fileReadUnknown) }
        let text = try readResult.get()
        return text.hasPrefix("\u{FEFF}") ? String(text.dropFirst()) : text
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard controller === activePicker else { return }
        if pending?.operation == .open { Self.traceImport("Import cancellation delegate called") }
        finish(["status": "cancelled"])
    }

    public func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        guard presentationController.presentedViewController === activePicker else { return }
        if pending?.operation == .open { Self.traceImport("Import picker dismissed interactively") }
        finish(["status": "cancelled"])
    }

    private func detachPicker() {
        activePicker?.delegate = nil
        activePicker?.presentationController?.delegate = nil
        activePicker = nil
    }

    private func finish(_ result: PluginCallResultData) {
        takeCall()?.resolve(result)
    }

    private func fail(message: String, code: String, error: Error? = nil) {
        takeCall()?.reject(message, code, error)
    }

    private func takeCall() -> CAPPluginCall? {
        let call = pending?.call
        pending = nil
        detachPicker()
        if let directory = temporaryDirectory {
            temporaryDirectory = nil
            fileQueue.async { try? FileManager.default.removeItem(at: directory) }
        }
        return call
    }
}
