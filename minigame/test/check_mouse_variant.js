/* check_mouse_variant.js — 老鼠花色渲染检查：5 花色图鉴 + 游戏内实况截图 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "..", "检查截图", "mouse-variant");
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

  // 注入模块源码（game.js 在页面加载后手动 require）
  const modNames = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js", "./js/scenery.js", "./js/prey.js", "./js/sharecard.js", "./js/ui.js", "./js/feeder.js", "./game.js"];
  const modules = {};
  for (const n of modNames) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.addInitScript(m => { window.__MODULES__ = m; }, modules);

  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(400);

  // ---- 1) 花色图鉴：5 只并排（peek 姿态 + 嗅探中帧）----
  await page.evaluate(() => {
    const G = window.G;
    const cv = document.createElement("canvas");
    cv.width = 640; cv.height = 152;
    cv.id = "variantSheet";
    cv.style.cssText = "position:fixed;inset:0;z-index:99;background:#f4ead8";
    document.body.appendChild(cv);
    const c = cv.getContext("2d");
    c.fillStyle = "#f4ead8"; c.fillRect(0, 0, 640, 152);
    G.MOUSE_VARIANTS.forEach((v, i) => {
      c.save();
      c.translate(i * 128 + 64, 88);
      c.scale(0.92, 0.92);
      const fake = { state: "peek", phase: i * 0.8, mouseVar: v };
      G.draw.mouse(c, fake, 1.7);
      c.restore();
      c.fillStyle = "#3b2f22"; c.font = "12px sans-serif"; c.textAlign = "center";
      c.fillText(v.name, i * 128 + 64, 144);
    });
  });
  await page.waitForTimeout(120);
  const sheet = await page.$("#variantSheet");
  await sheet.screenshot({ path: path.join(OUT, "variant-sheet.png") });

  // ---- 2) 游戏内实况：与真实按钮同一调用链（选捕鼠 → startGame）----
  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "mouse";
    G.startGame();
  });
  await page.waitForTimeout(3400);   // 等倒计时结束进 playing，老鼠探头
  // 强制所有活体老鼠展示不同花色
  await page.evaluate(() => {
    const G = window.G, vs = G.MOUSE_VARIANTS;
    (G.preys || []).forEach((p, i) => { if (p.type === "mouse") p.mouseVar = vs[i % vs.length]; });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "in-game.png") });

  // ---- 断言 ----
  const assert = await page.evaluate(() => {
    const G = window.G;
    return {
      variants: G.MOUSE_VARIANTS.length,
      inGame: G.screen,
      preyCount: (G.preys || []).length,
      preyVars: (G.preys || []).filter(p => p.type === "mouse").map(p => p.mouseVar && p.mouseVar.key)
    };
  });
  console.log("ASSERT:", JSON.stringify(assert));
  console.log("pageerrors:", errors.length, errors.join(" | "));
  console.log(errors.length === 0 ? "ALL PASS" : "FAIL");
  await browser.close();
})();
