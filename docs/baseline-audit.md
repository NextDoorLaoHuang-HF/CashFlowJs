# 阶段0：基线审计

## UI 流程速查
1. **Home Screen (`#home-screen`)**：静态引导页，唯一入口为“开始”按钮。未在 120 秒内进入下一页会自动刷新。
2. **Game Selection (`#game-selection-screen`)**：选择“创建房间”或“继续游戏”。继续游戏直接进入财务盒与棋盘渲染逻辑；新游戏则进入下一页配置。
3. **Game Setup (`#game-setup-screen`)**：
   - 依赖 `#player-number`、`#job-input-playerX`、`#color-input-playerX` 等表单。
   - 点击“开始游戏”后清空背景、隐藏配置层，并触发 `APP.display.renderBoard()` 初始化棋盘。
4. **Board/Turn UI**：
   - `#turn-info`、`#player-list-table` 展示当前回合与玩家顺序。
   - 通过 `APP.board`, `APP.options` 控制掷骰、选牌、资产/负债表的弹窗。
5. **Fast Track**：`APP.fasttrack` 监控回合从老鼠赛跑转入快车道，复用相同 DOM 容器。

## 核心脚本与依赖
| 文件 | 角色 | 关键依赖 |
| --- | --- | --- |
| `js/index.js` | 定义全局 `APP`，负责玩家创建、场景（职业）生成、回合推进、入口事件绑定。 | 强绑定 DOM id、浏览器 `localStorage`、`APP.display`、`APP.board` 等子模块。 |
| `js/display.js` | 所有 UI 呈现：玩家颜色、面板开关、棋盘渲染、提示信息、按钮状态。 | 直接操作 DOM + jQuery；假设 `APP.players` 已初始化。 |
| `js/board.js` | 棋盘格子、掷骰、移动、工资/负债等流程控制。 | 强耦合 `APP.cards`、`APP.fasttrack`、`options.js`；读写 `APP.players[n].state`。 |
| `js/cards.js` | 数据静态字典，小/大买卖、股票、现金流等卡牌内容。 | 所有值以对象常量存在；无加载机制；部分字段由其他模块直接突变。 |
| `js/options.js` | 不同情境的模态操作（买卖、借贷、孩子等），并处理按钮点击。 | 需要 `APP.board.currentCard` 和玩家财务数据；依赖 jQuery 动态绑定。 |
| `js/fasttrack.js` | 快车道规则、目标检测。 | 共享 `APP.players[i]` 和 `APP.board`. |

额外资源：
- `src/jquery-3.4.1.js` 由 `index.html` 直接引用，没有 npm 依赖管理。
- `css/` 仅由静态页面引用，无打包或 PostCSS 处理。

## 隐藏约束 & 风险
- **全局命名空间**：所有模块通过 `APP` 互相修改属性。没有模块化边界，难以在测试或自动化中单独复用逻辑。
- **DOM 紧耦合**：函数直接假定元素存在并立即写入 `innerHTML` / `style`；若未来改动模板，就会出现运行时错误。
- **状态复制散落**：例如玩家颜色可能来自 `color-input-playerX` 或随机选择，两处逻辑可能导致颜色冲突，且数组 `APP.players` 与 `#player-list-table` 文本需要手工同步。
- **卡牌为可变对象**：`APP.cards.*` 中的条目在运行时被直接改写 `shares` 或 `price`，导致多玩家对同一引用产生竞态。
- **缺乏构建与校验**：目前 `package.json` 为空，没有 lint、格式化或测试，任何改动只能靠人工回归。

## 基线冻结
- `baselines/legacy-v0/` 保存了当前 `index.html`、`css/`、`js/` 和 jQuery 依赖。作为“已知稳定”构建的离线副本，可直接由浏览器打开进行对比测试。
- 该目录附带 README 记录快照时间与源码 commit，后续迭代禁止修改其中文件。

## 冒烟测试计划
- 借助 Vitest + jsdom（在阶段1的工具链内）装载 `baselines/legacy-v0/index.html`，
  - 校验关键 DOM 结构（home screen、游戏配置表单、玩家列表容器）。
  - 模拟点击主入口，确保过渡步骤展示了预期的容器（作为 UI 流程守护）。
- 增加一个快照断言，保证 legacy 构建中核心脚本标签顺序未被破坏。
- 所有冒烟测试都保持对 `baselines/legacy-v0` 的只读访问，以便后续 refactor 时快速发现破坏性变更。

## 冒烟测试现状
- `tests/legacy-smoke.test.ts` 通过自定义 `ResourceLoader` 注入 legacy 依赖，在 jsdom 内执行原生脚本并同步 `APP` 事件绑定。
- 用例除 DOM 结构与脚本顺序断言外，还真实触发 `#home-screen` → `#game-selection-screen` → `#setup-screen` 的点击流，确保阶段 0 入口体验得到守护。
