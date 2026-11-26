/* probe_tadpole.js — 蝌蚪快跑「白纸墨影」逻辑仿真
   验：边缘进场 / 横穿与触边折返 / 折返减速窗 / 头尾判定 / 漏击只记一次 /
       阶段数量 1→2→3 / 重生从边缘 / 单帧开销 / 露头探入 /
       性格（fold 回头 / pass 穿边附近再露头）/ 长按尾巴挣扎（位置冻结）/ 无命中悬停档位
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

G.config = { targetType: "tadpole", preyCount: 1, tadCount: 3, difficulty: "normal", duration: 60, infinite: false, adaptive: true };
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
/* 固定性格为 mix（40% 的随机型）：60s 基线仿真验证通用路径；
   fold/pass 性格的专属行为在 §8 单独验证（构造函数的性格 roll 只影响序列，不影响断言语义） */
p.tadType = "mix";
const avg = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
let t = 0, foldN = 0, edgeN = 0, escapeStart = escapeN, inside = 0, samples = 0;
let maxFold = 0, outAfterFold = 0, speeds = [];
let wasFold = 0;
/* 折返速度按「逐事件」对比：触发帧记录"折返前最近 10 帧巡航"均值，弧内逐帧取均值（不含触发帧——
   那帧位移含折返钳位的坐标回拉瞬移，会把弧均速虚高）。同个体前后对比，避免整段混合里
   阶段速度差异（1→2→3 刷新间隔不同）干扰比值。 */
let cruiseBuf = [], preCruiseAvg = null, arcSpeeds = [], foldRatios = [];
for (let i = 0; i < 60 * 60; i++) {
  G.session.stage = t < 18 ? 1 : t < 48 ? 2 : 3;
  const x0 = p.x, y0 = p.y;
  p.update(dt, t);
  t += dt;
  const d = Math.hypot(p.x - x0, p.y - y0);
  const v = d / dt;
  /* 巡航样本只收「巡游」帧：折返弧、淡出/冷却不算；
     新增的两个"有意停驻"相位（露头 peek / 屏内悬停 hover）是设计内的停顿，也不算巡航降速 */
  const cruising = (p.vanishT || 0) <= 0 && (p.darkT || 0) <= 0 && p.tState !== "peek" && (p.tadHoverT || 0) <= 0;
  if (p.tadFold > 0) {
    if (wasFold === 0) {
      foldN++; edgeN++;   // 折返次数在每次重生会归零，按"进入折返弧"计数
      preCruiseAvg = avg(cruiseBuf);
      arcSpeeds = [];
    } else arcSpeeds.push(v);
  } else {
    if (wasFold > 0) {
      maxFold = Math.max(maxFold, p.tadFolds);
      if (p.x < B.x - 1 || p.x > B.x + B.w + 1 || p.y < B.y - 1 || p.y > B.y + B.h + 1) outAfterFold++;
      if (preCruiseAvg > 0 && arcSpeeds.length > 3) foldRatios.push(avg(arcSpeeds) / preCruiseAvg);
    }
    if (cruising) {
      speeds.push(v);
      cruiseBuf.push(v);
      if (cruiseBuf.length > 10) cruiseBuf.shift();
    }
  }
  wasFold = p.tadFold;
  if (p.x >= B.x && p.x <= B.x + B.w && p.y >= B.y && p.y <= B.y + B.h) inside++;
  samples++;
}
const escapes = escapeN - escapeStart;

const foldRate = foldN / Math.max(1, foldN + escapes);
ok(foldN >= 5, "60s 内多次触边折返（≥5 次）", String(foldN));
ok(foldRate > 0.3 && foldRate < 0.95, "折返/离场比例落在设计区间（30%–95%）", (foldRate * 100).toFixed(0) + "%");
ok(escapes >= 3, "未击中的个体会完整离场（漏击事件 ≥3）", String(escapes));
ok(maxFold > 0 && maxFold <= 3, "单只折返次数不超过阶段上限", String(maxFold));
ok(outAfterFold === 0, "折返结束后身体回到边界内", String(outAfterFold));
ok(inside / samples > 0.75, "大部分时间在可玩区内（>75%）", (inside / samples * 100).toFixed(1) + "%");
ok(foldRatios.length >= 3 && avg(foldRatios) < 0.85, "折返弧速度明显低于折返前巡航（逐事件 <85%）",
  foldRatios.length ? (avg(foldRatios) * 100).toFixed(0) + "% / " + foldRatios.length + " 次" : "无折返样本");
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
p.tadMissed = false;                // 60s 仿真末尾可能刚漏击过，不重置的话 tadEscape 会直接 return
p.tadFolds = 99;                    // 折返次数用尽 → 下一次触边必定离场
p.tadAng = 0;                       // 朝右（+x）
p.tState = "swim"; p.tadHover = 0; p.tadHoverT = 0; p.tadHoverK = 1;   // 以巡游状态进场（排除探头/悬停干扰）
p.x = B.x + B.w - 1; p.y = B.y + B.h * 0.5; p.vx = 1; p.vy = 0;
for (let i = 0; i < 40 && escapeN === 0; i++) p.update(dt, i * dt);
const escapedOnce = escapeN;
for (let i = 0; i < 40; i++) p.update(dt, 1 + i * dt);
ok(escapedOnce === 1 && escapeN === 1, "一次离场只记一次漏击", `escape=${escapeN}`);
// 冷却结束后从边缘重进（按状态检测：tadSpawn 必从 peek 开始，vanish/dark 期间 tState 保持 swim，无假阳性）
let respawned = false, spawnX = 0, spawnY = 0;
for (let i = 0; i < 200; i++) {
  p.update(dt, 2 + i * dt);
  if (p.tState === "peek" && p.darkT <= 0 && p.vanishT <= 0) { respawned = true; spawnX = p.x; spawnY = p.y; break; }
}
const backOut = spawnX < B.x || spawnX > B.x + B.w || spawnY < B.y || spawnY > B.y + B.h;
ok(respawned && backOut, "冷却后从画外边缘重新进场", `x=${spawnX.toFixed(0)}, y=${spawnY.toFixed(0)}`);

/* ---------- 5. 数量两档：单条固定 1 / 多条 1→2→3 上限 3 ---------- */
G.config.tadCount = 3;   // 多条（二级卡页默认）
G.session.tadCount = 1;
G.session.stage = 1; const c1 = G.stageTargetCount();
G.session.stage = 2; const c2 = G.stageTargetCount();
G.session.stage = 3; const c3 = G.stageTargetCount();
ok(c1 === 1 && c2 === 2 && c3 === 3, "多条：同屏基线随阶段 1→2→3", `${c1}/${c2}/${c3}`);
G.session.tadCount = 3; G.session.stage = 3; G.session.hits = 20; G.session.tadMark = 0; G.session.tadEval = 99;
G.tadpoleTick(0.016);
ok((G.session.tadCount || 0) <= 3, "多条：上限封顶 3 只", String(G.session.tadCount));
/* 单条：无论阶段 / 命中表现，同屏恒 1 条，tick 不再增减 */
G.config.tadCount = 1;
const s1 = G.stageTargetCount();
G.session.stage = 3; G.session.tadCount = 3; G.session.hits = 30; G.session.tadMark = 0; G.session.tadEval = 99;
G.tadpoleTick(0.016);
const s3 = G.stageTargetCount();
ok(s1 === 1 && s3 === 1, "单条：任意阶段同屏恒 1 条", `${s1}/${s3}`);
ok(G.session.tadCount === 1, "单条：tick 把 tadCount 字段重置为 1", String(G.session.tadCount));
/* buildPreys 开局数量跟档位走 */
G.session.stage = 1; G.buildPreys();
const bnSingle = G.preys.filter(q => q.type === "tadpole").length;
G.config.tadCount = 3;
G.session.stage = 1; G.buildPreys();
const bnMultiS1 = G.preys.filter(q => q.type === "tadpole").length;
G.session.stage = 3; G.buildPreys();
const bnMultiS3 = G.preys.filter(q => q.type === "tadpole").length;
ok(bnSingle === 1, "单条：开局 1 条", String(bnSingle));
ok(bnMultiS1 === 1 && bnMultiS3 === 3, "多条：开局按阶段 1→3", `${bnMultiS1}/${bnMultiS3}`);
G.config.tadCount = 3;   // 恢复多条，供后续用例

/* ---------- 6. 单帧开销 ---------- */
p.tadSpawn();
const t0 = process.hrtime.bigint();
for (let i = 0; i < 20000; i++) p.update(dt, i * dt);
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
ok(ms / 20000 < 0.05, "单只单帧更新开销 <0.05ms", (ms / 20000).toFixed(4) + "ms");

/* ---------- 7. 露头：探入 → 停驻 → 冲入巡游 ---------- */
p.tadSpawn();
const pkInBounds = p.tadPeekX >= B.x && p.tadPeekX <= B.x + B.w && p.tadPeekY >= B.y && p.tadPeekY <= B.y + B.h;
ok(p.tState === "peek" && p.fade === 1 && pkInBounds, "出生即进入露头阶段（无淡入、探头目标在屏内）",
  `${p.tState} fade=${p.fade} peek=(${(p.tadPeekX || 0).toFixed(0)},${(p.tadPeekY || 0).toFixed(0)})`);
let peekFrames = 0;
for (let i = 1; i <= 300 && p.tState === "peek"; i++) { p.update(dt, 5 + i * dt); peekFrames = i; }
ok(p.tState === "swim" && peekFrames > 0, "露头结束后转入巡游", `${peekFrames} 帧后切换`);

/* ---------- 8. 性格：fold 型撞边回头 / pass 型穿过边 + 附近再露头 ---------- */
G.session.stage = 1;
const resetPrey = (type, x, y, ang) => {
  p.tadType = type;
  p.vanishT = 0; p.darkT = 0; p.fade = 1;
  p.tadIn = 0; p.invulnT = 0; p.tadFold = 0; p.tadNoFoldT = 0; p.tadStartle = 0;
  p.tadMissed = false; p.tadFolds = 0; p.tadForceOut = false; p.aliveT = 0;
  p.tadHoverT = 0; p.tadHoverK = 1; p.tadHoverN = 0; p.tadHoverAcc = 0;
  p.tadNearBy = null; p.tadPassGap = null; p.tadStruggle = 0; p.tadStruggleT = 0;
  p.tState = "swim";
  p.x = x; p.y = y; p.tadAng = ang; p.tadFoldFrom = ang; p.tadFoldTo = ang; p.tadSide = 0;
  p.vx = Math.cos(ang); p.vy = Math.sin(ang);
  p.trail = []; p.segs = [];
  for (let i = 0; i < 7; i++) p.segs.push({ x: x - Math.cos(ang) * (i + 1) * 11, y: y - Math.sin(ang) * (i + 1) * 11 });
};
/* fold 型：触边先回头（foldMax=2 用尽或超时才离场），首触不会直接穿出。
   起点放界内（B.x+4）：触边判定阈值是 x < B.x-2，放界外（B.x-30）第一帧就按出生边"逃逸"，测不到横穿 */
resetPrey("fold", B.x + 4, B.y + B.h * 0.5, 0);
escapeN = 0;
for (let i = 0; i < 900 && escapeN < 1; i++) p.update(dt, i * dt);
ok(p.tadFolds >= 1, "fold 型：撞边回头（离场前至少折返 1 次）", `folds=${p.tadFolds}, esc=${escapeN}`);
/* pass 型：从不回头，直接穿边；冷却后从同一边、原出口附近重新露头 */
const passExitY = B.y + B.h * 0.5;
resetPrey("pass", B.x + 4, passExitY, 0);   // 界内出发，横穿到右边界后"离场"
escapeN = 0;
for (let i = 0; i < 600 && escapeN < 1; i++) p.update(dt, i * dt);
ok(escapeN === 1 && p.tadFolds === 0, "pass 型：零折返，直接穿过边", `folds=${p.tadFolds}, esc=${escapeN}`);
let rsSide = -1, rsY = 0, rsFound = false;
for (let i = 0; i < 300; i++) {
  const bd = p.darkT;
  p.update(dt, 1 + i * dt);
  if (bd > 0 && p.darkT <= 0) { rsFound = true; rsSide = p.tadSide; rsY = p.tadPeekSy; break; }
}
ok(rsFound && rsSide === 1, "pass 型：离场后从同一边（右）重新进场", `side=${rsSide}`);
ok(rsFound && Math.abs(rsY - passExitY) <= 60, "pass 型：再进场点贴近原出口（±40px 抖动 + 游动漂移）", Math.abs(rsY - passExitY).toFixed(0) + "px");

/* ---------- 9. 长按尾巴·挣扎：整体位置冻结，只尾快摆 + 头扭动 ---------- */
resetPrey("mix", B.x + B.w * 0.5, B.y + B.h * 0.5, 0);
p.tadStruggle = 1; p.tadStruggleT = 0; p.tadStruggleW = 0;
const fx0 = p.x, fy0 = p.y, ph0 = p.tadPhase;
let wobSeen = 0;
for (let i = 0; i < 60; i++) {
  p.update(dt, 20 + i * dt);
  wobSeen = Math.max(wobSeen, Math.abs(p.tadStruggleW || 0));
}
ok(p.x === fx0 && p.y === fy0, "挣扎：整体位置冻结不动", `Δ=(${(p.x - fx0).toFixed(2)},${(p.y - fy0).toFixed(2)})`);
ok(p.tadPhase - ph0 > 5, "挣扎：尾巴快摆（tadPhase 1s 前进 ~15rad）", (p.tadPhase - ph0).toFixed(1) + "rad");
ok(wobSeen > 0.15, "挣扎：头部扭动幅度可见", wobSeen.toFixed(2) + "rad");
p.tadStruggle = 0; p.tadStruggleW = 0;

/* ---------- 10. 无命中悬停档位：无命中越久，游动后停留越多 ---------- */
const realRand = Math.random;
Math.random = () => 0.01;   // 判断式是 Math.random() < p：返回小于各档 p（0.06/0.18/0.34）的值才必中悬停分支；从中心出发，1.2s 内不会触边
const hoverRun = (lastHitGap) => {
  resetPrey("mix", B.x + B.w * 0.5, B.y + B.h * 0.5, 0);
  G.session.time = 100; G.session.lastHitT = 100 - lastHitGap;
  for (let i = 0; i < 72; i++) { G.session.time += dt; p.update(dt, G.session.time); }
  return p.tadHoverN;
};
const hLow = hoverRun(1);    // 1s 无命中 → 档 1（p=0.06，最多 1 次）
const hHigh = hoverRun(20);  // 20s 无命中 → 档 3（p=0.34，最多 3 次）
Math.random = realRand;
ok(hLow === 1, "1s 无命中：1.2s 内只停 1 次（低频档）", String(hLow));
ok(hHigh >= 2 && hHigh <= 3, "20s 无命中：停留频率明显增多（2–3 次）", String(hHigh));

console.log(A.join("\n"));
const bad = A.filter(l => l.startsWith("❌")).length;
console.log(`\n${A.length - bad}/${A.length} 通过`);
process.exit(bad ? 1 : 0);
