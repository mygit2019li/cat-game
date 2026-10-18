/* check_mouse_fullscreen.js — 验证捕鼠全屏化：地台上移、洞口网格铺满全屏、老鼠全屏出没 */
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOD_NAMES = [
  "./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./game.js"
];

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 852, height: 393 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const modules = {};
  for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(300);

  const out = await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "mouse"; G.config.preyCount = 3;
    G.startGame();
    G.session.stage = 3; G.topUpPreys();
    const S = G.scene, H = S.H;
    const ys = S.holes.map(h => h.y);
    const xs = S.holes.map(h => h.x);
    return {
      H,
      floorYRatio: +(S.floorY / H).toFixed(2),                 // 应 ≈0.2
      holeCount: S.holes.length,                               // 应 9~12
      minYRatio: +(Math.min(...ys) / H).toFixed(2),            // 顶部洞应 <0.5H
      maxYRatio: +(Math.max(...ys) / H).toFixed(2),            // 底部洞应 >0.8H
      xSpreadRatio: +((Math.max(...xs) - Math.min(...xs)) / S.W).toFixed(2),  // 横向铺开
      mouseCount: G.preys.length,
      mouseRows: [...new Set(G.preys.map(p => Math.round(p.hole.y / 60)))].length  // 老鼠分布在不同高度
    };
  });
  console.log("RESULT " + JSON.stringify(out));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "mouse-fullscreen.png") });
  console.log("ERRORS " + errors.length + (errors.length ? " " + errors.join(" | ") : ""));
  const ok = out.floorYRatio <= 0.25 && out.holeCount >= 9 && out.holeCount <= 12
    && out.minYRatio < 0.5 && out.maxYRatio > 0.8 && out.xSpreadRatio > 0.6
    && out.mouseCount === 7 && errors.length === 0;
  console.log("COND", JSON.stringify({
    floor: out.floorYRatio <= 0.25,
    cnt: out.holeCount >= 9 && out.holeCount <= 12,
    minY: out.minYRatio < 0.5,
    maxY: out.maxYRatio > 0.8,
    spread: out.xSpreadRatio > 0.6,
    mice: out.mouseCount === 7,
    errs: errors.length === 0
  }));
  console.log(ok ? "ALL PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
