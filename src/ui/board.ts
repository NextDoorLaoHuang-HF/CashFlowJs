import { advanceTurn, getCurrentPlayer, moveCurrentPlayer, rollDice } from '@/domain/turns';
import { saveGame } from '@/domain/save';
import { rootStore } from '@/state/store';
import type { GameEvent, Player } from '@/state/types';

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 0 });
}

function renderPlayerSummary(container: HTMLElement, players: Player[]): void {
  container.innerHTML = '';
  players.forEach((player) => {
    const row = document.createElement('div');
    row.className = 'player-summary-item';
    row.innerHTML = `
      <strong>${player.name}</strong>
      <div>💵 $${formatCurrency(player.cash)} ｜ ⚙️ ${player.position} ｜ ☀️ $${formatCurrency(player.payday)}</div>
    `;
    container.appendChild(row);
  });
}

function renderEventLog(container: HTMLElement, events: GameEvent[]): void {
  container.innerHTML = '';
  events
    .slice()
    .reverse()
    .forEach((event) => {
      const row = document.createElement('div');
      const timestamp = new Date(event.createdAt).toLocaleTimeString();
      row.innerHTML = `<time>${timestamp}</time><span>${event.message}</span>`;
      container.appendChild(row);
    });
}

export function createBoardScreen(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'screen board-screen';
  section.dataset.screen = 'ratRace';

  const title = document.createElement('h2');
  title.textContent = '回合控制板';

  const turnLabel = document.createElement('p');
  turnLabel.style.fontSize = '1.1rem';

  const boardLayout = document.createElement('div');
  boardLayout.className = 'board-layout';

  const playerCard = document.createElement('div');
  playerCard.className = 'board-card';
  const playerList = document.createElement('div');
  playerList.className = 'player-summary';
  playerCard.innerHTML = '<h3>玩家摘要</h3>';
  playerCard.appendChild(playerList);

  const controlCard = document.createElement('div');
  controlCard.className = 'board-card';
  controlCard.innerHTML = '<h3>动作</h3>';
  const rollButton = document.createElement('button');
  rollButton.className = 'primary-btn';
  rollButton.textContent = '掷骰';
  rollButton.addEventListener('click', () => {
    const total = rollDice(1);
    moveCurrentPlayer(total);
    update();
  });

  const endTurnButton = document.createElement('button');
  endTurnButton.className = 'secondary-btn';
  endTurnButton.textContent = '结束回合';
  endTurnButton.addEventListener('click', () => {
    advanceTurn();
    update();
  });

  const saveButton = document.createElement('button');
  saveButton.className = 'secondary-btn';
  saveButton.textContent = '保存进度';
  const saveStatus = document.createElement('p');
  saveStatus.style.margin = '0';
  saveStatus.style.color = '#475569';
  saveButton.addEventListener('click', () => {
    const result = saveGame();
    if (result.success) {
      saveStatus.style.color = '#16a34a';
      saveStatus.textContent = '进度已保存';
    } else if (result.reason === 'unavailable') {
      saveStatus.style.color = '#b91c1c';
      saveStatus.textContent = '无法保存：当前浏览器禁用了本地存储';
    } else {
      saveStatus.style.color = '#b91c1c';
      saveStatus.textContent = '保存失败，请稍后重试';
    }
  });

  const actionStack = document.createElement('div');
  actionStack.style.display = 'flex';
  actionStack.style.flexDirection = 'column';
  actionStack.style.gap = '0.75rem';
  actionStack.append(rollButton, endTurnButton, saveButton, saveStatus);
  controlCard.appendChild(actionStack);

  const logCard = document.createElement('div');
  logCard.className = 'board-card';
  logCard.innerHTML = '<h3>事件日志</h3>';
  const logList = document.createElement('div');
  logList.className = 'event-log';
  logCard.appendChild(logList);

  boardLayout.append(playerCard, controlCard, logCard);

  function update(): void {
    const state = rootStore.getState();
    const currentPlayer = getCurrentPlayer();
    turnLabel.textContent = state.turn.order.length
      ? `回合 ${state.turn.round} · 当前玩家：${currentPlayer?.name ?? '?'}`
      : '等待开始游戏';
    renderPlayerSummary(
      playerList,
      state.players.filter((player) => player.scenarioId)
    );
    renderEventLog(logList, state.eventLog);
  }

  update();
  rootStore.subscribe(() => update());

  section.append(title, turnLabel, boardLayout);
  return section;
}
