## CashFlowJs (Vercel Edition)

This repository contains the modernized version of CashFlowJs rebuilt with **Next.js 14 + TypeScript**.
The gameplay logic is ported from the original project, but the new UI is component-driven, localized, and ready for Vercel deployment.

---

English | [📖 中文版](/README.md)

### Highlights

- ✅ **Next.js App Router**, client components, and zero-config Vercel deployment
- ✅ **English / Chinese** localization with instant toggling
- ✅ **Comprehensive game recorder** (JSON exportable log for replay/review)
- ✅ **Joint venture engine** so players can form co-investments
- ✅ **Player-to-player lending** with tracking and repayment flows
- ✅ **LLM-driven players** – plug in an OpenAI key for autonomous sandbox opponents

> The legacy static implementation lives under `legacy/` for historical reference. All new gameplay happens inside the `app/` directory.

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 to start the new experience.

### Environment

The LLM helper looks for `OPENAI_API_KEY`. You can either:

- set `OPENAI_API_KEY` in `.env.local`, or
- provide a temporary key inside the “LLM Player Console” before running a prompt.

## Project Structure

```
app/                 Next.js app router entry
components/          Reusable UI building blocks
lib/data/            Board, scenario, and card data (ported from legacy)
lib/state/           Zustand/Immer game store and engine
legacy/              Original static assets for reference
```

## Scripts

- `npm run dev` – start local dev server
- `npm run build` – production build (what Vercel uses)
- `npm run start` – start the compiled build
- `npm run lint` – lint source

## Notes

- Gameplay data (cards, board squares, scenarios, dreams) mirrors the original rules.
- Logs can be exported as JSON for reviewing every move (“复盘”).
- Joint ventures and loans automatically adjust player cash and passive income when deals close, so the recorded entries always match the in-game balance sheet.

This remains a fan-made project inspired by CashFlow 101. The game mechanics are for educational purposes only and the CashFlow trademark belongs to its respective owner.



