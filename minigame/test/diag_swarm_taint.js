/* 诊断：群鼠启动后 getImageData SecurityError 的准确来源
   跑法：node test/diag_swarm_taint.js */
const fs = require("fs");
const path = require("path");
const pc = (function () {
  for (const p of ["/Users/lipeng/node_modules/playwright-core", "/tmp/ffshot/node_modules/playwright-core"]) {
    try { return require(p); } catch (e) {}
  }
  throw new Error("找不到 playwright-core");
})();
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];

(async () => {
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e && e.stack || e)));
  page.on("console", msg => { if (msg.type() === "error") errors.push("console: " + msg.text()); });

  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(300);

  // 包裹 2D context 的 getImageData：一旦抛 SecurityError，记录调用栈 + 画布尺寸
  await page.evaluate(() => {
    const orig = CanvasRenderingContext2D.prototype.getImageData;
    let n = 0;
    CanvasRenderingContext2D.prototype.getImageData = function (...a) {
      n++;
      try { return orig.apply(this, a); }
      catch (e) {
        const cv = this.canvas;
        (window.__taint = window.__taint || []).push({
          n, w: cv.width, h: cv.height,
          src: cv.src ? String(cv.src).slice(-60) : (cv.id ? "id=" + cv.id : "anonymous"),
          stack: String(e && e.stack || e)
        });
        throw e;
      }
    };
    window.__imgDataCalls = () => n;
  });

  // 启动群鼠
  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "mouse";
    G.openBgPick();
    const arr = G.bgsFor("mouse");
    G.bgPick.idx = arr.findIndex(b => b.key === "swarm");
    G.confirmBgPick();
  });

  // 等 playing
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    const s = await page.evaluate(() => window.G.screen);
    if (s === "playing") break;
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(6000);

  const diag = await page.evaluate(() => ({
    screen: window.G.screen,
    calls: window.__imgDataCalls(),
    taint: window.__taint || []
  }));
  console.log("screen:", diag.screen, "getImageData 调用次数:", diag.calls);
  console.log("taint 事件:", diag.taint.length);
  diag.taint.slice(0, 3).forEach((t, i) => {
    console.log(`\n--- 第 ${i + 1} 次 (${t.n}) 画布 ${t.w}x${t.h} ${t.src} ---`);
    console.log(t.stack.split("\n").slice(0, 8).join("\n"));
  });

  console.log("\n=== 全部错误 ===");
  [...new Set(errors)].slice(0, 5).forEach(e => console.log("❌", e));
  if (!errors.length) console.log("✅ 无错误");
  await browser.close();
})();
