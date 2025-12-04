import { SCENARIOS } from '@/domain/scenarios';
import { startRatRace, setPlayerLimit, updatePlayer, rootStore } from '@/state/store';
import { PLAYER_COLORS, type Player } from '@/state/types';

function createOption(value: string, label: string): HTMLOptionElement {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function createPlayerRow(
  player: Player
): { element: HTMLElement; update: (player: Player) => void } {
  const row = document.createElement('div');
  row.className = 'player-row';

  const header = document.createElement('div');
  header.innerHTML = `<h4>玩家 ${player.slot}</h4>`;

  const nameLabel = document.createElement('label');
  nameLabel.innerHTML = `<h4>名称</h4>`;
  const nameInput = document.createElement('input');
  nameInput.placeholder = `Player ${player.slot}`;
  nameInput.value = player.name;
  nameInput.addEventListener('input', () => {
    updatePlayer(player.slot, { name: nameInput.value || `Player ${player.slot}` });
  });
  nameLabel.appendChild(nameInput);

  const scenarioLabel = document.createElement('label');
  scenarioLabel.innerHTML = `<h4>职业</h4>`;
  const scenarioSelect = document.createElement('select');
  scenarioSelect.appendChild(createOption('', '随机职业'));
  SCENARIOS.forEach((scenario) => {
    const option = createOption(
      scenario.id,
      `${scenario.title}: $${scenario.salary.toLocaleString()}`
    );
    scenarioSelect.appendChild(option);
  });
  scenarioSelect.value = player.scenarioId ?? '';
  scenarioSelect.addEventListener('change', () => {
    let value = scenarioSelect.value;
    if (!value) {
      const random = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
      value = random.id;
      scenarioSelect.value = value;
    }
    updatePlayer(player.slot, {
      scenarioId: value,
    });
  });
  scenarioLabel.appendChild(scenarioSelect);

  const colorLabel = document.createElement('label');
  colorLabel.innerHTML = `<h4>棋子颜色</h4>`;
  const colorSelect = document.createElement('select');
  PLAYER_COLORS.forEach((color) => {
    const option = createOption(color, color);
    colorSelect.appendChild(option);
  });
  colorSelect.value = player.color;
  colorSelect.addEventListener('change', () => {
    updatePlayer(player.slot, { color: colorSelect.value as typeof player.color });
  });
  colorLabel.appendChild(colorSelect);

  const insuranceLabel = document.createElement('label');
  insuranceLabel.innerHTML = `<h4>保险</h4>`;
  const insuranceInput = document.createElement('input');
  insuranceInput.type = 'checkbox';
  insuranceInput.checked = player.hasInsurance;
  insuranceInput.addEventListener('change', () => {
    updatePlayer(player.slot, { hasInsurance: insuranceInput.checked });
  });
  insuranceLabel.appendChild(insuranceInput);

  const summary = document.createElement('div');
  const salaryLine = document.createElement('div');
  const expensesLine = document.createElement('div');
  const paydayLine = document.createElement('div');
  summary.innerHTML = `
    <h4>概览</h4>
  `;
  salaryLine.textContent = `月薪：$${player.income.salary.toLocaleString()}`;
  expensesLine.textContent = `总支出：$${player.expenses.total.toLocaleString()}`;
  paydayLine.textContent = `发薪日现金流：$${player.payday.toLocaleString()}`;
  summary.append(salaryLine, expensesLine, paydayLine);

  row.append(header, nameLabel, scenarioLabel, colorLabel, insuranceLabel, summary);
  return {
    element: row,
    update(next: Player) {
      if (document.activeElement !== nameInput && nameInput.value !== next.name) {
        nameInput.value = next.name;
      }

      const nextScenarioId = next.scenarioId ?? '';
      if (scenarioSelect.value !== nextScenarioId) {
        scenarioSelect.value = nextScenarioId;
      }

      if (colorSelect.value !== next.color) {
        colorSelect.value = next.color;
      }

      if (insuranceInput.checked !== next.hasInsurance) {
        insuranceInput.checked = next.hasInsurance;
      }

      salaryLine.textContent = `月薪：$${next.income.salary.toLocaleString()}`;
      expensesLine.textContent = `总支出：$${next.expenses.total.toLocaleString()}`;
      paydayLine.textContent = `发薪日现金流：$${next.payday.toLocaleString()}`;
    },
  };
}

export function createPlayerSetupPanel(): HTMLElement {
  const wrapper = document.createElement('section');
  wrapper.className = 'screen setup-screen';
  wrapper.dataset.screen = 'setup';

  const title = document.createElement('h2');
  title.textContent = '玩家配置';

  const description = document.createElement('p');
  description.textContent = '为每位玩家选择职业与棋子颜色，准备进入老鼠赛跑。';

  const countRow = document.createElement('div');
  countRow.className = 'setup-actions';
  const countLabel = document.createElement('label');
  countLabel.textContent = '玩家数量 (1-8)：';
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.min = '1';
  countInput.max = '8';
  countInput.value = String(rootStore.getState().playerLimit);
  countInput.addEventListener('change', () => {
    const next = Number(countInput.value) || 1;
    setPlayerLimit(next);
  });
  countRow.append(countLabel, countInput);

  const playerList = document.createElement('div');
  playerList.className = 'player-form';
  const playerRows = new Map<number, ReturnType<typeof createPlayerRow>>();

  const errorBox = document.createElement('p');
  errorBox.style.color = '#dc2626';

  const startButton = document.createElement('button');
  startButton.className = 'primary-btn';
  startButton.textContent = '进入老鼠赛跑';
  startButton.addEventListener('click', () => {
    try {
      startRatRace();
      errorBox.textContent = '';
    } catch (error) {
      errorBox.textContent = error instanceof Error ? error.message : '无法开始游戏';
    }
  });

  function rebuildPlayers(players: Player[]): void {
    playerRows.clear();
    playerList.innerHTML = '';
    players.forEach((player) => {
      const row = createPlayerRow(player);
      playerRows.set(player.slot, row);
      playerList.appendChild(row.element);
    });
  }

  function syncPlayers(players: Player[]): void {
    if (players.length !== playerRows.size) {
      rebuildPlayers(players);
      return;
    }

    for (const player of players) {
      const row = playerRows.get(player.slot);
      if (!row) {
        rebuildPlayers(players);
        return;
      }
      row.update(player);
    }
  }

  let lastPlayers = rootStore.getState().players;
  rebuildPlayers(lastPlayers);
  rootStore.subscribe((state) => {
    countInput.value = String(state.playerLimit);
    if (state.players !== lastPlayers) {
      syncPlayers(state.players);
      lastPlayers = state.players;
    }
  });

  wrapper.append(title, description, countRow, playerList, errorBox, startButton);
  return wrapper;
}
