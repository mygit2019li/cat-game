/* probe_infinite.js — 验证无限模式：本地持久化 + 运行时不自动结束 + HUD ∞ + 真实时长结算 + 重启读回
   用法：NODE_PATH=<npm> node test/probe_infinite.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/infinite";
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
  await page.evaluate(() => { localStorage.setItem("catToyAntiShown", "1"); });   // 预置已引导：跳过防误触首局弹窗
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(250);
}
const ip15Land = { windowWidth: 852, windowHeight: 393, pixelRatio: 3,
  safeArea: { left: 0, top: 21, right: 793, bottom: 372 }, screenOrientation: { angle: 90 } };
const check = (name, cond, extra) => { console.log((cond ? "✅ " : "❌ ") + name + (extra ? "  " + extra : "")); return cond; };

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const context = await browser.newContext({ viewport: { width: 852, height: 393 } });
  const pageA = await context.newPage();
  const errs = [];
  pageA.on("pageerror", e => errs.push("pageerror: " + e.message));
  pageA.on("console", m => { if (m.type() === "error" && m.text().indexOf("ERR_FILE_NOT_FOUND") < 0) errs.push("console: " + m.text()); });
  await boot(pageA, ip15Land);

  // 1) 持久化写入：设置∞并保存
  const write = await pageA.evaluate(() => {
    window.G.config.infinite = true; window.G.saveConfig();
    const raw = localStorage.getItem("catToyConfig");
    let ok = false;
    try { ok = JSON.parse(raw).infinite === true; } catch (e) {}
    return { ok, raw };
  });
  check("设置∞后写入本地 catToyConfig.infinite=true", write.ok, write.raw);

  // 2) 运行时无限：不自动结束（用较短 duration=12 让有限模式本应 12 秒结束）
  await pageA.evaluate(() => { window.G.config.duration = 12; window.G.config.infinite = true; window.G.startGame(); });
  await pageA.waitForTimeout(4200); // 过 3 秒倒计时
  const entered = await pageA.evaluate(() => ({ screen: window.G.screen, inf: !!window.G.session.infinite }));
  check("倒计时后进入 playing（无限模式）", entered.screen === "playing" && entered.inf, "screen=" + entered.screen);

  await pageA.waitForTimeout(15000); // 玩 15 秒 —— 有限模式 12 秒就该结算了
  const run = await pageA.evaluate(() => {
    const S = window.G.session;
    return { screen: window.G.screen, rem: S.remaining, stage: S.stage, time: Math.round(S.time), inf: !!S.infinite };
  });
  check("无限模式玩 15 秒仍不自动结算", run.screen === "playing", "screen=" + run.screen + " rem=" + run.rem + " time=" + run.time);
  check("倒计时归零后停在阶段③（不继续减到负）", run.stage === 3 && run.rem <= 0, "stage=" + run.stage + " rem=" + run.rem);
  await pageA.screenshot({ path: path.join(OUT, "playing_无限.png") });

  // 3) 主动结束：结算按真实游玩时长
  const end = await pageA.evaluate(() => {
    window.__track = []; window.G.endGame(true);
    const ge = (window.__track || []).filter(t => t[0] === "game_end")[0];
    return { screen: window.G.screen, sec: ge && ge[1] && ge[1].sec, dur: ge && ge[1] && ge[1].dur, time: Math.round(window.G.session.time) };
  });
  check("主动结束进入结算页", end.screen === "result", "screen=" + end.screen);
  check("结算 sec≈真实游玩时长（非配置时长 12）", end.sec >= 10 && end.sec <= 22, "sec=" + end.sec + " 游玩≈" + end.time);
  check("无限模式 game_end 上报 dur=0", end.dur === 0, "dur=" + end.dur);

  // 4) 重启读取：同 context 新页面共享 localStorage
  const pageB = await context.newPage();
  pageB.on("pageerror", e => errs.push("pageB pageerror: " + e.message));
  pageB.on("console", m => { if (m.type() === "error" && m.text().indexOf("ERR_FILE_NOT_FOUND") < 0) errs.push("pageB console: " + m.text()); });
  await boot(pageB, ip15Land);
  const reload = await pageB.evaluate(() => ({ inf: !!window.G.config.infinite, raw: localStorage.getItem("catToyConfig") }));
  check("重启（新页面）自动读回 infinite=true", reload.inf, reload.raw);

  await browser.close();
  console.log("\n截图：playing_无限.png");
  if (errs.length) { console.log("运行时错误:"); errs.forEach(e => console.log("  ❌ " + e)); }
  else console.log("✅ 无运行时错误");
})();
