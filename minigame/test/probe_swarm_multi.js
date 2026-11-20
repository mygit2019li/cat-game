/* 群鼠乱窜 多视口测试：横屏/竖屏/平板，每个跑 5s
   跑法：node test/probe_swarm_multi.js */
const fs = require("fs");
const path = require("path");
const pc = (function () {
  for (const p of ["/Users/lipeng/node_modules/playwright-core", "/tmp/ffshot/node_modules/playwright-core"]) {
    try { return require(p); } catch (e) {}
  }
  throw new Error("找不到 playwright-core");
})();
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";

const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];

async function runOne(browser, w, h, label) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", msg => { if (msg.type() === "error") errors.push("console: " + msg.text()); });

  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "mouse";
    G.openBgPick();
    const arr = G.bgsFor("mouse");
    const swarmIdx = arr.findIndex(b => b.key === "swarm");
    G.bgPick.idx = swarmIdx;
    G.confirmBgPick();
  });

  // 等倒计时
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    const s = await page.evaluate(() => window.G.screen);
    if (s === "playing") break;
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(5000);

  const state = await page.evaluate(() => ({
    screen: window.G.screen,
    preys: window.G.preys.length,
    stage: window.G.session.stage,
    hits: window.G.session.hits
  }));
  await page.close();
  const status = errors.length ? "❌ " + errors.join(" | ") : "✅";
  console.log(`${label} (${w}×${h}): screen=${state.screen} preys=${state.preys} stage=${state.stage} hits=${state.hits} ${status}`);
}

(async () => {
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  await runOne(browser, 844, 390, "手机横屏");
  await runOne(browser, 390, 844, "手机竖屏");
  await runOne(browser, 1366, 1024, "平板横屏");
  await runOne(browser, 1024, 1366, "平板竖屏");
  await runOne(browser, 375, 812, "iPhone横屏");
  await browser.close();
})();
