/* 俯视群鼠 scurry 渲染路径诊断：
   用户报告 room 开局倒计时鼠显示为"旧造型"（半透明豆形，无黑描边）。
   验证：
   1) MICEHD.video[k] 96 张 run 帧是否全部加载成功（ok=true）
   2) scurry 态 mouseTop 走 _mouseVideoTop（应返回 run 帧卡通鼠，有黑描边）
   3) 实际渲染截图对比：是否黑描边卡通鼠 vs 半透明豆形兜底
   跑法：node test/shot_mousetop_check.js */
const fs = require("fs");
const path = require("path");
const pc = require("/tmp/ffshot/node_modules/playwright-core");
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js","./js/rank.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--allow-file-access-from-files"]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));

  // 等 96 张 run 帧全部 ok（最多 25s）
  const loadStatus = await page.waitForFunction(() => {
    const HD = window.G && window.G.draw && window.G.draw.MICEHD;
    if (!HD || !HD.video) return { ready: false, total: 0, ok: 0, perKey: {} };
    let total = 0, okc = 0; const perKey = {};
    for (const k of Object.keys(HD.video)) {
      const arr = HD.video[k];
      total += arr.length;
      let okk = 0;
      for (const im of arr) if (im && im.ok) okk++;
      okc += okk; perKey[k] = okk + "/" + arr.length;
    }
    return { ready: okc === total && total > 0, total, ok: okc, perKey };
  }, { timeout: 25000, polling: 300 }).catch(e => ({ ready: false, error: String(e) }));

  // 诊断：scurry 态 mouseTop 渲染 6 花色，量 alpha 包围盒 + 截图
  const result = await page.evaluate(async () => {
    const G = window.G, HD = G.draw.MICEHD;
    const keys = ["house", "charcoal", "albino", "deer", "pup", "smoky"];
    const out = { perKey: {}, boxes: {}, errors: [] };
    try {
      // 1) video 加载状态
      out.videoStatus = {};
      for (const k of keys) {
        const arr = HD.video[k] || [];
        out.videoStatus[k] = arr.filter(im => im && im.ok).length + "/" + arr.length;
      }
      // 2) 渲染 6 花色 scurry 俯视鼠到网格画布
      const cw = 200, ch = 200, gap = 6;
      const W = keys.length * (cw + gap) + 12, H = ch + 40;
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      cv.style.cssText = "position:fixed;left:0;top:0;z-index:9999";
      document.body.appendChild(cv);
      const c = cv.getContext("2d");
      c.fillStyle = "#14161c"; c.fillRect(0, 0, W, H);  // 深色背景模拟 room 俯视
      const t = 1.2;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const x = 6 + i * (cw + gap), y = 6;
        c.fillStyle = "#1e222a"; c.fillRect(x, y, cw, ch);
        c.fillStyle = "#ffd77a"; c.font = "13px sans-serif";
        c.fillText(k, x + 8, y + 16);
        const p = {
          state: "scurry", vanishT: 0, phase: i * 0.7, _moveSp: 250,
          faceDir: 1, _visAng: 0.5 + i * 0.3,
          mouseVar: G.MOUSE_VARIANTS.find(v => v.key === k) || { key: k }
        };
        c.save();
        c.translate(x + cw / 2, y + ch / 2);
        c.rotate(Math.PI / 2);       // 外层 rotate（同 prey.js）
        c.translate(-60, -50);
        G.draw.mouseTop(c, p, t);
        c.restore();
        // 量 alpha 包围盒（子区域）
        const d = c.getImageData(x, y, cw, ch).data;
        let bx0 = cw, bx1 = -1, by0 = ch, by1 = -1, alphaPix = 0;
        for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) {
          const a = d[(yy * cw + xx) * 4 + 3];
          if (a > 8) {
            if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx;
            if (yy < by0) by0 = yy; if (yy > by1) by1 = yy;
            alphaPix++;
          }
        }
        out.boxes[k] = bx1 >= 0 ? { w: bx1 - bx0 + 1, h: by1 - by0 + 1, alpha: alphaPix,
          x0: bx0, x1: bx1, y0: by0, y1: by1 } : { empty: true };
        // 等一帧让 LUT/帧切换稳定
        await new Promise(r => setTimeout(r, 30));
      }
      out.canvasSize = { W, H };
    } catch (e) { out.errors.push(String(e)); }
    return out;
  });

  await page.waitForTimeout(120);
  await page.screenshot({
    path: path.join(OUT, "mousetop-scurry-check.png"),
    clip: { x: 0, y: 0, width: result.canvasSize ? result.canvasSize.W : 1280, height: result.canvasSize ? result.canvasSize.H : 240 }
  });

  console.log("== 俯视群鼠 scurry 渲染路径诊断 ==");
  console.log("run 帧加载:", JSON.stringify(loadStatus.perKey || loadStatus));
  console.log("video status:", JSON.stringify(result.videoStatus || {}));
  console.log("各花色包围盒:");
  for (const k of Object.keys(result.boxes || {})) {
    const b = result.boxes[k];
    console.log("  " + k + ":", b.empty ? "EMPTY(兜底?)" : `w=${b.w} h=${b.h} alpha=${b.alpha}`);
  }
  console.log("渲染错误:", (errors.length ? errors.slice(0, 3).join(" | ") : "none") +
    (result.errors.length ? " | eval: " + result.errors.join(";") : ""));
  await browser.close();
})().catch(e => { console.error("TEST FAILED:", e); process.exit(1); });
