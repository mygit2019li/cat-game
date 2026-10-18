/* check_laser_variants.js — 验证三种激光花色（红/翠绿/青柠）+ 大屏光点放大 */
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
  // 大屏（iPad 比例 1024x768 → S≈1.55）验证光点放大
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const modules = {};
  for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(400);

  const out = await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "laser"; G.config.preyCount = 3;
    G.startGame();
    // 强制三种花色各一个，便于目检
    const keys = ["red", "green", "lime"];
    G.preys.forEach((p, i) => {
      const v = G.LASER_VARIANTS.find(x => x.key === keys[i]);
      p.laserVar = v; p.speciesSpeed = v.speed;
      p.baseW = Math.round(p.def.w * v.size); p.baseH = Math.round(p.def.h * v.size);
      p.state = "hold"; p.stateT = 0; p.stateDur = 3;
      p.applySize();
    });
    return {
      S: +(G.platform.S || 1).toFixed(2),
      laserBig: +G.preys[0].sc.toFixed(3),                 // 大屏下激光 sc
      speeds: G.preys.map(p => p.def.speed * p.speciesSpeed),
      variants: G.preys.map(p => p.laserVar.name)
    };
  });
  console.log("STAT " + JSON.stringify(out));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "laser-variants-big.png") });
  console.log("ERRORS " + errors.length + (errors.length ? " " + errors.join(" | ") : ""));
  await browser.close();
})().catch(e => { console.error("FAIL", e); process.exit(1); });
