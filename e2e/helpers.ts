import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  throw new Error(
    "Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
  );
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Delete a room and all its related data (cascades to room_players, game_states, game_actions).
 */
export async function cleanupRoomByCode(code: string) {
  const { data } = await admin.from("rooms").select("id").eq("code", code).single();
  if (data) {
    await admin.from("rooms").delete().eq("id", data.id);
  }
}

/**
 * Delete a room by its UUID.
 */
export async function cleanupRoomById(roomId: string) {
  await admin.from("rooms").delete().eq("id", roomId);
}

/**
 * Get the current game state for a room.
 */
export async function getGameState(roomId: string) {
  const { data, error } = await admin
    .from("game_states")
    .select("*")
    .eq("room_id", roomId)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Get room metadata by code.
 */
export async function getRoomByCode(code: string) {
  const { data, error } = await admin.from("rooms").select("*").eq("code", code).single();
  if (error) throw error;
  return data;
}

/**
 * Get players in a room.
 */
export async function getRoomPlayers(roomId: string) {
  const { data, error } = await admin
    .from("room_players")
    .select("*")
    .eq("room_id", roomId)
    .order("player_slot", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Wait for a room's status to reach a target value.
 */
export async function waitForRoomStatus(
  code: string,
  target: "waiting" | "playing" | "finished",
  timeoutMs = 10000,
  intervalMs = 500
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const room = await getRoomByCode(code).catch(() => null);
    if (room?.status === target) return room;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Room ${code} did not reach status ${target} within ${timeoutMs}ms`);
}
