# Repository Guidelines

## 开发对齐（必读）
- 重构版规则权威（唯一口径）：`docs/game-rules-spec.md`（改规则先改文档）
- 旧版实现缺陷与规则差异审计：`docs/legacy-logic-audit.md`（避免复刻 bug）
- 旧版行为基准（仅供对照）：`docs/legacy-rules-baseline.md`
- 架构图：`docs/architecture.md`（跨组件/跨模块数据流变更必须同步更新）

## 开发计划（Roadmap）
- P0：所有规则结算集中在 `lib/state/gameStore.ts`；组件只能触发 action/展示状态，禁止在组件里写规则
- P1：补齐资产/负债报表与交互（卖出资产、还款银行贷款、选择性卖出 Offer）
- P2：实现 Offer/Stock 的 “Everyone may sell” 全员响应窗口（按回合顺序可复盘）
- P3：外圈（Fast Track）事件表数据化（如需对齐 `legacy/js/fasttrack.js`，必须先修复旧版 bug 再移植）
- 规则/架构变更流程：先更新 `docs/game-rules-spec.md` / `docs/architecture.md`，再改代码，最后 `npm run lint` + `npm run test` + `npm run test:e2e`

## Project Structure & Module Organization
- `app/`: Next.js App Router entry (`layout.tsx`, `page.tsx`) plus API route `api/llm/route.ts`.
- `components/`: Client-side UI blocks (board grid, control panels, log, localization toggle, LLM console).
- `lib/state/gameStore.ts`: Zustand + Immer game engine; add reducers/selectors here instead of components.
- `lib/data/`: Board squares, cards, scenarios, and dreams. Extend data here; avoid mutating at runtime.
- `lib/i18n.ts`, `lib/types.ts`: Localization helpers and shared types; use `t(locale, key)` for strings.
- `app/globals.css`: Theme tokens and utilities. `legacy/` is the prior static build—reference only.

## Architecture Diagram
- System diagram lives in `docs/architecture.md` (Mermaid). When architecture or cross-component data flow changes, update the diagram and notes in that file as part of the design change.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — start the dev server on port 3000 with hot reload.
- `npm run build` — production build (used by Vercel).
- `npm run start` — serve the compiled build.
- `npm run lint` — ESLint with Next.js config.
- `npm run test` — Vitest 单元测试（UI primitives + gameStore reducers）。
- `npm run test:coverage` — Vitest 覆盖率报告。
- `npm run test:e2e` — Playwright 端到端测试（多人游戏流程）。
- **提交流程**：`npm run lint` → `npm run test` → `npm run test:e2e` 全部通过后提交。

## Coding Style & Naming Conventions
- TypeScript with `strict` mode; mark interactive components with `"use client"`.
- `PascalCase` for React components/files, `camelCase` for variables/functions/selectors, `SCREAMING_SNAKE_CASE` only for shared constants.
- Keep data/constants in `lib/data` or `lib/types`; co-locate small helpers with their component.
- Prefer CSS variables and utilities from `app/globals.css`; inline styles are fine for small tweaks.
- Use Zustand selectors (`useGameStore((state) => …)`) to limit re-renders; update state via Immer producers, not mutation.

## Testing Guidelines — 红绿测试驱动开发（TDD）

### 当前测试体系
- **单元测试**：Vitest + React Testing Library，位于 `test/*.test.ts(x)`。已覆盖 UI primitives（`test/ui-primitives.test.tsx`）和 `lib/state/gameStore.ts` reducers。
- **E2E 测试**：Playwright，位于 `e2e/multiplayer.spec.ts`。已覆盖：
  1. 双浏览器创建/加入房间并互相可见
  2. Host 开始游戏后双方进入游戏板（BoardGrid/ControlPanel）
  3. 当前玩家掷骰子并推进回合
- **覆盖率**：当前 `gameStore.ts` ~44%，UI 组件（BoardGrid、PortfolioPanel、SetupWizard 等）为 0%，是重点补齐方向。

### TDD 开发纪律（以后所有开发必须遵守）
1. **改规则 / 改 store**：先写/更新单元测试（红），再修改 `lib/state/gameStore.ts`（绿）。目标 `gameStore.ts` 覆盖率达到 80%+。
2. **改多人游戏流程**：先写/更新 E2E 测试（红），再改 `lib/multiplayer/` 或相关组件（绿）。E2E 测试必须串行执行（`workers: 1`），避免房间状态冲突。
3. **新功能**：
   - 纯 UI 组件 → 写 Vitest 组件测试（渲染、交互）。
   - 游戏逻辑 → 写 `gameStore.ts` reducer 单元测试（输入 state + action → 断言输出 state）。
   - 跨端同步 → 写 Playwright E2E 测试。
4. **不允许的情况**：没有对应测试的代码改动直接提交。补测试 = 同一 PR 内完成。
5. **LLM 路由豁免**：`app/api/llm/route.ts` 因涉及外部 OpenAI API 调用，暂不强制要求测试。

### 技术规范
- 单元测试：Vitest + React Testing Library；文件命名 `*.test.ts(x)`。
- E2E 测试：Playwright；配置在 `playwright.config.ts`；测试在 `e2e/` 目录。
- E2E 环境变量通过 `node --env-file=.env.local` 注入，需要 `.env.local` 包含 Supabase 凭据和 `TEST_BASE_URL`。

## Commit & Pull Request Guidelines
- Commits in history are short, present-tense summaries; follow that style (e.g., `Adjust venture payout`, `Fix localization toggle`).
- PRs should include a brief description, linked issue/ticket, screenshots for UI changes, and a test plan (commands run and manual steps).
- Keep scope focused; call out gameplay data changes in `lib/data` so reviewers can verify balance impacts.

## Security & Configuration Tips
- `OPENAI_API_KEY` is read from `.env.local` or supplied at runtime; never commit secrets or logs containing keys/model output.
- `app/api/llm/route.ts` forwards prompts to OpenAI; validate inputs and avoid storing PII in logs or telemetry.
- Add new assets/strings in `app/` and `lib/`; keep `legacy/` untouched except for historical reference.

## Agent Interaction Notes
- **Language**: 用户母语为中文；在与用户交互、编写展示内容或提供示例时请统一使用中文。
