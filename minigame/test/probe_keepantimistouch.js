/* probe_keepantimistouch.js — 验证「屏幕常亮 + 防误触引导」：
   ① 设置页新增控件渲染无重叠/越界  ② 首局进游戏弹一次引导 + 开启常亮 + 写标记
   ③ 离开游戏态自动关常亮  ④ 已引导过不再弹  ⑤ 关闭开关不弹仍可玩
   ⑥ 防误触说明按钮可触发（含 iOS/安卓 指引）
   用法：NODE_PATH=<npm> node test/probe_keepantimistouch.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/keep_antimistouch";
fs.mkdirSync(OUT, { recursive: true });
function findChrome() {
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", process.env.CHROME_PATH || ""])
    if (p && fs.existsSync(p)) return p;
  throw new Error("no chrome found");
}
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
const WX_MOCK = `
  (function(){
    const wx = window.wx;
    wx.shareAppMessage=(o)=>{(window.__shares=window.__shares||[]).push(o);};
    wx.onShareAppMessage=(fn)=>{window.__shareFactory=fn;};
    wx.showShareMenu=()=>{}; wx.showToast=(o)=>{(window.__toasts=window.__toasts||[]).push(o);};
    wx.showModal=(o)=>{(window.__modals=window.__modals||[]).push(o); window.__lastModal=o;};
    wx.getSetting=(o)=>o.success&&o.success({authSetting:{}});
    wx.authorize=(o)=>o.success&&o.success();
    wx.openSetting=(o)=>o.success&&o.success({authSetting:{}});
    wx.saveImageToPhotosAlbum=(o)=>o.success&&o.success();
    wx.reportEvent=(n,d)=>{(window.__track=window.__track||[]).push([n,d]);};
    wx.reportAnalytics=(n,d)=>{(window.__track=window.__track||[]).push([n,d]);};
    wx.openCustomerServiceConversation=(o)=>{(window.__cs=window.__cs||[]).push(o);};
    wx.createImage=()=>new Image();
    HTMLCanvasElement.prototype.toTempFilePathSync=function(){return this.toDataURL("image/jpeg",0.92);};
    wx.setKeepScreenOn=(o)=>{(window.__keep=window.__keep||[]).push(!!o.keepScreenOn);};
  })();
`;
async function boot(page, sysInfo) {
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, sysInfo);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(WX_MOCK);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(250);
}
const ip15 = { windowWidth: 852, windowHeight: 393, pixelRatio: 3,
  safeArea: { left: 0, top: 21, right: 793, bottom: 372 }, screenOrientation: { angle: 90 } };
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("✅ " + name); }
  else { fail++; console.log("❌ " + name + (extra ? (" :: " + extra) : "")); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const page = await browser.newPage({ viewport: { width: 852, height: 393 } });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && m.text().indexOf("ERR_FILE_NOT_FOUND") < 0) errs.push("console: " + m.text()); });
  await boot(page, ip15);

  // 1) 设置页渲染 + 底部控件几何
  await page.evaluate(() => { window.G.screen = "settings"; });
  await page.waitForTimeout(200);
  const rep = await page.evaluate(() => {
    const G = window.G, P = G.platform, S = P.S || 1;
    const W = P.W / S, H = P.H / S;
    const bx0 = P.safe.left / S, by0 = P.safe.top / S, bx1 = W - P.safe.right / S, by1 = H - P.safe.bottom / S;
    const btns = (G.ui.buttons || []).map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
    const issues = [];
    const overlap = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
    const inSafe = r => r.x >= bx0 - 0.5 && r.y >= by0 - 0.5 && r.x + r.w <= bx1 + 0.5 && r.y + r.h <= by1 + 0.5;
    btns.forEach((b, i) => { if (b.w <= 0 || b.h <= 0) issues.push("按钮#" + i + " 负尺寸"); if (!inSafe(b)) issues.push("按钮#" + i + " 越界"); });
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++)
      if (overlap(btns[i], btns[j])) issues.push("按钮#" + i + " 与 #" + j + " 重叠");
    return { btnCount: btns.length, issues };
  });
  await page.screenshot({ path: path.join(OUT, "settings_keep.png") });
  check("设置页按钮无重叠/越界", rep.issues.length === 0, JSON.stringify(rep.issues));
  console.log("   设置页按钮数=" + rep.btnCount + "（含新增 屏幕常亮开关 + 防误触说明）");

  const def = await page.evaluate(() => ({ ks: window.G.config.keepScreen, am: window.G.config.antiMistouch }));
  check("默认屏幕常亮=开", def.ks === true);
  check("默认防误触引导=开", def.am === true);

  // 3) 首局 startGame：弹引导 + 开启常亮 + 写标记
  await page.evaluate(() => { localStorage.removeItem("catToyAntiShown"); window.__modals = []; window.__keep = []; });
  const r1 = await page.evaluate(() => {
    window.G.startGame();
    return {
      keep: window.__keep || [],
      modals: (window.__modals || []).map(m => m.title),
      shown: localStorage.getItem("catToyAntiShown"),
      screen: window.G.screen
    };
  });
  check("首局开启屏幕常亮", r1.keep.indexOf(true) >= 0, JSON.stringify(r1.keep));
  check("首局弹防误触引导", r1.modals.length === 1 && /防误触/.test(r1.modals[0] || ""), JSON.stringify(r1.modals));
  check("写入 catToyAntiShown 标记", r1.shown === "1", String(r1.shown));
  const began = await page.evaluate(() => { if (window.__lastModal && window.__lastModal.success) window.__lastModal.success(); return window.G.screen; });
  check("用户确认后进入倒计时", began === "counting", String(began));

  // 4) 离开游戏态 → 自动关常亮
  await page.evaluate(() => { window.G.screen = "home"; });
  await page.waitForTimeout(90);
  const off = await page.evaluate(() => { const k = window.__keep || []; return k[k.length - 1]; });
  check("返回首页后自动关闭常亮", off === false, String(off));

  // 5) 再次 startGame（已标记）→ 不重复弹
  const r2 = await page.evaluate(() => { const before = (window.__modals || []).length; window.G.startGame(); if (window.__lastModal && window.__lastModal.success) window.__lastModal.success(); return { before, after: (window.__modals || []).length }; });
  check("已引导过则不再弹", r2.after === r2.before, JSON.stringify(r2));

  // 6) antiMistouch=false → 不弹但仍可玩
  const r3 = await page.evaluate(() => {
    localStorage.removeItem("catToyAntiShown");
    window.G.config.antiMistouch = false;
    const before = (window.__modals || []).length;
    window.G.startGame();
    if (window.__lastModal && window.__lastModal.success) window.__lastModal.success();
    return { before, after: (window.__modals || []).length, screen: window.G.screen };
  });
  check("关闭防误触引导后不弹", r3.after === r3.before, JSON.stringify(r3));
  check("关闭引导仍可开始游戏", r3.screen === "counting", String(r3.screen));

  // 7) 防误触说明按钮 → antiGuide 弹窗（含 iOS/安卓 指引）
  const r4 = await page.evaluate(() => {
    window.G.config.antiMistouch = true;
    const before = (window.__modals || []).length;
    window.G.platform.antiGuide(() => {});
    const m = window.__modals || [];
    const last = m[m.length - 1] || {};
    return { before, after: m.length, title: last.title, content: last.content || "" };
  });
  check("防误触说明弹窗可触发", r4.after === r4.before + 1 && /防误触/.test(r4.title || ""), JSON.stringify(r4));
  check("说明含 iOS 引导式访问", /引导式访问/.test(r4.content), "");
  check("说明含安卓防误触", /安卓/.test(r4.content) && /防误触/.test(r4.content), "");

  await browser.close();
  console.log("\n通过 " + pass + " / 失败 " + fail);
  if (errs.length) { console.log("运行时错误:"); errs.forEach(e => console.log("  ❌ " + e)); }
  else console.log("✅ 无运行时错误");
  console.log("截图：settings_keep.png");
})().catch(e => { console.error("探针异常:", e); process.exit(1); });
