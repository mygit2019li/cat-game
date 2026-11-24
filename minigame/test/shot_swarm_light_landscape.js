/* 群鼠局部照明 + 发光眼 横屏验证：
   - ① 自然跑 4s，光斑跟随鼠群质心，看动态照明
   - ② 把 6 只鼠分散到 4 角 + 中央（含暗角区），看发光眼在暗处是否清晰
   跑法：node test/shot_swarm_light_landscape.js */
const fs = require("fs");
const path = require("path");
const pc = (function () {
  for (const p of ["/Users/lipeng/.workbuddy/binaries/node/workspace/node_modules/playwright-core", "/Users/lipeng/node_modules/playwright-core", "/tmp/ffshot/node_modules/playwright-core"]) {
    try { return require(p); } catch (e) { /* 试下一个 */ }
  }
  throw new Error("找不到 playwright-core（可先跑：mkdir -p /tmp/ffshot && cd /tmp/ffshot && npm i playwright-core）");
})();
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");

(async () => {
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } }); // 横屏
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
    "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
    "./js/ad.js", "./js/feeder.js", "./game.js"]) {
    mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  }
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
  // ① 自然跑 4.5s，让光斑跟随鼠群移动
  await page.waitForTimeout(4500);
  await page.screenshot({ path: path.join(OUT, "ref-light-1-follow.png") });

  // ② 6 只鼠分散到 4 角 + 中央（含暗角区），看发光眼
  await page.evaluate(() => {
    const G = window.G;
    const b = G.bounds();
    const W = b.w, H = b.h;
    const spots = [
      [0.06, 0.10], [0.94, 0.10], [0.06, 0.90], [0.94, 0.90], // 四角（暗角区）
      [0.50, 0.50],                                            // 中央
      [0.50, 0.12]                                             // 顶部
    ];
    G.preys.forEach((p, i) => {
      const s = spots[i % spots.length];
      p.x = b.x + s[0] * W; p.y = b.y + s[1] * H;
      p.fade = 1; p.vanishT = 0; p.sc = 1;
    });
    G.session.running = false;
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, "ref-light-2-corners.png") });
  console.log("横屏光斑+发光眼截图完成 | errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
