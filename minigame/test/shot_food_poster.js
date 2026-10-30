/* shot_food_poster.js — 生成「电子猫粮机」宣传海报（1080×1440）
   两步：
     1) 用真实渲染截一张竖屏手机屏（进猫粮机 → 连出两份粮，让盆里堆满带冻干的粮）
     2) 按 test/poster_food.html 的版式整页截图（标题/卖点/二维码都是排版，不重绘二维码）
   用法：NODE_PATH=<npm 模块目录> node test/shot_food_poster.js */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "generated-images");
fs.mkdirSync(OUT, { recursive: true });
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

function findChrome() {
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", process.env.CHROME_PATH || ""])
    if (p && fs.existsSync(p)) return p;
  throw new Error("no chrome found");
}

const port = { windowWidth: 390, windowHeight: 844, pixelRatio: 2,
  safeArea: { left: 0, top: 47, right: 390, bottom: 810 } };
const CLICK = (k) => {
  const G = window.G;
  const b = G.ui.buttons.slice().reverse().find(b => b.key === k);
  if (!b) return false;
  return G.hitButton(b.x + b.w / 2, b.y + b.h / 2);
};

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });

  /* Playwright 的 deviceScaleFactor 在这台系统 Chrome 上不生效（dpr 一直是 1），
     所以倍图直接走 CDP：先覆盖设备像素比，再用 Page.captureScreenshot 出图。
     clip 里的坐标是 CSS 像素，输出尺寸 = clip 尺寸 × 设备像素比。 */
  async function shot(page, out, w, h, scale, clip) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: scale, mobile: false });
    const r = await cdp.send("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: false,
      clip: clip ? { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 } : undefined
    });
    fs.writeFileSync(out, Buffer.from(r.data, "base64"));
    await cdp.detach();
  }

  /* ---------- 1) 手机屏：真实渲染截图 ---------- */
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", e => { throw new Error("渲染手机屏出错：" + e.message); });
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, port);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.G.config.feedBowl = 0; window.G.feederEnter(); });
  await page.waitForTimeout(600);

  // 连出两份（每份 16 颗），等演出回常态再截
  for (let i = 0; i < 2; i++) {
    await page.evaluate(CLICK, "feed");
    await page.waitForTimeout(700);
    for (let t = 0; t < 60; t++) {
      const mode = await page.evaluate(() => window.G.feeder.mode);
      if (mode === "home") break;
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(500);
  }
  const bowl = await page.evaluate(() => ({
    pieces: window.G.config.feedBowl, hopper: Math.round(window.G.config.feedHopper),
    mode: window.G.feeder.mode, screen: window.G.screen
  }));
  if (bowl.mode !== "home" || bowl.screen !== "feeder") throw new Error("没回到猫粮机常态：" + JSON.stringify(bowl));
  /* 只截上半屏：常态下机器居中在 y≈233..637，下面一大片是空白，留着当海报主图会塌。
     画布本身是 2 倍Backing（platform.js 里 dpr 取 min(pixelRatio,2)），所以按 2 倍截才不浪费细节 */
  await shot(page, path.join(OUT, "poster_phone.png"), 390, 844, 2, { x: 0, y: 0, width: 390, height: 690 });
  console.log("手机屏：盆里 " + bowl.pieces + " 颗（储粮 " + bowl.hopper + "%）→ generated-images/poster_phone.png");
  await page.close();

  /* ---------- 2) 海报排版 ---------- */
  const p = await browser.newPage({ viewport: { width: 1080, height: 1440, deviceScaleFactor: 1 } });
  const bad = [];
  p.on("pageerror", e => bad.push("pageerror: " + e.message));
  p.on("requestfailed", r => bad.push("请求失败: " + r.url().slice(-40)));
  await p.goto("file://" + path.join(ROOT, "test/poster_food.html"), { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  const out = path.join(OUT, "poster_cat_feeder_1080x1440.png");
  await shot(p, out, 1080, 1440, 1);
  console.log("海报：" + out);
  /* 再出一张 2 倍的：发朋友圈/群里被微信压一遍也不糊 */
  const out2 = path.join(OUT, "poster_cat_feeder_2160x2880.png");
  await shot(p, out2, 1080, 1440, 2);
  console.log("海报（2 倍）：" + out2);
  if (bad.length) console.log("⚠️ " + bad.join("\n⚠️ "));
  await browser.close();
})();
