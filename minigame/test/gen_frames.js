/* 生成老鼠序列帧 sheet：直接调用游戏真实的 D.mouse（侧视）/ D.mouseTop（俯视）
   逐帧采样渲染，横向拼接成「单行 N 帧」PNG 落到 assets/frames/。
   跑法：node test/gen_frames.js */
const fs = require("fs");
const path = require("path");
const PC_PATH = "/Users/lipeng/.workbuddy/binaries/node/workspace/node_modules/playwright-core";
const pc = require(PC_PATH);
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "assets/frames");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./js/frames.js", "./game.js"];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(250);

  /* 规格：与 G.MOUSE_ANIM 对齐。state 映射：
     side.run  -> dart  (moving，跑动相位)
     side.peek -> peek  (idle，探头)
     top.run   -> scurry
     top.pause -> pause */
  const SPECS = [
    { out: "mouse_run.png",       view: "side", state: "dart",   frames: 8, fps: 12, w: 120, h: 78,  variant: 0 },
    { out: "mouse_peek.png",      view: "side", state: "peek",   frames: 6, fps: 8,  w: 120, h: 78,  variant: 0 },
    { out: "mousetop_run.png",    view: "top",  state: "scurry", frames: 8, fps: 12, w: 120, h: 100, variant: 0 },
    { out: "mousetop_pause.png",  view: "top",  state: "pause",  frames: 4, fps: 6,  w: 120, h: 100, variant: 0 }
  ];

  const results = [];
  for (const s of SPECS) {
    const dataUrl = await page.evaluate(async (spec) => {
      const G = window.G;
      const scale = 3;   // 超采样：设计尺寸 ×3 渲染再缩回，边缘更顺滑
      const fw = spec.w, fh = spec.h;
      const sheet = document.createElement("canvas");
      sheet.width = fw * spec.frames; sheet.height = fh;
      const sctx = sheet.getContext("2d");
      const v = G.MOUSE_VARIANTS[spec.variant];

      for (let i = 0; i < spec.frames; i++) {
        // 每帧采样一个时间点（循环跑动取一周期内均布相位；探头取缓慢推进相位）
        const t = spec.fps ? (i / spec.fps) : i * 0.15;
        // 离屏单帧画布（透明底），按设计尺寸×scale 渲染
        const cv = document.createElement("canvas");
        cv.width = fw * scale; cv.height = fh * scale;
        const ctx = cv.getContext("2d");
        ctx.scale(scale, scale);
        const p = { state: spec.state, phase: 0, mouseVar: v };
        if (spec.view === "side") G.draw.mouse(ctx, p, t);
        else G.draw.mouseTop(ctx, p, t);
        // 缩回设计尺寸贴到 sheet 对应帧位
        sctx.imageSmoothingEnabled = true;
        sctx.imageSmoothingQuality = "high";
        sctx.drawImage(cv, 0, 0, fw * scale, fh * scale, i * fw, 0, fw, fh);
      }
      return sheet.toDataURL("image/png");
    }, s);
    const buf = Buffer.from(dataUrl.split(",")[1], "base64");
    fs.writeFileSync(path.join(OUT, s.out), buf);
    results.push({ out: s.out, bytes: buf.length, frames: s.frames, size: s.w * s.frames + "x" + s.h });
  }

  await browser.close();
  console.log("=== 生成完成 ===");
  for (const r of results) console.log(`  ${r.out}  ${r.size}  ${r.frames}帧  ${(r.bytes/1024).toFixed(1)}KB`);
  if (errors.length) { console.log("页面错误:"); errors.forEach(e => console.log("  " + e)); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
