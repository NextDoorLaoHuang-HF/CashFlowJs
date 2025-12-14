# CashFlowJs 重构版统一规则规范（开发对齐稿）

> 适用范围：本仓库 `app/` / `lib/state/gameStore.ts` 所实现的“重构版”玩法。  
> 目标：给开发提供**唯一口径**（算法级）规则说明，明确哪些沿用旧版（`legacy/`），哪些需要在重构版自行实现；并把所有关键歧义一次性定案。  
> 旧版审计与差异参考：`docs/legacy-logic-audit.md`、`docs/legacy-rules-baseline.md`。  
> 规则版本：`RuleSet v1.0`（本文件即为 v1.0 的权威来源）。

---

## 0. 总体原则（v1.0 定案）

1) **不复刻旧版 bug**：`legacy/` 只作为“数据/行为参考”，不再当作权威实现。  
2) **结算顺序必须可复盘**：同一回合内的现金/现金流变化必须按事件顺序写入日志，且任何 UI 展示都应可由日志重算。  
3) **规则优先级**：本规范 > `docs/legacy-logic-audit.md` > `docs/legacy-rules-baseline.md` > `legacy/` 源码注释。  
4) **最小可用实现（MVP）允许简化，但必须在本规范显式写出**：未实现项必须列入“实现清单（TODO）”，避免开发自行脑补。

---

## 1. 决策清单（对 `docs/legacy-logic-audit.md` 的逐条回答）

### 1.1 是否复刻 Rat Race `-23` 绕圈 bug？
- **不复刻**。  
- 规则：内圈棋盘长度为 `24`（索引 `0..23`），位置更新使用 `position = (position + steps) % 24`。

### 1.2 PAYCHECK 发放时机：落点事件前还是后？
- **移动过程中按“经过顺序”即时结算，且在落点事件之前结算**。  
- 规则：先计算本次移动经过的格子序列（包含落点），再按其中 PAYCHECK 次数发放 Payday，之后才处理落点格事件/抽牌。

### 1.3 一次移动跨越多个 PAYCHECK 是否允许多次领取？
- **允许**。  
- 规则：本次移动经过了 `k` 个 PAYCHECK，则一次性发放 `k * payday`（也可逐个发放，但日志必须可重现 `k`）。

### 1.4 牌库抽取：有放回随机 vs 无放回弃牌堆？
- **无放回**。  
- 规则：每个牌堆都有 `drawPile` 与 `discardPile`；抽牌从 `drawPile` 顶部弹出；牌结算结束进入 `discardPile`；当 `drawPile` 为空时，将 `discardPile` 洗牌后作为新的 `drawPile`。

### 1.5 Market/Stock “Everyone may sell” 是否允许所有玩家响应？
- **允许（v1.0 定案）**。  
- 规则：当卡牌文本/字段含义为“Everyone may sell at this price”，应开放一个“响应窗口”，让所有玩家按相同价格卖出符合条件的资产。  
- 说明：当前代码若尚未实现该交互，应视为功能缺口，按第 8 章 TODO 落地，禁止在没有声明的情况下偷偷降级为“仅当前玩家可卖”。

### 1.6 税费/孩子/保险采用固定职业卡还是动态百分比？
- **税费：固定职业卡数值**（来自 `Scenario.taxes`），不做动态税率。  
- **孩子：固定“每个孩子成本”**（v1.0 采用公式 `round(salary * 0.056)`，最小 `100`），新增孩子只增加一次，不回溯重算历史孩子成本。  
- **保险：v1.0 不纳入核心规则**（作为可选扩展，见 TODO）。

### 1.7 进入 Fast Track 是否清空内圈资产？起始资金与胜利条件？
- **采用旧版的“硬切换”口径（但修 bug）**：进入外圈时清空内圈资产/负债表，仅保留并转换现金与现金流目标。  
- 转换规则见第 6 章。  

### 1.8 外圈默认骰子数量与慈善加成？
- **默认 1 骰**；慈善加成为 **+1 骰（变 2 骰）持续 3 次掷骰**；骰子分布为“求和分布”，禁止 `random * 2` 这类实现。  
- 允许提供“快速模式：默认 2 骰”的设置；该模式下慈善仍为 **+1 骰（变 3 骰）持续 3 次掷骰**（非官方变体，必须在 UI 明示）。

### 1.9 破产/出局机制（是否 Game Over、可卖哪些资产、折价口径）？
- **Rat Race：不设置强制 Game Over**（银行贷款可覆盖强制支出，避免软锁）。  
- **Fast Track：无银行贷款**。若遇到强制支付且现金不足：  
  1) 允许卖出外圈资产筹资（若实现了外圈资产）  
  2) 若仍不足，则该玩家**破产出局**（多人）/ **游戏失败**（单人）。

---

## 2. 数据模型口径（开发必须遵守）

### 2.1 核心字段

- `cash`：现金（可支配资金）。  
- `passiveIncome`：被动收入（资产现金流之和 + 其它被动项）。  
- `totalIncome`：总收入。v1.0 = `salary + passiveIncome`（外圈没有 salary 时 salary=0）。  
- `totalExpenses`：总支出（固定支出 + 孩子支出 + 贷款月供等）。  
- `payday`：每次经过 PAYCHECK 时发放的“本回合净现金流”。v1.0 = `totalIncome - totalExpenses`。  
- `position`：棋盘位置索引（内圈 0..23，外圈 0..39）。  

### 2.2 资产与负债

- 资产（Asset）必须包含：`id/name/category/cashflow/cost/metadata`  
- 负债（Liability）必须包含：`id/name/payment/balance/category/metadata`

> 备注：旧版把资产拆成多个数组（stock/realEstate/business/coin），重构版允许合并为统一数组，但 **category 与 metadata 必须足够表达旧版字段**（如 `mortgage/units/landType`）。

---

## 3. 游戏阶段与回合结构

### 3.1 阶段

1) Setup（开局）：配置玩家、职业（Scenario）、梦想（Dream）、规则开关（Settings），初始化牌库。  
2) Rat Race（内圈）：按 24 格循环移动并处理事件。  
3) Fast Track（外圈）：满足进入条件后可切换到外圈 40 格，并以达成目标为胜利。  
4) Finished：有人胜利或全部出局。

### 3.2 回合（Turn）标准流程（内/外圈共用骨架）

1) **回合开始检查**
   - 若玩家 `skipTurns > 0`：`skipTurns--`，记录日志，直接结束回合。  
2) **掷骰**
   - 默认 1 骰；若 `charityTurns > 0` 则 2 骰；每次掷骰后若 `charityTurns > 0` 则 `charityTurns--`。  
3) **移动**
   - 位置更新使用模运算。  
4) **经过格结算（只结算 PAYCHECK / CashFlow Day）**
   - 统计本次移动经过的 PAYCHECK 次数并发放 Payday（可多次）。  
5) **落点格事件**
   - 根据落点类型触发：抽牌/强制支出/慈善提示/孩子/裁员/外圈事件等。  
6) **玩家操作窗口（如需要）**
   - Opportunity：选择 Small/Big 并决定买或不买  
   - Offer/Stock：进入“响应窗口”（若实现全员响应）  
   - 回合结束：可选择还款/借款（仅内圈允许银行借款）  
7) **回合结束**
   - 轮到下一位玩家；若满足进入外圈条件，允许点击 Enter Fast Track。

---

## 4. 内圈（Rat Race）规则（24 格）

### 4.1 棋盘格类型与行为

棋盘布局沿用旧版（参考 `legacy/js/board.js`，数据源在 `lib/data/board.ts`）。

#### 4.1.1 OPPORTUNITY（机会）
- 行为：当前玩家在该格可选择抽 **Small Deal** 或 **Big Deal**（受设置开关影响）。  
- 抽牌：从对应牌堆抽 1 张，进入“机会卡处理”（见 5.1）。  

#### 4.1.2 LIABILITY（支出/意外）
- 行为：**抽 1 张 Doodad** 并处理（见 5.2）。  
- v1.0 定案：LIABILITY 不额外收取“固定罚金”（旧版也没有）。

#### 4.1.3 OFFER（市场）
- 行为：抽 1 张 Offer 并处理（见 5.3）。  

#### 4.1.4 PAYCHECK（领工资/现金流）
- 行为：本格本身不产生额外 UI；PAYCHECK 的发放发生在“移动经过结算”。  
- 本次移动落点为 PAYCHECK 也算“经过”，因此会领到 1 次 payday。  

#### 4.1.5 CHARITY（慈善）
- 行为：弹出慈善提示。当前玩家可选择：
  - Donate：支付 `donation = round(totalIncome * 0.1)`（最小 100），成功则 `charityTurns = 3`  
  - Skip：不支付、不获得加成  
- 资金不足：Donate 失败直接视为 Skip（不提供银行贷款）。

#### 4.1.6 CHILD（孩子）
- 行为：强制增加 1 个孩子（上限 3）。  
- 每个孩子成本（v1.0）：`childCost = max(round(salary * 0.056), 100)`  
- 结算：`children += 1`，`childExpense += childCost`，`totalExpenses += childCost`，并重算 `payday`。  

#### 4.1.7 DOWNSIZE（裁员）
- 行为：强制支付 `downsizePenalty = totalExpenses`（允许银行贷款覆盖）。  
- 结算成功后：`skipTurns = 3`（接下来 3 个轮到你的回合会被跳过）。  
- v1.0 不实现保险豁免（保险作为扩展项）。

---

## 5. 卡牌规则（内圈 4 类牌堆）

### 5.1 Small Deal / Big Deal（机会卡）

#### 5.1.1 抽牌与权限
- **只有当前玩家可以买入**（Only you may buy）。  
- 若卡面/规则写明“Everyone may sell at this price”，则卖出进入“全员响应窗口”（见 5.4）。

#### 5.1.2 资产类型与通用买入规则

> 旧版可参考：`legacy/js/index.js` 的 `buyStock/buyRealEstate/buyBusiness/buyCoin`。重构版必须修复旧 bug，并统一为数据驱动实现。

- **Real Estate / Limited Partnership**
  - 成本：使用 `downPayment` 作为买入现金支出；`mortgage` 作为负债余额信息（不单独计入支出，支出体现在职业卡的 mortgagePayment 或卡牌自带 payment）。  
  - 收入：`cashFlow` 计入 `passiveIncome`。  
  - 记账：资产需记录 `landType/units/mortgage` 等用于 Offer 结算。

- **Business / Company**
  - 买入：支付 `downPayment`；`cashFlow` 计入 `passiveIncome`。  
  - 注意：若未来实现“卖出公司”，需定义对应 Offer 或估值规则（v1.0 暂不强制）。

- **Stock / Mutual Fund / Preferred Stock / CD**
  - 买入：按 `shares * price` 支付现金；支持叠加同 `id/symbol+price` 的持仓数量。  
  - 收入：仅 Preferred Stock / CD 的 `dividend` 产生被动收入（`dividend * shares`）。普通股票/基金不产生被动收入。  
  - Split/Reverse Split：只改变股数，不改变现金；Reverse Split 必须保持整数股（向下取整或禁止奇数股，需在实现中定案；v1.0：**向下取整**）。

- **Coin（收藏品）**
  - 买入：支付 `cost`；数量累加。  
  - 不产生现金流；只能通过对应 Offer 卖出。

#### 5.1.3 资金不足与银行贷款
- v1.0：当玩家点击“Buy/Pay”且现金不足时，系统应提供银行融资：  
  - `need = cost - cash`  
  - `principal = ceil(need/1000)*1000`（最小 1000）  
  - 月供：`payment = round(principal * 0.1)`  
- **内圈允许**；**外圈禁止**。  
- v1.0 定案：**自动借款覆盖差额**（避免软锁），必须写日志并在 UI 显示新增负债。

#### 5.1.4 特殊机会牌：Property Damage（房屋损坏/维修）

> 旧版参考：`legacy/js/display.js` 的 Property Damage 展示逻辑（但旧版有 JS 判定 bug，禁止照抄写法）。  

- 触发：从 Small/Big Deal 抽到 `type="Property Damage"` 的牌。  
- 判定：仅当玩家“拥有符合条件的房产/出租类资产”才需要支付。  
  - `propertyType="rental"`：拥有任意出租类房产即触发（至少包含 `3Br/2Ba`、`2Br/1Ba`、`duplex`、`4-plex`、`8-plex`、`plex`、`apartment`，如未来新增租赁类房产也应纳入）。  
  - `propertyType="8-plex"`：仅拥有 `8-plex` 时触发。  
- 支付：触发则必须支付 `cost`；现金不足按 5.1.3 自动银行贷款补足（内圈）。  
- 不触发：直接无事发生（记录日志后弃牌）。  

### 5.2 Doodad（意外支出牌）

> 旧版可参考：`legacy/js/index.js#getDoodad`、`payDoodad`。  

- 抽牌：若卡牌要求孩子（`child: true`）且 `children==0`，则弃置并继续抽下一张（最多抽到牌库耗尽；耗尽则本次无事发生）。  
- 支付：点击 Pay 时扣 `cost`（或比例成本 `amount * cash`），现金不足按 5.1.3 走银行贷款（内圈）。  
- 若卡牌带 `loan/payment`：应新增一条负债（balance=loan，payment=payment），并使 `totalExpenses += payment`。

### 5.3 Offer（市场牌）

> 旧版可参考：`legacy/js/index.js#getOffer`、`getSettlement`、`sellAsset`。  

#### 5.3.1 Offer 的三类效果
1) **可选卖出（Sell Offer）**：例如房产/金币/部分资产的“按该价可卖”。  
2) **现金流增益（Improve）**：例如 business 现金流 +250。  
3) **强制事件（Forced）**：例如 limited partnership 强制卖出、止赎强制移除等。

#### 5.3.2 房产卖出结算（Settlement）
- v1.0 结算：`settlement = salePrice - mortgageBalance`（下限为 0）。  
- `salePrice` 来源：
  - 若为 `offerPerUnit` 且资产有 `units`：`salePrice = units * offerPerUnit`  
  - 否则：`salePrice = offer`

#### 5.3.3 “Everyone may sell” 的响应窗口（目标行为）
- 顺序：从当前玩家开始，按回合顺序依次询问所有玩家是否卖出（实现也可做“同时选择后统一结算”，但必须可复盘）。  
- 每位玩家可卖出 **任意数量**符合条件的资产条目。  
- 卖出后：从资产表移除，并扣减对应的 `passiveIncome`。

> v1.0 不允许在规则层面留下“简化分支”。若当前实现未支持选择/全员响应，应在第 8 章 TODO 中按规则补齐，并在 UI 明确标注“未实现/开发中”，禁止悄悄降级。

### 5.4 Stock/Mutual Fund “Everyone may sell” 的响应

- 同 5.3.3：当价格牌出现时，其他玩家可在同价卖出自己持仓。  
- 买入权仍只属于当前玩家（除非你选择实现变体模式）。

---

## 6. 外圈（Fast Track）规则（40 格）

### 6.1 进入条件（从内圈解锁）
- 当 `passiveIncome >= totalExpenses` 时，玩家解锁 Enter Fast Track（允许在自己的回合点击进入）。

### 6.2 进入外圈时的状态转换（v1.0）

> 旧版参考：`legacy/js/fasttrack.js#init`。重构版必须修复旧版“双算 payday / 共享对象”等 bug。

对进入者执行：

1) 标记：`track = "fastTrack"`  
2) 现金：`cash += payday * 100`  
3) 清空：`assets = []`、`liabilities = []`、`children = 0`、`childExpense = 0`  
4) 外圈收入与目标：
   - `passiveIncome = payday + 50_000`（即 CashFlow Day 起点）  
   - `totalExpenses = 0`  
   - `totalIncome = passiveIncome`  
   - `payday = totalIncome - totalExpenses = passiveIncome`  
   - `fastTrackTarget = passiveIncome + 50_000`（胜利门槛）
5) 起始位置：按玩家序号分配（旧版：1、7、14、21、27、34…），避免所有人叠在同一格。

### 6.3 外圈行动规则

- 掷骰：默认 1 骰；慈善时 2 骰；分布为求和。  
- 银行贷款：**禁止**。  
- CashFlow Day：外圈“经过 FAST_PAYDAY 格”时发放 `payday`（可能一次移动多次）。  

### 6.4 外圈格子类型（v1.0）

> 当前重构版数据使用 `lib/data/board.ts` 的 FAST_* 类型；若未来要移植旧版 fasttrack 详细格事件，可在 v1.x 扩展为数据驱动事件表。

- `FAST_PAYDAY`：经过时发放 `payday`。  
- `FAST_OPPORTUNITY`：自动提升被动收入：`passiveBoost = max(2000, round(payday * 0.5))`，并令 `passiveIncome += passiveBoost`。  
- `FAST_DONATION`：弹出慈善提示，金额：`donation = max(round(totalIncome * 0.2), 5000)`；Donate 成功则 `charityTurns=3`。  
- `FAST_PENALTY`：强制支出：`penalty = max(totalExpenses, 3000)`；无银行贷款；现金不足按 1.9 处理。  
- `FAST_DREAM`：若 `passiveIncome >= fastTrackTarget`，则立即胜利（进入 Finished），否则仅记录一次“Dream Shot”事件。

### 6.5 胜利条件（v1.0）
- 必须同时满足：
  1) `passiveIncome >= fastTrackTarget`  
  2) 玩家到达 `FAST_DREAM`（或实现为“到达 DREAM 格并完成支付/判定”）  
- 达成后进入 `Finished`。

---

## 7. 规则开关（Settings）口径

### 7.1 已纳入 v1.0 的开关
- 起始存款：`none/normal/salary/double-salary`  
- 启用牌堆：Small Deals / Big Deals / Preferred Stock  
- 官方骰子：默认 1 骰，慈善 +1 骰（持续 3 次）

### 7.2 v1.0 暂不纳入的旧版开关（统一移除，避免歧义）
- Mortgage Prepay、Paycheck Doodads、Instant Fast Track、One Cent Away、No Loans、Manual Dice、保险购买等。  
> 若要恢复，必须写入 v1.x 规则增补并补齐 UI/日志。

---

## 8. 需要自行实现/补齐的关键能力（TODO 清单）

> 这里列出的内容，是为了把“文档承诺的规则”落到代码与 UI 的具体工作项，避免开发各自实现。

1) **资产/负债报表 UI**：展示持仓、房产、企业、负债余额与月供；支持选择出售/还款。  
2) **Offer/Stock 的全员响应窗口**：按 5.3.3、5.4 实现多人卖出交互与结算顺序。  
3) **Offer 的“选择卖出哪一项资产”**：至少支持当前玩家选择卖出条目；避免“自动卖出全部”。  
4) **银行贷款还款**：允许按 1000 为步长还本金，并自动重算月供（或按 tranche 规则更新）。  
5) **Reverse Split 股数规则**：明确向下取整/必须偶数/禁止拆分小数股，并在 UI 校验。  
6) **Fast Track 事件表**：若要与旧版一致，应把 `legacy/js/fasttrack.js` 的格子与事件数据化，并修复旧 bug。  
7) **外圈现金不足处理**：强制费用无法支付时的资产清算/出局规则落地。  
8) **Dream perk（可选）**：`lib/data/scenarios.ts` 已有 `perk` 文案，但未落地；若要实现必须定义触发时机与数值效果。

---

## 9. 代码落点（重构版实现位置约定）

- 规则与状态机：`lib/state/gameStore.ts`（所有结算必须在这里，组件只负责触发 action 与展示）。  
- 数据（不可运行时突变）：`lib/data/board.ts`、`lib/data/cards.ts`、`lib/data/scenarios.ts`。  
- 旧版参考（只读）：`legacy/`（不要在重构代码里引入旧版 JS）。  
