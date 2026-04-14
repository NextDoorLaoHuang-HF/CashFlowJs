# 课程版（中国化）规则草案 v0.1

本目录用于存放“面向财商教学/课程化、结合现代中国现实”的新规则草案，避免与仓库现有规则文档混淆：

- 现有重构版权威规则：`docs/game-rules-spec.md`
- 本目录规则（草案）：`docs/course-cn-v2/game-rules-spec.md`

> 说明：本规则草案的目标之一是降低与既有 IP 的混淆风险，因此会刻意避免使用一些强识别的旧术语与结构（例如“双环棋盘/特定阶段名/可识别卡面文案”）。

本目录规则草案目前包含：

- 8 回合（季度制）统一结算
- 胜利条件：财务自由（FI）+ 实现梦想
- 初期定位：课堂诚信/朋友局；顺序行动 + 响应窗口（不做 90 秒并行仲裁）
- 玩家间合作与博弈：合伙项目（Venture）+ 允许违约/背叛（可选，信任由玩家自行判断）
- 社交系统：自由聊天（公频）+ 晒资产（可选，建议写入回放日志）
- （可选）救济与系统性风险：救济窗口 + 破产连带（随机牵连一人）
- 常开核心博弈：黑盒项目 / 洗钱 / 审计与诉讼（建议默认启用；课堂诚信可先做软隐藏）
- 数据驱动规则落地草案：Hooks 白名单 + Effect Types 白名单 + 职业/事件卡数据结构（见下文链接）
- 策划版规则书（不含技术术语，适合讲解/复盘）：`docs/course-cn-v2/rulebook-for-designers.md`

## 开发流程与工程约定（v2 相关）

本目录也补充了“课程版 v2”在工程实现上的推荐落地顺序与注意事项（多人联机 / Rust 后端 / AI 玩家 / 规则改动流程）：

- 开发总流程与里程碑：`docs/course-cn-v2/dev-workflow.md`
- 规则改动流程（含与联机/回放的耦合点）：`docs/course-cn-v2/rule-change-process.md`
- 多端联机设计（事件日志/重连/回放/可选随机权威）：`docs/course-cn-v2/multiplayer.md`
- Rust 后端（房间/WS/日志持久化/Docker 部署）：`docs/course-cn-v2/rust-backend.md`
- AI 玩家（房主客户端托管、每个 AI 独立策略提示词、可见信息裁剪）：`docs/course-cn-v2/ai-players.md`
- Hooks/effects 白名单与数据结构草案：`docs/course-cn-v2/hooks-effects-schema.md`
