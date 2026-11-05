/* 按用户提供的三张实拍截图复现三种猎物，并生成「参考 vs 实现」对照素材。
   跑法：node test/shot_ff_refs.js
   说明：截图 1/2 是枯草地（theme 0），截图 3 是深蓝龟裂地（theme 1）。
   为了对照干净，只留第一只猎物，其余 fade=0。 */
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
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "pool"; G.config.preyCount = 3; G.config.infinite = true;
    G.layout = null; G.startGame();
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    if (await page.evaluate(() => window.G.screen === "playing")) break;
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(400);

  const specs = [
    ["dog", 0, "ref-1-dog"],
    ["mouse", 0, "ref-2-mouse"],
    ["ladybug", 1, "ref-3-ladybug"]
  ];
  for (const [sp, theme, name] of specs) {
    await page.evaluate(({ sp, theme }) => {
      const G = window.G;
      G.scene.poolTheme = theme; G.scene.poolShift = null;
      G.preys.forEach((q, i) => { q.fade = i === 0 ? 1 : 0; q.vanishT = 0; });
      const p = G.preys[0];
      p.species = sp;
      p.x = G.bounds().x + G.bounds().w / 2;
      p.y = G.bounds().y + G.bounds().h * 0.42;
      p.fade = 1; p.pulseK = 0.8; p.stepK = 1.2;
      G.session.running = false;
    }, { sp, theme });
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(OUT, name + ".png") });
  }

  // 阶段③ 三种同屏：固定到三个位置，方便裁图逐一核对
  const mixed = await page.evaluate(() => {
    const G = window.G;
    G.session.running = true;
    G.scene.poolTheme = 0; G.scene.poolShift = null;
    const b = G.bounds();
    const spots = [[0.5, 0.26], [0.28, 0.52], [0.72, 0.6]];
    G.preys.forEach((q, i) => { q.fade = i < 3 ? 1 : 0; q.vanishT = 0; q.darkT = 0; q.tp = null; });
    const three = G.preys.slice(0, 3);
    const keys = ["dog", "mouse", "ladybug"];
    three.forEach((q, i) => {
      const toy = (G.FF_TOYS || []).find(t => t.key === keys[i]);
      if (toy && q.applyToy) q.applyToy(toy); else q.species = keys[i];
      q.x = b.x + b.w * spots[i][0];
      q.y = b.y + b.h * spots[i][1];
    });
    G.session.running = false;
    return three.map(q => ({ sp: q.species, x: Math.round(q.x), y: Math.round(q.y) }));
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "ref-4-mixed.png") });
  console.log("同屏位置:", JSON.stringify(mixed));

  console.log("三物种 + 同屏截图完成 | errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
