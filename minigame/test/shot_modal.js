/* shot_modal.js — 记录 / 排行弹窗验收
   1) 从首页入口打开（真实触摸），面板缩放淡入（进度 mid<1 → done=1）
   2) 右上角 ✕ 关闭带动画：点完仍是原页面，300ms 后回首页
   3) 点弹窗外遮罩也能关
   4) 竖屏 / 横屏截图
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
  await page.waitForTimeout(450);
  return { page, errors };
}

/* 面板矩形：直接读 modalShell 写下的 G.modal.geo（高度会随内容/横竖屏变化，别再手算） */
async function panelRect(page) {
  return page.evaluate(() => {
    const G = window.G;
    const S = G.platform.S || 1;
    const W = G.platform.W / S, H = G.platform.H / S;
    const g = (G.modal && G.modal.geo) || { px: 0, py: 0, pw: W, ph: H };
    return { S, W, H, px: g.px, py: g.py, pw: g.pw, ph: g.ph, xcx: g.px + g.pw - 31, xcy: g.py + 26 };
  });
}

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });

  // ---------- 竖屏：记录 ----------
  {
    const { page, errors } = await open(browser, 390, 844);
    // 造 6 条历史
    await page.evaluate(() => {
      const G = window.G;
      const rows = [
        { date: "10/31", type: "frog", dur: 180, hits: 42, touches: 60, accuracy: 70, combo: 11 },
        { date: "10/30", type: "fish", dur: 180, hits: 37, touches: 58, accuracy: 64, combo: 8 },
        { date: "10/30", type: "laser", dur: 120, hits: 29, touches: 51, accuracy: 57, combo: 6 },
        { date: "10/29", type: "mouse", dur: 60, hits: 21, touches: 40, accuracy: 53, combo: 5 },
        { date: "10/28", type: "butterfly", dur: 300, hits: 55, touches: 88, accuracy: 63, combo: 13 },
        { date: "10/27", type: "pool", dur: 180, hits: 18, touches: 44, accuracy: 41, combo: 3 }
      ];
      G.platform.storage.set("catToyLogs", JSON.stringify(rows));
    });

    // 走真实触摸：点底部「本周记录」
    const opened = await page.evaluate(async () => {
      const G = window.G;
      const b = G.ui.buttons.find(x => x.y > 560 && x.w > 90 && x.h > 30);
      if (b) G.platform.onTouchStart({ touches: [{ clientX: (b.x + 20) * (G.platform.S || 1), clientY: (b.y + 20) * (G.platform.S || 1) }] });
      await new Promise(r => setTimeout(r, 40));
      const mid = G._modalEase;
      await new Promise(r => setTimeout(r, 400));
      return { screen: G.screen, mid, done: G._modalEase };
    });
    await page.screenshot({ path: path.join(OUT, "modal-1-records.png") });

    const r = await panelRect(page);
    const closing = await page.evaluate(async ({ xcx, xcy, S }) => {
      const G = window.G;
      G.platform.onTouchStart({ touches: [{ clientX: xcx * S, clientY: xcy * S }] });
      const rightAfter = G.screen;
      await new Promise(r => setTimeout(r, 80));
      const mid = G._modalEase;
      await new Promise(r => setTimeout(r, 260));
      return { rightAfter, mid, end: G.screen, modal: G.modal };
    }, r);

    console.log("记录: 打开", JSON.stringify(opened));
    console.log("记录: 关闭", JSON.stringify(closing));
    console.log("竖屏 errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 竖屏：排行 ----------
  {
    const { page, errors } = await open(browser, 390, 844);
    const opened = await page.evaluate(async () => {
      const G = window.G;
      const b = G.ui.buttons.find(x => x.y > 560 && x.w > 90 && x.h > 30 && x.x > 150);
      if (b) G.platform.onTouchStart({ touches: [{ clientX: (b.x + 20) * (G.platform.S || 1), clientY: (b.y + 20) * (G.platform.S || 1) }] });
      await new Promise(r => setTimeout(r, 420));
      return { screen: G.screen, key: G.modal && G.modal.key, rect: G.modal && G.modal.lbRect };
    });
    await page.screenshot({ path: path.join(OUT, "modal-2-leaderboard.png") });

    const r = await panelRect(page);
    const closed = await page.evaluate(async ({ W, H, S }) => {
      const G = window.G;
      G.platform.onTouchStart({ touches: [{ clientX: (W - 10) * S, clientY: (H - 10) * S }] });   // 点遮罩
      const rightAfter = G.screen;
      await new Promise(r => setTimeout(r, 320));
      return { rightAfter, end: G.screen };
    }, r);
    console.log("排行: 打开", JSON.stringify(opened));
    console.log("排行: 点遮罩关闭", JSON.stringify(closed));
    console.log("排行 errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 横屏 ----------
  {
    const { page, errors } = await open(browser, 852, 393);
    await page.evaluate(() => { window.G.openModal("records"); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "modal-3-records-land.png") });
    await page.evaluate(() => { window.G.closeModal(); });
    await page.waitForTimeout(320);
    await page.evaluate(() => { window.G.openModal("lb"); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "modal-4-lb-land.png") });
    console.log("横屏 errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  await browser.close();
  console.log("DONE ->", OUT);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
