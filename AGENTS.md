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
- 规则/架构变更流程：先更新 `docs/game-rules-spec.md` / `docs/architecture.md`，再改代码，最后 `npm run lint` + 手动验收

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
- `npm run lint` — ESLint with Next.js config; run before commits/PRs.

## Coding Style & Naming Conventions
- TypeScript with `strict` mode; mark interactive components with `"use client"`.
- `PascalCase` for React components/files, `camelCase` for variables/functions/selectors, `SCREAMING_SNAKE_CASE` only for shared constants.
- Keep data/constants in `lib/data` or `lib/types`; co-locate small helpers with their component.
- Prefer CSS variables and utilities from `app/globals.css`; inline styles are fine for small tweaks.
- Use Zustand selectors (`useGameStore((state) => …)`) to limit re-renders; update state via Immer producers, not mutation.

## Testing Guidelines
- No automated tests yet; rely on `npm run lint` plus manual checks (setup wizard, rolls/deals, ventures/loans, log export, locale toggle, LLM prompt flow).
- If adding tests, prefer Vitest + React Testing Library; co-locate as `*.test.ts(x)` or under `__tests__/`.
- Target reducers in `lib/state/gameStore.ts`, deck shuffling, localization fallbacks, and API request/response handling.

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
