/* preview_sharecard.js — 分享卡片与结算页预览（playwright + harness 垫片）
   产出：sharecard-<模式>.png（750×600 卡片）、result-land.png / result-port.png（结算页布局）
   输出目录在项目外（_排查截图存档），避免再被小游戏打包带走。 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/sharecard";
fs.mkdirSync(OUT, { recursive: true });

function findChrome() {
  const c = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    process.env.CHROME_PATH || ""
  ].filter(Boolean);
  for (const p of c) if (fs.existsSync(p)) return p;
  throw new Error("no chrome found");
}

const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./js/feeder.js", "./game.js"];

const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

/* 补齐 harness 未提供的分享类 API（必须在 require 之前挂上，initShare 在模块加载时执行） */
const WX_MOCK = `
  const wx = window.wx;
  wx.shareAppMessage = (o) => { (window.__shares = window.__shares || []).push(o); };
  wx.onShareAppMessage = (fn) => { window.__shareFactory = fn; };
  wx.showShareMenu = () => {};
  wx.showToast = (o) => { (window.__toasts = window.__toasts || []).push(o); };
  wx.showModal = (o) => { (window.__modals = window.__modals || []).push(o); };
  wx.getSetting = (o) => o.success && o.success({ authSetting: {} });
  wx.authorize = (o) => o.success && o.success();
  wx.saveImageToPhotosAlbum = (o) => o.success && o.success();
  wx.reportAnalytics = (n, d) => { (window.__track = window.__track || []).push([n, d]); };
  // 浏览器没有小游戏的 toTempFilePathSync，用 toDataURL 模拟，验证 buildShareCard 的导出链路
  HTMLCanvasElement.prototype.toTempFilePathSync = function () {
    return this.toDataURL("image/jpeg", 0.92);
  };
`;

async function boot(page) {
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(WX_MOCK);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(500);
}

async function playAndEnd(page, mode, duration) {
  return page.evaluate(({ mode, duration }) => {
    const G = window.G;
    G.config.targetType = mode;
    G.config.duration = duration;
    G.startGame();
    G.session.touches = 33;
    G.session.hits = 27;
    G.session.bonusHits = 2;
    G.session.maxCombo = 9;
    G.screen = "playing";
    // 塞 6 条历史，验证 rankText 用真实记录算
    const logs = [18, 25, 31, 22, 12, 29].map(h => ({
      date: "10/1", type: mode, dur: duration, hits: h, touches: 40,
      accuracy: 70, combo: 5, dart: 0, bonus: 0
    }));
    G.platform.storage.set("catToyLogs", JSON.stringify(logs));
    G.endGame();
    return { title: G.result.title, hits: G.result.hits, acc: G.result.acc, screen: G.screen };
  }, { mode, duration });
}

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errors = [];
  const report = {};

  /* ---------- 1. 结算页布局：四种玩法的背景各截一张 + 竖屏 ---------- */
  const SHOTS = [
    ["result-land", 844, 390, "fish"],
    ["result-land-butterfly", 844, 390, "butterfly"],
    ["result-land-mouse", 844, 390, "mouse"],
    ["result-land-laser", 844, 390, "laser"],
    ["result-port", 390, 844, "fish"]
  ];
  for (const [name, vw, vh, mode] of SHOTS) {
    const page = await browser.newPage({ viewport: { width: vw, height: vh } });
    page.on("pageerror", e => errors.push(name + ": " + e.message));
    page.on("console", m => { if (m.type() === "error" && m.text().indexOf("ERR_FILE_NOT_FOUND") < 0) errors.push(name + ": " + m.text()); });
    await boot(page);
    report[name] = await playAndEnd(page, mode, 180);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, name + ".png") });
    await page.close();
  }

  /* ---------- 2. 分享卡片：四种玩法各一张 ---------- */
  for (const mode of ["fish", "butterfly", "mouse", "laser"]) {
    const page = await browser.newPage({ viewport: { width: 750, height: 600 } });
    page.on("pageerror", e => errors.push(mode + ": " + e.message));
    await boot(page);
    const r = await playAndEnd(page, mode, 180);
    const info = await page.evaluate(() => {
      const cv = document.createElement("canvas");
      cv.width = 750; cv.height = 600; cv.id = "card";
      cv.style.cssText = "position:fixed;left:0;top:0;z-index:99;background:#000";
      document.body.appendChild(cv);
      window.G.drawShareCard(cv.getContext("2d"), 750, 600);
      // 同时验证分享文案 + 菜单默认分享
      const fn = window.__shareFactory ? window.__shareFactory() : null;
      window.G.shareResult();
      return {
        menuTitle: fn && fn.title,
        shareTitle: (window.__shares || [])[0] && (window.__shares || [])[0].title,
        track: window.__track || []
      };
    });
    report[mode] = Object.assign({}, r, info);
    const el = await page.$("#card");
    await el.screenshot({ path: path.join(OUT, "sharecard-" + mode + ".png") });
    await page.close();
  }

  /* ---------- 3. 无历史记录（第一局）文案 ---------- */
  {
    const page = await browser.newPage({ viewport: { width: 750, height: 600 } });
    await boot(page);
    const r = await page.evaluate(() => {
      const G = window.G;
      G.config.targetType = "fish"; G.config.duration = 180;
      G.startGame();
      G.session.touches = 6; G.session.hits = 3; G.session.bonusHits = 0; G.session.maxCombo = 2;
      G.platform.storage.set("catToyLogs", "[]");
      G.platform.storage.remove && G.platform.storage.remove("catToyArchive");
      G.platform.storage.set("catToyArchive", "");
      G.endGame();
      const cv = document.createElement("canvas");
      cv.width = 750; cv.height = 600; cv.id = "card";
      cv.style.cssText = "position:fixed;left:0;top:0;z-index:99";
      document.body.appendChild(cv);
      G.drawShareCard(cv.getContext("2d"), 750, 600);
      return { title: G.result.title, hits: G.result.hits, arch: G.archiveSummary() };
    });
    report.firstRun = r;
    const el = await page.$("#card");
    await el.screenshot({ path: path.join(OUT, "sharecard-first-run.png") });
    await page.close();
  }

  /* ---------- 4. 猫档案卡（模拟"已经玩了 9 局 / 5 天"的累计数据） ---------- */
  {
    const page = await browser.newPage({ viewport: { width: 750, height: 600 } });
    page.on("pageerror", e => errors.push("archive: " + e.message));
    await boot(page);
    const r = await page.evaluate(() => {
      const G = window.G;
      // 直接写聚合数据：真实场景由 endGame 里的 recordArchive 累加
      G.platform.storage.set("catToyArchive", JSON.stringify({
        games: 9, hits: 214, touches: 402,
        days: ["2026-10-12", "2026-10-13", "2026-10-15", "2026-10-18", "2026-10-20"],
        modes: { fish: { g: 4, h: 96 }, butterfly: { g: 3, h: 72 }, mouse: { g: 1, h: 30 }, laser: { g: 1, h: 16 } },
        baseSum: 26.4, baseN: 3,
        recent: [16.4, 18.0, 19.2, 17.6, 20.1],
        firstTs: Date.now() - 8 * 86400000, lastTs: Date.now()
      }));
      const cv = document.createElement("canvas");
      cv.width = 750; cv.height = 600; cv.id = "card";
      cv.style.cssText = "position:fixed;left:0;top:0;z-index:99";
      document.body.appendChild(cv);
      G.drawArchiveCard(cv.getContext("2d"), 750, 600);
      // 邀好友文案 + 导出链路（此时没有本局结果，应自动回落档案卡）
      G.result = null;
      G.shareInvite("lb");
      const sh = (window.__shares || [])[(window.__shares || []).length - 1] || {};
      return {
        arch: G.archiveSummary(),
        inviteTitle: sh.title,
        inviteHasImg: !!sh.imageUrl,
        inviteQuery: sh.query,
        track: (window.__track || []).slice(-3)
      };
    });
    report.archive = r;
    const el = await page.$("#card");
    await el.screenshot({ path: path.join(OUT, "sharecard-archive.png") });
    await page.close();
  }

  /* ---------- 5. 排行榜页：空榜引导按钮布局 ---------- */
  {
    for (const [name, vw, vh] of [["leaderboard-land", 844, 390], ["leaderboard-port", 390, 844]]) {
      const page = await browser.newPage({ viewport: { width: vw, height: vh } });
      page.on("pageerror", e => errors.push(name + ": " + e.message));
      await boot(page);
      report[name] = await page.evaluate(() => {
        const G = window.G;
        G.screen = "leaderboard";
        G.ui.buttons.length = 0;
        G.ui.drawLeaderboard();
        const S = G.platform.S || 1;
        return {
          buttons: G.ui.buttons.map(b => ({
            label: Math.round(b.x * S) + "," + Math.round(b.y * S),
            w: Math.round(b.w * S), h: Math.round(b.h * S)
          })),
          W: G.platform.W, H: G.platform.H
        };
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, name + ".png") });
      await page.close();
    }
  }

  console.log(JSON.stringify(report, null, 2));
  console.log("pageerrors:", errors.length ? errors : "none");
  console.log("out:", OUT);
  await browser.close();
})();
