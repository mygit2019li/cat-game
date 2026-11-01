/* shot_feeder_header.js — 电子猫粮页顶部按钮与首页设置键的一致性
   验：
   1) 电子猫粮页左上角是「返回 + 设置」两颗圆键，尺寸与首页设置键相同（34px）
   2) 设置键用同一份齿轮画法（G.ui.gearAt），不再是自绘实心齿轮、也不在右上角
   3) 两键同高、间距 8px、左边距 12px，与首页设置键的 (12,10) 对齐
   4) 点设置键仍打开喂食设置弹窗（功能不变）
   截图：竖屏常态 / 竖屏设置弹窗 / 横屏常态 / 首页对照
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

/* 取两颗顶部键的矩形（按 key 找，没 key 时按尺寸/位置兜底） */
const headRects = (page) => page.evaluate(() => {
  const G = window.G;
  const btns = G.ui.buttons.filter(b => b.w === 34 && b.h === 34).map(b => ({
    key: b.key || "?", x: Math.round(b.x), y: Math.round(b.y), w: b.w, h: b.h
  })).sort((a, b) => a.x - b.x);
  return btns;
});

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });

  // ---------- 竖屏 ----------
  {
    const { page, errors } = await open(browser, 390, 844);
    // 首页对照：只剩一颗齿轮
    const home = await headRects(page);
    await page.screenshot({ path: path.join(OUT, "feeder-head-0-home.png") });

    await page.evaluate(() => window.G.feederEnter());
    await page.waitForTimeout(700);
    const feeder = await headRects(page);
    await page.screenshot({ path: path.join(OUT, "feeder-head-1-portrait.png") });

    // 点设置键
    const opened = await page.evaluate(async () => {
      const G = window.G, S = G.platform.S || 1;
      const b = G.ui.buttons.find(x => x.key === "settings");
      if (b) G.platform.onTouchStart({ touches: [{ clientX: (b.x + b.w / 2) * S, clientY: (b.y + b.h / 2) * S }] });
      await new Promise(r => setTimeout(r, 260));
      return { mode: G.feederMode ? G.feederMode() : "?", screen: G.screen };
    });
    await page.screenshot({ path: path.join(OUT, "feeder-head-2-modal.png") });

    const gear = feeder.find(b => b.key === "settings") || {};
    const back = feeder.find(b => b.key === "back") || {};
    console.log("首页齿轮:", JSON.stringify(home[0]));
    console.log("猫粮页:", JSON.stringify(feeder));
    console.log("对齐: 左边距=" + back.x + "（首页 " + (home[0] ? home[0].x : "?") + "） | 同高=" +
      (back.y === gear.y) + " | 间距=" + (gear.x - back.x - 34) + " | 尺寸=" + gear.w + "×" + gear.h);
    console.log("点设置:", JSON.stringify(opened));
    console.log("竖屏 errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 横屏 ----------
  {
    const { page, errors } = await open(browser, 852, 393);
    await page.evaluate(() => window.G.feederEnter());
    await page.waitForTimeout(700);
    const feeder = await headRects(page);
    await page.screenshot({ path: path.join(OUT, "feeder-head-3-land.png") });
    console.log("横屏:", JSON.stringify(feeder));
    console.log("横屏 errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  await browser.close();
  console.log("DONE ->", OUT);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
