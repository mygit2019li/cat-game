/* config.js — 配置持久化 + 全部玩法参数表（与 H5 原型 1:1 对齐） */
module.exports = function (G) {
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  G.rand = rand; G.clamp = clamp;

  /* 游戏名称：必须与微信公众平台提审登记名称完全一致（备案/审核校验项）
     修改时只改这一处，首页大标题等全局生效 */
  G.GAME_NAME = "逗猫触屏玩具";

  const DEFAULTS = {
    targetType: "fish", preyCount: 3, difficulty: "normal", duration: 180, infinite: false,
    keepScreen: true,        // 屏幕常亮（给猫玩时不自动锁屏）
    antiMistouch: true,      // 进入游戏首次弹「系统防误触」引导
    sound: true,             // 音效默认开
    vibrate: true,           // 震动默认开
    adaptive: true,          // 自适应辅助默认开（猫更容易抓到）
    bg_mouse: "room",        // 捕鼠可选背景（≥2 套时开始前弹选择层）
    bg_fish: "kelp",         // 捕鱼可选海域（水草森林 / 泳池追鱼）
    /* 电子猫粮机：feedNextAt 存的是「下次出粮的绝对时刻(ms)」，离开本页也照走真实时间；
       feedBowl = 盆中颗数，feedHopper = 储粮桶余量百分比 */
    feedMode: "manual", feedPortion: 3, feedIntervalMin: 1,
    feedNextAt: 0, feedBowl: 0, feedHopper: 100
  };
  /* ===== 召唤猫咪：按性格归类（小字为该性格的代表品种）=====
     img 为真实猫咪照片（assets/cats/），audioPath 为本地真实喵叫（assets/audio/）：
     由用户提供的四段实拍视频（懒惰/活泼/温柔/高冷.mp4）提取音轨，去首尾静音后
     循环平铺到 15s 以上（7s/6s 的短素材平铺 3 遍），循环点做 0.15s 交叉淡化，
     统一响度到 -16 LUFS、96kbps 单声道 —— 音频可直接 loop 无缝续播。
     mews 为合成"喵"声兜底参数 [起始Hz, 滑向Hz, 时长s]（本地音频不可用时启用），gap 为合成声间隔毫秒
     第一张「猫粮开饭」不是猫叫而是真实出粮录音（用户实拍猫粮.mp4 的音轨平铺 4 遍、
     每遍之间留 1.2s 静默，循环点落在静默里）——开饭声对猫是最直接的召唤信号；
     它没有照片素材，icon: "food" 走矢量粮盆插画（见 ui.js drawKindArt） */
  G.CAT_KINDS = [
    { key: "food",   name: "猫粮开饭", breed: "真实出粮声 · 一响就到", icon: "food",
      color: "#f0c26a", audioPath: "assets/audio/summon_food.mp3",
      mews: [[300, 250, 0.05], [340, 280, 0.05], [270, 230, 0.04], [320, 260, 0.05]], gap: 70 },
    { key: "lazy",   name: "慵懒慢喵", breed: "橘猫 · 布偶猫", img: "assets/cats/lazy.jpg",
      color: "#e8944a", audioPath: "assets/audio/cat_lazy.mp3",
      mews: [[420, 660, 0.7], [380, 600, 0.62]], gap: 700 },
    { key: "lively", name: "活泼啁啾", breed: "狸花猫 · 奶牛猫", img: "assets/cats/lively.jpg",
      color: "#c99a5b", audioPath: "assets/audio/cat_lively.mp3",
      mews: [[900, 1400, 0.3], [950, 1450, 0.28], [880, 1350, 0.3]], gap: 450 },
    { key: "gentle", name: "温柔软喵", breed: "布偶猫 · 波斯猫", img: "assets/cats/gentle.jpg",
      color: "#d9b98a", audioPath: "assets/audio/cat_gentle.mp3",
      mews: [[520, 900, 0.5], [460, 820, 0.45]], gap: 650 },
    { key: "cool",   name: "高冷轻唤", breed: "俄罗斯蓝猫 · 英短", img: "assets/cats/cool.jpg",
      color: "#9fb2c4", audioPath: "assets/audio/cat_cool.mp3",
      mews: [[1300, 1750, 0.16], [1400, 1850, 0.15], [1350, 1800, 0.16], [1450, 1900, 0.18]], gap: 600 }
  ];

  /* ===== 自定义召唤卡（召唤页左上角「自定义」录入）=====
     { name, img, audio } 三项都可留空：图片和音频由 platform 复制进 USER_DATA_PATH 后
     只存路径，整条记录写进本地 storage（catCustomSummon），杀进程重开依然在。
     列表里永远排第一：用户自己录的召唤声要比任何内置卡都更好找。 */
  G.customSummon = null;
  G.loadCustomSummon = () => {
    let o = null;
    try {
      const raw = G.platform.storage.get("catCustomSummon");
      if (raw) { o = JSON.parse(raw); if (!o || typeof o !== "object") o = null; }
    } catch (e) { o = null; }
    G.customSummon = o && (o.name || o.img || o.audio) ? o : null;
    return G.customSummon;
  };
  /* 传入 null 即删除；旧素材文件由调用方（ui.js）负责清盘，这里只管内存与存储 */
  G.saveCustomSummon = (o) => {
    G.customSummon = o && (o.name || o.img || o.audio) ? {
      name: String(o.name || "").slice(0, 12), img: String(o.img || ""), audio: String(o.audio || "")
    } : null;
    try {
      G.platform.storage.set("catCustomSummon", G.customSummon ? JSON.stringify(G.customSummon) : "");
    } catch (e) {}
    return G.customSummon;
  };
  /* 召唤卡牌的唯一数据源：自定义卡（若有）+ 内置卡。绘制/翻页/播放都走这里，
     否则三处各自数 CAT_KINDS，加了自定义卡后索引会错位 */
  G.summonKinds = () => {
    const list = G.CAT_KINDS || [];
    const c = G.customSummon;
    if (!c) return list;
    return [{
      key: "custom", name: c.name || "我的召唤", breed: "自定义召唤卡", custom: true,
      img: c.img || "", icon: c.img ? "" : "custom", color: "#7fc9bd",
      audioPath: c.audio || "",
      mews: [[520, 900, 0.5], [460, 820, 0.45]], gap: 650
    }].concat(list);
  };

  /* 玩法 key / 时长白名单：存储里的字段可能被旧版本写成任意类型（"abc"、null、对象），
     直接透给游戏会让计时变成 NaN、targetType 指向不存在的玩法。这里一次性收敛。 */
  const TYPES = ["fish", "butterfly", "mouse", "laser", "pool", "frog"];

  /* ===== 可切换模式表 =====
     某玩法有 ≥2 套模式时，首页点「开始游戏」先弹模式选择层（可左右滑动/点按翻页），
     每套 = 不同布景 + 不同运动规则 + 不同猎物种类；只有 1 套的玩法照旧直接开始。
     新增模式只需在此加一项 + 绘制分支。key 存进 config["bg_<玩法>"]，跨局记忆。 */
  G.TYPE_BGS = {
    mouse: [
      { key: "room",  name: "室内房间", desc: "木地板 · 窗光 · 地毯" },
      { key: "swarm", name: "群鼠乱窜", desc: "俯视群鼠 · 满屏乱窜" }
    ],
    fish: [
      { key: "kelp", name: "水草森林", desc: "蓝色海水 · 绿水草丛" },
      { key: "pool", name: "泳池追鱼", desc: "亮蓝池水 · 焦散光网" },
      { key: "school", name: "鱼群巡游", desc: "深海鱼群 · 结群游动" }
    ],
    /* 青蛙跳：只有一套布景，点开始直接进游戏（不弹背景选择层） */
    frog: [
      { key: "pond", name: "夏夜荷塘", desc: "荷叶 · 睡莲 · 萤火" }
    ]
  };
  G.bgsFor = (type) => (G.TYPE_BGS[type] || []);
  /* 当前玩法生效的背景 key（存储脏值/不存在时回落到第一套） */
  G.currentBg = () => {
    const type = G.config.targetType;
    const arr = G.TYPE_BGS[type];
    if (!arr || !arr.length) return "default";
    const k = G.config["bg_" + type];
    return arr.some(b => b.key === k) ? k : arr[0].key;
  };
  const DURS = [60, 120, 180, 300];
  function loadConfig() {
    let saved = {};
    try { saved = JSON.parse(G.platform.storage.get("catToyConfig") || "{}") || {}; } catch (e) {}
    if (typeof saved !== "object" || Array.isArray(saved)) saved = {};
    const c = Object.assign({}, DEFAULTS, saved);
    c.preyCount = Number(c.preyCount) === 1 ? 1 : 3;   // 两档：单只/多只
    // 音效/震动/自适应辅助默认开启：旧版本存档里是旧逻辑写入的显式 false，
    // 用 sndV1 标记做一次性迁移（重置为默认开），此后用户在设置里手动关闭的会一直保留
    if (!saved.sndV1) {
      c.sound = true; c.vibrate = true; c.adaptive = true; c.sndV1 = 1;
    } else {
      c.sound = c.sound !== false; c.vibrate = c.vibrate !== false; c.adaptive = c.adaptive !== false;
    }
    c.keepScreen = !!c.keepScreen; c.antiMistouch = !!c.antiMistouch;   // 常亮 / 防误触开关
    if (TYPES.indexOf(c.targetType) < 0) c.targetType = DEFAULTS.targetType;
    const dur = Number(c.duration);
    c.duration = DURS.indexOf(dur) >= 0 ? dur : DEFAULTS.duration;
    c.infinite = !!c.infinite;   // 无限模式：给猫玩不计时、不中途打断
    // 背景 key 收敛：只认当前玩法背景表里存在的值，否则回落第一套
    Object.keys(G.TYPE_BGS).forEach(k => {
      const arr = G.TYPE_BGS[k];
      if (!arr || !arr.some(b => b.key === c["bg_" + k])) c["bg_" + k] = arr && arr[0] ? arr[0].key : "";
    });
    /* 电子猫粮机：存档同样可能被写脏（份量 null、间隔 "abc"、桶量越界），
       逐项收敛——出粮逻辑依赖这些数值，NaN 会让份量与倒计时一起失效 */
    c.feedMode = c.feedMode === "timer" ? "timer" : "manual";
    c.feedPortion = clamp(Math.round(Number(c.feedPortion) || 3), 1, 5);
    c.feedIntervalMin = [0.5, 1, 5, 30].indexOf(Number(c.feedIntervalMin)) >= 0 ? Number(c.feedIntervalMin) : 1;
    c.feedNextAt = Number(c.feedNextAt) > 0 ? Number(c.feedNextAt) : 0;
    c.feedBowl = clamp(Math.floor(Number(c.feedBowl) || 0), 0, 86);
    c.feedHopper = clamp(Number(c.feedHopper), 0, 100);
    if (!isFinite(c.feedHopper)) c.feedHopper = 100;
    return c;
  }
  G.saveConfig = () => G.platform.storage.set("catToyConfig", JSON.stringify(G.config));
  G.config = loadConfig();
  G.GAME_TYPES = TYPES; G.GAME_DURS = DURS;

  /* 本局历史上限：只留最近 7 天、最多 200 条。
     200 条 × 每条约 90 字节 ≈ 18KB，远低于 storage 单 key 1MB 限制。 */
  G.LOG_KEEP_DAYS = 7;
  G.LOG_KEEP_MAX = 200;

  const DAY_MS = 86400000;
  /* 取一条记录的时间戳（毫秒）。新记录直接存 ts；
     旧记录只有 "M/D" 文本，按"今年"推、若落在未来则算去年（跨年边界也能对）。 */
  const logTs = (L, now) => {
    const t = Number(L.ts);
    if (isFinite(t) && t > 0) return t;
    const s = typeof L.date === "string" ? L.date : "";
    const m = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(s);
    if (!m) return 0;
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);                 // 取当天中午：避免 0 点/23 点跨日算错
    d.setMonth(Number(m[1]) - 1, Number(m[2]));
    if (d.getTime() > now + DAY_MS) d.setFullYear(d.getFullYear() - 1);
    return d.getTime();
  };

  /* 本局历史的安全读取：存储里可能是对象、null、元素为 null 的数组（旧版本/手动清理所致），
     原样交给 forEach / slice / unshift 会直接抛错（记录页闪退、结算写不进日志）。
     同时按"最近 7 天 + 最多 200 条"过滤：这是唯一出口，界面与统计都拿不到过期数据。 */
  G.getLogs = () => {
    let arr = null;
    try { arr = JSON.parse(G.platform.storage.get("catToyLogs") || "[]"); } catch (e) { arr = null; }
    if (!Array.isArray(arr)) return [];
    const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
    const now = Date.now(), cut = now - G.LOG_KEEP_DAYS * DAY_MS;
    // 同时剔掉空对象 {}：它是合法对象但没有有效字段，会渲染成一行"0 抓 0%"的脏记录
    return arr.filter(L => L && typeof L === "object" && !Array.isArray(L) && (L.date || L.hits != null))
      .map(L => {
        const ts = logTs(L, now);
        return {
          ts,
          date: typeof L.date === "string" ? L.date : "-",
          type: TYPES.indexOf(L.type) >= 0 ? L.type : "fish",
          dur: num(L.dur) || 180,
          hits: num(L.hits),
          touches: num(L.touches),
          accuracy: num(L.accuracy),
          combo: num(L.combo),
          dart: num(L.dart),
          bonus: num(L.bonus)
        };
      })
      .filter(L => L.ts >= cut)                  // 超过 7 天的直接丢弃
      .slice(0, G.LOG_KEEP_MAX);
  };

  /* 写入前的裁剪：新记录 unshift 之后调用，保证存储里也只有 7 天 / 200 条 */
  G.pruneLogs = (arr) => {
    const now = Date.now(), cut = now - G.LOG_KEEP_DAYS * DAY_MS;
    return (Array.isArray(arr) ? arr : [])
      .map(L => {
        const t = Number(L && L.ts);
        return (L && isFinite(t) && t > 0) ? L : Object.assign({}, L, { ts: L ? logTs(L, now) : 0 });
      })
      .filter(L => L && Number(L.ts) >= cut)
      .slice(0, G.LOG_KEEP_MAX);
  };

  /* ===== 猫档案（累计维度） =====
     背景：分享图只放单局数据时，用户发过一次就没理由再发——同样的模板每次内容一样。
     加上累计维度后，同一张模板会随时间自己变化（多玩一天、多抓几只、反应更快），
     才有"过一周再发一次"的理由。
     为什么要单独存一份：catToyLogs 只保留最近 50 局，用 logs 累加会算错总数。
     hpm（每分钟捕获数）用来做"反应速度"的可比指标——不同时长也能横向比较。 */
  const ARCHIVE_KEY = "catToyArchive";
  const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
  const dayKey = (d) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());

  G.getArchive = () => {
    let a = null;
    try { a = JSON.parse(G.platform.storage.get(ARCHIVE_KEY) || "null"); } catch (e) { a = null; }
    if (!a || typeof a !== "object" || Array.isArray(a)) a = {};
    const num = (v) => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
    const modes = {};
    TYPES.forEach(k => {
      const src = (a.modes && a.modes[k]) || {};
      modes[k] = { g: num(src.g), h: num(src.h) };
    });
    const days = Array.isArray(a.days)
      ? a.days.filter(s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && s <= dayKey(new Date()))
      : [];
    return {
      games: num(a.games), hits: num(a.hits), touches: num(a.touches),
      days: days.slice(-400),
      modes,
      baseSum: num(a.baseSum), baseN: num(a.baseN),
      recent: Array.isArray(a.recent) ? a.recent.filter(v => isFinite(Number(v))).map(Number).slice(-5) : [],
      firstTs: num(a.firstTs), lastTs: num(a.lastTs)
    };
  };

  /* 每局结束时累加一次；ent = { type, hits, touches, hpm } */
  G.recordArchive = (ent) => {
    const e = ent || {};
    const a = G.getArchive();
    const hits = Math.max(0, Number(e.hits) || 0);
    const hpm = Math.max(0, Number(e.hpm) || 0);
    const type = TYPES.indexOf(e.type) >= 0 ? e.type : "fish";
    const key = dayKey(new Date());
    a.games += 1;
    a.hits += hits;
    a.touches += Math.max(0, Number(e.touches) || 0);
    if (a.days.indexOf(key) < 0) a.days.push(key);
    if (a.days.length > 400) a.days = a.days.slice(-400);
    a.modes[type].g += 1; a.modes[type].h += hits;
    // 前 3 局均值锁死作为"基线"，之后不再变——否则趋势会跟着一起漂，看不出进步
    if (a.baseN < 3) { a.baseSum += hpm; a.baseN += 1; }
    a.recent.push(hpm);
    if (a.recent.length > 5) a.recent = a.recent.slice(-5);
    if (!a.firstTs) a.firstTs = Date.now();
    a.lastTs = Date.now();
    G.platform.storage.set(ARCHIVE_KEY, JSON.stringify(a));
    return a;
  };

  /* 派生指标：绘制层直接用，避免每次重算 */
  G.archiveSummary = () => {
    const a = G.getArchive();
    const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
    let favType = "fish", favG = -1;
    TYPES.forEach(k => { if (a.modes[k].g > favG) { favG = a.modes[k].g; favType = k; } });
    const base = a.baseN > 0 ? a.baseSum / a.baseN : 0;
    const recent = avg(a.recent);
    return {
      games: a.games, hits: a.hits, touches: a.touches, days: a.days.length,
      favType, favGames: Math.max(0, favG),
      hpmBase: base, hpmRecent: recent,
      // trend > 0 表示最近比刚开始快
      trend: (base > 0 && recent > 0) ? (recent - base) / base : 0
    };
  };

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
    laser: { 1: "阶段① 缓缓游走", 2: "阶段② 快速闪现", 3: "阶段③ 疯狂光点" },
    pool:  { 1: "阶段① 萤火初现", 2: "阶段② 暗夜疾行", 3: "阶段③ 疯狂萤光" }
  };
  G.stageName = (n) => (STAGE_NAME[G.config.targetType] || STAGE_NAME.fish)[n];

  /* 激光三阶段：甩动 → 停住（主要命中窗口）→ 再甩 */
  G.LASER_PARAMS = {
    1: { hold: [1.0, 1.4], dart: [0.9, 1.6], tele: 0,    trail: false },
    2: { hold: [0.6, 1.0], dart: [0.5, 1.0], tele: 0.12, trail: true },
    3: { hold: [0.4, 0.6], dart: [0.3, 0.7], tele: 0.15, trail: true }
  };
  /* 水面追光三阶段：高速掠水（频繁变向）→ 悬停水珠（主要命中窗口）→ 再掠。
     比激光整体快一档、转向更勤，靠"亮斑+水痕"制造 Peppy Cat 式的高速光点追逐 */
  G.POOL_PARAMS = {
    1: { hold: [0.55, 0.9], dart: [0.65, 1.1],  tele: 0.05 },
    2: { hold: [0.4, 0.68], dart: [0.42, 0.8],  tele: 0.12 },
    3: { hold: [0.28, 0.5], dart: [0.26, 0.55], tele: 0.18 }
  };
  /* 蝶式飞行参数（最终调优版：中位 235px/s ≈ 基线 2.08×） */
  G.BFLY_PARAMS = {
    1: { glide: [0.4, 0.65], impulse: [105, 160], up: [33, 51], hoverChance: 0,    turn: 0.014, drag: 0.7,
         land: { interval: () => rand(4, 6), chance: 0.4, dur: () => rand(1.6, 2.6) }, exit: [7, 11] },
    2: { glide: [0.3, 0.55], impulse: [125, 185], up: [38, 60], hoverChance: 0.35, turn: 0.02,  drag: 0.7,
         land: { interval: () => rand(3, 5), chance: 0.5, dur: () => rand(1.0, 1.8) }, exit: [6, 10] },
    3: { glide: [0.22, 0.4], impulse: [155, 230], up: [46, 72], hoverChance: 0.3,  turn: 0.04,  drag: 0.7,
         land: { interval: () => rand(5, 8), chance: 0.3, dur: () => rand(0.6, 1.1) }, exit: [5, 9] }
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
  /* 老鼠三阶段行为表（台球桌布局：任意洞进出，路线横穿台面供拦截；速度快慢分档） */
  G.MOUSE_STAGE = {
    1: { peek: 2.2,  dartSpeed: 260, fakeP: 0,    adjacent: false, dartP: 0.6 },
    2: { peek: 1.4,  dartSpeed: 380, fakeP: 0.35, adjacent: false, dartP: 0.85 },
    3: { peek: 0.85, dartSpeed: 500, fakeP: 0.55, adjacent: false, dartP: 1 }
  };
  /* 青蛙跳三阶段：一次循环 = 蓄力 → 腾空 → 落水 → 静坐，循环结束换一片荷叶。
     crouch/leap/land/settle = 各状态基准时长（秒，按速度倍率缩放）
     prep   = 起跳前落点光圈提前量（猫唯一的预判依据，三个段位都保留）
     nearFirst = 落点优先从「最近的 N 片荷叶」里挑（0 = 全随机）
     chain  = 一次落水后最多接着连跳几次（2 = 落地再跳一次，共 2 跳） */
  G.FROG_PARAMS = {
    1: { crouch: 0.60, leap: 0.80, land: 0.28, settle: 1.00, count: 3, prep: 0.35, nearFirst: 2, chain: 1 },
    2: { crouch: 0.52, leap: 0.72, land: 0.26, settle: 0.80, count: 4, prep: 0.35, nearFirst: 0, chain: 1 },
    3: { crouch: 0.44, leap: 0.64, land: 0.24, settle: 0.62, count: 5, prep: 0.35, nearFirst: 0, chain: 2 }
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
  /* 激光花色 variants：红色为主（w = 出现权重），翠绿更快更小（约 1/4 概率）；只保留红绿两色 */
  G.LASER_VARIANTS = [
    { key: "red",   name: "赤红光点", speed: 1,    size: 1,    w: 3 },
    { key: "green", name: "翠绿光点", speed: 1.5,  size: 0.8,  w: 1 }
  ];
  /* 激光配色：小屏与大屏保持一致（经典红/翠绿）。
     key 与 LASER_VARIANTS 对应；spark=命中火花 trail=拖尾 flash=瞬移灼痕亮圈 burn=灼痕底色 */
  G.LASER_COLORS = {
    red:   { spark: "#ff8a8a", trail: "#ff5252", flash: "#ff7a7a", burn: ["#3a0f0a", "rgba(58,15,10,0)"] },
    green: { spark: "#4ade80", trail: "#4ade80", flash: "#7dffb0", burn: ["#0a3a1f", "rgba(10,58,31,0)"] },
    pool:  { spark: "#f4ffa8", trail: "#dcff8a", flash: "#f2ffc0", burn: ["#3a2f12", "rgba(58,47,18,0)"] }
  };
  G.laserColorSet = () => G.LASER_COLORS;
  /* 难度（typeSpeed：仅对特定猎物的额外速度倍率——标准/激烈下蝴蝶与老鼠再提速） */
  G.DIFF = {
    easy:   { speed: 0.65, size: 1.3 },
    normal: { speed: 1.0,  size: 1.0, typeSpeed: { butterfly: 1.2, mouse: 1.2 } },
    hard:   { speed: 1.5,  size: 0.85, typeSpeed: { butterfly: 1.25, mouse: 1.25 } }
  };
  /* 客服降级配置：小游戏标准客服会话走 wx.openCustomerServiceConversation（后台「客服消息」接入即可，
     无需此配置）。仅当用户微信版本过低、不支持标准接口时，才降级为企业微信「微信客服」——
     那时需要在这里填入企业 ID corpId（url 为客服链接，可选）。 */
  G.SUPPORT = { corpId: "", url: "" };
  /* 猎物基础定义 */
  G.PREY_DEF = {
    fish:      { w: 116, h: 70, speed: 95,  wobF: 2.0, wobA: 0.55, dartMin: 2.2, dartMax: 4.2, yMin: 0.02, yMax: 0.9,  face: true,  sparkColor: "#ffb02e" },
    mouse:     { w: 116, h: 58, speed: 125, wobF: 3.2, wobA: 0.35, dartMin: 1.4, dartMax: 2.8, yMin: 0.45, yMax: 0.98, face: true,  sparkColor: "#e8d9bd" },
    butterfly: { w: 92,  h: 80, speed: 52,  wobF: 4.2, wobA: 0.9,  dartMin: 2.8, dartMax: 4.8, yMin: 0.02, yMax: 0.6,  face: true,  sparkColor: "#ffd94d" },
    laser:     { w: 54,  h: 54, speed: 265, wobF: 5.5, wobA: 0.85, dartMin: 0.5, dartMax: 1.2, yMin: 0.02, yMax: 0.92, face: false, sparkColor: "#ff6b6b" },
    /* 水面追光：高亮光斑。命中盒比激光略大（高速目标宽容些），spark 用水花青白 */
    pool:      { w: 66,  h: 66, speed: 330, wobF: 5.5, wobA: 0.85, dartMin: 0.5, dartMax: 1.1, yMin: 0.02, yMax: 0.92, face: false, sparkColor: "#f4ffa8" },
    /* 青蛙跳：体型大、移动靠跳跃（不参与巡游速度），spark 用荷叶青绿 */
    frog:      { w: 96,  h: 78, speed: 100, wobF: 2.0, wobA: 0.4,  dartMin: 2.0, dartMax: 3.0, yMin: 0.30, yMax: 0.80, face: true,  sparkColor: "#bdf58a" }
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
     behavior：Peppy Cat 式行为个性（参考其玩具的运动效果）——只调节奏/轨迹，不动命中盒
       "pulse" 忽快忽慢 | "zigzag" 突然转向 | "hop" 弹跳（毛线球式落地涟漪+绒线拖尾） | "stalk" 潜伏突进
       无 behavior 的品种保持平稳巡游（乌龟/鲸鱼/魔鬼鱼），形成节奏对比
     与 H5 原型同构，每个品种支持 1~2 组色（随机取一组） */
  G.FISH_SPECIES = [
    { key: "turtle",  name: "乌龟",   speed: 0.5,  w: 118, h: 78, shape: "turtle", burst: 2.4, dartMul: 1.5,
      variants: [
        { body: "#3f9161", belly: "#bfe0c2", fin: "#7cc291", accent: "#2c6b47", pattern: "scutes" },
        { body: "#6f7d3f", belly: "#d5dcae", fin: "#94b463", accent: "#c0392b", pattern: "scutes" }
      ] },
    { key: "puffer",  name: "河豚",   speed: 0.55, w: 104, h: 92, shape: "puffer",  dartMul: 1.3, behavior: "hop",
      variants: [
        { body: "#e8c46a", belly: "#fbf0cf", fin: "#d9a83f", accent: "#8a6a24", pattern: "spots" }
      ] },
    { key: "whale",   name: "鲸鱼",   speed: 0.65, w: 172, h: 86, shape: "whale",  burst: 2.5, dartMul: 1.45,
      variants: [
        { body: "#6d8fb0", belly: "#e2edf5", fin: "#56789a", accent: "#3d5a78", pattern: null },
        { body: "#7a8a99", belly: "#eef3f6", fin: "#5d6f80", accent: "#42556a", pattern: null }
      ] },
    { key: "gold",    name: "金鱼",   speed: 0.7,  w: 110, h: 82, build: 1.2, behavior: "pulse",
      variants: [{ body: "#ff8c42", bodyGrad: ["#ffdd55", "#f5620f"], belly: "#ffcaa2", fin: "#ff6b2e", accent: "#d94f26", pattern: null }] },
    { key: "angel",   name: "神仙鱼", speed: 0.75, w: 106, h: 86, build: 1.32, behavior: "zigzag",
      variants: [{ body: "#ffd94d", bodyGrad: ["#ffe27a", "#ffa41e"], belly: "#fff4c8", fin: "#ffb02e", accent: "#3a3428", pattern: "stripes" }] },
    { key: "koi",     name: "锦鲤",   speed: 0.85, w: 128, h: 64, build: 0.85, behavior: "pulse",
      variants: [
        { body: "#ff9a4d", bodyGrad: ["#ffc06a", "#ef5a24"], belly: "#ffe3bd", fin: "#ff7c33", accent: "#e8542f", pattern: "spots" },
        { body: "#f2f5f7", belly: "#ffffff", fin: "#ffd9a8", accent: "#ff6b3d", pattern: "spots" }
      ] },
    { key: "clown",   name: "小丑鱼", speed: 1.0,  w: 106, h: 48, build: 0.78, behavior: "zigzag",
      variants: [
        { body: "#ff7a3d", bodyGrad: ["#ffa85c", "#ff5f1f"], belly: "#ffb27e", fin: "#ff6a2a", accent: "#ffffff", pattern: "stripes" }
      ] },
    { key: "ray",     name: "魔鬼鱼", speed: 0.9,  w: 152, h: 70, shape: "ray",  dartMul: 1.15,
      variants: [
        { body: "#5b7fa6", belly: "#e8f1f7", fin: "#4a6c90", accent: "#31485f", pattern: null }
      ] },
    { key: "shark",   name: "鲨鱼",   speed: 1.2,  w: 168, h: 86, shape: "shark", burst: 3.5, dartMul: 1.25, behavior: "stalk",
      variants: [
        { body: "#8fa3ad", belly: "#e9eef0", fin: "#6f848f", accent: "#4c5f68", pattern: null },
        { body: "#7d95b5", belly: "#e5edf5", fin: "#617a9b", accent: "#3f5470", pattern: null }
      ] },
    { key: "sardine", name: "沙丁鱼", speed: 1.45, w: 124, h: 41, build: 0.55, burst: 3.6, dartMul: 0.8, behavior: "zigzag",
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

  /* 鱼玩法海域主题：每局自动轮换（换背景 + 专属环境/命中特效 + 轻微节奏差异）。
     speed 只乘游速（不碰命中盒，鱼 w/h 已校准勿动）；
     decor=装饰类型（buildScene/drawSea 分支）；amb=环境粒子类型（fx.update 分支）。 */
  G.SEA_THEMES = [
    { key: "reef",  name: "珊瑚海",   speed: 1,    spark: "#ffd76a", ripple: "rgba(255,255,255,.85)",
      bg: ["#1b7f8f", "#10556a", "#0b3a4c"], sand: "#43635e", decor: "coral",  amb: "bubble" },
    { key: "abyss", name: "深海荧光", speed: 0.92, spark: "#7fe7ff", ripple: "rgba(127,231,255,.85)",
      bg: ["#0b2d4e", "#072038", "#041226"], sand: "#1e3d52", decor: "glow",   amb: "plankton" },
    { key: "ice",   name: "冰海浮冰", speed: 1.08, spark: "#eaf6ff", ripple: "rgba(214,238,255,.85)",
      bg: ["#5c9cc0", "#3a76a0", "#22557c"], sand: "#8fb4c9", decor: "ice",    amb: "snow" },
    { key: "kelp",  name: "水草森林", speed: 1,    spark: "#ffd76a", ripple: "rgba(255,255,255,.85)",
      bg: ["#1b7f8f", "#10556a", "#0b3a4c"], sand: "#43635e", decor: "kelp",   amb: "bubble" },
    { key: "school", name: "鱼群巡游", speed: 1.3, spark: "#ffe9a8", ripple: "rgba(255,255,255,.9)",
      bg: ["#12406b", "#0c2e50", "#071e38"], sand: "#22405c", decor: "school", amb: "bubble" },
    { key: "pool",  name: "泳池追鱼", speed: 1.12, spark: "#fff3b0", ripple: "rgba(255,255,255,.9)",
      bg: ["#2aa4e0", "#1565b5", "#0e4a9e"], sand: "#2c6f9b", decor: "pool",   amb: "bubble" }
  ];
  /* 泳池追鱼专属鱼种：与深海鱼完全区分——泳池里只有观赏金鱼这一种（贴近真实金鱼），
     三个色型随机出现；专属造型 shape:"poolGold"（蛋形圆身 + 背深橙到腹浅金纵向渐变 +
     半透明暖橙鳍 + 鳃盖弧线 + 鳞片纹 + 黑亮圆眼）；136×76、游速偏快 + pulse 忽快忽慢 */
  G.POOL_FISH_SPECIES = [
    { key: "poolgold", name: "泳池金鱼", shape: "poolGold", speed: 0.95, w: 136, h: 76, behavior: "pulse",
      variants: [
        { body: "#ff8c2b", bodyGrad: ["#ef520f", "#ffdca8"], fin: "#ffb877", accent: "#241a14", pattern: null },
        { body: "#e8562a", bodyGrad: ["#c9310b", "#ffd0a0"], fin: "#ff9e6e", accent: "#20140f", pattern: null },
        { body: "#ffb730", bodyGrad: ["#f08c00", "#ffe6b8"], fin: "#ffd08a", accent: "#2a1d12", pattern: null }
      ] }
  ];
  G.POOL_FISH_KEYS = ["poolgold"];
  /* 鱼群巡游专属鱼种：极小的银蓝"彗星"小鱼（亮头长尾迹，独立表不进深海全表），
     数量多（36→44→52）聚成"饵球"——鲸鱼捕猎式致密鱼团，整体漂移+球内旋转 */
  G.SCHOOL_FISH_SPECIES = [
    { key: "minnow", name: "小银鱼", shape: "minnow", speed: 1.15, w: 52, h: 20, burst: 3.4, dartMul: 0.9,
      variants: [
        { body: "#aebfc9", belly: "#eef6fa", fin: "#8fadb8", accent: "#4a7086", pattern: null },
        { body: "#9fc4d8", belly: "#eaf6fb", fin: "#7fa8c0", accent: "#4f7d99", pattern: null },
        { body: "#b8cfd6", belly: "#f2fafc", fin: "#93b7c4", accent: "#5d8296", pattern: null }
      ] }
  ];
  /* 当前海域可出现的鱼种列表：泳池取专属鱼种、鱼群取小银鱼，其余海域/无海域时取全表 */
  G.fishSpeciesList = () => {
    const key = G.session && G.session.sea && G.session.sea.key;
    if (key === "pool") return G.POOL_FISH_SPECIES;
    if (key === "school") return G.SCHOOL_FISH_SPECIES;
    return G.FISH_SPECIES;
  };
  /* 每局轮换海域：进度存本地，重启后接着换（不重复刚玩过的） */
  G.nextSeaTheme = () => {
    let idx = -1;
    try { idx = Number(G.platform.storage.get("catToySeaIdx")); } catch (e) {}
    if (!(idx >= 0 && idx < G.SEA_THEMES.length)) idx = -1;
    idx = (idx + 1) % G.SEA_THEMES.length;
    try { G.platform.storage.set("catToySeaIdx", String(idx)); } catch (e) {}
    return G.SEA_THEMES[idx];
  };
  G.seaThemeNow = () => (G.session && G.session.sea) || G.SEA_THEMES[0];

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
