/* check_fish_species.js — 验证鱼种类逻辑：开局去重、补点不重样、复活换种 */
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
    const keys = () => G.preys.map(p => p.species.key);
    // 开局 3 条：品种互不相同
    G.config.targetType = "fish"; G.config.preyCount = 3;
    G.startGame();
    res.startKeys = keys();
    res.startDistinct = new Set(res.startKeys).size === res.startKeys.length;
    // 补点到 7 条：全程不重样（10 种 > 7）
    G.session.stage = 3; G.topUpPreys();
    res.afterTopUpKeys = keys();
    res.topUpDistinct = new Set(res.afterTopUpKeys).size === res.afterTopUpKeys.length;
    res.topUpCount = G.preys.length;                    // 应为 7
    // 复活换种：对每条鱼反复重抽 10 次，至少出现 2 种
    let rerollVaries = true;
    G.preys.forEach(p => {
      const seen = new Set();
      for (let i = 0; i < 10; i++) { p.pickFishSpecies(); seen.add(p.species.key); }
      if (seen.size < 2) rerollVaries = false;
    });
    res.rerollVaries = rerollVaries;
    // 下一局：开局鱼种与上一局不同（概率性，重开 5 局至少 3 局不同）
    let diffRounds = 0;
    for (let r = 0; r < 5; r++) {
      G.clearPreys(); G.startGame();
      const k = keys().sort().join(",");
      if (k !== res.startKeys.sort().join(",")) diffRounds++;
    }
    res.diffRounds = diffRounds;                        // 期望 ≥3/5
    G.clearPreys();
    return res;
  });
  console.log("RESULT " + JSON.stringify(out));
  console.log("ERRORS " + errors.length + (errors.length ? " " + errors.join(" | ") : ""));
  const ok = out.startDistinct && out.topUpDistinct && out.topUpCount === 7 && out.rerollVaries && out.diffRounds >= 3 && errors.length === 0;
  console.log(ok ? "ALL PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
