## CashFlowJs (Vercel 版本)

本仓库包含使用 **Next.js 14 + TypeScript** 重建的现代化 CashFlowJs 版本。
游戏逻辑从原始项目移植而来，但新的 UI 采用组件驱动、支持本地化，并已准备好部署到 Vercel。

### 主要特性

- ✅ **Next.js App Router**，客户端组件，零配置 Vercel 部署
- ✅ **中英文** 本地化支持，即时切换
- ✅ **完整游戏记录器**（可导出 JSON 日志用于回放/复盘）
- ✅ **合资引擎**，玩家可以组建联合投资
- ✅ **玩家间借贷**，包含追踪和还款流程
- ✅ **LLM 驱动的玩家** – 接入 OpenAI 密钥即可获得自主的沙盒对手

> 历史版本的静态实现保留在 `legacy/` 目录下供参考。所有新游戏功能都在 `app/` 目录中实现。

---

[📖 English Version](/docs/README.md) | 中文版

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3000 即可开始新的游戏体验。

### 环境配置

LLM 助手需要 `OPENAI_API_KEY`。你可以：

- 在 `.env.local` 中设置 `OPENAI_API_KEY`，或者
- 在"LLM 玩家控制台"中提供临时密钥后再运行提示。

## 项目结构

```
app/                 Next.js App Router 入口
components/          可重用的 UI 组件
lib/data/            游戏板、场景和卡片数据（从 legacy 移植）
lib/state/           Zustand/Immer 游戏状态管理和引擎
legacy/              原始静态资源（供参考）
```

## 脚本命令

- `npm run dev` – 启动本地开发服务器
- `npm run build` – 生产构建（Vercel 使用的版本）
- `npm run start` – 启动编译后的构建版本
- `npm run lint` – 源码检查

## 备注

- 游戏数据（卡片、游戏板格子、场景、梦想）与原始规则保持一致。
- 日志可以导出为 JSON 格式，用于回顾每一步操作（"复盘"）。
- 合资和贷款在交易达成时会自动调整玩家的现金和被动收入，因此记录的条目始终与游戏中的资产负债表匹配。
- 开发对齐文档：
  - `docs/game-rules-spec.md`（重构版统一规则规范 / 目标口径）
  - `docs/legacy-logic-audit.md`（旧版实现缺陷与差异审计）
  - `docs/legacy-rules-baseline.md`（旧版行为基准 / 仅供对照）

本项目仍然是一个受 CashFlow 101 启发的粉丝制作项目。游戏机制仅供教育目的使用，CashFlow 商标归其各自所有者所有。

