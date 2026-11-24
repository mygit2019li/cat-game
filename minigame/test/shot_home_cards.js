/* 首页横屏「选择玩法」卡片尺寸探针：
   - 加载完整游戏到首页
   - 读 ui.buttons 里 6 张玩法卡的实际尺寸（w/h）与面板尺寸
   - 截图供肉眼核对
   跑法：node test/shot_home_cards.js [label] */
const fs = require("fs");
const path = require("path");
const pc = (function () {
  for (const p of ["/Users/lipeng/.workbuddy/binaries/node/workspace/node_modules/playwright-core", "/Users/lipeng/node_modules/playwright-core", "/tmp/ffshot/node_modules/playwright-core"]) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error("找不到 playwright-core");
})();
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const LABEL = process.argv[2] || "home-cards";
const VIEW_W = Number(process.env.VIEW_W || 932);
const VIEW_H = Number(process.env.VIEW_H || 430);

(async () => {
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: VIEW_W, height: VIEW_H } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
    "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
    "./js/ad.js", "./js/feeder.js", "./game.js"]) {
    mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  }
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  // 等首页真正绘制完（素材加载 + 动画稳定）
  await page.waitForTimeout(1600);

  // 读首页按钮表：玩法卡是 6 张带 key 的 btn（key 以 mode: 开头或 cb 改 targetType）。
  // 直接按尺寸聚类：找出 w 相同、h 相同、数量为 6 的矩形组即玩法卡。
  const info = await page.evaluate(() => {
    const G = window.G;
    const btns = (G.ui.buttons || []).map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, key: b.key || null }));
    // 面板：raisedCard 绘制的大白卡，尺寸 > 400x200 且只有一张
    const panel = btns.find(b => b.w > 400 && b.h > 200 && b.w > b.h) || null;
    return {
      W: G.platform.W, H: G.platform.H, S: G.platform.S,
      screen: G.screen,
      btnCount: btns.length,
      btns: btns.filter(b => b.w > 60 && b.w < 320 && b.h > 60 && b.h < 260),
      panel
    };
  });
  console.log(JSON.stringify(info, null, 2));
  const shot = path.join(OUT, `首页_玩法卡_${LABEL}.png`);
  await page.screenshot({ path: shot });
  console.log("截图:", shot);
  console.log("errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
