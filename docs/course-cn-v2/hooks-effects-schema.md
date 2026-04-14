# 课程版 v2：Hooks 白名单 + Effect Types 白名单 + 职业/事件卡数据结构（草案 v0.1）

> 目标：支持“内容中国化 + 可扩展”，并尽量做到“加职业/加事件卡不改代码”。  
> 范围：仅定义数据结构与引擎需要支持的 **白名单 hooks/effects**；不定义 UI 细节、不绑定当前重构版棋盘规则。  
> 适用：课堂诚信/朋友局（默认软隐藏）；未来若升级为服务端权威视图/状态，可在不破坏 schema 的前提下增强隐私与校验。

相关文档：
- 课程版 v2 规则草案：`docs/course-cn-v2/game-rules-spec.md`
- 联机/回放基线：`docs/course-cn-v2/multiplayer.md`
- 规则改动流程：`docs/course-cn-v2/rule-change-process.md`

---

## 0. 设计原则（实现前必须对齐）

1) **规则不从中文文案解析**：文案只用于展示；触发条件与效果必须结构化表达。  
2) **白名单优先**：未知 hook / 未知 effect type 一律拒绝（避免“数据变代码”导致不可控与不可回放）。  
3) **可回放**：随机结果（抽卡/抽人/掷骰）要么：
   - 由权威随机写入 action log（推荐，见 `docs/course-cn-v2/multiplayer.md`），要么
   - 在单机/朋友局用确定性 RNG（seed/state）并把“抽到哪个 id”写入日志。
4) **稳定 id + 版本**：
   - 职业/事件卡 `id` 必须稳定（不可复用/不可改含义）。
   - 数据改动通过 `dataVersion`（或 hash）区分，便于回放定位。
5) **软隐藏 vs 硬隐藏**：
   - 软隐藏：只是 UI 不展示（课堂诚信可接受）。
   - 硬隐藏：客户端永远拿不到数据（需要服务端权威视图/状态；本文件不阻碍该升级）。
6) **金额与取整**：所有金额以“元”为单位存整数；若表达式/倍率计算产生小数，按“四舍五入（0.5 绝对值向上）”取整，避免回放分歧。
7) **可选模块开关**：
   - 本文件的白名单同时覆盖“核心规则 + 可选模块”。
   - 引擎需要根据房间配置的 `enabledModules` 决定某条 hook/effect 是否允许；模块未启用时，相关 hook/effect 必须拒绝（避免不同客户端出现“有人支持有人不支持”）。

---

## 1. 术语

- Hook：引擎在某个“决策/结算点”暴露的可配置入口，职业/状态可通过 modifier 改写结果。  
- Modifier：对某个 hook 的修正规则（带条件）。  
- Effect：事件卡/动作导致的原子状态变化（数据驱动，可回放）。  
- Trigger：事件卡的触发条件（何时、对谁、抽取权重/次数）。

### 1.1 公开履约记录（Track Record）（建议）

课程版 v2 推荐**不引入数值信誉**，合作信任由玩家自行判断。  
为支持判断与课堂复盘，建议提供“公开履约记录摘要”（但它**不参与结算，也不应作为系统强制门槛**）。

建议口径：
- 履约记录从 action log 派生（聚合统计），不作为独立可编辑状态存储
- 可统计项示例：
  - 合作项目：发起次数、成功完成次数、违约次数、金额汇总
  - 借贷：借入/借出次数、逾期次数、已还/未还金额
  - 诉讼：被起诉次数、是否被执行（`Defaulter` 标签）
  - （可选）严重程度分层：区分“项目爆雷/无法支付”（经营失败也可能发生）与“起诉/执行完成”（更强的法律后果记录）
  - （可选）救济与连带：被救济次数/金额、是否触发过“破产连带”（用于复盘，不作为门槛）

建议增加“信息摩擦”（更贴近现实，也更有博弈空间）：
- **滞后性**：履约记录摘要建议只基于“回合末快照”生成，并携带 `lastUpdatedTurn`；当回合内的行为默认到下一回合才体现在摘要中。  
- **查询成本**（可选模块：`dueDiligenceQuery`）：除基础摘要外，若要查看更详细的条目明细，建议设计为一个需要消耗行动点与现金的查询 action（例如 `DUE_DILIGENCE_QUERY`），由引擎扣费（`cash.delta`）并用 `info.reveal` 私发结果。  
  - 费用建议（示例）：`ddCost = max(500, round(baseExpensesMonthly * 0.1))`  
- **不作为门槛**：查询动作只提供信息，不应在规则层面自动禁止合作/借贷（避免回到“数值信誉”的强门槛模式）。
- **污染口径（建议明确）**：公开履约记录只应基于“系统可验证的事实事件”生成（如：项目按约完成/违约、项目爆雷/无法支付、借贷到期未还、起诉/执行完成等）；不应直接包含黑盒字段或仅凭聊天指控的内容。  

---

## 2. Hooks 白名单（职业被动能力的唯一入口）

### 2.1 Hook 计算模型（建议）

- 每个 hook 都有一个“基础值”（base）。
- 按 `modifiers[]` 的顺序依次应用；同一 hook 上允许多条 modifier 叠加。
- modifier 支持最小集合操作符（建议只做 3 个，避免复杂度爆炸）：
  - `set`：覆盖当前值
  - `mul`：乘法（数值型）
  - `add`：加法（数值型）

> 注意：为保证“加职业不改代码”，引擎必须只识别下述 hookId 集合；未来扩展 hook 视为规则级改动（见 `docs/course-cn-v2/rule-change-process.md`）。

### 2.2 HookId 列表（v0.1 核心最小集）

#### A. 就业/裁员类事件（可作为 Life/Macro 的一类）

- `employment.layoff.immune`（boolean，默认 false）
  - 含义：若为 true，则“裁员”事件对该玩家不生效（直接跳过/转为无事发生）
- `employment.layoff.probabilityMultiplier`（number，默认 1）
  - 含义：当事件系统在计算“裁员”触发概率/权重时乘以该倍率
  - 典型配置：大厂程序员在 `turn >= 8` 时乘以更大倍率（由 modifier 的条件表达）
- `employment.layoff.severance.monthlySalaryMultiplier`（number，默认 0）
  - 含义：裁员结算时，额外补偿金 = `salaryMonthly * multiplier`（0 表示无补偿）
  - 典型配置：大厂程序员为 4

#### B. 罚款/处罚类事件（统一口径，便于扩展）

- `penalty.fine.multiplier`（number，默认 1）
  - 含义：对“罚款类 effect”（如 `cash.delta` 且 `subtype="fine"`）应用倍率
  - 用例：个体户/微商翻倍

#### C. 项目/合作动作成本

- `project.start.feeMultiplier`（number，默认 1）
  - 含义：发起项目的基础手续费倍率（基础手续费由规则/项目卡定义）
  - 用例：个体户/微商可设为 0（等价免手续费）

#### D. 健康对收入的影响（“手停口停”）

- `income.salaryMultiplier`（number，默认 1）
  - 含义：工资/工作收入的倍率修正（可用条件限制只在特定健康状态生效）
  - 用例：外卖/网约车当 `health < healthMax` 时 `set 0`

---

## 3. Effect Types 白名单（事件卡/动作结算的原子变化）

> v0.1 目标：让中国化职业/事件卡能覆盖“现金、支出、健康、标签、信息公开/私聊”的主要教学点；同时为课程版常开的“黑盒项目/洗钱/审计/诉讼”预留可落地的状态与动作口径。

### 3.1 统一约束

- 每个 effect 必须是确定性的；需要随机时，把随机结果显式写进 action/log。
- effect 只描述“状态怎么变”，不携带 UI 动画/音效等表现信息。
- effect 必须能被记录到日志（便于回放与复盘）。
- 所有金额以“元”为单位最终落地为整数；若 AmountExpr 计算产生小数，按“四舍五入（0.5 绝对值向上）”取整。
- 带 `durationTurns` 的 effect：建议从“当前回合”开始生效，持续 `durationTurns` 个回合；省略 `durationTurns` 视为永久效果（需在日志中可复盘）。  
  - 口径建议（与规则草案对齐）：`durationTurns=1` 表示会影响“本回合的回合末结算”一次；每经历一次回合末结算，剩余回合数 `-1`，直至归零失效。

### 3.2 EffectType 列表（v0.1 建议最小集）

#### A. 现金与资金流

- `cash.delta`
  - 作用：给某个玩家（或全体）在指定钱包里加/减钱
  - 字段建议：
    - `target: "player" | "all"`
    - `playerId?: string`（target=player 时必填）
    - `wallet: "visible" | "hidden"`
      - 口径：课程版 v2 常开 `blackBoxProjects` 时会同时使用 `visible/hidden`；若关闭 `blackBoxProjects`，则只允许 `visible`（等价于规则文档里的 `cash`），并要求 `hidden=0`。
      - 实现提示：未启用 `blackBoxProjects` 时，引擎可以只存一个 `cash` 字段，并把 `wallet="visible"` 映射到 `cash`；任何 `wallet="hidden"` 相关的动作/效果都必须拒绝（避免不同客户端实现差异导致回放分歧）。
    - `amount: AmountExpr`
    - `subtype?: "salary" | "expense" | "fine" | "medical" | "project" | "contagion" | "other"`（便于统计与职业 hook 处理）
- `cash.transfer`
  - 作用：玩家间转账（可用于借贷/赔付/分红）
  - 说明：该 effect 属于核心能力，始终保留；借贷模块只是“在转账之上新增合同与应还/实还记录”，不会取代无条件汇款/赠与。
  - 字段建议：`fromPlayerId`, `toPlayerId`, `wallet`, `amount: AmountExpr`
- `cash.convert`
  - 作用：钱包转换（典型：洗钱 visible -> hidden）
  - 说明：仅当启用 `blackBoxProjects` 模块时需要；未启用时该 effect 应被拒绝或忽略
  - 字段建议：
    - `fromWallet`, `toWallet`
    - `input: AmountExpr`
    - `rate: number`（例如 0.7；输出 = input * rate）
    - `subtype?: "launder"`
- `cash.freezeWallet`
  - 作用：冻结某钱包 N 回合不可用（课堂局可先做“软冻结”：UI 禁用相关动作）
  - 说明：仅当启用 `blackBoxProjects` 模块时需要；未启用时该 effect 应被拒绝或忽略
  - 字段建议：`wallet`, `turns: number`

#### B. 健康与标签

- `health.delta`
  - 字段建议：`target`, `amount: number`（可正可负）, `clampMin?: number`, `clampMax?: number`
- `tag.add` / `tag.remove`
  - 字段建议：`target`, `tag: PlayerTag`

#### C. 收入/支出结构调整（用于宏观/政策牌）

- `economy.expensesMultiplier`
  - 作用：对基础支出做倍率（如通胀 +20%）
  - 字段建议：`target: "player" | "all"`, `multiplier: number`, `durationTurns?: number`
- `economy.expensesDelta`
  - 作用：对基础支出做固定增量（更适合“房租上涨 +500/月”）
  - 字段建议：`target`, `deltaMonthly: number`, `durationTurns?: number`
- `economy.salaryMultiplier`
  - 作用：对工资做倍率（如行业景气）
  - 字段建议：`target`, `multiplier: number`, `durationTurns?: number`

#### D. 信息披露（课堂诚信/朋友局先软隐藏）

- `info.reveal`
  - 作用：给某玩家发送一条“私密信息”（例如审计结果）
  - 字段建议：`toPlayerId`, `messageKey`, `payload?`, `visibility: "private"`
- `info.broadcast`
  - 作用：向全体广播一条信息（宏观播报/免费审计公示）
  - 字段建议：`messageKey`, `payload?`, `visibility: "public"`

#### E. 核心字段调整（v0.1 核心动作/机会牌最小需要）

> 说明：课程版 v0.1 的核心状态包含 `cash/salaryMonthly/passiveIncomeMonthly/baseExpensesMonthly/debtPaymentMonthly/health/healthMax/careerTier/tags/assetsByCategory`（见 `docs/course-cn-v2/game-rules-spec.md` 第 3 章）。  
> 这些字段的变更也应可通过白名单 effect 表达，避免“卡牌/职业特殊分支”硬编码进引擎。

- `income.salaryDeltaMonthly`
  - 作用：调整工资基数 `salaryMonthly`（可用于升职/降薪、一次性政策调整等）
  - 字段建议：`target: "player" | "all"`, `deltaMonthly: number`, `durationTurns?: number`, `playerId?: string`
- `income.passiveDeltaMonthly`
  - 作用：调整被动收入 `passiveIncomeMonthly`（典型：买入机会卡后增加/减少）
  - 字段建议：`target: "player" | "all"`, `deltaMonthly: number`, `durationTurns?: number`, `playerId?: string`
- `debt.paymentDeltaMonthly`
  - 作用：调整负债月供 `debtPaymentMonthly`（典型：再融资/还款降低月供、逾期导致月供上升）
  - 字段建议：`target: "player" | "all"`, `deltaMonthly: number`, `durationTurns?: number`, `playerId?: string`
- `career.tierDelta`
  - 作用：调整职业等级 `careerTier`（用于“进修/升职”门槛）
  - 字段建议：`playerId: string`, `delta: number`, `clampMin?: number`
- `asset.categoryDelta`
  - 作用：调整资产类别计数（v0.1 仅做计数，不要求估值/买卖）
  - 字段建议：`playerId: string`, `category: AssetCategory`, `delta: number`, `clampMin?: number`

---

## 4. Trigger 与表达式（建议最小 DSL）

> 目标：够用即可；不要引入可执行脚本/字符串表达式（难审计、难回放、难迁移到 Rust）。

### 4.1 Condition（用于 trigger 与 modifier.when）

建议只支持少量条件类型，后续按需扩展：

```ts
type Condition =
  | { kind: "turnGte"; value: number }
  | { kind: "turnLte"; value: number }
  | { kind: "careerTierGte"; value: number }
  | { kind: "careerTierLt"; value: number }
  | { kind: "hasTag"; tag: PlayerTag }
  | { kind: "not"; condition: Condition }
  | { kind: "and"; conditions: Condition[] }
  | { kind: "or"; conditions: Condition[] }
  | { kind: "healthLt"; value: number }
  | { kind: "cashGte"; amount: AmountExpr }
  | { kind: "cashLt"; amount: AmountExpr }
  | { kind: "hasAssetCategoryAtLeast"; category: AssetCategory; count: number };
```

说明（口径对齐 `docs/course-cn-v2/game-rules-spec.md`）：
- `turn` 口径：`turnGte/turnLte` 的 `value` 建议按“回合编号从 1 开始”理解；若课堂采用月度制，则回合上限相应变为 12（由房间规则配置决定）。  
- `cash*` 条件里的 `cash` 指“可用现金”，等价于核心规则里的 `cash`（启用黑盒模块时等价于 `visibleCash + hiddenCash`）。  
- “应急金 N 个月”建议用 `cashGte` + `{ kind: "baseExpensesMonthlyMul", multiplier: N }` 表达，避免引入新的派生字段。  

### 4.2 AmountExpr（金额表达式）

建议金额只允许“固定值 + 少量引用型表达式”，避免复杂公式：

```ts
type AmountExpr =
  | { kind: "fixed"; value: number }
  | { kind: "salaryMonthlyMul"; multiplier: number }
  | { kind: "visibleCashMul"; multiplier: number }
  | { kind: "baseExpensesMonthlyMul"; multiplier: number };
```

---

## 5. 示例数据结构（TypeScript 伪类型 + JSON 示例）

> 说明：示例仅用于说明 schema 形态；字段命名与最终实现可调整，但请保持“白名单 + 结构化 + 可回放”的原则。

### 5.1 职业卡（OccupationDefinition）

```ts
type PlayerTag = "Defaulter" | "Hospitalized" | "HiddenCashFrozen" | "HighInterestDebt";
type AssetCategory = "realEstate" | "stock" | "equity" | "other";

type HookOp = "set" | "mul" | "add";
type HookId =
  | "employment.layoff.immune"
  | "employment.layoff.probabilityMultiplier"
  | "employment.layoff.severance.monthlySalaryMultiplier"
  | "penalty.fine.multiplier"
  | "project.start.feeMultiplier"
  | "income.salaryMultiplier";

type HookModifier = {
  hookId: HookId;
  op: HookOp;
  value: number | boolean;
  when?: Condition;
};

type OccupationDefinition = {
  id: string;                // 稳定 id（不可复用/不可改含义）
  title: { zh: string };
  profile: {
    salaryMonthly: number;
    baseExpensesMonthly: number;
    startingCash: number;
    debtPaymentMonthly?: number;
    careerTier?: number;
    healthMax: number;
  };
  modifiers: HookModifier[];
};
```

示例（四个职业被动能力都不需要新增引擎分支）：

```json
[
  {
    "id": "cn_gov_soe",
    "title": { "zh": "公务员 / 国企（铁饭碗）" },
    "profile": { "salaryMonthly": 12000, "baseExpensesMonthly": 6500, "startingCash": 30000, "healthMax": 2 },
    "modifiers": [
      { "hookId": "employment.layoff.immune", "op": "set", "value": true }
    ]
  },
  {
    "id": "cn_bigtech_dev",
    "title": { "zh": "大厂程序员（35 岁红线）" },
    "profile": { "salaryMonthly": 30000, "baseExpensesMonthly": 18000, "startingCash": 60000, "healthMax": 2 },
    "modifiers": [
      {
        "hookId": "employment.layoff.probabilityMultiplier",
        "op": "mul",
        "value": 3,
        "when": { "kind": "turnGte", "value": 8 }
      },
      { "hookId": "employment.layoff.severance.monthlySalaryMultiplier", "op": "set", "value": 4 }
    ]
  },
  {
    "id": "cn_micro_merchant",
    "title": { "zh": "个体户 / 微商（现金流生意）" },
    "profile": { "salaryMonthly": 16000, "baseExpensesMonthly": 9000, "startingCash": 40000, "healthMax": 2 },
    "modifiers": [
      { "hookId": "project.start.feeMultiplier", "op": "set", "value": 0 },
      { "hookId": "penalty.fine.multiplier", "op": "mul", "value": 2 }
    ]
  },
  {
    "id": "cn_gig_driver",
    "title": { "zh": "外卖 / 网约车（手停口停）" },
    "profile": { "salaryMonthly": 14000, "baseExpensesMonthly": 7000, "startingCash": 20000, "healthMax": 2 },
    "modifiers": [
      {
        "hookId": "income.salaryMultiplier",
        "op": "set",
        "value": 0,
        "when": {
          "kind": "or",
          "conditions": [
            { "kind": "healthLt", "value": 2 },
            { "kind": "hasTag", "tag": "Hospitalized" }
          ]
        }
      }
    ]
  }
]
```

### 5.2 事件卡（EventDefinition）

```ts
type Effect =
  | { type: "cash.delta"; target: "player"; playerId: string; wallet: "visible" | "hidden"; amount: AmountExpr; subtype?: string }
  | { type: "cash.delta"; target: "all"; wallet: "visible" | "hidden"; amount: AmountExpr; subtype?: string }
  | { type: "cash.transfer"; fromPlayerId: string; toPlayerId: string; wallet: "visible" | "hidden"; amount: AmountExpr }
  | { type: "cash.convert"; fromWallet: "visible" | "hidden"; toWallet: "visible" | "hidden"; input: AmountExpr; rate: number; subtype?: string }
  | { type: "cash.freezeWallet"; wallet: "visible" | "hidden"; turns: number }
  | { type: "health.delta"; target: "player"; playerId: string; amount: number; clampMin?: number; clampMax?: number }
  | { type: "tag.add"; target: "player"; playerId: string; tag: PlayerTag }
  | { type: "tag.remove"; target: "player"; playerId: string; tag: PlayerTag }
  | { type: "economy.expensesMultiplier"; target: "player" | "all"; multiplier: number; durationTurns?: number }
  | { type: "economy.expensesDelta"; target: "player" | "all"; deltaMonthly: number; durationTurns?: number }
  | { type: "economy.salaryMultiplier"; target: "player" | "all"; multiplier: number; durationTurns?: number }
  | { type: "income.salaryDeltaMonthly"; target: "player" | "all"; deltaMonthly: number; durationTurns?: number; playerId?: string }
  | { type: "income.passiveDeltaMonthly"; target: "player" | "all"; deltaMonthly: number; durationTurns?: number; playerId?: string }
  | { type: "debt.paymentDeltaMonthly"; target: "player" | "all"; deltaMonthly: number; durationTurns?: number; playerId?: string }
  | { type: "career.tierDelta"; playerId: string; delta: number; clampMin?: number }
  | { type: "asset.categoryDelta"; playerId: string; category: AssetCategory; delta: number; clampMin?: number }
  | { type: "info.reveal"; toPlayerId: string; messageKey: string; payload?: Record<string, unknown>; visibility: "private" }
  | { type: "info.broadcast"; messageKey: string; payload?: Record<string, unknown>; visibility: "public" };

type EventDefinition = {
  id: string;
  category: "macro" | "life" | "special";
  title: { zh: string };
  trigger: {
    when: Condition;
    once?: boolean;
    weight?: number;         // 进入抽取池的权重（随机权威/确定性 RNG 都能用）
  };
  effects: Effect[];
};
```

示例（宏观牌 + 特殊事件）：

```json
[
  {
    "id": "macro_rate_cut",
    "category": "macro",
    "title": { "zh": "降息" },
    "trigger": { "when": { "kind": "and", "conditions": [] }, "weight": 1 },
    "effects": [
      { "type": "info.broadcast", "messageKey": "macro.rateCut", "payload": { "note": "利率下行" }, "visibility": "public" }
    ]
  },
  {
    "id": "macro_crackdown_hidden_cash",
    "category": "macro",
    "title": { "zh": "严查" },
    "trigger": { "when": { "kind": "and", "conditions": [] }, "weight": 1 },
    "effects": [
      { "type": "cash.freezeWallet", "wallet": "hidden", "turns": 1 },
      { "type": "info.broadcast", "messageKey": "macro.hiddenCashFrozen", "payload": { "turns": 1 }, "visibility": "public" }
    ]
  },
  {
    "id": "macro_inflation",
    "category": "macro",
    "title": { "zh": "通胀" },
    "trigger": { "when": { "kind": "and", "conditions": [] }, "weight": 1 },
    "effects": [
      { "type": "economy.expensesMultiplier", "target": "all", "multiplier": 1.2, "durationTurns": 1 },
      { "type": "info.broadcast", "messageKey": "macro.inflation", "payload": { "multiplier": 1.2 }, "visibility": "public" }
    ]
  },
  {
    "id": "special_mother_in_law_ultimatum",
    "category": "special",
    "title": { "zh": "丈母娘的最后通牒" },
    "trigger": {
      "when": { "kind": "turnGte", "value": 6 },
      "once": true,
      "weight": 1
    },
    "effects": [
      {
        "type": "info.broadcast",
        "messageKey": "special.milUltimatum",
        "payload": { "deadlineTurns": 2, "penalty": "每回合扣 20% 现有现金（示意）" },
        "visibility": "public"
      }
    ]
  }
]
```

> 注：上面两个“示意事件”只展示结构；像“必须 2 回合内买房，否则扣钱”这种多回合持续规则，更推荐落地为“创建一个 obligation/状态标签 + 每回合 closing 时结算”的机制（这属于新增 effect type 的范畴，需走规则改动流程）。

---

## 6. 扩展约定（保持可控）

1) 新增职业：只允许新增 `OccupationDefinition` 数据；不得新增引擎分支。若现有 hooks 不够用，先提案新增 hook 并更新本文件。  
2) 新增事件卡：只允许使用本文件白名单 effect types；未知 effect 一律拒绝。  
3) 需要更复杂的跨回合规则（倒计时、分期付款、违约/诉讼流程等）时：
   - 优先把它抽象成“少量新 effect type + 明确算法口径”
   - 避免引入通用脚本引擎/字符串表达式（长期维护与 Rust 迁移会非常痛苦）

---

## 7. 聊天与社交事件（不属于 effect，但建议写入联机日志）

> 聊天不应改变数值结算，因此不建议把它建模为 effect。  
> 但为了课堂复盘，“聊天事件建议落库并可回放”（见 `docs/course-cn-v2/multiplayer.md`）。

建议最小事件（作为 `ActionEnvelope.type`）：
- `CHAT_MESSAGE { channel, text }`
- `SHOW_OFF { summary }`

建议约束：
- 服务端限流：例如 `CHAT_MESSAGE` 每连接 `1 秒 1 条`
- 限制 payload 体积与单条文本长度（避免刷屏与卡顿）

---

## 8. 常开模块提案：黑盒项目 / 洗钱 / 审计与诉讼（影响核心状态）

> 该模块用于引入“信息不对称 + 追偿成本 + 合规/背叛”的高张力博弈（见 `docs/course-cn-v2/game-rules-spec.md` 的 9.7）。  
> 由于已被定为 course-cn-v2 的常开玩法，它会引入新的实体（Project/Lawsuit）与更多状态字段；若仍保留开关（`enabledModules.blackBoxProjects`），则关闭时需保证相关字段为稳定默认值（例如 `hiddenCash=0`、无项目对象等），避免回放分歧。

### 8.1 需要新增的状态（示意）

- 玩家资金拆分：`visibleCash` / `hiddenCash`（与 `cash.convert`、`cash.freezeWallet` 配合）
- 项目对象（Project）：
  - `publicLiability`（公开）、`realBalance`（软隐藏/硬隐藏）、`status`、`durationTurns`、`promisedRate`、`investors[]` 等
- 起诉/执行对象（可选）：为了做“强制执行资产”，需要引入可执行资产清单与估值/清算口径

### 8.2 建模建议：优先用“动作 + 状态机”，而不是无限扩充 effect

如果要把该模块也做成数据驱动，建议新增一组明确的 action/effect 白名单（示意，非核心必需）：

- `project.create`
- `project.invest`
- `project.embezzle`
- `project.markCollapsed`
- `lawsuit.file`
- `lawsuit.resolve`

注意：
- 这些类型一旦引入，通常属于 **B/C 级改动**（影响 state schema 与 action schema），需要 bump 版本并明确回放兼容策略（见 `docs/course-cn-v2/rule-change-process.md`）。
