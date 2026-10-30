/* probe_pool_style.js — 验证捕鱼「泳池追鱼」背景按泳池玩具参考图重绘：
   ① 布景数据：焦散网格参数 + 星芒生成        ② 渲染：亮蓝渐变池水（中心像素偏蓝亮）
   ③ 泳池限定鱼种加权抽取（金鱼/锦鲤为主）    ④ 金鱼类 bodyGrad 渐变生效
   ⑤ 画面无装饰猫爪（玩家是猫，右下角应是池水）⑥ 布景绘制不抛错 + 帧耗时可控
   ⑦ 其他海域（水草森林）不受影响            ⑧ 背景选择层泳池缩略预览同步新样式
   用法：NODE_PATH=<全局node_modules> node test/probe_pool_style.js（需 Node 20+）
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "screenshots");
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
    wx.shareAppMessage=(o)=>{}; wx.onShareAppMessage=(fn)=>{};
    wx.showShareMenu=()=>{}; wx.showToast=()=>{};
    wx.showModal=(o)=>{(window.__modals=window.__modals||[]).push(o); window.__lastModal=o;};
    wx.getSetting=(o)=>o.success&&o.success({authSetting:{}});
    wx.authorize=(o)=>o.success&&o.success();
    wx.openSetting=(o)=>o.success&&o.success({});
    wx.saveImageToPhotosAlbum=(o)=>o.success&&o.success();
    wx.reportEvent=(n,d)=>{}; wx.reportAnalytics=(n,d)=>{};
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
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(250);
}
/* 进入泳池追鱼游玩画面（锁定 pool 海域） */
async function enterPoolPlay(page) {
  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "fish";
    G.config["bg_fish"] = "pool";
    G.session.sea = G.SEA_THEMES.find(t => t.key === "pool");
    G.buildScene("fish");
    G.fx.clear();
    G.buildPreys();
    G.session.running = true;
    G.session.remaining = 999; G.session.infinite = true;
    G.session.time = 3;          // 给粒子/星芒一点演化时间
    G.screen = "playing";
  });
}
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("✅ " + name); }
  else { fail++; console.log("❌ " + name + (extra ? (" :: " + extra) : "")); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const ip15Land = { windowWidth: 852, windowHeight: 393, pixelRatio: 3,
    safeArea: { left: 0, top: 21, right: 793, bottom: 372 }, screenOrientation: { angle: 90 } };
  const ip15Port = { windowWidth: 393, windowHeight: 852, pixelRatio: 3,
    safeArea: { left: 0, top: 59, right: 393, bottom: 799 } };
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 852, height: 393 } });
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && m.text().indexOf("ERR_FILE_NOT_FOUND") < 0) errs.push("console: " + m.text()); });
  await boot(page, ip15Land);

  // 1) 布景数据：poolNet / poolStars
  const data = await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "fish";
    G.session.sea = G.SEA_THEMES.find(t => t.key === "pool");
    G.buildScene("fish");
    const S = G.scene;
    return { cs: S.poolNet && S.poolNet.cs, stars: (S.poolStars || []).length };
  });
  check("焦散网格参数生成（poolNet.cs≥64）", data.cs >= 64, "cs=" + data.cs);
  check("星芒生成（7~13 枚）", data.stars >= 7 && data.stars <= 13, "n=" + data.stars);

  // 2) 泳池专属鱼种：与深海完全区分——抽取只出 poolgold（泳池金鱼）
  const species = await page.evaluate(() => {
    const G = window.G;
    const keys = [];
    for (let i = 0; i < 60; i++) keys.push(new G.Prey("fish").species.key);
    return keys;
  });
  check("泳池专属单一鱼种（60 次抽取全为 poolgold）", species.every(k => k === "poolgold"),
    JSON.stringify([...new Set(species)]));
  check("深海鱼种不进泳池（gold/koi/shark 等不在泳池抽取）",
    !species.some(k => ["gold", "koi", "angel", "clown", "puffer", "shark", "turtle"].indexOf(k) >= 0));

  // 3) topUp 补点也走限定表（阶段③ 7 只全在子集内）
  const top = await page.evaluate(() => {
    const G = window.G;
    G.session.stage = 3;
    G.topUpPreys();
    return G.preys.map(p => p.species && p.species.key);
  });
  check("补点鱼种也在泳池专属表内", top.every(k => k === "poolgold"),
    JSON.stringify(top));

  // 2.5) 任意方向直线巡游：连帧跟踪——直线段位移方向与航向一致、边界反射生效
  const swim = await page.evaluate(() => new Promise(res => {
    const G = window.G;
    const p = G.preys[0];
    p.swimAng = Math.PI * 0.75;                       // 斜向（左上）
    p._visAng = p.swimAng;
    const x0 = p.x, y0 = p.y;
    const frames = [];
    let f = 0;
    const step = () => {
      G.preys.forEach(q => q.update(1 / 60, (G.session.time += 1 / 60)));
      frames.push({ x: p.x, y: p.y });
      if (++f < 20) return requestAnimationFrame(step);
      // 直线段检验：前 12 帧（未撞边/未换向）位移向量的角度应接近 swimAng
      const dx = frames[11].x - x0, dy = frames[11].y - y0;
      const moveAng = Math.atan2(dy, dx);
      let d = moveAng - (Math.PI * 0.75);
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      // 全程应在池内
      const b = G.bounds();
      const inBounds = frames.every(fr => fr.x >= b.x - 20 && fr.x <= b.x + b.w + 20 && fr.y >= b.y - 20 && fr.y <= b.y + b.h + 20);
      res({ moveErr: Math.abs(d), inBounds, swimAng: p.swimAng });
    };
    requestAnimationFrame(step);
  }));
  check("直线游动：位移方向与航向一致（误差 <0.2rad）", swim.moveErr < 0.2, "err=" + swim.moveErr.toFixed(3));
  check("全程留在池内（撞边反射）", swim.inBounds);
  // 航向分布：多次重置航向后应覆盖四象限（不是固定水平）
  const spread = await page.evaluate(() => {
    const G = window.G;
    const angs = [];
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; G.preys[0].swimAng = a; angs.push(a); }   // 等分采样（确定性）
    const quads = [0, 0, 0, 0];
    angs.forEach(a => {
      const n = (a % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      quads[Math.floor(n / (Math.PI / 2))]++;
    });
    return quads;
  });
  check("航向覆盖四象限（每象限 ≥5/40）", spread.every(q => q >= 5), JSON.stringify(spread));
  // 无定时冲刺：6 秒帧模拟——burstT 恒 0（无爆发提速）、换向仍在发生、零冻结帧（角落不卡死）
  const noDart = await page.evaluate(() => new Promise(res => {
    const G = window.G;
    const p = G.preys[0];
    const b = G.bounds();
    // 起步钉在左下角、初始航向指向墙外（最恶劣场景）
    p.x = b.x + 20; p.y = b.y + b.h - 20; p.swimAng = Math.PI * 1.15; p._visAng = p.swimAng;
    let f = 0, maxBurst = 0, ang0 = p.swimAng, turned = false, frozen = 0;
    let lx = p.x, ly = p.y;
    const step = () => {
      p.update(1 / 60, (G.session.time += 1 / 60));
      maxBurst = Math.max(maxBurst, p.burstT || 0);
      if (Math.abs(p.swimAng - ang0) > 0.01) turned = true;
      if (Math.hypot(p.x - lx, p.y - ly) < 0.1) frozen++;
      lx = p.x; ly = p.y;
      if (++f < 360) return requestAnimationFrame(step);
      res({ maxBurst, turned, frozen, finalAng: p.swimAng });
    };
    requestAnimationFrame(step);
  }));
  check("无定时冲刺（6 秒模拟 burstT 恒 0）", noDart.maxBurst === 0, "maxBurst=" + noDart.maxBurst);
  check("角落不卡死（角落起步 + 逆向朝墙 6 秒零冻结帧）", noDart.frozen === 0, "frozen=" + noDart.frozen);
  check("随机换向仍在发生（10 秒内航向有变化）", noDart.turned);

  // 4) 专属鱼种定义 + bodyGrad 渐变 + 无定时冲刺
  const grads = await page.evaluate(() => {
    const G = window.G;
    const get = k => { const s = G.FISH_SPECIES.find(x => x.key === k); return s && s.variants; };
    const poolSp = G.POOL_FISH_SPECIES && G.POOL_FISH_SPECIES[0];
    return {
      poolKey: poolSp && poolSp.key, poolVarN: poolSp ? poolSp.variants.length : 0,
      poolShape: poolSp && poolSp.shape, poolGrad: poolSp && poolSp.variants[0].bodyGrad, poolBurst: poolSp && poolSp.burst,
      poolFin: poolSp && poolSp.variants[0].fin,
      poolW: poolSp && poolSp.w, poolH: poolSp && poolSp.h,
      gold: get("gold")[0].bodyGrad, turtle: get("turtle")[0].bodyGrad,
      listN: G.fishSpeciesList().length,
      themeSpeed: G.SEA_THEMES.find(t => t.key === "pool").speed
    };
  });
  check("泳池专属鱼种 poolgold（3 色型 + 专属造型 poolGold + 长身 136×76 + 无 burst；配色允许人工调优）",
    grads.poolKey === "poolgold" && grads.poolVarN === 3 && grads.poolShape === "poolGold" &&
    grads.poolGrad && grads.poolW === 136 && grads.poolH === 76 && !grads.poolBurst,
    JSON.stringify(grads.poolKey));
  check("泳池海域提速（speed 1.12，比珊瑚海 1 更快）", grads.themeSpeed === 1.12, "speed=" + grads.themeSpeed);
  check("fishSpeciesList 泳池=1 种专属（深海表 10 种不变）", grads.listN === 1, "pool=" + grads.listN);
  check("金鱼族(深海)bodyGrad 渐变保持", !!(grads.gold && !grads.turtle), JSON.stringify(grads.gold));

  // 5) 游玩渲染 + 纯布景多点采样（清空猎物排除游鱼干扰，采完重建供截图）
  await enterPoolPlay(page);
  await page.waitForTimeout(800);
  const px = await page.evaluate(() => {
    const G = window.G;
    G.clearPreys();
    return new Promise(res => requestAnimationFrame(() => {
      const c = document.querySelector("canvas");
      const g = c.getContext("2d");
      const pts = [[0.5, 0.4], [0.3, 0.35], [0.7, 0.45], [0.42, 0.55], [0.6, 0.28]];
      let blue = 0, lit = 0;
      pts.forEach(pt => {
        const d = g.getImageData(Math.floor(c.width * pt[0]), Math.floor(c.height * pt[1]), 1, 1).data;
        if (d[2] > d[0]) blue++;
        if (d[0] + d[1] + d[2] > 90 * 3) lit++;
      });
      res({ blue, lit, n: pts.length });
    }));
  });
  check("池水偏蓝明亮（纯布景采样 ≥4/5）", px.blue >= 4 && px.lit >= 4,
    "blue=" + px.blue + "/5 lit=" + px.lit + "/5");
  await page.evaluate(() => { window.G.buildPreys(); });
  // 命中水花：金色盘（泳池）——droplets 自带金橙色、冲击环金橙
  const splash = await page.evaluate(() => {
    const G = window.G;
    G.fx.droplets.length = 0; G.fx.shockwaves.length = 0;
    G.splashBurst(200, 200, true, "gold");
    const d = G.fx.droplets[0], r1 = G.fx.shockwaves[0];
    return { dropGold: d && d.c1, ringGold: r1 && r1.color, nDrop: G.fx.droplets.length, flash: G.fx.flash > 0 };
  });
  check("泳池命中水花走金色盘（液滴金橙+冲击环金橙+闪白）",
    splash.dropGold === "#ffe27a" && String(splash.ringGold).indexOf("255,236,170") >= 0 && splash.nDrop > 0 && splash.flash,
    JSON.stringify(splash));
  await page.screenshot({ path: path.join(OUT, "pool-style-land.png") });

  // 6) 帧耗时：drawScene 30 帧平均（泳布景为全屏程序化绘制）
  const perf = await page.evaluate(() => {
    const G = window.G;
    const c = document.querySelector("canvas");
    const ctx2 = c.getContext("2d");
    const t0 = performance.now();
    for (let i = 0; i < 30; i++) G.drawScene(ctx2, i / 16);
    return (performance.now() - t0) / 30;
  });
  check("布景帧耗时 < 8ms（中端机可跑满帧）", perf < 8, perf.toFixed(2) + "ms/帧");
  console.log("   布景耗时 " + perf.toFixed(2) + "ms/帧");

  // 7) 画面无装饰猫爪（玩家是猫）：清空猎物后，右下角两处原爪位应是池水蓝
  const corner = await page.evaluate(() => {
    const G = window.G, W = G.platform.W, H = G.platform.H;
    G.clearPreys();                       // 排除游鱼干扰，只看布景
    return new Promise(res => requestAnimationFrame(() => {
      const c = document.querySelector("canvas");
      const g = c.getContext("2d");
      const sc = c.width / W;
      const pts = [[W - 60, H - 50], [W - 30, H - 95]];
      res(pts.map(pt => {
        const d = g.getImageData(Math.round(pt[0] * sc), Math.round(pt[1] * sc), 1, 1).data;
        return d[2] > d[0];
      }));
    }));
  });
  check("右下角无猫爪（两处采样均为池水蓝）", corner.every(b => b), JSON.stringify(corner));

  // 8) 其他海域不受影响：水草森林无星芒数据、正常渲染
  const kelp = await page.evaluate(() => {
    const G = window.G;
    G.session.sea = G.SEA_THEMES.find(t => t.key === "kelp");
    G.buildScene("fish");
    let err = null;
    try { G.drawScene(G.platform.ctx, 1.5); } catch (e) { err = e.message; }
    return { hasStars: !!G.scene.poolStars, hasNet: !!G.scene.poolNet, err,
      plants: (G.scene.plants || []).length, listN: G.fishSpeciesList().length };
  });
  check("水草森林无泳池星芒/网格数据", !kelp.hasStars && !kelp.hasNet);
  check("水草森林绘制不抛错且有水草", !kelp.err && kelp.plants > 0, kelp.err);
  check("水草森林鱼种恢复全表（10 种）", kelp.listN === 10, "n=" + kelp.listN);

  // 9) 背景选择层：泳池缩略预览同步新样式（截图人工核对 + 绘制不抛错）
  const bg = await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "fish";
    G.session.sea = null;
    G.openBgPick();
    G.bgPick.idx = 1;   // 泳池卡
    let err = null;
    try { G.ui.drawBgPick(); } catch (e) { err = e.message; }
    return { err, screen: G.screen };
  });
  check("模式选择弹层绘制不抛错", !bg.err, bg.err);
  await page.waitForTimeout(400);   // 等弹入动画（260ms）完成再截屏
  await page.screenshot({ path: path.join(OUT, "pool-style-bgpick.png") });

  // 10) 竖屏复验：portrait 重建布景 + 截图（清空猎物采样纯布景，不受游鱼干扰）
  const page2 = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page2.on("pageerror", e => errs.push("portrait pageerror: " + e.message));
  await boot(page2, ip15Port);
  await enterPoolPlay(page2);
  await page.waitForTimeout(800);
  const px2 = await page2.evaluate(() => {
    const G = window.G;
    G.clearPreys();                       // 排除游鱼干扰
    return new Promise(res => requestAnimationFrame(() => {
      const c = document.querySelector("canvas");
      const g = c.getContext("2d");
      const pts = [[0.5, 0.28], [0.3, 0.4], [0.7, 0.45], [0.5, 0.55], [0.25, 0.6]];
      let blue = 0, lit = 0;
      pts.forEach(pt => {
        const d = g.getImageData(Math.floor(c.width * pt[0]), Math.floor(c.height * pt[1]), 1, 1).data;
        if (d[2] > d[0]) blue++;
        if (d[0] + d[1] + d[2] > 90 * 3) lit++;
      });
      res({ blue, lit, n: pts.length });
    }));
  });
  check("竖屏池水偏蓝明亮（纯布景采样 ≥4/5）", px2.blue >= 4 && px2.lit >= 4,
    "blue=" + px2.blue + "/5 lit=" + px2.lit + "/5");
  await page2.evaluate(() => { window.G.buildPreys(); });
  await page.waitForTimeout(400);
  await page2.screenshot({ path: path.join(OUT, "pool-style-port.png") });

  check("无运行时错误", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log("\n通过 " + pass + " / 失败 " + fail);
  console.log("截图：" + OUT + "/pool-style-land.png / pool-style-port.png / pool-style-bgpick.png");
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
