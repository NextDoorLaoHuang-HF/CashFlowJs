import { events } from '@/state/events';
import { rootStore, logEvent } from '@/state/store';
import type { Player } from '@/state/types';
import { RAT_RACE_SPACES } from './players';

export function buildTurnOrder(players: Player[]): string[] {
  return players
    .filter((player) => player.status === 'active' && !!player.scenarioId)
    .map((player) => player.id);
}

export function getCurrentPlayer(): Player | undefined {
  const state = rootStore.getState();
  const playerId = state.turn.order[state.turn.currentIndex];
  return state.players.find((player) => player.id === playerId);
}

export function rebuildTurnOrder(): void {
  rootStore.setState((state) => ({
    ...state,
    turn: {
      order: buildTurnOrder(state.players),
      currentIndex: 0,
      round: 1,
    },
  }));
  events.emit('turn:advanced', rootStore.getState().turn);
}

export function advanceTurn(): void {
  rootStore.setState((state) => {
    if (!state.turn.order.length) {
      return state;
    }
    const nextIndex = (state.turn.currentIndex + 1) % state.turn.order.length;
    const nextRound = nextIndex === 0 ? state.turn.round + 1 : state.turn.round;
    return {
      ...state,
      turn: {
        ...state.turn,
        currentIndex: nextIndex,
        round: nextRound,
      },
    };
  });
  const active = getCurrentPlayer();
  events.emit('turn:advanced', rootStore.getState().turn);
  logEvent('turn.advance', `轮到 ${active?.name ?? '未知玩家'}`, {
    playerId: active?.id ?? null,
    round: rootStore.getState().turn.round,
  });
}

export function rollDice(count = 1): number {
  const dice: number[] = [];
  for (let i = 0; i < count; i += 1) {
    dice.push(Math.floor(Math.random() * 6) + 1);
  }
  const total = dice.reduce((acc, value) => acc + value, 0);
  logEvent('dice.rolled', `骰子结果 ${dice.join(' + ')} = ${total}`, { dice, total });
  return total;
}

export function moveCurrentPlayer(spaces: number): void {
  const state = rootStore.getState();
  if (!state.turn.order.length) {
    return;
  }
  const playerId = state.turn.order[state.turn.currentIndex];
  rootStore.setState((prev) => ({
    ...prev,
    players: prev.players.map((player) => {
      if (player.id !== playerId) {
        return player;
      }
      const position = (player.position + spaces + RAT_RACE_SPACES) % RAT_RACE_SPACES;
      return {
        ...player,
        position,
        lastRoll: spaces,
      };
    }),
  }));
  const updated = getCurrentPlayer();
  logEvent('player.moved', `${updated?.name ?? '玩家'} 前进 ${spaces} 格`, {
    playerId,
    position: updated?.position ?? null,
  });
}
