# 多端联机设计（事件日志 / 重连 / 回放 / 可选随机权威）

> 推荐目标：朋友局可用、能重连、能复盘；不追求强对抗防作弊，但尽量避免“客户端分歧/卡局/重复扣钱”。

补充约束（课程版 v2 当前取舍）：
- 初期定位课堂诚信/朋友局：隐藏信息默认只做“软隐藏”（UI 不展示），不做强反作弊。  
- 交互采用“顺序行动 + 响应窗口”，避免 90 秒并行仲裁带来的并发冲突与复盘复杂度。  
- 若未来需要陌生人匹配/公开对战/硬隐藏信息，需要升级为“服务端权威视图/状态”（见 `docs/course-cn-v2/dev-workflow.md`）。  

## 1. 基线架构（推荐）

```mermaid
flowchart LR
  subgraph Clients[浏览器客户端（多个）]
    A[玩家A]
    B[玩家B]
    H[房主客户端\n(托管 AI + /api/llm)]
  end

  WS[Rust WebSocket 服务\n房间/排序/持久化/重连]
  DB[(Postgres\nevents + snapshots + rooms)]
  LLMAPI[/Next.js /api/llm\nOpenAI 代理/]
  OpenAI[(OpenAI)]

  A <-- ws --> WS
  B <-- ws --> WS
  H <-- ws --> WS
  WS <--> DB
  H --> LLMAPI --> OpenAI
```

职责划分：
- 客户端：渲染 UI、本地运行规则引擎（`lib/state/gameStore.ts`），但**只在收到服务端确认的 action 后**更新对局状态。
- 服务端（Rust）：房间、连接、动作排序（`seq`）、持久化、重连同步；可选负责随机结果（见第 5 节）。  
  - （推荐）维护最小“对局流程状态”（不做财务结算）：当前轮到谁、是否处于响应窗口、窗口参与者与截止时间；用于拒绝明显不合时序的 action，并在超时后提交默认结果，避免卡局与回放分歧。
- 房主客户端：额外承担“AI 玩家自动出招”的 LLM 调用（不把 API Key 放服务端）。

## 2. 数据与版本（必须显式化）

建议房间元数据至少包含：
- `ruleSetId`：例如 `refactor-v1` / `course-cn-v2`
- `ruleSetVersion`：规则文档版本（便于定位回放差异）
- `dataVersion`：卡牌/场景数据版本（或 hash）
- `enabledModules`：本局启用的可选模块开关（数组或 bitset；必须参与回放定位）
- `ruleOptions`：本局规则参数（非模块开关），例如“回合单位=季度/月份、响应窗口超时秒数、抽牌数量覆盖值”等；建议一并记录，避免同一份 action log 在不同课堂配置下出现复盘差异  
  - 示例：`responseWindowTimeoutSeconds = 20`（短硬超时）、`turnUnit = "quarter" | "month"` 等  
  - 若启用（或默认启用）黑盒模块：建议把 `launderRate`、审计费/律师费的“最低值与倍率参数”、以及黑盒项目条款菜单（募集档位/利息档位/期限档位）也写入 `ruleOptions`，否则同一份日志在不同课堂配置下可能复盘分歧（见 `docs/course-cn-v2/game-rules-spec.md` 9.7）。
- `actionVersion`：action schema 版本
- `snapshotVersion`：snapshot/state schema 版本
- `players[]`：含 `isAI`、AI 配置 hash（策略提示词不广播）
- `hostPlayerId`

原则：
- 任何会影响回放一致性的改动，都必须体现在版本字段里。

## 3. Action Log：联机、重连、回放都围绕它

### 3.1 Action Envelope（建议结构）

服务端落库/广播的 action 统一为“信封格式”，最低建议字段：

```ts
type ActionEnvelope = {
  roomId: string;
  seq: number;              // 服务端分配，严格递增
  actionVersion: number;
  playerId: string;         // 归属玩家（谁在做动作）
  type: string;             // 动作类型
  payload: unknown;         // 动作数据（JSON）
  clientMsgId: string;      // 客户端生成的幂等ID（重发不重复提交）
  serverTimeMs: number;     // 服务端写入时间（调试/复盘用）
};
```

幂等要求：
- 服务端对 `(roomId, clientMsgId)` 做唯一约束；同一条消息重发只返回同一个 `seq`。

### 3.2 Snapshot（推荐）

为了重连快、服务器压力小，建议周期性存 `snapshot`：
- 触发策略：每回合结束 / 每 N 条 action / 关键状态机切换点
- snapshot 内容：**可序列化的完整游戏状态**（不要包含 React/UI 临时态）

## 4. WebSocket 协议（建议消息流）

> 这里描述“推荐形态”，不是强制实现；但关键点（seq、幂等、重连）建议不要省。

### 4.1 连接与加入

1) 客户端通过 HTTP 拿到 `roomId + joinToken`（或邀请码）
2) 建立 WS：发送 `hello`
3) 服务端回 `welcome`（包含 room 元数据、你的 playerId、当前最新 seq）

### 4.2 提交动作

- 客户端发送 `proposeAction`：
  - 只携带 `type/payload/playerId/clientMsgId`
  - 不携带 `seq`（由服务端分配）
- 服务端校验：
  - 该连接是否允许代表该 `playerId` 出招（房主可代表 AI）
  - 幂等：`clientMsgId` 未处理过
- 服务端写入 DB 后广播 `committedAction(ActionEnvelope)`
- 客户端收到 `committedAction` 后再调用本地引擎 `applyAction`

> 建议默认“不做乐观更新”：避免回滚复杂度。

### 4.3 重连

- 客户端断线后重连，发送 `resume(lastSeenSeq)`
- 服务端返回：
  - 最近的 `snapshot`（seq = S）
  - `committedAction` 列表（seq = S+1..latest）

客户端处理：
- `rehydrate(snapshot)`
- 顺序重放 actions

### 4.4 响应窗口与超时（避免卡局，强烈建议）

课程版 v2 的很多互动（合伙入股、救济窗口、全员可回应的事件等）都依赖“响应窗口”。为了可回放与避免卡局，建议遵循：

- **窗口要可回放**：响应窗口不应只存在于 UI 的临时弹窗里，而应体现在 action log 中（例如“窗口开启/关闭、谁在什么时候选择了什么”）。  
- **超时要有权威口径**：推荐由服务端维护最小窗口状态并负责超时收敛（建议按“当前轮到的响应者”单独计时：每位响应者到点自动视为“拒绝/不参与”），把“默认结果/窗口关闭”也写入 action log。客户端不要用本地计时直接做结算，避免不同设备/刷新导致分歧。  
- **动作要可校验**：服务端可据此拒绝“非当前玩家”或“非窗口参与者”的动作提交（不要求服务端懂财务结算，只需要懂流程与窗口）。
  - 推荐默认：短硬超时（每位响应者例如 `20 秒`）；具体数值建议写入 `roomMeta.ruleOptions.responseWindowTimeoutSeconds`，方便复盘与课堂调参对比。

## 5. 随机数与抽牌：推荐“结果事件入日志”（可选权威随机）

### 5.1 为什么建议服务端生成随机结果

即使你不做强对抗，随机相关仍是分歧高发区：
- 两端 `Math.random()` 细微差异导致不同牌/不同点数
- 客户端持有洗好的牌堆会出现“预知未来”的作弊空间（尤其是 AI）

### 5.2 最小可行做法：服务端只负责“随机结果”，不负责规则结算

把随机结果作为 action 记录（服务端产生并提交）：
- `ROLL_RESULT { diceCount, results[] }`
- `CARD_DRAWN { deckId, cardId }`
- `RANDOM_CHOICE { purpose, candidates[], chosen }`（例如“破产连带随机选人”）

客户端遇到需要随机时：
- 发送 `requestRoll` / `requestDraw(deckId)`
- 服务端生成结果并广播对应的 `*_RESULT` / `CARD_DRAWN` action

服务端实现抽牌最小状态：
- 对每个 `deckId` 维护一份 `order[] + cursor`
- cursor 走到末尾就重新 shuffle 一次（等价于“弃牌堆洗回”）

### 5.3 退路：完全客户端随机（最省工，但风险更高）

如果你接受“朋友局信任 + 偶尔分歧靠重连解决”，也可以：
- 客户端自己抽牌/掷骰并把结果写进 action payload
- 服务端只做排序与持久化

注意：这会让“房主托管 AI”天然拥有更强的作弊空间（能预知牌序/掷骰）。

## 6. 权限与角色（朋友局也建议做）

最低建议：
- 连接绑定 `playerId`（服务端侧）
- 非房主连接不能提交其他玩家的 action
- 房主连接允许提交“AI 玩家 action”（且仅限标记为 `isAI` 的玩家）
- （推荐）时序校验：基于最小“对局流程状态”拒绝非当前玩家/非窗口参与者的 action，避免并发冲突与卡局。

## 7. 回放与导出（复盘的关键）

建议提供：
- 导出：`roomMeta + snapshots + actionLog`
- 回放工具（哪怕先是开发者工具）：加载导出 JSON → 本地重放 → 比对 `stateHash`

## 8. 聊天与社交（推荐写入日志，但不影响结算）

> 课堂诚信/朋友局里，“自由聊天 + 晒资产”是玩法的重要组成。  
> 为了复盘与教学回看，建议把聊天也作为 event 落库/可回放；但聊天不应参与 `stateHash`（避免噪声导致难排查）。

### 8.1 Chat 事件（建议作为 ActionEnvelope.type）

推荐最小事件：

- `CHAT_MESSAGE { channel, text }`
  - `channel`: `"global"`（可选扩展 `"private"`）
  - `text`: string（建议限长，例如 200-500 字）
- `SHOW_OFF { summary }`
  - `summary`: 结构化摘要（不要直接把全量财务表塞进来）
  - UI 可做“展示 10 秒”的效果，但事件本身只记录发生时刻与摘要内容

> 实现提示：客户端收到 `committedAction` 后，如果 `type` 属于聊天类，则只更新聊天 UI/聊天日志；不调用规则引擎或规则引擎直接忽略。

### 8.2 防刷屏（服务端最小限流）

建议服务端按连接做基础限流：
- `CHAT_MESSAGE`：例如 `1 秒 1 条`，超出直接拒绝并回错误提示
- 限制单条 `text` 长度，拒绝超长 payload

这不属于“强反作弊”，但能避免朋友局被刷屏拖垮。
