/* check_bfly_sheet.js — 新版蝴蝶花色图鉴（写实淡色系）矢量渲染目检 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "检查截图");

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
  const page = await browser.newPage({ viewport: { width: 1100, height: 260 } });
  const modNames = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js", "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./game.js"];
  const modules = {};
  for (const n of modNames) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const G = window.G;
    const cv = document.createElement("canvas");
    cv.width = 1100; cv.height = 260; cv.id = "bflySheet";
    cv.style.cssText = "position:fixed;inset:0;z-index:99;background:linear-gradient(#eef7e8,#d8ecce)";
    document.body.appendChild(cv);
    const c = cv.getContext("2d");
    c.fillStyle = "#eef7e8"; c.fillRect(0, 0, 1100, 260);
    const seen = new Set();
    let x = 70;
    G.BFLY_VARIANTS.forEach((v, i) => {
      if (seen.has(v.name + v.size)) return;
      seen.add(v.name + v.size);
      c.save();
      c.translate(x, 130);
      const k = 1.15 * (v.size || 1);
      c.scale(k, k);
      const fake = { bflyVar: v, state: "GLIDE", flapDur: 0.28, phase: i * 0.9, faceDir: 1 };
      G.draw.butterfly(c, fake, 1.2);
      c.restore();
      c.fillStyle = "#2a3a2a"; c.font = "15px sans-serif"; c.textAlign = "center";
      c.fillText(v.name + " ×w" + (v.w || 1), x, 240);
      x += 200;
    });
  });
  await page.waitForTimeout(200);
  await (await page.$("#bflySheet")).screenshot({ path: path.join(OUT, "bfly-variant-sheet-v2.png") });
  await browser.close();
  console.log("saved 检查截图/bfly-variant-sheet-v2.png");
})();
