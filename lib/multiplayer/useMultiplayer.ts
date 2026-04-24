"use client";

import { useEffect, useCallback } from "react";
import { useMultiplayerStore } from "./syncStore";
import { createClient } from "../supabase/client";
import { submitAction } from "../../app/actions/gameActions";
import type { GameAction } from "../engine/gameEngine";
import type { GameEngineState } from "../engine/gameEngine";
import type { GameSettings, Player } from "../types";

export function useMultiplayer() {
  const roomId = useMultiplayerStore((s) => s.roomId);
  const userId = useMultiplayerStore((s) => s.userId);
  const stateVersion = useMultiplayerStore((s) => s.stateVersion);
  const playerSlot = useMultiplayerStore((s) => s.playerSlot);
  const currentPlayerId = useMultiplayerStore((s) => s.currentPlayerId);
  const players = useMultiplayerStore((s) => s.players);

  // Subscribe to Postgres Changes for state sync
  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`game_state:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_states",
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          const newRecord = payload.new as Record<string, unknown>;
          useMultiplayerStore.getState().syncState({
            phase: newRecord.phase as GameEngineState["phase"],
            players: newRecord.players as Player[],
            currentPlayerId: newRecord.current_player_id as string | null,
            turnState: newRecord.turn_state as GameEngineState["turnState"],
            dice: newRecord.dice as GameEngineState["dice"],
            selectedCard: newRecord.selected_card as GameEngineState["selectedCard"],
            marketSession: newRecord.market_session as GameEngineState["marketSession"],
            liquidationSession: newRecord.liquidation_session as GameEngineState["liquidationSession"],
            charityPrompt: newRecord.charity_prompt as GameEngineState["charityPrompt"],
            turn: newRecord.turn as number,
            logs: newRecord.logs as GameEngineState["logs"],
            settings: newRecord.settings as GameSettings,
            version: (newRecord.version as number) ?? stateVersion
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, stateVersion]);

  const sendAction = useCallback(
    async (action: GameAction, retryCount = 0) => {
      if (!roomId || !userId) {
        useMultiplayerStore.getState().setError("Not connected to a room");
        return;
      }

      const store = useMultiplayerStore.getState();
      store.setLoading(true);
      store.setError(null);

      try {
        const result = await submitAction(roomId, userId, action, store.stateVersion);

        if (!result.success && "conflict" in result && result.conflict) {
          if (result.currentState) {
            store.syncState(result.currentState as Parameters<typeof store.syncState>[0]);
          }
          if (retryCount < 1) {
            // Auto-retry once after syncing latest state
            store.setError("State updated, retrying...");
            await sendAction(action, retryCount + 1);
            return;
          }
          store.setError("Action conflict - state has changed. Please retry.");
        } else if (result.success) {
          store.markActionSent();
          if (result.state) {
            store.syncState(result.state as Parameters<typeof store.syncState>[0]);
          }
        }
      } catch (err) {
        store.setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        store.setLoading(false);
      }
    },
    [roomId, userId]
  );

  const isMyTurn = currentPlayerId !== null && players[playerSlot ?? -1]?.id === currentPlayerId;

  return {
    sendAction,
    isMyTurn
  };
}
