"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { applyAction, type GameAction, type GameEngineState } from "@/lib/engine/gameEngine";
import { toSignedInt32, toUnsignedInt32 } from "@/lib/utils/intConverter";

export async function submitAction(
  roomId: string,
  userId: string,
  action: GameAction,
  expectedVersion: number
) {
  const supabase = createAdminClient();

  // Load current game state
  const { data: gameState, error: loadError } = await supabase
    .from("game_states")
    .select("*")
    .eq("room_id", roomId)
    .single();

  if (loadError || !gameState) {
    throw new Error("Game state not found");
  }

  // Optimistic lock check
  if (gameState.version !== expectedVersion) {
    // eslint-disable-next-line no-console
    console.warn("[submitAction] Version conflict", { roomId, userId, action: action.type, expectedVersion, actualVersion: gameState.version });
    return {
      success: false,
      conflict: true,
      currentVersion: gameState.version,
      currentState: gameState
    };
  }

  // Verify it's the player's turn (for actions that require turn)
  const needsTurn = !["initGame"].includes(action.type);
  if (needsTurn) {
    const { data: roomPlayer } = await supabase
      .from("room_players")
      .select("player_slot")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (!roomPlayer) {
      throw new Error("Player not found in room");
    }

    // Strict turn validation: map user_id -> player_slot -> game player index
    const gamePlayers = gameState.players as Array<{ id: string }>;
    const currentPlayerId = gameState.current_player_id as string | null;
    const expectedPlayer = gamePlayers[roomPlayer.player_slot];
    if (!expectedPlayer || expectedPlayer.id !== currentPlayerId) {
      throw new Error("Not your turn");
    }
  }

  // Deserialize state
  const state: GameEngineState = {
    phase: gameState.phase,
    players: gameState.players,
    currentPlayerId: gameState.current_player_id,
    turnState: gameState.turn_state,
    rngSeed: toUnsignedInt32(gameState.rng_seed),
    rngState: toUnsignedInt32(gameState.rng_state),
    decks: gameState.decks,
    discard: gameState.discard,
    selectedCard: gameState.selected_card,
    marketSession: gameState.market_session,
    liquidationSession: gameState.liquidation_session,
    dice: gameState.dice,
    turn: gameState.turn,
    logs: gameState.logs,
    replayFrames: gameState.replay_frames,
    ventures: gameState.ventures,
    loans: gameState.loans,
    settings: gameState.settings,
    history: gameState.history,
    charityPrompt: gameState.charity_prompt
  };

  // Apply action
  const result = applyAction(state, action);

  // Save new state
  const newVersion = (gameState.version ?? 0) + 1;
  const { error: saveError } = await supabase
    .from("game_states")
    .update({
      phase: result.state.phase,
      turn_state: result.state.turnState,
      current_player_id: result.state.currentPlayerId,
      turn: result.state.turn,
      players: result.state.players,
      decks: result.state.decks,
      discard: result.state.discard,
      selected_card: result.state.selectedCard,
      market_session: result.state.marketSession,
      liquidation_session: result.state.liquidationSession,
      dice: result.state.dice,
      logs: [...result.state.logs, ...result.logs],
      replay_frames: [...result.state.replayFrames, ...result.frames],
      ventures: result.state.ventures,
      loans: result.state.loans,
      settings: result.state.settings,
      history: result.state.history,
      charity_prompt: result.state.charityPrompt,
      rng_seed: toSignedInt32(result.state.rngSeed),
      rng_state: toSignedInt32(result.state.rngState),
      version: newVersion,
      updated_at: new Date().toISOString()
    })
    .eq("room_id", roomId)
    .eq("version", expectedVersion);

  if (saveError) {
    // Check if it was a version conflict
    if (saveError.message?.includes("version")) {
      const { data: current } = await supabase
        .from("game_states")
        .select("*")
        .eq("room_id", roomId)
        .single();
      return {
        success: false,
        conflict: true,
        currentVersion: current?.version,
        currentState: current
      };
    }
    throw saveError;
  }

  // Log action
  await supabase.from("game_actions").insert({
    room_id: roomId,
    user_id: userId,
    action_type: action.type,
    payload: action,
    resulting_state_version: newVersion
  });

  // Broadcast state update via Realtime
  // This is done client-side via channel broadcast after successful action
  // Server Actions can't directly trigger Realtime broadcasts easily
  // Alternative: clients subscribe to Postgres Changes on game_states table

  return {
    success: true,
    version: newVersion,
    state: result.state,
    logs: result.logs,
    frames: result.frames
  };
}

export async function getGameState(roomId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("game_states")
    .select("*")
    .eq("room_id", roomId)
    .single();

  if (error) throw error;
  return data;
}
