/* frames.js 导入层验证：
   1) 无帧资源 → 老鼠走程序化绘制（回退）正常、无报错；
   2) 注入一张 4 帧假 sheet（每帧一个色块+序号）→ frames.draw 能按时间切帧、中心对齐绘制。
   跑法：node test/shot_frames.js */
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
  "./js/frames.js", "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];

(async () => {
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(300);

  const dataUrl = await page.evaluate(() => {
    const G = window.G;
    const dpr = 2, CW = 720, CH = 600;
    const cv = document.createElement("canvas");
    cv.width = CW * dpr; cv.height = CH * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    const bg = ctx.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, "#1c2622"); bg.addColorStop(1, "#0e1512");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.font = "14px -apple-system, sans-serif";

    // —— 区块 A：回退（无帧）程序化绘制 ——
    ctx.fillText("A) 回退：程序化绘制（无帧资源）", 16, 26);
    const fake = { state: "dart", phase: 0.5, mouseVar: G.MOUSE_VARIANTS[1], def: { face: true }, faceDir: 1 };
    ctx.save(); ctx.translate(120, 120); ctx.scale(1.4, 1.4); ctx.translate(-60, -39);
    G.draw.mouse(ctx, fake, 0.6); ctx.restore();
    ctx.save(); ctx.translate(320, 120); ctx.scale(1.3, 1.3); ctx.translate(-60, -50);
    G.draw.mouseTop(ctx, { state: "scurry", phase: 1.1 }, 0.6); ctx.restore();

    // —— 区块 B：frames.js 切帧（侧视 side 120×78 + 俯视 top 120×100 两套注册表）——
    // 造 4 帧横向 sheet：侧视每帧 120×78，俯视每帧 120×100，色块不同 + 画帧号
    const makeSheet = (fw, fh, n) => {
      const c = document.createElement("canvas"); c.width = fw * n; c.height = fh;
      const g = c.getContext("2d");
      const cols = ["#ff7a6b", "#6bd6ff", "#9dff7a", "#ffd76b"];
      for (let i = 0; i < n; i++) {
        g.fillStyle = cols[i % 4]; g.fillRect(i * fw + 6, 8, fw - 12, fh - 16);
        g.fillStyle = "#fff"; g.font = "bold " + Math.floor(fh * 0.44) + "px sans-serif"; g.textAlign = "center";
        g.fillText(String(i + 1), i * fw + fw / 2, fh * 0.62);
      }
      return c;
    };
    const sideSheet = makeSheet(120, 78, 4);
    const topSheet = makeSheet(120, 100, 4);
    // 手动建 manifest 并塞入已加载的 sheet（绕过异步 loadImage），side / top 各一套
    G.frames.loadManifest({
      side: { design: { w: 120, h: 78 }, clips: {
        run:  { file: "x_run.png",  frames: 4, fps: 8, loop: true, ready: true, _img: sideSheet, frameW: 120, frameH: 78,  frameCount: 4 },
        peek: { file: "x_peek.png", frames: 4, fps: 8, loop: true, ready: true, _img: sideSheet, frameW: 120, frameH: 78,  frameCount: 4 }
      } },
      top: { design: { w: 120, h: 100 }, clips: {
        run:   { file: "x_t_run.png",   frames: 4, fps: 8, loop: true, ready: true, _img: topSheet, frameW: 120, frameH: 100, frameCount: 4 },
        pause: { file: "x_t_pause.png", frames: 4, fps: 8, loop: true, ready: true, _img: topSheet, frameW: 120, frameH: 100, frameCount: 4 }
      } }
    });

    const times = [0.0, 0.15, 0.3, 0.45];   // fps=8 → 0/1/2/3 帧
    // B1 侧视 side（run）
    ctx.fillText("B1) 侧视 side 切帧（120×78，随时间 1→4）", 16, 200);
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(120 + i * 160, 285); ctx.scale(1.4, 1.4); ctx.translate(-60, -39);
      const ok = G.frames.draw(ctx, "side", "run", times[i], 120, 78);
      ctx.restore();
      ctx.fillStyle = ok ? "#9dff7a" : "#ff6b6b"; ctx.font = "12px sans-serif";
      ctx.fillText(ok ? "ok frame " + (i + 1) : "FALLBACK", 120 + i * 160 - 26, 350);
    }
    // B2 俯视 top（run）
    ctx.fillText("B2) 俯视 top 切帧（120×100，随时间 1→4）", 16, 390);
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(120 + i * 160, 490); ctx.scale(1.3, 1.3); ctx.translate(-60, -50);
      const ok = G.frames.draw(ctx, "top", "run", times[i], 120, 100);
      ctx.restore();
      ctx.fillStyle = ok ? "#9dff7a" : "#ff6b6b"; ctx.font = "12px sans-serif";
      ctx.fillText(ok ? "ok frame " + (i + 1) : "FALLBACK", 120 + i * 160 - 26, 565);
    }
    return cv.toDataURL("image/png");
  });
  fs.writeFileSync(path.join(OUT, "frames-layer.png"), Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("frames 导入层验证 | errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
