import { test, expect, chromium } from "@playwright/test";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

// Helper to wait for a condition with timeout
async function waitForCondition(
  page: any,
  condition: () => Promise<boolean>,
  timeout = 10000,
  interval = 500
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return true;
    await page.waitForTimeout(interval);
  }
  return false;
}

test.describe("Multiplayer room sync", () => {
  test.beforeAll(async () => {
    // Basic connectivity check
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch {
      throw new Error(`Server at ${BASE_URL} is not reachable. Please run 'npm run dev' first.`);
    }
  });

  test("two browsers can see each other in a room", async () => {
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || undefined;
    const launchOpts: Parameters<typeof chromium.launch>[0] = {
      headless: true,
      proxy: proxy ? { server: proxy, bypass: "localhost,127.0.0.1" } : undefined
    };
    // Prefer environment-specified Chrome path; fall back to Playwright's bundled Chromium
    if (process.env.PLAYWRIGHT_CHROME_EXECUTABLE) {
      launchOpts.executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE;
    }

    // Browser A: create room
    const browserA = await chromium.launch(launchOpts);
    const contextA = await browserA.newContext();
    const pageA = await contextA.newPage();

    // Capture console logs
    const logsA: string[] = [];
    pageA.on("console", (msg) => logsA.push(`[${msg.type()}] ${msg.text()}`));

    await pageA.goto(BASE_URL);
    await pageA.waitForLoadState("networkidle");

    // Click "联机游戏" (Online Multiplayer)
    const multiplayerBtn = pageA.locator('button:has-text("联机游戏")');
    await expect(multiplayerBtn).toBeVisible({ timeout: 5000 });
    await multiplayerBtn.click();

    // Click "创建房间"
    const createRoomBtn = pageA.locator('button:has-text("创建房间")');
    await expect(createRoomBtn).toBeVisible({ timeout: 5000 });
    await createRoomBtn.click();

    // Fill name
    const nameInput = pageA.locator('input[placeholder*="昵称"], input[placeholder*="name"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill("PlayerA");

    // Click create
    const createBtn = pageA.locator('button:has-text("创建")');
    await createBtn.click();

    // Wait for room screen to appear (room code label)
    const roomCodeLabel = pageA.locator('text=/房间码[:：]/');
    await expect(roomCodeLabel).toBeVisible({ timeout: 15000 });

    // Extract room code from the strong tag next to it
    const roomCodeText = await roomCodeLabel.locator("strong").textContent();
    const roomCode = roomCodeText?.trim();
    console.log("[Test] Room code:", roomCode);
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    // Wait for PlayerA to appear in list
    const playerAVisible = await waitForCondition(
      pageA,
      async () => await pageA.locator('text=PlayerA').first().isVisible().catch(() => false),
      15000
    );
    console.log("[Test] PlayerA visible in own browser:", playerAVisible);
    expect(playerAVisible).toBe(true);

    // Browser A: select scenario & dream, then ready up
    const readyBtnA = pageA.locator('button:has-text("准备")');
    await expect(readyBtnA).toBeVisible({ timeout: 5000 });
    await readyBtnA.click();
    console.log("[Test] Browser A clicked ready");

    // Wait for "已准备" status
    const readyStatusA = await waitForCondition(
      pageA,
      async () => {
        const text = await pageA.locator('text=已准备').first().isVisible().catch(() => false);
        return text;
      },
      10000
    );
    console.log("[Test] Browser A ready status:", readyStatusA);

    // Browser B: join room
    const browserB = await chromium.launch(launchOpts);
    const contextB = await browserB.newContext();
    const pageB = await contextB.newPage();

    const logsB: string[] = [];
    pageB.on("console", (msg) => logsB.push(`[${msg.type()}] ${msg.text()}`));

    await pageB.goto(BASE_URL);
    await pageB.waitForLoadState("networkidle");

    // Click "联机游戏"
    const multiplayerBtnB = pageB.locator('button:has-text("联机游戏")');
    await expect(multiplayerBtnB).toBeVisible({ timeout: 5000 });
    await multiplayerBtnB.click();

    // Click "加入房间"
    const joinRoomBtn = pageB.locator('button:has-text("加入房间")');
    await expect(joinRoomBtn).toBeVisible({ timeout: 5000 });
    await joinRoomBtn.click();

    // Fill name
    const nameInputB = pageB.locator('input[placeholder*="昵称"], input[placeholder*="name"]').first();
    await expect(nameInputB).toBeVisible({ timeout: 5000 });
    await nameInputB.fill("PlayerB");

    // Fill room code
    const codeInput = pageB.locator('input[placeholder*="房间码"], input[placeholder*="code"]').first();
    await expect(codeInput).toBeVisible({ timeout: 5000 });
    await codeInput.fill(roomCode!);

    // Click join
    const joinBtn = pageB.locator('button:has-text("加入")');
    await joinBtn.click();

    // Wait for room screen
    await expect(pageB.locator('text=/房间码[:：]/')).toBeVisible({ timeout: 15000 });

    // Wait for PlayerB to appear in list
    const playerBVisible = await waitForCondition(
      pageB,
      async () => await pageB.locator('text=PlayerB').first().isVisible().catch(() => false),
      15000
    );
    console.log("[Test] PlayerB visible in own browser:", playerBVisible);
    expect(playerBVisible).toBe(true);

    // Browser B: ready up
    const readyBtnB = pageB.locator('button:has-text("准备")');
    await expect(readyBtnB).toBeVisible({ timeout: 5000 });
    await readyBtnB.click();
    console.log("[Test] Browser B clicked ready");

    // Wait for "已准备" status in Browser B
    const readyStatusB = await waitForCondition(
      pageB,
      async () => await pageB.locator('text=已准备').first().isVisible().catch(() => false),
      10000
    );
    console.log("[Test] Browser B ready status:", readyStatusB);

    // Wait a bit for polling/sync
    await pageA.waitForTimeout(5000);
    await pageB.waitForTimeout(5000);

    // Check if Browser A sees PlayerB
    const playerBInA = await pageA.locator('text=PlayerB').first().isVisible().catch(() => false);
    console.log("[Test] PlayerB visible in Browser A:", playerBInA);

    // Check if Browser B sees PlayerA
    const playerAInB = await pageB.locator('text=PlayerA').first().isVisible().catch(() => false);
    console.log("[Test] PlayerA visible in Browser B:", playerAInB);

    // Take screenshots for debugging
    await pageA.screenshot({ path: "/tmp/browser-a.png", fullPage: true });
    await pageB.screenshot({ path: "/tmp/browser-b.png", fullPage: true });

    // Log console output
    console.log("[Test] Browser A console logs:");
    logsA.forEach((l) => console.log(l));
    console.log("[Test] Browser B console logs:");
    logsB.forEach((l) => console.log(l));

    // Cleanup
    await browserA.close();
    await browserB.close();

    // Assertions
    expect(playerBInA).toBe(true);
    expect(playerAInB).toBe(true);
  });
});
