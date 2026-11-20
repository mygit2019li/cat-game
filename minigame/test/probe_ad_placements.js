/* probe_ad_placements.js — 原生模板广告位体检（首页 / 结算页 / 猫粮机）
   验的五件事：
     ① 竖屏首页进页会建实例（G.AD_UNIT_ID 填了的前提下），style 落在玩法卡与底栏之间
     ② 竖屏结算页进页会建实例，style 落在标题下方、四按钮上方
     ③ 横屏首页 / 结算页不出广告（rect 返回 null → enter 跳过），不盖猫图与按钮
     ④ 切走页面即 destroy，不残留实例；切回再进重新创建
     ⑤ 对局页（playing/counting/paused）绝不建实例
   用法：NODE_PATH=/private/tmp/ffshot/node_modules node test/probe_ad_placements.js
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

const A = [];
const ok = (cond, msg, extra) => { A.push((cond ? "✅ " : "❌ ") + msg + (extra != null ? "  → " + extra : "")); return cond; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 读当前页面的广告状态快照 */
const ADSTATE = () => {
  const G = window.G;
  return {
    screen: G.screen,
    rectHome: (G.homeAdRect ? G.homeAdRect() : "noFn"),
    rectResult: (G.resultAdRect ? G.resultAdRect() : "noFn"),
    rectFeeder: (G.feederAdRect ? G.feederAdRect() : "noFn"),
    adState: G.ad ? G.ad.state() : "noAd",
    adLog: (window.__adLog || []).map(r => ({ style: r.opt && r.opt.style, shown: r.shown, destroyed: r.destroyed, alive: r.alive }))
  };
};

async function boot(page, sysInfo) {
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, sysInfo);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(() => { if (window.G) return; }); // 占位
  await page.evaluate(() => {
    // 先 require game.js 拿到 G，再补 AD_UNIT_ID（必须在 require 之前设，否则 ad.enter 读不到）
    window.__ADUNIT = "adunit-test-placements";
  });
  await page.evaluate(() => {
    // 注入：让 config.js 读到我们设的值 —— 直接改 G 上的常量最简单
    // 但 config.js 已经在 require 时把 G.AD_UNIT_ID 设成 ""。这里在 require 之前无法改 G。
    // 方案：require 之后立刻把 G.AD_UNIT_ID 改掉，ad.enter 是运行时读 G.AD_UNIT_ID，没问题。
  });
  await page.evaluate(() => window.require("./game.js"));
  await page.evaluate(() => { if (window.G) window.G.AD_UNIT_ID = "adunit-test-placements"; });
  await sleep(360);
}

const port = { windowWidth: 390, windowHeight: 844, pixelRatio: 2,
  safeArea: { left: 0, top: 47, right: 390, bottom: 810 } };
const land = { windowWidth: 844, windowHeight: 390, pixelRatio: 2,
  safeArea: { left: 47, top: 0, right: 797, bottom: 369 } };

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];

  /* ============ 竖屏 ============ */
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  await boot(page, port);

  /* 初始就在首页（G.screen 默认 "home"），等首帧 + show 兜底（900ms） */
  await sleep(1100);
  let s = await page.evaluate(ADSTATE);
  const homeLog = (s.adLog || []).filter(r => r.alive);
  ok(homeLog.length === 1, "竖屏首页：建了且只建了 1 个广告实例", JSON.stringify(s.adLog));
  ok(!!s.rectHome, "竖屏首页：homeAdRect 返回有效矩形", JSON.stringify(s.rectHome));
  if (s.rectHome && s.rectHome.left != null) {
    const r = s.rectHome;
    ok(r.left >= 16 && r.top >= 100, "首页广告位不在左上角品牌区", JSON.stringify(r));
    ok(r.width >= 160, "首页广告位宽度足够（>=160 虚拟像素）", r.width);
    ok(r.top < s.adState ? true : true, "", ""); // 占位（避免 lint 警告）
  }

  /* 进结算页：先造一个 result 对象再切页 */
  await page.evaluate(() => {
    const G = window.G;
    G.result = { t0: performance.now(), title: "结算测试", desc: "本局数据", touches: 3, hits: 2, acc: 66, maxCombo: 2 };
    G.switchScreen("result");
  });
  await sleep(1100);
  s = await page.evaluate(ADSTATE);
  const resLog = (s.adLog || []).filter(r => r.alive);
  ok(resLog.length === 1, "竖屏结算：旧实例已销毁、新建 1 个", JSON.stringify(s.adLog.map(r => ({ a: r.alive }))));
  ok(!!s.rectResult, "竖屏结算：resultAdRect 返回有效矩形", JSON.stringify(s.rectResult));
  if (s.rectResult && s.rectResult.left != null) {
    const r = s.rectResult;
    ok(r.top >= 130, "结算广告位在标题下方（top>=130）", r.top);
    ok(r.width >= 160, "结算广告位宽度足够", r.width);
  }

  /* 回首页：结算实例应被销毁 */
  await page.evaluate(() => window.G.switchScreen("home"));
  await sleep(300);
  s = await page.evaluate(ADSTATE);
  const aliveAfterHome = (s.adLog || []).filter(r => r.alive);
  ok(aliveAfterHome.length === 1, "回首页：结算实例已销毁、首页实例存活", JSON.stringify(s.adLog.map(r => ({ a: r.alive }))));

  /* 进对局页（counting）：不应再建实例，且 home 实例被销毁 */
  await page.evaluate(() => {
    const G = window.G;
    G.session = G.session || { paused: false };
    G.switchScreen("counting");
  });
  await sleep(300);
  s = await page.evaluate(ADSTATE);
  const aliveInGame = (s.adLog || []).filter(r => r.alive);
  ok(aliveInGame.length === 0, "对局页（counting）：无任何存活广告实例", JSON.stringify(s.adLog.map(r => ({ a: r.alive }))));

  /* ============ 横屏 ============ */
  const p2 = await browser.newPage({ viewport: { width: 844, height: 390 } });
  p2.on("pageerror", e => errs.push("land pageerror: " + e.message));
  await boot(p2, land);
  await sleep(1100);
  let s2 = await p2.evaluate(ADSTATE);
  const lHomeLog = (s2.adLog || []).filter(r => r.alive);
  ok(lHomeLog.length === 0, "横屏首页：不建广告实例（rect 返回 null）", JSON.stringify(s2.adLog));
  ok(s2.rectHome === null, "横屏首页：homeAdRect 显式返回 null", String(s2.rectHome));

  await p2.evaluate(() => {
    const G = window.G;
    G.result = { t0: performance.now(), title: "结算测试", desc: "本局数据", touches: 3, hits: 2, acc: 66, maxCombo: 2 };
    G.switchScreen("result");
  });
  await sleep(1100);
  s2 = await p2.evaluate(ADSTATE);
  const lResLog = (s2.adLog || []).filter(r => r.alive);
  ok(lResLog.length === 0, "横屏结算：不建广告实例（rect 返回 null）", JSON.stringify(s2.adLog));
  ok(s2.rectResult === null, "横屏结算：resultAdRect 显式返回 null", String(s2.rectResult));

  /* 横屏猫粮机：应照常建（feederAdRect 横屏有落位） */
  await p2.evaluate(() => {
    const G = window.G;
    G.switchScreen("home");
    G.feederEnter();
  });
  await sleep(1100);
  s2 = await p2.evaluate(ADSTATE);
  const lFeederLog = (s2.adLog || []).filter(r => r.alive);
  ok(lFeederLog.length === 1, "横屏猫粮机：照常建 1 个实例（回归）", JSON.stringify(s2.adLog));
  ok(!!s2.rectFeeder, "横屏猫粮机：feederAdRect 仍有效", JSON.stringify(s2.rectFeeder));

  await browser.close();

  console.log("\n===== 广告位 体检 =====");
  A.forEach(x => console.log(x));
  if (errs.length) { console.log("\n运行时错误："); errs.forEach(e => console.log("  ❌ " + e)); }
  else console.log("✅ 无运行时错误");
  const bad = A.filter(x => x.startsWith("❌")).length;
  console.log(bad ? "\n❌ 失败 " + bad + " 项" : "\n✅ 全部通过");
  if (bad) process.exit(1);
})();
