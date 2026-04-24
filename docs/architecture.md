# 架构图

以下图示展示了客户端组件、状态引擎、数据层以及 LLM 代理的关系，便于在改动架构时保持一致性。

```mermaid
flowchart TB
  subgraph Client[浏览器 / Next.js App Router]
    Page[app/page.tsx\n页面编排]
    Components[components/*\nBoardGrid / ControlPanel / ...]
    MultiplayerUI[MultiplayerLobby / RoomScreen\n联机大厅与房间]
    LLMPanel[LLMPanel\n触发 LLM 请求]
    Locale[LocalizationToggle\n切换语言]
  end

  subgraph LocalMode[单机模式]
    LocalStore[lib/state/gameStore.ts\nZustand + Immer 本地状态]
  end

  subgraph MultiplayerMode[联机模式]
    SyncStore[lib/multiplayer/syncStore.ts\nZustand 本地缓存]
    MPActions[app/actions/*\nServer Actions 游戏逻辑网关]
    Engine[lib/engine/gameEngine.ts\n纯函数状态转换引擎]
    RoomMgr[lib/multiplayer/roomManager.ts\n房间管理]
    Realtime[lib/supabase/realtime.ts\nRealtime 订阅]
  end

  Store[(Supabase PostgreSQL)\nrooms / room_players\ngame_states / game_actions]
  SupabaseRT[(Supabase Realtime)\nBroadcast / Postgres Changes)]

  Data[lib/data/*\nboard / cards / scenarios / dreams]
  Types[lib/types.ts\n共享类型定义]
  I18n[lib/i18n.ts\nt(locale, key)]
  Styles[app/globals.css\n主题与工具类]

  API[/app/api/llm/route.ts\nOpenAI 代理/动作推荐/]
  OpenAI[(OpenAI API)]

  Page --> Components
  Page --> MultiplayerUI
  Components -->|单机: 选择器/动作| LocalStore
  Components -->|联机: 选择器/动作| SyncStore
  MultiplayerUI -->|房间操作| MPActions
  SyncStore -->|状态同步| Realtime
  Realtime -->|订阅更新| SupabaseRT
  MPActions -->|读写| Store
  SupabaseRT -->|推送变更| SyncStore
  MPActions -->|调用| Engine
  LocalStore --> Data
  SyncStore --> Data
  LocalStore --> Types
  SyncStore --> Types
  Components --> Types
  Components --> I18n
  Locale --> I18n
  Page --> Styles
  LLMPanel -->|fetch /api/llm| API --> OpenAI
  API -->|JSON 动作建议| LLMPanel
  LocalStore -->|日志/状态| LLMPanel
  LLMPanel -->|静态梦想数据| Data
```

## 关键说明

### 页面层
- `app/layout.tsx` 提供全局样式与字体，`app/page.tsx` 组合 UI 组件并读取 store 状态决定展示。
- 新增**模式选择**：进入页面后先选择「本地游戏」或「联机游戏」。
- 本地模式：直接进入 `SetupWizard` 配置玩家并开始。
- 联机模式：进入 `MultiplayerLobby` -> `RoomScreen`（创建/加入房间、准备、开始）。

### 状态引擎（单机模式）
- `lib/state/gameStore.ts` 以 Zustand + Immer 管理本地游戏状态、卡组、日志、合资与借贷动作，负责老鼠赛跑与快车道双棋盘（`boardSquares` / `fastTrackSquares`）的同步，以及初始化时从 `lib/data` 克隆并洗牌卡组。
- **保留不变**：单机模式完整保留原有逻辑，作为 fallback。

### 联机模式（新增）
- **游戏引擎**：`lib/engine/gameEngine.ts` 从原有 store 提取为纯函数式状态转换引擎（`applyAction(state, action) -> newState`），服务端与客户端共享同一套规则。
- **Server Actions**：`app/actions/roomActions.ts`（房间管理）与 `app/actions/gameActions.ts`（游戏操作）作为服务端网关，执行业务逻辑后写入 Supabase。
- **状态同步**：客户端通过 `lib/multiplayer/syncStore.ts`（Zustand）缓存状态，订阅 Supabase Realtime 的 Postgres Changes / Broadcast 接收更新。
- **乐观锁**：`game_states.version` 字段防止并发冲突；Server Actions 在写回时校验 version。
- **匿名认证**：首次进入自动 `signInAnonymously()`，零 friction。

### 数据与类型
- `lib/data/*` 提供静态棋盘/卡牌/场景/梦想数据，`lib/types.ts` 定义共享实体，`lib/i18n.ts` 提供多语言文案查找。
- `lib/engine/types.ts` 定义引擎内部类型（`GameEngineState`、`GameAction`、`DeckKey` 等）。

### LLM 代理
- `components/LLMPanel.tsx` 通过 `/api/llm` 将截取的游戏状态发送到 `app/api/llm/route.ts`，后者代理到 OpenAI（`OPENAI_API_KEY` 或用户临时 key），返回 JSON 化动作建议；日志入库由客户端调用 `recordLLMAction`（Zustand store）完成。

### 视觉层
- `app/globals.css` 定义主题 token、布局与卡片基础样式，组件内采用轻量 inline 样式按需覆盖。

> 若未来调整架构（新增后端服务、状态拆分、组件通信方式变更等），请同步更新本文件的架构图与说明。
