/* probe_mouse_bg.js — 验证「捕鼠背景选择」：
   ① 背景表/默认值  ② 点开始弹选择层  ③ 左右滑动切换 + 边界阻尼
   ④ 确认后落库并开局  ⑤ plaid 布景（格纹/洞仍在）  ⑥ 单背景玩法不弹层
   ⑦ 一屏约 1.5 张卡  ⑧ 真渲染截图
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
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./game.js"];
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
  check("捕鼠有 2 套背景（room/plaid）", cfg.bgs.length === 2 && cfg.bgs.indexOf("plaid") >= 0, JSON.stringify(cfg));
  check("默认背景 room 且已落库", cfg.cur === "room" && cfg.stored === "room", JSON.stringify(cfg));
  check("单背景玩法（fish）背景表为空", cfg.fishBgs === 0, JSON.stringify(cfg));

  // 2) 点开始 → 弹出选择层（不直接开局）
  const open = await page.evaluate(() => {
    const G = window.G;
    G.screen = "home";
    G.requestStart();
    return { screen: G.screen, idx: G.bgPick && G.bgPick.idx, off: G.bgPick && G.bgPick.off };
  });
  check("点开始弹出背景选择层", open.screen === "bgpick" && open.idx === 0, JSON.stringify(open));

  // 3) 布局：一屏约 1.5 张卡 + 截图（第一张）
  await page.waitForTimeout(200);
  const layoutInfo = await page.evaluate(() => {
    const G = window.G, W = G.platform.W;
    return { cw: G.bgPick.cw, gap: G.bgPick.gap, ratio: G.bgPick.cw / W, buttons: G.ui.buttons.length };
  });
  check("卡片宽 ≈ 0.64 屏（一屏露 1.5 张）", Math.abs(layoutInfo.ratio - 0.64) < 0.02, JSON.stringify(layoutInfo));
  check("选择层注册了自己的按钮（开始/关闭）", layoutInfo.buttons === 2, JSON.stringify(layoutInfo));
  await page.screenshot({ path: path.join(OUT, "bgpick_room.png") });

  // 4) 左滑切换到第二张（走真实触摸路由）
  const swipe = await page.evaluate(() => {
    const G = window.G, S = G.platform.S || 1;
    const y = G.platform.H * 0.5;
    G.platform.onTouchStart({ touches: [{ clientX: 600 * S, clientY: y }] });
    G.platform.onTouchMove({ touches: [{ clientX: 330 * S, clientY: y }] });
    const midOff = G.bgPick.off;
    G.platform.onTouchEnd({});
    return { idx: G.bgPick.idx, midOff, off: G.bgPick.off, cw: G.bgPick.cw };
  });
  check("左滑切到第二张背景", swipe.idx === 1, JSON.stringify(swipe));
  check("拖动期间跟手（off 为负）", swipe.midOff < -100, JSON.stringify(swipe));
  check("松手吸附回位（off 归零）", swipe.off === 0, JSON.stringify(swipe));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, "bgpick_plaid.png") });

  // 5) 边界阻尼：末张继续左滑不出界
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
  const confirm = await page.evaluate(() => {
    const G = window.G;
    G.ui.buttons = [];
    G.confirmBgPick();
    return {
      bg: G.config.bg_mouse,
      stored: JSON.parse(G.platform.storage.get("catToyConfig") || "{}").bg_mouse,
      screen: G.screen, pickNull: G.bgPick === null
    };
  });
  check("确认后写回 config 并持久化", confirm.bg === "plaid" && confirm.stored === "plaid", JSON.stringify(confirm));
  check("确认后关闭弹层并进入游戏流程", confirm.pickNull && (confirm.screen === "counting" || confirm.screen === "playing"), JSON.stringify(confirm));

  // 7) plaid 布景：格纹 + 洞仍在（玩法不能瘸）
  const scene = await page.evaluate(() => {
    const G = window.G;
    G.buildScene("mouse");
    const S = G.scene;
    return {
      mouseBg: S.mouseBg, plaid: !!S.plaid, cell: S.plaid && S.plaid.cell,
      holes: S.holes.length, win: S.winW, rug: S.rugW, dark: !!S.dark
    };
  });
  check("plaid 布景生效（格纹参数已生成）", scene.mouseBg === "plaid" && scene.plaid && scene.cell >= 78, JSON.stringify(scene));
  check("格纹背景仍保留 10 个洞口", scene.holes === 10, JSON.stringify(scene));
  check("格纹背景不再生成窗/地毯（整屏铺满）", !scene.win && !scene.rug, JSON.stringify(scene));

  // 8) 真渲染：格纹地毯 + 老鼠 + 洞
  const play = await page.evaluate(() => {
    const G = window.G;
    G.session.remaining = 999;
    G.screen = "playing"; G.session.running = true; G.session.counting = false; G.session.paused = false;
    G.ui.buttons = [];
    return { preys: G.preys.length, holes: G.scene.holes.length };
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "mouse_plaid.png") });
  check("格纹场景能正常运行（老鼠已生成）", play.preys >= 1, JSON.stringify(play));

  // 9) 切回 room：布景还原
  const back = await page.evaluate(() => {
    const G = window.G;
    G.config.bg_mouse = "room"; G.saveConfig();
    G.buildScene("mouse");
    const S = G.scene;
    return { mouseBg: S.mouseBg, plaid: !!S.plaid, win: S.winW > 0, rug: S.rugW > 0, holes: S.holes.length };
  });
  check("切回 room 还原室内布景（窗/地毯/洞）", back.mouseBg === "room" && back.win && back.rug && back.holes === 10, JSON.stringify(back));

  // 10) 单背景玩法不弹层
  const fish = await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "fish"; G.saveConfig();
    G.screen = "home";
    G.requestStart();
    return { screen: G.screen, pick: !!G.bgPick };
  });
  check("单背景玩法点开始直接开局（不弹层）", !fish.pick && fish.screen !== "bgpick", JSON.stringify(fish));

  // 11) 关闭按钮回到首页
  const close = await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "mouse"; G.saveConfig();
    G.screen = "home"; G.requestStart();
    const opened = G.screen === "bgpick";
    G.closeBgPick();
    return { opened, screen: G.screen, pick: G.bgPick };
  });
  check("关闭弹层回到首页", close.opened && close.screen === "home" && close.pick === null, JSON.stringify(close));

  check("全程无运行时错误", errs.length === 0, errs.slice(0, 3).join(" | "));

  await browser.close();
  console.log("\n" + (fail === 0 ? "🎉 全部通过 " : "⚠️ 存在失败 ") + pass + "/" + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
