/* probe_feeder_fix.js — 验证 feeder.js 两处逻辑修复（纯 Node，无浏览器）
   ① tickTimer modal 守卫：设置面板打开期间不推进饭点（否则会静默漏餐）
   ② dispense 储粮上限：储粮不够时不再白出整份（hopper 不再被扣成负数吞掉）
   用法：node test/probe_feeder_fix.js */
const path = require("path");
const ROOT = path.join(__dirname, "..");

/* ---- G 桩：feeder.js 只用到这些 ---- */
const ctxStub = {
  save: () => {}, restore: () => {}, translate: () => {}, scale: () => {}, rotate: () => {},
  beginPath: () => {}, rect: () => {}, arc: () => {}, ellipse: () => {}, moveTo: () => {}, lineTo: () => {},
  quadraticCurveTo: () => {}, bezierCurveTo: () => {}, closePath: () => {}, clip: () => {},
  fill: () => {}, stroke: () => {}, fillRect: () => {}, strokeRect: () => {}, clearRect: () => {},
  fillText: () => {}, strokeText: () => {}, measureText: () => ({ width: 0 }),
  createLinearGradient: () => ({ addColorStop: () => {} }), createRadialGradient: () => ({ addColorStop: () => {} }),
  setLineDash: () => {}, drawImage: () => {}, setTransform: () => {}, resetTransform: () => {},
  globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "left"
};
const G = {
  platform: { S: 1, W: 390, H: 844, safe: { top: 40, bottom: 40, left: 0, right: 0 }, ctx: ctxStub, dpr: 2,
    storage: { _d: {}, get(k) { return this._d[k] == null ? null : this._d[k]; }, set(k, v) { this._d[k] = v; } } },
  COLORS: new Proxy({}, { get: () => "#000" }),
  config: {
    feedMode: "manual", feedHopper: 100, feedBowl: 0, feedPortion: 3,
    feedIntervalMin: 1, feedNextAt: 0
  },
  rr: () => {},
  saveConfig: () => {}, playMiss: () => {}, playTick: () => {}, track: () => {},
  playFeederDispense: () => {}, ensureAudio: () => {}, stopFeederSound: () => {},
  switchScreen: () => {}, ad: null
};

require(path.join(ROOT, "js/feeder.js"))(G);
const F = G.feeder;
const T = G.FEED;
if (!F || typeof G.feederDispense !== "function" || typeof G.feeder.update !== "function") {
  console.error("feeder 未正确挂载"); process.exit(1);
}

let pass = 0, fail = 0;
const ok = (c, m, e) => { console.log((c ? "✅ " : "❌ ") + m + (e != null ? "  → " + e : "")); c ? pass++ : fail++; };
const reset = (over) => {
  Object.assign(G.config, { feedMode: "manual", feedHopper: 100, feedBowl: 0, feedPortion: 3, feedIntervalMin: 1, feedNextAt: 0 }, over || {});
  F.mode = "home"; F.pellets.length = 0; F.spawnLeft = 0; F.spawnAcc = 0; F.dispensing = 0; F.e = 0; F.holdT = 0; F.skip = false;
};

/* ================= 测试 1：tickTimer modal 守卫（不静默漏餐） ================= */
// 场景：定时模式，饭点已到；设置面板打开（modal）
reset({ feedMode: "timer", feedNextAt: Date.now() - 1000 });
F.mode = "modal";
G.feeder.update(0.016);
const hopInModal = G.config.feedHopper, bowlInModal = G.config.feedBowl, nextInModal = G.config.feedNextAt;
ok(bowlInModal === 0, "① modal 期间不出粮（dispense 被挡）", `bowl=${bowlInModal}`);
ok(nextInModal <= Date.now(), "① modal 期间 feedNextAt 不前进（仍欠饭，未排走）", `feedNextAt=${new Date(nextInModal).toISOString()}`);
// 关闭面板回到 home → 应补发那一顿
F.mode = "home";
G.feeder.update(0.016);
ok(G.config.feedBowl > 0 || F.spawnLeft > 0 || G.config.feedHopper < hopInModal,
   "① 回到 home 后欠的那顿补发了", `bowl=${G.config.feedBowl} spawnLeft=${F.spawnLeft} hopper=${G.config.feedHopper.toFixed(1)}`);
ok(G.config.feedNextAt > Date.now(), "① 补发后 feedNextAt 排到未来", `feedNextAt=${new Date(G.config.feedNextAt).toISOString()}`);

/* ================= 测试 2：dispense 储粮上限（不白出整份） ================= */
// 储粮只够 1 份（floor(2.0/1.6)=1），但用户设了 5 份
reset({ feedHopper: 2.0, feedPortion: 5, feedMode: "manual" });
F.mode = "home";
const dispensed = G.feederDispense();
const spawned = F.spawnLeft, hopAfter = G.config.feedHopper;
ok(dispensed === true, "② 出粮成功返回 true", String(dispensed));
ok(spawned === 1 * T.piecesPerPortion, "② 出粮量被储粮封顶为 1 份（16 颗），而非 5 份（80 颗）",
   `spawnLeft=${spawned}（期望 ${1 * T.piecesPerPortion}）`);
ok(hopAfter > 0 && hopAfter < 0.5, "② 储粮扣到 0.4 而非负数被吞成 0", `hopper=${hopAfter.toFixed(3)}（期望≈0.4）`);
// 边界：储粮不足一份时直接拒绝
reset({ feedHopper: 1.0, feedPortion: 3, feedMode: "manual" });   // floor(1.0/1.6)=0 份
F.mode = "home";
const disp2 = G.feederDispense();
ok(disp2 === false && F.spawnLeft === 0, "② 储粮不足一份时拒绝出粮（不白给）", `ret=${disp2} spawnLeft=${F.spawnLeft}`);

console.log(fail === 0 ? `\nALL PASS (${pass}/${pass + fail})` : `\nFAILED (${fail} 项)`);
process.exit(fail === 0 ? 0 : 1);
