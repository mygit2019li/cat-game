/* 群鼠卡片放大核对：4 个面板 = 3 只卡片鼠（各自原角度）+ 1 只 rot=0 参照，逐只大尺寸看头尾 */
const fs = require("fs");
const path = require("path");
const pc = (function () {
  for (const p of ["/Users/lipeng/node_modules/playwright-core", "/tmp/ffshot/node_modules/playwright-core"]) {
    try { return require(p); } catch (e) { /* 试下一个 */ }
  }
  throw new Error("找不到 playwright-core");
})();
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 800 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForFunction(() => {
    const D = window.G && window.G.draw;
    const v = D && D.MICEHD && D.MICEHD.video;
    return v && v.house && v.house.length === 16 && v.house[0] && v.house[0].ok;
  }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const G = window.G;
    const cv = document.createElement("canvas");
    cv.width = 1600; cv.height = 800;
    cv.style.cssText = "position:fixed;left:0;top:0;z-index:9999;background:#fff";
    document.body.appendChild(cv);
    const c = cv.getContext("2d");
    const panels = [
      { label: "鼠1  rot=π/2",        rot: Math.PI / 2 },
      { label: "鼠2  rot=-π/2+0.3",   rot: -Math.PI / 2 + 0.3 },
      { label: "鼠3  rot=0.2",        rot: 0.2 },
      { label: "参照  rot=0",         rot: 0 }
    ];
    panels.forEach((P, i) => {
      const px = i * 400, py = 0, pw = 400, ph = 800;
      c.fillStyle = i % 2 ? "#eef2ee" : "#ffffff";
      c.fillRect(px, py, pw, ph);
      c.save();
      c.translate(px + pw / 2, py + ph / 2 - 20);
      c.rotate(P.rot);
      c.scale(2.6, 2.6);
      c.translate(-60, -50);
      G.draw.mouseTop(c, { phase: 3 }, 1.2);
      c.restore();
      c.fillStyle = "#222"; c.font = "26px sans-serif"; c.textAlign = "center";
      c.fillText(P.label, px + pw / 2, 780);
    });
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(OUT, "card-mice-zoom.png"), clip: { x: 0, y: 0, width: 1600, height: 800 } });
  console.log("done | errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
