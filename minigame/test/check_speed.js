/* check_speed.js — 验证标准/激烈难度下蝴蝶与老鼠的额外提速 */
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
  const page = await browser.newPage({ viewport: { width: 852, height: 393 } });
  const modules = {};
  for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(300);

  const out = await page.evaluate(() => {
    const G = window.G;
    const res = {};
    ["easy", "normal", "hard"].forEach(diff => {
      G.config.difficulty = diff;
      ["butterfly", "mouse"].forEach(tp => {
        G.clearPreys();
        G.config.targetType = tp;
        G.startGame();
        res[diff + ":" + tp] = G.preys.map(p => +p.speedMul.toFixed(4));
      });
    });
    G.clearPreys();
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error("FAIL", e); process.exit(1); });
