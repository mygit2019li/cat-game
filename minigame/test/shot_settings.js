/* shot_settings.js — 设置抽屉验收
   1) 首页左上角小齿轮在、底部行不再有「设置」
   2) 点齿轮 → 抽屉从左上角滑出（截图：动画中 + 稳定态）
   3) 点右上角 X → 回首页
   4) 点抽屉外遮罩 → 也回首页
   5) 横屏抽屉
*/
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "screenshots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOD_NAMES = [
  "./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/feeder.js", "./game.js"
];

async function open(browser, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/ERR_FILE_NOT_FOUND/.test(m.text())) errors.push(m.text()); });
  const modules = {};
  for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(500);
  return { page, errors };
}

/* 抽屉几何（与 drawSettings 保持一致），用于点击 X / 遮罩 */
async function drawerRect(page) {
  return page.evaluate(() => {
    const G = window.G;
    const S = G.platform.S || 1;
    const W = G.platform.W / S, H = G.platform.H / S;
    const safe = {
      top: (G.platform.safe.top || 0) / S, bottom: (G.platform.safe.bottom || 0) / S,
      left: (G.platform.safe.left || 0) / S, right: (G.platform.safe.right || 0) / S
    };
    const land = W > H;
    const pw = land ? Math.min(W * 0.62, 560) : Math.min(W - safe.left - safe.right - 44, 344);
    const px = safe.left + 12, py = safe.top + 10;
    return { S, W, H, px, py, pw, xcx: px + pw - 29, xcy: py + 26 };
  });
}

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });

  // ---------- 竖屏 ----------
  {
    const { page, errors } = await open(browser, 390, 844);
    await page.screenshot({ path: path.join(OUT, "settings-1-home-gear.png") });

    // 走真实触摸：点左上角小齿轮
    const byGear = await page.evaluate(async () => {
      const G = window.G;
      const S = G.platform.S || 1;
      const safe = G.platform.safe || { top: 0, left: 0 };
      const gx = (safe.left / S + 12 + 17) * S, gy = (safe.top / S + 10 + 17) * S;
      G.platform.onTouchStart({ touches: [{ clientX: gx, clientY: gy }] });
      await new Promise(r => setTimeout(r, 40));
      return G.screen;
    });

    // 滑入进度：刚打开时 <1，240ms 后到 1
    const ease = await page.evaluate(async () => {
      const G = window.G;
      if (G.screen !== "settings") G.openSettings();
      await new Promise(r => setTimeout(r, 30));
      const mid = G._settingsEase;
      await new Promise(r => setTimeout(r, 400));
      return { mid, done: G._settingsEase };
    });
    await page.screenshot({ path: path.join(OUT, "settings-2-sliding.png") });
    await page.screenshot({ path: path.join(OUT, "settings-3-drawer.png") });
    console.log("滑入进度 mid=" + ease.mid.toFixed(2) + " done=" + ease.done.toFixed(2));
    console.log("点齿轮进入:", byGear, "| 抽屉内可点控件:", await page.evaluate(() => window.G.ui.buttons.length));

    const r = await drawerRect(page);
    // 抽屉占比（应明显小于全屏）
    const covW = (r.pw / r.W * 100).toFixed(0);

    // 点右上角 X（走真实触摸路由）：关闭要有动画，不能瞬间消失
    const closing = await page.evaluate(async ({ xcx, xcy, S }) => {
      const G = window.G;
      G.platform.onTouchStart({ touches: [{ clientX: xcx * S, clientY: xcy * S }] });
      const rightAfter = { screen: G.screen, vis: G._settingsEase, hasClosing: !!(G.settings && G.settings.closing) };
      await new Promise(r => setTimeout(r, 80));
      const mid = { screen: G.screen, vis: G._settingsEase };
      await page_sleep(220);
      const end = { screen: G.screen, settings: G.settings };
      return { rightAfter, mid, end };
      function page_sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    }, r);
    const closedByX = closing.end.screen;
    console.log("关闭动画:", JSON.stringify(closing));

    // 再开一次，点抽屉外的遮罩（右下角）
    await page.evaluate(() => { window.G.openSettings(); });
    await page.waitForTimeout(360);
    const closedByMask = await page.evaluate(async ({ W, H, S }) => {
      const G = window.G;
      G.platform.onTouchStart({ touches: [{ clientX: (W - 12) * S, clientY: (H - 12) * S }] });
      const immediate = G.screen;
      await new Promise(r => setTimeout(r, 300));
      return immediate + " -> " + G.screen;
    }, r);
    await page.screenshot({ path: path.join(OUT, "settings-4-closed.png") });

    console.log(`竖屏: 抽屉宽占屏 ${covW}% | 点X后 ${closedByX} | 点遮罩后 ${closedByMask} | errors: ${errors.length ? errors.join(" | ") : "none"}`);
    await page.close();
  }

  // ---------- 横屏 ----------
  {
    const { page, errors } = await open(browser, 852, 393);
    await page.screenshot({ path: path.join(OUT, "settings-5-home-land.png") });
    await page.evaluate(() => { window.G.openSettings(); });
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(OUT, "settings-6-drawer-land.png") });
    const r = await drawerRect(page);
    console.log(`横屏: 抽屉 ${Math.round(r.pw)}x? 占屏宽 ${(r.pw / r.W * 100).toFixed(0)}% | errors: ${errors.length ? errors.join(" | ") : "none"}`);
    await page.close();
  }

  await browser.close();
  console.log("DONE ->", OUT);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
