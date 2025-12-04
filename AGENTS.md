# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript Vite app; `domain/` game rules, `state/` zustand store/events, `ui/` DOM renderers and forms, `main.ts` entry, `style.css` root styles.
- `public/`: static assets served by Vite; `public/legacy` is generated from `baselines/legacy-v0` by `npm run sync:legacy`.
- `baselines/legacy-v0/`: frozen legacy HTML/CSS/JS for regression; keep read-only unless intentionally updating the baseline.
- `js/` + `css/`: legacy assets mirrored for reference; prefer touching `src/` for new work.
- `tests/`: Vitest suites (`*.test.ts`); includes `legacy-smoke.test.ts` guarding baseline DOM.
- `scripts/`: utility scripts (e.g., syncing legacy assets).

## Build, Test, and Development Commands
- `npm run dev`: start Vite dev server; `predev` syncs legacy assets into `public/legacy`.
- `npm run build`: type-checks (`tsc -b`) then Vite production build.
- `npm run lint` / `npm run format`: ESLint with TypeScript rules and Prettier auto-format.
- `npm test`: run Vitest once; `npm run test:watch` for TDD loop.
- `npm run smoke:legacy`: legacy DOM smoke suite for baseline edits.
- `npm run sync:legacy`: manual refresh of `public/legacy` when baseline assets change.

## Coding Style & Naming Conventions
- TypeScript (`"strict": true`); use the `@/` alias for imports from `src`.
- Prettier: 2-space indent, single quotes, semicolons, trailing commas (ES5), 100-char width.
- ESLint extends `eslint:recommended`, `@typescript-eslint`, and Prettier; ignores build output, `baselines/legacy-v0`, and legacy `js/css`.
- Naming: PascalCase for types/enums, camelCase for functions/variables, kebab-case for file names; keep DOM data attributes lowercase (e.g., `data-screen`).
- Keep UI copy in simplified Chinese where it already appears; keep event log messages concise.

## Testing Guidelines
- Framework: Vitest with jsdom; place specs under `tests/` with `*.test.ts` suffix.
- State-heavy code should assert store transitions; UI helpers can be exercised via DOM snapshots.
- Legacy baseline must stay intact—if you need to alter it, update `baselines/legacy-v0` and the smoke test expectations together.
- Optional coverage: `npx vitest run --coverage` for critical logic.

## Commit & Pull Request Guidelines
- Commit messages follow short present-tense summaries (English or 简体中文), similar to `Updated "Have +3 kids" option text`; avoid multi-topic commits.
- PRs should describe intent, link issues when applicable, and list test commands run (lint, unit, smoke).
- For UI changes, attach before/after screenshots or a short clip from the Vite dev build.
- Note any impacts to saved games/localStorage; call out new configuration knobs or breaking changes.

## 关于语言
用户的母语为中文，因此当需要向用户展示内容或与用户交互时，需要使用中文。其他情况根据你的喜欢使用语言