import { loadGame, clearSavedGame } from '@/domain/save';
import { createBoardScreen } from '@/ui/board';
import { createPlayerSetupPanel } from '@/ui/playerForm';
import { resetGame, rootStore, setPhase, startSetup } from '@/state/store';
import type { GamePhase } from '@/state/types';

function createHomeScreen(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'screen home-screen';
  section.dataset.screen = 'home';

  const title = document.createElement('h2');
  title.textContent = '欢迎来到 CashFlow Next';
  const subtitle = document.createElement('p');
  subtitle.textContent = '点击下方按钮开始新的财富冒险。';
  const button = document.createElement('button');
  button.className = 'primary-btn';
  button.textContent = '开始';
  button.addEventListener('click', () => {
    setPhase('selection');
  });

  section.append(title, subtitle, button);
  return section;
}

function createSelectionScreen(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'screen selection-screen';
  section.dataset.screen = 'selection';

  const title = document.createElement('h2');
  title.textContent = '选择你想进行的操作';
  const actions = document.createElement('div');
  actions.className = 'selection-actions';

  const newGame = document.createElement('button');
  newGame.className = 'primary-btn';
  newGame.textContent = '创建新游戏';
  newGame.addEventListener('click', () => {
    startSetup();
  });

  const loadBtn = document.createElement('button');
  loadBtn.className = 'secondary-btn';
  loadBtn.textContent = '载入最近存档';
  const banner = document.createElement('p');
  banner.style.color = '#475569';

  loadBtn.addEventListener('click', () => {
    const result = loadGame();
    if (result.success) {
      banner.textContent = '已加载存档';
    } else if (result.reason === 'unavailable') {
      banner.textContent = '当前浏览器禁用了本地存储，无法载入';
    } else if (result.reason === 'incompatible') {
      banner.textContent = '存档版本不兼容，请开始新游戏';
    } else if (result.reason === 'invalid') {
      banner.textContent = '存档数据损坏，载入失败';
    } else {
      banner.textContent = '没有可用的存档';
    }
  });

  const resetBtn = document.createElement('button');
  resetBtn.className = 'secondary-btn';
  resetBtn.textContent = '清除存档';
  resetBtn.addEventListener('click', () => {
    const result = clearSavedGame();
    if (!result.success) {
      banner.textContent = '无法清除存档：当前浏览器禁用了本地存储';
      return;
    }
    resetGame();
    setPhase('home');
    banner.textContent = '存档已清空';
  });

  actions.append(newGame, loadBtn, resetBtn);
  section.append(title, actions, banner);
  return section;
}

function setActiveScreen(screens: HTMLElement[], phase: GamePhase): void {
  screens.forEach((screen) => {
    if (phase === 'ratRace' || phase === 'fastTrack') {
      if (screen.dataset.screen === 'ratRace') {
        screen.classList.add('active');
      } else {
        screen.classList.remove('active');
      }
      return;
    }
    if (screen.dataset.screen === phase) {
      screen.classList.add('active');
    } else {
      screen.classList.remove('active');
    }
  });
}

export function renderApp(root: HTMLElement): void {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const header = document.createElement('header');
  const heading = document.createElement('h1');
  heading.textContent = 'CashFlow Next';
  const versionTag = document.createElement('span');
  versionTag.textContent = 'Phase 1';
  versionTag.style.color = '#6366f1';
  header.append(heading, versionTag);

  const screens = [
    createHomeScreen(),
    createSelectionScreen(),
    createPlayerSetupPanel(),
    createBoardScreen(),
  ];
  setActiveScreen(screens, rootStore.getState().phase);
  rootStore.subscribe((state) => setActiveScreen(screens, state.phase));

  shell.append(header, ...screens);
  root.innerHTML = '';
  root.appendChild(shell);
}
