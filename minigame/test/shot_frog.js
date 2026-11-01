/* shot_frog.js — 青蛙跳玩法验收
   1) 荷塘场景 / 荷叶数量 / 青蛙不共用荷叶
   2) 触摸命中（走真实触摸路由，不是直接调 onHit）+ 空中截击 +2
   3) 被拍后换荷叶重生
   4) 阶段③ 最多 2 连跳
   5) 单只模式 / 无限模式 / 横屏兼容
   产物：screenshots/frog-*.png */
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "screenshots");
fs.mkdirSync(OUT, { recursive: true });
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

async function startFrog(page, extra) {
  await page.evaluate(cfg => {
    const G = window.G;
    G.config.targetType = "frog";
    G.config.preyCount = cfg.preyCount || 3;
    G.config.infinite = !!cfg.infinite;
    G.layout = null;
    G.startGame();
  }, extra || {});
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) {
    const sc = await page.evaluate(() => window.G.screen);
    if (sc === "playing") return true;
    await page.waitForTimeout(50);
  }
  return false;
}

async function waitState(page, state, timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate(s => (window.G.preys || []).some(p => p.type === "frog" && p.fState === s), state);
    if (ok) return true;
    await page.waitForTimeout(35);
  }
  return false;
}

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });

  // ---------- 1. 竖屏基准：场景 / 腾空 / 触摸命中 ----------
  const { page, errors } = await open(browser, 390, 844);
  await startFrog(page);
  const base = await page.evaluate(() => {
    const G = window.G;
    const frogs = G.preys.filter(p => p.type === "frog");
    return {
      pads: (G.scene.pads || []).length,
      frogs: frogs.length,
      distinctPad: new Set(frogs.map(f => f.padIdx)).size,
      states: frogs.map(f => f.fState)
    };
  });
  console.log("场景:", JSON.stringify(base));
  await page.screenshot({ path: path.join(OUT, "frog-1-pond.png") });

  // 腾空瞬间截图
  const leap = await waitState(page, "leap", 5000);
  await page.screenshot({ path: path.join(OUT, "frog-2-leap.png") });

  // 走真实触摸路由：换算到虚拟坐标后按压腾空中的青蛙
  const touchHit = await page.evaluate(() => {
    const G = window.G;
    const f = G.preys.find(p => p.type === "frog" && p.fState === "leap");
    if (!f) return { skip: true };
    const S = G.platform.S || 1;
    const before = { hits: G.session.hits, bonus: G.session.bonusHits };
    const yy = f.y - (f.jumpH || 0);
    G.platform.onTouchStart({ touches: [{ clientX: f.x * S, clientY: yy * S }] });
    return { before, after: { hits: G.session.hits, bonus: G.session.bonusHits }, wasLeap: true };
  });
  console.log("触摸空中截击:", JSON.stringify(touchHit));
  await page.waitForTimeout(90);
  await page.screenshot({ path: path.join(OUT, "frog-3-hit.png") });

  // 重生换叶
  const respawn = await page.evaluate(async () => {
    const G = window.G;
    const dead = G.preys.find(p => p.type === "frog" && p.vanishT > 0)
              || G.preys.find(p => p.type === "frog" && p.rspT > 0);
    if (!dead) return { skip: true };
    const before = dead.padIdx;
    await new Promise(r => setTimeout(r, 1700));
    return { fState: dead.fState, padBefore: before, padAfter: dead.padIdx, fade: dead.fade };
  });
  console.log("重生:", JSON.stringify(respawn));

  // 阶段③：连跳最多 2 次（chain 只到 1）
  const chain = await page.evaluate(async () => {
    const G = window.G;
    G.stageNow = () => 3;
    G.session.stage = 3;
    let maxChain = 0, jumps = 0, prevPad = -1;
    const t0 = performance.now();
    while (performance.now() - t0 < 9000) {
      G.preys.forEach(p => {
        if (p.type !== "frog") return;
        maxChain = Math.max(maxChain, p.chain || 0);
        if (p.fState === "leap" && p.padIdx === p.targetPadIdx) jumps++;
      });
      await new Promise(r => setTimeout(r, 30));
    }
    return { maxChain, pads: (G.scene.pads || []).length, frogN: G.preys.filter(p => p.type === "frog").length };
  });
  console.log("阶段③:", JSON.stringify(chain));
  await page.screenshot({ path: path.join(OUT, "frog-5-stage3.png") });
  console.log("竖屏 errors:", errors.length ? errors.join(" | ") : "none");
  await page.close();

  // ---------- 2. 单只模式 ----------
  {
    const { page: p2, errors: e2 } = await open(browser, 390, 844);
    await startFrog(p2, { preyCount: 1 });
    const single = await p2.evaluate(() => {
      const G = window.G;
      return { frogs: G.preys.filter(p => p.type === "frog").length, stageCount: G.stageTargetCount() };
    });
    console.log("单只模式:", JSON.stringify(single));
    await p2.screenshot({ path: path.join(OUT, "frog-6-single.png") });
    console.log("单只 errors:", e2.length ? e2.join(" | ") : "none");
    await p2.close();
  }

  // ---------- 3. 无限模式 ----------
  {
    const { page: p3, errors: e3 } = await open(browser, 390, 844);
    await startFrog(p3, { infinite: true });
    await p3.waitForTimeout(1500);
    const inf = await p3.evaluate(() => ({
      infinite: !!window.G.session.infinite,
      remain: window.G.session.remaining,
      frogN: window.G.preys.filter(p => p.type === "frog").length
    }));
    console.log("无限模式:", JSON.stringify(inf));
    console.log("无限 errors:", e3.length ? e3.join(" | ") : "none");
    await p3.close();
  }

  // ---------- 4. 横屏：首页卡片 + 对局 ----------
  {
    const { page: p4, errors: e4 } = await open(browser, 852, 393);
    await p4.waitForTimeout(400);
    await p4.screenshot({ path: path.join(OUT, "frog-4-home-land.png") });
    await startFrog(p4);
    await p4.waitForTimeout(600);
    const land = await p4.evaluate(() => ({
      pads: (window.G.scene.pads || []).length,
      frogN: window.G.preys.filter(p => p.type === "frog").length,
      onScreen: window.G.preys.every(p => p.x > 0 && p.x < window.G.platform.W)
    }));
    console.log("横屏对局:", JSON.stringify(land));
    await p4.screenshot({ path: path.join(OUT, "frog-7-land-play.png") });
    console.log("横屏 errors:", e4.length ? e4.join(" | ") : "none");
    await p4.close();
  }

  // ---------- 5. 腾空定格帧（冻结逻辑，只渲染：确认投影分离与抬头姿态） ----------
  {
    const { page: p5 } = await open(browser, 390, 844);
    await startFrog(p5);
    await p5.evaluate(() => {
      const G = window.G;
      const f = G.preys.find(p => p.type === "frog");
      const A = G.scene.pads[f.padIdx], B = G.scene.pads[f.targetPadIdx];
      if (A && B) {
        f.fState = "leap"; f.leapK = 0.5; f.fT = 0.36;
        f.x = (A.x + B.x) / 2; f.y = (A.y + B.y) / 2;
        f.jumpH = 66 * Math.pow(G.platform.S || 1, 0.5);
        f._visRot = 0; f._squash = 1.05;
      }
      G.session.running = false;      // 停逻辑、仍渲染
      G.session.paused = false;
    });
    await p5.waitForTimeout(120);
    await p5.screenshot({ path: path.join(OUT, "frog-8-air.png") });
    await p5.close();
  }

  await browser.close();
  console.log("DONE ->", OUT);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
