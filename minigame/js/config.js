/* config.js — 配置持久化 + 全部玩法参数表（与 H5 原型 1:1 对齐） */
module.exports = function (G) {
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  G.rand = rand; G.clamp = clamp;

  /* 游戏名称：必须与微信公众平台提审登记名称完全一致（备案/审核校验项）
     修改时只改这一处，首页大标题等全局生效 */
  G.GAME_NAME = "逗猫触屏玩具";

  const DEFAULTS = {
    targetType: "fish", preyCount: 3, difficulty: "normal", duration: 180,
    sound: true, vibrate: true, adaptive: true
  };
  function loadConfig() {
    let saved = {};
    try { saved = JSON.parse(G.platform.storage.get("catToyConfig") || "{}") || {}; } catch (e) {}
    const c = Object.assign({}, DEFAULTS, saved);
    c.preyCount = Number(c.preyCount) === 1 ? 1 : 3;   // 两档：单只/多只
    c.sound = !!c.sound; c.vibrate = !!c.vibrate; c.adaptive = !!c.adaptive;
    return c;
  }
  G.saveConfig = () => G.platform.storage.set("catToyConfig", JSON.stringify(G.config));
  G.config = loadConfig();

  G.session = {
    running: false, paused: false, counting: false,
    time: 0, secAcc: 0, remaining: 0,
    touches: 0, hits: 0, bonusHits: 0, combo: 0, maxCombo: 0, missStreak: 0,
    adaptiveTier: 0, comboTier: 0, stage: 1,
    dartStreak: 0, dartHits: 0
  };

  /* 阶段名称 */
  const STAGE_NAME = {
    fish: { 1: "阶段① 小鱼开始逃跑啦", 2: "阶段② 上下游动", 3: "阶段③ 自由游动" },
    mouse: { 1: "阶段① 慢速探头", 2: "阶段② 快速轮换", 3: "阶段③ 闪电地鼠" },
    butterfly: { 1: "阶段① 轻舞飞扬", 2: "阶段② 花间穿梭", 3: "阶段③ 疾风蝶影" },
    laser: { 1: "阶段① 缓缓游走", 2: "阶段② 快速闪现", 3: "阶段③ 疯狂光点" }
  };
  G.stageName = (n) => (STAGE_NAME[G.config.targetType] || STAGE_NAME.fish)[n];

  /* 激光三阶段：甩动 → 停住（主要命中窗口）→ 再甩 */
  G.LASER_PARAMS = {
    1: { hold: [1.0, 1.4], dart: [0.9, 1.6], tele: 0,    trail: false },
    2: { hold: [0.6, 1.0], dart: [0.5, 1.0], tele: 0.12, trail: true },
    3: { hold: [0.4, 0.6], dart: [0.3, 0.7], tele: 0.15, trail: true }
  };
  /* 蝶式飞行参数（最终调优版：中位 235px/s ≈ 基线 2.08×） */
  G.BFLY_PARAMS = {
    1: { glide: [0.4, 0.65], impulse: [105, 160], up: [33, 51], hoverChance: 0,    turn: 0.014, drag: 0.7, land: null },
    2: { glide: [0.3, 0.55], impulse: [125, 185], up: [38, 60], hoverChance: 0.35, turn: 0.02,  drag: 0.7,
         land: { interval: () => rand(3, 5), chance: 0.5, dur: () => rand(1.0, 1.8) } },
    3: { glide: [0.22, 0.4], impulse: [155, 230], up: [46, 72], hoverChance: 0.3,  turn: 0.04,  drag: 0.7,
         land: { interval: () => rand(5, 8), chance: 0.3, dur: () => rand(0.6, 1.1) } }
  };
  /* 蝴蝶花色 variants：写实淡色系——白色/淡黄为主（w = 出现权重），保留少量真实虎斑蝶橙
     HD 皮肤沿用既有贴图 key（cabbage=白 / sulawesi=黄 / monarch=橙），高饱和蓝绿紫已移除 */
  G.BFLY_VARIANTS = [
    { key: "cabbage", name: "菜粉蝶", size: 0.95, speed: 0.85, w: 3,
      fore: "#e6e5d8", fore2: "#f8f8f0", hind: "#d6d5c6", hind2: "#ecebe0", body: "#5f5f52" },
    { key: "cabbage", name: "小白蝶", size: 0.76, speed: 1.05, w: 2,
      fore: "#eceada", fore2: "#fafaf2", hind: "#dcd9c8", hind2: "#f0eee2", body: "#6a675a" },
    { key: "sulawesi", name: "淡黄粉蝶", size: 0.85, speed: 1.1, w: 3,
      fore: "#eeda8a", fore2: "#f8ecb8", hind: "#e2c870", hind2: "#f2e0a2", body: "#7a6a48" },
    { key: "sulawesi", name: "米黄蝶", size: 1.0, speed: 0.92, w: 2,
      fore: "#f0e4b4", fore2: "#f9f2d4", hind: "#e4d49a", hind2: "#f4e8c0", body: "#837454" },
    { key: "monarch", name: "虎斑蝶", size: 1.08, speed: 0.95, w: 1,
      fore: "#f2a052", fore2: "#ffb96a", hind: "#e0882e", hind2: "#ffa244", body: "#4a3520", edge: "#8a5220" }
  ];
  /* 老鼠三阶段行为表 */
  G.MOUSE_STAGE = {
    1: { peek: 2.2,  dartSpeed: 150, fakeP: 0,    adjacent: true,  dartP: 0.6 },
    2: { peek: 1.4,  dartSpeed: 235, fakeP: 0.35, adjacent: false, dartP: 0.85 },
    3: { peek: 0.85, dartSpeed: 330, fakeP: 0.55, adjacent: false, dartP: 1 }
  };
  /* 老鼠花色 variants：毛色分层（背→中→腹）/ 耳 / 爪 / 尾 / 眼鼻 + 速度体型差异 */
  G.MOUSE_VARIANTS = [
    { key: "house", name: "灰褐家鼠", speed: 1.0,  size: 1.0,
      back: "#857a6d", mid: "#a89b8a", belly: "#ddd0bb",
      ear: "#857a6d", earIn: "rgba(232,180,169,.72)", earFar: "#79705f", earRim: "rgba(255,255,255,.22)",
      fur: "rgba(78,68,55,.2)", tail: "#c99f85", tailRing: "rgba(120,86,64,.42)",
      paw: "#ccbba4", foot: "#c2b099", eye: "#221a14", eyeRim: "rgba(0,0,0,.25)",
      nose: "#d98a7d", haunch: "rgba(135,121,106,.26)", sheen: "rgba(240,228,209,.6)" },
    { key: "charcoal", name: "炭灰玄鼠", speed: 1.08, size: 0.98,
      back: "#4e4c4a", mid: "#75726d", belly: "#b3ada1",
      ear: "#5c5a56", earIn: "rgba(216,166,158,.7)", earFar: "#4a4845", earRim: "rgba(255,255,255,.16)",
      fur: "rgba(30,28,26,.24)", tail: "#a98871", tailRing: "rgba(90,64,50,.5)",
      paw: "#a99c8c", foot: "#9c907f", eye: "#17120e", eyeRim: "rgba(0,0,0,.3)",
      nose: "#c97f74", haunch: "rgba(60,56,52,.3)", sheen: "rgba(214,205,190,.5)" },
    { key: "albino", name: "小白鼠", speed: 0.92, size: 0.92,
      back: "#eee7de", mid: "#f7f2ea", belly: "#ffffff",
      ear: "#f2ece4", earIn: "rgba(243,177,187,.8)", earFar: "#e6ded4", earRim: "rgba(255,255,255,.55)",
      fur: "rgba(196,182,168,.28)", tail: "#eab6ac", tailRing: "rgba(199,138,126,.42)",
      paw: "#f6dfd9", foot: "#f2d3cc", eye: "#c0392b", eyeRim: "rgba(140,32,22,.5)",
      nose: "#e0908a", haunch: "rgba(214,196,182,.35)", sheen: "rgba(255,255,255,.72)" },
    { key: "deer", name: "花背鹿鼠", speed: 1.05, size: 1.02,
      back: "#8a6b4a", mid: "#b3926a", belly: "#f2ecdf",
      ear: "#96754f", earIn: "rgba(238,180,170,.75)", earFar: "#7a5d3f", earRim: "rgba(255,240,220,.3)",
      fur: "rgba(88,62,38,.22)", tail: "#d8b49a", tailRing: "rgba(150,105,72,.5)",
      paw: "#fdfaf3", foot: "#f7f2e6", eye: "#1d150e", eyeRim: "rgba(0,0,0,.26)",
      nose: "#d98a7d", haunch: "rgba(120,90,60,.28)", sheen: "rgba(250,242,226,.62)" },
    { key: "golden", name: "金褐田鼠", speed: 0.95, size: 1.07,
      back: "#9c7f52", mid: "#c4a468", belly: "#ecdcb2",
      ear: "#a5854f", earIn: "rgba(238,178,162,.72)", earFar: "#8a6d42", earRim: "rgba(255,236,200,.3)",
      fur: "rgba(110,84,44,.22)", tail: "#c9a67e", tailRing: "rgba(140,104,64,.44)",
      paw: "#dcc79c", foot: "#d1ba8d", eye: "#1f170f", eyeRim: "rgba(0,0,0,.26)",
      nose: "#d98a7d", haunch: "rgba(140,110,66,.3)", sheen: "rgba(246,230,196,.6)" }
  ];
  /* 难度 */
  G.DIFF = {
    easy:   { speed: 0.65, size: 1.3 },
    normal: { speed: 1.0,  size: 1.0 },
    hard:   { speed: 1.5,  size: 0.85 }
  };
  /* 猎物基础定义 */
  G.PREY_DEF = {
    fish:      { w: 116, h: 70, speed: 95,  wobF: 2.0, wobA: 0.55, dartMin: 2.2, dartMax: 4.2, yMin: 0.02, yMax: 0.9,  face: true,  sparkColor: "#ffb02e" },
    mouse:     { w: 104, h: 66, speed: 125, wobF: 3.2, wobA: 0.35, dartMin: 1.4, dartMax: 2.8, yMin: 0.45, yMax: 0.98, face: true,  sparkColor: "#e8d9bd" },
    butterfly: { w: 92,  h: 80, speed: 52,  wobF: 4.2, wobA: 0.9,  dartMin: 2.8, dartMax: 4.8, yMin: 0.02, yMax: 0.6,  face: true,  sparkColor: "#ffd94d" },
    laser:     { w: 54,  h: 54, speed: 265, wobF: 5.5, wobA: 0.85, dartMin: 0.5, dartMax: 1.2, yMin: 0.02, yMax: 0.92, face: false, sparkColor: "#ff6b6b" }
  };
  /* 全局配色：与 H5 原型 CSS 变量 / 场景色严格对齐 */
  G.COLORS = {
    ink: "#14313a", ink2: "#4a6b74", ink3: "#86a3a9",
    teal: "#159a8c", tealDeep: "#0d6b7d",
    bg: "#eef7f3", card: "#ffffff", line: "#dcebe6",
    amber: "#ffb02e", amberDeep: "#f08c00", danger: "#ff5a5a",
    homeBg1: "#ffffff", homeBg2: "#e6f8f1", homeBg3: "#cdefe4",
    subBg1: "#eafaf4", subBg2: "#fdf6e9",
    panelBg: "rgba(255,255,255,.9)", panelBorder: "rgba(255,255,255,.9)",
    segBg: "#ebf5f1", segOn: "#ffffff", segLine: "#e9f4f0",
    statBg: "#f2fbf7", statBorder: "#e2f3ec",
    startGrad0: "#46d6c0", startGrad1: "#14a093", startGrad2: "#0c5f6e",
    startRing: "rgba(142,226,210,.22)", startInner: "rgba(255,255,255,.35)",
    hudBg: "rgba(8,34,44,.42)", hudUrgent: "rgba(178,42,42,.55)",
    hitPill: "rgba(255,146,46,.3)", comboPill: "rgba(255,146,46,.55)", stagePill: "rgba(38,84,96,.45)",
    pauseBg: "rgba(8,32,42,.55)", countMask: "rgba(8,32,42,.55)",
    modalMask: "rgba(8,32,42,.55)", modalCard: "#ffffff",
    hint: "#ffffff"
  };

  /* 鱼品种（调色板 + 品种速度 + 品种尺寸 + 专属冲刺参数）
     speed：游速档位（乘在基础游速上）——乌龟最慢、沙丁鱼最快
     burst：冲刺爆发倍率（默认 3.1）；dartMul：冲刺频率倍率（越小越爱冲刺）
     shape：默认通用鱼形；puffer/shark/ray/whale/turtle 走专属矢量绘制
     build：通用鱼形的体型纵向系数（1 = 常规；<1 瘦长鱼雷体；>1 高身鱼）——决定造型，不影响命中盒
     与 H5 原型同构，每个品种支持 1~2 组色（随机取一组） */
  G.FISH_SPECIES = [
    { key: "turtle",  name: "乌龟",   speed: 0.5,  w: 118, h: 78, shape: "turtle", burst: 2.4, dartMul: 1.5,
      variants: [
        { body: "#3f9161", belly: "#bfe0c2", fin: "#7cc291", accent: "#2c6b47", pattern: "scutes" },
        { body: "#6f7d3f", belly: "#d5dcae", fin: "#94b463", accent: "#c0392b", pattern: "scutes" }
      ] },
    { key: "puffer",  name: "河豚",   speed: 0.55, w: 104, h: 92, shape: "puffer",  dartMul: 1.3,
      variants: [
        { body: "#e8c46a", belly: "#fbf0cf", fin: "#d9a83f", accent: "#8a6a24", pattern: "spots" }
      ] },
    { key: "whale",   name: "鲸鱼",   speed: 0.65, w: 172, h: 86, shape: "whale",  burst: 2.5, dartMul: 1.45,
      variants: [
        { body: "#6d8fb0", belly: "#e2edf5", fin: "#56789a", accent: "#3d5a78", pattern: null },
        { body: "#7a8a99", belly: "#eef3f6", fin: "#5d6f80", accent: "#42556a", pattern: null }
      ] },
    { key: "gold",    name: "金鱼",   speed: 0.7,  w: 110, h: 88, build: 1.2,
      variants: [{ body: "#ff8c42", belly: "#ffcaa2", fin: "#ff6b2e", accent: "#d94f26", pattern: null }] },
    { key: "angel",   name: "神仙鱼", speed: 0.75, w: 106, h: 90, build: 1.32,
      variants: [{ body: "#ffd94d", belly: "#fff4c8", fin: "#ffb02e", accent: "#3a3428", pattern: "stripes" }] },
    { key: "koi",     name: "锦鲤",   speed: 0.85, w: 128, h: 76, build: 0.85,
      variants: [
        { body: "#ff9a4d", belly: "#ffe3bd", fin: "#ff7c33", accent: "#e8542f", pattern: "spots" },
        { body: "#f2f5f7", belly: "#ffffff", fin: "#ffd9a8", accent: "#ff6b3d", pattern: "spots" }
      ] },
    { key: "clown",   name: "小丑鱼", speed: 1.0,  w: 106, h: 62, build: 0.78,
      variants: [
        { body: "#ff7a3d", belly: "#ffb27e", fin: "#ff6a2a", accent: "#ffffff", pattern: "stripes" }
      ] },
    { key: "ray",     name: "魔鬼鱼", speed: 0.9,  w: 152, h: 80, shape: "ray",  dartMul: 1.15,
      variants: [
        { body: "#5b7fa6", belly: "#e8f1f7", fin: "#4a6c90", accent: "#31485f", pattern: null }
      ] },
    { key: "shark",   name: "鲨鱼",   speed: 1.2,  w: 168, h: 74, shape: "shark", burst: 3.5, dartMul: 1.25,
      variants: [
        { body: "#8fa3ad", belly: "#e9eef0", fin: "#6f848f", accent: "#4c5f68", pattern: null },
        { body: "#7d95b5", belly: "#e5edf5", fin: "#617a9b", accent: "#3f5470", pattern: null }
      ] },
    { key: "sardine", name: "沙丁鱼", speed: 1.45, w: 124, h: 50, build: 0.55, burst: 3.6, dartMul: 0.8,
      variants: [
        { body: "#9fc4d8", belly: "#eaf6fb", fin: "#7fa8c0", accent: "#4f7d99", pattern: null },
        { body: "#a9d2c9", belly: "#edfaf4", fin: "#84b9ac", accent: "#5d9488", pattern: null }
      ] }
  ];
  /* 连击提难度档位（与自适应互斥） */
  G.COMBO_TIERS = [
    { min: 0,  speed: 1,    size: 1,    hint: null },
    { min: 5,  speed: 1.12, size: 1,    hint: "猎物变敏捷了！" },
    { min: 10, speed: 1.25, size: 0.92, hint: "猎物越来越快！" },
    { min: 15, speed: 1.45, size: 0.85, hint: "极限追猎！" }
  ];

  /* 活动区域：与原型一致，并叠加安全区 insets */
  G.bounds = () => {
    const W = G.platform.W, H = G.platform.H;
    const safe = G.platform.safe || { top: 0, bottom: 0, left: 0, right: 0 };
    const top = Math.max(96, safe.top + 8);
    const bottomPad = Math.max(22, safe.bottom + 6);
    return {
      x: 20 + safe.left,
      y: top,
      w: Math.max(W - 40 - safe.left - safe.right, 60),
      h: Math.max(H - top - bottomPad, 60)
    };
  };
  /* 单一时间轴的阶段推进（固定时长：①20s ②最多 50s） */
  G.stageNow = () => {
    const dur = Number(G.config.duration) || 180;
    const elapsed = dur - Math.max(G.session.remaining, 0);
    const t1 = Math.min(20, dur * 0.3);
    const t2 = t1 + Math.min(50, dur * 0.5);
    return elapsed < t1 ? 1 : elapsed < t2 ? 2 : 3;
  };
};
