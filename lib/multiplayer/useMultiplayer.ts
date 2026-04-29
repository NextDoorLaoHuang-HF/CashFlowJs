"use client";

import { useEffect, useCallback } from "react";
import { useMultiplayerStore } from "./syncStore";
import { createClient } from "../supabase/client";
import { submitAction } from "../../app/actions/gameActions";
import { getRoomState } from "../../app/actions/roomActions";
import { syncServerRecordToStores } from "./syncState";
import type { GameAction } from "../engine/gameEngine";

export async function sendGameAction(action: GameAction, retryCount = 0) {
  const store = useMultiplayerStore.getState();
  const { roomId, userId } = store;
  if (!roomId || !userId) {
    store.setError("Not connected to a room");
    return;
  }

  store.setLoading(true);
  store.setError(null);

  try {
    const result = await submitAction(roomId, userId, action, store.stateVersion);

    if (!result.success && "conflict" in result && result.conflict) {
      if (result.currentState) {
        syncServerRecordToStores(result.currentState as Record<string, unknown>);
      }
      if (retryCount < 1) {
        // Auto-retry once after syncing latest state
        store.setError("State updated, retrying...");
        await sendGameAction(action, retryCount + 1);
        return;
      }
      store.setError("Action conflict - state has changed. Please retry.");
    } else if (result.success) {
      store.markActionSent();
      if (result.state) {
        syncServerRecordToStores({ ...result.state, version: result.version } as unknown as Record<string, unknown>);
      }
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Unknown error");
  } finally {
    store.setLoading(false);
  }
}

export function useMultiplayer() {
  const roomId = useMultiplayerStore((s) => s.roomId);
  const userId = useMultiplayerStore((s) => s.userId);
  const currentPlayerId = useMultiplayerStore((s) => s.currentPlayerId);
  const playerSlot = useMultiplayerStore((s) => s.playerSlot);
  const players = useMultiplayerStore((s) => s.players);

  // Initial fetch + Realtime subscription for state sync
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    // 1. Initial load: pull current game state immediately so we don't miss
    //    events that fired before the channel was fully subscribed.
    const loadInitial = async () => {
      try {
        const state = await getRoomState(roomId);
        if (cancelled) return;
        if (state.gameState) {
          syncServerRecordToStores(state.gameState as Record<string, unknown>);
        }
      } catch (err) {
        console.error("[useMultiplayer] Initial state load failed:", err);
      }
    };

    loadInitial();

    // 2. Polling fallback (every 3s) for environments where Realtime is not available.
    //    Uses recursive setTimeout so requests never overlap.
    let timeoutId: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await loadInitial();
      if (!cancelled) timeoutId = setTimeout(poll, 3000);
    };
    timeoutId = setTimeout(poll, 3000);

    // 3. Realtime subscription for subsequent updates
    const supabase = createClient();
    const channel = supabase
      .channel(`game_state:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_states",
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log("[useMultiplayer] game_states INSERT received");
          syncServerRecordToStores(payload.new as Record<string, unknown>);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_states",
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log("[useMultiplayer] game_states UPDATE received");
          syncServerRecordToStores(payload.new as Record<string, unknown>);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const sendAction = useCallback(
    async (action: GameAction) => {
      await sendGameAction(action);
    },
    []
  );

  const isMyTurn = currentPlayerId !== null && players[playerSlot ?? -1]?.id === currentPlayerId;

  return {
    sendAction,
    isMyTurn
  };
}
