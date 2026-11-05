/* 暗夜萤光「视频特效/音效/动作」验收：换关火花、两套地面、出现噼啪、重生暗间隔
   跑法：node test/shot_firefly_fx.js */
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");
const ROOT = "/Users/lipeng/www/weixin/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/feeder.js", "./game.js"];

(async () => {
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "pool"; G.config.preyCount = 3; G.config.infinite = true;
    G.layout = null; G.startGame();
    G._sfx = [];
    const orig = G.platform.sfx.bind(G.platform);
    G.platform.sfx = (src, v) => { G._sfx.push(src.split("/").pop()); return orig(src, v); };
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    if (await page.evaluate(() => window.G.screen === "playing")) break;
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(500);

  // 主题 0
  await page.screenshot({ path: path.join(OUT, "ffx-1-theme0.png") });
  const before = await page.evaluate(() => ({
    theme: window.G.scene.poolTheme,
    shifted: window.G.scene._shiftDone,
    shower: window.G.fx.shower.length,
    embers: (window.G.scene.embers || []).length
  }));

  // 手动触发换关
  const shift = await page.evaluate(() => {
    const G = window.G;
    const ok = G.poolShiftTheme();
    return {
      ok, shower: G.fx.shower.length,
      sfx: G._sfx.slice(-2),
      from: G.scene.poolShift && G.scene.poolShift.from,
      to: G.scene.poolShift && G.scene.poolShift.to
    };
  });
  await page.waitForTimeout(160);
  await page.screenshot({ path: path.join(OUT, "ffx-2-sparks.png") });

  await page.waitForTimeout(1250);
  const after = await page.evaluate(() => ({
    theme: window.G.scene.poolTheme,
    shiftNull: window.G.scene.poolShift === null,
    shiftAgain: window.G.poolShiftTheme()
  }));
  await page.screenshot({ path: path.join(OUT, "ffx-3-theme1.png") });

  // 音效预取
  const preload = await page.evaluate(() => {
    const G = window.G; G.preloadFireflySfx();
    return Object.keys(G.platform.sfxPool || {}).filter(k => k.indexOf("firefly") >= 0).length;
  });

  // 拍中 → 暗间隔 → 亮起（含出现音）
  const respawn = await page.evaluate(async () => {
    const G = window.G;
    const p = G.preys.find(q => q.type === "pool");
    G._sfx.length = 0;
    G.onHit(p.x, p.y, p);
    const samples = [];
    const start = performance.now();
    while (performance.now() - start < 1400) {
      await new Promise(r => setTimeout(r, 40));
      samples.push({ t: +( (performance.now() - start) / 1000 ).toFixed(2), fade: +p.fade.toFixed(2),
                     dark: +(p.darkT || 0).toFixed(2), tp: p.tp ? p.tp.phase : null });
    }
    return {
      vanish: p.vanishT, firstFade: samples[0].fade,
      darkPeak: Math.max(...samples.map(s => s.dark)),
      reappearAt: (samples.find(s => s.fade > 0.5 && s.t > 0.25) || {}).t,
      sfx: G._sfx.slice()
    };
  });

  console.log("=== 场景 ===");
  console.log("初始主题", before.theme, "| 余烬点", before.embers, "| 火花粒子", before.shower);
  console.log("换关:", JSON.stringify(shift));
  console.log("换关后:", JSON.stringify(after));
  console.log("四段音频预取:", preload);
  console.log("=== 动作/音效：拍中→暗间隔→重生 ===");
  console.log(JSON.stringify(respawn));
  console.log("运行时错误:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
