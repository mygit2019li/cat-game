/* healthcheck.js — 项目「打开失败」体检
   覆盖：冷启动加载 / 主循环连续帧 / 全部界面 · 全部玩法 · 全部阶段 / 触摸路由 /
        多分辨率 / 分享与存图链路 / 开放数据域独立加载
   输出：控制台汇总 + _排查截图存档/health/ 下各场景截图（用于目检图形异常）
   用法：NODE_PATH=<npm modules> node test/healthcheck.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/health";
fs.mkdirSync(OUT, { recursive: true });

function findChrome() {
  for (const p of [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    process.env.CHROME_PATH || ""
  ]) if (p && fs.existsSync(p)) return p;
  throw new Error("no chrome found");
}

const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

/* 分享 / 相册 / 埋点等 harness 未覆盖的 API；createImage 要能把相对 assets 路径解析到项目根 */
const WX_MOCK = `
  (function(){
    const wx = window.wx;
    const ROOT = ${JSON.stringify("file://" + ROOT + "/")};
    wx.shareAppMessage = (o) => { (window.__shares = window.__shares || []).push(o); };
    wx.onShareAppMessage = (fn) => { window.__shareFactory = fn; };
    wx.showShareMenu = () => {};
    wx.showToast = (o) => { (window.__toasts = window.__toasts || []).push(o); };
    wx.showModal = (o) => { (window.__modals = window.__modals || []).push(o); };
    wx.getSetting = (o) => o.success && o.success({ authSetting: {} });
    wx.authorize = (o) => o.success && o.success();
    wx.openSetting = (o) => o.success && o.success({ authSetting: {} });
    wx.saveImageToPhotosAlbum = (o) => o.success && o.success();
    wx.reportAnalytics = (n, d) => { (window.__track = window.__track || []).push([n, d]); };
    wx.openCustomerServiceConversation = (o) => { (window.__cs = window.__cs || []).push(o); };
    // 图片：把相对路径改写到项目根，并在加载失败时记录，便于定位贴图缺失
    wx.createImage = () => {
      const img = new Image();
      window.__imgLog = window.__imgLog || [];
      const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
      Object.defineProperty(img, "src", {
        get() { return desc.get.call(this); },
        set(v) {
          const abs = /^data:|^https?:|^file:/.test(v) ? v : ROOT + String(v).replace(/^\\.\\//, "");
          window.__imgLog.push({ src: v, abs });
          img.addEventListener("error", () => { window.__imgErr = window.__imgErr || []; window.__imgErr.push(v); });
          desc.set.call(this, abs);
        }
      });
      return img;
    };
    HTMLCanvasElement.prototype.toTempFilePathSync = function () { return this.toDataURL("image/jpeg", 0.92); };
  })();
`;

async function boot(page, vp) {
  if (vp) await page.setViewportSize(vp);
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(WX_MOCK);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(300);
}

function mkPage(browser, errs, tag, vp) {
  return browser.newPage({ viewport: vp || { width: 844, height: 390 } }).then(async page => {
    page.on("pageerror", e => errs.push(tag + " | pageerror: " + e.message));
    page.on("console", m => {
      const t = m.text();
      if (m.type() === "error" && t.indexOf("ERR_FILE_NOT_FOUND") < 0) errs.push(tag + " | console: " + t);
    });
    await boot(page, vp);
    return page;
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];
  const R = {};

  /* ---------- 1. 冷启动：关键 API 是否都挂上了 ---------- */
  {
    const page = await mkPage(browser, errs, "boot");
    R.api = await page.evaluate(() => {
      const G = window.G || {};
      const need = ["platform", "config", "session", "ui", "preys", "Prey", "buildPreys", "draw",
        "drawScene", "startGame", "endGame", "shareResult", "saveCard", "buildShareCard",
        "saveShareCard", "drawShareCard", "track", "hitButton", "clamp", "rr", "COLORS",
        "FISH_SPECIES", "stageNow", "stageName", "GAME_NAME"];
      const missing = need.filter(k => G[k] === undefined || G[k] === null);
      const uiNeed = ["drawHome", "drawSettings", "drawRecords", "drawLeaderboard", "drawSummon",
        "drawResult", "drawHud", "drawCountdown", "drawPause"];
      return {
        missing, missingUi: uiNeed.filter(k => typeof G.ui[k] !== "function"),
        drawFns: Object.keys(G.draw || {}),
        screen: G.screen, W: G.platform.W, H: G.platform.H, S: G.platform.S,
        menu: G.platform.menu
      };
    });
    R.imgLog = await page.evaluate(() => ({
      total: (window.__imgLog || []).length,
      err: window.__imgErr || []
    }));
    await page.close();
  }

  /* ---------- 2. 主循环连续运行 3 秒（首页） ---------- */
  {
    const page = await mkPage(browser, errs, "loop-home");
    const before = errs.length;
    await page.waitForTimeout(3000);
    R.loopHome = await page.evaluate(() => ({ screen: window.G.screen, frames: window.__frames || null }));
    R.loopHome.newErrors = errs.length - before;
    await page.screenshot({ path: path.join(OUT, "01-home.png") });
    await page.close();
  }

  /* ---------- 3. 逐界面绘制 ---------- */
  {
    const page = await mkPage(browser, errs, "screens");
    const screens = ["home", "settings", "records", "leaderboard", "summon", "counting", "playing", "paused"];
    R.screens = {};
    for (const s of screens) {
      const before = errs.length;
      const info = await page.evaluate(sc => {
        try {
          const G = window.G;
          if (sc === "counting" || sc === "playing" || sc === "paused") {
            if (G.screen === "home") { G.config.targetType = "fish"; G.config.duration = 180; G.startGame(); }
          }
          G.screen = sc;
          if (sc === "summon") G.summonOpen = true;
          return { ok: true };
        } catch (e) { return { ok: false, err: String(e && e.message || e) }; }
      }, s);
      await page.waitForTimeout(420);
      await page.screenshot({ path: path.join(OUT, "02-" + s + ".png") });
      R.screens[s] = { set: info.ok, err: info.err || null, newErrors: errs.length - before };
    }
    await page.close();
  }

  /* ---------- 4. 四种玩法完整一局：阶段推进 + 暂停恢复 + 结算 ---------- */
  {
    R.playthrough = {};
    for (const mode of ["fish", "butterfly", "mouse", "laser"]) {
      const page = await mkPage(browser, errs, "play-" + mode);
      const before = errs.length;
      const stages = [];
      await page.evaluate(m => {
        const G = window.G;
        G.config.targetType = m; G.config.duration = 180;
        G.config.stageMode = G.config.stageMode || "auto";
        G.startGame();
        G.screen = "playing";
        G.session.counting = false; G.session.running = true;
      }, mode);
      for (const [label, remain] of [["阶段1", 175], ["阶段2", 120], ["阶段3", 30]]) {
        await page.evaluate(r => { window.G.session.remaining = r; }, remain);
        await page.waitForTimeout(700);
        stages.push({ label, stage: await page.evaluate(() => window.G.stageNow ? window.G.stageNow() : null) });
      }
      // 暂停 → 恢复
      await page.evaluate(() => { const G = window.G; G.screen = "paused"; G.session.paused = true; });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, "03-" + mode + "-paused.png") });
      await page.evaluate(() => { const G = window.G; G.screen = "playing"; G.session.paused = false; });
      await page.waitForTimeout(300);
      // 结算
      const res = await page.evaluate(() => {
        const G = window.G;
        G.session.touches = 40; G.session.hits = 31; G.session.bonusHits = 2; G.session.maxCombo = 11;
        G.endGame();
        return { screen: G.screen, title: G.result && G.result.title, hits: G.result && G.result.hits };
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, "04-" + mode + "-result.png") });
      R.playthrough[mode] = { stages, res, newErrors: errs.length - before };
      await page.close();
    }
  }

  /* ---------- 5. 触摸路由：真实 DOM 事件走 wx.onTouchStart 通路 ---------- */
  {
    const page = await mkPage(browser, errs, "touch");
    const before = errs.length;
    R.touch = await page.evaluate(() => {
      const G = window.G;
      const tap = (x, y) => {
        const t = [{ clientX: x, clientY: y, identifier: 0 }];
        if (G.platform.onTouchStart) G.platform.onTouchStart({ touches: t, changedTouches: t });
        if (G.platform.onTouchEnd) G.platform.onTouchEnd({ touches: [], changedTouches: t });
      };
      // 用 hitButton 的返回值判断命中（按钮数组长度不会变，之前用长度判断是错的）
      const hits = [];
      const seen = new Set();
      for (let y = 10; y < G.platform.H; y += 18) {
        for (let x = 10; x < G.platform.W; x += 20) {
          if (seen.size > 40) break;
          // 每轮先回首页并等一帧，保证按钮坐标是该界面的最新几何
          G.screen = "home";
          G.ui.buttons.length = 0;
          try { G.ui.drawHome(); } catch (e) {}
          const b = G.ui.buttons.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
          if (b) {
            const key = [Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)].join(",");
            if (!seen.has(key)) { seen.add(key); hits.push(key); tap(x, y); }
          }
        }
      }
      return { distinctButtons: hits.length, hits, finalScreen: G.screen };
    });
    R.touch.newErrors = errs.length - before;
    await page.close();
  }

  /* ---------- 5b. 按钮几何：越界 / 重叠 / 被右上角胶囊遮挡 ---------- */
  {
    R.geometry = {};
    // 每个界面要检查的状态
    const CASES = [
      ["home", () => { const G = window.G; G.screen = "home"; }],
      ["settings", () => { const G = window.G; G.screen = "settings"; }],
      ["records", () => { const G = window.G; G.screen = "records"; }],
      ["leaderboard", () => { const G = window.G; G.screen = "leaderboard"; }],
      ["playing", () => { const G = window.G; G.config.targetType = "fish"; G.startGame(); G.screen = "playing"; }],
      ["paused", () => { const G = window.G; G.screen = "paused"; }],
      ["result", () => {
        const G = window.G;
        G.session.hits = 12; G.endGame();
      }]
    ];
    for (const [name, setup] of CASES) {
      const page = await mkPage(browser, errs, "geo-" + name);
      R.geometry[name] = await page.evaluate(({ name, fnStr }) => {
        const G = window.G;
        // eslint-disable-next-line no-new-func
        new Function("return (" + fnStr + ")()")();
        G.ui.buttons.length = 0;
        const drawFn = {
          home: () => G.ui.drawHome(), settings: () => G.ui.drawSettings(),
          records: () => G.ui.drawRecords(), leaderboard: () => G.ui.drawLeaderboard(),
          playing: () => G.ui.drawHud(1000, 16), paused: () => G.ui.drawPause(),
          result: () => G.ui.drawResult()
        }[name];
        try { drawFn(); } catch (e) { return { drawErr: String(e.message || e) }; }
        const W = G.platform.W, H = G.platform.H, menu = G.platform.menu;
        const bs = G.ui.buttons.slice();
        const oob = [], overlap = [], underMenu = [];
        bs.forEach((b, i) => {
          if (b.x < -1 || b.y < -1 || b.x + b.w > W + 1 || b.y + b.h > H + 1) {
            oob.push({ i, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) });
          }
          for (let j = i + 1; j < bs.length; j++) {
            const c = bs[j];
            const ix = Math.max(0, Math.min(b.x + b.w, c.x + c.w) - Math.max(b.x, c.x));
            const iy = Math.max(0, Math.min(b.y + b.h, c.y + c.h) - Math.max(b.y, c.y));
            const inter = ix * iy;
            if (inter > 0) {
              const ratio = inter / Math.min(b.w * b.h, c.w * c.h);
              if (ratio > 0.3) overlap.push({ i, j, ratio: +ratio.toFixed(2) });
            }
          }
          if (menu && menu.width > 0) {
            const ix = Math.max(0, Math.min(b.x + b.w, menu.right) - Math.max(b.x, menu.left));
            const iy = Math.max(0, Math.min(b.y + b.h, menu.bottom) - Math.max(b.y, menu.top));
            if (ix > 0 && iy > 0) underMenu.push({ i, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), cover: Math.round(ix * iy) });
          }
        });
        return { count: bs.length, oob, overlap, underMenu, W, H };
      }, { name, fnStr: setup.toString() });
      await page.close();
    }
  }

  /* ---------- 6. 多分辨率 ---------- */
  {
    R.viewports = {};
    for (const [name, vp] of [
      ["iPhoneSE横", { width: 667, height: 375 }],
      ["iPhone14横", { width: 844, height: 390 }],
      ["安卓大屏横", { width: 915, height: 412 }],
      ["iPad横", { width: 1024, height: 768 }],
      ["竖屏兜底", { width: 390, height: 844 }]
    ]) {
      const page = await mkPage(browser, errs, "vp-" + name, vp);
      const before = errs.length;
      const info = await page.evaluate(() => {
        const G = window.G;
        G.startGame(); G.screen = "playing";
        G.session.remaining = 100; G.session.running = true;
        return { S: G.platform.S, W: G.platform.W, H: G.platform.H };
      });
      await page.waitForTimeout(500);
      await page.evaluate(() => { const G = window.G; G.screen = "home"; });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, "05-vp-" + name + ".png") });
      R.viewports[name] = Object.assign(info, { newErrors: errs.length - before });
      await page.close();
    }
  }

  /* ---------- 7. 分享 / 存图链路 ---------- */
  {
    const page = await mkPage(browser, errs, "share");
    const before = errs.length;
    R.share = await page.evaluate(() => {
      const G = window.G;
      G.config.targetType = "fish"; G.startGame(); G.screen = "playing";
      G.session.touches = 20; G.session.hits = 15; G.endGame();
      const out = {};
      try { out.cardImg = !!G.buildShareCard(); } catch (e) { out.cardErr = String(e.message || e); }
      try { G.shareResult(); out.shareOk = (window.__shares || []).length > 0; } catch (e) { out.shareErr = String(e.message || e); }
      try { G.saveCard(); out.saveOk = true; } catch (e) { out.saveErr = String(e.message || e); }
      out.menu = window.__shareFactory ? window.__shareFactory() : null;
      out.track = (window.__track || []).map(t => t[0]);
      return out;
    });
    R.share.newErrors = errs.length - before;
    await page.close();
  }

  /* ---------- 8. 开放数据域独立加载 ---------- */
  {
    const odcSrc = fs.readFileSync(path.join(ROOT, "openDataContext/index.js"), "utf8");
    const page = await browser.newPage({ viewport: { width: 400, height: 600 } });
    const odcErr = [];
    page.on("pageerror", e => odcErr.push(String(e.message || e)));
    page.on("console", m => { if (m.type() === "error") odcErr.push(m.text()); });
    await page.goto("file://" + path.join(ROOT, "test/harness.html"));
    R.odc = await page.evaluate(src => {
      const shared = document.createElement("canvas");
      shared.width = 400; shared.height = 600;
      const wx = window.wx;
      let handler = null;
      const calls = [];
      wx.getSharedCanvas = () => shared;
      wx.onMessage = (fn) => { handler = fn; };
      wx.getFriendCloudStorage = (o) => { calls.push("friend"); o.success && o.success({ data: [] }); };
      wx.getUserCloudStorage = (o) => { calls.push("self"); o.success && o.success({ KVDataList: [] }); };
      window.wx = wx;
      try {
        new Function("wx", "GameGlobal", src)(wx, {});
      } catch (e) { return { loadErr: String(e && e.message || e), calls }; }
      const results = [];
      for (const msg of [{ type: "show", x: 0, y: 0, w: 400, h: 600 }, { type: "refresh" }, { type: "hide" }]) {
        if (!handler) { results.push("no-handler"); break; }
        try { handler(msg); results.push("ok"); } catch (e) { results.push(String(e && e.message || e)); }
      }
      return { loadErr: null, results, calls };
    }, odcSrc);
    R.odc.pageErrors = odcErr;
    await page.close();
  }

  /* ---------- 汇总 ---------- */
  console.log(JSON.stringify(R, null, 2));
  console.log("\n================ 错误清单 ================");
  console.log(errs.length ? errs.join("\n") : "无运行时错误");
  console.log("out:", OUT);
  await browser.close();
})();
