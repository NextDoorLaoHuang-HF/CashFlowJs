"use server";

import { createAdminClient } from "@/lib/supabase/server";
import type { GameSettings } from "@/lib/types";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createRoom(hostId: string, settings?: Partial<GameSettings>) {
  const supabase = createAdminClient();

  const code = generateRoomCode();
  const { data: room, error } = await supabase
    .from("rooms")
    .insert({
      code,
      host_id: hostId,
      status: "waiting",
      mode: "online",
      settings: settings ?? {}
    })
    .select()
    .single();

  if (error) throw error;
  return room;
}

export async function joinRoom(code: string, userId: string, name: string, color: string) {
  const supabase = createAdminClient();

  // Find room by code
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  if (roomError || !room) {
    throw new Error("Room not found");
  }

  if (room.status !== "waiting") {
    throw new Error("Room is not accepting new players");
  }

  // Check if user is already in room
  const { data: existingPlayer } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .single();

  if (existingPlayer) {
    return { room, player: existingPlayer };
  }

  // Find next available slot
  const { data: players } = await supabase
    .from("room_players")
    .select("player_slot")
    .eq("room_id", room.id)
    .order("player_slot", { ascending: true });

  const usedSlots = new Set(players?.map((p) => p.player_slot) ?? []);
  let slot = 0;
  while (usedSlots.has(slot) && slot < 6) {
    slot++;
  }

  if (slot >= 6) {
    throw new Error("Room is full");
  }

  const { data: player, error: playerError } = await supabase
    .from("room_players")
    .insert({
      room_id: room.id,
      user_id: userId,
      player_slot: slot,
      name,
      color,
      is_ready: false
    })
    .select()
    .single();

  if (playerError) throw playerError;
  return { room, player };
}

export async function leaveRoom(roomId: string, userId: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("room_players")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);

  if (error) throw error;

  // Check if room is now empty
  const { count } = await supabase
    .from("room_players")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId);

  if (count === 0) {
    await supabase.from("rooms").delete().eq("id", roomId);
  }

  return { success: true };
}

export async function readyUp(
  roomId: string,
  userId: string,
  scenarioId: string,
  dreamId: string
) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("room_players")
    .update({ is_ready: true, scenario_id: scenarioId, dream_id: dreamId })
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function startGame(roomId: string, hostId: string) {
  const supabase = createAdminClient();

  // Verify host
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (!room || room.host_id !== hostId) {
    throw new Error("Only host can start the game");
  }

  // Get all ready players
  const { data: players } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", roomId)
    .eq("is_ready", true)
    .order("player_slot", { ascending: true });

  if (!players || players.length < 1) {
    throw new Error("At least one player must be ready");
  }

  // Import engine dynamically to avoid client-side issues
  const { initGame } = await import("@/lib/engine/gameEngine");

  const playerSetups = players.map((p) => ({
    name: p.name,
    color: p.color,
    scenarioId: p.scenario_id ?? "",
    dreamId: p.dream_id ?? "",
    isLLM: false
  }));

  const { state, logs, frames } = initGame(playerSetups, room.settings as Partial<GameSettings>);

  // Store game state
  const { error: stateError } = await supabase.from("game_states").insert({
    room_id: roomId,
    phase: state.phase,
    turn_state: state.turnState,
    current_player_id: state.currentPlayerId,
    turn: state.turn,
    players: state.players,
    decks: state.decks,
    discard: state.discard,
    logs: [...state.logs, ...logs],
    replay_frames: [...state.replayFrames, ...frames],
    ventures: state.ventures,
    loans: state.loans,
    settings: state.settings,
    history: state.history,
    rng_seed: state.rngSeed,
    rng_state: state.rngState,
    version: 1
  });

  if (stateError) throw stateError;

  // Update room status
  const { error: roomError } = await supabase
    .from("rooms")
    .update({ status: "playing" })
    .eq("id", roomId);

  if (roomError) throw roomError;

  return { success: true, playerCount: players.length };
}

export async function getRoomState(roomId: string) {
  const supabase = createAdminClient();

  const [{ data: room }, { data: players }, { data: gameState }] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", roomId).single(),
    supabase.from("room_players").select("*").eq("room_id", roomId).order("player_slot", { ascending: true }),
    supabase.from("game_states").select("*").eq("room_id", roomId).single()
  ]);

  return { room, players: players ?? [], gameState };
}
