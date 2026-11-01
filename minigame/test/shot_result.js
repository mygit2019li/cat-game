/* shot_result.js — 渲染结算页验证：三按钮（再来一局/分享好友/返回首页） */
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

  // 打一局有成绩的：开始后模拟若干次点击，再强制结束
  await page.evaluate(() => { window.G.startGame(); });
  await page.waitForTimeout(4000);
  for (let i = 0; i < 6; i++) {
    await page.mouse.click(300 + i * 60, 200);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => { window.G.endGame(true); });
  await page.waitForTimeout(300);
  const res = await page.evaluate(() => {
    const G = window.G;
    return { screen: G.screen, result: G.result, shareFn: typeof G.shareResult, platformShare: typeof G.platform.shareApp };
  });
  console.log("STATE " + JSON.stringify(res));
  await page.screenshot({ path: path.join(OUT, "result-share.png") });
  console.log("ERRORS " + errors.length + " " + errors.join(" | "));
  console.log(errors.length === 0 ? "ALL PASS" : "FAIL");
  await browser.close();
})().catch(e => { console.error("FAIL", e); process.exit(1); });
