import { test, expect, chromium, type Page } from "@playwright/test";
import {
  cleanupRoomByCode,
  getGameState,
  getRoomByCode,
  getRoomPlayers,
  waitForRoomStatus,
} from "./helpers";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

/* ------------------------------------------------------------------ */
/* Page helpers using data-testid selectors                             */
/* ------------------------------------------------------------------ */

async function enterMultiplayer(page: Page) {
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");
  const multiplayerBtn = page.getByTestId("menu-multiplayer-btn");
  await expect(multiplayerBtn).toBeVisible();
  await multiplayerBtn.click();
}

async function createRoom(page: Page, name: string) {
  await enterMultiplayer(page);

  await page.getByTestId("lobby-create-room-btn").click();
  await page.getByTestId("lobby-name-input").fill(name);
  await page.getByTestId("lobby-submit-btn").click();

  const codeEl = page.getByTestId("room-code-display");
  await expect(codeEl).toBeVisible({ timeout: 15000 });
  const code = (await codeEl.textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  return code;
}

async function joinRoom(page: Page, name: string, code: string) {
  await enterMultiplayer(page);

  await page.getByTestId("lobby-join-room-btn").click();
  await page.getByTestId("lobby-name-input").fill(name);
  await page.getByTestId("lobby-code-input").fill(code);
  await page.getByTestId("lobby-submit-btn").click();

  await expect(page.getByTestId("room-code-display")).toBeVisible({ timeout: 15000 });
}

async function readyUp(page: Page) {
  const readyBtn = page.getByTestId("room-ready-btn");
  await expect(readyBtn).toBeVisible({ timeout: 5000 });
  await readyBtn.click();

  // After clicking ready, the button should disappear (isReady becomes true)
  await expect(readyBtn).toBeHidden({ timeout: 10000 });
}

async function startGame(hostPage: Page) {
  const startBtn = hostPage.getByTestId("room-start-btn");
  await expect(startBtn).toBeVisible({ timeout: 5000 });
  await expect(startBtn).toBeEnabled({ timeout: 15000 });

  // Auto-dismiss any unexpected alert dialogs
  hostPage.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));

  await startBtn.click();
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

      // Browser A creates room
      const roomCode = await createRoom(pageA, "PlayerA");
      createdRoomCodes.push(roomCode);

      // Verify PlayerA is visible in their own browser
      await expect(pageA.getByTestId("room-player-PlayerA")).toBeVisible({ timeout: 15000 });
      await readyUp(pageA);

      // Browser B joins room
      await joinRoom(pageB, "PlayerB", roomCode);
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

  test("host can start game and players reach the board", async () => {
    const launchOpts = getLaunchOptions();
    const browserA = await chromium.launch(launchOpts);
    const browserB = await chromium.launch(launchOpts);

    try {
      const pageA = await browserA.newPage();
      const pageB = await browserB.newPage();

      const roomCode = await createRoom(pageA, "Host");
      createdRoomCodes.push(roomCode);
      await readyUp(pageA);

      await joinRoom(pageB, "Guest", roomCode);
      await readyUp(pageB);

      await startGame(pageA);

      // Wait for game board (roll button) in both browsers
      await expect(pageA.getByTestId("control-roll-btn")).toBeVisible({ timeout: 20000 });
      await expect(pageB.getByTestId("control-roll-btn")).toBeVisible({ timeout: 20000 });

      // Verify Supabase state
      const room = await waitForRoomStatus(roomCode, "playing");
      const gameState = await getGameState(room.id);
      expect(gameState).toBeTruthy();
      expect(gameState.phase).toBe("ratRace");
      expect(gameState.players).toHaveLength(2);
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

      const roomCode = await createRoom(pageA, "P1");
      createdRoomCodes.push(roomCode);
      await readyUp(pageA);

      await joinRoom(pageB, "P2", roomCode);
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
});
