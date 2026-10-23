/* probe_reenter.js — 复现「重新进入小程序后首页整体靠下」并验证修复
   场景：冷启动拿到正确横屏 safeArea；从后台切回(onShow)时系统回传【竖屏坐标系】的
   safeArea(top≈47)，旧逻辑不拦截 top 导致整页下移；新 computeSafe 应旋转归一使 top≈0。
   用法：NODE_PATH=<npm> node test/probe_reenter.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/reenter";
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
// 从后台切回时系统回传的【竖屏坐标系】safeArea：right≈竖屏屏宽(393)、top≈状态栏(47)
const ip15Reenter = { windowWidth: 852, windowHeight: 393, pixelRatio: 3,
  safeArea: { left: 0, top: 47, right: 393, bottom: 818 }, screenOrientation: { angle: 0 } };

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const page = await browser.newPage({ viewport: { width: 852, height: 393 } });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && m.text().indexOf("ERR_FILE_NOT_FOUND") < 0) errs.push("console: " + m.text()); });

  await boot(page, ip15Land);
  const cold = await page.evaluate(() => {
    const s = window.G.platform.safe;
    return { left: s.left, top: s.top, right: s.right, bottom: s.bottom };
  });
  await page.evaluate(() => { window.G.screen = "home"; });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, "1_冷启动_首页.png") });

  // 模拟「重新进入小程序」：注入竖屏坐标系 safeArea 并触发 onShow
  await page.evaluate(s => { window.__sysInfo = s; }, ip15Reenter);
  await page.evaluate(() => window.__wxShow && window.__wxShow({ scene: 1089 }));
  await page.waitForTimeout(200);
  const reenter = await page.evaluate(() => {
    const s = window.G.platform.safe;
    return { left: s.left, top: s.top, right: s.right, bottom: s.bottom };
  });
  await page.evaluate(() => { window.G.screen = "home"; });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, "2_重新进入_首页.png") });

  await browser.close();

  console.log("冷启动(正确横屏) safe inset L/T/R/B =",
    [cold.left, cold.top, cold.right, cold.bottom].map(Math.round).join("/"));
  console.log("重新进入(竖屏坐标) safe inset L/T/R/B =",
    [reenter.left, reenter.top, reenter.right, reenter.bottom].map(Math.round).join("/"));
  const ok = reenter.top <= 5;       // 旋转归一后横屏 top 应为 0（而非 47「靠下」）
  const noRegress = cold.top >= 0 && cold.top <= 30; // 冷启动合法横屏 top 不被误改
  const fail = ok ? "✅ 已修复：重新进入后 safe.top 归一为 " + Math.round(reenter.top) + "，首页不再靠下"
                  : "❌ 未修复：重新进入后 safe.top=" + Math.round(reenter.top) + "（仍会靠下）";
  console.log(fail);
  console.log(noRegress ? "✅ 无回归：冷启动合法横屏 safe.top=" + Math.round(cold.top) + " 保持正常"
                        : "❌ 回归：冷启动 safe.top 被误改");
  if (errs.length) { console.log("运行时错误:"); errs.forEach(e => console.log("  ❌ " + e)); }
  else console.log("✅ 无运行时错误");
  console.log("\n截图：1_冷启动_首页.png / 2_重新进入_首页.png（对比顶部标题是否下移）");
})();
