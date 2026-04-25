import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
