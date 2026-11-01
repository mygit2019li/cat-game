/* check_bfly_behavior.js — 蝴蝶行为实测：任意位置入场 / 落花 / 飞出屏幕 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");

function findChrome() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    process.env.CHROME_PATH || ""
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error("no chrome found");
}

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

  const modNames = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js", "./js/scenery.js", "./js/prey.js", "./js/sharecard.js", "./js/ui.js", "./js/feeder.js", "./game.js"];
  const modules = {};
  for (const n of modNames) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(300);

  const report = await page.evaluate(async () => {
    const G = window.G;
    G.config.targetType = "butterfly";
    G.startGame();
    G.session.counting = false; G.session.running = true; G.screen = "playing";
    await new Promise(r => setTimeout(r, 200));

    const p = G.preys[0];
    const seen = new Set();       // 状态集合
    const entries = [];           // 入场位置记录
    let rests = 0, exits = 0, lastState = p.state;
    let lastX = p.x, lastY = p.y;

    for (let i = 0; i < 300; i++) {          // 约 30s
      await new Promise(r => setTimeout(r, 100));
      const q = G.preys[0];
      if (!q) continue;
      if (q.state !== lastState) {
        seen.add(q.state);
        if (q.state === "RESTING") rests++;
        if (q.state === "EXIT") exits++;
        // 状态切换且位置发生大跳变 = 重新入场
        if (Math.hypot(q.x - lastX, q.y - lastY) > 200) {
          const b = G.bounds();
          entries.push({
            inside: q.x > b.x && q.x < b.x + b.w && q.y > b.y && q.y < b.y + b.h,
            x: Math.round(q.x), y: Math.round(q.y),
            fromBottom: q.y > b.y + b.h - 40,
            fromTop: q.y < b.y + 40,
            fromLeft: q.x < b.x + 40,
            fromRight: q.x > b.x + b.w - 40
          });
        }
        lastState = q.state;
      }
      lastX = q.x; lastY = q.y;
    }
    const b = G.bounds();
    const insideEntries = entries.filter(e => e.inside).length;
    return {
      states: [...seen],
      restCount: rests,
      exitCount: exits,
      entryCount: entries.length,
      insideEntries,
      fromBottom: entries.filter(e => e.fromBottom).length,
      fromTop: entries.filter(e => e.fromTop).length,
      fromSide: entries.filter(e => e.fromLeft || e.fromRight).length,
      flowers: G.gardenFlowers.length,
      bounds: { w: Math.round(b.w), h: Math.round(b.h) }
    };
  });

  console.log(JSON.stringify(report, null, 2));
  console.log("pageerrors:", errors.length ? errors : "none");
  await browser.close();
})();
