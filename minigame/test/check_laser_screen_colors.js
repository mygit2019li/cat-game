/* check_laser_screen_colors.js — 验证大/小屏激光配色不同且各自成套 */
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
  async function probe(viewport, shotName) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    const modules = {};
    for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
    await page.goto("file://" + path.join(ROOT, "test/harness.html"));
    await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
    await page.evaluate(() => { window.require("./game.js"); });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const G = window.G;
      G.config.targetType = "laser"; G.config.preyCount = 3;
      G.startGame();
      // 强制红绿花色各一，便于目检
      const keys = ["red", "green"];
      G.preys.forEach((p, i) => {
        const v = G.LASER_VARIANTS.find(x => x.key === keys[i]);
        if (!v) return;   // 第 3 个光点保留随机花色
        p.laserVar = v; p.speciesSpeed = v.speed;
        p.state = "hold"; p.stateT = 0; p.stateDur = 3;
        p.applySize();
      });
      const cs = G.laserColorSet();
      return {
        S: +(G.platform.S || 1).toFixed(3),
        redSpark: cs.red.spark, greenSpark: cs.green.spark,
        hasLime: !!cs.lime, variantKeys: G.LASER_VARIANTS.map(v => v.key)
      };
    });
    r.errors = errors.length;
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, shotName) });
    await page.close();
    return r;
  }
  const small = await probe({ width: 852, height: 393 }, "laser-colors-small.png");
  const big = await probe({ width: 1024, height: 768 }, "laser-colors-big.png");
  console.log("SMALL " + JSON.stringify(small));
  console.log("BIG   " + JSON.stringify(big));
  const ok = small.S < 1.15 && big.S >= 1.15
    && small.redSpark !== big.redSpark && small.greenSpark !== big.greenSpark
    && !small.hasLime && !big.hasLime
    && small.variantKeys.join(",") === "red,green" && big.variantKeys.join(",") === "red,green"
    && small.errors === 0 && big.errors === 0;
  console.log(ok ? "ALL PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
