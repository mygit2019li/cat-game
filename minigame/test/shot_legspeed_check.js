/* 腿部步频 × 移动速度匹配验证（俯视群鼠 16 帧 run 循环）：
   1) 给假鼠设不同 _moveSp（真实位移速度 px/s：100/250/400），逐帧渲染 D.mouseTop，
      通过包装 ctx.drawImage 记录实际用到的 run 帧序号，统计单位时间的帧推进量 = 有效步频 fps；
   2) 断言：fps 随速度单调上升，且落在设计区间 [5,16]（100→≈6，250→≈10.5，400→≈16 封顶）；
   3) 断言：全程无 pageerror、渲染有像素输出。
   跑法：node test/shot_legspeed_check.js */
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

  // 等俯视 run 帧（house 花色 16 张）全部加载
  await page.waitForFunction(() => {
    const D = window.G && window.G.draw;
    const vd = D && D.MICEHD && D.MICEHD.video;
    return vd && vd.house && vd.house.length === 16 && vd.house.every(f => f && f.ok);
  }, { timeout: 25000 });

  const res = await page.evaluate(() => {
    const G = window.G;
    const D = G.draw;
    const HD = D.MICEHD;
    const mv = G.MOUSE_VARIANTS.find(v => v.key === "house");
    // 给 16 帧打 tag（frame index），包装 drawImage 记录每次实际绘制用的帧
    const recorded = [];
    HD.video.house.forEach((f, i) => { f.__tag = i; });
    const cv = document.createElement("canvas");
    cv.width = 160; cv.height = 120;
    const ctx = cv.getContext("2d");
    const realDI = ctx.drawImage.bind(ctx);
    ctx.drawImage = function (img, ...a) {
      if (img && typeof img.__tag === "number") recorded.push(img.__tag);
      return realDI(img, ...a);
    };
    const fake = (sp) => ({
      state: "scurry", vanishT: 0, phase: 0, faceDir: 1, _visAng: 0,
      _moveSp: sp, def: { speed: 125 }, mSpeed: 1, mouseVar: mv
    });
    // 逐帧模拟渲染 dt=1/60，时长 3s，统计帧推进量 → 有效 fps
    const runAt = (sp) => {
      recorded.length = 0;
      const p = fake(sp);
      const N = 180, dt = 1 / 60;
      for (let i = 1; i <= N; i++) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.save(); ctx.translate(80, 60); ctx.translate(-60, -50);
        D.mouseTop(ctx, p, i * dt);
        ctx.restore();
      }
      // 帧推进量：末帧相位 ≈ floor(累计)；用记录序列的总前进步数（含回绕）估算
      let adv = 0;
      for (let i = 1; i < recorded.length; i++) {
        let d = recorded[i] - recorded[i - 1];
        if (d < -8) d += 16;          // 回绕 15→0 记 +1
        if (d > 8) d -= 16;           // 回绕 0→15 记 -1（不应出现）
        adv += d;
      }
      const fpsEff = adv / 3;         // 3 秒推进帧数 / 3s
      // 首尾像素非空
      const nonEmpty = cv.toDataURL().length > 1000;
      return { fpsEff: +fpsEff.toFixed(2), framesUsed: new Set(recorded).size, nonEmpty };
    };
    const r = {};
    for (const sp of [100, 250, 400]) r[sp] = runAt(sp);
    return r;
  });

  // 展示画：3 速度 × 4 时刻 的 run 帧网格，肉眼确认步频差异
  const grid = await page.evaluate(() => {
    const G = window.G;
    const D = G.draw;
    const mv = G.MOUSE_VARIANTS.find(v => v.key === "house");
    const sps = [100, 250, 400];
    const cw = 180, ch = 120, pad = 6, lab = 22;
    const W = 40 + 4 * (cw + pad), H = 40 + sps.length * (ch + lab + pad);
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    cv.style.cssText = "position:fixed;left:0;top:0;z-index:9999";
    document.body.appendChild(cv);
    const c = cv.getContext("2d");
    c.fillStyle = "#1c2027"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#fff"; c.font = "15px sans-serif";
    ["t=0s","t=0.4s","t=0.8s","t=1.2s"].forEach((s, i) =>
      c.fillText(s, 40 + i * (cw + pad) + cw / 2 - 24, 26));
    sps.forEach((sp, ri) => {
      const y0 = 40 + ri * (ch + lab + pad);
      c.fillStyle = "#ffd77a"; c.font = "15px sans-serif";
      c.fillText("v=" + sp + "px/s", 6, y0 + ch / 2);
      [0, 0.4, 0.8, 1.2].forEach((tt, ci) => {
        const x = 40 + ci * (cw + pad);
        c.fillStyle = "#232830"; c.fillRect(x, y0, cw, ch);
        // 每格独立假鼠：dt 积分相位互不污染；预置积分相位到该时刻（单次调用 dt=0 不推进）
        const fpsE = Math.min(16, Math.max(5, 3 + sp * 0.03));
        const p = { state: "scurry", vanishT: 0, phase: 0, faceDir: 1, _visAng: 0,
                    _moveSp: sp, def: { speed: 125 }, mSpeed: 1, mouseVar: mv,
                    _mvPhTop: tt * fpsE, _mvLastTTop: tt };
        c.save(); c.translate(x + cw / 2, y0 + ch / 2); c.translate(-60, -50);
        D.mouseTop(c, p, tt);
        c.restore();
      });
    });
    return { W, H };
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, "legspeed-check.png"),
    clip: { x: 0, y: 0, width: grid.W, height: grid.H } });

  console.log("== 腿部步频 × 速度匹配验证（俯视 run 循环，有效 fps）==");
  console.log("v=100px/s  →", JSON.stringify(res["100"]), "（设计目标 ≈6.0）");
  console.log("v=250px/s  →", JSON.stringify(res["250"]), "（设计目标 ≈10.5）");
  console.log("v=400px/s  →", JSON.stringify(res["400"]), "（设计目标 ≈16 封顶）");
  const ok = res["100"].fpsEff < res["250"].fpsEff && res["250"].fpsEff < res["400"].fpsEff
    && res["100"].fpsEff >= 5 && res["400"].fpsEff <= 16.01
    && res["100"].nonEmpty && res["250"].nonEmpty && res["400"].nonEmpty;
  console.log("单调递增且在 [5,16] 区间:", ok ? "PASS" : "FAIL");
  console.log("pageerror:", errors.length ? errors.slice(0, 5).join(" | ") : "none");
  await browser.close();
  process.exit(ok && !errors.length ? 0 : 1);
})().catch(e => { console.error("TEST FAILED:", e); process.exit(1); });
