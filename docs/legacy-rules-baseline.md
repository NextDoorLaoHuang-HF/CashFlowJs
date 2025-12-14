# 旧版规则基准（legacy）

> 本文为旧版静态实现（`legacy/`）的“代码实际行为”对齐稿，由原 `AGENTS.md` 中的长文迁移而来。  
> 重构版规则以 `docs/game-rules-spec.md` 为准；旧版缺陷与与桌游差异请看 `docs/legacy-logic-audit.md`。  

## 旧版（`legacy/`）游戏规则逻辑（极度详细 / 开发对齐版）

> 目的：为重构版开发提供“同一份旧版规则基准”，避免团队成员按不同理解实现导致规则冲突。  
> 基准来源（旧版静态实现）：  
> - 核心流程/财务：`legacy/js/index.js`  
> - UI 与表格交互（买卖/高亮/结算入口）：`legacy/js/display.js`  
> - 卡牌数据：`legacy/js/cards.js`  
> - Rat Race 棋盘：`legacy/js/board.js`  
> - Fast Track 棋盘与事件：`legacy/js/fasttrack.js`  
> - 开局选项：`legacy/js/options.js`  
>
> 重要约定：本文优先描述“旧版代码的实际行为”。如卡面文案/桌游直觉与代码不一致，本文会显式标注；重构时请团队先确定取舍并记录在 PR/Issue 中。

### 0. 总体阶段划分（旧版注释口径）
旧版代码将游戏分为 3 个阶段（但“梦境 Dream 的数值增益”并未真正落地实现）：
- **Phase 1：Dream Phase（选职业/选梦想）**：每位玩家选择一个职业（Occupation）与一个梦想（Dream）；梦想主要是叙事字段，后续仅在 Fast Track 的 Dream 事件中被读取展示。
- **Phase 2：Rat Race（内圈）**：围绕 24 格棋盘循环移动，处理 Opportunity / Doodad(Expense) / Offer(Market) / Charity / Child / Downsize / Paycheck。
- **Phase 3：Fast Track（外圈）**：当满足进入条件后切换到 40 格棋盘；规则与内圈不同（例如不提供“银行借款/还款”入口），以提升 CashFlow Day 为胜利目标。

### 1. 核心数据模型（Player 状态字段，旧版实现）

#### 1.1 职业表 `jobTitle` 数组索引含义（旧版约定）
旧版把职业数据存为长度 13 的数组（`APP.scenarioChoices[i]`），并在逻辑中按固定索引读写：
- `jobTitle[0]`：职业名称（字符串）
- `jobTitle[1]`：Salary（工资收入）
- `jobTitle[2]`：Starting Savings（起始存款/储蓄）
- `jobTitle[3]`：Taxes（税费，运行时会被 `getTaxes()` 动态覆盖）
- `jobTitle[4]`：Mortgage Payment（房贷月供）
- `jobTitle[5]`：Car Payment（车贷月供）
- `jobTitle[6]`：Credit Card Payment（信用卡月供）
- `jobTitle[7]`：Retail Payment（零售分期月供）
- `jobTitle[8]`：Other Expenses（其它固定支出）
- `jobTitle[9]`：Mortgage Principal（房贷本金/未还余额）
- `jobTitle[10]`：Car Loan Principal（车贷本金/未还余额）
- `jobTitle[11]`：Credit Debt Principal（信用卡欠款本金）
- `jobTitle[12]`：Retail Debt Principal（零售分期本金）

> 口径提示：旧版的收入/支出都按“每回合=一个月”的展示口径在滚动（例如 Salary、Cash Flow、Expenses 都是月度数值）。

#### 1.2 其他关键字段（旧版 `APP.scenario` 初始化）
- 位置与回合：
  - `position`：当前所在格（Rat Race：0~23；Fast Track：1~40，旧版绕圈以 40 为边界）
  - `fastTrack`：是否已进入 Fast Track
  - `fastTrackOption`：是否已解锁“可进入 Fast Track”（出现 ENTER FAST TRACK 按钮）
  - `turnCount`：全局回合计数（UI 展示用）
- 现金与结算：
  - `cash`：手头现金（旧版 UI 常称 Savings）
  - `totalIncome`：总收入（由 `getIncome()`计算并写回）
  - `totalExpenses`：总支出（由 `getExpenses()`计算并写回；Fast Track 中被强制为 0）
  - `payday`：Payday（由 `getPayday()`计算并写回；用于“过 PAYCHECK 领工资/现金流”）
  - `passiveIncome`：被动收入（Rat Race：=资产现金流 + 股息利息）
- 特殊计数器/状态：
  - `charityTurns`：慈善加成剩余回合数（>0 则允许掷 2 颗骰；每回合开始自动 `--`）
  - `downsizedTurns`：Downsize 影响剩余回合数（>0 则该玩家会被“跳过回合”，直到减到 0；单人模式有特殊处理）
  - `children`：孩子数量
  - `childExpense`：孩子支出合计（注意：旧版会随总收入变化而“重算全部孩子的单孩成本”）
  - `kidLimit`：是否开启 3 个孩子上限（`true`=上限 3；`false`=不限制）
  - `hasInsurance` / `insurance`：是否购买保险及其月费（保险费会随收入和孩子数动态变化）
- 借款/负债（除职业自带外）：
  - `loans`：银行借款本金（可多次借；还款按 1000 为步长）
  - `loanPayment`：银行借款月供（固定为 `loans * 0.1`）
  - `boatLoan` / `boatPayment`：购买“船”类 Doodad 后产生的额外贷款及月供
- 资产列表（数组）：
  - `stockAssets`：股票/基金/优先股/CD 持仓
  - `realEstateAssets`：房产/公寓/地块/“Limited Partnership”等（旧版把 LP 也当作一类可出售的“资产行”）
  - `businessAssets`：公司/自动化生意等
  - `coinAssets`：金币类（如 Krugerrands、1500's Spanish）
  - `fastTrackAssets`：Fast Track 资产（由 `FASTTRACK.opportunity()`直接塞入）

### 2. 开局与可选规则（`OPTIONS`）
旧版在“开始游戏”前提供一组选项，影响卡组内容与初始状态：

#### 2.1 资产卡组开关（取消勾选会直接从 `APP.cards` 删除对应卡牌）
- `Small Real Estate`：关闭会移除 `smallDeal.realEstateS1~S13` + `smallDeal.propertyDamage`，并移除部分 `offer`。
- `Big Real Estate`：关闭会移除 `bigDeal.realEstateB1~B33` + `bigDeal.propertyDamage1/2`，并移除大量 `offer`。
- `Stocks`：关闭会删除大量 `smallDeal.stock*` 与 `stockSplit/reverseSplit`。
- `Mutual Funds`：关闭会删除 `smallDeal.mutual01~05`。
- `Preferred Stocks`：关闭会删除 `smallDeal.preferredStock1/2`。
- `CDs`：关闭会删除 `smallDeal.cd1/2`。
- `Coins`：关闭会删除 `smallDeal.coin1/2` 以及金币相关 `offer`。
- `Limited Partnership`：关闭会删除 `bigDeal.limitedPartnershipB1~B4` 以及相关 `offer`。
- `Companies`：关闭会删除 `smallDeal.companyS1/S2`、部分 `bigDeal.automatedBusiness*` 以及相关 `offer`。

#### 2.2 起始存款（`start-savings-slide`）
旧版按滑块值给每位玩家设置初始 `cash`：
- `0`：None → `cash = 0`
- `1`：Normal → `cash = jobTitle[2]`（职业表中的 Starting Savings）
- `2`：Salary → `cash = jobTitle[1]`
- `3`：2x Salary → `cash = jobTitle[1] * 2`

#### 2.3 孩子上限（`oo-kids`）
- 勾选（旧版命名含糊）：`kidLimit = false` → **不限制**孩子数量
- 不勾选：`kidLimit = true` → **限制最多 3 个**（到 3 后再踩 CHILD 不再增加）

#### 2.4 其他选项
- `Mortgage Prepay`：允许房贷“部分提前还款”（不然只能一次性还清本金）
- `Paycheck Doodads`：踩到 PAYCHECK 格时会额外抽一张 Doodad（否则 PAYCHECK 直接结束回合）
- `Instant Fast Track`：开局就把 `fastTrackOption = true`（出现 ENTER FAST TRACK；同时隐藏 Rat Race 的 roll 按钮）
- `One Cent Away`：把起始 `cash` 直接设为 `999999`（明显是调试/速通选项）
- `No Loans`：开局把职业自带的各类负债本金与月供都置 0（`jobTitle[4~7]` 与 `jobTitle[9~12]` 清零）
- `Manual Dice`：用输入框手动填掷骰点数（替代随机）
- 保险（每玩家单独勾选）：勾选则 `hasInsurance = true`，并立即计算 `insurance` 月费

### 3. Rat Race（内圈）规则：棋盘、回合流程与结算

#### 3.1 棋盘格（`legacy/js/board.js`）
Rat Race 共 24 格（索引 0~23）：
| 格子索引 | 格子类型 | 旧版行为概览 |
|---:|---|---|
| 0,2,4,6,8,10,12,14,16,18,20,22 | OPPORTUNITY | 选择抽 Small Deal 或 Big Deal（随机出一张） |
| 1,9,17 | LIABILITY（Doodad） | 抽随机 Doodad；支付现金，不足可走贷款流程 |
| 3 | CHARITY | 可捐 10% 总收入，获得 3 回合“双骰” |
| 5,13,21 | PAYCHECK | 默认直接结束回合；若开启 Paycheck Doodads 则抽 Doodad |
| 7,15,23 | OFFER（Market） | 抽随机 Offer；可按 Offer 类型出售资产/触发全局事件 |
| 11 | CHILD | 直接增加孩子与孩子支出（不可拒绝） |
| 19 | DOWNSIZE | 无保险：支付“总支出”；有保险：免付现金；两者都会导致跳过回合 |

#### 3.2 回合开始：掷骰与移动（`APP.movePlayer(dieCount)`）
1) 掷骰：
- 默认使用 1 颗骰（按钮 `roll-btn` → `APP.movePlayer(1)`）。
- 若 `charityTurns > 0`，显示 `roll2-btn` → `APP.movePlayer(2)`，两骰求和（`APP.rollDie` 内部为“循环相加”）。
- 若开启 Manual Dice：读取输入框 `manual-dice-input` 作为点数（覆盖随机）。

2) 更新位置（`APP.updatePosition(dice)`）：
- 若 `position + dice <= 23`：`position += dice`
- 否则：`position = (position + dice) - 23`

> 注意：这里的“绕圈取模”使用 `- 23`（不是 `- 24`）。这会导致 **绕圈偏移 1 格** 的边缘行为（属于旧版实现特征/bug，重构时需明确是否复刻）。

3) 经过 PAYCHECK 时发放 Payday（在 `APP.loadCard()`之前/之后都可能影响 UI）：
旧版在移动后用如下条件给玩家加现金：
- 若 `previousPosition < 5 && currentPosition >= 5`：`cash += payday`
- 否则若 `previousPosition < 13 && currentPosition >= 13`：`cash += payday`
- 否则若 `previousPosition < 21 && currentPosition + dice >= 21`：`cash += payday`

> 注意：第三条使用 `currentPosition + dice`（不是 `previousPosition + dice`），且受“绕圈 -23”影响，可能出现“实际经过 21 但没发/或发放时机异常”。这也是旧版特征/bug。

4) 落点处理：调用 `APP.loadCard(position)` 根据格子类型展示/执行相应规则（见下文）。

#### 3.3 财务三表计算（旧版口径）
旧版核心计算都在 `APP.finance` 中完成，并在 `APP.finance.statement()` 内被频繁调用。

##### 3.3.1 收入 `getIncome()`
- **Rat Race**：
  - `salary = jobTitle[1]`
  - `dividends = Σ(Preferred Stock 或 CD 的 shares * dividend)`
  - `assetIncome = Σ(realEstateAssets.cashFlow) + Σ(businessAssets.cashFlow)`
  - `totalIncome = salary + dividends + assetIncome`
  - `passiveIncome = dividends + assetIncome`
- **Fast Track**（旧版写法）：
  - `fastTrackIncome = Σ(fastTrackAssets.cashFlow)`
  - `totalIncome = cashFlowDay + fastTrackIncome`

##### 3.3.2 支出 `getExpenses()`
- **Rat Race**：
  - 税：`jobTitle[3]`（由 `getTaxes()`写回）
  - 职业自带：房贷/车贷/信用卡/零售分期/其它支出：`jobTitle[4~8]`
  - 孩子支出：`childExpense`
  - 银行借款月供：`loanPayment = loans * 0.1`
  - 船月供：`boatPayment`（>0 才计入）
  - 保险：`insurance`（`hasInsurance=true` 才计入）
  - `totalExpenses = taxes + jobTitle[4~8] + childExpense + loanPayment + boatPayment + insurance`
- **Fast Track**：旧版强制 `totalExpenses = 0`

##### 3.3.3 Payday `getPayday()`
- **Rat Race**：`payday = totalIncome - totalExpenses`
- **Fast Track**（旧版写法）：`payday = cashFlowDay + income`
  - 这里 `income` 实际等于 `getIncome()`返回的 `totalIncome`，而 `totalIncome` 已经包含 `cashFlowDay`，因此会出现“cashFlowDay 被加了两次”的现象（旧版特征/bug）。

##### 3.3.4 税费 `getTaxes()`（旧版实现为“按总收入分段的简单比例”）
旧版注释写明“基于 2019 US federal brackets”，但实现是按 `totalIncome` 分段直接乘税率：
- `6875 < totalIncome < 13084` → `taxes = totalIncome * 0.24`
- `13084 < totalIncome < 16667` → `taxes = totalIncome * 0.32`
- `16667 < totalIncome < 41667` → `taxes = totalIncome * 0.35`
- `totalIncome > 41667` → `taxes = totalIncome * 0.37`
- 否则 → `taxes = totalIncome * 0.22`
并将结果 `Math.round()` 后写回 `jobTitle[3]`。

> 注意：`statement()` 里调用 `getTaxes()` 的时机早于 `getIncome()`，因此税可能依据“上一次的 totalIncome”计算（旧版特征/bug）。

##### 3.3.5 保险 `getInsurance()`
若 `hasInsurance=true`，保险月费按收入与孩子数动态计算：
- `insurance = round(totalIncome * (0.08 + 0.01 * children))`（有孩子）
- `insurance = round(totalIncome * 0.08)`（无孩子）

##### 3.3.6 孩子支出（CHILD 格）
踩到 CHILD（格 11）时：
- 单孩成本：`expensePerChild = round(totalIncome * 0.056)`
- 孩子数量变更：
  - 若 `children==0`：直接变为 1，并显示孩子支出行
  - 若 `children==3 && kidLimit==true`：不增加（维持 3）
  - 否则：`children++`
- 总孩子支出：`childExpense = children * expensePerChild`（注意：会用“最新一次计算的单孩成本”乘以“当前孩子数”，等价于把旧孩子也按新成本重算）

#### 3.4 各格子/卡牌的详细规则

##### 3.4.1 OPPORTUNITY：Small Deal / Big Deal 抽牌与处理
当落在 OPPORTUNITY（偶数格或 0）：
- 展示“Opportunity 卡背”，玩家可选择：
  - `Small Deal`（从 `APP.cards.smallDeal` 随机抽一张）
  - `Big Deal`（从 `APP.cards.bigDeal` 随机抽一张）
- 旧版并没有“牌库耗尽/弃牌堆”机制：抽取方式为 `Object.keys` 后随机选 key，牌不会从卡组中移除。

不同 Deal 类型的处理（由 `APP.display.showCurrentDeal()` 分流）：

1) **Real Estate（房产/公寓/地块）**
- 关键字段：`cost`、`downPayment`、`mortgage`、`cashFlow`、`landType`、`tag`、`units?(可选)`
- 购买（`APP.finance.buyRealEstate()`）：
  - 若 `cash >= downPayment`：`cash -= downPayment`，给资产生成 `id = newId()`，并 push 到 `realEstateAssets`
  - 否则：进入“贷款报价”流程（见 3.5）

2) **Limited Partnership（有限合伙）**
- 卡牌 `type="Limited Partnership"`，但旧版购买按钮复用 `buyRealEstate()`，并把资产存入 `realEstateAssets`。
- 字段通常为：`cost=downPayment`、`liability=0`、`cashFlow>0`、`landType="limited"`
- 后续会被 Offer 类型 `limited` 直接“强制卖出并结算 2x cost”（见 3.4.3）。

3) **Automated Business（自动化生意，Big Deal）/ Company（小公司，Small Deal）**
- 购买（`APP.finance.buyBusiness()`）：
  - 若 `cash >= downPayment`：`cash -= downPayment`，生成 `id = tag + random`，push 到 `businessAssets`
  - 否则：贷款报价流程
- 收入：`businessAssets.cashFlow` 计入 `assetIncome`
- 旧版“卖出公司”在 Offer 中基本未实现（部分 Offer 类型缺少分支），实质上公司更像“只能持有并等待增益”的资产。

4) **Stock / Mutual Fund（普通股/基金）**
- 字段：`symbol`、`price`、`shares`、`id`（通常为 `symbol+price`）
- 购买（`APP.finance.buyStock()`）：
  - 输入 `share-amt-input` 决定买入 `shares`
  - 成本 `cost = price * shares`
  - 若 `cash >= cost`：扣现金并把持仓写入 `stockAssets`
    - 若同 `id` 已存在：只累加 `shares`
    - 否则 push 新条目（会复制 `currentDeal` 并附加 `selected=false`）
  - 否则：贷款报价流程
- 出售（`APP.finance.sellStock()`）：根据 `selected=true` 的那一条持仓卖出指定股数，`cash += price * shares`，并减少/移除持仓条目。
- 收入：普通股/基金 **不产生** 股息（Dividend=0），不会进入 `passiveIncome`。

5) **Preferred Stock / Certificate of Deposit（优先股 / CD）**
- 购买/出售流程与 Stock 类似，但会产生“利息/股息”：
  - Dividend 收入：`shares * dividend`，计入 `totalIncome` 与 `passiveIncome`

6) **Stock Split / Reverse Split**
- 抽到后直接触发 `APP.finance.stockSplit(type)`：
  - `split`：匹配 `symbol` 的持仓 `shares *= 2`
  - `reverse`：匹配 `symbol` 的持仓 `shares /= 2`
- 不涉及现金支出。

7) **Coin（金币）**
- 字段：`name`、`cost`、`amount`（数量，通常为 1 或 10）
- 购买（`APP.finance.buyCoin()`）：
  - 若 `cash >= cost`：`cash -= cost`
  - 若已存在同名金币资产：
    - `cost==500` → `amount += 1`
    - `cost==3000` → `amount += 10`
  - 否则 push 新条目
- 金币不产生现金流；出售仅通过对应 Offer（见 3.4.3）。

8) **Property Damage（房屋损坏/维修）**
- 卡牌 `type="Property Damage"`，出现在 Small/Big Deal 卡组中（`smallDeal.propertyDamage`、`bigDeal.propertyDamage1/2`）。
- 触发逻辑（旧版 UI）：
  - 若玩家没有任何 `realEstateAssets`：提示“你没有该类型房产”，直接 Done 结束
  - 否则显示 `pd-pay-button` 允许支付（`APP.finance.payPropertyDamage()`）
- 支付规则：若 `cash < cost` → 贷款报价流程；否则 `cash -= cost` 并结束回合

> 重要差异：卡面文案会写“仅当你拥有某类房产才支付”，但旧版实现中的判定条件存在明显 JS 逻辑错误，可能导致“只要有任何房产就要求支付”或“类型判定不准确”。重构时必须先决定“按卡面”还是“按旧实现”。

##### 3.4.2 LIABILITY：Doodad（消费/意外支出）
落在 1/9/17（以及启用 Paycheck Doodads 时落在 PAYCHECK）会抽 Doodad：
- 抽取：从 `APP.cards.doodad` 随机选一个 key（同样无弃牌机制）
- 部分 Doodad 需要孩子（`child: true`）：若 `children==0` 会递归重抽，直到抽到不需要孩子的卡
- 部分 Doodad 使用比例金额（`amount`）：旧版会把 `cost` 动态设为 `player.cash * amount`（例如“支付一半储蓄”）
- 支付（`APP.finance.payDoodad()`）：
  - 若 `cash >= cost`：`cash -= cost`，结束回合
  - 否则：贷款报价流程
- “船”类 Doodad（`New Boat!`）：
  - 抽到时若 `boatLoan==0`：立即设 `boatLoan=17000`、`boatPayment=340`（并仍需支付卡面的 `cost`/down）
  - 若已拥有船：文案变为“You already own one.”

> 差异提示：旧版还存在一些 Doodad 尝试写入信用卡/电视分期等字段，但并未完全接入财务表（属于未完成实现）。

##### 3.4.3 OFFER：Market（出售/事件）
落在 7/15/23 会抽 Offer：
- 抽取：从 `APP.cards.offer` 随机选一个 key
- 展示 Offer 文案，并按 `offer.type` 执行以下分支：

1) **出售型 Offer（房产类）**
- 常见 `type`：`duplex`、`4-plex`、`8-plex`、`plex`、`apartment`、`3Br/2Ba`、`2Br/1Ba`、`10 acres`、`20 acres`、`bed breakfast`、`5Br/4Ba`、`6Br/6Ba`、`car wash`、`mall` 等
- 旧版做法：
  - 在 `realEstateAssets` 中把符合条件的资产 `highlight="on"`，并把行高亮为黄色
  - 玩家点击资产行后进入 Settlement 计算与确认
- Settlement 计算（`APP.getSettlement(..., debt=false)`）：
  - `duplex/4-plex/8-plex/plex/apartment`：`settlement = units * offerPerUnit - mortgage`
  - 其他：`settlement = offer - mortgage`
- 确认卖出（`APP.finance.sellAsset()`）：
  - `cash += settlement`
  - 从 `realEstateAssets` 删除该资产
  - 资产现金流随资产删除而不再计入收入（旧版还会尝试 `player.assetIncome -= cashFlow`，但实际收入主要由遍历资产数组计算）

2) **金币 Offer**
- `type="Krugerrands"`：卖出价 = `amount * 600`
- `type="1500's Spanish"`：卖出价 = `amount * 5000`
- 旧版做法：高亮 `coinAssets` 中对应金币行，点击后进入 Settlement 卡并确认卖出（确认后从 `coinAssets` 删除）

3) **Limited Partnership Sold（`type="limited"`，强制结算）**
- 旧版会遍历 `realEstateAssets` 中 `landType=="limited"` 的资产：
  - 立即执行：`cash += (asset.cost * 2)` 并从数组中移除该资产
  - 该过程不是“可选卖出”，而是抽到卡就立刻生效

4) **Small Business Improves（`type="business"`，现金流增益）**
- 遍历 `businessAssets` 中 `landType=="business"` 的资产：
  - `asset.cashFlow += offer.cashFlow`（如 +250 或 +400）

5) **强制事件：`3Br/2Ba-`（止赎/失去房产）**
- 旧版会把所有 `landType=="3Br/2Ba"` 的资产从 `realEstateAssets` 中移除，并尝试减少对应现金流。

6) **事件：`3Br/2Ba+`（成本增加）**
- 旧版会把所有 `landType=="3Br/2Ba"` 资产的 `cost += 50000`（直接改资产对象）

> 重要差异：Offer 卡面经常写“Everyone may sell at this price”，但旧版实现只允许“当前回合玩家”操作自己资产；并未实现“其他玩家同时卖出”的交互与结算。

##### 3.4.4 PAYCHECK（格 5/13/21）
- 发放 Payday（加现金）发生在“移动阶段的过线检测”中（见 3.2）。
- 落在 PAYCHECK 格后的额外效果：
  - 若未开启 Paycheck Doodads：直接进入 `finishTurn()`
  - 若开启 Paycheck Doodads：立刻抽一张 Doodad 并要求支付（等价于把 PAYCHECK 变成“领工资 + 抽支出”）

##### 3.4.5 CHARITY（格 3）
- 可选择 Donate 或 Pass
- Donate 金额：`donation = totalIncome * 0.1`
- 若 `cash >= donation`：
  - `cash -= donation`
  - `charityTurns += 3`
  - 结束回合（Fast Track/ Rat Race 的结束函数不同）
- 若现金不足：展示“无法支付”提示，不进入借款报价（旧版是直接提示并要求 Done）

##### 3.4.6 CHILD（格 11）
见 3.3.6，旧版为“强制获得孩子并更新支出”，无拒绝选项。

##### 3.4.7 DOWNSIZE（格 19）
- Downsize 金额：`downsizedAmount = totalExpenses`
- 若无保险（`hasInsurance=false`）：
  - 若 `cash < downsizedAmount`：贷款报价流程
  - 否则：`cash -= downsizedAmount`，并 `downsizedTurns += 3`，结束回合
- 若有保险（`hasInsurance=true`）：
  - 不扣现金，直接 `downsizedTurns += 3`，结束回合

> “跳过回合”执行点：在 `nextTurn()` 中，若 `downsizedTurns != 0` 则 `--` 并（多人模式下）递归调用 `nextTurn()` 来直接跳到下一位玩家。
>
> 单人模式差异：当 `pCount==1` 时旧版不会递归跳过（避免无限递归），因此表现为“仍可继续行动，但 `downsizedTurns` 每回合递减”。

#### 3.5 回合结束阶段：借款与还款（旧版 UI 允许“回合内任意时点”打开）
旧版在 `finishTurn()` 后展示 `Repay / Borrow / End Turn`：

##### 3.5.1 Borrow（银行借款）
- 借款金额由输入框控制，步长 `1000`
- 执行（`APP.finance.takeOutLoan()`）：`loans += loan` 且 `cash += loan`
- 银行借款月供：始终为 `loanPayment = loans * 0.1`

##### 3.5.2 Repay（偿还负债）
玩家点击“负债表”中的某一行触发偿还逻辑（`player.loanId` 决定分支）：
- `liability-mortgage`：
  - 若开启 Mortgage Prepay：允许按输入金额部分偿还本金（本金降为 0 才把月供置 0）
  - 否则只能一次性还清全部本金（现金不足会提示 Not enough funds）
- `liability-car` / `liability-credit` / `liability-retail`：一次性还清本金并把对应月供置 0
- `liability-loans`（银行借款）：允许按输入金额部分偿还（同样以 1000 为步长）
- `liability-boat`：允许按输入金额部分偿还（降为 0 才把 `boatPayment` 置 0）

> 差异提示：旧版“可还款金额的默认值/上限”等 UI 逻辑存在若干边界 bug（例如现金不足时会把贷款直接置 0），重构时建议先明确期望行为。

##### 3.5.3 贷款报价流程（Loan Offer：当“现金不足以支付/购买”时触发）
旧版在以下场景会弹出“贷款报价卡”（`cannot-afford-loan-card`），引导玩家用银行借款补足现金：
- 购买类：买房产/生意/金币/股票等（`buyRealEstate/buyBusiness/buyCoin/buyStock`）
- 支付类：支付 Doodad/Downsize/Property Damage 等（`payDoodad/payDownsize/payPropertyDamage`）

核心规则（旧版实现）：
- 贷款金额计算（向上取整到 1000）：  
  - `need = cost - cash`  
  - 若 `need < 1000` → `loanAmount = 1000`  
  - 否则 `loanAmount = ceil(need/1000) * 1000`
- 接受贷款（`getLoan()`）：`loans += loanAmount` 且 `cash += loanAmount`，然后返回到触发贷款前的卡片继续处理（`returnToCard()`）。
  - 由于“向上取整”，可能出现“借到的金额 > 实际缺口”，差额会留在现金中。
- 拒绝贷款（`noLoan()`）：不改变资金，直接 `returnToCard()` 回到原卡片（可能仍无法支付，从而反复卡住）。
- 月供口径：旧版对银行借款的月供始终为 `loanPayment = loans * 0.1`（与当次贷款卡片显示的 `loanAmount * 0.1` 一致，但会随累计借款变化）。

> 例外：Charity 捐款不足时旧版不会走贷款报价，而是直接提示“无法支付”并要求 Done。

#### 3.6 债务/破产（旧版额外机制，`APP.checkBankruptcy()`）
旧版额外加了一个“现金与现金流同时为负”的债务处理机制（并非桌游标准规则）：
- 若 `payday < 0`：设置 `loanApproval=false`（但旧版 UI 并未完整利用该标志来禁用借款）
- 若 `payday < 0 && cash < 0`：
  - 进入 `debt=true`，清空当前卡牌 UI，展示 Bankruptcy 卡
  - 若 `realEstateAssets.length < 1`：直接 Game Over（旧版只允许卖房产脱困）
  - 否则允许“债务拍卖”：
    - 资产行高亮为橙色（`debtSale=true`）
    - 点击资产行会生成“债务结算价”= `downPayment / 2`
    - 确认卖出后加现金并删除该资产

### 4. 进入 Fast Track 的条件（旧版）
旧版用一个进度条来表示“被动收入覆盖支出”的程度：
- Rat Race 时：`progress = passiveIncome / totalExpenses`
- 当进度条宽度达到 100%（即 `passiveIncome >= totalExpenses`）：
  - 自动把 `fastTrackOption = true`
  - 弹出 Fast Track 引导卡，并展示 `ENTER FAST TRACK` 按钮

### 5. Fast Track（外圈）规则：初始化、棋盘与胜利

#### 5.1 进入 Fast Track 时的状态变更（`FASTTRACK.init()`）
进入时旧版做了这些“硬切换”：
- `fastTrack = true`、`fastTrackTurn = 1`
- 资金与目标：
  - `cash += payday * 100`
  - `cashFlowDay = payday + 50000`
  - `winPay = cashFlowDay + 50000`（即：需要把 CashFlow Day 再提升至少 50,000 才算赢）
- 清空 Rat Race 资产（直接清空各数组）：
  - `stockAssets/realEstateAssets/businessAssets/coinAssets/personalAssets` 全部清空
- 把棋子移动到 Fast Track 棋盘的起始格：
  - 玩家序号 0→1，1→7，2→14，3→21，4→27，5→34（之后循环）
- Fast Track 不显示 Rat Race 的“负债表/借款还款”区域（也符合旧版注释“不能向银行借钱”这一目标）。

#### 5.2 Fast Track 掷骰与移动（`FASTTRACK.movePlayer(dieCount)`）
- 默认按钮：`ft-roll-btn` → `FASTTRACK.movePlayer(1)`（1 颗骰）
- 若 `charityTurns > 0`：显示 `ft-roll2-btn` → `FASTTRACK.movePlayer(2)`（2 颗骰）
- Fast Track 的掷骰实现：`FASTTRACK.rollDie(dieCount)` 返回 `randomDie(1..6) * dieCount`
  - 因此 `dieCount=2` 时只会出现 `2/4/6/8/10/12`（不是两骰求和的分布）
  - 这是旧版实现特征/bug，重构需明确是否保留。
- 位置更新（`FASTTRACK.updatePosition`）：
  - 若 `position + dice <= 40`：`position += dice`
  - 否则：`position = (position + dice) - 40`
- 经过 CashFlow Day（见下）时会发放 `cash += payday`。

#### 5.3 Fast Track 关键格子与效果（旧版 `APP.loadCard` 的 fastTrack 分支）
Fast Track 中 `APP.loadCard(boardPosition)` 用 `switch` 处理特殊格，其余格默认视为“机会资产”：

1) **Doodad 格**：1、7、14、21、27、34
- 1：Healthcare（点按钮后再掷 1 颗骰；4~6 则 `cash=0`，1~3 无事）
- 7：Lawsuit（`cash *= 0.5`）
- 14：Tax Audit（`cash *= 0.5`）
- 21：Bad Partner（尝试移除最低现金流资产；旧版代码存在明显删除 bug）
- 27：Divorce（`cash *= 0.5`）
- 34：Unforeseen Repairs（尝试支付“最低现金流资产的 10 倍月现金流”否则失去该资产；旧版实现不完整/有变量错误）

2) **Charity 格**：2
- 复用 Rat Race 的 Charity 逻辑：支付 `totalIncome * 0.1`，获得 `charityTurns += 3`（从而允许 `ft-roll2`）

3) **CashFlow Day 格**：10、18、30、38
- 落点仅展示卡片与 end turn
- 移动过程中“过线”会发放 `cash += payday`（见 `FASTTRACK.movePlayer` 的过线判断）

4) **Dream 格**：24
- 进入格子后生成一个随机梦想费用：`dreamCost = random(50000..174999)`
- 若 `cash < dreamCost`：提示资金不足并结束
- 若可支付：
  - 点击 Dream Roll：先 `cash -= dreamCost`
  - 掷 1 颗骰：若点数为偶数 → Dream Successful（展示胜利按钮）；若为奇数 → Dream Unsuccessful（触发一段随机“人生事件”并可能带来收入/支出/资产变化/再次尝试/慈善次数等）

5) **机会资产格（默认分支）**
- 大多数格子展示一个固定资产条目（标题/成本/现金流）并允许 Buy 或 Pass
- Buy（`FASTTRACK.opportunity(position)`）会：
  - `cash -= cost`
  - `cashFlowDay += cashFlow`
  - 给资产写入 `id = newId()` 并 push 到 `fastTrackAssets`
- 特殊机会格（旧版单独展示“roll”提示的几格）：17、23、33
  - Buy 后会按旧版代码立即掷骰决定结果（Foreign Oil / IPO 等），并可能：
    - 修改该资产现金流（如 17 成功则现金流变为 75,000）
    - 或给予一次性现金收益（如 23/33 成功则 `cash += roi`）
  - 旧版 UI 还存在一个 `ft-opp-roll-btn`（`FASTTRACK.roll()`）但函数是空壳，实际不产生完整逻辑。

#### 5.4 胜利条件（旧版）
- 旧版在 `FASTTRACK.finishTurn()` 中判断：
  - 若 `cashFlowDay >= winPay` → `winGame()`
  - 由于 `winPay = 初始 cashFlowDay + 50000`，等价于：**CashFlow Day 相比刚进入外圈时至少增加 50,000** 即获胜。

### 6. 旧版实现中的关键歧义/bug 清单（重构前建议逐条定案）
为避免“有人按卡面、有人按旧代码”造成冲突，以下点在旧版中存在明显不一致/不完整实现：
- Rat Race 绕圈用 `-23` 而不是 `-24`，会导致落点与 PAYCHECK 发放边界异常。
- Rat Race 的第三个 PAYCHECK 过线判断使用 `currentPosition + dice`，且受绕圈逻辑影响，可能漏发/错发。
- 税费 `getTaxes()` 的调用时机早于 `getIncome()`，税可能基于上一次的总收入计算。
- Property Damage 的“是否拥有对应房产才支付”的判定逻辑有 JS 写法错误，可能导致触发范围扩大或不准确。
- Doodad 中“Big Screen TV”等会写入未接入报表的字段（未完成实现）。
- 借款/还款 UI 的默认值与上限逻辑存在边界问题（例如现金不足时可能错误把贷款置 0）。
- Fast Track 的“双骰”实现为 `random * 2`（只出偶数），并非两骰求和分布。
- Fast Track 的部分 Doodad（Bad Partner / Unforeseen Repairs）删除资产与扣款逻辑不完整或有变量错误。
- Fast Track 资产购买在实现上会直接修改 `cashFlowDay`，而 `getIncome()` 又会把 `cashFlowDay` 与 `fastTrackAssets.cashFlow`相加，存在重复计入风险。
