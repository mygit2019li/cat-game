/* check_laser_count.js — 验证多只激光光点数随阶段递增（3→5→7），单只不变 */
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOD_NAMES = [
  "./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./game.js"
];

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 852, height: 393 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const modules = {};
  for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(300);

  const out = await page.evaluate(() => {
    const G = window.G;
    const res = {};
    // 多只激光：逐阶段校验
    G.config.targetType = "laser"; G.config.preyCount = 3;
    G.startGame();
    res.laserStage1 = G.preys.length;                   // 应为 3
    G.session.stage = 2; G.topUpPreys();
    res.laserStage2 = G.preys.length;                   // 应为 5
    G.session.stage = 3; G.topUpPreys();
    res.laserStage3 = G.preys.length;                   // 应为 7
    G.session.stage = 3; G.topUpPreys();                // 重复调用不超上限
    res.laserStage3Again = G.preys.length;              // 仍为 7
    // 多只蝴蝶：同样逐阶段递增
    G.clearPreys(); G.config.targetType = "butterfly";
    G.startGame();
    res.bflyStage1 = G.preys.length;                    // 应为 3
    G.session.stage = 2; G.topUpPreys();
    res.bflyStage2 = G.preys.length;                    // 应为 5
    G.session.stage = 3; G.topUpPreys();
    res.bflyStage3 = G.preys.length;                    // 应为 7
    // 多只鱼：逐阶段递增
    G.clearPreys(); G.config.targetType = "fish";
    G.startGame();
    res.fishStage1 = G.preys.length;                    // 应为 3
    G.session.stage = 2; G.topUpPreys();
    res.fishStage2 = G.preys.length;                    // 应为 5
    G.session.stage = 3; G.topUpPreys();
    res.fishStage3 = G.preys.length;                    // 应为 7
    // 多只老鼠：递增但受洞口数封顶（≤ holeN-1）
    G.clearPreys(); G.config.targetType = "mouse";
    G.startGame();
    const holeN = G.scene.holes.length;
    res.mouseHoles = holeN;
    res.mouseStage1 = G.preys.length;                   // 应为 3
    G.session.stage = 2; G.topUpPreys();
    res.mouseStage2 = G.preys.length;                   // 应为 min(5, holeN-1)
    G.session.stage = 3; G.topUpPreys();
    res.mouseStage3 = G.preys.length;                   // 应为 min(7, holeN-1)
    // 单只模式：不补点
    G.clearPreys(); G.config.preyCount = 1; G.config.targetType = "laser";
    G.startGame(); G.session.stage = 3; G.topUpPreys();
    res.singleMode = G.preys.length;                    // 应为 1
    G.clearPreys();
    return res;
  });
  console.log("RESULT " + JSON.stringify(out));
  console.log("ERRORS " + errors.length + (errors.length ? " " + errors.join(" | ") : ""));
  const ok = out.laserStage1 === 3 && out.laserStage2 === 5 && out.laserStage3 === 7 && out.laserStage3Again === 7
    && out.bflyStage1 === 3 && out.bflyStage2 === 5 && out.bflyStage3 === 7
    && out.fishStage1 === 3 && out.fishStage2 === 5 && out.fishStage3 === 7
    && out.mouseStage1 === 3 && out.mouseStage2 === Math.min(5, out.mouseHoles - 1) && out.mouseStage3 === Math.min(7, out.mouseHoles - 1)
    && out.singleMode === 1 && errors.length === 0;
  console.log(ok ? "ALL PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
