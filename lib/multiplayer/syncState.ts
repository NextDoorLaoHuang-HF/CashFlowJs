"use client";

import { useMultiplayerStore } from "./syncStore";
import { useGameStore } from "../state/gameStore";
import type { GameEngineState } from "../engine/types";
import type { GameSettings, Player } from "../types";

/**
 * Map a raw game_states row (from Supabase) into typed engine state,
 * then sync it into both multiplayerStore and gameStore.
 */
export function syncServerRecordToStores(record: Record<string, unknown>) {
  const serverState: Partial<GameEngineState> = {
    phase: record.phase as GameEngineState["phase"],
    players: record.players as Player[],
    currentPlayerId: record.current_player_id as string | null,
    turnState: record.turn_state as GameEngineState["turnState"],
    dice: record.dice as GameEngineState["dice"],
    selectedCard: record.selected_card as GameEngineState["selectedCard"],
    marketSession: record.market_session as GameEngineState["marketSession"],
    liquidationSession: record.liquidation_session as GameEngineState["liquidationSession"],
    charityPrompt: record.charity_prompt as GameEngineState["charityPrompt"],
    turn: record.turn as number,
    logs: record.logs as GameEngineState["logs"],
    settings: record.settings as GameSettings,
    rngSeed: record.rng_seed as number,
    rngState: record.rng_state as number,
    decks: record.decks as GameEngineState["decks"],
    discard: record.discard as GameEngineState["discard"],
    ventures: record.ventures as GameEngineState["ventures"],
    loans: record.loans as GameEngineState["loans"],
    history: record.history as GameEngineState["history"],
    replayFrames: record.replay_frames as GameEngineState["replayFrames"]
  };

  useMultiplayerStore.getState().syncState({
    phase: serverState.phase,
    players: serverState.players,
    currentPlayerId: serverState.currentPlayerId,
    turnState: serverState.turnState,
    dice: serverState.dice,
    selectedCard: serverState.selectedCard,
    marketSession: serverState.marketSession,
    liquidationSession: serverState.liquidationSession,
    charityPrompt: serverState.charityPrompt,
    turn: serverState.turn,
    logs: serverState.logs,
    settings: serverState.settings,
    version: record.version as number
  });

  useGameStore.getState().syncMultiplayerState(serverState);
}
