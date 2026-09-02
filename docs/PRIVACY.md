# 数据与隐私 / Data and Privacy

## 中文

知物采用本地优先设计：

- 不要求注册账号。
- 不提供远程业务后端，也不默认上传物品、订阅、费用、日期、照片或备注。
- Web/PWA 数据存储在当前浏览器的 IndexedDB 中。
- Android 数据存储在应用 WebView 的本地空间中。
- JSON 备份和 CSV 文件仅在用户主动操作时生成。

浏览器数据清理、应用卸载或设备损坏都可能造成数据丢失。请定期导出 JSON 备份，并自行妥善保管。备份可能包含完整的个人消费记录，不应公开分享。

在线版本需要网络加载应用文件；这不代表个人记录会上传到项目服务器。托管平台仍可能按照其自身政策记录常规访问日志。

## English

Zhiwu is local first:

- It does not require an account.
- It has no remote application backend and does not upload belongings, subscriptions, costs, dates, photos, or notes by default.
- The Web/PWA app stores data in the current browser's IndexedDB.
- The Android app stores data in the app WebView's local storage area.
- JSON backups and CSV files are created only after an explicit user action.

Clearing browser data, uninstalling the app, or losing the device may remove local records. Export JSON backups regularly and store them securely. A backup may contain a complete personal spending history and should not be shared publicly.

The hosted app needs a network connection to load its static files. Hosting providers may retain ordinary access logs under their own policies, but Zhiwu does not send personal records to an application server.
