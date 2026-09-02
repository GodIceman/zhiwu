# 构建知物：一次以产品判断驱动的 AI 协作

知物不是为了演示 AI 而制作的原型。它首先是一个要被真实使用的产品，AI 是实现过程中的协作方式。

## 问题从哪里开始

传统记账工具擅长回答“花了多少钱”，却很少回答：

- 一件物品已经陪伴我多久？
- 购买成本分摊到每天后是什么感受？
- 哪些订阅即将续费，哪些服务长期没有被重新审视？
- 实体物品与数字服务能否用同一套价值语言理解？

因此，知物把“拥有时间”“日均成本”和“下一关键日期”设为核心信息，而不是把自己扩展成另一套复杂账本。

## 产品原则

1. **先看到价值，再看到数据。** 首页呈现时间、日均成本和下一条值得关注的记录。
2. **物品与服务共享概念，但保留差异。** 两者共用视觉与导航框架，分别使用拥有时长和续费日程。
3. **本地优先。** 产品不以账号、云同步或数据采集作为使用前提。
4. **复杂度逐步展开。** 常用字段优先，补充信息按需出现。
5. **视觉是信息模型的一部分。** 分类图标、时间轴和金额层级共同承担识别任务。

## 人与 Codex 的分工

项目发起者负责：

- 产品问题定义与范围控制
- 信息架构、UI 与交互设计
- 需求规格、优先级和取舍
- 体验验收、缺陷判断与迭代反馈
- 测试策略与发布标准

Codex 主要负责：

- 将规格转化为 React、TypeScript 与 Android 工程实现
- 编写和维护自动化测试
- 根据验收反馈定位并修复问题
- 执行构建、兼容性检查与发布准备

这里的关键不是一次性生成代码，而是建立可重复的闭环：

```text
用户问题 → 产品规格 → AI 实现 → 可运行版本 → 人工验收 → 明确反馈 → 回归测试
```

## 如何验收 AI 实现

每个变化都需要回到真实界面，而不是只检查代码是否能编译。验收会覆盖：

- 核心任务能否顺利完成
- 信息层级是否符合设计意图
- 浅色、深色与窄屏表现
- 滑动、返回键、日期选择等关键交互
- 数据迁移、备份和恢复
- 自动化测试与正式构建

当实现与预期不符时，反馈会描述可观察的问题、期望状态与适用边界，避免只给出“再优化一下”之类不可验证的指令。

## 这套方式的意义

AI 降低了实现成本，但没有替代产品责任。范围是否合理、体验是否清晰、数据是否安全、版本是否能够发布，仍然需要人作出判断并承担结果。

知物会继续把产品文档、测试和实现放在同一个公开仓库中，让这些判断可以被观察、讨论和改进。

---

## English summary

Zhiwu is a real local-first product built through a human-led, AI-assisted delivery loop. The initiator owns product definition, UI and interaction design, prioritization, acceptance, and test strategy. Codex performs most engineering implementation and automated test work against those specifications.

The workflow is iterative rather than one-shot generation: define the user problem, specify observable behavior, implement, inspect the running product, give concrete acceptance feedback, and protect the result with regression tests. AI reduces implementation cost; it does not remove human product responsibility.
