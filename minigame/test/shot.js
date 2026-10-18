/* shot.js — 用 test/harness.html 在本地浏览器渲染游戏并截图（首页 + 四种玩法） */
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

async function loadPage(browser) {
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
  return { page, errors };
}

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });

  // 1) 首页
  let { page, errors } = await loadPage(browser);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "home.png") });
  console.log("home errors:", errors.length ? errors.join(" | ") : "none");
  await page.close();

  // 2) 四种玩法
  const targets = ["fish", "butterfly", "mouse", "laser"];
  for (const t of targets) {
    ({ page, errors } = await loadPage(browser));
    await page.evaluate(tt => {
      const G = window.G;
      G.config.targetType = tt;
      if (G.startGame) G.startGame();
    }, t);
    await page.waitForTimeout(4200); // 等 3.6s 倒计时结束并渲染对局
    await page.evaluate(() => {
      const G = window.G;
      if (G.session) {
        G.session.remaining = 95;
        G.session.hits = 14;
        G.session.combo = 7;
      }
      if (G.pokeHud) G.pokeHud();
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, t + ".png") });
    console.log(t + " errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  await browser.close();
  console.log("DONE ->", OUT);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
