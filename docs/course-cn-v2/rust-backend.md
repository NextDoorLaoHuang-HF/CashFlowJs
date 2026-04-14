# Rust 后端（联机服务）实现建议：范围、结构、落库与部署

> 目标：先用 Rust 把“联机的硬需求”做扎实（房间/WS/排序/持久化/重连/回放），不急着把规则引擎也搬到服务端。
> 前提：课程版 v2 初期定位课堂诚信/朋友局，不做强反作弊；若未来要硬隐藏信息/公开对战，再升级为服务端权威视图/状态（见 `docs/course-cn-v2/dev-workflow.md`）。

## 1. 服务范围（建议先做这些）

必须有：
- 房间创建/加入（邀请码或 joinToken）
- WebSocket 连接管理（同房间广播）
- 动作排序：给每条 action 分配递增 `seq`
- 幂等：同一 `clientMsgId` 重发不重复提交
- 持久化：events + snapshots + room meta
- 重连：按 `snapshot + tail events` 恢复
- 导出：导出房间的日志/快照用于回放

可选增强（按需）：
- 随机权威：掷骰/抽牌由服务端生成并写入日志（见 `docs/course-cn-v2/multiplayer.md`）
- 房主转移：房主掉线后允许转移（朋友局可先“暂停等待房主回来”）
- 基础限流：每连接每秒 action 数限制，避免刷爆房间（聊天建议单独限频，见 `docs/course-cn-v2/multiplayer.md`）

## 2. 技术栈建议（Rust）

- Web 框架：`axum`（WebSocket 支持成熟）
- 运行时：`tokio`
- 序列化：`serde` + `serde_json`
- 数据库：优先 Postgres（并发写与 JSONB 友好）；`sqlx` 管理连接与迁移
- 部署：Docker + docker-compose（服务 + Postgres）

> SQLite 也能跑，但并发写与锁更容易踩坑；你预期同时在线 100，Postgres 更省心。

## 3. 端点与 WS 路由（建议）

HTTP：
- `POST /rooms`：创建房间（返回 `roomId`、`joinCode` 或 `joinToken`）
- `POST /rooms/:roomId/join`：加入房间（返回 `playerId`、`wsUrl`、`authToken`）
- `GET /rooms/:roomId/export`：导出回放数据（需要房主 token 或一次性导出 token）

WebSocket：
- `GET /rooms/:roomId/ws?token=...`

## 4. 数据库表（最小集合）

建议最少 4 张表：

- `rooms`
  - `id`
  - `created_at`
  - `rule_set_id`, `rule_set_version`
  - `data_version`
  - `action_version`, `snapshot_version`
  - `host_player_id`
  - `status`（lobby/active/paused/ended）

- `room_players`
  - `room_id`
  - `player_id`
  - `name`
  - `is_ai`
  - `ai_config_hash`（不存明文提示词也行）

- `events`
  - `room_id`
  - `seq`（单调递增，(room_id, seq) 唯一）
  - `client_msg_id`（(room_id, client_msg_id) 唯一）
  - `player_id`
  - `type`
  - `payload`（JSONB）
  - `server_time_ms`

- `snapshots`
  - `room_id`
  - `seq`
  - `state`（JSONB）
  - `server_time_ms`

## 5. 服务端校验（朋友局也别省）

建议至少做：
- token → playerId 绑定（服务端保存连接身份）
- `proposeAction.playerId` 必须等于该连接身份，除非：
  - 该连接是 `host_player_id`
  - 且目标 player 是 `is_ai=true`

这样可以避免：
- 非房主伪造 AI 动作
- 玩家伪造其他玩家动作

## 6. 部署（VPS + Docker）建议

典型 docker-compose：
- `server`：Rust WS 服务
- `postgres`：数据库
- （可选）`caddy/nginx`：TLS 终止 + 反向代理到 WS

注意事项：
- 生产必须走 `wss://`（TLS），否则浏览器跨域/安全策略会遇到坑
- 记录日志时不要打印 joinToken、不要打印 OpenAI key（如果未来服务端接触到）

## 7. 未来升级路径（可选）

当你需要“硬隐藏/防作弊/公开对战”时：
- 服务端需要持有完整 state，并推进规则结算
- 最平滑的路线通常是：
  1) 先把现有 TS 引擎抽成纯 `engine`（可在 Node 服务端运行）
  2) 等规则稳定后再评估是否值得把 engine 移植 Rust
