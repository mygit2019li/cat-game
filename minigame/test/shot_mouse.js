/* 老鼠造型/动画验证截图：直接驱动 D.mouse（侧视）与 D.mouseTop（俯视）在多个动画相位
   下渲染到离屏画布并拼图导出。跑法：node test/shot_mouse.js */
const fs = require("fs");
const path = require("path");
const pc = (function () {
  for (const p of ["/Users/lipeng/.workbuddy/binaries/node/workspace/node_modules/playwright-core", "/Users/lipeng/node_modules/playwright-core", "/tmp/ffshot/node_modules/playwright-core"]) {
    try { return require(p); } catch (e) {}
  }
  throw new Error("找不到 playwright-core");
})();
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];

(async () => {
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(250);

  const dataUrl = await page.evaluate(async () => {
    const G = window.G;
    const dpr = 2;
    const CW = 640, CH = 540;
    const cv = document.createElement("canvas");
    cv.width = CW * dpr; cv.height = CH * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    // 深底（老鼠场景底色），便于看发光/阴影
    const bg = ctx.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, "#1c2622"); bg.addColorStop(1, "#0e1512");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);

    const variants = G.MOUSE_VARIANTS;
    const sideState = (i) => i === 0 ? "peek" : (i === 1 ? "dart" : "scurry");

    const drawLabel = (txt, x, y) => {
      ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.font = "13px -apple-system, sans-serif";
      ctx.fillText(txt, x, y);
    };

    // ==== 上排：侧视鼠 D.mouse，4 只 = [老仓-peek][老仓-dart][炭胆-scurry][炭胆-peek] ====
    const sideY = 90, sideX = (i) => 90 + i * 150;
    drawLabel("侧视 D.mouse（探头/疾跑/窜逃/深色探头）", 16, 28);
    for (let i = 0; i < 4; i++) {
      const v = (i === 2 || i === 3) ? variants[1] : variants[0];   // 第 3/4 只用炭胆看深色立体
      ctx.save();
      ctx.translate(sideX(i), sideY);
      ctx.scale(1.5, 1.5);
      G.draw.mouse(ctx, { state: sideState(i), phase: i * 1.7, mouseVar: v }, 0.4 + i * 0.5);
      ctx.restore();
    }

    // ==== 中排：俯视群鼠 D.mouseTop，4 只 = [老仓-scurry][炭胆-scurry][老仓-pause][炭胆-pause] ====
    const topY = 360, topX = (i) => 90 + i * 150;
    drawLabel("俯视 D.mouseTop（疾走/深色疾走/停驻/深色停驻）", 16, 248);
    for (let i = 0; i < 4; i++) {
      const v = (i === 1 || i === 3) ? variants[1] : variants[0];
      const st = (i === 2 || i === 3) ? "pause" : "scurry";
      ctx.save();
      ctx.translate(topX(i), topY);
      ctx.scale(1.4, 1.4);
      G.draw.mouseTop(ctx, { state: st, phase: i * 1.3 }, 0.4 + i * 0.5);
      ctx.restore();
    }

    return cv.toDataURL("image/png");
  });
  fs.writeFileSync(path.join(OUT, "mouse-redesign.png"), Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("老鼠造型截图完成 | errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
