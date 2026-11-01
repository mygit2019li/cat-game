/* check_laser_unified.js — 验证大小屏配色一致 + 激光落点分散不重叠 */
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOD_NAMES = [
  "./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/sharecard.js", "./js/ui.js", "./js/feeder.js", "./game.js"
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
      // 暂停主循环：冻结光点位置，才能测到出生/瞬移时刻的落点间距（移动中交叉属正常玩法）
      G.session.paused = true;
      // 补到 7 点
      G.session.stage = 3; G.topUpPreys();
      const minPair = () => {
        let mn = Infinity;
        for (let i = 0; i < G.preys.length; i++)
          for (let j = i + 1; j < G.preys.length; j++)
            mn = Math.min(mn, Math.hypot(G.preys[i].x - G.preys[j].x, G.preys[i].y - G.preys[j].y));
        return +mn.toFixed(1);
      };
      const spawnMin = minPair();
      // 全员瞬移两次，检验瞬移落点分散
      G.preys.forEach(p => p.laserTeleport());
      G.preys.forEach(p => p.laserTeleport());
      const tpMin = minPair();
      return {
        S: +(G.platform.S || 1).toFixed(3),
        redSpark: G.laserColorSet().red.spark,
        greenSpark: G.laserColorSet().green.spark,
        count: G.preys.length,
        spawnMin, tpMin
      };
    });
    r.errors = errors.length;
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, shotName) });
    await page.close();
    return r;
  }
  const small = await probe({ width: 852, height: 393 }, "laser-unified-small.png");
  const big = await probe({ width: 1024, height: 768 }, "laser-unified-big.png");
  console.log("SMALL " + JSON.stringify(small));
  console.log("BIG   " + JSON.stringify(big));
  const ok = small.redSpark === big.redSpark && small.greenSpark === big.greenSpark
    && small.count === 7 && big.count === 7
    && small.spawnMin >= 120 && small.tpMin >= 120 && big.spawnMin >= 120 && big.tpMin >= 120
    && small.errors === 0 && big.errors === 0;
  console.log(ok ? "ALL PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
