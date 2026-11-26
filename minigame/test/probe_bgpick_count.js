/* probe_bgpick_count.js — 二级选项卡页「猎物数量」控件形态一致性探针
   目的：验证界面与规则一致（G.countModeFor 与 prey.js stageTargetCount 同步）——
     auto   不支持指定数量（蝌蚪快跑 / 群鼠乱窜）：不展示任何 ± 控件，只显示只读徽章；
     binary 仅单只/多只两档（室内房间捕鼠 / 钓鱼 / 蝴蝶花园 / 激光暗室）：展示两档切换，
            写入值只能是 1 / 3，不允许出现 2–7 的"假精确"值；
     exact  真支持指定数量（青蛙跳跳 / 暗夜荧光）：保留 ± 步进，显示值即实际同屏数量。
   判定方式：真实加载 js/ui.js，调 ui.drawBgPick()，再逐个执行 ui.buttons 里的回调，
            看哪些回调真的改动了数量键（preyCount / ffCount）——这是功能级判定，
            不依赖源码字符串或坐标常量。
   卡片基准：数量控件形态按「当前展示卡」判定（翻卡即变），所以 runCase 的初始 idx
            按真实入口逻辑推导（玩法组卡看 configKey，场景页看 bg_<type>）。
   用法：node test/probe_bgpick_count.js */
const path = require("path");
const ROOT = path.join(__dirname, "..");

/* 固定随机种子：卡片画廊有抖动/入场动画，探针需可复现 */
let __seed = 20261120;
Math.random = () => { __seed = (__seed * 1664525 + 1013904223) >>> 0; return __seed / 4294967296; };

const G = {};

/* ---- 画布桩：drawBgPick 会大量调 ctx，全部吞掉 ---- */
/* 文案统一落到 __textLog，供「徽章文案 / 两档标签」抽查读取 */
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
  const hits = [];
  // 遍历按钮副本：回调里可能再次触发绘制，避免边遍历边改
  const btns = G.ui.buttons.slice();
  btns.forEach((b, i) => {
    if (typeof b.cb !== "function") return;
    const pre = snapshot();
    try { b.cb(); } catch (e) { /* 个别按钮依赖运行态，忽略 */ }
    const post = snapshot();
    const changedKeys = COUNT_KEYS.filter(k => pre[k] !== post[k]);
    if (changedKeys.length) {
      const delta = {};
      changedKeys.forEach(k => { delta[k] = { from: pre[k], to: post[k], d: post[k] - pre[k] }; });
      hits.push({ i, key: b.key || null, delta });
    }
    // 复原，保证每个按钮从同一初值出发
    Object.assign(G.config, pre);
  });
  return hits;
}

function runCase(groupKey, targetType, behavior, extraConfig) {
  // 数量键置 3：pm 的两个方向都能看到变化；binary 时「单只」档会 3→1 可见变化，「多只」档 3→3 不变
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
  } else {
    // 场景卡页：初始停在当前已选背景卡（与 G.openBgPick 一致）
    const arr = G.bgsFor(targetType) || [];
    idx = Math.max(0, arr.findIndex(b => b.key === G.currentBg()));
  }

  G.bgPick = {
    group: groupKey, idx, visIdx: idx, off: 0, drag: false, x0: 0, moved: 0,
    cw: 0, ch: 0, gap: 0, t0: (typeof performance !== "undefined" ? performance.now() : Date.now()) - 400,
    relOff: 0, relT0: 0, touchActive: false, selT0: 0
  };

  __textLog.length = 0;
  G.ui.drawBgPick();
  const hits = countChangingButtons();
  // 量词跟 PLAY_TERM 一致：鱼=条、激光=个、其余=只（文案基准已是「当前展示卡」）
  const unit = ({ fish: "条", laser: "个" }[targetType]) || "只";
  const displayText = __textLog.find(t => /^(\d+)\s*(只|条|个)/.test(String(t)));
  return {
    groupKey, targetType, idx, behavior, hits,
    texts: __textLog.slice(),
    displayText,
    expectedDisplayText: G.config[groupKey === "pool" ? "ffCount" : "preyCount"] + " " + unit
  };
}

const A = [];
let pass = 0, fail = 0;
const ok = (c, m, e) => {
  A.push((c ? "✅ " : "❌ ") + m + (e != null ? "  → " + e : ""));
  c ? pass++ : fail++;
};

const cases = [
  // [groupKey, targetType, 期望控件形态, 说明, extraConfig]
  // pm     —— ± 步进：恰好 2 个有效回调，各 ±1 且落在 [1, countMax]
  // toggle —— 单只/多只两档：恰好 1 个有效回调（初值 3 时只有「单只」档生效），写入值必须是 1
  // tad    —— 蝌蚪快跑「单条/多条」选项卡（Tab）：写 tadCount（不在 COUNT_KEYS），hits 恒 0，渲染两档标签
  // none   —— 只读徽章：没有任何回调改数量键
  ["frog", "frog", "pm", "青蛙跳跳 —— 真支持指定数量（1–5，受荷叶数封顶），± 步进"],
  ["frog", "tadpole", "tad", "蝌蚪快跑 —— 「单条/多条」选项卡（Tab），写 tadCount", { frogMode: "tadpole" }],
  ["pool", "pool", "pm", "暗夜荧光 —— ffCount 1–7 真可调"],
  ["butterfly", "butterfly", "toggle", "蝴蝶花园 —— 仅单只/多只两档，两档切换"],
  ["laser", "laser", "toggle", "激光暗室 —— 仅单只/多只两档，两档切换"],
  [null, "mouse", "none", "群鼠乱窜 —— 数量由阶段固定 4/5/6，不展示 ± 控件，显示只读徽章", { bg_mouse: "swarm" }],
  [null, "mouse", "toggle", "室内房间捕鼠 —— 仅单只/多只两档，两档切换", { bg_mouse: "room" }]
];

for (const [gk, tt, behavior, desc, extraConfig] of cases) {
  const r = runCase(gk, tt, behavior, extraConfig);
  const shown = r.groupKey ? G.MODE_GROUPS[r.groupKey].cards[r.idx].name : (G.bgsFor(r.targetType) || [])[r.idx].name;

  if (behavior === "pm") {
    ok(r.hits.length === 2, `${desc}：± 回调数 = 2（展示卡：${shown}）`, `实测 ${r.hits.length}`);
    if (r.hits.length === 2) {
      const ds = r.hits.flatMap(h => Object.values(h.delta)).map(v => v.d).sort((a, b) => a - b);
      ok(ds[0] === -1 && ds[1] === 1, `${desc}：增减方向各 ±1`, JSON.stringify(ds));
      ok(r.displayText === r.expectedDisplayText,
        `${desc}：数量显示绑定实际值（${r.expectedDisplayText}）`,
        `实测 ${r.displayText == null ? "(未捕获)" : r.displayText}`);
    }
  } else if (behavior === "toggle") {
    ok(r.hits.length === 1, `${desc}：两档切换恰好 1 个生效回调（初值 3，仅「单只」档产生变化；展示卡：${shown}）`, `实测 ${r.hits.length}`);
    if (r.hits.length === 1) {
      const vals = r.hits[0].delta;
      const okVals = Object.values(vals).every(v => v.to === 1 || v.to === 3);
      ok(okVals, `${desc}：写入值只能是 1 / 3（不允许 2–7 假精确值）`, JSON.stringify(vals));
      ok(r.texts.includes("单只") && r.texts.includes("多只"),
        `${desc}：面板同时渲染「单只」「多只」两档`,
        r.texts.filter(t => t === "单只" || t === "多只").join(" | ") || "(未出现)");
      ok(!r.displayText, `${desc}：两档形态不渲染数值文本`, r.displayText || "(无数值)");
    }
  } else if (behavior === "tad") {
    /* 蝌蚪快跑：Tab 写 tadCount（不在 COUNT_KEYS），故 preyCount/ffCount 回调恒 0；
       断言渲染了「单条 / 多条」两档选项卡，且不渲染数值文本。 */
    ok(r.hits.length === 0, `${desc}：±/两档均不写 preyCount/ffCount（Tab 写 tadCount）（展示卡：${shown}）`, r.hits.length ? JSON.stringify(r.hits) : "");
    ok(r.texts.includes("单条") && r.texts.includes("多条"),
      `${desc}：面板渲染「单条 / 多条」选项卡（Tab）两档`,
      r.texts.filter(t => t === "单条" || t === "多条").join(" | ") || "(未出现)");
    ok(!r.displayText, `${desc}：Tab 形态不渲染数值文本`, r.displayText || "(无数值)");
  } else { // none
    ok(r.hits.length === 0, `${desc}：无任何数量调节回调（展示卡：${shown}）`, r.hits.length ? JSON.stringify(r.hits) : "");
    const badge = r.texts.find(t => /自动 \d+–\d+ 只|固定 1 只/.test(t));
    ok(!!badge, `${desc}：显示只读徽章「${badge}」`, badge ? undefined : "(未捕获到徽章文案)");
  }
}

/* ---- 补充：卡片翻转即时性 —— 同一玩法组内翻到不同卡，形态立即切换 ---- */
function captureState(groupKey, idx, extraConfig) {
  G.config = Object.assign({}, G.config, { targetType: groupKey === "frog" ? "frog" : "butterfly", preyCount: 3, ffCount: 3 }, extraConfig || {});
  G.bgPick = {
    group: groupKey, idx, visIdx: idx, off: 0, drag: false,
    x0: 0, moved: 0, cw: 0, ch: 0, gap: 0,
    t0: (typeof performance !== "undefined" ? performance.now() : Date.now()) - 400,
    relOff: 0, relT0: 0, touchActive: false, selT0: 0
  };
  __textLog.length = 0;
  G.ui.drawBgPick();
  return { texts: __textLog.slice(), hits: countChangingButtons() };
}

try {
  // 青蛙玩法组：停在青蛙卡（idx 0）→ ± 步进；翻到蝌蚪卡（idx 1）→ 只读徽章
  const frogCard = captureState("frog", 0);
  ok(frogCard.hits.length === 2, "青蛙卡（idx 0）显示 ± 步进", `实测 ${frogCard.hits.length}`);
  ok(frogCard.texts.some(t => t === "青蛙数量"), "青蛙卡标题为「青蛙数量」", frogCard.texts.includes("青蛙数量") ? "ok" : "(未出现)");
  ok(frogCard.texts.some(t => /\d+\s*只/.test(t)), "青蛙卡显示可调数值（N 只）", frogCard.texts.filter(t => /\d+\s*只/.test(t)).join(" | ") || "(未捕获)");
  const tadCard = captureState("frog", 1);
  ok(tadCard.hits.length === 0, "翻到蝌蚪卡（idx 1）后 ± 立即消失（Tab 写 tadCount，不改 preyCount/ffCount）", `实测 ${tadCard.hits.length}`);
  ok(tadCard.texts.some(t => t === "单条") && tadCard.texts.some(t => t === "多条"),
    "蝌蚪卡显示「单条 / 多条」选项卡（Tab）两档",
    tadCard.texts.filter(t => t === "单条" || t === "多条").join(" | ") || "(未捕获)");
  // 鼠标场景页：停在房间卡 → 两档切换；翻到群鼠卡 → 只读徽章
  const roomCard = captureState(null, 0, { targetType: "mouse", bg_mouse: "room" });
  ok(roomCard.hits.length === 1, "房间卡（idx 0）显示单只/多只两档", `实测 ${roomCard.hits.length}`);
  const swarmCard = captureState(null, 1, { targetType: "mouse", bg_mouse: "swarm" });
  ok(swarmCard.hits.length === 0, "翻到群鼠卡（idx 1）后两档立即消失", `实测 ${swarmCard.hits.length}`);
  ok(swarmCard.texts.some(t => t.includes("自动 4–6 只")), "群鼠卡显示「自动 4–6 只」徽章", swarmCard.texts.filter(t => t.includes("自动")).join(" | ") || "(未捕获)");
} catch (e) {
  ok(false, "卡片翻转即时性检查执行异常", e.message);
}

console.log(A.join("\n"));
console.log(fail === 0 ? `\nALL PASS (${pass}/${pass + fail})` : `\nFAILED (${fail} 项)`);
process.exit(fail === 0 ? 0 : 1);
