/* probe_loading_ad.js — 加载页广告体检（横屏）
   加载屏不是独立 screen：冷启动加载期间 G.screen 仍是 "home"，加载屏上浮的
   就是首页横屏广告（贴顶靠右横带）。修了两件事，这里各验一条：
     ① 加载期间主循环现在会打 ad.pageFrame → 广告 2 帧内 show，
        不再只靠 900ms 兜底（分包加载快时旧逻辑可能整段加载都看不到广告）。
     ② 部分安卓机冷启动瞬间横屏未生效，广告按竖屏坐标创建且卡死在旧位置；
        现在 platform 尺寸纠正（resize 事件）后 resizeCb 会 ad.realign，
        广告被拉回「贴顶靠右」。
   用法：NODE_PATH=/tmp/ffshot/node_modules node test/probe_loading_ad.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./js/ad.js", "./js/feeder.js", "./game.js"];

function findChrome() {
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", process.env.CHROME_PATH || ""])
    if (p && fs.existsSync(p)) return p;
  throw new Error("no chrome found");
}

const A = [];
const ok = (cond, msg, extra) => { A.push((cond ? "✅ " : "❌ ") + msg + (extra != null ? "  → " + extra : "")); return cond; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const LAND = { windowWidth: 844, windowHeight: 390, pixelRatio: 2,
  safeArea: { left: 47, top: 0, right: 797, bottom: 369 } };
const PORT = { windowWidth: 390, windowHeight: 844, pixelRatio: 2,
  safeArea: { left: 0, top: 47, right: 390, bottom: 810 } };

/* game.js 在浏览器垫片下会立刻 assetsReady=true；把它改成 false 就能一直停在加载屏，
   模拟真机分包下载中的状态（enter("home") 在 require 期已按当时坐标系建好实例）。 */
function modsForLoading() {
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  const marker = "G.assetsReady = true;   // 浏览器垫片";
  if (mods["./game.js"].indexOf(marker) < 0) throw new Error("game.js 垫片标记没找到，探针需要同步更新");
  /* 整行替换：标记只是行首半截，直接 replace 会把行尾注释残留成非法 token */
  mods["./game.js"] = mods["./game.js"].split("\n")
    .map(l => (l.indexOf(marker) >= 0 ? "  G.assetsReady = false;" : l)).join("\n");
  return mods;
}

async function boot(browser, viewport, sysInfo) {
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, sysInfo);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modsForLoading());
  await page.evaluate(() => window.require("./game.js"));
  await sleep(400);
  return { page, errs };
}

const ADSTATE = () => {
  const G = window.G;
  return {
    screen: G.screen,
    assetsReady: G.assetsReady,
    P: { W: G.platform.W, H: G.platform.H, S: G.platform.S },
    st: G.ad ? G.ad.state() : "noAd",
    alive: (window.__adLog || []).filter(r => r.alive).length,
    destroyed: (window.__adLog || []).reduce((a, r) => a + r.destroyed, 0)
  };
};

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });

  /* ===== 场景 A：横屏正常启动 → 加载屏上的广告 2 帧内 show 且贴顶靠右 ===== */
  {
    const { page, errs } = await boot(browser, { width: 844, height: 390 }, LAND);
    const s = await page.evaluate(ADSTATE);
    ok(s.assetsReady === false, "场景A：垫片已 patched，停在加载屏（assetsReady=false）", String(s.assetsReady));
    ok(s.alive === 1, "场景A：加载屏期间建了 1 个广告实例", String(s.alive));
    ok(s.st && s.st.shown === true, "场景A：广告在 400ms 内已 show（< 900ms 兜底，走 pageFrame 路径）",
      JSON.stringify({ shown: s.st && s.st.shown }));
    const style = s.st && s.st.style;
    if (style) {
      ok(style.top >= 4 && style.top <= 16, "场景A：加载页横屏广告贴顶（top 4~16）", style.top);
      ok(style.width >= 120, "场景A：广告宽 ≥120", style.width);
      ok(style.left + style.width >= 720 && style.left + style.width <= 750,
        "场景A：右缘止于胶囊左侧（720~750）", style.left + style.width);
    } else ok(false, "场景A：有 style", "none");
    ok(errs.length === 0, "场景A：无运行时错误", errs.join(" | "));
    await page.close();
  }

  /* ===== 场景 B：冷启动竖屏怪癖（安卓横屏未生效）→ 尺寸纠正后 realign 拉回贴顶靠右 ===== */
  {
    const { page, errs } = await boot(browser, { width: 390, height: 844 }, PORT);
    let s = await page.evaluate(ADSTATE);
    ok(s.alive === 1 && s.st.shown === true, "场景B：加载屏期间广告已建并 show", JSON.stringify({ alive: s.alive, shown: s.st.shown }));
    const before = s.st.style;
    ok(before && before.top >= 500 && before.left >= 200,
      "场景B：怪癖复现——竖屏坐标系下广告落在 {left~214, top~524}（旧代码会卡死在这）",
      JSON.stringify(before));

    /* 横屏生效：先更新 __sysInfo（模拟系统纠正），再改视口触发 window resize 事件 */
    await page.evaluate(x => { window.__sysInfo = x; }, LAND);
    await page.setViewportSize({ width: 844, height: 390 });
    await sleep(400);
    s = await page.evaluate(ADSTATE);
    ok(s.P.W === 844 && s.P.H === 390, "场景B：platform 尺寸已纠正为横屏", JSON.stringify(s.P));
    ok(s.destroyed === 0 && s.alive === 1, "场景B：纠正过程不销毁实例（realign 只挪位置）",
      JSON.stringify({ alive: s.alive, destroyed: s.destroyed }));
    const after = s.st.style;
    if (after) {
      ok(after.top >= 4 && after.top <= 16, "场景B：realign 后广告贴顶（top 4~16）", after.top);
      ok(after.left + after.width >= 720 && after.left + after.width <= 750,
        "场景B：realign 后右缘贴胶囊左侧（720~750）", after.left + after.width);
      ok(after.left !== before.left || after.top !== before.top, "场景B：位置确实被拉回右上角顶部",
        before.left + "," + before.top + " → " + after.left + "," + after.top);
    } else ok(false, "场景B：realign 后有 style", "none");
    ok(errs.length === 0, "场景B：无运行时错误", errs.join(" | "));
    await page.close();
  }

  /* ===== 场景 C：无实例时 realign 是安全空操作 ===== */
  {
    const { page, errs } = await boot(browser, { width: 844, height: 390 }, LAND);
    const r = await page.evaluate(() => {
      try { window.G.ad.leave("probe-c"); window.G.ad.realign(); return "ok"; }
      catch (e) { return "throw: " + e.message; }
    });
    ok(r === "ok", "场景C：无实例时 realign 不抛错", r);
    ok(errs.length === 0, "场景C：无运行时错误", errs.join(" | "));
    await page.close();
  }

  await browser.close();
  console.log("\n===== 加载页广告 体检 =====");
  A.forEach(x => console.log(x));
  const bad = A.filter(x => x.startsWith("❌")).length;
  console.log(bad ? "\n❌ 失败 " + bad + " 项" : "\n✅ 全部通过");
  if (bad) process.exit(1);
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
