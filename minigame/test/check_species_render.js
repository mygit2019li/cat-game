/* check_species_render.js — 品种/花色渲染检查：鱼 10 种图鉴 + 老鼠 5 花色图鉴 + 游戏内实况 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "检查截图", "species-render");
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
  await page.waitForTimeout(400);

  // ---- 图鉴 1：10 种鱼并排（各自设计空间 120×72，2x 缩放）----
  await page.evaluate(() => {
    const G = window.G;
    const cv = document.createElement("canvas");
    cv.width = 1240; cv.height = 200; cv.id = "fishSheet";
    cv.style.cssText = "position:fixed;inset:0;z-index:99;background:linear-gradient(#bfe6f2,#8fd0e8)";
    document.body.appendChild(cv);
    const c = cv.getContext("2d");
    c.fillStyle = "#bfe6f2"; c.fillRect(0, 0, 1240, 200);
    G.FISH_SPECIES.forEach((sp, i) => {
      const v = sp.variants[0];
      c.save();
      c.translate(i * 124 + 62, 100);
      const k = Math.min(112 / sp.w, 72 / sp.h, 1) * 1.5;   // 统一视觉大小
      c.scale(k, k);
      const fake = { species: sp, speciesColors: v, wagDur: 0.5, phase: i * 0.7, state: "FLAP" };
      G.draw.fish(c, fake, 1.3);
      c.restore();
      c.fillStyle = "#123"; c.font = "13px sans-serif"; c.textAlign = "center";
      c.fillText(sp.name, i * 124 + 62, 190);
    });
  });
  await page.waitForTimeout(150);
  await (await page.$("#fishSheet")).screenshot({ path: path.join(OUT, "fish-sheet.png") });

  // ---- 图鉴 2：老鼠 5 花色 ----
  await page.evaluate(() => {
    const G = window.G;
    const cv = document.createElement("canvas");
    cv.width = 660; cv.height = 160; cv.id = "mouseSheet";
    cv.style.cssText = "position:fixed;inset:0;z-index:99;background:#f4ead8";
    document.body.appendChild(cv);
    const c = cv.getContext("2d");
    c.fillStyle = "#f4ead8"; c.fillRect(0, 0, 660, 160);
    G.MOUSE_VARIANTS.forEach((v, i) => {
      c.save();
      c.translate(i * 132 + 66, 92);
      c.scale(0.95, 0.95);
      G.draw.mouse(c, { state: "peek", phase: i * 0.8, mouseVar: v }, 1.7);
      c.restore();
      c.fillStyle = "#3b2f22"; c.font = "13px sans-serif"; c.textAlign = "center";
      c.fillText(v.name, i * 132 + 66, 150);
    });
  });
  await page.waitForTimeout(150);
  await (await page.$("#mouseSheet")).screenshot({ path: path.join(OUT, "mouse-sheet.png") });

  // ---- 游戏内实况：捕鱼模式（构造指定品种）----
  page.on("framenavigated", f => console.log("NAVIGATED ->", f.url()));
  console.log("PRE-RM url:", page.url(), "frames:", page.frames().length);
  const rmLog = await page.evaluate(() => {
    const log = ["fishSheet", "mouseSheet"].map(id => {
      const el = document.getElementById(id);
      if (el) { el.remove(); return id + ":" + (document.getElementById(id) ? "STILL_THERE" : "removed"); }
      return id + ":missing";
    });
    const G = window.G;
    G.config.targetType = "fish";
    G.startGame();
    return log;
  });
  console.log("RM " + JSON.stringify(rmLog));
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    const G = window.G, sp = G.FISH_SPECIES;
    (G.preys || []).forEach((p, i) => {
      if (p.type === "fish") {
        p.species = sp[i % sp.length];
        p.speciesColors = p.species.variants[0];
        p.speciesScale = (p.species.w || 120) / 120;
      }
    });
  });
  await page.waitForTimeout(400);
  const domState = await page.evaluate(() => ({
    sheets: [!!document.getElementById("fishSheet"), !!document.getElementById("mouseSheet")],
    children: [...document.body.children].map(e => e.id || e.tagName)
  }));
  console.log("DOM " + JSON.stringify(domState));
  await page.screenshot({ path: path.join(OUT, "in-game-fish.png") });

  const assert = await page.evaluate(() => {
    const G = window.G;
    return {
      fishSpecies: G.FISH_SPECIES.map(s => s.key),
      mouseVariants: G.MOUSE_VARIANTS.map(v => v.key),
      screen: G.screen,
      preyTypes: (G.preys || []).map(p => p.type)
    };
  });
  console.log("ASSERT " + JSON.stringify(assert));
  console.log("ERRORS " + errors.length + " " + errors.join(" | "));
  console.log(errors.length === 0 ? "ALL PASS" : "FAIL");
  await browser.close();
})().catch(e => { console.error("SCRIPT FAIL", e); process.exit(1); });
