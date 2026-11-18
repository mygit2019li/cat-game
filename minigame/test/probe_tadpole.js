/* probe_tadpole.js — 蝌蚪快跑逻辑仿真（方案 v0.2 验收）
   验：状态循环 / 换向静止窗 / 方向因果 / 头尾判定 / 数量动态 1–7 / 边缘进场
   用法：node test/probe_tadpole.js */
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

G.config = { targetType: "tadpole", preyCount: 1, difficulty: "normal", duration: 60, infinite: false, adaptive: true };
G.session = { time: 0, stage: 1, adaptiveTier: 0, hits: 0,
  tadCount: 1, tadEval: 0, tadMark: 0, tadDown: 0, combo: 0, missStreak: 0 };
G.draw = new Proxy({}, { get: () => () => {} });
G.scene = { tadBg: "lotus", holeOwners: [], mouseBg: "room" };

G.buildPreys();
const p = G.preys[0];
if (!p || p.type !== "tadpole") { console.error("没有生成 tadpole 猎物"); process.exit(1); }

const dt = 1 / 60;
let t = 0;
const A = [], ok = (c, m, e) => A.push((c ? "✅ " : "❌ ") + m + (e != null ? "  → " + e : ""));

/* ---- 60 秒状态分布 ---- */
const stat = { wander: 0, flee: 0, dart: 0, turn: 0 };
const turns = []; let curTurn = null, maxTurnDrift = 0;
for (let i = 0; i < 60 * 60; i++) {
  G.session.stage = t < 18 ? 1 : t < 48 ? 2 : 3;
  const was = p.tState;
  p.update(dt, t);
  t += dt;
  stat[p.tState] = (stat[p.tState] || 0) + dt;
  // 模拟主人陪玩：每 2.5s 在蝌蚪附近拍一下（160px 内未命中 → 触发逃窜）
  if (i % 150 === 0 && p.tState !== "turn") p.fleeFrom(p.x + Math.cos(t) * 120, p.y + Math.sin(t) * 120);
  if (was === "turn" && p.tState === "turn") {
    if (!curTurn) curTurn = { d: 0, x: p.x, y: p.y, ang: p.driftAng };
    curTurn.d += dt;
    maxTurnDrift = Math.max(maxTurnDrift, Math.hypot(p.x - curTurn.x, p.y - curTurn.y));
  } else if (curTurn) { turns.push(curTurn); curTurn = null; }
}
const turnAvg = turns.reduce((s, o) => s + o.d, 0) / (turns.length || 1);

ok(Object.keys(stat).every(k => stat[k] > 0), "四态都出现过", JSON.stringify(Object.fromEntries(Object.entries(stat).map(([k, v]) => [k, v.toFixed(1) + "s"]))));
ok(turns.length >= 6 && turns.length <= 16, "换向窗次数 60s 内 6–16 次（每 4–7s 一个）", String(turns.length));
ok(Math.abs(turnAvg - 0.25) < 0.03, "换向时长 ≈0.25s", turnAvg.toFixed(3));
ok(maxTurnDrift < 4, "换向期间位移 <4px", maxTurnDrift.toFixed(2));

/* ---- 方向因果 ---- */
let causalityOk = 0;
for (let i = 0; i < 30; i++) {
  p.vanishT = 0; p.darkT = 0; p.tp = null;
  const tapAng = i / 30 * Math.PI * 2;
  const px = p.x + Math.cos(tapAng) * 100, py = p.y + Math.sin(tapAng) * 100;
  p.fleeFrom(px, py);
  const dot = Math.cos(p.driftAng - tapAng);        // 逃跑方向与拍击方向应相反 → cos ≈ -1
  if (dot < -0.3) causalityOk++;
}
ok(causalityOk >= 27, "逃窜方向与拍击点相反（夹角 >90°）", causalityOk + "/30");

/* ---- 头/尾判定 ---- */
p.vanishT = 0; p.darkT = 0; p.tp = null; p.invulnT = 0; p.fade = 1;
p.x = 600; p.y = 400; p.trail = []; p.segs = [];
for (let i = 0; i < 5; i++) p.segs.push({ x: 600 - (i + 1) * 10, y: 400 });
p.driftAng = 0;
ok(p.hittable(600, 400) === true && p._hitPart === "head", "头部判定 → head", p._hitPart);
ok(p.hittable(600 - 50, 400) === true && p._hitPart === "tail", "尾节判定 → tail", p._hitPart);
p.invulnT = 0.6;
ok(p.hittable(600, 400) === false, "无敌期内不可重复命中");
p.invulnT = 0;

/* ---- 数量动态 1–7 ---- */
G.session.tadCount = 1; G.session.hits = 0; G.session.tadMark = 0;
const preysNow = () => G.preys.filter(q => q.type === "tadpole" && q.despawn == null).length;
let reached7 = false, back1 = false;
for (let i = 0; i < 7 * 8 * 60; i++) {
  G.session.hits++;                      // 高命中：每 8s 加 1
  G.tadpoleTick(dt);
  if (G.session.tadCount >= 7) { reached7 = true; break; }
}
ok(reached7 && preysNow() === 7, "连续高命中 → 加到 7 只且实际生成 7 只", "count=" + G.session.tadCount + " alive=" + preysNow());
let evalN = 0;
while (G.session.tadCount > 1 && evalN < 30) {
  G.session.hits = G.session.tadMark;    // 零命中
  G.tadpoleTick(8);
  evalN++;
  if (G.session.tadCount <= 1) back1 = true;
}
ok(back1, "连续低命中 → 回落到 1 只", "count=" + G.session.tadCount);
ok(preysNow() === 1, "场上实际只剩 1 只", String(preysNow()));

/* ---- 边缘进场 ---- */
const b = G.bounds();
let edgeOk = 0;
for (let i = 0; i < 12; i++) { p.relocate(true); p.update(dt, t); p.update(dt, t); p.update(dt, t);
  const gaps = [p.x - b.x, (b.x + b.w) - p.x, p.y - b.y, (b.y + b.h) - p.y];
  if (Math.min(...gaps) < 90) edgeOk++;
}
ok(edgeOk >= 11, "重生全部从边缘进场", edgeOk + "/12");

console.log(A.join("\n"));
console.log("运行时状态分布:", JSON.stringify(Object.fromEntries(Object.entries(stat).map(([k, v]) => [k, +(v / 60 * 100).toFixed(0) + "%"]))));
