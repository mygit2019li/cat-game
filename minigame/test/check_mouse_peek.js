/* check_mouse_peek.js — 验证老鼠探头：左右各看一次（仅 1 次转向）后即进入逃跑判定 */
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
    G.config.targetType = "mouse"; G.config.preyCount = 3; G.config.duration = 180;
    G.startGame();
    // 暂停主循环，避免 rAF 实时更新与手动步进互相干扰
    G.session.remaining = 100;
    G.screen = "playing"; G.session.running = true; G.session.paused = true; G.session.counting = false;
    const p = G.preys[0];
    p.comboSpeed = 1; p.comboSpeedTarget = 1;
    // 从 hole 态自然转入 peek：mState 置为不同值，让 updateMouse 的状态迁移块初始化 peekFirst
    p.state = "peek"; p.mState = "hole"; p.mT = 0; p.scared = false;
    const seq = [];
    let nextState = null;
    const dt = 0.05;
    for (let i = 0; i < 300; i++) {
      p.updateMouse(dt, G.session.time);
      if (p.state !== "peek") { nextState = p.state; break; }
      seq.push(p.faceDir);
    }
    let flips = 0;
    for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) flips++;
    return {
      peekDur: +(G.MOUSE_STAGE[1].peek || 0).toFixed(2),
      samples: seq.length,
      flips,
      sawBoth: seq.includes(1) && seq.includes(-1),
      nextState
    };
  });
  console.log("RESULT " + JSON.stringify(out));
  console.log("ERRORS " + errors.length + (errors.length ? " " + errors.join(" | ") : ""));
  // 期望：peek 期内朝向仅翻转 1 次（左→右或右→左），两个方向都出现，peek 结束后进入 dart/hole
  const ok = out.flips === 1 && out.sawBoth && (out.nextState === "dart" || out.nextState === "hole") && errors.length === 0;
  console.log(ok ? "ALL PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
