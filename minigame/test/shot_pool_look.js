/* shot_pool_look.js — 暗夜萤光（萤火）按参考视频改造后的验收
   视频特征（已量化）：慢漂移 15–44% 屏宽/秒、亮度 1.9Hz 脉动、每 5–10 秒"熄灭→别处亮起"、
   命中炸成暖橙 + 青白小点、背景是压暗的枯草地。
   本脚本验：
   1) 背景是枯草地（暖褐、整体偏暗），且用离屏缓存（首帧慢、之后快）
   2) 漂移速度落在 30–60% 屏宽/秒
   3) 呼吸脉动：pulseK 在 1 秒内明显起伏
   4) 瞬移：fade 从 1 掉到 <0.35 再换点，且新点距原位置 > 40% 短边
   5) 命中：暖橙 + 冷色两种粒子都生成
   6) 阶段③ 5 只 / 横屏
   产物：screenshots/pool-*.png
*/
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "screenshots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOD_NAMES = [
  "./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/feeder.js", "./game.js"
];

async function open(browser, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/ERR_FILE_NOT_FOUND/.test(m.text())) errors.push(m.text()); });
  const modules = {};
  for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(400);
  return { page, errors };
}

async function startPool(page, preyCount) {
  await page.evaluate(n => {
    const G = window.G;
    G.config.targetType = "pool";
    G.config.preyCount = n || 3;
    G.config.infinite = true;
    G.layout = null;
    G.startGame();
  }, preyCount || 3);
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    if (await page.evaluate(() => window.G.screen === "playing")) return true;
    await page.waitForTimeout(50);
  }
  return false;
}

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });

  // ---------- 1. 竖屏：背景 + 漂移 + 脉动 ----------
  {
    const { page, errors } = await open(browser, 390, 844);
    await startPool(page, 3);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, "pool-1-field.png") });

    // 背景取样：应偏暗、偏暖（枯草地），不是旧版石板的灰蓝
    const bg = await page.evaluate(() => {
      const G = window.G;
      const d = G.platform.ctx.getImageData(30, 300, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], mean: Math.round((d[0] + d[1] + d[2]) / 3) };
    });

    // 漂移速度：累计路径长度（净位移会被缓慢转向吃掉，量出来偏小）
    const move = await page.evaluate(async () => {
      const G = window.G;
      const ps = G.preys.filter(q => q.type === "pool");
      const paths = ps.map(p => ({ p, path: 0, x: p.x, y: p.y }));
      const t0 = performance.now();
      while (performance.now() - t0 < 1000) {
        await new Promise(r => setTimeout(r, 32));
        paths.forEach(o => { o.path += Math.hypot(o.p.x - o.x, o.p.y - o.y); o.x = o.p.x; o.y = o.p.y; });
      }
      const dt = (performance.now() - t0) / 1000;
      const W = G.bounds().w;
      const sp = paths.map(o => o.path / dt).sort((a, b) => a - b);
      const med = sp[Math.floor(sp.length / 2)];        // 中位数：避开恰好贴边的那只
      return { speed: Math.round(med), pctScreen: Math.round(med / W * 100), all: sp.map(v => Math.round(v)) };
    });

    // 脉动：0.6 秒内 pulseK 的起伏
    const pulse = await page.evaluate(async () => {
      const G = window.G;
      const p = G.preys.find(q => q.type === "pool");
      let mn = 1, mx = 0;
      for (let i = 0; i < 30; i++) {
        mn = Math.min(mn, p.pulseK); mx = Math.max(mx, p.pulseK);
        await new Promise(r => setTimeout(r, 20));
      }
      return { min: +mn.toFixed(2), max: +mx.toFixed(2), range: +(mx - mn).toFixed(2) };
    });

    // 背景缓存收益：强制重建一次 vs 命中缓存 30 帧
    const perf = await page.evaluate(async () => {
      const G = window.G, ctx = G.platform.ctx;
      G.scene._grassSeed = 12345;                       // 换 seed → 触发重建
      let t0 = performance.now();
      G.drawScene(ctx, 1.0);
      const rebuild = Math.round((performance.now() - t0) * 10) / 10;
      t0 = performance.now();
      for (let i = 0; i < 30; i++) G.drawScene(ctx, 1 + i / 60);
      const warm = Math.round((performance.now() - t0) / 30 * 100) / 100;
      return { rebuild, warm };
    });

    console.log("背景取样:", JSON.stringify(bg), "（应为暖褐、mean<90）");
    console.log("漂移: 中位 " + move.speed + " px/s ≈ 屏宽 " + move.pctScreen + "%/秒（目标 30–60）| 各只 " + move.all.join("/"));
    console.log("脉动: pulseK " + pulse.min + "–" + pulse.max + "（幅度 " + pulse.range + "，应 >0.5）");
    console.log("背景: 重建 " + perf.rebuild + " ms（一次性） | 命中缓存 " + perf.warm + " ms/帧");
    console.log("竖屏 errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 2. 瞬移：熄灭 → 换点 → 亮起 ----------
  {
    const { page, errors } = await open(browser, 390, 844);
    await startPool(page, 3);
    await page.waitForTimeout(400);
    const tp = await page.evaluate(async () => {
      const G = window.G;
      const p = G.preys.find(q => q.type === "pool");
      const x0 = p.x, y0 = p.y;
      p.tpNext = 0;                                  // 立刻触发
      let minFade = 1;
      const t0 = performance.now();
      while (performance.now() - t0 < 1200) {
        minFade = Math.min(minFade, p.fade);
        if (p.fade < 0.35) break;
        await new Promise(r => setTimeout(r, 16));
      }
      const midFade = p.fade, midPos = { x: p.x, y: p.y };
      await new Promise(r => setTimeout(r, 500));
      const b = G.bounds();
      return {
        minFade: +minFade.toFixed(2),
        midFade: +midFade.toFixed(2),
        moved: Math.round(Math.hypot(p.x - x0, p.y - y0)),
        farEnough: Math.hypot(p.x - x0, p.y - y0) > Math.min(b.w, b.h) * 0.40,
        endFade: +p.fade.toFixed(2),
        midPos
      };
    });
    await page.screenshot({ path: path.join(OUT, "pool-2-after-hop.png") });
    console.log("瞬移: 最低 fade=" + tp.minFade + " → 换点距离 " + tp.moved + "px（>40% 短边: " + tp.farEnough +
      "）→ 结束 fade=" + tp.endFade);
    console.log("瞬移 errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 3. 命中特效 + 特写 ----------
  {
    const { page, errors } = await open(browser, 390, 844);
    await startPool(page, 1);
    await page.waitForTimeout(500);
    // 特写：把萤火挪到画面中央再截
    await page.evaluate(() => {
      const G = window.G;
      const p = G.preys.find(q => q.type === "pool");
      const b = G.bounds();
      p.x = b.x + b.w / 2; p.y = b.y + b.h * 0.45;
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(OUT, "pool-3-feature.png"), clip: { x: 60, y: 290, width: 270, height: 240 } });

    const hit = await page.evaluate(async () => {
      const G = window.G;
      const p = G.preys.find(q => q.type === "pool");
      G.fx.clear();
      G.onHit(p.x, p.y, p);
      const warm = G.fx.droplets.filter(d => d.c1 === "#ffb347").length;
      const cool = G.fx.droplets.filter(d => d.c1 === "#7fe9ff").length;
      return { warm, cool, rings: G.fx.shockwaves.length, hits: G.session.hits };
    });
    await page.waitForTimeout(85);
    await page.screenshot({ path: path.join(OUT, "pool-4-hit.png") });
    console.log("命中: 暖橙粒子 " + hit.warm + " / 青白粒子 " + hit.cool + " / 冲击环 " + hit.rings + " / 计分 " + hit.hits);
    console.log("特效 errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 4. 阶段③ + 横屏 ----------
  {
    const { page, errors } = await open(browser, 390, 844);
    await startPool(page, 5);
    await page.evaluate(() => {
      const G = window.G;
      G.stageNow = () => 3;
      G.session.stage = 3;
      G.topUpPreys();                                  // 按阶段③补到 5 只
    });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, "pool-5-stage3.png") });
    const n3 = await page.evaluate(() => window.G.preys.filter(p => p.type === "pool").length);
    console.log("阶段③: 萤火 " + n3 + " 只");
    console.log("阶段③ errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }
  {
    const { page, errors } = await open(browser, 852, 393);
    await startPool(page, 3);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, "pool-6-landscape.png") });
    console.log("横屏 errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  await browser.close();
  console.log("DONE ->", OUT);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
