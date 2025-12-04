import { createStore } from 'zustand/vanilla';
import { buildDecks } from '@/domain/cards';
import { applyPlayerPatch, ensurePlayerSlots } from '@/domain/players';
import { events } from './events';
import type { GameEvent, GamePhase, Player, PlayerColor, RootState } from './types';

export const DEFAULT_PLAYER_LIMIT = 4;

export function normalizePlayerLimit(limit: number): number {
  return Math.min(Math.max(1, Math.trunc(limit)), 8);
}

export function createInitialState(playerLimit = DEFAULT_PLAYER_LIMIT): RootState {
  return {
    phase: 'home',
    playerLimit,
    players: ensurePlayerSlots([], playerLimit),
    decks: buildDecks(),
    turn: {
      order: [],
      currentIndex: 0,
      round: 1,
    },
    eventLog: [],
  };
}

export const rootStore = createStore<RootState>(() => createInitialState());

function buildTurnOrder(players: Player[]): string[] {
  return players
    .filter((player) => player.status === 'active' && !!player.scenarioId)
    .map((player) => player.id);
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function logEvent(type: string, message: string, payload?: Record<string, unknown>): void {
  const entry: GameEvent = {
    id: createEventId(),
    type,
    message,
    payload,
    createdAt: Date.now(),
  };
  rootStore.setState((state) => ({
    ...state,
    eventLog: [...state.eventLog.slice(-49), entry],
  }));
  events.emit('log:appended', entry);
}

export function setPhase(phase: GamePhase): void {
  rootStore.setState((state) => ({
    ...state,
    phase,
  }));
  events.emit('phase:changed', phase);
  logEvent('phase.changed', `阶段切换至 ${phase}`, { phase });
}

export function resetGame(): void {
  const { playerLimit } = rootStore.getState();
  rootStore.setState(createInitialState(playerLimit), true);
  logEvent('state.reset', '已回到初始状态');
}

export function setPlayerLimit(limit: number): void {
  const normalized = normalizePlayerLimit(limit);
  rootStore.setState((state) => ({
    ...state,
    playerLimit: normalized,
    players: ensurePlayerSlots(state.players, normalized),
  }));
  logEvent('player.limit', '更新玩家人数', { limit: normalized });
}

export function updatePlayer(
  slot: number,
  patch: { name?: string; color?: PlayerColor; scenarioId?: string | null; hasInsurance?: boolean }
): void {
  rootStore.setState((state) => ({
    ...state,
    players: state.players.map((player) =>
      player.slot === slot ? applyPlayerPatch(player, patch) : player
    ),
  }));
  const player = rootStore.getState().players.find((p) => p.slot === slot);
  if (player) {
    events.emit('player:updated', player);
    logEvent('player.updated', `${player.name} 已更新`, {
      slot: player.slot,
      scenarioId: player.scenarioId,
    });
  }
}

export function startSetup(): void {
  resetGame();
  setPhase('setup');
}

export function startRatRace(): void {
  const state = rootStore.getState();
  const readyPlayers = state.players.filter((player) => player.scenarioId);
  if (!readyPlayers.length) {
    throw new Error('至少需要一位玩家才可开始游戏');
  }
  rootStore.setState((prev) => ({
    ...prev,
    phase: 'ratRace',
    turn: {
      order: buildTurnOrder(prev.players),
      currentIndex: 0,
      round: 1,
    },
  }));
  events.emit('phase:changed', 'ratRace');
  logEvent('game.start', `老鼠赛跑开始（${readyPlayers.length} 位玩家）`, {
    players: readyPlayers.map((player) => player.id),
  });
}

export function getActivePlayers(): Player[] {
  return rootStore.getState().players.filter((player) => player.status === 'active');
}

export function getCurrentState(): RootState {
  return rootStore.getState();
}
