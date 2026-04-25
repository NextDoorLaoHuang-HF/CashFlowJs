import { describe, expect, it, vi, beforeEach } from "vitest";
import { syncServerRecordToStores } from "@/lib/multiplayer/syncState";

const mockSyncMultiplayerState = vi.fn();
const mockSyncState = vi.fn();

vi.mock("@/lib/multiplayer/syncStore", () => ({
  useMultiplayerStore: {
    getState: () => ({
      syncState: mockSyncState
    })
  }
}));

vi.mock("@/lib/state/gameStore", () => ({
  useGameStore: {
    getState: () => ({
      syncMultiplayerState: mockSyncMultiplayerState
    })
  }
}));

describe("syncServerRecordToStores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps snake_case record to typed state and syncs both stores", () => {
    const record = {
      phase: "ratRace",
      players: [{ id: "p1", name: "Alice" }],
      current_player_id: "p1",
      turn_state: "awaitAction",
      dice: [3, 4],
      selected_card: { id: "c1" },
      market_session: null,
      liquidation_session: undefined,
      charity_prompt: false,
      turn: 5,
      logs: [{ id: "l1" }],
      settings: { locale: "zh" },
      rng_seed: 123,
      rng_state: 456,
      decks: { smallDeals: [] },
      discard: { smallDeals: [] },
      ventures: [],
      loans: [],
      history: [],
      replay_frames: [],
      version: 7
    };

    syncServerRecordToStores(record as Record<string, unknown>);

    expect(mockSyncState).toHaveBeenCalledTimes(1);
    const synced = mockSyncState.mock.calls[0][0];
    expect(synced.phase).toBe("ratRace");
    expect(synced.players).toEqual([{ id: "p1", name: "Alice" }]);
    expect(synced.currentPlayerId).toBe("p1");
    expect(synced.turnState).toBe("awaitAction");
    expect(synced.dice).toEqual([3, 4]);
    expect(synced.selectedCard).toEqual({ id: "c1" });
    expect(synced.turn).toBe(5);
    expect(synced.logs).toEqual([{ id: "l1" }]);
    expect(synced.settings).toEqual({ locale: "zh" });
    expect(synced.version).toBe(7);

    expect(mockSyncMultiplayerState).toHaveBeenCalledTimes(1);
    const engineState = mockSyncMultiplayerState.mock.calls[0][0];
    expect(engineState.phase).toBe("ratRace");
    expect(engineState.players).toEqual([{ id: "p1", name: "Alice" }]);
    expect(engineState.rngSeed).toBe(123);
    expect(engineState.rngState).toBe(456);
    expect(engineState.decks).toEqual({ smallDeals: [] });
    expect(engineState.replayFrames).toEqual([]);
  });

  it("handles minimal record with only required fields", () => {
    const record = {
      phase: "setup",
      players: [],
      current_player_id: null,
      turn_state: "awaitRoll",
      turn: 0,
      logs: [],
      settings: { locale: "zh" },
      version: 0
    };

    syncServerRecordToStores(record as Record<string, unknown>);

    expect(mockSyncState).toHaveBeenCalledTimes(1);
    expect(mockSyncMultiplayerState).toHaveBeenCalledTimes(1);
  });
});
