/* shot_tadpeek.js — 出图：蝌蚪「探头三帧」
   ① tad-peek-hold.png   从左边露头 → 停驻张望（眼睛睁开）
   ② tad-blink-closed.png 眼睛完全闭上（rAF 卡到闭眼窗口内，当场冻结 S.time 到窗口正中再截）
   ③ tad-thin-tail.png   细尾巡游全身帧（眼睛睁开、S 形尾）
   用法：NODE_PATH=/tmp/ffshot/node_modules node test/shot_tadpeek.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const MODS = ["./js/platform.js", "./js/config.js","./js/rank.js", "./js/audio.js", "./js/draw.js",
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

/* 眨眼公式与 draw.js D.tadGeom 完全一致：返回 0=全闭 1=全睁（余弦下凹，窗口中点全闭） */
const BLINK_FN = `
  window.__blinkOf = (p, t) => {
    const seed = p.tadBlinkSeed == null ? 0 : p.tadBlinkSeed;
    const paused = (p.tState === "peek") || ((p.tadHoverK || 1) < 0.5);
    const cyc = (paused ? 2.6 : 3.4) + (seed % 2.2);
    const bd = 0.22;
    const bt = ((t || 0) + seed) % cyc;
    return bt > cyc - bd ? 0.5 + 0.5 * Math.cos(2 * Math.PI * ((bt - (cyc - bd)) / bd)) : 1;
  };
`;

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
    G.config.preyCount = 1; G.config.tadStyle = "ink"; G.config.duration = 60;
    G.startGame(); G.session.counting = false; G.session.running = true;
    G.switchScreen("playing");
    G.session.stage = 1;   // 阶段 1 基线 1 只，画面干净
  });
  await page.waitForTimeout(900);
  /* 等首只蝌蚪就绪，多余的清掉 */
  await page.evaluate(() => new Promise(r => {
    const G = window.G;
    (function w() {
      if (G.preys && G.preys.length >= 1) { G.preys.splice(1); r(G.preys.length); return; }
      setTimeout(w, 100);
    })();
  }));
  await page.evaluate(BLINK_FN);

  /* 页内 rAF 门闩：条件满足即 resolve（截图在 Node 侧紧接着做，滞后 ≤1-2 帧） */
  const gate = (condSrc) => page.evaluate((src) => new Promise(resolve => {
    const G = window.G;
    const fn = eval("(" + src + ")");
    let n = 0;
    (function check() {
      n++;
      const p = G.preys[0];
      if (p && fn(p, G.session.time, G)) { resolve(true); return; }
      if (n > 600) { resolve(false); return; }
      requestAnimationFrame(check);
    })();
  }), condSrc);

  /* ---------- ① 露头停驻：从左边探进 → 停驻张望（等眼睛睁开） ---------- */
  await page.evaluate(() => {
    const G = window.G, b = G.bounds(), p = G.preys[0];
    p.tState = "peek";
    p.vanishT = 0; p.darkT = 0; p.fade = 1;
    p.tadIn = 0; p.tadFold = 0; p.tadNoFoldT = 0;
    p.tadAng = 0; p.driftAng = 0;                        // 朝右：头从左边探进
    p.tadPeekSx = b.x - 70; p.tadPeekSy = b.y + b.h * 0.42;
    p.tadPeekX = b.x + 12;  p.tadPeekY = p.tadPeekSy;
    p.tadPeekE = 1.1; p.tadPeekHold = 6; p.tadPeekT = 7.1;   // 1.1s 缓探入 + 6s 停驻
    p.tadBlinkSeed = 0; p.tadHover = 0; p.tadHoverT = 0; p.tadHoverK = 1;
    p.x = p.tadPeekSx; p.y = p.tadPeekSy;
    p.trail.length = 0; p.segs.length = 0;
  });
  const ok1 = await gate(`(p, t) => p.tState === "peek" && p.tadPeekT <= (p.tadPeekHold || 0) && window.__blinkOf(p, t) >= 1`);
  await page.screenshot({ path: path.join(OUT, "tad-peek-hold.png") });
  console.log("① peek-hold:", ok1 ? "ok" : "GATE TIMEOUT");

  /* ---------- ② 闭眼帧：seed=0、swim → 周期 3.4s。
     眨眼是 S.time 的纯函数（tadGeom: bt=(t+seed)%cyc），不必等自然闭眼窗口——
     短等 800ms 攒尾链（位移受控 ~120px 不触边），然后 rAF 内直接把 S.time
     挪到闭眼中点 bt=3.29（u=0.5，blink=0）并暂停；下帧跳过 update、照旧重绘 = 精确闭眼定格。 */
  await page.evaluate(() => {
    const G = window.G, b = G.bounds(), p = G.preys[0];
    p.tState = "swim";
    p.vanishT = 0; p.darkT = 0; p.fade = 1;
    p.tadIn = 0; p.tadFold = 0; p.tadNoFoldT = 0;
    p.tadBlinkSeed = 0; p.tadHover = 0; p.tadHoverT = 0; p.tadHoverK = 1;
    p.tadAng = 0.1; p.driftAng = 0.1;
    p.x = b.x + b.w * 0.38; p.y = b.y + b.h * 0.5;
    p.trail.length = 0; p.segs.length = 0;
  });
  await page.waitForTimeout(800);                        // 只攒尾链，不让它游到边
  const ok2 = await page.evaluate(() => new Promise(resolve => {
    const G = window.G;
    requestAnimationFrame(() => {
      const p = G.preys[0];
      if (!p) { resolve(false); return; }
      const cyc = 3.4, t = G.session.time;
      G.session.time = Math.floor(t / cyc) * cyc + (cyc - 0.11);   // bt=3.29 → u=0.5 → blink=0
      G.session.paused = true;                                     // 冻结：后续帧都画这一帧
      resolve(window.__blinkOf(p, G.session.time) <= 0.001);
    });
  }));
  await page.waitForTimeout(150);                        // 冻结后等一两帧，确保画布已重绘冻结态
  await page.screenshot({ path: path.join(OUT, "tad-blink-closed.png") });
  await page.evaluate(() => { window.G.session.paused = false; });
  console.log("② blink-closed:", ok2 ? "ok" : "SNAP FAIL");

  /* ---------- ③ 细尾巡游：正常速度、眼睛睁开、尾链攒够 ---------- */
  await page.evaluate(() => {
    const G = window.G, b = G.bounds(), p = G.preys[0];
    p.tState = "swim";
    p.vanishT = 0; p.darkT = 0; p.fade = 1;
    p.tadIn = 0; p.tadFold = 0; p.tadNoFoldT = 0;
    p.tadBlinkSeed = 0; p.tadHover = 0; p.tadHoverT = 0; p.tadHoverK = 1;
    p.tadAng = -0.08; p.driftAng = -0.08;                // 略偏右上横穿
    p.x = b.x + b.w * 0.30; p.y = b.y + b.h * 0.55;
    p.trail.length = 0; p.segs.length = 0;
  });
  const ok3 = await gate(`(p, t) => p.tState === "swim" && p.fade > 0.95
    && (p.tadIn || 0) <= 0 && (p.tadFold || 0) <= 0 && (p.darkT || 0) <= 0
    && (p.trail || []).length > 50 && window.__blinkOf(p, t) >= 1`);
  await page.screenshot({ path: path.join(OUT, "tad-thin-tail.png") });
  console.log("③ thin-tail:", ok3 ? "ok" : "GATE TIMEOUT");

  await browser.close();
})();
