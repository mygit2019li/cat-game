/* shot_summon.js — 召唤猫咪页截图（竖屏）：验证性格归类 + 品种小字 + 真实照片头像 */
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOD_NAMES = [
  "./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./game.js"
];

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const modules = {};
  for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.G.switchScreen("summon"); });
  await page.waitForTimeout(900);   // 等弹入动画 + 照片异步加载
  await page.screenshot({ path: path.join(OUT, "summon-card1.png") });

  // 验证：滑动翻页不再自动播放（summonPlaying 应保持 false）
  const autoplay = await page.evaluate(() => {
    const G = window.G;
    G.summonPickTouchStart(195);
    G.summonPickTouchMove(60);
    G.summonPickTouchEnd(60);
    return { idx: G.summonPick.idx, playing: !!G.summonPlaying };
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "summon-card2.png") });

  // 验证：点卡片（活跃卡区域）才开始播放
  const tapPlay = await page.evaluate(() => {
    const G = window.G;
    const P = G.summonPick;
    const S = G.platform.S || 1;
    G.platform.onTouchStart({ touches: [{ clientX: 195 * S, clientY: 420 * S }] });
    return { playing: !!G.summonPlaying };
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "summon-card2-playing.png") });

  console.log("swipe:", JSON.stringify(autoplay), "tapCard:", JSON.stringify(tapPlay));
  console.log("errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
