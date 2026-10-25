/* check_hud_pause_line.js — HUD 同行诊断：遍历机型矩阵，校验「暂停按钮与倒计时同一行、
   不压胶囊、不压药丸、不出屏」。复现真机 iPhone 15 的问题用例：胶囊矩形回传竖屏坐标。
   用法：NODE_PATH=<全局node_modules> node test/check_hud_pause_line.js（需 Node 20+） */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(__dirname, "..");
function findChrome() {
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", process.env.CHROME_PATH || ""])
    if (p && fs.existsSync(p)) return p;
  throw new Error("no chrome found");
}
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
const WX_MOCK = `
  (function(){
    const wx = window.wx;
    wx.shareAppMessage=()=>{}; wx.onShareAppMessage=()=>{}; wx.showShareMenu=()=>{};
    wx.showToast=()=>{}; wx.showModal=(o)=>o.success&&o.success({});
    wx.getSetting=(o)=>o.success&&o.success({authSetting:{}});
    wx.authorize=(o)=>o.success&&o.success();
    wx.saveImageToPhotosAlbum=(o)=>o.success&&o.success();
    wx.reportEvent=()=>{}; wx.reportAnalytics=()=>{};
    wx.createImage=()=>new Image();
    HTMLCanvasElement.prototype.toTempFilePathSync=function(){return this.toDataURL("image/jpeg",0.92);};
    wx.setKeepScreenOn=()=>{}; wx.vibrateShort=()=>{};
    wx.setUserCloudStorage=()=>{};
    wx.getOpenDataContext=()=>({postMessage:()=>{}});
    wx.getLaunchOptionsSync=()=>({scene:1001,query:{}});
    wx.onWindowResize=()=>{}; wx.onShow=()=>{}; wx.onHide=()=>{};
  })();
`;

/* 机型矩阵：sysInfo 用真机实采值（iPhone 15 灵动岛横屏左右 inset 47；胶囊宽 87 高 32 恒定） */
const CAP_W = 87, CAP_H = 32;
const DEVICES = [
  { name: "iPhone15_横屏_正常胶囊", land: true,
    sys: { windowWidth: 852, windowHeight: 393, pixelRatio: 3, safeArea: { left: 47, top: 0, right: 805, bottom: 372 } },
    menu: { left: 758, top: 4, right: 758 + CAP_W, bottom: 4 + CAP_H, width: CAP_W, height: CAP_H } },
  { name: "iPhone15_横屏_胶囊竖屏坐标_bug用例", land: true,
    sys: { windowWidth: 852, windowHeight: 393, pixelRatio: 3, safeArea: { left: 47, top: 0, right: 805, bottom: 372 } },
    menu: { left: 299, top: 50, right: 299 + CAP_W, bottom: 50 + CAP_H, width: CAP_W, height: CAP_H } },
  { name: "iPhone15_竖屏", land: false,
    sys: { windowWidth: 393, windowHeight: 852, pixelRatio: 3, safeArea: { left: 0, top: 47, right: 393, bottom: 799 } },
    menu: { left: 299, top: 50, right: 299 + CAP_W, bottom: 50 + CAP_H, width: CAP_W, height: CAP_H } },
  { name: "iPhoneSE_横屏", land: true,
    sys: { windowWidth: 667, windowHeight: 375, pixelRatio: 2, safeArea: { left: 0, top: 0, right: 667, bottom: 375 } },
    menu: { left: 667 - 7 - CAP_W, top: 4, right: 667 - 7, bottom: 4 + CAP_H, width: CAP_W, height: CAP_H } },
  { name: "iPad_横屏_大屏", land: true,
    sys: { windowWidth: 1024, windowHeight: 768, pixelRatio: 2, safeArea: { left: 0, top: 0, right: 1024, bottom: 768 } },
    menu: { left: 1024 - 7 - CAP_W, top: 4, right: 1024 - 7, bottom: 4 + CAP_H, width: CAP_W, height: CAP_H } },
  { name: "安卓_横屏", land: true,
    sys: { windowWidth: 812, windowHeight: 375, pixelRatio: 3, safeArea: { left: 0, top: 0, right: 812, bottom: 361 } },
    menu: { left: 812 - 7 - CAP_W, top: 4, right: 812 - 7, bottom: 4 + CAP_H, width: CAP_W, height: CAP_H } },
  { name: "安卓_横屏_胶囊偏下", land: true,
    sys: { windowWidth: 812, windowHeight: 375, pixelRatio: 3, safeArea: { left: 0, top: 0, right: 812, bottom: 361 } },
    menu: { left: 812 - 7 - CAP_W, top: 22, right: 812 - 7, bottom: 22 + CAP_H, width: CAP_W, height: CAP_H } }
];

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + (extra ? " :: " + extra : "")); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];
  for (const dev of DEVICES) {
    console.log("▣ " + dev.name);
    const page = await browser.newPage({ viewport: { width: dev.sys.windowWidth, height: dev.sys.windowHeight } });
    page.on("pageerror", e => errs.push(dev.name + " pageerror: " + e.message));
    await page.goto("file://" + path.join(ROOT, "test/harness.html"));
    await page.evaluate(s => { window.__sysInfo = s; }, dev.sys);
    await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
    await page.evaluate(WX_MOCK);
    // 按机型注入胶囊矩形（platform.js 在 require 时读取）
    await page.evaluate(r => { window.wx.getMenuButtonBoundingClientRect = () => r; }, dev.menu);
    await page.evaluate(() => window.require("./game.js"));
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const G = window.G;
      G.config.targetType = "fish";
      G.buildScene("fish"); G.buildPreys();
      G.session.running = true; G.session.remaining = 999; G.session.infinite = true;
      G.session.time = 2; G.screen = "playing";
      return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
        res({
          pause: G.ui.pauseRect, pill: G.ui.timePillRect,
          menu: G.platform.menu, safe: G.platform.safe,
          W: G.platform.W, H: G.platform.H
        });
      })));
    });
    if (dev.land) await page.screenshot({ path: path.join(ROOT, "screenshots", "hud-" + dev.name + ".png") });
    const P = r.pause, T = r.pill, M = r.menu;
    console.log("    pause=" + JSON.stringify(P) + " pill=" + JSON.stringify(T) +
      " menuNorm=" + (M ? JSON.stringify({ l: Math.round(M.left), t: Math.round(M.top) }) : "null"));
    // 不压胶囊（矩形相交判定）
    const menuHit = P.x < M.right && P.x + P.w > M.left && P.y < M.bottom && P.y + P.h > M.top;
    // 不压倒计时/捕获药丸（左右相邻允许 4px 呼吸距）
    const pillHit = P.x < T.x + T.w + 4 && P.x + P.w > T.x - 4 && P.y < T.y + T.h && P.y + P.h > T.y;
    const offscreen = P.x < 0 || P.y < 0 || P.x + P.w > r.W || P.y + P.h > r.H;
    if (dev.land) {
      // 同行：暂停与倒计时药丸纵向重叠 ≥ 一半药丸高
      const vOverlap = Math.min(P.y + P.h, T.y + T.h) - Math.max(P.y, T.y);
      check("暂停与倒计时同一行", vOverlap >= T.h * 0.5,
        "vOverlap=" + Math.round(vOverlap) + "px（需≥" + Math.round(T.h * 0.5) + "）");
      check("不压胶囊", !menuHit, JSON.stringify({ pause: P, menu: { l: M.left, t: M.top, r: M.right, b: M.bottom } }));
      check("不压倒计时/捕获药丸", !pillHit, JSON.stringify(P));
    } else {
      // 竖屏设计：胶囊占右上角，暂停放胶囊下方（同行放不下）
      const belowMenu = P.y >= M.bottom - 2;
      check("竖屏：暂停在胶囊正下方且不重叠", belowMenu && !menuHit,
        JSON.stringify({ pause: P, menuBottom: M.bottom }));
    }
    check("不出屏", !offscreen, JSON.stringify(P));
    await page.close();
  }
  check("无运行时错误", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log("\n通过 " + pass + " / 失败 " + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
