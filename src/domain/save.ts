import { createDraftPlayer, ensurePlayerSlots } from '@/domain/players';
import { events } from '@/state/events';
import { createInitialState, logEvent, normalizePlayerLimit, rootStore } from '@/state/store';
import type { Player, RootState } from '@/state/types';

const SAVE_VERSION = 1;
const SAVE_KEY = `cashflow:save:v${SAVE_VERSION}`;

interface PersistedState {
  version: number;
  snapshot: RootState;
  timestamp: number;
}

type SaveResultReason = 'unavailable' | 'missing' | 'invalid' | 'incompatible' | 'failed';

export interface SaveResult {
  success: boolean;
  reason?: SaveResultReason;
}

function getStorage(): Storage | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    // Touching localStorage can throw in restricted contexts (Safari private mode, WebViews).
    localStorage.getItem('__cashflow:probe__');
    return localStorage;
  } catch (error) {
    console.warn('Local storage unavailable', error);
    return null;
  }
}

function safeParse(raw: string): PersistedState | null {
  try {
    const payload = JSON.parse(raw) as PersistedState;
    const snapshot = payload?.snapshot as RootState | null;
    if (
      typeof payload === 'object' &&
      payload !== null &&
      typeof payload.version === 'number' &&
      typeof payload.timestamp === 'number' &&
      snapshot !== null &&
      typeof snapshot === 'object' &&
      !Array.isArray(snapshot)
    ) {
      return payload;
    }
  } catch (error) {
    console.error('Failed to parse saved game', error);
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergePlayerSection<T extends Record<string, number>>(defaults: T, patch: unknown): T {
  if (!isRecord(patch)) {
    return defaults;
  }
  return { ...defaults, ...(patch as Partial<T>) };
}

function mergePersistedPlayer(raw: unknown, fallbackSlot: number): Player | null {
  if (!isRecord(raw)) {
    return null;
  }
  const persisted = raw as Partial<Player>;
  const slotValue =
    typeof persisted.slot === 'number' && Number.isFinite(persisted.slot)
      ? Math.trunc(persisted.slot)
      : fallbackSlot;
  const slot = Math.max(1, slotValue);
  const draft = createDraftPlayer(slot);
  const merged: Player = {
    ...draft,
    ...persisted,
    slot,
  } as Player;
  return {
    ...merged,
    income: mergePlayerSection(draft.income, persisted.income),
    expenses: mergePlayerSection(draft.expenses, persisted.expenses),
    loans: mergePlayerSection(draft.loans, persisted.loans),
  };
}

function sanitizePlayers(rawPlayers: unknown, limit: number): Player[] {
  if (!Array.isArray(rawPlayers)) {
    return ensurePlayerSlots([], limit);
  }
  const normalizedPlayers = rawPlayers
    .map((player, index) => mergePersistedPlayer(player, index + 1))
    .filter((player): player is Player => !!player);
  return ensurePlayerSlots(normalizedPlayers, limit);
}

function hydrateState(snapshot: RootState): RootState {
  const fallbackLimit = rootStore.getState().playerLimit;
  const limitCandidate =
    typeof snapshot.playerLimit === 'number' && Number.isFinite(snapshot.playerLimit)
      ? snapshot.playerLimit
      : fallbackLimit;
  const playerLimit = normalizePlayerLimit(limitCandidate);
  const defaults = createInitialState(playerLimit);

  return {
    ...defaults,
    ...snapshot,
    playerLimit,
    turn: {
      ...defaults.turn,
      ...(snapshot.turn ?? {}),
    },
    decks: snapshot.decks ?? defaults.decks,
    players: sanitizePlayers(snapshot.players, playerLimit),
    eventLog: Array.isArray(snapshot.eventLog) ? snapshot.eventLog : defaults.eventLog,
  };
}

function safeSetItem(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    console.error('Failed to persist state', error);
    return false;
  }
}

function safeGetItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch (error) {
    console.error('Failed to read saved state', error);
    return null;
  }
}

function safeRemoveItem(storage: Storage, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Failed to clear saved state', error);
    return false;
  }
}

export function saveGame(): SaveResult {
  const storage = getStorage();
  if (!storage) {
    logEvent('state.save.failed', '当前环境无法使用本地存储，保存失败');
    return { success: false, reason: 'unavailable' };
  }

  const snapshot = rootStore.getState();
  const payload: PersistedState = {
    version: SAVE_VERSION,
    snapshot,
    timestamp: Date.now(),
  };

  const persisted = safeSetItem(storage, SAVE_KEY, JSON.stringify(payload));
  if (!persisted) {
    logEvent('state.save.failed', '无法写入存档，本地存储被禁用或已满');
    return { success: false, reason: 'failed' };
  }

  events.emit('state:saved', {
    playerCount: snapshot.players.length,
    round: snapshot.turn.round,
  });
  logEvent('state.saved', '游戏进度已保存', {
    playerCount: snapshot.players.length,
    round: snapshot.turn.round,
  });
  return { success: true };
}

export function loadGame(): SaveResult {
  const storage = getStorage();
  if (!storage) {
    logEvent('state.load.failed', '当前环境无法使用本地存储，载入失败');
    return { success: false, reason: 'unavailable' };
  }
  const raw = safeGetItem(storage, SAVE_KEY);
  if (!raw) {
    return { success: false, reason: 'missing' };
  }
  const payload = safeParse(raw);
  if (!payload) {
    logEvent('state.load.failed', '存档数据已损坏，无法载入');
    return { success: false, reason: 'invalid' };
  }
  if (payload.version !== SAVE_VERSION) {
    logEvent('state.load.failed', '存档版本不兼容，请开始新游戏');
    return { success: false, reason: 'incompatible' };
  }

  const hydrated = hydrateState(payload.snapshot);
  rootStore.setState(hydrated, true);
  events.emit('state:loaded', {
    playerCount: hydrated.players.length,
    round: hydrated.turn.round,
  });
  logEvent('state.loaded', '已加载上次保存的进度', {
    savedAt: payload.timestamp,
  });
  return { success: true };
}

export function clearSavedGame(): SaveResult {
  const storage = getStorage();
  if (!storage) {
    logEvent('state.clear.failed', '当前环境无法使用本地存储，无法清除存档');
    return { success: false, reason: 'unavailable' };
  }
  const cleared = safeRemoveItem(storage, SAVE_KEY);
  if (!cleared) {
    logEvent('state.clear.failed', '无法删除存档，本地存储受限');
    return { success: false, reason: 'failed' };
  }
  logEvent('state.cleared', '已删除保存的进度');
  return { success: true };
}
