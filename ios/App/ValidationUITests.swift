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
            let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            screen.name = "failure-screen"
            screen.lifetime = .keepAlways
            add(screen)
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

    // Tests share this simulator's app container. Either test may be first.
    func launchAtHome() {
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        let entry = app.webViews.buttons.matching(labels("开始记录", "设置")).firstMatch
        XCTAssertTrue(entry.waitForExistence(timeout: 120))
        if entry.label == "开始记录" {
            tap(entry)
            tap(button("关闭"))
        }
        XCTAssertTrue(button("设置").waitForExistence(timeout: 30))
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

    func openExport(_ label: String) {
        tap(button(label))
        XCTAssertTrue(fileBrowser.waitForExistence(timeout: 60), "Files did not open for \(label)")
    }

    func saveExport(_ label: String) {
        openExport(label)
        screenshot("system-export-\(label)")
        let save = fileBrowser.buttons.matching(labels("Save", "存储", "保存")).firstMatch
        tap(save)
        waitForDismissal(fileBrowser)
    }

    func importLocalBackup() {
        tap(button("导入备份"))
        // The native open picker can start in Recents, Browse, or a location.
        let backup = app.cells.matching(NSPredicate(format: "label BEGINSWITH %@", "知物备份-")).firstMatch
        if !backup.waitForExistence(timeout: 8) {
            let browse = app.buttons.matching(labels("Browse", "浏览")).firstMatch
            if browse.exists && browse.isHittable { browse.tap() }
            if !backup.waitForExistence(timeout: 5) {
                let local = app.cells.matching(labels("On My iPhone", "On My iPad", "我的 iPhone", "我的 iPad")).firstMatch
                if local.exists && local.isHittable { local.tap() }
            }
        }
        XCTAssertTrue(backup.waitForExistence(timeout: 30))
        XCTAssertTrue(backup.isEnabled, "Files did not allow selection of the JSON backup")
        if app.frame.width < 600 {
            // A list row provides a single activation target on compact Files.
            let grid = app.collectionViews["File View"].firstMatch
            if grid.exists && (grid.value as? String) == "Icon Mode" {
                tap(app.buttons["OverflowBarButtonItem"].firstMatch)
                let list = app.descendants(matching: .any).matching(labels("List", "As List", "列表")).firstMatch
                tap(list)
            }
            tap(backup)
        } else {
            let thumbnail = backup.images.firstMatch
            if thumbnail.exists {
                thumbnail.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            } else {
                tap(backup)
            }
        }
        let confirm = button("继续导入")
        if !confirm.waitForExistence(timeout: 5) {
            let open = app.buttons.matching(labels("Open", "打开")).firstMatch
            if open.exists && open.isHittable {
                open.tap()
            }
        }
        tap(confirm)
    }

    func cancelExport() {
        // iPad exposes a Cancel button. The compact sheet can expose only
        // Save and More in its toolbar and supports interactive dismissal.
        let cancel = app.buttons.matching(labels("Cancel", "取消")).firstMatch
        if cancel.exists && cancel.isHittable {
            cancel.tap()
        } else {
            let grip = fileBrowser.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.01))
            let bottom = fileBrowser.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.92))
            grip.press(forDuration: 0.15, thenDragTo: bottom)
        }
        waitForDismissal(fileBrowser)
    }

    func testCancelAndReopenFilePickers() {
        continueAfterFailure = false
        launchAtHome()
        tap(button("设置"))
        openExport("CSV 清单")
        cancelExport()
        openExport("JSON 备份")
        cancelExport()
        tap(button("导入备份"))
        // The open picker exposes Cancel even in compact Recents.
        let cancel = app.buttons.matching(labels("Cancel", "取消")).firstMatch
        tap(cancel, timeout: 60)
        waitForDismissal(cancel)
        tap(button("总览"))
    }

    func testItemAndFiles() {
        continueAfterFailure = false
        let runID = UUID().uuidString.prefix(8)
        let backedUpItem = "Saved \(runID)"
        let laterItem = "Later \(runID)"
        print("Export validation record: \(backedUpItem)")
        launchAtHome()
        tap(button("新增物品"))
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
        tap(button("总览"))
    }
}
