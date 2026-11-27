/* probe_wave_spawn.js — 多只波次制补充体检（鼠/蛙/蝌蚪/激光/萤火虫）
   验证：
   ① 多只模式：拍掉部分猎物 → 它们进入待命且不自行重生，其余存活个体照常活动
   ② 全部清空 → gap 0.6s 内不补；超过 0.6s 统一整波重生（waveHold 清零、fade 恢复）
   ③ 单只模式：不走波次，拍掉后按原逻辑自行重生
   ④ 鱼玩法不属于波次类型，waveModeOn 恒 false
   用法：NODE_PATH=/tmp/ffshot/node_modules node test/probe_wave_spawn.js */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const MODS = ["./js/platform.js", "./js/config.js","./js/rank.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

function findChrome() {
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", process.env.CHROME_PATH || ""])
    if (p && fs.existsSync(p)) return p;
  throw new Error("no chrome");
}

// 在浏览器里跑一段确定性逻辑：开局→分阶段断言
const scenario = (mode) => {
  const G = window.G;
  if (G.waveDisarm) G.waveDisarm();   // 每个用例独立，清掉上一个多只用例残留的门闸
  // 配置
  G.config.preyCount = (mode === "laser1") ? 1 : 3;
  G.config.ffCount = (mode === "pool") ? 3 : 1;
  G.config.tadCount = (mode === "tadpole") ? 3 : 1;
  G.config.targetType = mode === "pool" ? "pool"
    : mode === "tadpole" ? "tadpole"
    : (mode === "swarm" || mode === "mouse") ? "mouse"
    : mode === "laser1" ? "laser" : mode;
  G.config.duration = 60;
  if (mode === "swarm" || mode === "mouse") {
    G.openBgPick();
    const arr = G.bgsFor("mouse");
    G.bgPick.idx = mode === "swarm"
      ? arr.findIndex(b => b.key === "swarm")
      : arr.findIndex(b => b.key !== "swarm");
    G.confirmBgPick();
  }
  G.startGame();
  G.session.counting = false;
  G.switchScreen("playing");
  G.session.running = false;   // 停掉主循环自动更新，改由测试手动驱动
  if (mode === "tadpole") {    // 蝌蚪多条要到阶段③才同屏 3 只
    G.session.stage = 3;
    G.buildPreys();
    G.topUpPreys();
    if (G.waveReset) G.waveReset();
  }

  const tp = G.config.targetType;
  const list = () => G.preys.filter(p => p.type === tp && p.despawn == null);
  const held = p => !!p.waveHold;   // 与代码 isHeld 一致：只有显式待命才算清空
  let t0 = performance.now() / 1000;
  const step = (sec) => {
    const dt = 0.02;
    for (let i = 0; i < Math.round(sec / dt); i++) {
      t0 += dt;
      if (G.waveArm) G.waveArm();
      G.preys.forEach(p => p.update(dt, t0));
      G.waveTick(dt);
    }
  };

  const R = { mode, waveMode: G.waveModeOn(), n0: list().length, target: G.stageTargetCount(), log: [] };

  if (mode === "laser1") {
    // 单只：波次关闭，拍掉后 0.6s 内自行重生（dart/hold 均算已回场）
    const p = list()[0];
    p.vanish();
    step(0.6);
    R.singleRespawn = !p.waveHold && p.vanishT <= 0 && (p.state === "dart" || p.state === "hold") && (p.fade || 0) >= 0.9;
    return R;
  }

  // 轮询驱动，直到 cond 成立（避免盲跑跨过波次放行时机）
  const DT = 0.02;
  const until = (cond, maxSec) => {
    for (let acc = 0; acc < maxSec; acc += DT) {
      t0 += DT;
      if (G.waveArm) G.waveArm();
      G.preys.forEach(p => p.update(DT, t0));
      G.waveTick(DT);
      if (cond()) return true;
    }
    return cond();
  };

  // 多只：先拍一只，轮询到它进入待命
  const first = list()[0];
  first.vanish();
  until(() => first.waveHold === true, 2.5);
  R.firstHeld = held(first) && first.waveHold === true;
  const others = list().filter(p => p !== first);
  R.othersFree = others.some(p => !held(p));
  R.stillN = list().length;

  // 再清空其余自由个体，轮询到全场待命（停在放行前一刻）
  others.forEach(p => { if (!held(p)) p.vanish(); });
  until(() => list().every(held), 3.0);
  R.allHeld = list().every(held);

  // gap 0.6s 内不补
  step(0.4);
  R.stillHeldInGap = list().every(held);

  // 超过 gap：统一放行（用 !held 判定，避免激光等无 rspT 字段时 undefined<=0 误判）
  step(0.4);
  R.released = list().every(p => !held(p));
  // 放行后再跑 0.6s，让入场动画走完，全部应可见
  step(0.6);
  R.allVisible = list().every(p => (p.fade || 0) >= 0.4);
  R.finalN = list().length;
  return R;
};

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => {
    const s = m.text();
    if (m.type() === "error" && !/ERR_FILE_NOT_FOUND|ERR_UNKNOWN_URL_SCHEME/.test(s)) errs.push("console: " + s);
  });
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(300);

  const out = [];
  const ok = (c, msg, extra) => out.push((c ? "✅ " : "❌ ") + msg + (extra != null ? "  → " + extra : ""));

  // 五种多只模式
  for (const mode of ["laser", "pool", "tadpole", "frog", "swarm", "mouse"]) {
    const r = await page.evaluate(scenario, mode);
    ok(r.waveMode, `[${mode}] 多只模式 waveModeOn=true`, `n=${r.n0}/${r.target}`);
    ok(r.n0 === r.target && r.n0 >= 2, `[${mode}] 开局刷满 ${r.target} 只`, `实际 ${r.n0}`);
    ok(r.firstHeld, `[${mode}] 拍 1 只后该只待命不重生`);
    ok(r.othersFree, `[${mode}] 其余个体未被波及，照常活动`, `存活 ${r.othersFree ? "正常" : "异常"}`);
    ok(r.allHeld, `[${mode}] 全部清空后进入整波待命`);
    ok(r.stillHeldInGap, `[${mode}] 空场 0.4s（<0.6 gap）仍不补`);
    ok(r.released, `[${mode}] gap 满 0.6s 后整波统一放行`);
    ok(r.allVisible && r.finalN === r.target, `[${mode}] 新一波全部可见且数量复原`, `${r.finalN}/${r.target}`);
  }

  // 单只激光：不走波次
  const r1 = await page.evaluate(scenario, "laser1");
  ok(!r1.waveMode, "[laser 单只] waveModeOn=false");
  ok(r1.singleRespawn, "[laser 单只] 拍掉后自行重生（维持原行为）");

  // 鱼：不是波次类型
  const fish = await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "fish"; G.config.preyCount = 3;
    return G.waveModeOn();
  });
  ok(fish === false, "[fish] 不属于波次玩法，waveModeOn=false");

  if (errs.length) { out.push("❌ 运行期报错:\n" + errs.map(e => "   " + e).join("\n")); }
  console.log(out.join("\n"));
  const fail = out.filter(l => l.startsWith("❌")).length;
  console.log(`\n${fail ? "❌ " + fail + " 项失败" : "✅ 全部通过（" + out.length + " 项）"}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
