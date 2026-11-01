/* check_mouse_billiard.js — 验证台球桌布局：四边+中场洞口、任意洞进出、可点击拦截 */
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOD_NAMES = [
  "./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/sharecard.js", "./js/ui.js", "./js/feeder.js", "./game.js"
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
    G.config.targetType = "mouse"; G.config.preyCount = 3;
    G.startGame();
    const S = G.scene, b = G.bounds();
    G.session.stage = 3; G.topUpPreys();
    const res = { holeCount: S.holes.length };
    // 四边覆盖：上/下/左/右各有洞（距对应边 < 0.25*b.w 或 0.3*b.h）
    const near = (v, e) => Math.abs(v - e) < (e === b.y + 0.18 * b.h || e === b.y + 0.86 * b.h ? 0.06 * b.h : 0.08 * b.w);
    res.topEdge = S.holes.some(h => Math.abs(h.y - (b.y + 0.18 * b.h)) < 0.04 * b.h);
    res.bottomEdge = S.holes.some(h => Math.abs(h.y - (b.y + 0.86 * b.h)) < 0.04 * b.h);
    res.leftEdge = S.holes.some(h => Math.abs(h.x - (b.x + 0.07 * b.w)) < 0.05 * b.w);
    res.rightEdge = S.holes.some(h => Math.abs(h.x - (b.x + 0.93 * b.w)) < 0.05 * b.w);
    res.middleHoles = S.holes.filter(h =>
      Math.abs(h.y - (b.y + 0.5 * b.h)) < 0.05 * b.h &&
      Math.abs(h.x - (b.x + 0.36 * b.w)) < 0.06 * b.w).length > 0;
    // 任意洞 → 任意洞：连续 10 次强制窜逃，记录目标距离（应出现远距离跨台）
    const p = G.preys[0];
    const dists = [];
    for (let i = 0; i < 10; i++) {
      p.state = "peek"; p.mState = "peek"; p.mT = 99; p.scared = false;   // 直接触发 peek 结束判定
      p.updateMouse(0.001, G.session.time);
      if (p.state === "dart") {
        dists.push(Math.abs(p.dartTarget.x - p.dartStartX));
        p.state = "hole"; p.mState = "hole"; p.mT = 99; p.holeWait = 0;   // 立即换下一个洞
        p.updateMouse(0.001, G.session.time);
      } else { p.state = "hole"; p.mState = "hole"; p.mT = 99; p.holeWait = 0; p.updateMouse(0.001, G.session.time); }
    }
    res.dartSamples = dists.length;
    res.maxDartDist = Math.round(Math.max(...dists, 0));
    res.farDarts = dists.filter(d => d > 0.4 * b.w).length;             // 远距离跨台次数
    // 可拦截：窜逃中沿路径点击应命中
    p.state = "peek"; p.mState = "peek"; p.mT = 99; p.updateMouse(0.001, G.session.time);
    res.darting = p.state === "dart";
    if (res.darting) {
      res.intercept = G.preys[0].hittable(p.x, p.y) === true;
      const midX = (p.dartStartX + p.dartTarget.x) / 2;
      res.interceptMidNear = Math.abs(midX - p.x) < 260;               // 老鼠确实在路径上移动
    }
    return res;
  });
  console.log("RESULT " + JSON.stringify(out));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "mouse-billiard.png") });
  console.log("ERRORS " + errors.length + (errors.length ? " " + errors.join(" | ") : ""));
  const ok = out.holeCount === 10 && out.topEdge && out.bottomEdge && out.leftEdge && out.rightEdge
    && out.middleHoles && out.dartSamples >= 6 && out.farDarts >= 3
    && out.darting && out.intercept && errors.length === 0;
  console.log(ok ? "ALL PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
