/* check_bfly_variant.js — 蝴蝶花色渲染检查：6 花色图鉴（真实相对体型）+ 游戏内实况 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "检查截图", "bfly-variant");
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

  const modNames = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js", "./js/scenery.js", "./js/prey.js", "./js/sharecard.js", "./js/ui.js", "./js/feeder.js", "./game.js"];
  const modules = {};
  for (const n of modNames) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(400);

  // ---- 图鉴：6 花色并排（按各自 size 缩放，呈现真实相对体型）----
  await page.evaluate(() => {
    const G = window.G;
    const cv = document.createElement("canvas");
    cv.width = 840; cv.height = 240; cv.id = "bflySheet";
    document.body.appendChild(cv);
    const c = cv.getContext("2d");
    const g = c.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, "#dff3e0"); g.addColorStop(1, "#bfe6cf");
    c.fillStyle = g; c.fillRect(0, 0, 840, 240);
    G.BFLY_VARIANTS.forEach((v, i) => {
      const x = i * 140 + 70, k = v.size * 1.35;
      c.save();
      c.translate(x - 60 * k, 105 - 56 * k);   // 身体中心对齐 (x,105)
      c.scale(k, k);
      G.draw.butterfly(c, { state: "GLIDE", phase: i * 0.9, bflyVar: v, flapDur: 0.28 }, 1.2);
      c.restore();
      c.fillStyle = "#2a3a2e"; c.font = "13px sans-serif"; c.textAlign = "center";
      c.fillText(v.name, x, 208);
      c.font = "11px sans-serif"; c.fillStyle = "#5a6a5e";
      c.fillText("体型 ×" + v.size.toFixed(2) + " · 速度 ×" + v.speed.toFixed(2), x, 226);
    });
  });
  await page.waitForTimeout(150);
  await (await page.$("#bflySheet")).screenshot({ path: path.join(OUT, "bfly-sheet.png") });

  // ---- 游戏内实况：蝴蝶花园 ----
  await page.evaluate(() => {
    const el = document.getElementById("bflySheet");
    if (el) el.remove();
    const G = window.G;
    G.config.targetType = "butterfly";
    G.startGame();
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "in-game-butterfly.png") });

  const assert = await page.evaluate(() => {
    const G = window.G;
    return {
      bflyVariants: G.BFLY_VARIANTS.map(v => v.key),
      preyVars: (G.preys || []).filter(p => p.type === "butterfly").map(p => p.bflyVar && p.bflyVar.key)
    };
  });
  console.log("ASSERT " + JSON.stringify(assert));
  console.log("ERRORS " + errors.length + " " + errors.join(" | "));
  console.log(errors.length === 0 ? "ALL PASS" : "FAIL");
  await browser.close();
})().catch(e => { console.error("SCRIPT FAIL", e); process.exit(1); });
