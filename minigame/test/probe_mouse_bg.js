/* probe_mouse_bg.js — 验证「捕鼠背景选择」：
   ① 背景表/默认值（2 套：room/swarm，plaid 已移除）  ② 点开始弹选择层  ③ 左右滑动 + 边界阻尼
   ④ 确认后落库并开局  ⑤ swarm 布景（无洞群鼠满屏）  ⑥ swarm 命中彩屑
   ⑦ room 布景可切回  ⑧ 单背景玩法不弹层  ⑨ 一屏约 1.5 张卡  ⑩ 真渲染截图
   用法：NODE_PATH=<npm> node test/probe_mouse_bg.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/mousebg";
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
    wx.shareAppMessage=(o)=>{}; wx.onShareAppMessage=()=>{}; wx.showShareMenu=()=>{};
    wx.showToast=()=>{}; wx.showModal=()=>{}; wx.getSetting=(o)=>o.success&&o.success({authSetting:{}});
    wx.authorize=(o)=>o.success&&o.success(); wx.openSetting=(o)=>o.success&&o.success({});
    wx.saveImageToPhotosAlbum=(o)=>o.success&&o.success();
    wx.reportEvent=()=>{}; wx.reportAnalytics=()=>{}; wx.openCustomerServiceConversation=()=>{};
    wx.createImage=()=>new Image();
    HTMLCanvasElement.prototype.toTempFilePathSync=function(){return this.toDataURL("image/jpeg",0.92);};
    wx.setKeepScreenOn=()=>{};
  })();
`;
async function boot(page, sysInfo) {
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, sysInfo);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(WX_MOCK);
  await page.evaluate(() => { try { localStorage.setItem("catToyAntiShown", "1"); } catch (e) {} });
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

  // 1) 背景表 + 默认值
  const cfg = await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "mouse"; G.saveConfig();
    return {
      bgs: (G.TYPE_BGS.mouse || []).map(b => b.key),
      cur: G.currentBg(),
      stored: JSON.parse(G.platform.storage.get("catToyConfig") || "{}").bg_mouse,
      fishBgs: (G.bgsFor("fish") || []).length
    };
  });
  check("捕鼠有 2 套背景（room/swarm）", cfg.bgs.length === 2 && cfg.bgs.indexOf("swarm") >= 0, JSON.stringify(cfg));
  check("默认背景 room 且已落库", cfg.cur === "room" && cfg.stored === "room", JSON.stringify(cfg));
  check("捕鱼三背景（kelp/pool/school，2026-10-24 起加鱼群）", cfg.fishBgs === 3, JSON.stringify(cfg));

  // 2) 点开始 → 弹出选择层
  const open = await page.evaluate(() => new Promise(res => {
    const G = window.G;
    G.screen = "home"; G.requestStart();
    requestAnimationFrame(() => requestAnimationFrame(() =>     // switchScreen 过渡下一帧生效
      res({ screen: G.screen, next: G.nextScreen, idx: G.bgPick && G.bgPick.idx })));
  }));
  check("点开始弹出背景选择层", (open.screen === "bgpick" || open.next === "bgpick") && open.idx === 0, JSON.stringify(open));

  // 3) 布局：一屏约 1.5 张卡
  await page.waitForTimeout(200);
  const layoutInfo = await page.evaluate(() => {
    const G = window.G, W = G.platform.W;
    return { cw: G.bgPick.cw, ch: G.bgPick.ch, gap: G.bgPick.gap, ratio: G.bgPick.cw / W, buttons: G.ui.buttons.length };
  });
  check("卡片宽 ≤ 0.64 屏且长宽比 ≤ 2.2（横屏不扁长）",
    layoutInfo.ratio <= 0.65 && layoutInfo.cw / layoutInfo.ch <= 2.2, JSON.stringify(layoutInfo));
  check("选择层注册了自己的按钮（左右箭头/返回/开始，共 4 个）", layoutInfo.buttons === 4, JSON.stringify(layoutInfo));
  await page.screenshot({ path: path.join(OUT, "bgpick_room.png") });

  // 4) 左滑两次 → 第 3 张（走真实触摸路由）
  const swipe1 = await page.evaluate(() => {
    const G = window.G, S = G.platform.S || 1;
    const y = G.platform.H * 0.5;
    G.platform.onTouchStart({ touches: [{ clientX: 600 * S, clientY: y }] });
    G.platform.onTouchMove({ touches: [{ clientX: 330 * S, clientY: y }] });
    const midOff = G.bgPick.off;
    G.platform.onTouchEnd({});
    return { idx: G.bgPick.idx, midOff, off: G.bgPick.off };
  });
  check("左滑切到第 2 张", swipe1.idx === 1, JSON.stringify(swipe1));
  check("拖动期间跟手（off 为负）", swipe1.midOff < -100, JSON.stringify(swipe1));
  check("松手吸附回位（off 归零）", swipe1.off === 0, JSON.stringify(swipe1));
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, "bgpick_card2.png") });

  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, "bgpick_swarm.png") });

  // 5) 边界阻尼：末张继续左滑不越界
  const edge = await page.evaluate(() => {
    const G = window.G, S = G.platform.S || 1;
    const y = G.platform.H * 0.5;
    G.platform.onTouchStart({ touches: [{ clientX: 700 * S, clientY: y }] });
    G.platform.onTouchMove({ touches: [{ clientX: 100 * S, clientY: y }] });
    const off = G.bgPick.off;
    G.platform.onTouchEnd({});
    return { idx: G.bgPick.idx, off };
  });
  check("末张继续左滑不越界（idx 停在 1）", edge.idx === 1, JSON.stringify(edge));
  check("越界拖动有阻尼（位移小于手指）", edge.off > -600, JSON.stringify(edge));

  // 6) 确认 → 落库 + 开局
  const confirm = await page.evaluate(() => new Promise(res => {
    const G = window.G;
    G.ui.buttons = [];
    G.confirmBgPick();
    requestAnimationFrame(() => requestAnimationFrame(() => res({
      bg: G.config.bg_mouse,
      stored: JSON.parse(G.platform.storage.get("catToyConfig") || "{}").bg_mouse,
      screen: G.screen, next: G.nextScreen, pickNull: G.bgPick === null
    })));
  }));
  check("确认后写回 config 并持久化（swarm）", confirm.bg === "swarm" && confirm.stored === "swarm", JSON.stringify(confirm));
  check("确认后关闭弹层并进入游戏流程", confirm.pickNull && [confirm.screen, confirm.next].some(x => x === "counting" || x === "playing"), JSON.stringify(confirm));

  // 7) swarm 布景：斑驳地板 + 无洞口 + 固定数量群鼠
  const swarm = await page.evaluate(() => {
    const G = window.G;
    G.config.bg_mouse = "swarm"; G.saveConfig();
    G.buildScene("mouse"); G.buildPreys(); G.topUpPreys();
    const S = G.scene;
    return {
      mouseBg: S.mouseBg, spots: (S.swarmSpots || []).length, holes: (S.holes || []).length,
      win: S.winW, rug: S.rugW, dark: !!S.dark,
      mice: G.preys.length, states: G.preys.map(p => p.state)
    };
  });
  check("swarm 布景生效（斑驳地板 ≥9 块）", swarm.mouseBg === "swarm" && swarm.spots >= 9, JSON.stringify(swarm));
  check("swarm 无洞口（洞口玩法只属于 room）", swarm.holes === 0, "holes=" + swarm.holes);
  check("swarm 固定数量群鼠（阶段① = 4 只）", swarm.mice === 4, "mice=" + swarm.mice);
  check("群鼠状态机（scurry/pause）", swarm.states.every(st => st === "scurry" || st === "pause"), JSON.stringify(swarm.states));
  check("swarm 不生成窗/地毯（整屏铺满）", !swarm.win && !swarm.rug, JSON.stringify(swarm));

  // 8) swarm 真渲染 + 截图
  await page.evaluate(() => {
    const G = window.G;
    G.session.remaining = 999;
    G.nextScreen = null; G.screen = "playing"; G.session.running = true; G.session.counting = false; G.session.paused = false;
    G.ui.buttons = [];
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "mouse_swarm.png") });

  // 9) swarm 命中彩屑（多彩纸条 + 金环）
  const hit = await page.evaluate(() => {
    const G = window.G;
    G.ui.buttons = [];
    G.session.running = true; G.session.paused = false; G.session.counting = false;
    let p = null;
    for (const q of G.preys) if (q.hittable(q.x, q.y)) { p = q; break; }
    if (!p) p = G.preys[0];
    p.fade = 1; p.vanishT = 0;
    const n0 = G.fx.confetti.length;
    const nRing = G.fx.shockwaves.length;
    const cols = new Set();
    G.platform.onTouchStart({ touches: [{ clientX: p.x, clientY: p.y }] });
    G.fx.confetti.slice(n0).forEach(s => cols.add(s.c));
    return { hits: G.session.hits, confetti: G.fx.confetti.length - n0,
             ring: G.fx.shockwaves.length > nRing, colors: Array.from(cols) };
  });
  check("swarm 命中彩屑（≥12 条 / ≥3 色 / 金环）", hit.confetti >= 12 && hit.colors.length >= 3 && hit.ring, JSON.stringify(hit));
  // 9.5) 命中后老鼠重生：数量恒定（固定数量玩法）
  const respawn = await page.evaluate(() => new Promise(res => {
    const G = window.G;
    setTimeout(() => res({ n: G.preys.length }), 600);
  }));
  check("命中重生后数量恒定（4 只）", respawn.n === 4, "n=" + respawn.n);

  // 10) 切回 room：室内布景（洞口玩法回归）
  const room = await page.evaluate(() => {
    const G = window.G;
    G.config.bg_mouse = "room"; G.saveConfig();
    G.buildScene("mouse");
    const S = G.scene;
    return { mouseBg: S.mouseBg, holes: S.holes.length, win: !!S.winW, rug: !!S.rugW };
  });
  check("切到 room 布景（室内房间 + 10 洞）", room.mouseBg === "room" && room.holes === 10 && room.win && room.rug, JSON.stringify(room));
  await page.evaluate(() => { window.G.nextScreen = null; G.screen = "playing"; window.G.session.remaining = 999; window.G.ui.buttons = []; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "mouse_room.png") });

  // 11) 切回 room：室内布景
  const back = await page.evaluate(() => {
    const G = window.G;
    G.config.bg_mouse = "room"; G.saveConfig();
    G.buildScene("mouse");
    const S = G.scene;
    return { mouseBg: S.mouseBg, win: S.winW > 0, rug: S.rugW > 0, holes: S.holes.length };
  });
  check("切回 room 还原室内布景（窗/地毯/洞）", back.mouseBg === "room" && back.win && back.rug && back.holes === 10, JSON.stringify(back));

  // 12) 捕鱼现有两套海域（水草森林/泳池追鱼）→ 点开始同样弹背景选择层
  const fish = await page.evaluate(() => new Promise(res => {
    const G = window.G;
    G.config.targetType = "fish"; G.saveConfig();
    G.screen = "home"; G.requestStart();
    requestAnimationFrame(() => requestAnimationFrame(() =>
      res({ screen: G.screen, next: G.nextScreen, pick: !!G.bgPick, n: (G.bgsFor("fish") || []).length })));
  }));
  check("三海域玩法点开始弹背景选择层", fish.pick && (fish.screen === "bgpick" || fish.next === "bgpick") && fish.n === 3, JSON.stringify(fish));

  // 13) 关闭弹层回首页
  const close = await page.evaluate(() => new Promise(res => {
    const G = window.G;
    G.config.targetType = "mouse"; G.saveConfig();
    G.screen = "home"; G.requestStart();
    requestAnimationFrame(() => {
      const opened = G.screen === "bgpick" || G.nextScreen === "bgpick";
      G.closeBgPick();
      requestAnimationFrame(() => requestAnimationFrame(() =>
        res({ opened, screen: G.screen, pick: G.bgPick })));
    });
  }));
  check("关闭弹层回到首页", close.opened && close.screen === "home" && close.pick === null, JSON.stringify(close));

  check("全程无运行时错误", errs.length === 0, errs.slice(0, 3).join(" | "));

  await browser.close();
  console.log("\n" + (fail === 0 ? "🎉 全部通过 " : "⚠️ 存在失败 ") + pass + "/" + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
