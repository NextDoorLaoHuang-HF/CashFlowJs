const { chromium } = require("playwright");

const BASE_URL = "http://localhost:3000";
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForText(page, text, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const content = await page.content();
    if (content.includes(text)) return true;
    await sleep(500);
  }
  return false;
}

async function runTest() {
  console.log("[Test] Starting multiplayer test...");

  // Browser A: create room
  console.log("[Test] Launching Browser A...");
  const browserA = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
  });
  const pageA = await browserA.newPage();
  await pageA.goto(BASE_URL);
  await sleep(2000);

  // Click 联机游戏
  await pageA.click('button:has-text("联机游戏")');
  await sleep(500);

  // Click 创建房间
  await pageA.click('button:has-text("创建房间")');
  await sleep(500);

  // Fill name
  await pageA.fill('input[type="text"]', "PlayerA");
  await sleep(200);

  // Click create
  await pageA.click('button:has-text("创建")');

  // Wait for room code
  const hasRoomCode = await waitForText(pageA, "房间码", 15000);
  console.log("[Test] Browser A room screen loaded:", hasRoomCode);

  // Extract room code
  const contentA = await pageA.content();
  const codeMatch = contentA.match(/[A-Z0-9]{6}/);
  const roomCode = codeMatch ? codeMatch[0] : null;
  console.log("[Test] Room code:", roomCode);

  if (!roomCode) {
    console.error("[Test] Failed to get room code. Screenshot: /tmp/browser-a-error.png");
    await pageA.screenshot({ path: "/tmp/browser-a-error.png", fullPage: true });
    await browserA.close();
    process.exit(1);
  }

  // Wait for PlayerA to appear
  const playerAVisible = await waitForText(pageA, "PlayerA", 10000);
  console.log("[Test] PlayerA visible in Browser A:", playerAVisible);

  // Browser B: join room
  console.log("[Test] Launching Browser B...");
  const browserB = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
  });
  const pageB = await browserB.newPage();
  await pageB.goto(BASE_URL);
  await sleep(2000);

  // Click 联机游戏
  await pageB.click('button:has-text("联机游戏")');
  await sleep(500);

  // Click 加入房间
  await pageB.click('button:has-text("加入房间")');
  await sleep(500);

  // Fill name
  const nameInputs = await pageB.locator('input[type="text"]').all();
  if (nameInputs.length >= 1) await nameInputs[0].fill("PlayerB");
  await sleep(200);

  // Fill room code
  if (nameInputs.length >= 2) await nameInputs[1].fill(roomCode);
  await sleep(200);

  // Click join
  await pageB.click('button:has-text("加入")');

  // Wait for PlayerB to appear
  const playerBVisible = await waitForText(pageB, "PlayerB", 15000);
  console.log("[Test] PlayerB visible in Browser B:", playerBVisible);

  // Wait for sync
  await sleep(5000);

  // Check if A sees B
  const contentA2 = await pageA.content();
  const bInA = contentA2.includes("PlayerB");
  console.log("[Test] PlayerB visible in Browser A:", bInA);

  // Check if B sees A
  const contentB = await pageB.content();
  const aInB = contentB.includes("PlayerA");
  console.log("[Test] PlayerA visible in Browser B:", aInB);

  // Screenshots
  await pageA.screenshot({ path: "/tmp/browser-a.png", fullPage: true });
  await pageB.screenshot({ path: "/tmp/browser-b.png", fullPage: true });

  // Get page text for debugging
  const textA = await pageA.evaluate(() => document.body.innerText);
  const textB = await pageB.evaluate(() => document.body.innerText);
  console.log("[Test] Browser A text (first 500 chars):", textA.slice(0, 500));
  console.log("[Test] Browser B text (first 500 chars):", textB.slice(0, 500));

  await browserA.close();
  await browserB.close();

  if (!playerAVisible || !playerBVisible || !bInA || !aInB) {
    console.error("[Test] FAILED: Players cannot see each other");
    process.exit(1);
  }

  console.log("[Test] PASSED: Both players can see each other");
}

runTest().catch((err) => {
  console.error("[Test] Error:", err);
  process.exit(1);
});
