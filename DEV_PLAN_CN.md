# 开发计划

## 进度快照（当前迭代）
- ✅ Legacy 玩法默认启用：根入口自动重定向至 `public/legacy/index.html`，保持完整棋盘/卡牌体验；新版 Vite UI 通过 `?ui=next` 显式启用，避免对玩家的功能回退。
- ✅ 存档防御：`src/domain/save.ts` 增加版本校验、字段填充、localStorage 不可用时的降级提示，UI 对应按钮展示错误原因。
- ⏳ New UI 覆盖度：仅有玩家配置 + 回合控制台，尚未接入卡牌流、快车道、资产/财务面板。后续迁移需要按阶段 2+ 拆解。

## 阶段0：基线审计 ✅
- 盘点当前 UI 流程、`js/index.js`、`js/cards.js` 等核心脚本，梳理依赖与隐藏约束。（详见 `docs/baseline-audit.md`）
- 冻结一份“已知稳定”构建版本，并补充轻量冒烟测试，作为后续重构的回归基准。（`baselines/legacy-v0` + `tests/legacy-smoke.test.ts`）

## 阶段1：工具链与架构基础 ✅
- 完善 `package.json`，引入 Vite（或等效 bundler）、ESLint/Prettier、Jest/Vitest 以及 TypeScript（可先用 JSDoc 增量迁移）。(`vite`, `typescript`, `vitest`, `eslint`、`prettier` 已配置，`npm run dev / build / test / lint` 可用)
- 将单一 `APP` 全局拆分为 ES Module：状态存储、领域服务（轮次、卡牌、财务、存档）与展示层独立。（`src/state/*`, `src/domain/*`, `src/ui/*`）
- 建立统一状态容器（Redux/Zustand/Pinia 等）与事件总线，让 UI 与未来自动化/AI 使用相同的状态流。（Zustand vanilla store + mitt 事件总线，UI 通过订阅驱动）
- ⚠️ 当前新版 UI 仅覆盖玩家配置与基础回合循环；卡牌/快车道/财务等完整玩法仍需在阶段 2+ 逐步迁移。已将新版放在 `?ui=next` 旗标后，默认走 legacy，以避免回退。

## 阶段2：国际化流水线
- 引入 `src/i18n` 资源目录，以 JSON/TS 常量集中管理 UI 文案，并提供 `useLocale()` helper 从 Zustand 状态读取/写入语言。
- 集成 i18next（或等效轻量实现），支持运行时语言切换、浏览器首选项回退、数字/货币格式化，并在 `src/ui/*` 中替换硬编码文本。
- 迁移 legacy 文案：先完成 zh-CN（默认）与 en-US，利用 Vitest 快照守护关键屏幕文本；通过 `npm run test` 自动校验缺失 key。
- 在 `README.md` 与贡献指南中写明新增语言的提交流程（资源文件命名、翻译校验、审阅责任人）。

## 阶段3：可复盘的游戏日志
- 扩展 `src/state/events.ts` 类型，定义“回合开始 / 掷骰 / 买入 / 贷款 / FastTrack 切换”等结构化事件枚举。
- 在 `src/domain/*` 的关键动作中统一调用 `logEvent()`，并实现 `src/domain/save.ts` 的增量快照（事件日志 + 周期性状态）。
- 持久化策略：localStorage 中保存 `events[] + checkpoints[] + version`，提供导入/导出 JSON 功能，Vitest 回放测试验证 determinism。
- 新增 “复盘” UI：时间轴 + 跳转到指定回合 + 快速预览资源变化，确保与现有 board-screen 解耦。

## 阶段4：合作金融系统
- 扩展 `Player`/资产模型：支持资产共享（持股比例、唯一资产 ID）、玩家间贷款（利率、分期、违约状态）。
- 新建 `src/domain/coop.ts` 处理合资交易与规则校验（收益分成、赎回顺序、违约流程），以单元测试覆盖。
- UI：在 board-screen 增加“合资/借贷”面板，允许发起邀请、审批、进度追踪；与状态容器/事件总线对接，便于未来自动化调用。

## 阶段5：AI/LLM 玩家接入
- 设计 `src/api/agents.ts`：暴露“观察游戏状态”和“提交动作”接口，支持异步指令与超时/错误恢复。
- 实现本地 Bot 适配层：封装对 LLM 或启发式算法的请求，统一回调格式，配置速率限制与失败回退。
- UX：在 UI 中显示 AI 思考进度、允许人工接管或驳回动作；将关键交互事件写入日志以便审计。

## 阶段6：加固与发布
- 构建测试矩阵：规则单元（域服务）、UI 集成（Vitest + jsdom/Playwright）、国际化快照、事件回放。
- 优化打包：针对 Vite 构建产物开启代码拆分/压缩，审查第三方依赖体积；接入 CI（lint/test/build/preview）。
- 编写扩展指南（插件、卡牌、AI Bot 接口），规划 phased rollout：内部测试→带日志的 Beta→合资/AI 小范围→公开版本；完成 Vercel 部署清单和监控。

## Vercel 部署注意事项
- 保持纯前端或轻 Serverless 架构即可直接落地到 Vercel 免费计划；构建产物交由 CDN 分发即可。
- 若合资/借贷或 LLM 玩家需要后端 API，优先封装为 Vercel Serverless/Edge Functions，并监控免费额度下的调用次数与执行时间，必要时切换到外部服务或升级套餐。
- 涉及 LLM 的密钥和回调必须放在服务器端，避免在浏览器暴露；同时做好失败重试与速率限制，避免触发平台限流。

## 计划调整建议
- 在阶段 2 开始前，新增一个“阶段 1.5：玩法迁移封装”子阶段：将 legacy 卡牌/掷骰/快车道逻辑模块化搬运到 `src/domain/*`，确保新版 UI 具备最小可玩性后再做国际化/UI 重写，避免双轨长期分裂。
- 将存档版本升级与迁移脚本纳入阶段 3 的“可复盘日志”工作，保证事件回放与状态迁移同版本演进。
- 在阶段 4 的合作金融设计时同步评估 legacy 规则差异，确保迁移后兼容旧存档或提供显式“升级存档”提示。
