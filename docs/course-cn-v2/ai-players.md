# AI 玩家（房主客户端托管）设计：全自动接管、独立策略、可见信息控制

## 1. 目标与边界（基于讨论结果）

- AI 全自动接管一个玩家：轮到它时自动出招，不需要人工点击。
- 开局前可为每个 AI 设置独立策略提示词（prompt）；对局开始后锁定，本局始终遵守。
- OpenAI API Key 由房主配置并只在房主端使用（不存服务端、不广播给其他玩家）。
- “隐藏财务细项”对人类是软隐藏（UI 不展示）；对 AI 的可见信息通过输入裁剪来控制。
- 初期定位课堂诚信/朋友局：不做强反作弊；若未来需要硬隐藏信息/公开对战，需要升级为服务端权威视图/状态（见 `docs/course-cn-v2/dev-workflow.md`）。

## 2. 架构：把 AI 当成“会自动提交 action 的玩家”

核心原则：
- AI 不直接改 state；它只产出 `Action`，并走同一条联机管道：
  - 房主生成 action → 发送 WS → 服务端分配 `seq` 并落库 → 广播 → 所有客户端应用该 action
- 回放复盘只重放 action log；**不依赖再次调用 LLM**。

## 3. 开局配置（Lobby 阶段）

每个 AI 玩家建议有一份 `botConfig`（对局开始后冻结）：
- `prompt`：策略提示词（私有，仅房主保存明文）
- `model`：模型名（如 `gpt-4o-mini`）
- `temperature` / `top_p`（可选）
- `timeoutMs`：单次决策超时
- `maxRetries`：输出不合法时的重试次数
- `fallbackPolicy`：兜底策略（如 `pass` / `最低风险动作`）
- `publicLabel`（可选）：给其他玩家看的“策略名称”（不泄露具体 prompt）
- `configHash`：把 prompt + 参数 hash 后写入房间元数据/日志，便于复盘审计

注意：
- prompt 明文不建议广播；否则“两个 AI 不同策略对战”的策略会被对方直接看到。

## 4. AI 可见信息控制（软隐藏 + LLM 输入裁剪）

推荐统一一个函数生成“AI 输入视图”：

- `getPlayerView(state, playerId, visibilitySetting)`

用法：
- UI 展示用它（对人类实现软隐藏：不展示不代表没数据）
- LLM 输入也用它（对 AI 实现“硬约束”：你不喂它就看不到）

实践建议：
- 默认全公开模式：`playerView` 可包含全体玩家财务表
- 隐藏模式：对“非本人”只提供最小信息（例如位置/回合/公开事件/公开项目），不提供资产负债细项

> 提醒：如果 AI 运行在房主客户端，它技术上仍能访问全量 state；真正的强隔离需要服务端权威视图。但朋友局通常不需要做到那一步。

## 5. 让 AI 输出“可执行 action”（强约束）

全自动接管必须让模型输出可解析、可校验的动作：

输入给模型的内容建议固定三块：
1) 固定策略 prompt（system 或第一段文本）
2) 当前 `playerView`（JSON，尽量短）
3) `legalActions`（允许的 action 列表 + JSON schema/示例）

输出强约束：
- 只允许输出 JSON（或 function calling），形如：
  - `{ "type": "...", "payload": {...} }`

可选：若启用“自由聊天/晒资产”，也可以把 `CHAT_MESSAGE` / `SHOW_OFF` 作为合法 action 提供给 AI（但建议默认关闭，避免刷屏；并强制限频/限长，见 `docs/course-cn-v2/multiplayer.md`）。

校验与兜底（必须做）：
- 在房主端对输出做：
  - JSON 解析
  - `type/payload` 结构校验（schema）
  - 规则层校验（当前状态下是否允许该 action）
- 不合法则重试（把错误原因反馈给模型），超过次数走 `fallbackPolicy`
- 全流程要有超时，避免卡死回合

## 6. 触发时机与“避免重复出招”

房主客户端需要一个 bot runner（状态机）：
- 仅当 `isHost=true` 时运行
- 仅当 `currentPlayer.isAI=true` 且游戏状态不处于“等待人工输入窗口”时触发
- 用 guard 防止重复触发：
  - 例如记录 `lastBotActedSeq` 或 `lastBotActedTurnId`

建议行为：
- 收到服务端 `committedAction` 后再评估是否轮到 AI（避免乐观更新导致错判）

## 7. 房主掉线的处理（朋友局推荐最简单策略）

因为 AI 依赖房主的 API Key：
- 房主掉线：对局进入 `paused`（服务端广播），提示“等待房主重连”
- 可选：支持房主转移（新房主需要重新填写 API Key 才能继续驱动 AI）

## 8. 与现有 `/api/llm` 的关系

仓库已有：
- `app/api/llm/route.ts`：OpenAI 代理
- `components/LLMPanel.tsx`：手动触发 LLM 建议

建议复用 `/api/llm` 的网络调用与返回结构，但把“手动按钮”升级为“bot runner 自动触发”，并把输出从“建议文本”升级为“可执行 action”。
