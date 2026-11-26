/* shot_tadstruggle.js — 出图：长按尾巴 → 挣扎（位置冻结、瞪眼、尾快摆、头扭动）
   ① tad-struggle.png   真实触摸长按尾巴 → 满 300ms 主循环激活挣扎，头扭到大幅时冻结截帧
      随后松手 → 结算命中（松手 = 抓住），验证 hits+1、挣扎状态清除
   用法：NODE_PATH=/tmp/ffshot/node_modules node test/shot_tadstruggle.js
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

  /* 摆一只屏内巡游的蝌蚪（居中偏左，离边够远，hold 期间不会触边） */
  await page.evaluate(() => {
    const G = window.G, b = G.bounds(), p = G.preys[0];
    p.tState = "swim";
    p.vanishT = 0; p.darkT = 0; p.fade = 1;
    p.tadIn = 0; p.tadFold = 0; p.tadNoFoldT = 0;
    p.tadBlinkSeed = 2; p.tadHover = 0; p.tadHoverT = 0; p.tadHoverK = 1;
    p.tadAng = -0.06; p.driftAng = -0.06;
    p.x = b.x + b.w * 0.42; p.y = b.y + b.h * 0.5;
    p.trail.length = 0; p.segs.length = 0;
  });
  await page.waitForTimeout(800);                        // 攒尾链

  /* 尾尖渲染位置：与命中判定同一数据源（tailPoints 含波浪偏移） */
  const tip = await page.evaluate(() => {
    const G = window.G, p = G.preys[0];
    const tp = p.tailPoints();
    const q = tp[tp.length - 1];
    return { x: q.x, y: q.y };
  });
  const hitsBefore = await page.evaluate(() => window.G.session.hits);

  /* 真实触摸长按：pointerdown → wx.onTouchStart 记 hold（不立即结算） */
  await page.mouse.move(tip.x, tip.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  const holdN = await page.evaluate(() => (window.G.session.tadHolds || []).length);
  console.log("hold 记录:", holdN, "尾尖=", tip.x.toFixed(0), ",", tip.y.toFixed(0));

  /* 满 300ms 主循环激活挣扎；头扭动幅值较大时冻结截帧（姿态最好读） */
  const okStruggle = await page.evaluate(() => new Promise(resolve => {
    const G = window.G;
    let n = 0;
    (function check() {
      n++;
      const p = G.preys[0];
      if (p && p.tadStruggle > 0 && Math.abs(p.tadStruggleW || 0) > 0.3) {
        G.session.paused = true;
        resolve(true); return;
      }
      if (n > 180) { G.session.paused = true; resolve(false); return; }
      requestAnimationFrame(check);
    })();
  }));
  await page.waitForTimeout(150);                        // 冻结后等一两帧，确保画布已重绘冻结态
  const snap = await page.evaluate(() => {
    const G = window.G, p = G.preys[0];
    return { struggle: p.tadStruggle > 0, wob: (p.tadStruggleW || 0).toFixed(2),
             strugglePrey: G.session.strugglePrey === p, paused: G.session.paused };
  });
  await page.screenshot({ path: path.join(OUT, "tad-struggle.png") });
  console.log("① struggle:", okStruggle ? "ok" : "TIMEOUT", JSON.stringify(snap));

  /* 松手 → 结算命中（松手 = 抓住） */
  await page.evaluate(() => { window.G.session.paused = false; });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => {
    const G = window.G, p = G.preys[0];
    return { hits: G.session.hits,
      vanished: !!(p && p.vanishT > 0),
      struggleCleared: !p || p.tadStruggle <= 0,
      strugglePreyNull: G.session.strugglePrey == null };
  });
  const okHit = after.hits === hitsBefore + 1 && after.vanished && after.struggleCleared && after.strugglePreyNull;
  console.log("② 松手结算:", okHit ? "ok" : "FAIL", JSON.stringify(after), "(hits " + hitsBefore + "→" + after.hits + ")");
  await browser.close();
})();
