/* shot_summon_hidden.js — 验证：首页无召唤入口 + 设置页有联系客服 */
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
  async function shot(viewport, name, goSettings) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    const modules = {};
    for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
    await page.goto("file://" + path.join(ROOT, "test/harness.html"));
    await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
    await page.evaluate(() => { window.require("./game.js"); });
    await page.waitForTimeout(400);
    if (goSettings) await page.evaluate(() => { window.G.screen = "settings"; });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, name) });
    console.log(name, "errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }
  await shot({ width: 852, height: 393 }, "home-land-noSummon.png", false);
  await shot({ width: 390, height: 844 }, "home-port-noSummon.png", false);
  await shot({ width: 852, height: 393 }, "settings-land-support.png", true);
  await shot({ width: 390, height: 844 }, "settings-port-support.png", true);
  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
