/* probe_bgpick_count.js — 二级选项卡页「猎物数量」控件一致性探针
   目的：验证界面与规则一致——数量由引擎自动决定、用户调了不生效的模式，
        必须隐藏 ± 增减控件，只显示只读徽章。
   判定方式：真实加载 js/ui.js，调 ui.drawBgPick()，再逐个执行 ui.buttons 里的回调，
            看哪些回调真的改动了数量键（preyCount / ffCount）——这是功能级判定，
            不依赖源码字符串或坐标常量。
   用法：node test/probe_bgpick_count.js */
const path = require("path");
const ROOT = path.join(__dirname, "..");

/* 固定随机种子：卡片画廊有抖动/入场动画，探针需可复现 */
let __seed = 20261120;
Math.random = () => { __seed = (__seed * 1664525 + 1013904223) >>> 0; return __seed / 4294967296; };

const G = {};

/* ---- 画布桩：drawBgPick 会大量调 ctx，全部吞掉 ---- */
/* 文案统一落到 __textLog，供「徽章文案抽查」读取 */
const __textLog = [];
const ctx = {
  measureText: (t) => ({ width: String(t || "").length * 7 }),
  fillText: (t) => { __textLog.push(String(t)); },
  strokeText: (t) => { __textLog.push(String(t)); },
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
  createPattern: () => ({}),
  save: () => {}, restore: () => {}, translate: () => {}, scale: () => {}, rotate: () => {},
  setTransform: () => {}, resetTransform: () => {},
  beginPath: () => {}, rect: () => {}, closePath: () => {}, clip: () => {},
  moveTo: () => {}, lineTo: () => {}, arc: () => {}, arcTo: () => {}, ellipse: () => {},
  quadraticCurveTo: () => {}, bezierCurveTo: () => {},
  stroke: () => {}, fill: () => {}, clearRect: () => {}, fillRect: () => {}, strokeRect: () => {},
  drawImage: () => {}, setLineDash: () => {}, putImageData: () => {},
  createImageData: () => ({ data: [] }), getImageData: () => ({ data: [] }),
  globalAlpha: 1, globalCompositeOperation: "source-over",
  fillStyle: "", strokeStyle: "", lineWidth: 1, lineCap: "butt", lineJoin: "miter",
  font: "", textAlign: "left", textBaseline: "alphabetic", shadowBlur: 0, shadowColor: ""
};

G.platform = {
  S: 1.5, W: 1200, H: 800,
  safe: { top: 40, bottom: 40, left: 0, right: 0 },
  menu: null,
  ctx,
  storage: {
    _d: {},
    get(k) { return this._d[k] == null ? null : this._d[k]; },
    set(k, v) { this._d[k] = v; }
  }
};

require(path.join(ROOT, "js/config.js"))(G);

/* ---- ui.js 的外部依赖桩（ui.js 内部函数自带，不用管） ---- */
G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
if (!G.COLORS) {
  G.COLORS = new Proxy({}, { get: () => "#000" });
}
/* scenery.js 提供的圆角矩形路径构造器：只建路径，不参与数量逻辑 → 空实现 */
G.rr = () => {};
G.draw = new Proxy({}, { get: () => () => {} });
G.scene = {};
G.session = { time: 0, stage: 1, running: false, combo: 0, hits: 0 };
G.playTick = () => {};
G.saveConfig = () => {};
G.closeBgPick = () => {};
G.openStart = () => {};
G.startGame = () => {};
G.playSfx = () => {};
G.vibrate = () => {};

require(path.join(ROOT, "js/ui.js"))(G);

if (!G.ui || typeof G.ui.drawBgPick !== "function") {
  console.error("ui.drawBgPick 未挂载，加载链有问题");
  process.exit(1);
}

/* ---- 功能级探测：执行每个按钮回调，看是否改动了数量键 ---- */
const COUNT_KEYS = ["preyCount", "ffCount"];

function snapshot() {
  const s = {};
  COUNT_KEYS.forEach(k => { s[k] = G.config[k]; });
  return s;
}

function countChangingButtons() {
  const before = snapshot();
  const hits = [];
  // 遍历按钮副本：回调里可能再次触发绘制，避免边遍历边改
  const btns = G.ui.buttons.slice();
  btns.forEach((b, i) => {
    if (typeof b.cb !== "function") return;
    const pre = snapshot();
    try { b.cb(); } catch (e) { /* 个别按钮依赖运行态，忽略 */ }
    const post = snapshot();
    const changed = COUNT_KEYS.some(k => pre[k] !== post[k]);
    if (changed) {
      const delta = {};
      COUNT_KEYS.forEach(k => { if (pre[k] !== post[k]) delta[k] = post[k] - pre[k]; });
      hits.push({ i, key: b.key || null, delta });
    }
    // 复原，保证每个按钮从同一初值出发
    Object.assign(G.config, pre);
  });
  void before;
  return hits;
}

function runCase(groupKey, targetType, expectPlusMinus, expectNote, extraConfig) {
  // 数量键置 3：这样 ± 两个方向都会产生可见变化（1 处会因下限封顶测不出来）
  G.config = Object.assign({}, G.config, {
    targetType,
    preyCount: 3,
    ffCount: 3,
    difficulty: "normal"
  }, extraConfig || {});
  const g = groupKey ? G.MODE_GROUPS[groupKey] : null;
  let idx = 0;
  if (g) {
    const cur = G.config[g.configKey];
    idx = g.cards.findIndex(c => c.key === cur);
    if (idx < 0) idx = 0;
  }

  G.bgPick = {
    group: groupKey, idx, visIdx: idx, off: 0, drag: false, x0: 0, moved: 0,
    cw: 0, ch: 0, gap: 0, t0: (typeof performance !== "undefined" ? performance.now() : Date.now()) - 400,
    relOff: 0, relT0: 0, touchActive: false, selT0: 0
  };

  __textLog.length = 0;
  G.ui.drawBgPick();
  const hits = countChangingButtons();
  const expectedCountKey = groupKey && groupKey === "pool" ? "ffCount" : "preyCount";
  const displayText = __textLog.find(t => /^(\d+)\s*(只|条)/.test(String(t)));
  return {
    groupKey,
    targetType,
    hits,
    notes: G.ui.buttons.length,
    expectedCountKey,
    displayText,
    expectedDisplayText: G.config[expectedCountKey] + (targetType === "fish" ? " 条" : " 只")
  };
}

const A = [];
let pass = 0, fail = 0;
const ok = (c, m, e) => {
  A.push((c ? "✅ " : "❌ ") + m + (e != null ? "  → " + e : ""));
  c ? pass++ : fail++;
};

const cases = [
  // [groupKey, targetType, 期望±回调数, 说明]
  ["frog", "frog", 0, "青蛙跳跳 —— 数量由阶段按荷叶数自动 3→4→5，调 preyCount 无效"],
  ["frog", "tadpole", 0, "蝌蚪快跑 —— 阶段基线 + 命中能力动态 1–3，不可手调"],
  ["pool", "pool", 2, "暗夜荧光 —— ffCount 1–7 真可调"],
  ["butterfly", "butterfly", 2, "蝴蝶花园 —— preyCount 可调"],
  ["laser", "laser", 2, "激光暗室 —— preyCount 可调"],
  [null, "mouse", 0, "群鼠乱窜 —— 数量由阶段固定 4/5/6，调 preyCount 无效", { bg_mouse: "swarm" }],
  [null, "mouse", 2, "室内房间捕鼠 —— preyCount 仍保留增减入口", { bg_mouse: "room" }]
];

for (const [gk, tt, expect, desc, extraConfig] of cases) {
  const r = runCase(gk, tt, expect, null, extraConfig);
  const expectAdjustable = expect > 0;
  ok(r.hits.length === expect,
    `${desc}：数量增减回调数 = ${expect}`,
    `实测 ${r.hits.length}` + (r.hits.length ? " " + JSON.stringify(r.hits.map(h => h.delta)) : ""));
  if (expectAdjustable) {
    ok(r.displayText === r.expectedDisplayText,
      `${desc}：数量显示绑定 ${r.expectedCountKey}=${G.config[r.expectedCountKey]}`,
      `实测 ${r.displayText == null ? "(未捕获)" : r.displayText}，期望 ${r.expectedDisplayText}`);
  }
}

/* ---- 补充：徽章文案抽查（青蛙应显示只读文案而非「N 只」） ---- */
function captureTexts(groupKey, targetType) {
  G.config = Object.assign({}, G.config, { targetType, preyCount: 3, ffCount: 3 });
  G.bgPick = {
    group: groupKey, idx: 0, visIdx: 0, off: 0, drag: false,
    x0: 0, moved: 0, cw: 0, ch: 0, gap: 0,
    t0: (typeof performance !== "undefined" ? performance.now() : Date.now()) - 400,
    relOff: 0, relT0: 0, touchActive: false, selT0: 0
  };
  __textLog.length = 0;
  G.ui.drawBgPick();
  return __textLog.slice();
}

try {
  const frogTexts = captureTexts("frog", "frog");
  ok(frogTexts.some(t => t.includes("自动")), "青蛙卡显示「自动 x–y 只」只读徽章", frogTexts.filter(t => t.includes("自动")).join(" | ") || "(未捕获)");
  ok(frogTexts.some(t => t === "猎物数量"), "青蛙卡标题改用中性「猎物数量」", frogTexts.includes("猎物数量") ? "ok" : "(未出现)");
  const tadTexts = captureTexts("frog", "tadpole");
  ok(tadTexts.some(t => t.includes("自动 1")), "蝌蚪卡仍显示「自动 1–3 只」", tadTexts.filter(t => t.includes("自动")).join(" | ") || "(未捕获)");
  const bflyTexts = captureTexts("butterfly", "butterfly");
  ok(bflyTexts.some(t => /3\s*只/.test(t) || /\d+\s*只/.test(t)), "蝴蝶卡显示可调数值（N 只）", bflyTexts.filter(t => /\d+\s*只/.test(t)).join(" | ") || "(未捕获)");
} catch (e) {
  ok(false, "文案抽查执行异常", e.message);
}

console.log(A.join("\n"));
console.log(fail === 0 ? `\nALL PASS (${pass}/${pass + fail})` : `\nFAILED (${fail} 项)`);
process.exit(fail === 0 ? 0 : 1);
