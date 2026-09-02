# 参与知物

感谢你愿意帮助知物变得更好。问题反馈、产品建议、设计讨论、测试补充和代码改进都受到欢迎。

## 开始之前

1. 先搜索现有 Issue，避免重复讨论。
2. 较大的功能请先提出问题和使用场景，再开始实现。
3. 不要在 Issue、截图或测试数据中提交真实消费信息、密钥和签名文件。

## 本地开发

```bash
npm install
npm run dev
```

提交前运行：

```bash
npm run check
```

## 变更原则

- 保持本地优先，不默认收集或上传用户数据。
- 新功能应说明用户问题，而不只描述实现方式。
- 交互变化需要覆盖键盘、窄屏、深色模式和减少动态效果等情况。
- 修复缺陷或增加计算逻辑时，请同步补充测试。
- 可以使用 AI 辅助贡献，但提交者需要理解、检查并对最终变更负责。

## 提交说明

使用简短、明确的动词说明变化，例如：

- `feat: add renewal reminder filter`
- `fix: preserve local date when exporting`
- `docs: clarify backup behavior`

By contributing, you agree that your contributions will be licensed under the MIT License.
