/* 暗夜萤光（萤火虫）验收：造型 / 步态 / 张翅 / 命中特效 / 音效
   跑法：node test/shot_firefly.js  → screenshots/firefly-*.png + 控制台断言 */
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = "/Users/lipeng/www/weixin/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/feeder.js", "./game.js"];      // game.js 在根目录

async function open(browser, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(400);
  return { page, errors };
}

async function startPool(page, count, infinite) {
  await page.evaluate(({ count, infinite }) => {
    const G = window.G;
    G.config.targetType = "pool";
    G.config.preyCount = count;
    G.config.infinite = infinite;
    G.layout = null;
    G.startGame();
  }, { count, infinite });
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    if (await page.evaluate(() => window.G.screen === "playing")) break;
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(600);
}

(async () => {
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });

  // ---------- 1. 竖屏：全景 + 特写 + 张翅 + 命中 ----------
  {
    const { page, errors } = await open(browser, 390, 844);
    await startPool(page, 3, true);
    await page.screenshot({ path: path.join(OUT, "firefly-1-field.png") });

    // 特写：把猎物挪到画面中央并放大截图
    const info = await page.evaluate(() => {
      const G = window.G;
      const p = G.preys.find(q => q.type === "pool");
      p.x = G.bounds().x + G.bounds().w / 2;
      p.y = G.bounds().y + G.bounds().h * 0.42;
      p.pulseK = 0.85; p.elytraK = 0.32; p.stepK = 1.2;
      G.session.running = false;      // 冻结逻辑，只渲染，保证截图稳定
      return { x: p.x, y: p.y, r: (30 * (G.platform.S || 1)) };
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, "firefly-2-closeup.png") });

    // 张翅（鞘翅全开）
    await page.evaluate(() => {
      const p = window.G.preys.find(q => q.type === "pool");
      p.elytraK = 0.95;
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(OUT, "firefly-3-flare.png") });

    // ---------- 三种猎物：逐个摆到画面中央截图 ----------
    const speciesShots = await page.evaluate(async () => {
      const G = window.G;
      const out = [];
      const place = (sp) => {
        const p = G.preys.find(q => q.type === "pool");
        const toy = (G.FF_TOYS || []).find(t => t.key === sp);
        if (toy && p.applyToy) p.applyToy(toy); else p.species = sp;
        p.x = G.bounds().x + G.bounds().w / 2;
        p.y = G.bounds().y + G.bounds().h * 0.42;
        p.pulseK = 0.85; p.stepK = 1.2; p.fade = 1;
        p.elytraK = 0.32;
        G.session.running = false;
      };
      for (const sp of ["dog", "mouse", "ladybug"]) {
        place(sp);
        await new Promise(r => setTimeout(r, 130));
        out.push(sp);
      }
      return out;
    });
    // 每种单独截（上面循环最后停在 ladybug，所以按顺序分别截）
    for (const [i, sp] of [["8", "dog"], ["9", "mouse"], ["10", "ladybug"]]) {
      await page.evaluate((sp2) => {
        const G = window.G;
        const p = G.preys.find(q => q.type === "pool");
        const toy2 = (G.FF_TOYS || []).find(t => t.key === sp2);
        if (toy2 && p.applyToy) p.applyToy(toy2); else p.species = sp2;
        p.x = G.bounds().x + G.bounds().w / 2;
        p.y = G.bounds().y + G.bounds().h * 0.42;
        p.fade = 1; p.pulseK = 0.85; p.stepK = 1.2;
        p.elytraK = 0.32;
      }, sp);
      await page.waitForTimeout(120);
      await page.screenshot({ path: path.join(OUT, `firefly-species-${i}-${sp}.png`) });
    }
    await page.evaluate(() => { window.G.session.running = true; });

    // ---------- 行为断言（重新开一局，恢复运行） ----------
    await page.evaluate(() => { window.G.session.running = true; });
    const beh = await page.evaluate(async () => {
      const G = window.G;
      const ps = G.preys.filter(q => q.type === "pool");
      // 采样 2.5 秒：速度 / 步态相位 / 鞘翅开合 / 位移
      const track = ps.map(p => ({ p, x: p.x, y: p.y, path: 0, maxSpd: 0, minSpd: 1e9,
                                   openMin: 9, openMax: -9, step0: p.stepK }));
      const t0 = performance.now();
      let last = t0;
      const tier = { slow: 0, fast: 0, other: 0 };
      while (performance.now() - t0 < 2500) {
        await new Promise(r => setTimeout(r, 30));
        const now = performance.now(), dt = (now - last) / 1000; last = now;
        track.forEach(o => {
          const d = Math.hypot(o.p.x - o.x, o.p.y - o.y);
          o.path += d; o.x = o.p.x; o.y = o.p.y;
          const v = d / Math.max(dt, 1e-3);
          o.maxSpd = Math.max(o.maxSpd, v); o.minSpd = Math.min(o.minSpd, v);
          o.openMin = Math.min(o.openMin, o.p.elytraK); o.openMax = Math.max(o.openMax, o.p.elytraK);
          if (o.p.fade !== 1) tier.other += dt;
          else if (o.p.fast) tier.fast += dt;
          else tier.slow += dt;
        });
      }
      const dur = (performance.now() - t0) / 1000;
      const W = G.bounds().w;
      return {
        n: ps.length,
        speeds: track.map(o => Math.round(o.path / dur)),
        pct: track.map(o => Math.round(o.path / dur / W * 100)),
        maxPct: Math.max(...track.map(o => Math.round(o.maxSpd / W * 100))),
        open: track.map(o => [Math.round(o.openMin * 100) / 100, Math.round(o.openMax * 100) / 100]),
        stepAdvanced: track.map(o => Math.round(o.p.stepK - o.step0)),
        flareSeen: track.some(o => o.openMax > 0.8),
        gaitSeen: tier.slow > 0.4 && tier.fast > 0.4,
        tierTime: [Math.round(tier.slow * 10) / 10, Math.round(tier.fast * 10) / 10],
        fadeOk: ps.every(p => p.fade >= 0 && p.fade <= 1),
        moveK: track.map(o => Math.round(o.p.moveK * 100) / 100)
      };
    });

    // ---------- 命中：特效 + 音效 ----------
    const hit = await page.evaluate(() => {
      const G = window.G;
      G._sfx = [];
      const orig = G.platform.sfx.bind(G.platform);
      G.platform.sfx = (s, v) => { G._sfx.push(s.split("/").pop()); return orig(s, v); };
      const p = G.preys.find(q => q.type === "pool");
      const before = { droplets: G.fx.droplets.length, waves: G.fx.shockwaves.length };
      G.onHit(p.x, p.y, p);
      const after = { droplets: G.fx.droplets.length, waves: G.fx.shockwaves.length };
      return {
        played: G._sfx.slice(),
        added: { droplets: after.droplets - before.droplets, waves: after.waves - before.waves },
        hits: G.session.hits, vanishT: Math.round(p.vanishT * 100) / 100
      };
    });
    await page.waitForTimeout(85);
    await page.screenshot({ path: path.join(OUT, "firefly-4-hit.png") });

    // 预取检查
    const preload = await page.evaluate(() => {
      const G = window.G;
      G.preloadFireflySfx();
      return Object.keys(G.platform.sfxPool || {}).filter(k => k.indexOf("firefly") >= 0);
    });

    console.log("=== 造型/步态 ===");
    console.log("同屏", beh.n, "只 | 速度", beh.speeds.join("/"), "px/s =", beh.pct.join("/"), "% 屏宽/s | 峰值", beh.maxPct, "%");
    console.log("鞘翅开合区间", JSON.stringify(beh.open), "| 见到张翅", beh.flareSeen);
    console.log("步态两档（慢爬/急爬各自秒数 " + beh.tierTime.join("/") + "）", beh.gaitSeen, "| moveK", beh.moveK.join("/"));
    console.log("步态相位推进", beh.stepAdvanced.join("/"));
    console.log("=== 命中 ===");
    console.log("音效", JSON.stringify(hit.played), "| 粒子 +", JSON.stringify(hit.added), "| 命中数", hit.hits, "| 收光", hit.vanishT);
    const dist = await page.evaluate(() => {
      // 被拍重生会换一种动物：直接跑 120 次 relocate(true) 看三种是否都能抽到
      const G = window.G;
      const p = G.preys.find(q => q.type === "pool");
      const seen = {};
      for (let i = 0; i < 120; i++) {
        p.relocate(true);
        seen[p.species] = (seen[p.species] || 0) + 1;
      }
      return { seen, toys: (G.FF_TOYS || []).map(t => t.key) };
    });
    console.log("预取", JSON.stringify(preload));
    console.log("重生换种分布", JSON.stringify(dist.seen), "| FF_TOYS", dist.toys.join("/"));
    console.log("运行时错误:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 2. 阶段③ 五只 + 横屏 ----------
  {
    const { page, errors } = await open(browser, 390, 844);
    await startPool(page, 3, true);
    await page.evaluate(() => {
      const G = window.G;
      G.stageNow = () => 3;
      G.session.stage = 3;
      G.topUpPreys();
    });
    await page.waitForTimeout(900);
    const n3 = await page.evaluate(() => window.G.preys.filter(p => p.type === "pool").length);
    await page.screenshot({ path: path.join(OUT, "firefly-5-stage3.png") });
    console.log("阶段③ 同屏", n3, "只 | 错误:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }
  {
    const { page, errors } = await open(browser, 852, 393);
    await startPool(page, 3, true);
    await page.screenshot({ path: path.join(OUT, "firefly-6-landscape.png") });
    console.log("横屏 错误:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  await browser.close();
  console.log("DONE ->", OUT);
})();
