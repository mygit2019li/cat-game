/* check_hud_layout.js — HUD 药丸排布局检查：上移+缩小后渲染验证（横屏 852×393，mock 胶囊在位） */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = process.env.HUD_OUT || path.resolve(ROOT, "..", "检查截图");
fs.mkdirSync(OUT, { recursive: true });

function findChrome() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    process.env.CHROME_PATH || ""
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error("no chrome found");
}

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const page = await browser.newPage({ viewport: { width: 852, height: 393 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

  const modNames = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js", "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./game.js"];
  const modules = {};
  for (const n of modNames) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(300);

  // 进入捕鱼对局，等 3s 倒计时结束
  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "fish";
    G.startGame();
  });
  await page.waitForTimeout(3600);

  // 构造 HUD 数据：非 urgent 时间、捕获数、连击（含 hot 配色档）
  const geo = await page.evaluate(() => {
    const G = window.G;
    G.session.remaining = 95;
    G.session.hits = 12;
    G.session.combo = 6;
    G.pokeHud();   // 重置变暗计时，满不透明度截图
    return {
      screen: G.screen,
      safe: G.platform.safe,
      menu: G.platform.menu,
      W: G.platform.W, H: G.platform.H
    };
  });
  console.log("GEO " + JSON.stringify(geo));
  await page.waitForTimeout(120);

  await page.screenshot({ path: path.join(OUT, "hud-compact-v2.png") });
  await page.screenshot({ path: path.join(OUT, "hud-pills-zoom.png"), clip: { x: 0, y: 0, width: 340, height: 64 } });

  console.log("ERRORS " + errors.length + " " + errors.join(" | "));
  console.log(errors.length === 0 ? "ALL PASS" : "FAIL");
  await browser.close();
})().catch(e => { console.error("SCRIPT FAIL", e); process.exit(1); });
