/* shot_load_scenes.js — 加载屏玩法轮播视觉验证
   强制 assetsReady=false，截多张不同时刻的加载屏，检查：
   ① 轮播卡出现、图标/文案不溢出、指示点正常
   ② 不同时刻切到不同玩法画面
   ③ 错误态不展示轮播卡
   用法：NODE_PATH=/tmp/ffshot/node_modules node test/shot_load_scenes.js */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js","./js/rank.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true, args: ["--allow-file-access-from-files"]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const G = window.G;
    G.assetsReady = false; G.assetsProgress = 46; G.assetsError = null;
    // 时间偏移把轮播钉到指定卡的中段，避免为后 3 张等满 11×3.6s
    const orig = performance.now.bind(performance);
    let off = 0;
    performance.now = () => orig() + off;
    window.__jumpScene = (i) => { off = i * 3600 + 600 - orig(); };
  });

  // 截 7 张：前 4 张原有玩法 + 新增电子猫粮/召唤猫咪/猫咪心情（索引 8/9/10）
  const scenes = [];
  for (const i of [0, 1, 2, 3, 6, 8, 9, 10]) {
    await page.evaluate(j => window.__jumpScene(j), i);
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(OUT, `load-scene-${i}.png`) });
    scenes.push(`load-scene-${i}.png`);
  }
  // 错误态：不展示轮播卡
  await page.evaluate(() => { window.G.assetsError = "test-err"; window.G.assetsProgress = 0; });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "load-scene-error.png") });

  const tips = await page.evaluate(() => window.G.__LOAD_TIPS || "（内部常量，见源码）");
  console.log("截图:", scenes.join(", "), "load-scene-error.png");
  console.log("提示条数: 见源码 _LOAD_TIPS（8 条）", tips);
  console.log("错误:", errs.length ? errs.slice(0, 3).join(" | ") : "none");
  await browser.close();
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
