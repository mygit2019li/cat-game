/* probe_ad_close.js — 用户点「关闭」后，浮卡必须立刻消失且不许自己弹回来
   背景：广告是浮卡，页面每帧都会调 ad.pageFrame()。如果 onClose 只是把 shown 置 false，
   下一帧 pageFrame 就会把这条广告重新 show 出来（900ms 兜底 timer 也会补一刀）。
   所以 onClose 必须 closed 标记 + 立即 hide/destroy。这里验四件事：
     ① 关闭后实例立刻销毁，ad.state() 归零（page=null / shown=false / frames=0）
     ② 再等 1.6s（跨过 900ms 兜底窗口 + 若干帧）不会被 pageFrame 重新 show，也不新建实例
     ③ 页面本身不受影响（热区仍在，浮卡消失后不留白、不挡操作）
     ④ 横屏召唤页同样成立（广告位在卡牌左侧那种落点）
   用法：NODE_PATH=/Users/lipeng/.workbuddy/binaries/node/workspace/node_modules \
         node test/probe_ad_close.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const MODS = ["./js/platform.js", "./js/config.js","./js/rank.js", "./js/audio.js", "./js/draw.js",
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

const SNAP = () => {
  const G = window.G;
  return {
    log: (window.__adLog || []).map(r => ({ alive: r.alive, shown: r.shown, hidden: r.hidden, destroyed: r.destroyed })),
    state: G.ad.state(),
    btns: (G.ui.buttons || []).length
  };
};

async function boot(browser, view, sys) {
  const page = await browser.newPage({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console " + m.text()); });
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, sys);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(() => window.require("./game.js"));
  await page.evaluate(() => { window.G.AD_UNIT_ID = "adunit-test"; });
  return { page, errs };
}

/* 关闭后要验的通用四条 */
async function checkClosed(page, label, aliveIdx) {
  const fired = await page.evaluate(() => window.__adEmit("close"));
  ok(fired === true, label + "：关闭回调已触发");
  await sleep(150);
  let s = await page.evaluate(SNAP);
  ok(s.state.page === null && s.state.shown === false && s.state.frames === 0,
    label + "：关闭后状态归零（page/shown/frames）", JSON.stringify({ p: s.state.page, sh: s.state.shown, fr: s.state.frames }));
  ok(s.state.closed === true, label + "：closed 标记已置位（挡住后续任何自动 show）", String(s.state.closed));
  const rec = s.log[aliveIdx];
  ok(rec && rec.alive === false && rec.destroyed >= 1, label + "：实例已销毁，浮层不会残留", JSON.stringify(rec));

  /* 跨过 900ms 兜底 show 窗口 + 至少几十帧 pageFrame；顺手模拟一次切后台回前台
     （wx.onShow → ad.resume → reveal），确认这条路也不会把关闭掉的浮卡捞回来 */
  await page.evaluate(() => { if (window.__wxShow) window.__wxShow({}); });
  await sleep(1600);
  s = await page.evaluate(SNAP);
  ok(s.log.length === aliveIdx + 1, label + "：关闭后没有新建实例", s.log.length + " 个实例");
  ok(s.log[aliveIdx].shown === 1, label + "：没有被 pageFrame / 兜底 timer 重新 show", "show 次数=" + s.log[aliveIdx].shown);
  ok(s.state.page === null && s.state.shown === false, label + "：1.6s 后仍保持空闲", JSON.stringify({ p: s.state.page, sh: s.state.shown }));
  ok(s.btns > 0, label + "：页面照常可交互（热区仍在）", s.btns + " 个热区");
}

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];

  /* ============ 竖屏首页 ============ */
  const port = await boot(browser, { w: 390, h: 844 },
    { windowWidth: 390, windowHeight: 844, pixelRatio: 2, safeArea: { left: 0, top: 47, right: 390, bottom: 810 } });
  errs.push(...port.errs);
  await sleep(1100);
  let s = await port.page.evaluate(SNAP);
  ok(s.log.length === 1 && s.log[0].shown === 1, "竖屏首页：广告已展示", JSON.stringify(s.log));
  await checkClosed(port.page, "竖屏首页", 0);

  /* 关闭后切页再回来：允许重新加载一次（新的一次进页，不是"自己弹回来"） */
  await port.page.evaluate(() => { window.G.switchScreen("result"); });
  await sleep(400);
  await port.page.evaluate(() => { window.G.switchScreen("home"); });
  await sleep(1100);
  s = await port.page.evaluate(SNAP);
  const lastHome = s.log[s.log.length - 1];
  ok(lastHome && lastHome.alive === true && lastHome.shown === 1,
    "竖屏首页：重新进页会重新加载一次（关闭只对本次挂载生效）", JSON.stringify(s.log));

  /* ============ 横屏召唤页 ============ */
  const land = await boot(browser, { w: 852, h: 393 },
    { windowWidth: 852, windowHeight: 393, pixelRatio: 2, safeArea: { left: 47, top: 0, right: 805, bottom: 372 } });
  errs.push(...land.errs);
  await land.page.evaluate(() => window.G.switchScreen("summon"));
  await sleep(1000);
  /* 横屏冷启动先落在首页（横屏首页也有浮卡），切到召唤页会再建一个，取最后那条 */
  s = await land.page.evaluate(SNAP);
  const idx = s.log.length - 1;
  ok(idx >= 0 && s.log[idx].alive === true && s.log[idx].shown === 1,
    "横屏召唤：左侧浮卡已展示", JSON.stringify(s.log));
  await checkClosed(land.page, "横屏召唤", idx);

  await browser.close();

  console.log("\n===== 关闭广告即消失 体检 =====");
  A.forEach(x => console.log(x));
  const real = errs.filter(e => !/Failed to load resource/.test(e));
  if (real.length) { console.log("\n运行时错误："); real.slice(0, 6).forEach(e => console.log("  ❌ " + e)); }
  else console.log("✅ 无 JS 运行时错误");
  const bad = A.filter(x => x.startsWith("❌")).length;
  console.log(bad ? "\n❌ 失败 " + bad + " 项" : "\n✅ 全部通过");
  if (bad) process.exit(1);
})();
