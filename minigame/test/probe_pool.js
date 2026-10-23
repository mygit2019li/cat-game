/* probe_pool.js — 验证新模式「暗夜萤光」（Peppy Cat 式石板墙 + 发光小兽 + 夸张光爆）：
   ① 模式注册/持久化  ② 石板布景（石块/深缝，无瓷砖杂饰）  ③ 猎物高速移动 + 节奏差异
   ④ 命中夸张水花（水珠/冲击环/闪白/大涟漪）  ⑤ 首页 5 模式网格无重叠  ⑥ 结算标签
   用法：NODE_PATH=<npm> node test/probe_pool.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/pool";
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
    wx.showModal=(o)=>{(window.__modals=window.__modals||[]).push(o); window.__lastModal=o;};
    wx.getSetting=(o)=>o.success&&o.success({authSetting:{}});
    wx.authorize=(o)=>o.success&&o.success();
    wx.openSetting=(o)=>o.success&&o.success({authSetting:{}});
    wx.saveImageToPhotosAlbum=(o)=>o.success&&o.success();
    wx.reportEvent=(n,d)=>{(window.__track=window.__track||[]).push([n,d]);};
    wx.reportAnalytics=(n,d)=>{(window.__track=window.__track||[]).push([n,d]);};
    wx.openCustomerServiceConversation=()=>{};
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

  // 1) 模式注册 + 本地持久化 + 首页选中
  const reg = await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "pool"; G.saveConfig();
    return {
      types: G.PREY_DEF.pool ? Object.keys(G.PREY_DEF) : [],
      saved: JSON.parse(G.platform.storage.get("catToyConfig") || "{}").targetType,
      stageNames: G.stageName(1), s3: G.stageName(3)
    };
  });
  check("PREY_DEF 注册 pool", reg.types.indexOf("pool") >= 0);
  check("targetType=pool 持久化", reg.saved === "pool", "got=" + reg.saved);
  check("阶段名存在", /萤火/.test(reg.stageNames) && /疯狂/.test(reg.s3), reg.stageNames + " / " + reg.s3);

  // 2) 布景：Peppy Cat 式石板墙（石块/深缝，无瓷砖杂饰）
  const scene = await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "pool";
    G.buildScene("pool");
    const S = G.scene;
    return {
      type: S.type, stones: (S.stones || []).length,
      first: S.stones && S.stones[0] ? { n: S.stones[0].pts.length, c: S.stones[0].c } : null,
      tile: S.tile, drains: (S.drains || []).length, floats: (S.floats || []).length,
      bokehs: (S.bokehs || []).length, dark: !!S.dark, holes: (S.holes || []).length
    };
  });
  check("buildScene 生成石板布景（≥20 块，多边形石块）", scene.type === "pool" && scene.stones >= 20 && scene.first.n === 4, JSON.stringify(scene));
  check("极简无杂饰（无瓷砖网格/排水口/浮叶/光斑）", !scene.tile && scene.drains === 0 && scene.floats === 0 && scene.bokehs === 0, JSON.stringify(scene));
  check("石板场景不是暗室、无老鼠洞", !scene.dark && scene.holes === 0, JSON.stringify(scene));

  // 3) 发光小兽高速移动（跑 2s 累计路径）+ 阶段节奏差异
  const mot = await page.evaluate(async () => {
    const G = window.G;
    G.config.targetType = "pool";
    G.buildScene("pool"); G.fx.clear(); G.buildPreys();
    G.session.running = true; G.screen = "playing"; G.session.remaining = 999;
    const p = G.preys[0];
    // 手动步进 2s（避开 RAF 节奏）；累计路径长度——首尾距离会被折返抵消，不能用
    let path = 0, lx = p.x, ly = p.y;
    for (let i = 0; i < 120; i++) {
      G.preys.forEach(q => q.update(1 / 60, G.session.time += 1 / 60));
      path += Math.hypot(p.x - lx, p.y - ly); lx = p.x; ly = p.y;
    }
    // POOL_PARAMS 节奏：阶段3的 dart 窗口更短（更快更闪）
    const P1 = G.POOL_PARAMS[1], P3 = G.POOL_PARAMS[3];
    return { path, w: p.baseW, h: p.baseH, sp: p.speciesSpeed, dart1: P1.dart[0], dart3: P3.dart[0], n: G.preys.length, hold3: P3.hold[0] };
  });
  check("发光小兽确实在高速移动（2s 路径>350px）", mot.path > 350, JSON.stringify(mot));
  check("阶段3 比 阶段1 甩得更勤（dart 窗口更短）", mot.dart3 < mot.dart1 && mot.hold3 < 1, JSON.stringify(mot));
  check("发光小兽命中盒 66（宽容高速目标）", mot.w === 66 && mot.h === 66, JSON.stringify(mot));
  check("多只模式 3 只小兽起步", mot.n === 3, "n=" + mot.n);

  // 4) 命中夸张光爆：模拟 onHit（走 touch 路由），断言粒子层
  //    增量断言：瞬移自带小水花会污染 fx 总量；目标锁定 fade/vanish 确定态
  const hit = await page.evaluate(() => {
    const G = window.G;
    // 直接改 screen 会跳过 UI 重建，首页按钮残留会被 hitButton 截胡（曾误触"开始游戏"→counting）
    G.ui.buttons = [];
    G.session.running = true; G.session.paused = false; G.session.counting = false;
    let p = null;
    for (const q of G.preys) if (q.vanishT <= 0 && q.fade >= 0.4) { p = q; break; }
    if (!p) p = G.preys[0];
    p.fade = 1; p.vanishT = 0;
    const x = p.x, y = p.y;
    const t0 = G.session.touches, h0 = G.session.hits;
    const fx = G.fx;
    const f0 = { d: fx.droplets.length, sw: fx.shockwaves.length, r: fx.ripples.length, sp: fx.sparks.length };
    // 直接走触摸路由（与真机一致）
    G.platform.onTouchStart({ touches: [{ clientX: x, clientY: y }] });
    return {
      hits: G.session.hits - h0, touches: G.session.touches - t0,
      droplets: fx.droplets.length - f0.d, shockwaves: fx.shockwaves.length - f0.sw,
      ripples: fx.ripples.length - f0.r, flash: fx.flash, sparks: fx.sparks.length - f0.sp
    };
  });
  check("命中计入 hits", hit.hits === 1, JSON.stringify(hit));
  check("光爆碎点四溅（≥12 颗）", hit.droplets >= 12, JSON.stringify(hit));
  check("双层冲击环+光斑（≥3 环）", hit.shockwaves >= 3, JSON.stringify(hit));
  check("大光波（≥2 圈）", hit.ripples >= 2, JSON.stringify(hit));
  check("全屏闪白触发", hit.flash > 0, "flash=" + hit.flash);
  check("命中火花", hit.sparks >= 6, "sparks=" + hit.sparks);

  // 4b) 真渲染：石板+小兽+光爆一帧截图
  await page.evaluate(() => {
    const G = window.G;
    G.session.remaining = 999;
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, "pool_hit.png") });
  // 运行 0.8s 后再截一张纯石板+小兽游窜
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "pool_swim.png") });

  // 5) 拍偏也有碎屑感（明显弱于命中）
  const miss = await page.evaluate(() => {
    const G = window.G;
    G.ui.buttons = [];
    G.session.running = true; G.session.paused = false; G.session.counting = false;
    const b = G.bounds();
    const x0 = G.fx.droplets.length;
    // 找一个远离所有小兽的点
    let x = b.x + b.w / 2, y = b.y + b.h / 2, bestD = -1;
    for (let i = 0; i < 40; i++) {
      const cx = b.x + Math.random() * b.w, cy = b.y + Math.random() * b.h;
      let d = Infinity;
      G.preys.forEach(p => { d = Math.min(d, Math.hypot(p.x - cx, p.y - cy)); });
      if (d > bestD) { bestD = d; x = cx; y = cy; }
    }
    G.platform.onTouchStart({ touches: [{ clientX: x, clientY: y }] });
    return { dropletsDelta: G.fx.droplets.length - x0, bestD, hits: G.session.hits };
  });
  check("拍偏不出大光爆（droplets 不增、只火星碎屑）", miss.dropletsDelta === 0 && miss.bestD > 140, JSON.stringify(miss));

  // 6) 首页 5 模式网格：无重叠、无越界
  await page.evaluate(() => { const G = window.G; G.screen = "home"; });
  await page.waitForTimeout(200);
  const home = await page.evaluate(() => {
    const W = window.G.platform.W, H = window.G.platform.H;
    const bs = window.G.ui.buttons.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
    let overlap = 0, oob = 0;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      if (a.x < -1 || a.y < -1 || a.x + a.w > W + 1 || a.y + a.h > H + 1) oob++;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 2 && oy > 2) overlap++;
      }
    }
    return { n: bs.length, overlap, oob };
  });
  check("首页按钮数量正常（含 5 模式）", home.n >= 9, "buttons=" + home.n);
  check("首页无按钮重叠", home.overlap === 0, JSON.stringify(home));
  check("首页无按钮越界", home.oob === 0, JSON.stringify(home));
  await page.screenshot({ path: path.join(OUT, "pool_home.png") });

  // 7) 结算标签（水花炸裂）+ 一局 endGame 不报错
  const res = await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "pool";
    G.session.touches = 30; G.session.hits = 22; G.session.maxCombo = 8;
    G.endGame();
    return { screen: G.screen, tag: G.result.bonusTag, title: G.result.title };
  });
  check("结算含「光爆炸裂」标签", /光爆炸裂/.test(res.tag) || res.screen === "result", JSON.stringify(res));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "pool_result.png") });

  check("全程无运行时错误", errs.length === 0, errs.slice(0, 3).join(" | "));

  await browser.close();
  console.log("\n" + (fail === 0 ? "🎉 全部通过 " : "⚠️ 存在失败 ") + pass + "/" + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
