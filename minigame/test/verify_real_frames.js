/* 验证真实生成的 PNG 序列帧：走游戏完整链路
   config.G.MOUSE_ANIM → frames.js 异步 loadImage(assets/frames/*.png) → 切帧中心对齐绘制。
   截图 4 个 clip 各 4 个时间点，确认帧在变化 + 老鼠造型正确。
   跑法：node test/verify_real_frames.js */
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
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true
  });
  const page = await browser.newPage({ viewport: { width: 980, height: 640 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(300);

  // 触发真实加载（frames.js init 已建 manifest；这里 ensure 触发 loadImage 读 assets/frames/*.png）
  await page.evaluate(() => {
    const G = window.G;
    G.frames.ensure("side", "run");
    G.frames.ensure("side", "peek");
    G.frames.ensure("top", "run");
    G.frames.ensure("top", "pause");
  });
  // 轮询直到 4 个 clip 全部 ready（最多 5s）
  await page.waitForFunction(() => {
    const G = window.G;
    return G.frames.isReady("side", "run") && G.frames.isReady("side", "peek") &&
           G.frames.isReady("top", "run") && G.frames.isReady("top", "pause");
  }, null, { timeout: 5000 }).catch(() => console.log("WARN: 部分 clip 未 ready"));
  // 诊断：直接看 platform 缓存里的 img 状态 + reg 内部状态
  const diag = await page.evaluate(() => {
    const G = window.G;
    const cache = G.platform.assets["assets/frames/mouse_run.png"];
    const c = G.frames._reg.side.clips.run;
    return {
      cacheExists: !!cache, cacheOk: cache ? cache.ok : undefined,
      cacheSrc: cache ? cache.src : undefined,
      regClip: c ? { ready: c.ready, hasImg: !!c._img, frames: c.frames, file: c.file } : "(no clip)"
    };
  });
  console.log("DIAG:", JSON.stringify(diag));
  const ready = await page.evaluate(() => {
    const G = window.G;
    return {
      sideRun: G.frames.isReady("side", "run"),
      sidePeek: G.frames.isReady("side", "peek"),
      topRun: G.frames.isReady("top", "run"),
      topPause: G.frames.isReady("top", "pause"),
      sideRunImg: !!(G.frames._reg.side.clips.run._img)
    };
  });
  console.log("READY STATE:", JSON.stringify(ready));

  const dataUrl = await page.evaluate(() => {
    const G = window.G;
    const dpr = 2, CW = 980, CH = 640;
    const cv = document.createElement("canvas");
    cv.width = CW * dpr; cv.height = CH * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    const bg = ctx.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, "#1c2622"); bg.addColorStop(1, "#0e1512");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = "14px -apple-system, sans-serif";

    const rows = [
      { label: "侧视 run (mouse_run.png, 8帧)",  role: "side", clip: "run",   w: 120, h: 78,  y: 110, times: [0, 0.25, 0.5, 0.75] },
      { label: "侧视 peek (mouse_peek.png, 6帧)", role: "side", clip: "peek",  w: 120, h: 78,  y: 250, times: [0, 0.3, 0.6, 1.0] },
      { label: "俯视 run (mousetop_run.png, 8帧)", role: "top",  clip: "run",   w: 120, h: 100, y: 400, times: [0, 0.25, 0.5, 0.75] },
      { label: "俯视 pause (mousetop_pause.png, 4帧)", role: "top", clip: "pause", w: 120, h: 100, y: 540, times: [0, 0.5, 1.0, 1.5] }
    ];
    for (const r of rows) {
      ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.fillText(r.label, 16, r.y - 46);
      for (let i = 0; i < 4; i++) {
        const x = 90 + i * 230;
        ctx.save();
        ctx.translate(x, r.y); ctx.scale(1.5, 1.5);
        ctx.translate(-r.w / 2, -r.h / 2);
        const ok = G.frames.draw(ctx, r.role, r.clip, r.times[i], r.w, r.h);
        ctx.restore();
        ctx.fillStyle = ok ? "#9dff7a" : "#ff6b6b"; ctx.font = "12px sans-serif";
        ctx.fillText(ok ? "frame@" + r.times[i].toFixed(2) : "FALLBACK", x - 30, r.y + r.h / 2 + 22);
      }
    }
    return cv.toDataURL("image/png");
  });
  const stamp = Date.now();
  fs.writeFileSync(path.join(OUT, "real-frames-" + stamp + ".png"), Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("saved screenshots/real-frames-" + stamp + ".png");
  console.log("真实序列帧验证 | errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
  if (errors.length) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
