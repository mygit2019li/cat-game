/* 生成「序列帧 vs 程序化回退」对照图：
   上排=真实 PNG 序列帧（frames.js 切帧），下排=程序化绘制（draw.js）同相位。
   用 drawImage 把 sheet 单帧贴到 canvas（不走 toDataURL 导出跨域 canvas，改逐帧离屏再合并）。
   跑法：node test/shot_frames_compare.js */
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/.workbuddy/binaries/node/workspace/node_modules/playwright-core");
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/frames.js", "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true, args: ["--allow-file-access-from-files"]
  });
  const page = await browser.newPage({ viewport: { width: 980, height: 560 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    const G = window.G;
    G.frames.ensure("side", "run");
    G.frames.ensure("top", "run");
    G.frames.ensure("top", "pause");
  });
  await page.waitForFunction(() => {
    const G = window.G;
    return G.frames.isReady("side", "run") && G.frames.isReady("top", "run") && G.frames.isReady("top", "pause");
  }, null, { timeout: 5000 }).catch(() => console.log("WARN: 部分未 ready"));

  const stamp = Date.now();
  // 用 pngjs 无关，直接让浏览器导出 base64（同源 file + allow-file-access-from-files 可导出）
  const dataUrl = await page.evaluate(() => {
    const G = window.G;
    const dpr = 2, CW = 980, CH = 560;
    const cv = document.createElement("canvas");
    cv.width = CW * dpr; cv.height = CH * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    const bg = ctx.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, "#20302a"); bg.addColorStop(1, "#101a16");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.font = "15px -apple-system, sans-serif";

    const v = G.MOUSE_VARIANTS[0];
    // ===== 上排：序列帧（frames.js 真实切帧）=====
    ctx.fillText("上排 · 真实 PNG 序列帧（frames.js 切帧，Cocos 接入路径）", 16, 28);
    const drawFrame = (role, clip, x, y, t, w, h) => {
      ctx.save();
      ctx.translate(x, y); ctx.scale(1.5, 1.5); ctx.translate(-w / 2, -h / 2);
      const ok = G.frames.draw(ctx, role, clip, t, w, h);
      ctx.restore();
      return ok;
    };
    // 侧视 run 4 帧
    [0, 0.25, 0.5, 0.75].forEach((t, i) => drawFrame("side", "run", 150 + i * 220, 110, t, 120, 78));
    // 俯视 run 4 帧
    [0, 0.25, 0.5, 0.75].forEach((t, i) => drawFrame("top", "run", 150 + i * 220, 250, t, 120, 100));

    // ===== 下排：程序化回退（draw.js）同相位 =====
    ctx.fillText("下排 · 程序化绘制回退（draw.js，无图时自动使用）", 16, 320);
    [0, 0.25, 0.5, 0.75].forEach((t, i) => {
      ctx.save(); ctx.translate(150 + i * 220, 380); ctx.scale(1.5, 1.5); ctx.translate(-60, -39);
      G.draw.mouse(ctx, { state: "dart", phase: 0, mouseVar: v }, t * 12); ctx.restore();
    });
    [0, 0.25, 0.5, 0.75].forEach((t, i) => {
      ctx.save(); ctx.translate(150 + i * 220, 500); ctx.scale(1.5, 1.5); ctx.translate(-60, -50);
      G.draw.mouseTop(ctx, { state: "scurry", phase: 0, mouseVar: v }, t * 12); ctx.restore();
    });
    return cv.toDataURL("image/png");
  });
  fs.writeFileSync(path.join(OUT, "frames-compare-" + stamp + ".png"), Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("saved screenshots/frames-compare-" + stamp + ".png | errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
