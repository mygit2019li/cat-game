/* probe_tadpole.js — 蝌蚪快跑 v1.0「白纸墨影」逻辑仿真
   验：边缘进场 / 横穿与触边折返 / 折返减速窗 / 头尾判定 / 漏击只记一次 /
       阶段数量 1→2→3 / 重生从边缘 / 单帧开销
   用法：node test/probe_tadpole.js */
const path = require("path");
const ROOT = path.join(__dirname, "..");
/* 固定随机种子：出生边、折返概率都走 Math.random，探针必须可复现。 */
let __seed = 20261119;
Math.random = () => { __seed = (__seed * 1664525 + 1013904223) >>> 0; return __seed / 4294967296; };
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
G.session = { time: 0, stage: 1, adaptiveTier: 0, hits: 0, running: true,
  tadCount: 1, tadEval: 0, tadMark: 0, tadDown: 0, combo: 0, missStreak: 0, escapes: 0 };
G.draw = new Proxy({}, { get: () => () => {} });
G.scene = { type: "tadpole", tadBg: "paper", holeOwners: [], mouseBg: "room" };

let escapeN = 0;
G.tadpoleEscape = () => { escapeN++; };

G.buildPreys();
const p = G.preys[0];
if (!p || p.type !== "tadpole") { console.error("没有生成 tadpole 猎物"); process.exit(1); }

const dt = 1 / 60;
const B = G.bounds();
const A = [], ok = (c, m, e) => A.push((c ? "✅ " : "❌ ") + m + (e != null ? "  → " + e : ""));

/* ---------- 1. 出生：画外 + 朝屏内 ---------- */
const outside = p.x < B.x || p.x > B.x + B.w || p.y < B.y || p.y > B.y + B.h;
const inward = Math.cos(p.tadAng) * (p.x < B.x ? 1 : p.x > B.x + B.w ? -1 : 0) +
               Math.sin(p.tadAng) * (p.y < B.y ? 1 : p.y > B.y + B.h ? -1 : 0);
ok(outside, "出生点在可玩边界之外（从画外游入）", `x=${p.x.toFixed(0)}, y=${p.y.toFixed(0)}`);
ok(inward > 0.6, "出生航向指向屏内", inward.toFixed(2));
ok(Math.abs(Math.hypot(p.x - (B.x + B.w / 2), p.y - (B.y + B.h / 2))) > 300, "不是屏内凭空出现");

/* ---------- 2. 60 秒轨迹：横穿、折返、离场 ---------- */
let t = 0, foldN = 0, edgeN = 0, escapeStart = escapeN, inside = 0, samples = 0;
let maxFold = 0, outAfterFold = 0, speeds = [], foldSpeeds = [];
let lastFolds = 0, wasFold = 0;
for (let i = 0; i < 60 * 60; i++) {
  G.session.stage = t < 18 ? 1 : t < 48 ? 2 : 3;
  const x0 = p.x, y0 = p.y;
  p.update(dt, t);
  t += dt;
  const d = Math.hypot(p.x - x0, p.y - y0);
  if (p.tadFold > 0) foldSpeeds.push(d / dt);
  else if ((p.vanishT || 0) <= 0 && (p.darkT || 0) <= 0) speeds.push(d / dt);
  if (wasFold === 0 && p.tadFold > 0) { foldN++; edgeN++; }   // 折返次数在每次重生会归零，按"进入折返弧"计数
  if (wasFold > 0 && p.tadFold === 0) {
    maxFold = Math.max(maxFold, p.tadFolds);
    if (p.x < B.x - 1 || p.x > B.x + B.w + 1 || p.y < B.y - 1 || p.y > B.y + B.h + 1) outAfterFold++;
  }
  wasFold = p.tadFold;
  if (p.x >= B.x && p.x <= B.x + B.w && p.y >= B.y && p.y <= B.y + B.h) inside++;
  samples++;
}
const escapes = escapeN - escapeStart;
const avg = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

const foldRate = foldN / Math.max(1, foldN + escapes);
ok(foldN >= 5, "60s 内多次触边折返（≥5 次）", String(foldN));
ok(foldRate > 0.3 && foldRate < 0.95, "折返/离场比例落在设计区间（30%–95%）", (foldRate * 100).toFixed(0) + "%");
ok(escapes >= 3, "未击中的个体会完整离场（漏击事件 ≥3）", String(escapes));
ok(maxFold > 0 && maxFold <= 3, "单只折返次数不超过阶段上限", String(maxFold));
ok(outAfterFold === 0, "折返结束后身体回到边界内", String(outAfterFold));
ok(inside / samples > 0.75, "大部分时间在可玩区内（>75%）", (inside / samples * 100).toFixed(1) + "%");
ok(avg(foldSpeeds) < avg(speeds) * 0.85, "折返弧速度明显低于巡航（<85%）",
  (avg(foldSpeeds) / avg(speeds)).toFixed(2) + "×");
ok(avg(speeds) > 140, "巡航速度落在可读范围（>140px/s @S=1.5）", avg(speeds).toFixed(0));

/* ---------- 3. 折返奖励窗：命中盒放宽 ---------- */
p.vanishT = 0; p.darkT = 0; p.invulnT = 0; p.fade = 1; p.tadIn = 0;
p.x = 600; p.y = 400; p.tadAng = 0; p.trail = []; p.segs = [];
for (let i = 0; i < 5; i++) p.segs.push({ x: 600 - (i + 1) * 9, y: 400 });
p.tadFold = 0;
const edgeX = p.baseW * p.sc * 0.5 * G.TADPOLE.headPad + 2;
const hitNormal = p.hittable(600 + edgeX, 400);
p.tadFold = 0.6;
const hitFold = p.hittable(600 + edgeX, 400);
p.tadFold = 0;
ok(p.hittable(600, 400) === true && p._hitPart === "head", "头部命中 → head", p._hitPart);
ok(p.hittable(600 - 45, 400) === true && p._hitPart === "tail", "尾节命中 → tail", p._hitPart);
ok(p.hittable(600, 400 + 80) === false, "离身体过远不误判");
ok(!hitNormal && hitFold, "折返时命中盒额外放宽约 15%", `normal=${hitNormal}, fold=${hitFold}`);
p.invulnT = 0.24;
ok(p.hittable(600, 400) === false, "入场/受击保护期内不可重复命中");
p.invulnT = 0;

/* ---------- 4. 漏击只记一次 + 重生回到边缘 ---------- */
escapeN = 0;
p.vanishT = 0; p.darkT = 0; p.fade = 1;
p.tadIn = 0; p.invulnT = 0; p.tadFold = 0; p.tadNoFoldT = 0; p.tadStartle = 0;
p.tadFolds = 99;                    // 折返次数用尽 → 下一次触边必定离场
p.tadAng = 0;                       // 朝右（+x）
p.x = B.x + B.w - 1; p.y = B.y + B.h * 0.5; p.vx = 1; p.vy = 0;
for (let i = 0; i < 40 && escapeN === 0; i++) p.update(dt, i * dt);
const escapedOnce = escapeN;
for (let i = 0; i < 40; i++) p.update(dt, 1 + i * dt);
ok(escapedOnce === 1 && escapeN === 1, "一次离场只记一次漏击", `escape=${escapeN}`);
// 冷却结束后从边缘重进
let respawned = false, spawnX = 0, spawnY = 0;
for (let i = 0; i < 200; i++) {
  const beforeDark = p.darkT;
  p.update(dt, 2 + i * dt);
  if (beforeDark > 0 && p.darkT <= 0) { respawned = true; spawnX = p.x; spawnY = p.y; break; }
}
const backOut = spawnX < B.x || spawnX > B.x + B.w || spawnY < B.y || spawnY > B.y + B.h;
ok(respawned && backOut, "冷却后从画外边缘重新进场", `x=${spawnX.toFixed(0)}, y=${spawnY.toFixed(0)}`);

/* ---------- 5. 阶段数量：1 → 2 → 3，上限 3 ---------- */
G.session.tadCount = 1;
G.session.stage = 1; const c1 = G.stageTargetCount();
G.session.stage = 2; const c2 = G.stageTargetCount();
G.session.stage = 3; const c3 = G.stageTargetCount();
ok(c1 === 1 && c2 === 2 && c3 === 3, "同屏基线随阶段 1→2→3", `${c1}/${c2}/${c3}`);
G.session.tadCount = 3; G.session.stage = 3; G.session.hits = 20; G.session.tadMark = 0; G.session.tadEval = 99;
G.tadpoleTick(0.016);
ok((G.session.tadCount || 0) <= 3, "上限封顶 3 只", String(G.session.tadCount));

/* ---------- 6. 单帧开销 ---------- */
p.tadSpawn();
const t0 = process.hrtime.bigint();
for (let i = 0; i < 20000; i++) p.update(dt, i * dt);
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
ok(ms / 20000 < 0.05, "单只单帧更新开销 <0.05ms", (ms / 20000).toFixed(4) + "ms");

console.log(A.join("\n"));
const bad = A.filter(l => l.startsWith("❌")).length;
console.log(`\n${A.length - bad}/${A.length} 通过`);
process.exit(bad ? 1 : 0);
