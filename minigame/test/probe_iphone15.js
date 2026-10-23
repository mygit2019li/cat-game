/* probe_iphone15.js — 用真实游戏代码在 iPhone 15 逻辑分辨率下真渲染，
   校验首页/游玩 HUD/结算三个关键界面在「横屏 + 右侧灵动岛」下的布局合理性：
     1) 所有按钮都在安全区（safeArea）内，不被灵动岛/圆角遮挡
     2) 按钮不与右上角微信胶囊按钮重叠
     3) 按钮之间无重叠、无负尺寸
     4) HUD 暂停按钮不与胶囊/灵动岛冲突
   用法：NODE_PATH=<npm> node test/probe_iphone15.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/iphone15";
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
    wx.shareAppMessage = (o)=>{ (window.__shares=window.__shares||[]).push(o); };
    wx.onShareAppMessage = (fn)=>{ window.__shareFactory = fn; };
    wx.showShareMenu = ()=>{};
    wx.showToast = (o)=>{ (window.__toasts=window.__toasts||[]).push(o); };
    wx.showModal = (o)=>{ (window.__modals=window.__modals||[]).push(o); };
    wx.getSetting = (o)=> o.success && o.success({authSetting:{}});
    wx.authorize = (o)=> o.success && o.success();
    wx.openSetting = (o)=> o.success && o.success({authSetting:{}});
    wx.saveImageToPhotosAlbum = (o)=> o.success && o.success();
    wx.reportEvent = (n,d)=>{ (window.__track=window.__track||[]).push([n,d]); };
    wx.reportAnalytics = (n,d)=>{ (window.__track=window.__track||[]).push([n,d]); };
    wx.openCustomerServiceConversation = (o)=>{ (window.__cs=window.__cs||[]).push(o); };
    wx.createImage = ()=> { const img=new Image(); return img; };
    HTMLCanvasElement.prototype.toTempFilePathSync = function(){ return this.toDataURL("image/jpeg",0.92); };
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

/* 在页面里读布局几何并做校验，返回报告对象 */
async function inspect(page, screen) {
  return await page.evaluate((screen) => {
    const G = window.G;
    if (!G) return { fatal: "G 未初始化" };
    const P = G.platform;
    const S = P.S || 1;
    // 布局空间（虚拟手机尺寸）尺寸与安全带
    const W = P.W / S, H = P.H / S;
    const safe = {
      left: P.safe.left / S, right: P.safe.right / S,
      top: P.safe.top / S, bottom: P.safe.bottom / S
    };
    const bx0 = safe.left, by0 = safe.top, bx1 = W - safe.right, by1 = H - safe.bottom;
    // 微信胶囊（虚拟空间）
    const m0 = P.menu;
    const menu = m0 && m0.width > 0
      ? { x: m0.left / S, y: m0.top / S, w: m0.width / S, h: m0.height / S }
      : null;
    // 切到目标界面并等一帧让按钮重建（主循环持续 rAF）
    G.screen = screen;
    if (screen === "playing") {
      // 直接构造一个游玩中的会话，避免等 3 秒倒计时
      G.session.running = true; G.session.counting = false;
      G.session.remaining = 120; G.session.hits = 7; G.session.combo = 3; G.session.time = 2;
      G.startGame && (G.buildScene(G.config.targetType), G.buildPreys());
      G.screen = "playing";
    }
    if (screen === "result") {
      G.result = { title:"矫健猎手", desc:"扑击精准、节奏稳健。", touches:9, hits:7, acc:78, maxCombo:5, bonusTag:"" };
      G.screen = "result";
    }
    return new Promise(res => setTimeout(() => {
      const btns = (G.ui.buttons || []).map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
      const pause = G.ui.pauseRect || null;
      const issues = [];
      const overlap = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
      const inSafe = (r) => r.x >= bx0 - 0.5 && r.y >= by0 - 0.5 && r.x + r.w <= bx1 + 0.5 && r.y + r.h <= by1 + 0.5;
      btns.forEach((b, i) => {
        if (b.w <= 0 || b.h <= 0) issues.push("按钮#" + i + " 负尺寸 " + JSON.stringify(b));
        if (!inSafe(b)) issues.push("按钮#" + i + " 越界 " + JSON.stringify(b) + " 安全区[" + bx0 + "," + by0 + "," + bx1 + "," + by1 + "]");
        if (menu && overlap(b, menu)) issues.push("按钮#" + i + " 与胶囊重叠 " + JSON.stringify(b));
      });
      for (let i = 0; i < btns.length; i++)
        for (let j = i + 1; j < btns.length; j++)
          if (overlap(btns[i], btns[j])) issues.push("按钮#" + i + " 与 #" + j + " 互相重叠");
      if (pause) {
        if (!inSafe(pause)) issues.push("暂停按钮越界 " + JSON.stringify(pause) + " 安全区[" + bx0 + "," + by0 + "," + bx1 + "," + by1 + "]");
        if (menu && overlap(pause, menu)) issues.push("暂停按钮与胶囊重叠 " + JSON.stringify(pause));
        // 暂停按钮不应压在灵动岛（右侧安全区被吃掉的那一侧）之上：其右缘需 <= bx1
        if (pause.x + pause.w > bx1 + 0.5) issues.push("暂停按钮侵入灵动岛/圆角区 " + JSON.stringify(pause));
      }
      res({ W, H, S, safe, menu, btnCount: btns.length, pause, issues, btns });
    }, 120));
  }, screen);
}

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const result = {};
  // iPhone 15 逻辑分辨率；横屏 852×393，像素比 3（代码 dpr 封顶 2）
  // 灵动岛在右侧：safeArea 右缘内缩 59，上下圆角各 21
  const ip15Land = {
    windowWidth: 852, windowHeight: 393, pixelRatio: 3,
    safeArea: { left: 0, top: 21, right: 793, bottom: 372 }, screenOrientation: { angle: 90 }
  };
  // 防御性：竖屏 393×852（虽然 game.json 锁横屏，确认竖屏路径不崩）
  const ip15Port = {
    windowWidth: 393, windowHeight: 852, pixelRatio: 3,
    safeArea: { left: 0, top: 59, right: 393, bottom: 799 }, screenOrientation: { angle: 0 }
  };

  for (const [tag, si] of [["iPhone15-横屏", ip15Land], ["iPhone15-竖屏(防御)", ip15Port]]) {
    const page = await browser.newPage({ viewport: { width: si.windowWidth, height: si.windowHeight } });
    const errs = [];
    page.on("pageerror", e => errs.push("pageerror: " + e.message));
    page.on("console", m => { if (m.type() === "error" && m.text().indexOf("ERR_FILE_NOT_FOUND") < 0) errs.push("console: " + m.text()); });
    await boot(page, si);
    const rep = {};
    for (const sc of ["home", "playing", "result"]) {
      const r = await inspect(page, sc);
      rep[sc] = r;
      await page.screenshot({ path: path.join(OUT, tag + "_" + sc + ".png") });
    }
    rep.errors = errs;
    result[tag] = rep;
    await page.close();
  }

  await browser.close();

  // 汇总打印
  const fmt = (o) => JSON.stringify(o);
  let allOk = true;
  for (const tag of Object.keys(result)) {
    const rep = result[tag];
    console.log("\n================ " + tag + " ================");
    for (const sc of ["home", "playing", "result"]) {
      const r = rep[sc] || {};
      console.log(`\n[${sc}] 虚拟尺寸 ${Math.round(r.W)}×${Math.round(r.H)} S=${r.S && r.S.toFixed(3)}  按钮数=${r.btnCount}`);
      console.log("  安全区 inset L/T/R/B =", r.safe && [Math.round(r.safe.left), Math.round(r.safe.top), Math.round(r.safe.right), Math.round(r.safe.bottom)].join("/"));
      console.log("  胶囊(虚拟) =", r.menu && fmt({ l: Math.round(r.menu.x), t: Math.round(r.menu.y), w: Math.round(r.menu.w), h: Math.round(r.menu.h) }));
      if (sc === "playing") console.log("  暂停按钮 =", r.pause && fmt({ x: Math.round(r.pause.x), y: Math.round(r.pause.y), w: r.pause.w, h: r.pause.h }));
      if (r.issues && r.issues.length) { allOk = false; r.issues.forEach(i => console.log("  ❌ " + i)); }
      else console.log("  ✅ 无布局问题");
    }
    if (rep.errors && rep.errors.length) { allOk = false; console.log("\n运行时错误:"); rep.errors.forEach(e => console.log("  ❌ " + e)); }
    else console.log("  ✅ 无运行时错误");
  }
  console.log("\n========================================");
  console.log(allOk ? "✅ iPhone 15 兼容性校验全部通过" : "❌ 存在需修复的问题，见上");
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(result, null, 2));
})();
