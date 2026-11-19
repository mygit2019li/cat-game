/* 群鼠乱窜逻辑探针（Node 直跑，不依赖浏览器/画布）：node test/probe_swarm.js
   断言：默认时长60s、群鼠阶段切分25/45/30、活跃鼠3/4/4且任意时刻≤4、
   波次呼吸期不可命中且数量不增、怕爪鼠靠近会反窜、不接猫粮机（静态检索）。 */
const path = require("path");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? " -> " + extra : "")); }
}

function makeG() {
  const G = {};
  G.platform = {
    S: 1, W: 390, H: 844,
    safe: { top: 0, bottom: 0, left: 0, right: 0 },
    storage: { _m: {}, get(k) { return this._m[k] != null ? this._m[k] : null; }, set(k, v) { this._m[k] = v; } }
  };
  G.rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  require(path.join(__dirname, "..", "js", "config.js"))(G);
  require(path.join(__dirname, "..", "js", "prey.js"))(G);
  return G;
}

(async () => {
  const G = makeG();

  console.log("[1] 默认时长与白名单");
  ok("全新存档默认 duration=60", G.config.duration === 60, "got " + G.config.duration);
  ok("时长白名单仍是 60/120/180/300", [60, 120, 180, 300].every(d => G.GAME_DURS.indexOf(d) >= 0));

  console.log("[2] 群鼠阶段切分 25% / 45% / 30%");
  const stageAt = (elapsed, dur) => {
    G.config.duration = dur; G.config.targetType = "mouse"; G.config.bg_mouse = "swarm";
    G.session = { stage: 1, remaining: dur - elapsed, time: elapsed };
    return G.stageNow();
  };
  ok("60s: 14s 仍在①", stageAt(14, 60) === 1);
  ok("60s: 15s 进②(25%)", stageAt(15, 60) === 2);
  ok("60s: 41s 仍在②", stageAt(41, 60) === 2);
  ok("60s: 42s 进③(末30%)", stageAt(42, 60) === 3, "got " + stageAt(42, 60));
  ok("180s: 45s 进② / 126s 进③", stageAt(45, 180) === 2 && stageAt(126, 180) === 3);
  ok("300s: 75s 进② / 210s 进③(③=90s)", stageAt(75, 300) === 2 && stageAt(210, 300) === 3);
  // 其它玩法阶段切分不变（鱼走通用 20s/50s）
  G.config.bg_mouse = "kelp"; G.config.targetType = "fish";
  const fishStage = (elapsed, dur) => {
    G.config.duration = dur;
    G.session = { stage: 1, remaining: dur - elapsed, time: elapsed };
    return G.stageNow();
  };
  ok("捕鱼仍走通用切分(300s: 19s①/20s②/70s③)",
    fishStage(19, 300) === 1 && fishStage(20, 300) === 2 && fishStage(70, 300) === 3);
  G.config.targetType = "mouse"; G.config.bg_mouse = "swarm"; G.config.duration = 60;

  console.log("[3] 活跃鼠 3/4/4 且硬顶 4");
  G.scene = { type: "mouse", mouseBg: "swarm" };
  G.session = { stage: 1, remaining: 60, time: 0 };
  G.buildPreys(); G.topUpPreys(); G.swarmReset();
  const countAt = (s) => { G.session.stage = s; return G.stageTargetCount(); };
  ok("数量映射 ①3 / ②4 / ③4", countAt(1) === 3 && countAt(2) === 4 && countAt(3) === 4);
  ok("任意阶段目标数 <=4", [1, 2, 3].every(s => countAt(s) <= 4));
  G.session.stage = 1; G.topUpPreys();
  ok("①开局在场 3 只", G.preys.length === 3, "got " + G.preys.length);
  const step = (dt) => { G.swarmTick(dt); G.session.time += dt; G.preys.forEach(p => p.update(dt, G.session.time)); };
  let maxSeen = G.preys.length, breathSeen = false, breathHittable = 0, samples = 0;
  // 模拟 0..70s（覆盖两个波次与全部阶段），逐帧采样
  for (let t = 0; t < 70; t += 1 / 30) {
    const st = stageAt(Math.min(t, 59.9), 60);
    if (st !== G.session.stage) { G.session.stage = st; G.topUpPreys(); }
    step(1 / 30);
    maxSeen = Math.max(maxSeen, G.preys.length);
    samples++;
    if (G.swarmBreathing()) {
      breathSeen = true;
      G.preys.forEach(p => { if (p.hittable(p.x, p.y)) breathHittable++; });
    }
  }
  ok("70s 内任意时刻在场 <=4", maxSeen === 4, "max=" + maxSeen);
  ok("至少出现一次换场呼吸", breathSeen);
  ok("呼吸期没有任何鼠可命中", breathHittable === 0, "hits=" + breathHittable);

  console.log("[4] 阶段②③补员到 4 只");
  G.session.stage = 2; G.topUpPreys();
  ok("②在场 4 只", G.preys.length === 4, "got " + G.preys.length);
  G.session.stage = 3; G.topUpPreys();
  ok("③在场仍 4 只(不加到5/6)", G.preys.length === 4, "got " + G.preys.length);

  console.log("[5] 命中窗口：tell 预兆后进入可拍 pause");
  G.SWARM_PARAMS.wave.intervalMin = 99999;   // 探针：锁定 active，断言期间不被呼吸打断
  while (G.swarmBreathing()) step(0.05);
  const p = G.preys[0];
  // 强制驱动一只走完 scurry -> tell -> pause
  p.state = "tell"; p.stateT = 0;
  step(0.21);
  ok("tell 0.2s 后进入 pause(可拍窗口)", p.state === "pause", "state=" + p.state);
  ok("pause 期间原地可命中", p.hittable(p.x, p.y) === true);

  console.log("[6] 怕爪鼠：猫爪靠近跑动中的鼠会反窜，停留窗口不逃");
  while (G.swarmBreathing()) step(0.05);   // 呼吸期不处理反窜，等追猎段
  const q = G.preys[0];
  q.skittish = true; q.fleeCd = 0; q.fleeT = 0; q.fleeRun = 0; q.state = "scurry"; q.stateT = 0; q.stateDur = 99;
  const b = G.bounds();
  q.x = b.x + b.w / 2; q.y = b.y + b.h / 2;   // 放开阔处，排除撞边干扰
  G.lastPaw = { x: q.x + 60, y: q.y, t: performance.now() };
  const d0 = Math.hypot(q.x - G.lastPaw.x, q.y - G.lastPaw.y);
  step(0.016);
  ok("跑动中爪子逼近 -> 进入缩身预兆", q.fleeT > 0, "fleeT=" + q.fleeT);
  // 预兆确定反窜方向（指向远离爪子）；对齐航向后应沿该方向跑出预算距离
  q.swimAng = q.fleeAng; q._visAng = q.fleeAng; q._turnTo = null;
  step(0.5);
  const d1 = Math.hypot(q.x - G.lastPaw.x, q.y - G.lastPaw.y);
  ok("预兆后沿远离爪子方向短窜", d1 > d0 + 40, "d0=" + d0.toFixed(1) + " d1=" + d1.toFixed(1));
  // 停留窗口内即使爪子贴近也不逃
  const r = G.preys[1];
  r.skittish = true; r.fleeCd = 0; r.fleeT = 0; r.fleeRun = 0;
  r.state = "pause"; r.stateT = 0; r.stateDur = 99;
  G.lastPaw = { x: r.x + 30, y: r.y, t: performance.now() };
  step(0.05);
  ok("pause 命中窗口内不被吓跑", r.fleeT <= 0 && r.state === "pause");

  console.log("[7] 不接猫粮机（群鼠路径无出粮调用）");
  const fs = require("fs");
  const preySrc = fs.readFileSync(path.join(__dirname, "..", "js", "prey.js"), "utf8");
  const gameSrc = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
  ok("prey.js 不调用 feederDispense", !/feederDispense/.test(preySrc));
  ok("game.js 仅在既有定义处出现、群鼠 onHit 不触发出粮",
    (gameSrc.match(/feederDispense/g) || []).length <= 1);

  console.log("\n==== " + (fail === 0 ? "ALL PASS" : fail + " FAILED") + " : " + pass + " passed, " + fail + " failed, " + samples + " frames ====");
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
