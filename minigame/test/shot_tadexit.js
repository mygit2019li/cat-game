/* shot_tadexit.js — 出图：蝌蚪「游出边框」离场动画
   ① tad-exit-mid.png    头已过边、尾链还在可见区（身体正"从画框后面穿走"）
   ② tad-exit-late.png   大部分已出框，只剩尾巴梢在边内（即将完全消失）
   用法：NODE_PATH=/tmp/ffshot/node_modules node test/shot_tadexit.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./js/ad.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
const WX_MOCK = `
  (function(){ const wx = window.wx;
    wx.shareAppMessage=()=>{}; wx.onShareAppMessage=()=>{}; wx.showShareMenu=()=>{};
    wx.showToast=()=>{}; wx.showModal=()=>{}; wx.reportAnalytics=()=>{}; wx.reportEvent=()=>{};
    HTMLCanvasElement.prototype.toTempFilePathSync=function(){return this.toDataURL("image/jpeg",0.9);};
  })();`;
const land = { windowWidth: 844, windowHeight: 390, pixelRatio: 2,
  safeArea: { left: 47, top: 0, right: 797, bottom: 369 } };

(async () => {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  page.on("pageerror", e => console.log("ERR " + e.message));
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, land);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(WX_MOCK);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "tadpole"; G.config.bg_tadpole = "paper";
    G.config.preyCount = 1; G.config.tadCount = 1; G.config.tadStyle = "ink"; G.config.duration = 60;
    G.startGame(); G.session.counting = false; G.session.running = true;
    G.switchScreen("playing");
    G.session.stage = 1;
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => new Promise(r => {
    const G = window.G;
    (function w() {
      if (G.preys && G.preys.length >= 1) { G.preys.splice(1); r(G.preys.length); return; }
      setTimeout(w, 100);
    })();
  }));

  /* 手动控制离场序列：把蝌蚪放到接近右边、朝右，触发 tadEscape，
     然后逐帧推进到指定 vanishT 比例时冻结截图。 */
  const setupExit = () => page.evaluate(() => {
    const G = window.G, b = G.bounds(), p = G.preys[0];
    if (!p) return false;
    p.tState = "swim";
    p.vanishT = 0; p.darkT = 0; p.fade = 1;
    p.tadIn = 0; p.tadFold = 0; p.tadNoFoldT = 0;
    p.tadBlinkSeed = 0; p.tadHover = 0; p.tadHoverT = 0; p.tadHoverK = 1;
    p.tadType = "pass"; p.tadFolds = 99; p.tadForceOut = false;
    p.tadAng = 0.06; p.driftAng = 0.06; p.crawlAng = 0.06;
    /* 放在右边稍内，朝右游——下一帧触边即 tadEscape */
    p.x = b.x + b.w - 2; p.y = b.y + b.h * 0.45;
    p.tadMissed = false; p.tadOut = false;
    p.trail.length = 0; p.segs.length = 0;
    /* 先攒一些尾链：模拟已游了一段 */
    const ca = Math.cos(p.tadAng), sa = Math.sin(p.tadAng);
    for (let i = 1; i <= 40; i++) p.trail.push({ x: p.x - ca * i * 2, y: p.y - sa * i * 2 });
    return true;
  });

  /* 推进 N 帧后冻结并返回 vanishT 比例 */
  const stepAndFreeze = (frames) => page.evaluate((n) => new Promise(resolve => {
    const G = window.G;
    let cnt = 0;
    (function step() {
      cnt++;
      const p = G.preys[0];
      if (p && p.tadOut && p.vanishT > 0) {
        /* 继续让 updateTadpole 跑（离离场分支会推进 x/y） */
        if (cnt >= n) {
          G.session.paused = true;
          resolve({ vt: p.vanishT, x: p.x, y: p.y, ox: G.bounds().x + G.bounds().w });
          return;
        }
      }
      if (cnt > 120) { resolve(null); return; }
      requestAnimationFrame(step);
    })();
  }), frames);

  /* ---------- ① 离场中段：头已过边、尾链还在 ---------- */
  await setupExit();
  await page.waitForTimeout(50);  // 让一帧触边 → tadEscape
  const r1 = await stepAndFreeze(8);  // ~8帧 ≈ 0.13s → vanishT ≈ 0.34-0.13=0.21 → 62% 已出
  await page.screenshot({ path: path.join(OUT, "tad-exit-mid.png") });
  console.log("① exit-mid:", r1 ? `ok vt=${r1.vt.toFixed(3)} x=${r1.x.toFixed(1)} bound=${r1.ox.toFixed(1)}` : "FAIL");
  await page.evaluate(() => { window.G.session.paused = false; });

  /* ---------- ② 离场末段：只剩尾梢 ---------- */
  await setupExit();
  await page.waitForTimeout(50);
  const r2 = await stepAndFreeze(16); // ~16帧 ≈ 0.27s → vanishT ≈ 0.34-0.27=0.07 → 79% 已出
  await page.screenshot({ path: path.join(OUT, "tad-exit-late.png") });
  console.log("② exit-late:", r2 ? `ok vt=${r2.vt.toFixed(3)} x=${r2.x.toFixed(1)} bound=${r2.ox.toFixed(1)}` : "FAIL");

  await browser.close();
})();
