import { describe, expect, it, beforeEach } from "vitest";
import { useMultiplayerStore } from "@/lib/multiplayer/syncStore";

describe("useMultiplayerStore", () => {
  beforeEach(() => {
    useMultiplayerStore.getState().clearRoom();
  });

  it("has correct initial state", () => {
    const s = useMultiplayerStore.getState();
    expect(s.roomId).toBeNull();
    expect(s.roomCode).toBeNull();
    expect(s.userId).toBeNull();
    expect(s.playerSlot).toBeNull();
    expect(s.isHost).toBe(false);
    expect(s.phase).toBe("setup");
    expect(s.players).toEqual([]);
    expect(s.currentPlayerId).toBeNull();
    expect(s.turnState).toBe("awaitRoll");
    expect(s.turn).toBe(0);
    expect(s.logs).toEqual([]);
    expect(s.stateVersion).toBe(0);
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.lastActionTimestamp).toBe(0);
  });

  it("setRoom updates connection fields", () => {
    useMultiplayerStore.getState().setRoom("room-1", "ABCD", "user-1", 2, true);
    const s = useMultiplayerStore.getState();
    expect(s.roomId).toBe("room-1");
    expect(s.roomCode).toBe("ABCD");
    expect(s.userId).toBe("user-1");
    expect(s.playerSlot).toBe(2);
    expect(s.isHost).toBe(true);
  });

  it("clearRoom resets to initial state", () => {
    useMultiplayerStore.getState().setRoom("room-1", "ABCD", "user-1", 2, true);
    useMultiplayerStore.getState().syncState({ phase: "ratRace", turn: 5 });
    useMultiplayerStore.getState().clearRoom();
    const s = useMultiplayerStore.getState();
    expect(s.roomId).toBeNull();
    expect(s.phase).toBe("setup");
    expect(s.turn).toBe(0);
    expect(s.players).toEqual([]);
  });

  it("syncState merges partial updates", () => {
    useMultiplayerStore.getState().syncState({
      phase: "ratRace",
      players: [{ id: "p1", name: "Alice", color: "#f00" } as any],
      turn: 3,
      version: 7
    });
    const s = useMultiplayerStore.getState();
    expect(s.phase).toBe("ratRace");
    expect(s.players).toHaveLength(1);
    expect(s.turn).toBe(3);
    expect(s.stateVersion).toBe(7);
    // Unchanged fields keep defaults
    expect(s.turnState).toBe("awaitRoll");
  });

  it("syncState preserves existing values when field omitted", () => {
    useMultiplayerStore.getState().syncState({ turn: 5 });
    useMultiplayerStore.getState().syncState({ phase: "fastTrack" });
    const s = useMultiplayerStore.getState();
    expect(s.turn).toBe(5);
    expect(s.phase).toBe("fastTrack");
  });

  it("setLoading and setError update UI state", () => {
    useMultiplayerStore.getState().setLoading(true);
    expect(useMultiplayerStore.getState().isLoading).toBe(true);

    useMultiplayerStore.getState().setError("Connection lost");
    expect(useMultiplayerStore.getState().error).toBe("Connection lost");

    useMultiplayerStore.getState().setError(null);
    expect(useMultiplayerStore.getState().error).toBeNull();
  });

  it("markActionSent updates lastActionTimestamp", () => {
    const before = useMultiplayerStore.getState().lastActionTimestamp;
    useMultiplayerStore.getState().markActionSent();
    const after = useMultiplayerStore.getState().lastActionTimestamp;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});
