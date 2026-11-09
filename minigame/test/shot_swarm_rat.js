/* 群鼠乱窜（俯视群鼠）截图验证：确认粉色长尾笔直拖在身体正后方。
   跑法：node test/shot_swarm_rat.js */
const fs = require("fs");
const path = require("path");
const pc = (function () {
  for (const p of ["/Users/lipeng/node_modules/playwright-core", "/tmp/ffshot/node_modules/playwright-core"]) {
    try { return require(p); } catch (e) { /* 试下一个 */ }
  }
  throw new Error("找不到 playwright-core（可先跑：mkdir -p /tmp/ffshot && cd /tmp/ffshot && npm i playwright-core）");
})();
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/feeder.js", "./game.js"];

(async () => {
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "mouse"; G.config.bg_mouse = "swarm";
    G.config.infinite = true;
    G.layout = null; G.startGame();
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    if (await page.evaluate(() => window.G.screen === "playing")) break;
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(500);

  // ① 全群同屏（保留自然朝向，看尾巴是否都拖在各自身后）
  await page.screenshot({ path: path.join(OUT, "ref-6-swarm-all.png") });

  // ② 固定一只居中、头朝上，便于核对尾巴笔直
  await page.evaluate(() => {
    const G = window.G;
    const b = G.bounds();
    const p = G.preys[0];
    G.preys.forEach((q, i) => { if (i > 0) { q.fade = 0; q.vanishT = 0; } });
    p.x = b.x + b.w / 2; p.y = b.y + b.h * 0.45;
    p.fade = 1; p._visAng = 0; p.vanishT = 0;
    G.session.running = false;
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, "ref-7-swarm-solo.png") });
  console.log("群鼠截图完成 | errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
