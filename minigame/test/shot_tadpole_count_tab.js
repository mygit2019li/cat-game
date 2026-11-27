/* 蝌蚪快跑「猎物数量」选项卡（Tab）截图：
   在 harness 里加载真实 game.js，翻到青蛙玩法组的蝌蚪卡（idx=1），
   截取底部设置面板区域，检查「单条/多条」Tab 的选中/未选中态视觉。
   跑法：node test/shot_tadpole_count_tab.js */
const fs = require("fs");
const path = require("path");
const pc = (function () {
  for (const p of ["/Users/lipeng/node_modules/playwright-core", "/tmp/ffshot/node_modules/playwright-core"]) {
    try { return require(p); } catch (e) { /* 试下一个 */ }
  }
  throw new Error("找不到 playwright-core（可先跑：mkdir -p /tmp/ffshot && cd /tmp/ffshot && npm i playwright-core）");
})();
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js","./js/rank.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(400);

  const info = await page.evaluate(() => {
    const G = window.G;
    // 进入青蛙玩法组并翻到蝌蚪卡（idx=1）
    G.config = Object.assign({}, G.config, { targetType: "frog", frogMode: "tadpole", tadCount: 1, difficulty: "normal" });
    const g = G.MODE_GROUPS["frog"];
    G.bgPick = { idx: 1, visIdx: 1, off: 0, drag: false, x0: 0, moved: 0, cw: 0, ch: 0, gap: 0,
      t0: performance.now() - 600, relOff: 0, relT0: 0, touchActive: false, selT0: 0, group: "frog" };
    G.screen = "bgpick";
    G.ui.drawBgPick();
    // 从按钮表找「多条」/「单条」Tab 的几何（用于标注命中热区，辅助肉眼核对）
    const btns = G.ui.buttons.slice();
    const tabRects = btns.filter(b => {
      const w = b.w, h = b.h;
      return h > 20 && h < 50 && w > 40 && w < 130 && b.y > 500;
    });
    return {
      tadCount: G.config.tadCount,
      tabRects: tabRects.map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)]),
      btnTotal: btns.length,
      platformS: G.platform.S
    };
  });
  await page.waitForTimeout(120);
  // 截整个画布：完整页面 + 底部面板（tadCount=1 → 选中「单条」）
  await page.screenshot({ path: path.join(OUT, "tad-count-tab-single.png") });
  console.log("info:", JSON.stringify(info));
  console.log("errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
