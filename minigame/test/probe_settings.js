/* probe_settings.js — 验证设置页新增「分享给好友」按钮：布局几何 + 分享链路
   用法：NODE_PATH=<npm> node test/probe_settings.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/settings";
fs.mkdirSync(OUT, { recursive: true });

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
    wx.shareAppMessage=(o)=>{(window.__shares=window.__shares||[]).push(o);};
    wx.onShareAppMessage=(fn)=>{window.__shareFactory=fn;};
    wx.showShareMenu=()=>{}; wx.showToast=(o)=>{(window.__toasts=window.__toasts||[]).push(o);};
    wx.showModal=(o)=>{(window.__modals=window.__modals||[]).push(o);};
    wx.getSetting=(o)=>o.success&&o.success({authSetting:{}});
    wx.authorize=(o)=>o.success&&o.success();
    wx.openSetting=(o)=>o.success&&o.success({authSetting:{}});
    wx.saveImageToPhotosAlbum=(o)=>o.success&&o.success();
    wx.reportEvent=(n,d)=>{(window.__track=window.__track||[]).push([n,d]);};
    wx.reportAnalytics=(n,d)=>{(window.__track=window.__track||[]).push([n,d]);};
    wx.openCustomerServiceConversation=(o)=>{(window.__cs=window.__cs||[]).push(o);};
    wx.createImage=()=>new Image();
    HTMLCanvasElement.prototype.toTempFilePathSync=function(){return this.toDataURL("image/jpeg",0.92);};
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
const ip15Land = { windowWidth: 852, windowHeight: 393, pixelRatio: 3,
  safeArea: { left: 0, top: 21, right: 793, bottom: 372 }, screenOrientation: { angle: 90 } };

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const page = await browser.newPage({ viewport: { width: 852, height: 393 } });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && m.text().indexOf("ERR_FILE_NOT_FOUND") < 0) errs.push("console: " + m.text()); });
  await boot(page, ip15Land);

  // 渲染设置页
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
    btns.forEach((b, i) => {
      if (b.w <= 0 || b.h <= 0) issues.push("按钮#" + i + " 负尺寸");
      if (!inSafe(b)) issues.push("按钮#" + i + " 越界");
    });
    for (let i = 0; i < btns.length; i++)
      for (let j = i + 1; j < btns.length; j++)
        if (overlap(btns[i], btns[j])) issues.push("按钮#" + i + " 与 #" + j + " 重叠");
    return { btnCount: btns.length, issues, W: Math.round(W), H: Math.round(H) };
  });
  await page.screenshot({ path: path.join(OUT, "settings.png") });

  // 模拟点击「分享给好友」：直接触发其回调等价逻辑，验证分享链路
  const share = await page.evaluate(() => {
    window.__shares = []; window.__track = [];
    try { window.G.shareInvite("settings"); } catch (e) { return { err: String(e && e.message) }; }
    return {
      shares: (window.__shares || []).map(s => ({ title: s.title, query: s.query, hasImg: !!s.imageUrl })),
      tracks: (window.__track || []).map(t => ({ evt: t[0], src: t[1] && t[1].src }))
    };
  });

  await browser.close();

  console.log("设置页 虚拟尺寸 " + rep.W + "×" + rep.H + "  按钮数=" + rep.btnCount);
  if (rep.issues.length) { console.log("❌ 布局问题:"); rep.issues.forEach(i => console.log("  " + i)); }
  else console.log("✅ 底部三按钮无重叠/越界");
  const okShare = share && share.shares && share.shares.length >= 1;
  const okTrack = share && share.tracks && share.tracks.some(t => t.evt === "invite_tap" && t.src === "settings");
  console.log(okShare ? "✅ 分享已触发（title=" + (share.shares[0] && share.shares[0].title) + "，含测评图=" + share.shares[0].hasImg + "）"
                      : "❌ 分享未触发" + (share && share.err ? " err=" + share.err : ""));
  console.log(okTrack ? "✅ 埋点 invite_tap(src=settings) 已上报" : "❌ 埋点未上报");
  if (errs.length) { console.log("运行时错误:"); errs.forEach(e => console.log("  ❌ " + e)); }
  else console.log("✅ 无运行时错误");
  console.log("\n截图：settings.png");
})();
