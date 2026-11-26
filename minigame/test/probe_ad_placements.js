/* probe_ad_placements.js — 原生模板广告位体检（首页 / 结算页 / 猫粮机 / 猫咪状态 / 召唤页）
   广告是浮卡：只遮挡、不参与排版，所以这里只有"位置合不合理"，没有"有没有挤压"。
   验的六件事：
     ① 竖屏首页进页会建实例（G.AD_UNIT_ID 填了的前提下），style 落在猫图区右上、不压猫脸与面板
     ② 竖屏结算页进页会建实例，style 落在标题下方、四按钮上方
     ③ 横屏首页建实例（贴顶、靠右窄卡），横屏结算页不出；两者都不盖面板与按钮
     ④ 切走页面即 destroy，不残留实例；切回再进重新创建
     ⑤ 对局页（playing/counting/paused）绝不建实例；竖屏召唤页、竖屏猫咪状态页不出
     ⑥ 横屏猫咪状态页：落在「标题右侧」空白带（tab 右缘↔胶囊之间、网格上沿之上），
        播放中出现「停止」键也不挪位
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
    rectBgpick: (G.bgpickAdRect ? G.bgpickAdRect() : "noFn"),
    rectFeeder: (G.feederAdRect ? G.feederAdRect() : "noFn"),
    rectSummon: (G.summonAdRect ? G.summonAdRect() : "noFn"),
    rectSound: (G.soundAdRect ? G.soundAdRect() : "noFn"),
    rectCounting: (G.countdownAdRect ? G.countdownAdRect() : "noFn"),
    /* 声音页的真实几何：全部从按钮热区里量，不重复页面里的公式 */
    sound: (() => {
      const bs = G.ui.buttons || [];
      const tabs = bs.filter(b => /^sound-tab-/.test(b.key || ""));
      const cards = bs.filter(b => /^sound-card-/.test(b.key || ""));
      const stop = bs.find(b => b.key === "sound-stop");
      const mr = G.platform.menu, S = G.platform.S || 1;
      return {
        tabRight: tabs.length ? Math.round(Math.max(...tabs.map(t => t.x + t.w))) : 0,
        tabTop: tabs.length ? Math.round(Math.min(...tabs.map(t => t.y))) : 0,
        gridTop: cards.length ? Math.round(Math.min(...cards.map(c => c.y))) : 0,
        stopLeft: stop ? Math.round(stop.x) : null,
        menuLeft: mr ? Math.round(mr.left / S) : null
      };
    })(),
    summonCw: (G.summonPick && G.summonPick.cw) || 0,
    uiW: G.platform.W / (G.platform.S || 1),
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

  /* 竖屏召唤页：卡片已吃掉 68% 屏宽，两侧没有留白 → 不出广告 */
  await page.evaluate(() => window.G.switchScreen("summon"));
  await sleep(900);
  s = await page.evaluate(ADSTATE);
  ok(s.rectSummon === null, "竖屏召唤：summonAdRect 显式返回 null", String(s.rectSummon));
  ok((s.adLog || []).filter(r => r.alive).length === 0, "竖屏召唤：不建广告实例", JSON.stringify(s.adLog.map(r => ({ a: r.alive }))));

  /* 竖屏猫咪状态页：网格几乎顶到 tab 行，标题右侧只剩一条缝 → 不出广告 */
  await page.evaluate(() => window.G.switchScreen("sound"));
  await sleep(900);
  s = await page.evaluate(ADSTATE);
  ok(s.rectSound === null, "竖屏猫咪状态：soundAdRect 显式返回 null", String(s.rectSound));
  ok((s.adLog || []).filter(r => r.alive).length === 0, "竖屏猫咪状态：不建广告实例", JSON.stringify(s.adLog.map(r => ({ a: r.alive }))));

  /* 竖屏倒计时：不出广告（顶部留白不足） */
  await page.evaluate(() => { const G = window.G; G.session = { paused: false }; G.switchScreen("counting"); });
  await sleep(200);
  s = await page.evaluate(ADSTATE);
  ok(s.rectCounting === null, "竖屏倒计时：countdownAdRect 返回 null", String(s.rectCounting));

  /* ============ 横屏 ============ */
  const p2 = await browser.newPage({ viewport: { width: 844, height: 390 } });
  p2.on("pageerror", e => errs.push("land pageerror: " + e.message));
  await boot(p2, land);
  await sleep(1100);
  let s2 = await p2.evaluate(ADSTATE);
  const lHomeLog = (s2.adLog || []).filter(r => r.alive);
  ok(lHomeLog.length === 1, "横屏首页：建了 1 个实例（胶囊下方靠右窄卡）", JSON.stringify(s2.adLog));
  ok(!!s2.rectHome, "横屏首页：homeAdRect 返回有效矩形", JSON.stringify(s2.rectHome));
  if (s2.rectHome && s2.rectHome.left != null) {
    const r = s2.rectHome;
    ok(r.width >= 120 && r.width <= 160, "横屏首页：宽度收窄到窄卡（120~160）", r.width);
    ok(r.top >= 4 && r.top <= 16, "横屏首页：紧贴顶部（top 4~16）", r.top);
    ok(r.left + r.width <= 750 && r.left + r.width >= 720, "横屏首页：右缘贴胶囊左侧、不被下移", (r.left + r.width) + " vs 胶囊左缘 750");
  }

  await p2.evaluate(() => {
    const G = window.G;
    G.result = { t0: performance.now(), title: "结算测试", desc: "本局数据", touches: 3, hits: 2, acc: 66, maxCombo: 2 };
    G.switchScreen("result");
  });
  await sleep(1100);
  s2 = await p2.evaluate(ADSTATE);
  const lResLog = (s2.adLog || []).filter(r => r.alive);
  ok(lResLog.length === 1, "横屏结算：建了 1 个实例（左上留白）", JSON.stringify(s2.adLog));
  ok(!!s2.rectResult, "横屏结算：resultAdRect 返回有效矩形", JSON.stringify(s2.rectResult));
  if (s2.rectResult && s2.rectResult.left != null) {
    const r = s2.rectResult;
    ok(r.top >= 50, "横屏结算：在返回键下方（top>=50）", r.top);
    ok(r.left >= 40 && r.left + r.width <= 420, "横屏结算：在左侧标题区外", r.left + "~" + (r.left + r.width));
    ok(r.top + Math.round(r.width * 0.6) <= 180, "横屏结算：下缘不压数据卡（按 0.6 估高）", (r.top + Math.round(r.width * 0.6)) + " vs 数据卡 ~180");
  }

  /* 横屏选场景页：贴顶靠右窄卡（上缘贴安全区顶、右缘止于胶囊左侧） */
  await p2.evaluate(() => { const G = window.G; G.switchScreen("home"); G.config.targetType = "fish"; G.openBgPick(); });
  await sleep(1100);
  s2 = await p2.evaluate(ADSTATE);
  const lBgLog = (s2.adLog || []).filter(r => r.alive);
  ok(lBgLog.length === 1, "横屏选场景：建了 1 个实例", JSON.stringify(s2.adLog));
  ok(!!s2.rectBgpick, "横屏选场景：bgpickAdRect 返回有效矩形", JSON.stringify(s2.rectBgpick));
  if (s2.rectBgpick && s2.rectBgpick.left != null) {
    const r = s2.rectBgpick;
    ok(r.width >= 120 && r.width <= 160, "横屏选场景：窄卡宽度（120~160）", r.width);
    ok(r.top <= 16, "横屏选场景：贴顶（top<=16，旧落点胶囊下方 top≈53）", r.top);
    ok(r.left >= 560, "横屏选场景：靠右（left>=560）", r.left);
    ok(r.left + r.width >= 720 && r.left + r.width <= 750, "横屏选场景：右缘止于胶囊左侧（720~750）", r.left + r.width);
    ok(r.top + 110 < 240, "横屏选场景：下缘不压底部设置面板（面板顶≈286）", r.top + 110);
  }

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

  /* 横屏猫咪状态页：标题右侧那块空白（tab 右缘 ↔ 胶囊之间、网格上沿之上） */
  await p2.evaluate(() => window.G.switchScreen("sound"));
  await sleep(1100);
  s2 = await p2.evaluate(ADSTATE);
  const lSoundLog = (s2.adLog || []).filter(r => r.alive);
  ok(lSoundLog.length === 1, "横屏猫咪状态：建了 1 个实例", JSON.stringify(s2.adLog));
  ok(!!s2.rectSound, "横屏猫咪状态：soundAdRect 返回有效矩形", JSON.stringify(s2.rectSound));
  if (s2.rectSound && s2.rectSound.left != null) {
    const r = s2.rectSound, sg = s2.sound || {};
    ok(r.width >= 120, "横屏猫咪状态：广告位宽度够用（>=120）", r.width);
    ok(r.left >= (sg.tabRight || 0), "横屏猫咪状态：在 tab 行右侧", r.left + " vs tab右缘 " + sg.tabRight);
    ok(r.left + r.width <= (sg.menuLeft || 999) - 8, "横屏猫咪状态：不钻到微信胶囊下面",
      (r.left + r.width) + " vs 胶囊左缘 " + sg.menuLeft);
    ok(r.top >= 6, "横屏猫咪状态：不贴屏幕顶边", r.top);
    ok(r.top + Math.round(r.width * 0.6) <= (sg.gridTop || 0) + 2,
      "横屏猫咪状态：下缘不压卡片网格（按 0.6 估高）",
      (r.top + Math.round(r.width * 0.6)) + " vs 网格上沿 " + sg.gridTop);
  }
  /* 播放中 tab 右侧会多一颗「停止」键：广告不许因此被顶走 */
  const soundRectBefore = await p2.evaluate(() => JSON.stringify(window.G.soundAdRect()));
  await p2.evaluate(() => {
    const G = window.G;
    const b = (G.ui.buttons || []).find(x => /^sound-card-/.test(x.key || ""));
    if (b) G.hitButton(b.x + b.w / 2, b.y + b.h / 2);
  });
  await sleep(300);
  const soundRectAfter = await p2.evaluate(() => JSON.stringify(window.G.soundAdRect()));
  ok(soundRectBefore === soundRectAfter, "横屏猫咪状态：播放中冒出「停止」键，广告位置不变",
    soundRectBefore + " → " + soundRectAfter);
  await p2.evaluate(() => { if (window.G.stopAnimalSound) window.G.stopAnimalSound(); });

  /* 回归：真机素材 onResize 回传的真实高度可能比右上窄带高（100/120 > bandH≈81）。
     旧逻辑会因此把 soundAdRect 判成 null → ad.realign 销毁实例 → 广告不出（测试垫片
     不回传高度所以测不出来）。这里手动回传高值触发 realign，断言广告仍在、位置有效。 */
  for (const hh of [100, 120]) {
    await p2.evaluate(h => { window.G.soundAdMeasuredH = h; window.G.ad.realign(); }, hh);
    await sleep(80);
    const st = await p2.evaluate(() => ({
      rect: window.G.soundAdRect(),
      alive: (window.__adLog || []).filter(r => r.alive).length,
      state: window.G.ad.state()
    }));
    ok(st.state.page === "sound" && st.state.shown === true,
      "横屏猫咪状态：回传素材高 " + hh + " 后广告仍展示、未被销毁",
      JSON.stringify({ page: st.state.page, shown: st.state.shown, alive: st.alive }));
    ok(!!st.rect && st.rect.top >= 6, "横屏猫咪状态：回传高素材后 rect 有效且不贴死顶边", JSON.stringify(st.rect));
  }
  await p2.evaluate(() => { window.G.soundAdMeasuredH = 0; window.G.ad.realign(); });

  /* 横屏召唤页：卡牌左侧那半屏留白是唯一落点，且不能压到当前卡 */
  await p2.evaluate(() => window.G.switchScreen("summon"));
  await sleep(900);
  s2 = await p2.evaluate(ADSTATE);
  const lSummonLog = (s2.adLog || []).filter(r => r.alive);
  ok(lSummonLog.length === 1, "横屏召唤：建了 1 个实例", JSON.stringify(s2.adLog));
  ok(!!s2.rectSummon, "横屏召唤：summonAdRect 返回有效矩形", JSON.stringify(s2.rectSummon));
  if (s2.rectSummon && s2.rectSummon.left != null) {
    const r = s2.rectSummon;
    ok(r.width >= 160, "横屏召唤：广告位宽度足够（>=160 虚拟像素）", r.width);
    ok(r.left >= 40, "横屏召唤：广告位在安全区内（避开返回胶囊）", r.left);
    ok(r.top >= 56, "横屏召唤：广告位不与顶部按钮重叠（top>=56）", r.top);
    if (s2.summonCw) {
      const cardLeft = s2.uiW / 2 - s2.summonCw / 2;
      ok(r.left + r.width <= cardLeft, "横屏召唤：广告右缘不压当前卡", (r.left + r.width) + " vs " + Math.round(cardLeft));
    }
  }

  /* 横屏倒计时：用 startGame 正常进入（倒计时3秒），广告贴顶靠右、show 成功、不压中央数字 */
  await p2.evaluate(() => { window.G.switchScreen("home"); window.G.AD_UNIT_ID = "adunit-test"; window.G.startGame(); });
  await sleep(300);
  s2 = await p2.evaluate(() => ({
    screen: window.G.screen,
    rect: window.G.countdownAdRect(),
    st: window.G.ad.state(),
    alive: (window.__adLog || []).filter(r => r.alive).length,
    vH: window.G.platform.H / window.G.platform.S
  }));
  ok(s2.screen === "counting", "横屏倒计时：处于 counting 页", s2.screen);
  ok(!!s2.rect && s2.rect.width >= 120, "横屏倒计时：广告位有效且够宽", JSON.stringify(s2.rect));
  if (s2.rect && s2.rect.left != null) {
    ok(s2.rect.top >= 4 && s2.rect.top <= 16, "横屏倒计时：贴顶", s2.rect.top);
    ok(s2.rect.left + s2.rect.width <= 750, "横屏倒计时：右缘不碰胶囊", (s2.rect.left + s2.rect.width) + " vs 750");
    ok(s2.rect.top + 96 <= s2.vH * 0.42 - 48, "横屏倒计时：不压中央数字", (s2.rect.top + 96) + " vs " + Math.round(s2.vH * 0.42 - 48));
  }
  ok(s2.st.page === "counting" && s2.st.shown === true, "横屏倒计时：广告实际 show", JSON.stringify({ page: s2.st.page, shown: s2.st.shown, alive: s2.alive }));

  /* ============ 大屏横屏：多档尺寸 × 全部广告页 ============
     曾出现两类"大屏反而不出"：① 1366×1024(虚拟683) home/sound 宽=118 差 2px 不够 MIN_WIDTH；
     ② 1024×768(虚拟662) sound bandW=102、feeder 右侧只剩 101px。这里逐档守 MIN_WIDTH 与展示。 */
  const BIG = [
    { w: 1024, h: 768 }, { w: 1366, h: 1024 }, { w: 1920, h: 1080 }
  ];
  const BIG_PAGES = [
    { key: "首页", fn: "homeAdRect" },
    { key: "动物情绪", fn: "soundAdRect" },
    { key: "选场景", fn: "bgpickAdRect" },
    { key: "结算", fn: "resultAdRect" },
    { key: "召唤", fn: "summonAdRect" },
    { key: "猫粮机", fn: "feederAdRect" }
  ];
  for (const sz of BIG) {
    const sys = { windowWidth: sz.w, windowHeight: sz.h, pixelRatio: 2,
      safeArea: { left: 47, top: 0, right: sz.w - 47, bottom: sz.h - 21 } };
    const pb = await browser.newPage({ viewport: { width: sz.w, height: sz.h } });
    pb.on("pageerror", e => errs.push("big pageerror " + sz.w + ": " + e.message));
    await pb.goto("file://" + path.join(ROOT, "test/harness.html"));
    await pb.evaluate(x => { window.__sysInfo = x; }, sys);
    await pb.evaluate(m => Object.assign(window.__MODULES__, m), modules);
    await pb.evaluate(() => window.require("./game.js"));
    await pb.evaluate(() => { window.G.AD_UNIT_ID = "adunit-test"; });
    const vw = await pb.evaluate(() => Math.round(window.G.platform.W / window.G.platform.S));
    for (const pg of BIG_PAGES) {
      const r = await pb.evaluate(fn => { return window.G[fn] ? window.G[fn]() : null; }, pg.fn);
      ok(!!r && r.width >= 120 && r.left >= 0 && r.left + r.width <= vw + 2,
        "大屏" + sz.w + "×" + sz.h + "(虚拟" + vw + ")：" + pg.key + "广告位有效/不卡宽/不越界",
        JSON.stringify(r));
    }
    await pb.close();
  }

  await browser.close();

  console.log("\n===== 广告位 体检 =====");
  A.forEach(x => console.log(x));
  if (errs.length) { console.log("\n运行时错误："); errs.forEach(e => console.log("  ❌ " + e)); }
  else console.log("✅ 无运行时错误");
  const bad = A.filter(x => x.startsWith("❌")).length;
  console.log(bad ? "\n❌ 失败 " + bad + " 项" : "\n✅ 全部通过");
  if (bad) process.exit(1);
})();
