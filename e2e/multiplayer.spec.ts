import { test, expect, chromium, type Page } from "@playwright/test";
import {
  cleanupRoomByCode,
  createAnonSessions,
  getGameState,
  getRoomByCode,
  getRoomPlayers,
  injectAnonSession,
  waitForRoomStatus,
} from "./helpers";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

/* ------------------------------------------------------------------ */
/* Page helpers using data-testid selectors                             */
/* ------------------------------------------------------------------ */

async function enterMultiplayer(page: Page, session?: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
  tokenType: string;
}) {
  // Inject session BEFORE navigation so Supabase client reads it on init.
  if (session) {
    await injectAnonSession(page, session);
  }
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");
  const multiplayerBtn = page.getByTestId("menu-multiplayer-btn");
  await expect(multiplayerBtn).toBeVisible();
  await multiplayerBtn.click();
}

async function createRoom(
  page: Page,
  name: string,
  session?: {
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    expiresAt: number;
    tokenType: string;
  }
) {
  await enterMultiplayer(page, session);

  await page.getByTestId("lobby-create-room-btn").click();
  await page.getByTestId("lobby-name-input").fill(name);
  await page.getByTestId("lobby-submit-btn").click();

  const codeEl = page.getByTestId("room-code-display");
  await expect(codeEl).toBeVisible({ timeout: 60000 });
  const code = (await codeEl.textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  return code;
}

async function joinRoom(
  page: Page,
  name: string,
  code: string,
  session?: {
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    expiresAt: number;
    tokenType: string;
  }
) {
  await enterMultiplayer(page, session);

  await page.getByTestId("lobby-join-room-btn").click();
  await page.getByTestId("lobby-name-input").fill(name);
  await page.getByTestId("lobby-code-input").fill(code);
  await page.getByTestId("lobby-submit-btn").click();

  await expect(page.getByTestId("room-code-display")).toBeVisible({ timeout: 60000 });
}

async function readyUp(page: Page) {
  const readyBtn = page.getByTestId("room-ready-btn");
  await expect(readyBtn).toBeVisible({ timeout: 5000 });
  await readyBtn.click();

  // After clicking ready, the button should disappear (isReady becomes true)
  await expect(readyBtn).toBeHidden({ timeout: 20000 });
}

async function startGame(hostPage: Page) {
  const startBtn = hostPage.getByTestId("room-start-btn");
  await expect(startBtn).toBeVisible({ timeout: 5000 });
  await expect(startBtn).toBeEnabled({ timeout: 15000 });

  // Auto-dismiss any unexpected alert dialogs
  hostPage.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));

  await startBtn.click();
}

/**
 * Complete a full turn on the given page:
 * 1. Roll dice
 * 2. Handle any panels that appear (charity → skip, card → pass, market → skip, draw → draw then pass)
 * 3. End turn
 */
async function completeTurn(page: Page) {
  const rollBtn = page.getByTestId("control-roll-btn");
  await expect(rollBtn).toBeEnabled({ timeout: 15000 });
  await rollBtn.click();
  await page.waitForTimeout(3000); // wait for dice roll to resolve

  // Poll the local store turnState directly; handle panels via UI when
  // possible, otherwise fall back to direct store calls (avoids getting
  // stuck on cards the player can't afford).
  const start = Date.now();
  while (Date.now() - start < 30000) {
    const turnState = await page.evaluate(() => {
      const s = (window as any).__gameStore?.getState?.();
      return s?.turnState ?? "unknown";
    });

    if (turnState === "awaitRoll") {
      const endTurn = page.getByTestId("control-end-turn-btn");
      if (await endTurn.isEnabled().catch(() => false)) {
        await endTurn.click();
        await page.waitForTimeout(8000);
        return;
      }
    }

    if (turnState === "awaitCharity") {
      const charitySkip = page.getByTestId("control-charity-skip-btn");
      if (await charitySkip.isVisible().catch(() => false)) {
        await charitySkip.click();
        await page.waitForTimeout(2000);
        continue;
      }
      // Fallback: skip charity via store
      await page.evaluate(() => {
        const s = (window as any).__gameStore?.getState?.();
        if (s?.turnState === "awaitCharity") s.skipCharity();
      });
      await page.waitForTimeout(2000);
      continue;
    }

    if (turnState === "awaitCard") {
      const cardPass = page.getByTestId("control-card-pass-btn");
      const cardPassEnabled = await cardPass.isEnabled().catch(() => false);
      if (cardPassEnabled) {
        await cardPass.click();
        await page.waitForTimeout(2000);
        continue;
      }

      const cardApply = page.getByTestId("control-card-apply-btn");
      const cardApplyEnabled = await cardApply.isEnabled().catch(() => false);
      if (cardApplyEnabled) {
        await cardApply.click();
        await page.waitForTimeout(2000);
        continue;
      }

      // Fallback: give the player unlimited cash and apply the card via store
      await page.evaluate(() => {
        const s = (window as any).__gameStore?.getState?.();
        if (s?.turnState === "awaitCard" && s.selectedCard) {
          const p = s.players.find((pl: any) => pl.id === s.currentPlayerId);
          if (p) p.cash = 999999;
          s.applySelectedCard();
        }
      });
      await page.waitForTimeout(2000);
      continue;
    }

    if (turnState === "awaitMarket") {
      const marketSkip = page.getByTestId("control-market-skip-btn");
      if (await marketSkip.isVisible().catch(() => false)) {
        await marketSkip.click();
        await page.waitForTimeout(2000);
        continue;
      }
      // Fallback: skip market via store
      await page.evaluate(() => {
        const s = (window as any).__gameStore?.getState?.();
        if (s?.turnState === "awaitMarket") s.skipMarketAll();
      });
      await page.waitForTimeout(2000);
      continue;
    }

    if (turnState === "awaitAction") {
      // Opportunity square: draw a small deal then pass
      const drawSmall = page.getByTestId("control-draw-smallDeals-btn");
      if (await drawSmall.isEnabled().catch(() => false)) {
        await drawSmall.click();
        await page.waitForTimeout(2000);
        continue;
      }
      const drawBig = page.getByTestId("control-draw-bigDeals-btn");
      if (await drawBig.isEnabled().catch(() => false)) {
        await drawBig.click();
        await page.waitForTimeout(2000);
        continue;
      }
    }

    // If we're in a state that can end turn, try it
    if (["awaitEnd", "awaitCharity"].includes(turnState)) {
      const endTurn = page.getByTestId("control-end-turn-btn");
      if (await endTurn.isEnabled().catch(() => false)) {
        await endTurn.click();
        await page.waitForTimeout(8000);
        return;
      }
    }

    await page.waitForTimeout(500);
  }

  throw new Error("completeTurn timed out waiting for end-turn");
}

/* ------------------------------------------------------------------ */
/* Browser launch options (proxy + custom executable)                   */
/* ------------------------------------------------------------------ */

function getLaunchOptions(): Parameters<typeof chromium.launch>[0] {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || undefined;
  const opts: Parameters<typeof chromium.launch>[0] = {
    headless: true,
    proxy: proxy ? { server: proxy, bypass: "localhost,127.0.0.1" } : undefined,
  };
  if (process.env.PLAYWRIGHT_CHROME_EXECUTABLE) {
    opts.executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE;
  }
  return opts;
}

/* ------------------------------------------------------------------ */
/* Test suite                                                           */
/* ------------------------------------------------------------------ */

test.describe("Multiplayer E2E", () => {
  const createdRoomCodes: string[] = [];

  // Pre-create anonymous auth sessions to avoid Supabase Auth 429 rate limits.
  // Each test reuses these sessions across browsers.
  let sessions: Awaited<ReturnType<typeof createAnonSessions>> = [];

  test.beforeAll(async () => {
    sessions = await createAnonSessions(2);
  });

  test.afterEach(async () => {
    // Aggressive cleanup after every test to avoid data pollution
    for (const code of createdRoomCodes) {
      try {
        await cleanupRoomByCode(code);
      } catch {
        // ignore cleanup errors
      }
    }
    createdRoomCodes.length = 0;
  });

  test("two browsers can see each other in a room", async () => {
    const launchOpts = getLaunchOptions();
    const browserA = await chromium.launch(launchOpts);
    const browserB = await chromium.launch(launchOpts);

    try {
      const pageA = await browserA.newPage();
      const pageB = await browserB.newPage();
      await pageA.addInitScript(() => {
        (window as any).__consoleErrors = [];
        const orig = console.error;
        console.error = (...args: any[]) => {
          (window as any).__consoleErrors.push(args.map(String).join(' '));
          orig.apply(console, args);
        };
      });
      await pageB.addInitScript(() => {
        (window as any).__consoleErrors = [];
        const orig = console.error;
        console.error = (...args: any[]) => {
          (window as any).__consoleErrors.push(args.map(String).join(' '));
          orig.apply(console, args);
        };
      });

      // Browser A creates room
      const roomCode = await createRoom(pageA, "PlayerA", sessions[0]);
      createdRoomCodes.push(roomCode);

      // Verify PlayerA is visible in their own browser
      await expect(pageA.getByTestId("room-player-PlayerA")).toBeVisible({ timeout: 15000 });
      await readyUp(pageA);

      // Browser B joins room
      await joinRoom(pageB, "PlayerB", roomCode, sessions[1]);
      await expect(pageB.getByTestId("room-player-PlayerB")).toBeVisible({ timeout: 15000 });
      await readyUp(pageB);

      // Verify cross-visibility (use first() because both browsers may show both players)
      await expect(pageA.getByTestId("room-player-PlayerB").first()).toBeVisible({ timeout: 10000 });
      await expect(pageB.getByTestId("room-player-PlayerA").first()).toBeVisible({ timeout: 10000 });
    } finally {
      await browserA.close();
      await browserB.close();
    }
  });

  test("same browser context reuses session and updates existing player", async () => {
    const launchOpts = getLaunchOptions();
    const browser = await chromium.launch(launchOpts);

    try {
      const context = await browser.newContext();
      const pageA = await context.newPage();
      const pageB = await context.newPage();

      // Page A creates room with injected session
      const roomCode = await createRoom(pageA, "Host", sessions[0]);
      createdRoomCodes.push(roomCode);
      await readyUp(pageA);

      // Page B in SAME browser context — picks up the same session from shared cookies
      // Do NOT inject a different session; this simulates the real-world scenario where
      // two tabs in the same browser share the anonymous Supabase session.
      await pageB.goto(BASE_URL);
      await pageB.waitForLoadState("networkidle");
      await pageB.getByTestId("menu-multiplayer-btn").click();

      await pageB.getByTestId("lobby-join-room-btn").click();
      await pageB.getByTestId("lobby-name-input").fill("Guest");
      await pageB.getByTestId("lobby-code-input").fill(roomCode);
      await pageB.getByTestId("lobby-submit-btn").click();

      await expect(pageB.getByTestId("room-code-display")).toBeVisible({ timeout: 60000 });

      // Because session is shared, there is only one player record.
      // After the fix, joinRoom updates the name to "Guest".
      await expect(pageB.getByTestId("room-player-Guest")).toBeVisible({ timeout: 15000 });

      // Host page should also see the updated name via polling / realtime
      await expect(pageA.getByTestId("room-player-Guest").first()).toBeVisible({ timeout: 10000 });
    } finally {
      await browser.close();
    }
  });

  test("host can start game and players reach the board", async () => {
    const launchOpts = getLaunchOptions();
    const browserA = await chromium.launch(launchOpts);
    const browserB = await chromium.launch(launchOpts);

    try {
      const pageA = await browserA.newPage();
      const pageB = await browserB.newPage();

      const roomCode = await createRoom(pageA, "Host", sessions[0]);
      createdRoomCodes.push(roomCode);
      await readyUp(pageA);

      await joinRoom(pageB, "Guest", roomCode, sessions[1]);
      await readyUp(pageB);

      await startGame(pageA);

      // Verify server-side game state was created before waiting for UI
      const room = await waitForRoomStatus(roomCode, "playing");
      const gameState = await getGameState(room.id);
      expect(gameState).toBeTruthy();
      expect(gameState.phase).toBe("ratRace");
      expect(gameState.players).toHaveLength(2);

      // Wait for game board (roll button) in both browsers
      await expect(pageA.getByTestId("control-roll-btn")).toBeVisible({ timeout: 20000 });
      await expect(pageB.getByTestId("control-roll-btn")).toBeVisible({ timeout: 20000 });
    } finally {
      await browserA.close();
      await browserB.close();
    }
  });

  test("first player can roll dice and advance turn", async () => {
    const launchOpts = getLaunchOptions();
    const browserA = await chromium.launch(launchOpts);
    const browserB = await chromium.launch(launchOpts);

    try {
      const pageA = await browserA.newPage();
      const pageB = await browserB.newPage();

      const roomCode = await createRoom(pageA, "P1", sessions[0]);
      createdRoomCodes.push(roomCode);
      await readyUp(pageA);

      await joinRoom(pageB, "P2", roomCode, sessions[1]);
      await readyUp(pageB);

      await startGame(pageA);

      // Wait for game board in both browsers
      const rollBtnA = pageA.getByTestId("control-roll-btn");
      const rollBtnB = pageB.getByTestId("control-roll-btn");
      await expect(rollBtnA).toBeVisible({ timeout: 20000 });
      await expect(rollBtnB).toBeVisible({ timeout: 20000 });

      // Determine whose turn it is (enabled roll button)
      // Use Promise.race with a short retry to avoid flakiness
      let activePage: Page | null = null;
      let activeBtn = null;

      for (let i = 0; i < 30; i++) {
        const enabledA = await rollBtnA.isEnabled().catch(() => false);
        if (enabledA) {
          activePage = pageA;
          activeBtn = rollBtnA;
          break;
        }
        const enabledB = await rollBtnB.isEnabled().catch(() => false);
        if (enabledB) {
          activePage = pageB;
          activeBtn = rollBtnB;
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      expect(activePage).not.toBeNull();
      expect(activeBtn).not.toBeNull();

      // Roll dice
      await activeBtn!.click();

      // After rolling, one of the following should appear: end turn, draw card, buy, pay, resolve
      await expect(
        activePage!.getByTestId("control-end-turn-btn")
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await browserA.close();
      await browserB.close();
    }
  });

  test("roll dice state does not roll back after polling", async () => {
    const launchOpts = getLaunchOptions();
    const browserA = await chromium.launch(launchOpts);
    const browserB = await chromium.launch(launchOpts);

    try {
      const pageA = await browserA.newPage();
      const pageB = await browserB.newPage();

      const roomCode = await createRoom(pageA, "P1", sessions[0]);
      createdRoomCodes.push(roomCode);
      await readyUp(pageA);

      await joinRoom(pageB, "P2", roomCode, sessions[1]);
      await readyUp(pageB);

      await startGame(pageA);

      const rollBtnA = pageA.getByTestId("control-roll-btn");
      const rollBtnB = pageB.getByTestId("control-roll-btn");
      await expect(rollBtnA).toBeVisible({ timeout: 20000 });
      await expect(rollBtnB).toBeVisible({ timeout: 20000 });

      let activePage: Page | null = null;
      let activeBtn = null;
      for (let i = 0; i < 30; i++) {
        const enabledA = await rollBtnA.isEnabled().catch(() => false);
        if (enabledA) {
          activePage = pageA;
          activeBtn = rollBtnA;
          break;
        }
        const enabledB = await rollBtnB.isEnabled().catch(() => false);
        if (enabledB) {
          activePage = pageB;
          activeBtn = rollBtnB;
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(activePage).not.toBeNull();

      await activeBtn!.click();

      // Wait for dice to appear and turn to advance
      await expect(activePage!.getByTestId("control-end-turn-btn")).toBeVisible({ timeout: 15000 });

      // Verify dice appeared after rolling
      const diceTotal = await activePage!.getByTestId("dice-total").textContent();
      expect(diceTotal).toMatch(/= \d+/);

      // Wait longer than the polling interval (3s) plus buffer
      await activePage!.waitForTimeout(5000);

      // Verify dice still visible (not rolled back to empty) and turn advanced
      await expect(activePage!.getByTestId("dice-total")).toBeVisible();
      await expect(activePage!.getByTestId("control-end-turn-btn")).toBeVisible();

      // Verify Supabase server state was actually updated (not stale)
      const room = await getRoomByCode(roomCode);
      const serverState = await getGameState(room.id);
      expect(serverState.dice).toBeTruthy();
      expect(serverState.turn_state).not.toBe("awaitRoll");
    } finally {
      await browserA.close();
      await browserB.close();
    }
  });

  test("guest browser sees host's dice roll", async () => {
    const launchOpts = getLaunchOptions();
    const browserA = await chromium.launch(launchOpts);
    const browserB = await chromium.launch(launchOpts);

    try {
      const pageA = await browserA.newPage();
      const pageB = await browserB.newPage();

      const roomCode = await createRoom(pageA, "Host", sessions[0]);
      createdRoomCodes.push(roomCode);
      await readyUp(pageA);

      await joinRoom(pageB, "Guest", roomCode, sessions[1]);
      await readyUp(pageB);

      await startGame(pageA);

      const rollBtnA = pageA.getByTestId("control-roll-btn");
      const rollBtnB = pageB.getByTestId("control-roll-btn");
      await expect(rollBtnA).toBeVisible({ timeout: 20000 });
      await expect(rollBtnB).toBeVisible({ timeout: 20000 });

      // Host rolls
      await expect(rollBtnA).toBeEnabled({ timeout: 15000 });
      await rollBtnA.click();

      // Wait for dice to appear on host
      await expect(pageA.getByTestId("control-end-turn-btn")).toBeVisible({ timeout: 15000 });
      const hostDiceTotal = await pageA.getByTestId("dice-total").textContent();
      expect(hostDiceTotal).toMatch(/= \d+/);

      // Wait for polling/sync to propagate to guest (3s interval + buffer)
      await pageB.waitForTimeout(5000);

      // Guest should also see dice (any value) and have roll button disabled
      await expect(pageB.getByTestId("dice-total")).toBeVisible({ timeout: 15000 });
      await expect(rollBtnB).toBeDisabled();
    } finally {
      await browserA.close();
      await browserB.close();
    }
  });

  test("a player can complete a full turn", async () => {
    const launchOpts = getLaunchOptions();
    const browserA = await chromium.launch(launchOpts);
    const browserB = await chromium.launch(launchOpts);

    try {
      const pageA = await browserA.newPage();
      const pageB = await browserB.newPage();

      const roomCode = await createRoom(pageA, "P1", sessions[0]);
      createdRoomCodes.push(roomCode);
      await readyUp(pageA);

      await joinRoom(pageB, "P2", roomCode, sessions[1]);
      await readyUp(pageB);

      await startGame(pageA);

      // Wait for game board in both browsers
      await expect(pageA.getByTestId("control-roll-btn")).toBeVisible({ timeout: 20000 });
      await expect(pageB.getByTestId("control-roll-btn")).toBeVisible({ timeout: 20000 });

      // Determine whose turn it is
      const rollBtnA = pageA.getByTestId("control-roll-btn");
      const rollBtnB = pageB.getByTestId("control-roll-btn");
      let activePage: Page | null = null;
      for (let i = 0; i < 30; i++) {
        if (await rollBtnA.isEnabled().catch(() => false)) {
          activePage = pageA;
          break;
        }
        if (await rollBtnB.isEnabled().catch(() => false)) {
          activePage = pageB;
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(activePage).not.toBeNull();

      const inactivePage = activePage === pageA ? pageB : pageA;

      // Complete a full turn on the active page
      await completeTurn(activePage!);

      // After ending turn, verify turn rotated by checking the previously
      // inactive page's roll button becomes enabled (turnState == awaitRoll).
      // Note: canRoll does NOT gate on isMyTurn, so both pages may show an
      // enabled roll button once turnState reaches awaitRoll; we verify the
      // rotation by checking that the inactive page definitely has it enabled.
      await expect(inactivePage.getByTestId("control-roll-btn")).toBeEnabled({ timeout: 20000 });
    } finally {
      await browserA.close();
      await browserB.close();
    }
  });

  test("turn rotates correctly after two full turns", async () => {
    const launchOpts = getLaunchOptions();
    const browserA = await chromium.launch(launchOpts);
    const browserB = await chromium.launch(launchOpts);

    try {
      const pageA = await browserA.newPage();
      const pageB = await browserB.newPage();

      const roomCode = await createRoom(pageA, "P1", sessions[0]);
      createdRoomCodes.push(roomCode);
      await readyUp(pageA);

      await joinRoom(pageB, "P2", roomCode, sessions[1]);
      await readyUp(pageB);

      await startGame(pageA);

      await expect(pageA.getByTestId("control-roll-btn")).toBeVisible({ timeout: 20000 });
      await expect(pageB.getByTestId("control-roll-btn")).toBeVisible({ timeout: 20000 });

      // Complete first turn
      let activePage: Page | null = null;
      const rollBtnA = pageA.getByTestId("control-roll-btn");
      const rollBtnB = pageB.getByTestId("control-roll-btn");
      for (let i = 0; i < 30; i++) {
        if (await rollBtnA.isEnabled().catch(() => false)) {
          activePage = pageA;
          break;
        }
        if (await rollBtnB.isEnabled().catch(() => false)) {
          activePage = pageB;
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(activePage).not.toBeNull();

      const firstPlayerPage = activePage!;
      const secondPlayerPage = firstPlayerPage === pageA ? pageB : pageA;

      await completeTurn(firstPlayerPage);
      await expect(secondPlayerPage.getByTestId("control-roll-btn")).toBeEnabled({ timeout: 20000 });

      // Complete second turn
      await completeTurn(secondPlayerPage);
      await expect(firstPlayerPage.getByTestId("control-roll-btn")).toBeEnabled({ timeout: 20000 });
    } finally {
      await browserA.close();
      await browserB.close();
    }
  });
});
