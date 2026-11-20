/* 校验暗夜荧光「走停节拍」（PRD 4.6 V1.3）：停顿次数、停顿中位移、朝向变化、敏锐度 k 反馈
   用法：node test/probe_pool_pause.js */
const path = require("path");
const ROOT = path.join(__dirname, "..");
const G = {};

G.platform = {
  S: 1.5, W: 1200, H: 800,
  safe: { top: 0, bottom: 0, left: 0, right: 0 },
  storage: { get: () => null, set: () => {} }
};
G.bounds = () => ({ x: 20, y: 96, w: 1160, h: 660 });

require(path.join(ROOT, "js/config.js"))(G);
require(path.join(ROOT, "js/prey.js"))(G);

G.config = { targetType: "pool", preyCount: 1, difficulty: "normal", duration: 60, infinite: false, adaptive: true };
G.session = { time: 0, stage: 1, sea: { key: "kelp" }, adaptiveTier: 0, combo: 0, missStreak: 0 };
G.draw = new Proxy({}, { get: () => () => {} });
G.scene = { holes: null, holeOwners: [], mouseBg: "room" };

G.buildPreys();
const p = G.preys[0];
if (!p || p.type !== "pool") { console.error("没有生成 pool 猎物"); process.exit(1); }

const dt = 1 / 60;
let t = 0;
const pauses = [];          // { start, end, ang0, angDelta }
let cur = null;
let maxDrift = 0;
let maxStep = 0;

for (let i = 0; i < 60 * 60; i++) {
  G.session.stage = t < 18 ? 1 : t < 48 ? 2 : 3;      // 与 1 分钟局的阶段切分一致
  const px = p.x, py = p.y;
  const before = { paused: (p.pauseT || 0) > 0 };
  p.update(dt, t);
  t += dt;
  maxStep = Math.max(maxStep, Math.hypot(p.x - px, p.y - py));

  const paused = (p.pauseT || 0) > 0;
  if (paused && !cur) cur = { start: t, x0: p.x, y0: p.y, ang0: p.driftAng, angDelta: 0 };
  if (cur && (paused || before.paused)) {
    cur.angDelta = Math.max(cur.angDelta, Math.abs(p.driftAng - cur.ang0));
    maxDrift = Math.max(maxDrift, Math.hypot(p.x - cur.x0, p.y - cur.y0));
  }
  if (cur && !paused) { cur.end = t; pauses.push(cur); cur = null; }
}

const durs = pauses.map(o => +(o.end - o.start).toFixed(3));
const avg = durs.reduce((s, v) => s + v, 0) / (durs.length || 1);
const angOk = pauses.filter(o => o.angDelta >= 0.35).length;   // 0.35rad ≈ 20°

console.log("== 60 秒一局（标准 / 单只 / 无交互，阶段 18/48s 推进）==");
console.log("停顿次数:", pauses.length, "（PRD 验收 20–30）");
console.log("停顿时长: 平均", avg.toFixed(3), "s  min", Math.min(...durs).toFixed(3), "max", Math.max(...durs).toFixed(3), "（应落在 0.22–0.90）");
console.log("停顿中最大位移:", maxDrift.toFixed(2), "px（PRD 验收 <4px）");
console.log("单帧最大位移:", maxStep.toFixed(2), "px");
console.log("朝向变化 ≥20° 的停顿占比:", angOk + "/" + pauses.length);

/* ---- 敏锐度 k 反馈 ---- */
console.log("\n== 敏锐度 k ==");
const K = G.POOL_K;
p.poolK = K.init;
const seq = [1.8, 1.9, 2.0, 1.4, 3.5, 8.0, 1.2];
for (const alive of seq) {
  p.aliveT = alive;
  const before = p.poolK;
  p.vanish();
  console.log(`存活 ${alive}s（${alive <= 2.5 ? "快抓" : alive > 6 ? "慢抓" : "常规"}）: k ${before.toFixed(3)} → ${p.poolK.toFixed(3)}  停顿 ${(0.6 * p.poolK).toFixed(3)}s`);
  p.vanishT = 0; p.darkT = 0; p.tp = null;
}
console.log("\n自适应生效（adaptiveTier=1）时 k 下限 1.15：");
p.poolK = 0.5; G.session.adaptiveTier = 1;
p.aliveT = 1.0; p.vanish();
console.log("  k =", p.poolK.toFixed(2), "（自适应期间只影响实际停顿时长，见 updateFirefly 的 kEff）");

/* ---- 边缘进场（PRD 4.6）：消失后不能屏内凭空出现 ---- */
console.log("\n== 换位/重生位置（连续 20 次）==");
const b = G.bounds();
const edgeGap = [];
for (let i = 0; i < 20; i++) {
  p.relocate(i % 2 === 0);
  const gaps = [p.x - b.x, (b.x + b.w) - p.x, p.y - b.y, (b.y + b.h) - p.y];
  edgeGap.push(Math.min(...gaps));
}
const worst = Math.max(...edgeGap);
console.log("离最近边缘的距离: 最大 " + worst.toFixed(1) + "px（越大越靠里，应远小于半屏）");
console.log("贴边判定（≤80px）: " + edgeGap.filter(v => v <= 80).length + "/20");
console.log("朝向指向屏内且偏差 <30°: " + (() => {
  let ok = 0;
  for (let i = 0; i < 20; i++) {
    p.relocate(true);
    const gaps = [p.x - b.x, (b.x + b.w) - p.x, p.y - b.y, (b.y + b.h) - p.y];
    const mn = Math.min(...gaps);
    const dx = Math.cos(p.driftAng), dy = Math.sin(p.driftAng);
    const inward = (gaps[0] === mn ? dx : 0) + (gaps[1] === mn ? -dx : 0) + (gaps[2] === mn ? dy : 0) + (gaps[3] === mn ? -dy : 0);
    if (inward > 0.8) ok++;
  }
  return ok + "/20";
})());
