import { test, expect, chromium, type Page } from "@playwright/test";
import { cleanupRoomByCode } from "./helpers";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout = 10000,
  interval = 500
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

async function enterMultiplayer(page: Page) {
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");
  const multiplayerBtn = page.locator('button:has-text("联机游戏")');
  await expect(multiplayerBtn).toBeVisible({ timeout: 5000 });
  await multiplayerBtn.click();
}

async function createRoom(page: Page, name: string) {
  await enterMultiplayer(page);
  const createRoomBtn = page.locator('button:has-text("创建房间")');
  await expect(createRoomBtn).toBeVisible({ timeout: 5000 });
  await createRoomBtn.click();

  const nameInput = page.locator('input[placeholder*="昵称"], input[placeholder*="name"]').first();
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(name);

  const createBtn = page.locator('button:has-text("创建")');
  await createBtn.click();

  const roomCodeLabel = page.locator('text=/房间码[:：]/');
  await expect(roomCodeLabel).toBeVisible({ timeout: 15000 });
  const roomCodeText = await roomCodeLabel.locator("strong").textContent();
  return roomCodeText?.trim() ?? "";
}

async function joinRoom(page: Page, name: string, code: string) {
  await enterMultiplayer(page);
  const joinRoomBtn = page.locator('button:has-text("加入房间")');
  await expect(joinRoomBtn).toBeVisible({ timeout: 5000 });
  await joinRoomBtn.click();

  const nameInput = page.locator('input[placeholder*="昵称"], input[placeholder*="name"]').first();
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(name);

  const codeInput = page.locator('input[placeholder*="房间码"], input[placeholder*="code"]').first();
  await expect(codeInput).toBeVisible({ timeout: 5000 });
  await codeInput.fill(code);

  const joinBtn = page.locator('button:has-text("加入")');
  await joinBtn.click();

  await expect(page.locator('text=/房间码[:：]/')).toBeVisible({ timeout: 15000 });
}

async function readyUp(page: Page) {
  const readyBtn = page.locator('button:has-text("准备")');
  await expect(readyBtn).toBeVisible({ timeout: 5000 });
  await readyBtn.click();

  const isReady = await waitForCondition(
    async () => await page.locator('text=已准备').first().isVisible().catch(() => false),
    10000
  );
  expect(isReady).toBe(true);
}

async function startGame(hostPage: Page) {
  const startBtn = hostPage.locator('button:has-text("开始游戏")');
  await expect(startBtn).toBeVisible({ timeout: 5000 });
  // Button may be disabled until all ready
  await expect(startBtn).toBeEnabled({ timeout: 15000 });

  // Capture any alert dialogs (startGame may throw)
  const dialogPromise = new Promise<string | null>((resolve) => {
    hostPage.once("dialog", (dialog) => {
      resolve(dialog.message());
      dialog.dismiss().catch(() => {});
    });
    setTimeout(() => resolve(null), 5000);
  });

  await startBtn.click();
  const dialogMsg = await dialogPromise;
  if (dialogMsg) {
    throw new Error(`Start game dialog: ${dialogMsg}`);
  }
}

test.describe("Multiplayer E2E", () => {
  const createdRoomCodes: string[] = [];

  test.afterAll(async () => {
    for (const code of createdRoomCodes) {
      try {
        await cleanupRoomByCode(code);
      } catch {
        // ignore cleanup errors
      }
    }
  });

  test("two browsers can see each other in a room", async () => {
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || undefined;
    const launchOpts: Parameters<typeof chromium.launch>[0] = {
      headless: true,
      proxy: proxy ? { server: proxy, bypass: "localhost,127.0.0.1" } : undefined,
    };
    if (process.env.PLAYWRIGHT_CHROME_EXECUTABLE) {
      launchOpts.executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE;
    }

    // Browser A: create room
    const browserA = await chromium.launch(launchOpts);
    const pageA = await browserA.newPage();

    const roomCode = await createRoom(pageA, "PlayerA");
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
    createdRoomCodes.push(roomCode);

    const playerAVisible = await waitForCondition(
      async () => await pageA.locator('text=PlayerA').first().isVisible().catch(() => false),
      15000
    );
    expect(playerAVisible).toBe(true);
    await readyUp(pageA);

    // Browser B: join room
    const browserB = await chromium.launch(launchOpts);
    const pageB = await browserB.newPage();

    await joinRoom(pageB, "PlayerB", roomCode);

    const playerBVisible = await waitForCondition(
      async () => await pageB.locator('text=PlayerB').first().isVisible().catch(() => false),
      15000
    );
    expect(playerBVisible).toBe(true);
    await readyUp(pageB);

    // Wait for sync
    await pageA.waitForTimeout(3000);
    await pageB.waitForTimeout(3000);

    const playerBInA = await pageA.locator('text=PlayerB').first().isVisible().catch(() => false);
    const playerAInB = await pageB.locator('text=PlayerA').first().isVisible().catch(() => false);

    await browserA.close();
    await browserB.close();

    expect(playerBInA).toBe(true);
    expect(playerAInB).toBe(true);
  });

  test("host can start game and players reach the board", async () => {
    const launchOpts: Parameters<typeof chromium.launch>[0] = { headless: true };
    if (process.env.PLAYWRIGHT_CHROME_EXECUTABLE) {
      launchOpts.executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE;
    }

    const browserA = await chromium.launch(launchOpts);
    const pageA = await browserA.newPage();

    const roomCode = await createRoom(pageA, "Host");
    createdRoomCodes.push(roomCode);
    await readyUp(pageA);

    const browserB = await chromium.launch(launchOpts);
    const pageB = await browserB.newPage();

    await joinRoom(pageB, "Guest", roomCode);
    await readyUp(pageB);

    // Host starts game
    await startGame(pageA);

    // Wait for game board to appear in both browsers
    const boardA = await waitForCondition(
      async () => await pageA.locator('button:has-text("掷骰子")').first().isVisible().catch(() => false),
      20000
    );
    const boardB = await waitForCondition(
      async () => await pageB.locator('button:has-text("掷骰子")').first().isVisible().catch(() => false),
      20000
    );

    await browserA.close();
    await browserB.close();

    expect(boardA).toBe(true);
    expect(boardB).toBe(true);
  });

  test("first player can roll dice and advance turn", async () => {
    const launchOpts: Parameters<typeof chromium.launch>[0] = { headless: true };
    if (process.env.PLAYWRIGHT_CHROME_EXECUTABLE) {
      launchOpts.executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE;
    }

    const browserA = await chromium.launch(launchOpts);
    const pageA = await browserA.newPage();

    const roomCode = await createRoom(pageA, "P1");
    createdRoomCodes.push(roomCode);
    await readyUp(pageA);

    const browserB = await chromium.launch(launchOpts);
    const pageB = await browserB.newPage();

    await joinRoom(pageB, "P2", roomCode);
    await readyUp(pageB);

    await startGame(pageA);

    // Wait for game board in both browsers
    await expect(pageA.locator('button:has-text("掷骰子")')).toBeVisible({ timeout: 20000 });
    await expect(pageB.locator('button:has-text("掷骰子")')).toBeVisible({ timeout: 20000 });

    // Wait for turn state to settle and find the active player's browser
    let activePage: Page | null = null;
    const foundActive = await waitForCondition(async () => {
      const enabledA = await pageA.locator('button:has-text("掷骰子")').isEnabled().catch(() => false);
      if (enabledA) { activePage = pageA; return true; }
      const enabledB = await pageB.locator('button:has-text("掷骰子")').isEnabled().catch(() => false);
      if (enabledB) { activePage = pageB; return true; }
      return false;
    }, 15000);

    expect(foundActive).toBe(true);
    expect(activePage).not.toBeNull();

    // Roll dice
    await activePage!.locator('button:has-text("掷骰子")').click();

    // After rolling, the turn state may become awaitAction (draw card),
    // awaitCard (handle card), or awaitEnd (end turn). Wait for any of these.
    const turnAdvanced = await waitForCondition(async () => {
      const text = await activePage!.evaluate(() => document.body.innerText);
      return (
        text.includes("结束回合") ||
        text.includes("抽取") ||
        text.includes("购买") ||
        text.includes("支付") ||
        text.includes("结算")
      );
    }, 15000);

    await browserA.close();
    await browserB.close();

    expect(turnAdvanced).toBe(true);
  });
});
