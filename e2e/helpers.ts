import { createClient } from "@supabase/supabase-js";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function getStorageKey() {
  const projectRef = new URL(url).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

/**
 * Create or reuse fixed password-based test users and return their sessions.
 * This avoids Supabase Auth anonymous-signup rate limits (429) which plague E2E runs.
 */
export async function createAnonSessions(count: number) {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const sessions: Array<{
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    expiresAt: number;
    tokenType: string;
  }> = [];

  for (let i = 0; i < count; i++) {
    const email = `e2e-test-player${i}@cashflow.local`;
    const password = `e2e-password-${i}-fixed`;

    // Ensure user exists (idempotent)
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError && !createError.message.includes("already been registered")) {
      throw new Error(`Failed to create test user ${i}: ${createError.message}`);
    }

    // Sign in to obtain a fresh session
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session || !signInData.user) {
      throw new Error(
        `Failed to sign in test user ${i}: ${signInError?.message ?? "no session"}`
      );
    }

    sessions.push({
      userId: signInData.user.id,
      accessToken: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
      expiresIn: signInData.session.expires_in,
      expiresAt:
        signInData.session.expires_at ??
        Math.floor(Date.now() / 1000) + signInData.session.expires_in,
      tokenType: signInData.session.token_type,
    });
  }

  return sessions;
}

/**
 * Encode a string to base64url (matching @supabase/ssr cookie encoding).
 */
function stringToBase64URL(str: string): string {
  const base64 = Buffer.from(str).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Inject a pre-created session into a Playwright page's cookies and localStorage. */
export async function injectAnonSession(
  page: any,
  session: {
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    expiresAt: number;
    tokenType: string;
  }
) {
  const storageKey = getStorageKey();
  const payload = {
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expires_in: session.expiresIn,
    expires_at: session.expiresAt,
    token_type: session.tokenType,
    user: { id: session.userId, email: `e2e-test-player@cashflow.local` },
  };

  // 1. Set cookie for @supabase/ssr createBrowserClient (uses document.cookie).
  //    createBrowserClient reads cookies via document.cookie and getItem() returns
  //    the raw value when it does NOT start with "base64-". So we store the raw
  //    JSON string here (no base64 encoding).
  const cookieName = storageKey;
  const cookieValue = JSON.stringify(payload);
  const domain = new URL(process.env.TEST_BASE_URL || "http://localhost:3000").hostname;

  await page.context().addCookies([
    {
      name: cookieName,
      value: cookieValue,
      domain: domain === "localhost" ? "localhost" : domain,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // 2. Set localStorage BEFORE page loads so Supabase client reads it on init.
  //    Using addInitScript ensures the value is present when JS first runs.
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    { key: storageKey, value: JSON.stringify(payload) }
  );
}

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
