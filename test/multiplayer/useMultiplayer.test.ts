import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMultiplayer } from "@/lib/multiplayer/useMultiplayer";

const mockSubscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
const mockChannel = {
  on: vi.fn(() => mockChannel),
  subscribe: mockSubscribe
};
const mockRemoveChannel = vi.fn();
const mockSupabaseClient = {
  channel: vi.fn(() => mockChannel),
  removeChannel: mockRemoveChannel
};

const mockGetRoomState = vi.fn();
const mockSubmitAction = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabaseClient
}));

vi.mock("@/app/actions/roomActions", () => ({
  getRoomState: (...args: any[]) => mockGetRoomState(...args)
}));

vi.mock("@/app/actions/gameActions", () => ({
  submitAction: (...args: any[]) => mockSubmitAction(...args)
}));

vi.mock("@/lib/multiplayer/syncState", () => ({
  syncServerRecordToStores: vi.fn()
}));

import { useMultiplayerStore } from "@/lib/multiplayer/syncStore";

describe("useMultiplayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMultiplayerStore.getState().clearRoom();
  });

  it("does nothing when roomId is null", () => {
    const { result } = renderHook(() => useMultiplayer());
    expect(mockSupabaseClient.channel).not.toHaveBeenCalled();
    expect(result.current.isMyTurn).toBe(false);
  });

  it("subscribes to realtime channel when roomId is set", async () => {
    useMultiplayerStore.getState().setRoom("room-1", "ABCD", "user-1", 0, true);
    mockGetRoomState.mockResolvedValue({});

    renderHook(() => useMultiplayer());

    await waitFor(() => {
      expect(mockGetRoomState).toHaveBeenCalledWith("room-1");
    });
    expect(mockSupabaseClient.channel).toHaveBeenCalledWith("game_state:room-1");
    expect(mockChannel.on).toHaveBeenCalledTimes(2);
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it("unsubscribes on unmount", async () => {
    useMultiplayerStore.getState().setRoom("room-1", "ABCD", "user-1", 0, true);
    mockGetRoomState.mockResolvedValue({});

    const { unmount } = renderHook(() => useMultiplayer());
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  it("sendAction returns early when not connected", async () => {
    const { result } = renderHook(() => useMultiplayer());
    await result.current.sendAction({ type: "rollDice" } as any);
    expect(useMultiplayerStore.getState().error).toBe("Not connected to a room");
  });

  it("sendAction submits and marks action sent on success", async () => {
    useMultiplayerStore.getState().setRoom("room-1", "ABCD", "user-1", 0, true);
    mockGetRoomState.mockResolvedValue({});
    mockSubmitAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useMultiplayer());
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());

    await result.current.sendAction({ type: "rollDice" } as any);
    expect(mockSubmitAction).toHaveBeenCalledWith("room-1", "user-1", { type: "rollDice" }, 0);
    expect(useMultiplayerStore.getState().isLoading).toBe(false);
  });

  it("sendAction handles conflict and retries once", async () => {
    useMultiplayerStore.getState().setRoom("room-1", "ABCD", "user-1", 0, true);
    mockGetRoomState.mockResolvedValue({});
    mockSubmitAction
      .mockResolvedValueOnce({ success: false, conflict: true, currentState: {} })
      .mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useMultiplayer());
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());

    await result.current.sendAction({ type: "rollDice" } as any);
    expect(mockSubmitAction).toHaveBeenCalledTimes(2);
  });

  it("sendAction sets error on failure after retry", async () => {
    useMultiplayerStore.getState().setRoom("room-1", "ABCD", "user-1", 0, true);
    mockGetRoomState.mockResolvedValue({});
    mockSubmitAction.mockResolvedValue({ success: false, conflict: true });

    const { result } = renderHook(() => useMultiplayer());
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());

    await result.current.sendAction({ type: "rollDice" } as any);
    expect(useMultiplayerStore.getState().error).toContain("conflict");
  });

  it("isMyTurn is true when current player matches slot", async () => {
    useMultiplayerStore.getState().setRoom("room-1", "ABCD", "user-1", 0, true);
    useMultiplayerStore.getState().syncState({
      players: [{ id: "user-1", name: "Alice", color: "#f00" }],
      currentPlayerId: "user-1"
    });
    mockGetRoomState.mockResolvedValue({});

    const { result } = renderHook(() => useMultiplayer());
    expect(result.current.isMyTurn).toBe(true);
  });

  it("isMyTurn is false when current player does not match", async () => {
    useMultiplayerStore.getState().setRoom("room-1", "ABCD", "user-1", 0, true);
    useMultiplayerStore.getState().syncState({
      players: [{ id: "user-1", name: "Alice", color: "#f00" }],
      currentPlayerId: "other"
    });
    mockGetRoomState.mockResolvedValue({});

    const { result } = renderHook(() => useMultiplayer());
    expect(result.current.isMyTurn).toBe(false);
  });
});
