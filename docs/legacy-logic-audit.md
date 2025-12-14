# 旧版（`legacy/`）逻辑审计：实现缺陷清单 & 与经典 Cashflow 规则差异

> 目的：把“旧版代码的确定缺陷”与“需要产品/团队定案的规则差异”拆开，避免重构时无意复刻旧 bug，或因为每个人参考的桌游版本不同而实现冲突。  
> 重构版目标规则口径请以 `docs/game-rules-spec.md` 为准。  
> 审计依据：`legacy/js/index.js`、`legacy/js/display.js`、`legacy/js/cards.js`、`legacy/js/board.js`、`legacy/js/fasttrack.js`、`legacy/js/options.js`。  
> “经典/广为熟知规则”口径：以玩家社区最常见的《Cashflow 101》桌游玩法为参照（不同年份/语言/盗版/改版可能不同；涉及版本差异的点已显式标注为“需确认”）。

---

## 1. 旧版实现本身的缺陷（明确属于 bug / 边界错误）

### 1.1 Rat Race（内圈）移动与 PAYCHECK 发放

1) **绕圈取模 off-by-one（导致永远回不到格 0）**  
- 旧版：`APP.updatePosition()` 使用 `x -= 23` 而非 `x -= 24`。  
- 后果：  
  - 棋盘被“当成 23 格”处理，**除开局外几乎无法落到格 0**。  
  - 落点整体偏移，进而影响 OPPORTUNITY/OFFER/PAYCHECK 等触发频率。  

2) **第三个 PAYCHECK（21）过线判断写错**  
- 旧版：`previousPosition < 21 && currentPosition + dice >= 21`（应基于旧位置 + dice 或“是否跨过 21”来判断）。  
- 后果：在接近绕圈边界时出现漏发/错发（尤其与 `-23` 叠加时更明显）。

3) **PAYCHECK 发放时机在 `loadCard()` 之后（会错误影响“能否支付/是否触发贷款”）**  
- 旧版：`APP.movePlayer()` 先 `APP.loadCard(currentPosition)`，再按过线条件 `cash += payday`。  
- 典型问题：  
  - 玩家实际已“经过 PAYCHECK”，但在处理 Doodad/Downsize/买入等支出时却被当作“尚未领到钱”，从而进入贷款流程或被迫放弃购买。  
  - 落到 PAYCHECK 格时，`loadCard()` 可能直接进入 `finishTurn()`，随后才补加现金，UI/流程时序不一致。

4) **一次移动最多只会发 1 次 PAYCHECK（`if / else-if` 链）**  
- 旧版：过线逻辑是 `if ... else if ... else if ...`，即便一次移动理论上跨越多个 PAYCHECK，也只会发一次。  
- 需确认：桌游实物规则里通常写“经过或停在 PAYCHECK 即领取现金流”，是否允许“一次移动跨越多个 PAYCHECK 领取多次”要由产品定案；旧版目前是“最多一次”。

5) **Manual Dice（手动骰）未做数值解析与校验**  
- 旧版：`dice = manualDice.value`（字符串），未 `parseInt` / 未限制 1-6 或 2-12。  
- 后果：位置可能被拼接成字符串、出现异常落点、甚至导致后续逻辑隐性类型转换。

---

### 1.2 财务三表（Income/Expenses/Payday）计算顺序与字段一致性

1) **税费 `getTaxes()` 的调用顺序错误（可能用“上一次 totalIncome”算税）**  
- 旧版：`APP.finance.statement()` 先调用 `getTaxes()`，后调用 `getIncome()`。  
- 后果：税费可能滞后一回合，导致现金流/进度条/慈善捐款等出现不稳定结果。

2) **Fast Track 的 `getPayday()` 存在“CashFlow Day 被加两次”的确定 bug**  
- 旧版：Fast Track `getIncome()` 已返回 `cashFlowDay + fastTrackIncome`，但 `getPayday()` 又计算 `player.payday = player.cashFlowDay + income`。  
- 后果：Fast Track 的 PAYCHECK/CashFlow Day 发放金额被系统性放大，胜利判断与 UI 展示也会被污染。

3) **Fast Track 进度条使用了不存在/未赋值字段**  
- 旧版：`progressBar()` 在 Fast Track 分支用 `player.fastTrackIncome / player.winPay`，但 `player.fastTrackIncome` 从未被写入。  
- 后果：宽度变 `NaN%`，相关 “>=100%” 判断与展示不可用。

4) **潜在除零/NaN**  
- 旧版：`progress = passiveIncome / expenses`，若 expenses 被配置项清成 0（或出现异常），会出现 Infinity/NaN，影响进入 Fast Track 的解锁逻辑。

---

### 1.3 Doodad / Offer / Asset 买卖结算的确定 bug

1) **Property Damage 触发条件的 JS 写法错误（几乎会被“扩大触发”）**  
- 旧版：在 `display.js` 中使用 `landType == ("3Br/2Ba" || "2Br/1Ba" || ...)` 这类写法，实际只会比较第一个字符串。  
- 结果：只要玩家“拥有任意房产”，就可能被错误判定为需要支付（与卡面“仅在拥有对应类型房产才支付”冲突）。

2) **股票 Reverse Split 可能产生非整数股数**  
- 旧版：`shares / 2` 不做取整/规则约束。  
- 后果：出现小数股，后续买卖与展示出现不一致（桌游通常以整数股为单位）。

3) **股票卖出选中行的绑定/索引解析不可靠（易卖错/无法卖）**  
- 旧版：`renderStockTable()` 用 `var rowId` + 闭包捕获，且通过固定字符位 `idArr[6]` 解析索引。  
- 后果：  
  - 多行高亮时可能始终选中最后一行；  
  - 索引 >= 10 时解析错误；  
  - `sellStock()` 不校验 `selected` 是否存在，可能出现 `undefined` 访问或卖出超额导致负股数。

4) **金币 Offer 卖出时删除了错误数组（会删错币或删房产数组索引）**  
- 旧版：`sellAsset()` 对 coin offer 使用 `assetArr.findIndex(...)`（realEstateAssets）而非 `coinArr.findIndex(...)`。  
- 后果：可能把最后一条 coin 误删、或直接删错对象，导致资产/现金不一致。

5) **`getSettlement()` 通过字符串长度/固定字符位推断索引，极其脆弱**  
- 旧版：通过 `currentId[5]`、`currentId[6]` 组合数字。  
- 后果：索引两位以上、不同前缀（如 `asset-c`/`asset-b`）时容易变 NaN 或错位，属于“碰巧可用”的实现。

6) **还款：零售分期（Retail）一次性还清逻辑扣款错误**  
- 旧版：`liability-retail` 分支检查的是 `cash < retailDebtPrincipal`，但实际只 `cash -= 1000` 就把本金清 0。  
- 后果：玩家以明显低于本金的金额清空债务，现金流被系统性抬高。

7) **Limited Partnership 强制卖出实现存在数组越界风险**  
- 旧版：在 `getOffer()` 的 `type="limited"` 分支里 `for` 套 `while(assetArr[i].landType == offerType)`，内部又 `splice`。  
- 风险：当删除导致 `assetArr[i]` 变 `undefined` 时仍访问 `.landType`，可能抛异常（并且逻辑上也容易跳过元素）。

---

### 1.4 Fast Track（外圈）事件与资产实现缺陷

1) **双骰实现错误（只会掷出偶数）**  
- 旧版：`FASTTRACK.rollDie(dieCount)` 返回 `random(1..6) * dieCount`，`dieCount=2` 时只会出 `2/4/6/8/10/12`。  

2) **CashFlow Day 发放时机同样在 `loadCard()` 之后**  
- 旧版：`FASTTRACK.movePlayer()` 先 `APP.loadCard(currentPosition)`，再按过线条件 `cash += payday`。  
- 后果：与内圈相同，会错误影响“当回合是否能支付/是否触发贷款/是否能买入”等判断。

3) **Fast Track 购买资产会“污染模板对象”，导致跨玩家/跨回合串数据**  
- 旧版：`FASTTRACK.opportunity()` 直接拿 `this.square[currentSquare]` 的对象引用，写入 `id`、修改 `cashFlow`，再 `push` 进玩家资产。  
- 后果：  
  - 同一格子的资产被多个玩家共享引用；  
  - 一个玩家触发的修改可能影响后续玩家购买/显示；  
  - 属于确定的共享状态 bug。

4) **Fast Track 现金流累计存在重复计入风险**  
- 旧版：买入时 `player.cashFlowDay += asset.cashFlow`，而 `getIncome()` 又把 `cashFlowDay + Σ(asset.cashFlow)` 相加，形成重复计入。  
- 另外：17/23/33 这类“买后立刻掷骰决定结果”的格子还会在调整现金流后再次 `cashFlowDay += asset.cashFlow`，重复更严重。

5) **Bad Partner / Unforeseen Repairs 等 Doodad 实现不完整或直接报错**  
- 旧版：  
  - Bad Partner（21）只 `delete player.fastTrackAssets.id`，并未删除具体资产；  
  - Unforeseen Repairs（34）存在 `lowest= lowestAsse` 语法残缺 + `player.cash - (lowest * 10)` 未赋值，逻辑不可用。  

---

### 1.5 借款/还款/破产流程的实现缺陷

1) **贷款报价（Loan Offer）的“不可拒绝”判定写错**  
- 旧版：`if (player.position == (1 || 9 || 17))` 实际只会命中位置 `1`。  
- 后果：在 9/17 等 Doodad 格可能错误出现 “No Loan” 按钮，导致流程绕过或卡死。

2) **贷款报价界面的样式判断存在明显笔误**  
- 旧版：出现 `player.position === 2 % 0`（结果为 `NaN`），高概率是把“判断是否 opportunity（position % 2 === 0）”写错。  
- 后果：UI 高亮/提示不稳定，但更关键的是这类错误常与流程条件混写，容易引入隐性分支。

3) **拒绝贷款可能导致“回到卡片但仍无法支付”的软锁**  
- 旧版：`noLoan()` 只是 `returnToCard()`，不会改变现金；若该卡是强制支付且现金仍不足，玩家会在“贷款报价卡 ↔ 原卡”间循环。  
- 桌游常见：通常强制支付项要么允许借款、要么允许出售/抵押/破产处理；不会无限循环。

4) **`loanApproval` 标志未真正用于限制借款**  
- 旧版：破产检查里会在 `payday < 0` 时设 `loanApproval=false`，但 `loanOffer()` 里又直接 `player.loanApproval = true`，且未在借款入口做强约束。  
- 后果：“负现金流不可借款”的意图没有落地，表现不可预期。

5) **破产处理只允许卖房产，且无房产直接 Game Over（忽略其他资产）**  
- 旧版：`checkBankruptcy()` 基本只允许通过 `realEstateAssets` 脱困；即便玩家有股票/金币/生意也可能被判 Game Over。  
- 建议：若重构要保留破产机制，应允许按规则折价出售所有可售资产类型，并定义清晰的“出局/继续”条件。

---

## 2. 旧版与“广为熟知 Cashflow 桌游规则”的差异点（需要产品/团队定案）

> 下列不一定是“bug”，更多是“玩法口径”差异。建议把这些差异在重构版以配置/规则版本（RuleSet）显式固化，避免开发随意混用。

### 2.1 牌库机制：抽取是否“无放回”

- 桌游常见：实体牌库抽牌后进入弃牌堆，耗尽才洗牌，**同一局内卡牌分布是“无放回”**。  
- 旧版：每次从对象 `Object.keys()` 随机取一张，**不移除**（等价“有放回”），同一张牌可连续出现。  
- 影响：概率分布与策略预期差异很大（尤其是 market / split / property damage 这类波动牌）。

### 2.2 “Market 卡影响所有玩家” vs “只影响当前玩家”

- 桌游常见：Market 卡文本经常是 “Everyone may sell …”，通常允许**所有玩家**按该价卖出符合条件的资产。  
- 旧版：只高亮/操作“当前回合玩家”的资产，其他玩家无法响应同一张 market 价格。  
- 影响：市场卡的价值被显著削弱，互动性下降；资产流动性整体降低。

### 2.3 税费/孩子/保险的计算口径

1) **税费**  
- 桌游常见：职业卡给定“固定税费”（每回合/月固定），不随投资收入动态套税率；税务审计等通过事件卡额外影响。  
- 旧版：按 `totalIncome` 分段比例计算税费（且含实现顺序 bug）。  
- 影响：投资越成功税越高，现金流曲线与桌游体验显著不同。

2) **孩子支出**  
- 桌游常见：职业卡通常给定“每个孩子固定支出”，孩子增加只做“孩子数 × 单孩费用”。  
- 旧版：单孩费用 = `round(totalIncome * 5.6%)`，且每次触发 CHILD 会把“所有孩子”按最新收入重新定价。  
- 影响：孩子支出随收入飙升，且历史孩子成本被回溯重算。

3) **保险**  
- 桌游常见：通常是固定费用/或由卡牌规定（版本差异较大，需确认）。  
- 旧版：保险月费 = `round(totalIncome * (8% + 1% * children))`（完全随收入变化）。  
- 影响：保险随收入指数增长，可能与桌游直觉不一致。

### 2.4 进入 Fast Track 后的资产/现金/胜利条件

- 桌游常见（需确认具体版本）：  
  - 进入条件通常是被动收入 ≥ 总支出；  
  - 进入外圈后，起始现金与“现金流日收入”通常与“被动收入/现金流”存在固定倍率映射；  
  - 胜利条件通常与“实现梦想（Dream）/达到目标现金流”相关，而非固定 +50,000。  
- 旧版：  
  - 进入条件同样基于进度条（被动收入/支出）；  
  - 进入时 `cash += payday * 100`，`cashFlowDay = payday + 50,000`，并 **清空全部 Rat Race 资产**；  
  - 胜利条件：`cashFlowDay >= winPay`（进入时的 cashFlowDay 再 +50,000）+ Dream 格的随机掷骰事件。  
- 影响：外圈变成近似“重新开局”的另一套游戏，和桌游“带着你在内圈构建的资产进入外圈”的感觉明显不同（是否保留旧版取决于产品目标）。

### 2.5 外圈掷骰规则（默认 1 骰还是 2 骰）

- 桌游常见：不少版本外圈默认用 2 骰；慈善在内圈提供 2 骰奖励（外圈是否叠加需确认）。  
- 旧版：外圈默认 1 骰，慈善时显示 2 骰按钮，但实现有 bug（只会出偶数）。  

### 2.6 借款/还款的可用阶段

- 桌游常见：通常允许随时向银行借/还（至少在回合内可操作），外圈是否禁借取决于版本/桌面约定。  
- 旧版：内圈回合结束有 Borrow/Repay UI；外圈明确不提供借款入口。  
- 影响：外圈资金周转方式差异巨大，会改变外圈风险与节奏。

---

## 3. 建议给重构版的“决策清单”（强烈建议落 PR/Issue 并写入规则文档）

1) 是否复刻 `Rat Race -23` 绕圈 bug（影响落点与 PAYCHECK）？  
2) PAYCHECK 发放时机：在落点事件前还是后？（推荐：**移动时按经过顺序即时结算**）  
3) 一次移动是否允许跨越多个 PAYCHECK 并领取多次？  
4) 牌库抽取：有放回随机 vs 无放回弃牌堆（推荐：无放回，更符合桌游预期）  
5) Market 卡是否允许所有玩家卖出（推荐：允许所有玩家响应，按 turn order 或“同时选择后结算”）  
6) 税费/孩子/保险：固定职业卡数值 vs 动态百分比（推荐：按职业卡固定；动态规则可作为“变体模式”）  
7) 进入 Fast Track 时是否清空内圈资产？起始现金/现金流日映射公式是什么？胜利条件是什么？  
8) 外圈默认骰子数量、慈善加成规则（2 骰的概率分布必须是“两骰求和”）。  
9) 破产机制：是否存在 Game Over？是否允许卖出所有类型资产以脱困？折价口径（按 down payment/成本的 1/2？）。
