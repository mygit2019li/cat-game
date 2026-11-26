/* probe_tadpole_select.js — 青蛙玩法组「蝌蚪快跑」卡选中路径探针（真实代码级）
   做法：给 Node 注入 wx 垫片 + 画布/音频 stub，直接 require 真实 game.js（装配全部模块），
   再驱动真实的 G.platform.onTouchStart/Move/End 模拟用户手势，逐条验证 4 条选中路径：
     A. 点右侧露出的蝌蚪卡（侧卡热区 btn → G.bgPickArrow(1)）
     B. 点蝌蚪的指示点（btn → G.bgPickJump(1)）
     C. 向左拖动中间卡（bgPickTouchStart→Move→End，位移<0 → dir=+1）
     D. 点中间卡、松手在右边缘之外（bgPickTouchEnd 无位移「点按翻页」分支）
   在 手机(S=1) 与 平板(S≈1.55) 两种缩放下各跑一遍，定位单位/命中问题。
   用法：node test/probe_tadpole_select.js */
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..");

/* 固定随机种子，保证可复现 */
let __seed = 20261125;
Math.random = () => { __seed = (__seed * 1664525 + 1013904223) >>> 0; return __seed / 4294967296; };

/* ---------- 画布 2d ctx stub：吞掉所有绘制调用 ---------- */
const __textLog = [];
function makeCtx() {
  const magic = () => makeCtx();   // 渐变/图案等返回可继续调用的 stub
  return new Proxy({}, {
    get(t, k) {
      if (k === "measureText") return (txt) => ({ width: String(txt == null ? "" : txt).length * 7 });
      if (k === "fillText" || k === "strokeText") return (txt) => { __textLog.push(String(txt)); };
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (k === "createPattern") return () => ({});
      if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      if (k === "createImageData") return () => ({ data: new Uint8ClampedArray(4) });
      if (typeof k === "symbol") return undefined;
      // 其余一律 no-op 函数；属性赋值走 set 陷阱（默认存到 target）
      return (..._a) => {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

/* ---------- 魔术 stub：任意属性可访问、可调用，返回自身链（音频节点等） ---------- */
function makeMagic() {
  const f = function () { return stub; };
  const stub = new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === "then") return undefined;           // 避免被当 Promise
      return stub;
    },
    apply() { return stub; },
    set() { return true; }
  });
  return stub;
}

/* ---------- 平台尺寸（物理像素）：S 由 platform.computeScale 按面积推算 ---------- */
const PLATFORMS = {
  phone:  { W: 390,  H: 844, dpr: 3, safe: { left: 0, top: 44, right: 390, bottom: 810 } },
  tablet: { W: 1024, H: 768, dpr: 2, safe: { left: 30, top: 30, right: 994, bottom: 738 } }
};

function installWx(plat) {
  const ctx = makeCtx();
  const canvas = {
    width: plat.W, height: plat.H,
    _ctx: ctx,
    getContext: () => ctx,
    toDataURL: () => "data:image/png;base64,",
    addEventListener: () => {}, removeEventListener: () => {}
  };
  let first = true;
  const store = {};
  const touchCbs = { start: [], move: [], end: [] };
  const wx = {
    getSystemInfoSync: () => ({
      windowWidth: plat.W, windowHeight: plat.H, pixelRatio: plat.dpr,
      safeArea: plat.safe, statusBarHeight: 20, platform: "devtools", SDKVersion: "3.0.0"
    }),
    getMenuButtonBoundingClientRect: () => ({ left: plat.W - 94, top: 4, right: plat.W - 7, bottom: 36, width: 87, height: 32 }),
    createCanvas: () => (first ? (first = false, canvas) : { width: 300, height: 150, getContext: () => makeCtx(), toDataURL: () => "" }),
    createImage: () => ({ set src(v) {}, addEventListener: () => {}, width: 0, height: 0 }),
    setKeepScreenOn: () => {}, vibrateShort: () => {}, vibrateLong: () => {},
    getStorageSync: (k) => (k in store ? store[k] : ""),
    setStorageSync: (k, v) => { store[k] = v; },
    getAccountInfoSync: () => ({ miniProgram: { envVersion: "develop" } }),
    setEnableDebug: () => {}, getLaunchOptionsSync: () => ({ query: {} }),
    createWebAudioContext: () => makeMagic(),
    createInnerAudioContext: () => makeMagic(),
    createCustomAd: () => makeMagic(),
    getOpenDataContext: () => ({ postMessage: () => {} }),
    getSetting: (o) => o && o.success && o.success({ authSetting: {} }),
    authorize: (o) => o && o.success && o.success({}),
    openSetting: (o) => o && o.success && o.success({ authSetting: {} }),
    showModal: (o) => o && o.success && o.success({ confirm: true }),
    showShareMenu: () => {}, onShareAppMessage: () => {}, shareAppMessage: () => {},
    setUserCloudStorage: () => {},
    env: { USER_DATA_PATH: "" },
    getFileSystemManager: () => ({ copyFileSync: () => {}, unlinkSync: () => {}, accessSync: () => { throw new Error("no"); } }),
    chooseMedia: (o) => o && o.fail && o.fail({ errMsg: "cancel" }),
    chooseMessageFile: (o) => o && o.fail && o.fail({ errMsg: "cancel" }),
    chooseImage: (o) => o && o.fail && o.fail({ errMsg: "cancel" }),
    getRecorderManager: () => makeMagic(),
    showKeyboard: () => {}, hideKeyboard: () => {}, onKeyboardInput: () => {}, offKeyboardInput: () => {},
    onKeyboardComplete: () => {}, offKeyboardComplete: () => {},
    onWindowResize: () => {}, onShow: () => {}, onHide: () => {},
    onTouchStart: (cb) => touchCbs.start.push(cb),
    onTouchMove: (cb) => touchCbs.move.push(cb),
    onTouchEnd: (cb) => touchCbs.end.push(cb)
  };
  return { wx, touchCbs };
}

/* ---------- 加载真实 game.js（每个平台一个独立 G） ---------- */
function loadGame(plat) {
  // 每次都用全新全局，避免模块缓存串状态
  const { wx } = installWx(plat);
  global.wx = wx;
  global.requestAnimationFrame = () => 0;          // 不跑主循环：只加载 + 手动驱动
  if (typeof globalThis.performance === "undefined") globalThis.performance = { now: () => Date.now() };

  // 强制模块缓存失效：game.js 与 js/* 每次重新执行
  const files = ["game.js", "js/platform.js", "js/config.js", "js/audio.js", "js/draw.js",
    "js/scenery.js", "js/prey.js", "js/ui.js", "js/sharecard.js", "js/ad.js", "js/feeder.js"];
  files.forEach(f => { try { delete require.cache[require.resolve(path.join(ROOT, f))]; } catch (e) {} });

  const G = globalThis.G = {};
  require(path.join(ROOT, "game.js"));
  return globalThis.G;
}

let pass = 0, fail = 0;
const A = [];
const ok = (c, m, e) => { A.push((c ? "✅ " : "❌ ") + m + (e != null ? "  → " + e : "")); c ? pass++ : fail++; };

/* 进入 bgpick（青蛙组，起始 idx=0 青蛙跳跳）并绘制一帧注册按钮 */
function enterFrogPick(G, idx) {
  G.config = Object.assign({}, G.config, { targetType: "frog", frogMode: "frog", preyCount: 3, difficulty: "normal" });
  const g = G.MODE_GROUPS["frog"];
  const idx0 = Math.max(0, g.cards.findIndex(b => b.key === (G.config[g.configKey] || "frog")));
  G.bgPick = { idx, visIdx: idx, off: 0, drag: false, x0: 0, moved: 0, cw: 0, ch: 0, gap: 0,
    t0: performance.now() - 400, relOff: 0, relT0: 0, touchActive: false, selT0: 0, group: "frog" };
  G.screen = "bgpick";
  G.ui.drawBgPick();          // 注册按钮 + 写 P.cw/ch/gap
  return G.bgPick;
}
const vsize = (G) => ({ S: G.platform.S || 1, vW: G.platform.W / (G.platform.S || 1), vH: G.platform.H / (G.platform.S || 1) });
const tap = (G, x, y) => {
  const t = { clientX: x, clientY: y, identifier: 1 };
  G.platform.onTouchStart({ touches: [t], changedTouches: [t] });
  G.platform.onTouchEnd({ touches: [], changedTouches: [t] });
};
const drag = (G, x0, y0, x1, y1) => {
  const t = { clientX: x0, clientY: y0, identifier: 1 };
  G.platform.onTouchStart({ touches: [t], changedTouches: [t] });
  const t2 = { clientX: x1, clientY: y1, identifier: 1 };
  G.platform.onTouchMove({ touches: [t2], changedTouches: [t2] });
  G.platform.onTouchEnd({ touches: [], changedTouches: [t2] });
};
/* 从按钮表里找几何特征匹配的按钮 */
function findBtn(G, pred) { return G.ui.buttons.filter(pred); }
const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

for (const [pname, plat] of Object.entries(PLATFORMS)) {
  console.log("\n================ " + pname + "（物理 " + plat.W + "×" + plat.H + "）================");
  let G;
  try { G = loadGame(plat); } catch (e) {
    console.error("加载 game.js 失败（" + pname + "）:", e && e.stack || e);
    ok(false, pname + "：game.js 加载", (e && e.message) || String(e));
    continue;
  }
  const { S, vW, vH } = vsize(G);
  console.log("  S=" + S.toFixed(3) + "  虚拟 " + Math.round(vW) + "×" + Math.round(vH));

  /* 绘制一帧拿几何量 */
  const P0 = enterFrogPick(G, 0);
  const CH = P0.ch || 0, CW = P0.cw || 0;
  /* 侧卡热区：唯一 h≈CH 的高按钮（其余按钮 h 都远小于 CH）。按中心点分左/右。 */
  const cardBtns = findBtn(G, b => b.h >= CH * 0.85);
  const rightSide = cardBtns.filter(b => center(b).x >= vW * 0.5).sort((a, b) => b.w - a.w)[0];
  const leftSide = cardBtns.filter(b => center(b).x < vW * 0.5).sort((a, b) => b.w - a.w)[0];
  /* 指示点：小方块里 y 最小的一排（点卡在面板上方），取其中 x 较大者 = tadpole。
     面板里的 ±/开关也是小方块但 y 更靠下，用 y 最小行排除。 */
  const sq = findBtn(G, b => b.w >= 20 && b.w <= 48 && Math.abs(b.w - b.h) <= 8 && b.y > CH * 0.3);
  let tadDot = null;
  if (sq.length) {
    const miny = Math.min.apply(null, sq.map(b => b.y));
    const dots = sq.filter(b => Math.abs(b.y - miny) <= 12);
    tadDot = dots.slice().sort((a, b) => a.x - b.x)[1] || dots[dots.length - 1];
  }
  console.log("  卡 CW×CH = " + Math.round(CW) + "×" + Math.round(CH) + "  (屏宽 " + Math.round(vW) + ")");
  console.log("  侧卡热区: 左 " + (leftSide ? "[" + Math.round(leftSide.x) + "," + Math.round(leftSide.x + leftSide.w) + "]" : "无")
    + "  右 " + (rightSide ? "[" + Math.round(rightSide.x) + "," + Math.round(rightSide.x + rightSide.w) + "]" : "无"));
  console.log("  指示点候选(最小y行):", sq.length ? "minY=" + Math.round(Math.min.apply(null, sq.map(b => b.y))) : "无",
    " tadDot=" + (tadDot ? "(" + Math.round(center(tadDot).x) + "," + Math.round(center(tadDot).y) + ")" : "缺失"));

  const run = (label, fn) => {
    enterFrogPick(G, 0);                 // 复位到 idx 0
    let idxAfter, extra = "";
    try { idxAfter = fn(G); } catch (e) { idxAfter = -99; extra = "异常:" + e.message; }
    ok(idxAfter === 1, label + " → 蝌蚪(idx1) " + (idxAfter === 1 ? "已选中" : "未选中(idx=" + idxAfter + ")"), extra);
    return idxAfter;
  };

  /* A：点右侧露出的蝌蚪卡（侧卡热区） */
  run("[A] 点右侧露出的蝌蚪卡", (GG) => {
    if (!rightSide) return -1;
    const c = center(rightSide);
    tap(GG, c.x, c.y);
    return GG.bgPick.idx;
  });

  /* B：点蝌蚪指示点 */
  run("[B] 点蝌蚪指示点", (GG) => {
    if (!tadDot) return -1;
    const c = center(tadDot);
    tap(GG, c.x, c.y);
    return GG.bgPick.idx;
  });

  /* C：向左拖动中间卡 */
  run("[C] 向左拖动中间卡", (GG) => {
    const P = GG.bgPick;
    const step = (P.cw || 1) + (P.gap || 0);
    const y = vH * 0.45;
    drag(GG, vW / 2, y, vW / 2 - step * 0.4, y);
    return GG.bgPick.idx;
  });

  /* D：点中间卡、松手在右边缘之外（无位移点按翻页分支） */
  run("[D] 点中间卡·松手在右缘外", (GG) => {
    const P = GG.bgPick;
    const y = vH * 0.45;
    const t = { clientX: vW / 2, clientY: y, identifier: 1 };
    GG.platform.onTouchStart({ touches: [t], changedTouches: [t] });
    const t2 = { clientX: vW * 0.93, clientY: y, identifier: 1 };   // 松手落在右缘外
    GG.platform.onTouchEnd({ touches: [], changedTouches: [t2] });
    const half = (P.cw || plat.W * 0.64) / 2;
    return GG.bgPick.idx;   // 阈值 = 物理W/2 + 虚拟half → 平板下可能够不到
  });

  /* 额外诊断：点「开始游戏」确认选择是否写入 frogMode/targetType（验证选中是否真的生效） */
  enterFrogPick(G, 0);
  // 先翻到蝌蚪（用可靠的拖动）
  {
    const P = G.bgPick; const step = (P.cw || 1) + (P.gap || 0); const y = vH * 0.45;
    drag(G, vW / 2, y, vW / 2 - step * 0.4, y);
  }
  const startBtn = findBtn(G, b => b.w > 80 && b.h > 30 && b.y > vH * 0.6).sort((a, b) => b.w - a.w)[0];
  if (startBtn) {
    const c = center(startBtn);
    const frogModeBefore = G.config.frogMode, ttBefore = G.config.targetType;
    let startedAs = "?";
    G.startGame = () => { startedAs = G.config.targetType; };   // 拦截 startGame 看它按什么开
    tap(G, c.x, c.y);
    console.log("  [E] 翻到蝌蚪后点「开始游戏」：idx=" + (G.bgPick ? G.bgPick.idx : "null(已确认)"));
    ok(startedAs === "tadpole", "[E] 确认后按蝌蚪开局（startGame 收到 tadpole）", "startGame 收到 " + startedAs + "（确认前 frogMode=" + frogModeBefore + ", targetType=" + ttBefore + "）");
  } else {
    ok(false, "[E] 未找到「开始游戏」按钮");
  }
}

console.log("\n----------------------------------------");
console.log(A.join("\n"));
console.log(fail === 0 ? `\nALL PASS (${pass}/${pass + fail})` : `\nFAILED (${fail} 项)`);
process.exit(fail === 0 ? 0 : 1);
