/* check_small_screen_size.js — 验证小屏鱼/鼠缩小（鱼额外横向收窄）、大屏不受影响 */
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOD_NAMES = [
  "./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/sharecard.js", "./js/ui.js", "./js/feeder.js", "./game.js"
];

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });
  async function probe(viewport) {
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
      const res = { S: +(G.platform.S || 1).toFixed(3) };
      G.config.preyCount = 3;
      G.config.targetType = "fish";
      G.startGame(); G.session.stage = 3; G.topUpPreys();
      res.fishSc = +G.preys[0].sc.toFixed(3);
      res.fishSx = G.preys[0].sxMul;
      G.clearPreys(); G.config.targetType = "mouse";
      G.startGame();
      res.mouseSc = +G.preys[0].sc.toFixed(3);
      G.clearPreys();
      return res;
    });
    r.errors = errors.length;
    await page.close();
    return r;
  }
  const small = await probe({ width: 852, height: 393 });   // 手机横屏，S≈1.01
  const big = await probe({ width: 1024, height: 768 });    // iPad，S≈1.55
  console.log("SMALL " + JSON.stringify(small));
  console.log("BIG   " + JSON.stringify(big));
  // 小屏：鱼 sc = 1.01*0.9 ≈ 0.908，sx=0.9；鼠 sc ≈ 1.01*0.93 ≈ 0.938
  // 大屏：鱼 sc = 1.55...*1 = 无缩，sx=1
  const ok = Math.abs(small.fishSc - 0.908) < 0.02 && small.fishSx === 0.9
    && Math.abs(small.mouseSc - 0.938) < 0.02
    && big.fishSx === 1 && big.fishSc > 1.1 && big.errors === 0 && small.errors === 0;
  console.log(ok ? "ALL PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
