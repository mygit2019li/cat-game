/* shot_laser_green.js — 激光双色验证：默认 3 点（红绿混合），强制 1 个绿点便于目检 */
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
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

  const modules = {};
  for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "laser";
    G.startGame();
  });
  await page.waitForTimeout(4200);
  // 统计随机花色分布 + 强制第 0 个为绿点便于目检
  const stat = await page.evaluate(() => {
    const G = window.G;
    const dist = {};
    (G.preys || []).forEach(p => { const k = p.laserVar ? p.laserVar.key : "?"; dist[k] = (dist[k] || 0) + 1; });
    const g = G.LASER_VARIANTS[1];
    const p0 = G.preys[0];
    p0.laserVar = g; p0.speciesSpeed = g.speed;
    p0.baseW = Math.round(p0.def.w * g.size); p0.baseH = Math.round(p0.def.h * g.size);
    p0.applySize();
    // 让它处于 hold 状态更容易看清（停留窗口）
    p0.state = "hold"; p0.stateT = 0; p0.stateDur = 3;
    return { count: (G.preys || []).length, dist, speed: p0.def.speed * g.speed };
  });
  console.log("STAT " + JSON.stringify(stat));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "laser-green.png") });
  console.log("ERRORS " + errors.length + " " + errors.join(" | "));
  console.log(errors.length === 0 ? "ALL PASS" : "FAIL");
  await browser.close();
})().catch(e => { console.error("FAIL", e); process.exit(1); });
