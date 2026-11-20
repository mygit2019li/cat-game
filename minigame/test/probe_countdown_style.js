/* probe_countdown_style.js — 游戏前倒计时渲染探针
   目的：真实加载 js/ui.js，调用 ui.drawCountdown，确认新游戏前准备页：
     ① 横屏/竖屏都能绘制且不报错
     ② 不再使用卡片、进度条、按钮或旧版“本局时长”
     ③ 展示 3 秒准备倒计时和单条猫咪提示
   用法：node test/probe_countdown_style.js
*/
const path = require("path");
const ROOT = path.join(__dirname, "..");

let pass = 0, fail = 0;
const out = [];
function ok(cond, msg, detail) {
  out.push((cond ? "✅ " : "❌ ") + msg + (detail != null ? "  → " + detail : ""));
  cond ? pass++ : fail++;
}

function makeCtx() {
  const textLog = [];
  const ctx = {
    __textLog: textLog,
    measureText: (t) => ({ width: String(t || "").length * 7 }),
    fillText: (t) => { textLog.push(String(t)); },
    strokeText: (t) => { textLog.push(String(t)); },
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
  return ctx;
}

function loadUi(platform) {
  const G = {};
  G.platform = platform;
  require(path.join(ROOT, "js/config.js"))(G);
  G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  G.rr = () => {};
  G.draw = new Proxy({}, { get: () => () => {} });
  G.scene = {};
  G.session = { time: 0, stage: 1, running: false, paused: false, counting: true, hits: 0, combo: 0, sea: null };
  G.playTick = () => {};
  G.saveConfig = () => {};
  G.startGame = () => {};
  G.switchScreen = () => {};
  G.endGame = () => {};
  require(path.join(ROOT, "js/ui.js"))(G);
  return G;
}

function run(platform, seconds) {
  const ctx = makeCtx();
  const G = loadUi(Object.assign({ ctx }, platform));
  G.config = Object.assign({}, G.config, { targetType: "tadpole", duration: 180, infinite: false });
  G.ui.buttons.length = 0;
  G.ui.countdown.reset(0);
  ctx.__textLog.length = 0;
  G.ui.drawCountdown(seconds);
  return G;
}

const land = {
  S: 1.5, W: 1200, H: 800,
  safe: { top: 40, bottom: 40, left: 0, right: 0 },
  menu: null
};
const portrait = {
  S: 1.5, W: 750, H: 1334,
  safe: { top: 80, bottom: 40, left: 0, right: 0 },
  menu: null
};

try {
  const g = run(land, 2.42);
  const txt = g.platform.ctx.__textLog.join("|");
  ok(true, "横屏游戏前倒计时可绘制", "drawCountdown(2.42) 无异常");
  ok(txt.split("|").includes("3") && !txt.includes("00:03"), "横屏展示单数字 3 秒倒计时", txt);
  ok(txt.includes("准备出发"), "横屏展示准备出发状态", txt);
  ok(txt.includes("本局倒计时 · 3 秒"), "横屏展示 3 秒倒计时说明", txt);
  ok(txt.includes("独立页"), "横屏展示独立页说明", txt);
  ok(txt.includes("无进度条"), "横屏明确无进度条", txt);
  ok(txt.includes("无按钮"), "横屏明确无按钮", txt);
  ok(txt.includes("倒计时结束后自动进入游戏"), "横屏展示自动进入反馈", txt);
  ok(!txt.includes("本局时长"), "横屏不再展示旧版本局时长卡片", txt);
  ok(!txt.includes("长按暂停可暂停本局"), "横屏倒计时不再出现按钮式暂停提示", txt);
} catch (e) {
  ok(false, "横屏游戏前倒计时可绘制", e.message);
}

try {
  const g = run(portrait, 1.2);
  const txt = g.platform.ctx.__textLog.join("|");
  ok(true, "竖屏游戏前倒计时可绘制", "drawCountdown(1.2) 无异常");
  ok(txt.split("|").includes("2") && !txt.includes("00:02"), "竖屏展示单数字 2 秒倒计时", txt);
  ok(txt.includes("准备出发"), "竖屏保留准备状态标题", txt);
  ok(!txt.includes("本局时长"), "竖屏不再展示旧版本局时长卡片", txt);
  ok(!txt.includes("长按暂停可暂停本局"), "竖屏倒计时不再出现按钮式暂停提示", txt);
} catch (e) {
  ok(false, "竖屏游戏前倒计时可绘制", e.message);
}

try {
  const ctx = makeCtx();
  const G = loadUi(Object.assign({ ctx }, land));
  G.config = Object.assign({}, G.config, { targetType: "tadpole", duration: 180, infinite: false });
  G.ui.countdown.reset(0);
  ctx.__textLog.length = 0;
  G.ui.drawCountdown(3);
  const first = ctx.__textLog.join("|");
  const firstHint = G.ui.countdown.hints[G.ui.countdown.index];
  const secondIndex = G.ui.countdown.index;
  G.ui.countdown.lastAt = -1000;
  ctx.__textLog.length = 0;
  G.ui.drawCountdown(2);
  const second = ctx.__textLog.join("|");
  ok(first.includes(firstHint), "首次绘制展示一条猫咪提示", first.slice(0, 120));
  ok(secondIndex !== G.ui.countdown.index, "再次绘制会切换下一条提示", secondIndex + " -> " + G.ui.countdown.index);
  ok(second.includes(G.ui.countdown.hints[G.ui.countdown.index]), "翻页后展示新的一条猫咪提示", second.slice(0, 120));
} catch (e) {
  ok(false, "单条提示自动上下翻页可执行", e.message);
}

out.forEach(l => console.log(l));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
