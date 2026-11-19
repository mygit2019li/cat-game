/* probe_multitouch.js — 多点触控与双爪识别（PRD 5.9）体检
   验五件事：
     ① 双爪同时落在两个猎物上：两个都判定命中（旧实现只认第一根手指）
     ② 第一只爪子按住时，第二只爪子仍能命中
     ③ 双爪乱拍记一次（同一 300ms 窗口只记一次），且不加分
     ④ 双爪踩屏幕不会打断暂停长按
     ⑤ 首页等非对局界面仍只认第一根手指（双指不会触发两次跳转）
   用法：NODE_PATH=/Users/lipeng/node_modules node test/probe_multitouch.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./js/ad.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

function findChrome() {
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", process.env.CHROME_PATH || ""])
    if (p && fs.existsSync(p)) return p;
  throw new Error("no chrome found");
}

const WX_MOCK = `
  (function(){
    const wx = window.wx;
    wx.shareAppMessage=()=>{}; wx.onShareAppMessage=()=>{}; wx.showShareMenu=()=>{};
    wx.showToast=()=>{}; wx.showModal=()=>{}; wx.reportAnalytics=()=>{}; wx.reportEvent=()=>{};
    wx.onTouchStart=()=>{}; wx.onTouchMove=()=>{}; wx.onTouchEnd=()=>{}; wx.onTouchCancel=()=>{};
    HTMLCanvasElement.prototype.toTempFilePathSync=function(){return this.toDataURL("image/jpeg",0.9);};
  })();
`;

const land = { windowWidth: 844, windowHeight: 390, pixelRatio: 2,
  safeArea: { left: 47, top: 0, right: 797, bottom: 369 } };

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => {
    const s = m.text();
    if (m.type() === "error" && !/ERR_FILE_NOT_FOUND|ERR_UNKNOWN_URL_SCHEME/.test(s)) errs.push("console: " + s);
  });

  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, land);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(WX_MOCK);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(320);
  /* 先记下冷启动默认值（后面会为了测试改配置） */
  await page.evaluate(() => {
    const c = window.G.config;
    window.__defaults = { difficulty: c.difficulty, duration: c.duration, preyCount: c.preyCount };
  });

  /* 进入对局：捕鱼 + 多只，保证场上有两个目标 */
  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "fish";
    G.config.preyCount = 3;
    G.config.duration = 60;
    G.startGame();
    G.session.counting = false;
    G.session.running = true;
    G.switchScreen("playing");
    G.topUpPreys();
  });
  await page.waitForTimeout(400);

  const out = [];
  const ok = (c, msg, extra) => out.push((c ? "✅ " : "❌ ") + msg + (extra != null ? "  → " + extra : ""));

  /* ---------- ① 双爪同时命中两个猎物 ---------- */
  const r1 = await page.evaluate(() => {
    const G = window.G, S = G.platform.S || 1;
    while (G.preys.length < 2) G.topUpPreys();
    const a = G.preys[0], b = G.preys[1];
    a.x = 180; a.y = 200; a.fade = 1; a.vanishT = 0;
    b.x = 600; b.y = 200; b.fade = 1; b.vanishT = 0;
    G.session.hits = 0; G.session.touches = 0; G.session.dualPaw = 0; G.session.touchLog = [];
    G.platform.onTouchStart({ changedTouches: [
      { identifier: 11, clientX: a.x, clientY: a.y },
      { identifier: 12, clientX: b.x, clientY: b.y }
    ]});
    return { hits: G.session.hits, touches: G.session.touches, dual: G.session.dualPaw || 0 };
  });
  ok(r1.hits === 2, "双爪同时落在两个猎物上 → 两次命中", JSON.stringify(r1));
  ok(r1.dual === 1, "双爪乱拍记一次（同窗口去重）", "dualPaw=" + r1.dual);

  /* ---------- ② 按住一只爪子后，第二只爪子仍可命中 ---------- */
  const r2 = await page.evaluate(() => {
    const G = window.G;
    const a = G.preys.find(p => p.vanishT <= 0) || G.preys[0];
    a.x = 300; a.y = 240; a.fade = 1; a.vanishT = 0;
    const b = G.preys.find(p => p !== a) || G.preys[1];
    b.x = 560; b.y = 240; b.fade = 1; b.vanishT = 0;
    G.session.hits = 0; G.session.touches = 0; G.session.touchLog = [];
    // 第一只爪子落在空处（拍空，不算命中但保持按住）
    G.platform.onTouchStart({ changedTouches: [{ identifier: 21, clientX: 60, clientY: 60 }] });
    const midTouches = G.session.touches;
    // 第二只爪子落在猎物上
    G.platform.onTouchStart({ changedTouches: [{ identifier: 22, clientX: b.x, clientY: b.y }] });
    return { midTouches, hits: G.session.hits, touches: G.session.touches };
  });
  ok(r2.hits >= 1, "第一只爪子按住时，第二只爪子仍能命中", JSON.stringify(r2));

  /* ---------- ③ 双爪不加分 ---------- */
  const r3 = await page.evaluate(() => {
    const G = window.G;
    const a = G.preys.find(p => p.vanishT <= 0);
    if (!a) return { skip: true };
    a.x = 400; a.y = 200; a.fade = 1; a.vanishT = 0;
    G.session.hits = 0; G.session.bonusHits = 0; G.session.touchLog = []; G.session.lastDualAt = 0;
    G.platform.onTouchStart({ changedTouches: [
      { identifier: 31, clientX: a.x, clientY: a.y },
      { identifier: 32, clientX: 120, clientY: 300 }
    ]});
    return { hits: G.session.hits, bonus: G.session.bonusHits || 0, dual: G.session.dualPaw };
  });
  ok(!r3.skip && r3.hits === 1 && r3.bonus === 0, "一次命中 + 一只拍空 → 计 1 分、无额外加分", JSON.stringify(r3));

  /* ---------- ④ 双爪不打断暂停长按 ---------- */
  const r4 = await page.evaluate(() => {
    const G = window.G, pr = G.ui.pauseRect;
    G.pauseHold.active = false; G.pauseHold.id = null;
    G.platform.onTouchStart({ changedTouches: [{ identifier: 41, clientX: pr.x + pr.w / 2, clientY: pr.y + pr.h / 2 }] });
    const started = G.pauseHold.active;
    G.platform.onTouchStart({ changedTouches: [{ identifier: 42, clientX: 300, clientY: 250 }] });
    const afterSecondPaw = G.pauseHold.active;
    G.platform.onTouchEnd({ changedTouches: [{ identifier: 42, clientX: 300, clientY: 250 }] });
    const afterOtherLifted = G.pauseHold.active;
    G.platform.onTouchEnd({ changedTouches: [{ identifier: 41, clientX: pr.x + pr.w / 2, clientY: pr.y + pr.h / 2 }] });
    const afterSelfLifted = G.pauseHold.active;
    return { started, afterSecondPaw, afterOtherLifted, afterSelfLifted };
  });
  ok(r4.started === true, "长按暂停按钮能进入长按态", JSON.stringify(r4));
  ok(r4.afterSecondPaw === true, "另一只爪子按下不会打断长按");
  ok(r4.afterOtherLifted === true, "另一只爪子抬起不会取消长按");
  ok(r4.afterSelfLifted === false, "按住的那根手指抬起才取消长按");

  /* ---------- ⑤ 非对局界面只认第一根手指 ---------- */
  await page.evaluate(() => { window.G.switchScreen("home"); });
  await page.waitForTimeout(450);                       // 等转场结束，screen 真正变成 home
  const r5 = await page.evaluate(() => {
    const G = window.G;
    window.__clicks = 0;
    const orig = G.hitButton;
    G.hitButton = (x, y) => { window.__clicks++; return orig.call(G, x, y); };
    const btn = G.ui.buttons.slice().reverse().find(b => b.key);
    const cx = btn ? btn.x + btn.w / 2 : 100, cy = btn ? btn.y + btn.h / 2 : 100;
    const S = G.platform.S || 1;
    G.platform.onTouchStart({ changedTouches: [
      { identifier: 51, clientX: cx * S, clientY: cy * S },
      { identifier: 52, clientX: cx * S, clientY: cy * S }
    ]});
    G.hitButton = orig;
    return { clicks: window.__clicks, key: btn && btn.key };
  });
  ok(r5.clicks === 1, "首页双指同时按同一个按钮 → 只触发一次", JSON.stringify(r5));

  /* ---------- 默认值（V1.2） ---------- */
  const r6 = await page.evaluate(() => ({ config: window.__defaults }));

  ok(r6.config.difficulty === "easy" && r6.config.duration === 60 && r6.config.preyCount === 1,
    "默认设置 = 单只 / 悠闲 / 1 分钟", JSON.stringify(r6.config));

  console.log(out.join("\n"));
  console.log("运行时报错: " + (errs.length ? errs.slice(0, 3).join(" | ") : "无"));
  await browser.close();
})();
