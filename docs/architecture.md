# 架构图

以下图示展示了客户端组件、状态引擎、数据层以及 LLM 代理的关系，便于在改动架构时保持一致性。

```mermaid
flowchart TB
  subgraph Client[浏览器 / Next.js App Router]
    Page[app/page.tsx\n页面编排]
    Components[components/*\nBoardGrid / ControlPanel / ...]
    LLMPanel[LLMPanel\n触发 LLM 请求]
    Locale[LocalizationToggle\n切换语言]
  end

  Store[lib/state/gameStore.ts\nZustand + Immer 游戏状态/动作\n(掷骰/抽牌/合资/借贷/日志)]
  Data[lib/data/*\nboard / cards / scenarios / dreams]
  Types[lib/types.ts\n共享类型定义]
  I18n[lib/i18n.ts\nt(locale, key)]
  Styles[app/globals.css\n主题与工具类]

  API[/app/api/llm/route.ts\nOpenAI 代理/动作推荐/]
  OpenAI[(OpenAI API)]

  Page --> Components
  Components -->|选择器/动作| Store
  LLMPanel -->|fetch /api/llm| API --> OpenAI
  API -->|JSON 动作建议| LLMPanel
  Store -->|日志/状态| LLMPanel
  LLMPanel -->|静态梦想数据| Data
  Store --> Data
  Store --> Types
  Components --> Types
  Components --> I18n
  Locale --> I18n
  Page --> Styles
```

## 关键说明
- 页面层：`app/layout.tsx` 提供全局样式与字体，`app/page.tsx` 组合 UI 组件并读取 store 状态决定展示（准备阶段的 SetupWizard 与对局主界面切换）。
- 状态引擎：`lib/state/gameStore.ts` 以 Zustand + Immer 管理游戏状态、卡组、日志、合资与借贷动作，初始化时从 `lib/data` 克隆并洗牌卡组。
- 数据与类型：`lib/data/*` 提供静态棋盘/卡牌/场景/梦想数据，`lib/types.ts` 定义共享实体，`lib/i18n.ts` 提供多语言文案查找。
- LLM 代理：`components/LLMPanel.tsx` 通过 `/api/llm` 将截取的游戏状态发送到 `app/api/llm/route.ts`，后者代理到 OpenAI（`OPENAI_API_KEY` 或用户临时 key），返回 JSON 化动作建议；日志入库由客户端调用 `recordLLMAction`（Zustand store）完成。
- 视觉层：`app/globals.css` 定义主题 token、布局与卡片基础样式，组件内采用轻量 inline 样式按需覆盖。

> 若未来调整架构（新增后端服务、状态拆分、组件通信方式变更等），请同步更新本文件的架构图与说明。
