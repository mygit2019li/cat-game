/* shot_promo.js — 以 2x 尺寸(680x400)渲染真实游戏画面，供 340x200 宣传图使用 */
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "generated-images");
fs.mkdirSync(OUT, { recursive: true });

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOD_NAMES = [
  "./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/sharecard.js", "./js/ui.js", "./js/feeder.js", "./game.js"
];

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 680, height: 400 } });

  const modules = {};
  for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(500);

  // 进入捕鱼对局（默认玩法），等倒计时结束
  await page.evaluate(() => { window.G.startGame(); });
  await page.waitForTimeout(4200);
  await page.evaluate(() => {
    const G = window.G;
    G.session.remaining = 95; G.session.hits = 14; G.session.combo = 7;
    if (G.pokeHud) G.pokeHud();
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, "promo_src_fish.png") });
  console.log("saved promo_src_fish.png");
  await browser.close();
})().catch(e => { console.error("FAIL", e); process.exit(1); });
