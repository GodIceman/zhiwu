import XCTest

final class ZhiwuFlowTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "app.zhiwu.mobile")

    override func tearDownWithError() throws {
        if let testRun, testRun.failureCount > 0, app.state == .runningForeground {
            let hierarchy = app.debugDescription
            print("Accessibility hierarchy at failure:\n\(hierarchy)")
            let attachment = XCTAttachment(string: hierarchy)
            attachment.name = "accessibility-at-failure.txt"
            attachment.lifetime = .keepAlways
            add(attachment)
            screenshot("failure-screen")
        }
        try super.tearDownWithError()
    }

    func button(_ label: String) -> XCUIElement { app.buttons[label].firstMatch }

    func tap(_ element: XCUIElement, timeout: TimeInterval = 30, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: timeout), "Missing \(element)", file: file, line: line)
        element.tap()
    }

    func screenshot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }

    func itemCard(_ name: String) -> XCUIElement {
        app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
    }

    func field(_ label: String, placeholder: String) -> XCUIElement {
        app.webViews.textFields.matching(NSPredicate(format: "label == %@ OR placeholderValue == %@", label, placeholder)).firstMatch
    }

    func reopenList() {
        app.terminate()
        app.launch()
        let list = button("清单")
        XCTAssertTrue(list.waitForExistence(timeout: 120), "App did not load its navigation after relaunch")
        XCTAssertFalse(button("开始记录").exists, "Relaunch unexpectedly showed first-run onboarding")
        tap(list)
    }

    func fillItem(named itemName: String) {
        let name = field("物品名称", placeholder: "例如工作电脑、通勤耳机")
        tap(name)
        name.typeText(itemName)
        let amount = field("购入金额", placeholder: "¥")
        tap(amount)
        amount.typeText("88")
        tap(button("保存"))
        tap(button("清单"))
        XCTAssertTrue(itemCard(itemName).waitForExistence(timeout: 10))
    }

    var fileBrowser: XCUIElement { app.otherElements["Browse View (Picker)"].firstMatch }

    func labels(_ names: String...) -> NSPredicate { NSPredicate(format: "label IN %@", names as NSArray) }

    func waitForDismissal(_ element: XCUIElement) {
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: element)
        XCTAssertEqual(XCTWaiter.wait(for: [gone], timeout: 30), .completed, "Picker stayed open")
    }

    func savedFile(_ prefix: String) -> XCUIElement {
        app.collectionViews["File View"].descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
    }

    func openExport(_ label: String) {
        tap(button(label))
        XCTAssertTrue(fileBrowser.waitForExistence(timeout: 60), "Files did not open for \(label)")
    }

    func saveExport(_ label: String) {
        openExport(label)
        let save = fileBrowser.buttons.matching(labels("Save", "存储", "保存")).firstMatch
        tap(save)
        waitForDismissal(fileBrowser)
    }

    func importLocalBackup() {
        tap(button("导入备份"))
        // WKWebView can present a chooser before Files. The HTML file input
        // is hidden, so these controls belong to the system chooser.
        let choiceLabels = labels("Choose File", "Choose Files", "选取文件", "选择文件")
        let chooseFileButton = app.buttons.matching(choiceLabels).firstMatch
        let chooseFileMenuItem = app.menuItems.matching(choiceLabels).firstMatch
        if chooseFileButton.waitForExistence(timeout: 3) && chooseFileButton.isHittable {
            chooseFileButton.tap()
        } else if chooseFileMenuItem.exists && chooseFileMenuItem.isHittable {
            chooseFileMenuItem.tap()
        }

        // Recents and the Browse grid use different accessibility containers.
        // Only the exported file carries this prefix in the isolated fixture.
        let backup = app.cells.matching(NSPredicate(format: "label BEGINSWITH %@", "知物备份-")).firstMatch
        if !backup.waitForExistence(timeout: 8) {
            // Files can initially show Recents or the list of storage locations.
            let browse = app.buttons.matching(labels("Browse", "浏览")).firstMatch
            if browse.exists && browse.isHittable { browse.tap() }
            if !backup.waitForExistence(timeout: 5) {
                let local = app.descendants(matching: .any).matching(labels("On My iPhone", "On My iPad", "我的 iPhone", "我的 iPad")).firstMatch
                if local.exists && local.isHittable { local.tap() }
            }
        }
        XCTAssertTrue(backup.waitForExistence(timeout: 30))
        XCTAssertTrue(backup.isEnabled, "Files did not allow selection of the JSON backup")
        // In icon view the cell midpoint is on the filename, below the document
        // thumbnail. Touch the thumbnail itself to open the document.
        let thumbnail = backup.images.firstMatch
        if thumbnail.exists {
            thumbnail.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        } else {
            backup.tap()
        }
        let confirm = button("继续导入")
        if !confirm.waitForExistence(timeout: 5) {
            let open = app.buttons.matching(labels("Open", "打开")).firstMatch
            if open.exists && open.isHittable {
                open.tap()
            } else if backup.exists && thumbnail.exists {
                thumbnail.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).doubleTap()
            }
        }
        tap(confirm)
    }

    func cancelExport() {
        // iPad exposes a Cancel button. The compact sheet can expose only
        // Save and More in its toolbar and supports interactive dismissal.
        let cancel = fileBrowser.buttons.matching(labels("Cancel", "取消")).firstMatch
        if cancel.exists && cancel.isHittable {
            cancel.tap()
        } else {
            let grip = fileBrowser.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.01))
            let bottom = fileBrowser.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.92))
            grip.press(forDuration: 0.15, thenDragTo: bottom)
        }
        waitForDismissal(fileBrowser)
    }

    func testItemAndFiles() {
        continueAfterFailure = false
        let runID = UUID().uuidString.prefix(8)
        let backedUpItem = "Saved \(runID)"
        let laterItem = "Later \(runID)"
        print("Export validation record: \(backedUpItem)")
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        // Each CI job installs on a fresh simulator. Wait for WKWebView to finish
        // its first load; the navigation behind this dialog cannot be used yet.
        tap(button("开始记录"), timeout: 120)
        fillItem(named: backedUpItem)
        screenshot("saved-item")
        reopenList()
        XCTAssertTrue(itemCard(backedUpItem).waitForExistence(timeout: 10))
        tap(button("设置"))
        tap(button("深色"))
        screenshot("settings-dark")
        tap(button("浅色"))
        screenshot("settings-light")
        saveExport("CSV 清单")
        saveExport("JSON 备份")

        // The import must replace a visibly different dataset.
        tap(button("清单"))
        tap(button("新增物品"))
        fillItem(named: laterItem)
        XCTAssertTrue(itemCard(backedUpItem).exists)
        tap(button("设置"))
        importLocalBackup()
        tap(button("清单"))
        XCTAssertTrue(itemCard(backedUpItem).waitForExistence(timeout: 10))
        XCTAssertFalse(itemCard(laterItem).exists)
        reopenList()
        XCTAssertTrue(itemCard(backedUpItem).waitForExistence(timeout: 10))
        XCTAssertFalse(itemCard(laterItem).exists)
        screenshot("restored-item")
        tap(button("设置"))
        tap(button("跟随系统"))
        openExport("CSV 清单")
        XCTAssertTrue(savedFile("知物清单-").waitForExistence(timeout: 30), "Saved CSV missing from Files")
        screenshot("system-export")
        cancelExport()
        // Reopening proves the cancelled native call released its pending session.
        openExport("JSON 备份")
        cancelExport()
        tap(button("总览"))
    }
}
