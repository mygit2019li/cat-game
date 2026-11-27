/* vseq 三段新动画（fast/look/sit）接入验证：
   1) 确认 3 张基准 sheet 加载成功（MICEHD.vseq[seg].base.ok）
   2) 触发 _vseqEnsure 为 3段×6花色 全部构建离屏着色画布，验证无报错、画布尺寸正确
   3) 渲染假鼠：侧视 dart(快跑)/peek(东张西望)/hole(洞内) + 俯视 pause(坐下)/scurry(慢跑)
   跑法：node test/shot_vseq_check.js */
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
    /* file:// 下 getImageData 会因跨源污染报错（微信端本地包无此限制），放行 file 访问 */
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

  // 等 3 张 vseq 基准 sheet 全部加载（ok=true）
  await page.waitForFunction(() => {
    const D = window.G && window.G.draw;
    const v = D && D.MICEHD && D.MICEHD.vseq;
    return v && v.fast && v.look && v.sit &&
      v.fast.base && v.fast.base.ok &&
      v.look.base && v.look.base.ok &&
      v.sit.base && v.sit.base.ok;
  }, { timeout: 20000 }).catch(() => {});

  // 触发全部 3段×6花色 的离屏着色画布构建，收集结果
  const rec = await page.evaluate(async () => {
    const G = window.G;
    const D = G.draw;
    const HD = D.MICEHD;
    const keys = ["house","charcoal","albino","deer","pup","smoky"];
    const segs = ["fast","look","sit"];
    // 强制节流窗口过期，让每张都能构建（直接改内部不便，用 t 递增触发）
    const out = { base: {}, canv: {}, dims: {}, lutLen: null };
    try {
      // LUT 长度（内部函数不可直接访问，用画布反推：读一个像素的 LUT 映射不方便，改看构建是否成功）
    } catch (e) {}
    let t = 1;   // 递增 t 绕开 30ms 构建节流（每对 (seg,花色) 间隔 0.1s）
    for (const seg of segs) {
      out.base[seg] = !!(HD.vseq[seg] && HD.vseq[seg].base && HD.vseq[seg].base.ok);
      out.canv[seg] = {};
      out.dims[seg] = {};
      for (const k of keys) {
        const ti = t; t += 0.1;
        // 渲染法：建一个假鼠并调 G.draw.mouse / mouseTop 触发 _vseqEnsure
        // mouseVar 用真实变体对象（含完整颜色字段，_mousePalette 需要）
        const mv = G.MOUSE_VARIANTS.find(v => v.key === k) || { key: k };
        const p = { state: seg === "sit" ? "pause" : (seg === "fast" ? "dart" : "peek"),
                    vanishT: 0, phase: 0, _moveSp: 300, faceDir: 1, _visAng: 0,
                    mouseVar: mv };
        const cv = document.createElement("canvas");
        cv.width = 140; cv.height = 90;
        const c = cv.getContext("2d");
        // 侧视 fast/look：G.draw.mouse
        if (seg !== "sit") {
          c.save(); c.translate(70, 45); G.draw.mouse(c, p, ti); c.restore();
        } else {
          // 俯视 sit：G.draw.mouseTop
          c.save(); c.translate(70, 45); c.translate(-60, -50);
          G.draw.mouseTop(c, p, ti); c.restore();
        }
        const ok = cv.toDataURL().length > 1000;   // 有像素输出
        out.canv[seg][k] = ok;
        // 检查 MICEHD.vseq[seg].canv[k] 是否被缓存
        out.dims[seg][k] = (HD.vseq[seg] && HD.vseq[seg].canv[k]) ?
          { w: HD.vseq[seg].canv[k].width, h: HD.vseq[seg].canv[k].height } : null;
      }
    }
    return out;
  });

  // 渲染展示画：3 段 × 6 花色 的网格（每格一个 recolor 后的假鼠）
  const grid = await page.evaluate(() => {
    const G = window.G;
    const keys = ["house","charcoal","albino","deer","pup","smoky"];
    const segs = [["fast","dart","mouse"],["look","peek","mouse"],["sit","pause","mouseTop"]];
    const cw = 200, ch = 150, pad = 6, labelH = 20;
    const W = 40 + keys.length * (cw + pad), H = 40 + segs.length * (ch + labelH + pad);
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    cv.style.cssText = "position:fixed;left:0;top:0;z-index:9999";
    document.body.appendChild(cv);
    const c = cv.getContext("2d");
    c.fillStyle = "#1c2027"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#fff"; c.font = "16px sans-serif";
    keys.forEach((k, ci) => c.fillText(k, 40 + ci * (cw + pad) + cw / 2 - 20, 26));
    segs.forEach(([seg, state, fn], ri) => {
      const y0 = 40 + ri * (ch + labelH + pad);
      c.fillStyle = "#ffd77a"; c.font = "16px sans-serif";
      c.fillText(seg, 6, y0 + ch / 2);
      keys.forEach((k, ci) => {
        const x = 40 + ci * (cw + pad), y = y0;
        c.fillStyle = "#232830"; c.fillRect(x, y, cw, ch);
        const mv = G.MOUSE_VARIANTS.find(v => v.key === k) || { key: k };
        const p = { state, vanishT: 0, phase: k.length, _moveSp: 300, faceDir: 1, _visAng: 0,
                    mouseVar: mv };
        c.save();
        if (fn === "mouse") { c.translate(x + cw / 2, y + ch / 2 + 5); }
        else { c.translate(x + cw / 2, y + ch / 2); c.translate(-60, -50); }
        if (fn === "mouse") G.draw.mouse(c, p, 0.6);
        else G.draw.mouseTop(c, p, 0.6);
        c.restore();
      });
    });
    return { W, H };
  });

  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, "vseq-check.png"), clip: { x: 0, y: 0, width: grid.W, height: grid.H } });
  console.log("== vseq 验证 ==");
  console.log("基准 sheet 加载:", JSON.stringify(rec.base));
  console.log("着色画布构建(6x3):", JSON.stringify(rec.canv));
  console.log("画布尺寸(首花色):", "fast.house=" + JSON.stringify(rec.dims.fast && rec.dims.fast.house),
    " look.house=" + JSON.stringify(rec.dims.look && rec.dims.look.house),
    " sit.house=" + JSON.stringify(rec.dims.sit && rec.dims.sit.house));
  console.log("渲染错误:", errors.length ? errors.slice(0, 5).join(" | ") : "none");
  await browser.close();
})().catch(e => { console.error("TEST FAILED:", e); process.exit(1); });
