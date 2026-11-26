/* 确认 dispatch 实际走哪条路径：scurry 俯视鼠渲染截图
   预期：_mouseVideoTop 命中（run 帧已加载）→ 黑描边卡通鼠
   若显示半透明豆形 → 走兜底（真机某环节不同）*/
const fs = require("fs");
const path = require("path");
const pc = require("/tmp/ffshot/node_modules/playwright-core");
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
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
  await page.waitForTimeout(4000);

  const result = await page.evaluate(async () => {
    const G = window.G, HD = G.draw.MICEHD;
    const keys = ["house", "charcoal", "albino", "deer", "pup", "smoky"];
    const out = { videoOk: {}, boxes: {}, errors: [] };
    try {
      for (const k of keys) {
        const arr = HD.video[k] || [];
        out.videoOk[k] = arr.filter(im => im && im.ok).length + "/" + arr.length;
      }
      const cw = 200, ch = 200, gap = 6;
      const W = keys.length * (cw + gap) + 12, H = ch + 44;
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      cv.style.cssText = "position:fixed;left:0;top:0;z-index:9999";
      document.body.appendChild(cv);
      const c = cv.getContext("2d");
      c.fillStyle = "#14161c"; c.fillRect(0, 0, W, H);
      const t = 1.2;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const x = 6 + i * (cw + gap), y = 8;
        c.fillStyle = "#1e222a"; c.fillRect(x, y, cw, ch);
        c.fillStyle = "#ffd77a"; c.font = "14px sans-serif"; c.fillText(k, x + 8, y + 18);
        const p = {
          state: "scurry", vanishT: 0, phase: i * 0.7, _moveSp: 250,
          faceDir: 1, _visAng: 0.5 + i * 0.3,
          mouseVar: G.MOUSE_VARIANTS.find(v => v.key === k) || { key: k }
        };
        c.save();
        c.translate(x + cw / 2, y + ch / 2);
        c.rotate(Math.PI / 2);
        c.translate(-60, -50);
        G.draw.mouseTop(c, p, t);
        c.restore();
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
        out.boxes[k] = bx1 >= 0 ? { w: bx1 - bx0 + 1, h: by1 - by0 + 1, alpha: alphaPix } : { empty: true };
        await new Promise(r => setTimeout(r, 30));
      }
      out.canvasSize = { W, H };
    } catch (e) { out.errors.push(String(e)); }
    return out;
  });

  await page.waitForTimeout(150);
  await page.screenshot({
    path: path.join(OUT, "mousetop-scurry-v2.png"),
    clip: { x: 0, y: 0, width: result.canvasSize.W, height: result.canvasSize.H }
  });

  console.log("== 俯视 scurry 渲染确认 ==");
  console.log("run 帧:", JSON.stringify(result.videoOk));
  for (const k of Object.keys(result.boxes)) {
    const b = result.boxes[k];
    console.log("  " + k + ":", b.empty ? "EMPTY" : `w=${b.w} h=${b.h} alpha=${b.alpha}`);
  }
  console.log("错误:", errors.length ? errors.slice(0, 3).join(" | ") : "none",
    result.errors.length ? "| eval: " + result.errors.join(";") : "");
  await browser.close();
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
