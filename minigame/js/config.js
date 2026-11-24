/* config.js — 配置持久化 + 全部玩法参数表（与 H5 原型 1:1 对齐） */
module.exports = function (G) {
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  G.rand = rand; G.clamp = clamp;

  /* 游戏名称：必须与微信公众平台提审登记名称完全一致（备案/审核校验项）
     修改时只改这一处，首页大标题等全局生效 */
  G.GAME_NAME = "逗猫触屏玩具";

  const DEFAULTS = {
    /* 冷启动默认（PRD 6.2 / 8.1 V1.2）：单只 + 悠闲 + 1 分钟，三项都取最低门槛，
       让猫在首局前 30 秒就能抓到第一次；主人第一分钟就能看到完整结果 */
    targetType: "fish", preyCount: 1, difficulty: "easy", duration: 60, infinite: false,
    keepScreen: true,        // 屏幕常亮（给猫玩时不自动锁屏）
    antiMistouch: true,      // 进入游戏首次弹「系统防误触」引导
    sound: true,             // 音效默认开
    vibrate: true,           // 震动默认开
    adaptive: true,          // 自适应辅助默认开（猫更容易抓到）
    bg_mouse: "room",        // 捕鼠可选背景（≥2 套时开始前弹选择层）
    bg_fish: "kelp",         // 捕鱼可选海域（小河戏鱼 / 水草森林 / 鱼群巡游）
    bg_tadpole: "paper",     // 蝌蚪快跑：纯白纸面（唯一场景，不再做场景选择）
    tadStyle: "ink",         // 蝌蚪造型：ink 墨影 / line 线条 / brush 水墨 / dash 一笔
    frogMode: "frog",        // 青蛙卡内的玩法切换：frog=青蛙跳跳 / tadpole=蝌蚪快跑
    ffMode: "ff-walk",       // 暗夜荧光卡内节奏：ff-walk=荧光漫步 / ff-dash=急爬追光
    ffCount: 1,              // 暗夜荧光数量：二级页面可增减（1–7 只，默认 1）
    bflyMode: "bf-garden",   // 蝴蝶卡内花色：bf-garden=花园彩蝶 / bf-white=素白蝴蝶
    laserMode: "lz-classic", // 激光卡内节奏：lz-classic=经典红点 / lz-swift=疾速红点
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

  /* ===== 声音库（首页「声音」模块）=====
     参考视频里的情绪声音板：猫 / 狗两套，各 12 种情绪。每张卡 = 一个按钮，
     点一下播放对应的本地音频（同一时间只播一条，点另一张会切走）。
     24 条音频按视频中选中卡片的顺序，从用户提供的录屏提取：猫 / 狗各 12 种情绪。
     统一去首尾静音、归一到 -16 LUFS、64kbps 单声道；dur 与提取后的实际时长对齐。
     dur 用于 UI 的播放中动效（音频 onEnded 触发前的兜底时长），单位秒。 */
  G.SOUND_PACKS = [
    {
      key: "cat", name: "猫", desc: "喵星人的十二种情绪",
      sounds: [
        { key: "angry",    name: "生气", face: "angry",    src: "视频提取·cat", path: "assets/sounds/cat_angry.mp3",    dur: 0.81 },
        { key: "alert",    name: "注意", face: "alert",    src: "视频提取·cat", path: "assets/sounds/cat_alert.mp3",    dur: 1.41 },
        { key: "confused", name: "困惑", face: "confused", src: "视频提取·cat", path: "assets/sounds/cat_confused.mp3", dur: 0.91 },
        { key: "cry",      name: "哭喊", face: "cry",      src: "视频提取·cat", path: "assets/sounds/cat_cry.mp3",      dur: 0.68 },
        { key: "happy",    name: "高兴", face: "happy",    src: "视频提取·cat", path: "assets/sounds/cat_happy.mp3",    dur: 1.07 },
        { key: "grumpy",   name: "暴躁", face: "grumpy",   src: "视频提取·cat", path: "assets/sounds/cat_grumpy.mp3",   dur: 0.86 },
        { key: "bliss",    name: "幸福", face: "bliss",    src: "视频提取·cat", path: "assets/sounds/cat_bliss.mp3",    dur: 1.12 },
        { key: "hungry",   name: "饥饿", face: "hungry",   src: "视频提取·cat", path: "assets/sounds/cat_hungry.mp3",   dur: 2.14 },
        { key: "sad",      name: "悲伤", face: "sad",      src: "视频提取·cat", path: "assets/sounds/cat_sad.mp3",      dur: 1.12 },
        { key: "sorry",    name: "抱歉", face: "sorry",    src: "视频提取·cat", path: "assets/sounds/cat_sorry.mp3",    dur: 1.15 },
        { key: "surprise", name: "惊讶", face: "surprise", src: "视频提取·cat", path: "assets/sounds/cat_surprise.mp3", dur: 1.02 },
        { key: "tired",    name: "疲倦", face: "tired",    src: "视频提取·cat", path: "assets/sounds/cat_tired.mp3",    dur: 1.44 }
      ]
    },
    {
      key: "dog", name: "狗", desc: "汪星人的十二种情绪",
      sounds: [
        { key: "angry",    name: "生气", face: "angry",    src: "视频提取·dog", path: "assets/sounds/dog_angry.mp3",    dur: 2.82 },
        { key: "alert",    name: "注意", face: "alert",    src: "视频提取·dog", path: "assets/sounds/dog_alert.mp3",    dur: 1.41 },
        { key: "confused", name: "困惑", face: "confused", src: "视频提取·dog", path: "assets/sounds/dog_confused.mp3", dur: 1.72 },
        { key: "cry",      name: "哭喊", face: "cry",      src: "视频提取·dog", path: "assets/sounds/dog_cry.mp3",      dur: 0.99 },
        { key: "happy",    name: "高兴", face: "happy",    src: "视频提取·dog", path: "assets/sounds/dog_happy.mp3",    dur: 1.70 },
        { key: "grumpy",   name: "暴躁", face: "grumpy",   src: "视频提取·dog", path: "assets/sounds/dog_grumpy.mp3",   dur: 3.29 },
        { key: "bliss",    name: "幸福", face: "bliss",    src: "视频提取·dog", path: "assets/sounds/dog_bliss.mp3",    dur: 3.32 },
        { key: "hungry",   name: "饥饿", face: "hungry",   src: "视频提取·dog", path: "assets/sounds/dog_hungry.mp3",   dur: 1.67 },
        { key: "sad",      name: "悲伤", face: "sad",      src: "视频提取·dog", path: "assets/sounds/dog_sad.mp3",      dur: 2.17 },
        { key: "sorry",    name: "抱歉", face: "sorry",    src: "视频提取·dog", path: "assets/sounds/dog_sorry.mp3",    dur: 1.38 },
        { key: "surprise", name: "惊讶", face: "surprise", src: "视频提取·dog", path: "assets/sounds/dog_surprise.mp3", dur: 1.62 },
        { key: "tired",    name: "疲倦", face: "tired",    src: "视频提取·dog", path: "assets/sounds/dog_tired.mp3",    dur: 2.93 }
      ]
    }
  ];

  /* 玩法 key / 时长白名单：存储里的字段可能被旧版本写成任意类型（"abc"、null、对象），
     直接透给游戏会让计时变成 NaN、targetType 指向不存在的玩法。这里一次性收敛。 */
  const TYPES = ["fish", "butterfly", "mouse", "laser", "pool", "frog", "tadpole"];

  /* ===== 可切换模式表 =====
     某玩法有 ≥2 套模式时，首页点「开始游戏」先弹模式选择层（可左右滑动/点按翻页），
     每套 = 不同布景 + 不同运动规则 + 不同猎物种类；只有 1 套的玩法照旧直接开始。
     新增模式只需在此加一项 + 绘制分支。key 存进 config["bg_<玩法>"]，跨局记忆。 */
  G.TYPE_BGS = {
    mouse: [
      { key: "room",  name: "室内房间", desc: "木地板 · 窗光 · 地毯" },
      { key: "swarm", name: "群鼠乱窜", desc: "俯视群鼠 · 满屏乱窜" }
    ],
    /* 三个场景即游戏内真实海域（与 SEA_THEMES 一致）：小河戏鱼 / 水草森林 / 鱼群巡游。
       顺序让默认的 kelp 居中；key 与跨局记忆都不变（pool 这个 key 从「泳池追鱼」沿用下来，
       换成小河布景后仍然是「鱼不出屏」的那一套玩法，存档里的 bg_fish=pool 照旧生效）。 */
    fish: [
      { key: "pool",  name: "小河戏鱼", desc: "清澈溪流 · 卵石水草" },
      { key: "kelp",  name: "水草森林", desc: "蓝色海水 · 绿水草丛" },
      { key: "school", name: "鱼群巡游", desc: "深海鱼群 · 结群游动" }
    ],
    /* 白纸黑蝌蚪：只有一套布景，选完玩法直接开局（不再弹场景卡）。
       保留列表结构是为了复用 currentBg / bgsFor 等既有读取路径。 */
    tadpole: [
      { key: "paper", name: "白纸墨影", desc: "纯白纸面 · 黑色剪影" }
    ],
    /* 青蛙跳：只有一套布景，点开始直接进游戏（不弹背景选择层） */
    frog: [
      { key: "pond", name: "夏夜荷塘", desc: "荷叶 · 睡莲 · 荧光" }
    ]
  };
  G.bgsFor = (type) => (G.TYPE_BGS[type] || []);
  /* 青蛙卡内的玩法切换卡：首页仍只保留六张玩法卡，青蛙卡点进去再选「青蛙跳 / 蝌蚪快跑」。 */
  G.FROG_MODES = [
    { key: "frog",    name: "青蛙跳跳", desc: "荷叶之间来回跳" },
    { key: "tadpole", name: "蝌蚪快跑", desc: "白纸黑蝌蚪 · 触边折返" }
  ];
  /* 蝌蚪造型（白纸上的黑白表达）。四种都只用黑/灰，切换只改画法，不改命中判定。
     key 存 config.tadStyle，跨局记忆；二级卡页的「蝌蚪造型」一排可点选。 */
  G.TAD_STYLES = [
    { key: "ink",   name: "墨影", desc: "实心剪影 · 最远可读" },
    { key: "line",  name: "线条", desc: "简笔线稿 · 空心勾边" },
    { key: "brush", name: "水墨", desc: "笔锋飞白 · 手绘感" },
    { key: "dash",  name: "一笔", desc: "极简逗号 · 一个笔触" }
  ];
  /* 首页六张卡不变；青蛙/暗夜荧光/蝴蝶/激光各有自己的二级玩法卡。
     卡片不只换文字，分别落到 configKey 指定的真实玩法参数。
     countMax = 该玩法手动可调数量的上限（不填按 7）：青蛙跳跳受荷叶数封顶——常态 6 片叶要留
     1 片空叶供轮换，最多同屏 5 只，所以把二级页的「+」收在 5，避免选了 6/7 却只出现 5 只。 */
  G.MODE_GROUPS = {
    frog: {
      title: "青蛙玩法", sub: "先选猎物，再开始", step: "01 选玩法  /  02 开始",
      configKey: "frogMode", countMax: 5, cards: G.FROG_MODES,
      targetByKey: { frog: "frog", tadpole: "tadpole" }
    },
    pool: {
      title: "暗夜荧光玩法", sub: "夜里的石板地，荧光小虫慢慢爬", step: "01 看玩法  /  02 开始",
      configKey: "ffMode", countKey: "ffCount",
      cards: [
        { key: "ff-walk", name: "暗夜荧光", desc: "石板地 · 荧光小虫" }
      ]
    },
    butterfly: {
      title: "蝴蝶花园", sub: "花间飞行，停在花瓣上等你", step: "01 看玩法  /  02 开始",
      configKey: "bflyMode",
      cards: [
        { key: "bf-garden", name: "蝴蝶花园", desc: "花间穿梭 · 停留花瓣" }
      ]
    },
    laser: {
      title: "激光乐园", sub: "一只红点，掠过、停住、再出发", step: "01 看玩法  /  02 开始",
      configKey: "laserMode",
      cards: [
        { key: "lz-classic", name: "激光暗室", desc: "红点掠过 · 原地停留" }
      ]
    }
  };
  /* 玩法组解析：蝌蚪是青蛙卡里的第二张卡，targetType 停在 "tadpole" 时
     仍要能回到青蛙玩法组（否则重开一局会绕过卡片页、首页也没有选中卡）。 */
  G.groupKeyForType = (type) => (G.MODE_GROUPS[type] ? type : (type === "tadpole" ? "frog" : null));
  G.groupForType = (type) => { const k = G.groupKeyForType(type); return k ? G.MODE_GROUPS[k] : null; };
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
    /* 默认改为「单只」：saveConfig 会把整个 config 写进本地存档，旧存档里往往已有显式 3，
       这里用 pcV1 标记做一次性迁移，把它们也拉回新默认；之后用户在设置里改「多只」会一直保留。 */
    if (!saved.pcV1) { c.preyCount = 1; c.pcV1 = 1; }
    c.ffCount = clamp(Math.round(Number(c.ffCount) || 1), 1, 7);   // 暗夜荧光数量：1–7 只（默认 1）
    /* 默认难度/时长改为「悠闲 + 1 分钟」（PRD V1.2）：存档里往往已有旧默认的显式值，
       用 cfgV2 标记做一次性迁移——只有仍是旧默认（标准 / 3 分钟）的才拉回新默认，
       用户自己改过的（hard / 5 分钟等）保留，迁移后不再动。 */
    if (!saved.cfgV2) {
      if (saved.difficulty == null || saved.difficulty === "normal") c.difficulty = DEFAULTS.difficulty;
      if (saved.duration == null || Number(saved.duration) === 180) c.duration = DEFAULTS.duration;
      c.cfgV2 = 1;
    }
    /* 脏数据收敛：难度只认三档（此处 G.DIFF 还没建表，用字面量白名单） */
    if (["easy", "normal", "hard"].indexOf(c.difficulty) < 0) c.difficulty = DEFAULTS.difficulty;
    /* 蝌蚪造型白名单：旧存档/脏数据回落到墨影，避免画成空气。 */
    if (!G.TAD_STYLES.some(st => st.key === c.tadStyle)) c.tadStyle = DEFAULTS.tadStyle;
    /* 二级玩法卡选择的脏数据收敛：旧存档/脏值一律回到各卡第一项。 */
    const MODE_GROUP_KEYS = { frog: "frogMode", pool: "ffMode", butterfly: "bflyMode", laser: "laserMode" };
    Object.keys(MODE_GROUP_KEYS).forEach(k => {
      const g = G.MODE_GROUPS[k], field = MODE_GROUP_KEYS[k];
      if (!g) return;
      const valid = g.cards.map(card => card.key);
      if (valid.indexOf(c[field]) < 0) c[field] = g.cards[0].key;
    });
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
    dartStreak: 0, dartHits: 0,
    tadCount: 1, tadEval: 0, tadMark: 0, tadDown: 0
  };

  /* 阶段名称 */
  const STAGE_NAME = {
    fish: { 1: "阶段① 小鱼开始逃跑啦", 2: "阶段② 上下游动", 3: "阶段③ 自由游动" },
    mouse: { 1: "阶段① 慢速探头", 2: "阶段② 快速轮换", 3: "阶段③ 闪电地鼠" },
    butterfly: { 1: "阶段① 轻舞飞扬", 2: "阶段② 花间穿梭", 3: "阶段③ 疾风蝶影" },
    laser: { 1: "阶段① 缓缓游走", 2: "阶段② 快速闪现", 3: "阶段③ 疯狂光点" },
    pool:  { 1: "阶段① 荧光初现", 2: "阶段② 暗夜疾行", 3: "阶段③ 疯狂荧光" },
    frog:  { 1: "阶段① 荷叶慢跳", 2: "阶段② 跨叶远跳", 3: "阶段③ 连跳追击",
             4: "阶段④ 荷叶变阵" }
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
  /* 发光玩具（暗夜荧光）公共步态参数，节奏取自早期参考视频的逐帧测量：
     - 跑动分两档：慢爬 15–20% 屏宽/秒、急爬 50–60% 屏宽/秒，交替周期 0.5–1.4s
       （视频里帧速度中位 18%/s、90 分位 53%/s，段落速度方差达 2.1，是典型的"走走停停"）
     - 呼吸脉动 1.9–2.3Hz；每 2.2–3.6s 耳朵/翅膀/鞘壳放大"亮一下"，给猫一个动态提示
     - 自发换位很罕见（视频 24 秒只有 2 次），所以间隔给到 7–10s */
  /* pause = 走停节拍的停顿基准（秒）：实际停顿 = pause × 敏锐度 poolK，夹在 0.22–0.90s（PRD 4.6 V1.3） */
  G.FIREFLY = {
    1: { slow: 58,  fast: 150, gait: [0.55, 1.20], fastP: 0.35, pulse: 1.9, flare: [2.6, 3.8], tele: [9, 13], pause: 0.75 },
    2: { slow: 70,  fast: 190, gait: [0.45, 1.00], fastP: 0.45, pulse: 2.1, flare: [2.0, 3.0], tele: [7, 10], pause: 0.60 },
    3: { slow: 84,  fast: 230, gait: [0.36, 0.85], fastP: 0.55, pulse: 2.3, flare: [1.5, 2.4], tele: [5, 8], pause: 0.50 }
  };
  /* 走停节拍的敏锐度口径（PRD 4.6）：本只存活越短说明猫反应越快 → 下次停顿越短 */
  G.POOL_K = { init: 1, min: 0.4, max: 1.5, quickAlive: 2.5, slowAlive: 6, quick: 0.82, slow: 1.10, streakN: 3, streak: 0.94 };
  /* ===== 蝌蚪快跑 v1.0：白纸墨影 =====
     纯白纸上只有黑色剪影。每只从随机一边画外冲入，近似直线横穿（叠一条轻微正弦摆尾），
     触边时按 foldP 折返，形成 2–3 段折线；折返是唯一的「慢速窗口」，也是 +2 的奖励窗。
     数值单位 px/s（设计坐标，实际再乘 √S）；阶段表随局内时间推进。 */
  G.TAD = {
    /* spd 巡航速度 / foldP 触边折返概率 / foldMax 单只折返上限 / alive 最长存活 / gap 刷新间隔 */
    1: { spd: [228, 286], foldP: 0.72, foldMax: 2, alive: 7.4, gap: [0.95, 1.3] },
    2: { spd: [272, 336], foldP: 0.62, foldMax: 2, alive: 6.6, gap: [0.8, 1.05] },
    3: { spd: [318, 392], foldP: 0.52, foldMax: 3, alive: 5.8, gap: [0.66, 0.9] }
  };
  G.TADPOLE = {
    segs: 7, segGap: 11,        // 尾链 7 节 × 11px ≈ 77px：细长尾，摆幅小也能看出游动
    entryPad: 30,            // 出生点在边界外 30px：身体从画外游入，不是凭空出现
    entryT: 0.26,            // 入场淡入 + 1.16× 冲入提速
    entryBoost: 1.16,
    waveAmp: [2.5, 5.5], waveLen: [180, 280], // 身体正弦摆幅 ±2.5–5.5px（细长尾只需轻微摆动）
    foldDur: 0.22, foldSlow: 0.62,           // 折返弧：0.22s，速度降到 62%
    headPad: 1.5, tailPad: 1.3, foldPad: 1.15,   // 触控命中区（≈ 60×45 设计像素）
    invuln: 0.24,          // 重生间隔不用单独配：命中后走阶段 gap，漏击后 0.36–0.56s
    startle: 0.55, startleK: 1.24,           // 拍空贴近：短促加速（不整只掉头）
    countEval: 8, countAdd: 4, countDrop: 2, countMax: 3
  };
  /* 兼容旧字段（其他模块可能还引用） */
  G.POOL_DRIFT = G.FIREFLY;
  /* 兔子模式（暗夜荧光按 29.8s 实拍视频重做）30fps 逐帧实测：
     · 走 / 停交替：走 0.9–3.1s、停 0.9–2.0s；停时位移为 0（不是匀速乱飘）。
     · 走段每帧 4–8px（296 宽）≈ 每步 0.16–0.18s 一小跳，步内有前快后慢的顿挫。
     · 段内「移动方向」夹角中位仅 2.7°、90 分位 10.2° —— 一直朝前，不随机拐弯；
       玩具头朝行进方向；路线尽量保持一条直线，撞边才平滑转向。
     · 猎物可见率 82%，被拍后暗场中位 1.37s 再换点；面积约 2Hz 呼吸脉动。
     step 单位 = min(屏宽, 屏高×0.75) %/步；横屏不再按屏宽放大速度，横竖屏都约 3–5s 跑完高度。
     出生方向以左右为主、允许一点上下坡度；移动中不主动拐弯。 */
  G.RABBIT = {
    1: { step: 8.0,  hopDur: 0.16, hopGap: 0.020, walk: [1.2, 3.0], rest: [0.9, 1.8], pulse: 2.0, dark: [2.0, 2.6] },
    2: { step: 9.5,  hopDur: 0.15, hopGap: 0.020, walk: [1.4, 3.0], rest: [0.8, 1.6], pulse: 2.1, dark: [2.2, 2.8] },
    3: { step: 11.0, hopDur: 0.14, hopGap: 0.020, walk: [1.6, 3.2], rest: [0.7, 1.4], pulse: 2.2, dark: [2.4, 3.0] }
  };
  /* 暗夜荧光（第一版）：一只荧光小虫在暗色石板地上爬行，腹尾荧光呼吸脉动。
     行为引擎是 updateFirefly（慢爬/急爬两档步态 + 罕见自发暗场换位），节奏见 G.FIREFLY；
     G.RABBIT 表已不再使用。 */
  G.FF_TOYS = [
    { key: "dog",     name: "荧光小狗", w: 1, spd: 0.94, fastP: -0.06, gait: 1.15, flare: 1.25, size: 1.06 },
    { key: "mouse",   name: "荧光老鼠", w: 1, spd: 1.12, fastP: 0.10,  gait: 0.92, flare: 0.95, size: 0.98 },
    { key: "ladybug", name: "荧光瓢虫", w: 1, spd: 0.86, fastP: -0.02, gait: 0.80, flare: 0.70, size: 0.92 }
  ];
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
    3: { crouch: 0.44, leap: 0.64, land: 0.24, settle: 0.62, count: 5, prep: 0.35, nearFirst: 0, chain: 2 },
    /* ④ 换场：节奏与阶段②完全一致（不连跳），落点改为「周边 2 片叶距离内任选」；
       小荷叶被踩到会沉没且不再浮起，见 scenery.js G.rebuildFrogPads / G.padSink */
    4: { crouch: 0.52, leap: 0.72, land: 0.26, settle: 0.80, count: 5, prep: 0.35, nearFirst: 0, chain: 1, roam: 2 }
  };
  /* 老鼠花色 variants：毛色分层（背→中→腹）/ 耳 / 爪 / 尾 / 眼鼻 + 速度体型差异
     群鼠乱窜（swarm）6 只差异化角色：体型×毛色×配饰×步态，体现性格层次（见 docs/design-mouse-swarm.md）
     accessory：topknot 头顶翘毛 / scar 耳疤 / spine 背脊纹 / whiteTip 尾尖白毛 / 无
     gait：stride 昂首阔步 / dash 弓背疾冲 / slink 贴边滑步 / weave 扭腰走 S */
  G.MOUSE_VARIANTS = [
    { key: "house", name: "老仓", speed: 0.88, size: 1.18, accessory: "topknot", collar: true, gait: "stride",
      back: "#7a6450", mid: "#9c8468", belly: "#e2d3ba",
      ear: "#7a6450", earIn: "rgba(232,180,169,.72)", earFar: "#6a5645", earRim: "rgba(255,255,255,.22)",
      fur: "rgba(78,68,55,.2)", tail: "#c99f85", tailRing: "rgba(120,86,64,.42)",
      paw: "#ccbba4", foot: "#c2b099", eye: "#221a14", eyeRim: "rgba(0,0,0,.25)",
      nose: "#d98a7d", haunch: "rgba(135,121,106,.26)", sheen: "rgba(240,228,209,.6)" },
    { key: "charcoal", name: "炭胆", speed: 1.32, size: 1.05, accessory: "scar", gait: "dash",
      back: "#544e47", mid: "#6f685f", belly: "#9d968a",
      ear: "#5c5a56", earIn: "rgba(216,166,158,.7)", earFar: "#4a4845", earRim: "rgba(255,255,255,.16)",
      fur: "rgba(30,28,26,.24)", tail: "#a98871", tailRing: "rgba(90,64,50,.5)",
      paw: "#a99c8c", foot: "#9c907f", eye: "#17120e", eyeRim: "rgba(0,0,0,.3)",
      nose: "#c97f74", haunch: "rgba(60,56,52,.3)", sheen: "rgba(214,205,190,.5)" },
    { key: "albino", name: "霜尖", speed: 1.05, size: 0.90, gait: "slink",
      back: "#f3ede4", mid: "#faf6ef", belly: "#ffffff",
      ear: "#f2ece4", earIn: "rgba(243,177,187,.8)", earFar: "#e6ded4", earRim: "rgba(255,255,255,.55)",
      fur: "rgba(196,182,168,.28)", tail: "#eab6ac", tailRing: "rgba(199,138,126,.42)",
      paw: "#f6dfd9", foot: "#f2d3cc", eye: "#c0392b", eyeRim: "rgba(140,32,22,.5)",
      nose: "#e0908a", haunch: "rgba(214,196,182,.35)", sheen: "rgba(255,255,255,.72)" },
    { key: "deer", name: "花栗", speed: 1.00, size: 1.00, accessory: "spine", gait: "weave",
      back: "#8a6b4f", mid: "#a98a68", belly: "#e8dcc4",
      ear: "#96754f", earIn: "rgba(238,180,170,.75)", earFar: "#7a5d3f", earRim: "rgba(255,240,220,.3)",
      fur: "rgba(88,62,38,.22)", tail: "#d8b49a", tailRing: "rgba(150,105,72,.5)",
      paw: "#fdfaf3", foot: "#f7f2e6", eye: "#1d150e", eyeRim: "rgba(0,0,0,.26)",
      nose: "#d98a7d", haunch: "rgba(120,90,60,.28)", sheen: "rgba(250,242,226,.62)" },
    { key: "pup", name: "灰仔", speed: 0.96, size: 0.78, gait: "slink",
      back: "#b3aaa0", mid: "#c9c2b6", belly: "#efe9dd",
      ear: "#b3aaa0", earIn: "rgba(232,180,169,.7)", earFar: "#a2988c", earRim: "rgba(255,255,255,.28)",
      fur: "rgba(120,112,100,.22)", tail: "#cdb9a8", tailRing: "rgba(130,110,92,.4)",
      paw: "#d8d2c6", foot: "#cec6b8", eye: "#221a14", eyeRim: "rgba(0,0,0,.25)",
      nose: "#d98a7d", haunch: "rgba(160,150,138,.26)", sheen: "rgba(248,244,236,.55)" },
    { key: "smoky", name: "烟尾", speed: 1.18, size: 0.95, accessory: "whiteTip", gait: "dash",
      back: "#5b5866", mid: "#7c7889", belly: "#b6b2c0",
      ear: "#5b5866", earIn: "rgba(210,180,200,.72)", earFar: "#4e4b59", earRim: "rgba(255,255,255,.2)",
      fur: "rgba(40,38,50,.24)", tail: "#a99aae", tailRing: "rgba(90,70,100,.48)",
      paw: "#b0aab6", foot: "#a49eae", eye: "#1c1822", eyeRim: "rgba(0,0,0,.28)",
      nose: "#c9848a", haunch: "rgba(70,66,84,.3)", sheen: "rgba(210,205,220,.5)" }
  ];
  /* 序列帧动画（Cocos Creator 关键帧 → 导出 PNG 序列帧的接入配置）。
     两个视角各一套注册表，设计框与 draw.mouse（侧视 120×78）/ draw.mouseTop（俯视 120×100）中心对齐。
     file 为 assets 内相对路径；每段 sheet 是「横向单行 N 帧」拼接，每帧尺寸 = 该视角 design.w × design.h。
     未放帧资源 / 文件缺失时，frames.js 静默回退到 draw.js 程序化绘制，游戏照常。 */
  G.MOUSE_ANIM = {
    /* 侧视探头鼠（draw.mouse）：设计框 120×78 */
    side: {
      design: { w: 120, h: 78 },
      clips: {
        run:   { file: "assets/frames/mouse_run.png",   frames: 8, fps: 12, loop: true  },   // 疾跑/窜逃（dart/scurry）
        peek:  { file: "assets/frames/mouse_peek.png",  frames: 6, fps: 8,  loop: false }    // 探头/停驻（peek/pause）
      }
    },
    /* 俯视群鼠（draw.mouseTop）：设计框 120×100 */
    top: {
      design: { w: 120, h: 100 },
      clips: {
        run:   { file: "assets/frames/mousetop_run.png",   frames: 8, fps: 12, loop: true  },   // 疾走（scurry）
        pause: { file: "assets/frames/mousetop_pause.png", frames: 4, fps: 6,  loop: true  }    // 停驻（pause）
      }
    }
  };
  /* 激光花色 variants：红色为主（w = 出现权重），翠绿更快更小（约 1/4 概率）；只保留红绿两色 */
  /* 只保留赤红光点：之前 red(权重 3) / green(权重 1) 加权随机，约 25% 概率抽到翠绿光点，
     玩家会误以为激光"变色了"。绿色那档的配色与绘制代码仍保留在下方（LASER_COLORS.green /
     LASER_SKIN.green），需要时把这一行加回即可恢复。 */
  G.LASER_VARIANTS = [
    { key: "red",   name: "赤红光点", speed: 1,    size: 1,    w: 1 }
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
  /* 微信原生模板广告位 ID（流量主后台 → 广告位管理 → 新建「原生模板广告」）。
     用于首页 / 结算页 / 选场景 / 动物情绪 / 召唤 / 电子猫粮机六个非对局页面；留空时广告层自动跳过、不报错。 */
  G.AD_UNIT_ID = "adunit-11387560cd72b333";
  /* 插屏广告位 ID（流量主后台 → 广告位管理 → 新建「插屏广告」）。
     打开「本周记录」弹窗时触发一次；留空或环境不支持 wx.createInterstitialAd 时静默跳过。 */
  G.INTERSTITIAL_AD_UNIT_ID = "adunit-347047dcdea0cdfa";
  /* 猎物基础定义 */
  G.PREY_DEF = {
    fish:      { w: 116, h: 70, speed: 95,  wobF: 2.0, wobA: 0.55, dartMin: 2.2, dartMax: 4.2, yMin: 0.02, yMax: 0.9,  face: true,  sparkColor: "#ffb02e" },
    mouse:     { w: 116, h: 58, speed: 125, wobF: 3.2, wobA: 0.35, dartMin: 1.4, dartMax: 2.8, yMin: 0.45, yMax: 0.98, face: true,  sparkColor: "#e8d9bd" },
    butterfly: { w: 92,  h: 80, speed: 52,  wobF: 4.2, wobA: 0.9,  dartMin: 2.8, dartMax: 4.8, yMin: 0.02, yMax: 0.6,  face: true,  sparkColor: "#ffd94d" },
    laser:     { w: 54,  h: 54, speed: 265, wobF: 5.5, wobA: 0.85, dartMin: 0.5, dartMax: 1.2, yMin: 0.02, yMax: 0.92, face: false, sparkColor: "#ff6b6b" },
    /* 暗夜荧光：发光玩具命中盒比激光略大（高速目标宽容些），spark 用荧光黄绿 */
    pool:      { w: 66,  h: 66, speed: 330, wobF: 5.5, wobA: 0.85, dartMin: 0.5, dartMax: 1.1, yMin: 0.02, yMax: 0.92, face: false, sparkColor: "#f4ffa8" },
    /* 青蛙跳：体型大、移动靠跳跃（不参与巡游速度），spark 用荷叶青绿 */
    frog:      { w: 96,  h: 78, speed: 100, wobF: 2.0, wobA: 0.4,  dartMin: 2.0, dartMax: 3.0, yMin: 0.30, yMax: 0.80, face: true,  sparkColor: "#bdf58a" },
    /* 蝌蚪快跑：头小尾长（o------），speed 为闲游基准（逃窜 ×2.6 / 疾冲 ×4 在状态机里算） */
    tadpole:   { w: 40,  h: 30, speed: 110, wobF: 1.2, wobA: 0.5,  dartMin: 1.0, dartMax: 1.8, yMin: 0.05, yMax: 0.92, face: true,  sparkColor: "#14161a" }
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
     decor=装饰类型（buildScene/drawSea 分支）；amb=环境粒子类型（fx.update 分支）；
     fishVis=鱼类「视觉」缩放（只缩 draw 出来的尺寸，命中盒仍按原大小，手感不变）。
     默认 1，只有水草森林收到 0.8：那片海草占掉大半屏宽，同尺寸的鱼在窄屏（小屏手机）上
     显得又满又大，收两档（0.9 → 0.8）后鱼与草丛的比例才舒服。 */
  G.SEA_THEMES = [
    { key: "reef",  name: "珊瑚海",   speed: 1,    spark: "#ffd76a", ripple: "rgba(255,255,255,.85)",
      bg: ["#1b7f8f", "#10556a", "#0b3a4c"], sand: "#43635e", decor: "coral",  amb: "bubble" },
    { key: "abyss", name: "深海荧光", speed: 0.92, spark: "#7fe7ff", ripple: "rgba(127,231,255,.85)",
      bg: ["#0b2d4e", "#072038", "#041226"], sand: "#1e3d52", decor: "glow",   amb: "plankton" },
    { key: "ice",   name: "冰海浮冰", speed: 1.08, spark: "#eaf6ff", ripple: "rgba(214,238,255,.85)",
      bg: ["#5c9cc0", "#3a76a0", "#22557c"], sand: "#8fb4c9", decor: "ice",    amb: "snow" },
    { key: "kelp",  name: "水草森林", speed: 1,    spark: "#ffd76a", ripple: "rgba(255,255,255,.85)",
      bg: ["#1b7f8f", "#10556a", "#0b3a4c"], sand: "#43635e", decor: "kelp",   amb: "bubble", fishVis: 0.8 },
    { key: "school", name: "鱼群巡游", speed: 1.3, spark: "#ffe9a8", ripple: "rgba(255,255,255,.9)",
      bg: ["#12406b", "#0c2e50", "#071e38"], sand: "#22405c", decor: "school", amb: "bubble" },
    /* 小河戏鱼：浅溪俯视（对齐参考图的青绿溪水 + 透出的卵石河床 + 岸边草石）。
       沙床/石头/水草不再走通用底床绘制，整屏由 drawCreekSea 接管，这里只留色板给 HUD、
       结算卡与场景卡预览取色（bg = 远→近三档水色，sand = 河床卵石主色） */
    { key: "pool",  name: "小河戏鱼", speed: 1.02, spark: "#f2ffd8", ripple: "rgba(238,255,232,.92)",
      bg: ["#5f9573", "#356b52", "#1e4736"], sand: "#6e7550", decor: "pool",   amb: "bubble" }
  ];
  /* 小河戏鱼专属鱼种：河里的观赏鱼（对齐参考图的三条——红金鱼 / 黄金鱼 / 乌白云锦鲤），
     三个色型随机出现；专属造型 shape:"creekFish" 是「俯视偏斜」视角——
     卵形侧扁体 + 尾柄收细 + 半透明大扇尾（尾尖近白）+ 两侧胸鳍 + 脊背高光 + 双黑眼
     （俯视能看到头的两侧各一只）。128×76 的命中盒略大于画出来的鱼身，猫好拍。 */
  G.POOL_FISH_SPECIES = [
    { key: "creekred", name: "红金鱼", shape: "creekFish", speed: 0.95, w: 128, h: 76, behavior: "pulse",
      variants: [
        { body: "#e8452a", bodyGrad: ["#d0331c", "#ff8a5c"], fin: "#ff8f66", tip: "#ffe0d2",
          accent: "#1b1210", pattern: null, tailK: 1 }
      ] },
    { key: "creekyellow", name: "黄金鱼", shape: "creekFish", speed: 1.02, w: 128, h: 76, behavior: "pulse",
      variants: [
        { body: "#f2bf1c", bodyGrad: ["#e2a309", "#ffe081"], fin: "#ffd95c", tip: "#fffbe8",
          accent: "#241b0c", pattern: null, tailK: 1.06 }
      ] },
    { key: "creekkoi", name: "乌白云锦鲤", shape: "creekFish", speed: 0.9, w: 128, h: 76, behavior: "pulse",
      variants: [
        { body: "#f4efe6", bodyGrad: ["#e6e0d3", "#fffdf8"], fin: "#dedcd0", tip: "#f8f8ee", tailK: 0.86,
          accent: "#14141a", pattern: "koi",
          /* 斑块按鱼身归一化坐标：x 0=尾柄 1=吻端，y 0=背 1=腹；rx/ry 为半径比例。
             参考图的墨斑是"连成片的鞍状"：三块大斑沿背脊前后相连，再补一块头顶、一块尾柄 */
          patches: [
            { x: 0.36, y: 0.22, rx: 0.20, ry: 0.62, rot: -0.22 },
            { x: 0.60, y: 0.80, rx: 0.15, ry: 0.52, rot: 0.26 },
            { x: 0.80, y: 0.30, rx: 0.14, ry: 0.58, rot: -0.12 },
            { x: 0.94, y: 0.58, rx: 0.12, ry: 0.48, rot: 0.06 },
            { x: 0.12, y: 0.30, rx: 0.11, ry: 0.44, rot: 0 }
          ] }
      ] }
  ];
  G.POOL_FISH_KEYS = ["creekred", "creekyellow", "creekkoi"];
  /* 鱼群巡游专属鱼种：极小的银蓝"彗星"小鱼（亮头长尾迹，独立表不进深海全表），
     数量多（36→44→52）聚成"饵球"——鲸鱼捕食式致密鱼团，整体漂移+球内旋转 */
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
    /* 青蛙跳有四段，其余玩法仍是三段：其它玩法的参数表只有 1/2/3，
       共用四段会让它们回落到阶段①参数，所以这里按玩法分流。
       1 分钟局：0–18 / 18–33 / 33–48 / 48–60 秒。 */
    if (G.config.targetType === "frog") {
      const f1 = Math.min(20, dur * 0.30);              // 60s → 18s
      const f2 = f1 + Math.min(15, dur * 0.25);         // 60s → 33s
      const f3 = f2 + Math.min(15, dur * 0.25);         // 60s → 48s
      return elapsed < f1 ? 1 : elapsed < f2 ? 2 : elapsed < f3 ? 3 : 4;
    }
    const t1 = Math.min(20, dur * 0.3);
    const t2 = t1 + Math.min(50, dur * 0.5);
    return elapsed < t1 ? 1 : elapsed < t2 ? 2 : 3;
  };
};
