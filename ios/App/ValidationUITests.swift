import XCTest

final class ZhiwuFlowTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "app.zhiwu.mobile")

    func button(_ label: String) -> XCUIElement { app.buttons[label].firstMatch }

    func tap(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: 12), "Missing \(element)", file: file, line: line)
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

    func createItem(named itemName: String) {
        tap(button("新增物品"))
        let fields = app.webViews.textFields
        let name = fields.element(boundBy: 0)
        tap(name)
        name.typeText(itemName)
        let amount = fields.element(boundBy: 1)
        tap(amount)
        amount.typeText("88")
        tap(button("保存"))
        tap(button("清单"))
        XCTAssertTrue(itemCard(itemName).waitForExistence(timeout: 10))
    }

    func testItemAndFiles() {
        continueAfterFailure = false
        let runID = UUID().uuidString.prefix(8)
        let backedUpItem = "Saved \(runID)"
        let laterItem = "Later \(runID)"
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        if button("开始记录").waitForExistence(timeout: 5) { tap(button("开始记录")) }
        createItem(named: backedUpItem)
        screenshot("saved-item")
        app.terminate()
        app.launch()
        tap(button("清单"))
        XCTAssertTrue(itemCard(backedUpItem).waitForExistence(timeout: 10))
        tap(button("设置"))
        tap(button("深色"))
        screenshot("settings-dark")
        tap(button("浅色"))
        screenshot("settings-light")
        tap(button("CSV 清单"))
        tap(button("Cancel"))
        XCTAssertTrue(app.staticTexts["已取消导出"].firstMatch.waitForExistence(timeout: 5))
        tap(button("CSV 清单"))
        tap(button("Save"))
        XCTAssertTrue(app.staticTexts["CSV 清单已保存"].firstMatch.waitForExistence(timeout: 5))
        tap(button("JSON 备份"))
        screenshot("system-export")
        tap(button("Save"))
        XCTAssertTrue(app.staticTexts["JSON 备份已保存"].firstMatch.waitForExistence(timeout: 5))

        // The import must replace a visibly different dataset.
        tap(button("清单"))
        createItem(named: laterItem)
        XCTAssertTrue(itemCard(backedUpItem).exists)
        tap(button("设置"))
        tap(button("导入备份"))
        let file = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "知物备份")).firstMatch
        if !file.waitForExistence(timeout: 3), button("Recents").exists { button("Recents").tap() }
        tap(file)
        tap(button("继续导入"))
        XCTAssertTrue(app.staticTexts["备份导入成功"].firstMatch.waitForExistence(timeout: 5))
        tap(button("清单"))
        XCTAssertTrue(itemCard(backedUpItem).waitForExistence(timeout: 10))
        XCTAssertFalse(itemCard(laterItem).exists)
        app.terminate()
        app.launch()
        tap(button("清单"))
        XCTAssertTrue(itemCard(backedUpItem).waitForExistence(timeout: 10))
        XCTAssertFalse(itemCard(laterItem).exists)
        screenshot("restored-item")
    }
}
