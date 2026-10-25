/* game.js — 逗猫触屏玩具 · 微信小游戏版入口
   模块装配 → 游戏流程（首页/倒计时/游玩/暂停/结算）→ 主循环 → 触摸路由 → 命中/拍偏逻辑 */
const G = {};
if (typeof globalThis !== "undefined") globalThis.G = G;   // 暴露给测试垫片

require("./js/platform.js")(G);
require("./js/config.js")(G);
require("./js/audio.js")(G);
require("./js/draw.js")(G);
require("./js/scenery.js")(G);
require("./js/prey.js")(G);
require("./js/ui.js")(G);
require("./js/sharecard.js")(G);   // 分享卡片 / 猫咪反应测评图

const ctx = G.platform.ctx;
const clamp = G.clamp;
G.screen = "home";        // home | settings | records | counting | playing | paused | result
G.nextScreen = null;
G.transitionT = 0;
G.shake = 0;
G.result = null;
G.pauseHold = { active: false, t0: 0, progress: 0 };   // HUD 暂停按钮长按状态（600ms 触发）
let countT = 0, lastInt = -1;

G.switchScreen = (name) => {
  if (G.screen === name) return;
  G.nextScreen = name;
  G.transitionT = 0;
};

/* ================= 真机调试面板（预览/体验版默认关闭 vConsole，需要时把 enableDebug 改为 true） ================= */
function initDebug() {
  try {
    if (typeof wx !== "undefined" && wx.setEnableDebug) {
      const info = (typeof wx.getAccountInfoSync === "function") ? wx.getAccountInfoSync() : {};
      const env = (info && info.miniProgram && info.miniProgram.envVersion) || "";
      if (env === "develop" || env === "trial") {
        wx.setEnableDebug({ enableDebug: false });
        console.log("[catToy] vConsole disabled for " + env);
      }
    }
  } catch (e) { console.log("[catToy] setEnableDebug skipped", e && e.message); }
}
initDebug();

/* ================= 分享：结算页"晒给猫友" + 右上角菜单转发 =================
   传播逻辑：玩的是猫，转发的是铲屎官。所以文案主语必须是「我家猫」，
   配上猫咪反应测评图（5:4），而不是游戏截图或"我得了 X 分"。
   量词随玩法走：鱼论「条」、光点论「个」，其余论「只」——统一写「只」在捕鱼/激光局会不通顺。 */
const HIT_UNIT = { fish: "条", butterfly: "只", mouse: "只", laser: "个", pool: "只" };
const HIT_NOUN = { fish: "小鱼", butterfly: "蝴蝶", mouse: "老鼠", laser: "光点", pool: "萤光虫" };
G.shareResult = () => {
  const R = G.result || {};
  const hits = Number(R.hits) || 0;
  const type = (G.config && G.config.targetType) || "fish";
  const unit = HIT_UNIT[type] || "只";
  const noun = HIT_NOUN[type] || "猎物";
  // 评级本身带感叹号（"捕猎大师！"），再套一层「」会显得叠字，去掉尾部标点
  const rating = String(R.title || "").replace(/[!！。.、\s]+$/, "");
  const infinite = !!G.config.infinite;
  const durMin = infinite ? 0 : Math.max(1, Math.round((Number(G.config.duration) || 180) / 60));
  // 一只没抓到时不写"抓了 0 只"（像在自嘲成绩），改成有画面感的描述；量词要跟玩法一致
  const none = "一" + unit + noun + "都没抓到，全程当观众";
  let title;
  if (hits <= 0) {
    title = durMin ? "我家猫 " + durMin + " 分钟里" + none : "我家猫" + none;
    if (rating) title += "，评级「" + rating + "」";
  } else {
    const body = hits + " " + unit + noun;
    title = durMin
      ? "我家猫 " + durMin + " 分钟抓了 " + body
      : "我家猫一口气抓了 " + body;
    if (rating) title += "，评级「" + rating + "」";
  }
  let imageUrl = "";
  try { imageUrl = G.buildShareCard(); } catch (e) {}
  // 属性名与 We分析 后台逐字一致（has_img 蛇形命名），写错不会报错、只会丢字段
  G.track("share_tap", { hits, rated: R.title || "", has_img: imageUrl ? 1 : 0 });
  G.platform.shareApp({ title, imageUrl: imageUrl || undefined, query: "from=share" });
};
/* 结算页"存成图片"：存到相册后由用户自己发朋友圈（朋友圈对游戏类分享有限制，相册图不受限） */
G.saveCard = () => {
  G.track("save_card", { hits: Number((G.result || {}).hits) || 0 });
  G.saveShareCard();
};
/* 排行榜/首页的「邀猫友比一比」：没有本局结果时用累计档案卡，保证卡片永远有内容。
   注意合规：这里只是邀请，不设"分享才解锁/复活"之类的奖励门槛。
   纪录（catToyBest）是跨玩法取最大值，量词不能按当前玩法写，统一用「个猎物」。 */
G.shareInvite = (from) => {
  const arch = G.archiveSummary ? G.archiveSummary() : { games: 0, hits: 0 };
  let best = 0;
  try { best = Number(G.platform.storage.get("catToyBest")) || 0; } catch (e) {}
  const title = best > 0
    ? "我家猫一局最多抓了 " + best + " 个猎物，把你家猫也拉来比比"
    : "给你家猫开个捕猎场，看谁家猫更凶";
  let imageUrl = "";
  try { imageUrl = G.buildShareCard(arch.games > 0 ? "archive" : "single"); } catch (e) {}
  // 参数用 src 不用 from：属性在 We分析 里是全局共享的，app_open 的 from 是数值(0~3)，
  // 这里传文本 "lb" 会造成同一属性两种类型，后台只会认一种，另一边的数据就被判脏。
  G.track("invite_tap", { src: from || "lb", best, arch: arch.games, has_img: imageUrl ? 1 : 0 });
  // 落地页来源按入口区分：设置页分享与排行榜分享的转化率要能分开看
  const src = from === "settings" ? "settings" : "lb";
  G.platform.shareApp({ title, imageUrl: imageUrl || undefined, query: "from=" + src });
};
G.platform.initShare(() => ({
  title: "给你家猫开个捕猎场：小鱼、蝴蝶、老鼠、光点、萤光虫轮着来，看它能抓到几个",
  query: "from=menu"
}));

/* ================= 开局 ================= */
G.startGame = () => {
  G.stopSummonMusic();   // 召唤语音不串进对局
  G.ensureAudio();
  const S = G.session;
  S.touches = 0; S.hits = 0; S.bonusHits = 0; S.combo = 0; S.maxCombo = 0;
  S.missStreak = 0; S.dartStreak = 0; S.dartHits = 0;
  S.adaptiveTier = 0; S.comboTier = 0; S.lastTierDropAt = 0;
  S.remaining = Number(G.config.duration) || 180;
  S.infinite = !!G.config.infinite;   // 无限模式：倒计时仅用于阶段推进，不自动结束
  S.running = false; S.paused = false; S.counting = true;
  S.time = 0; S.secAcc = 0; S.stage = 1;
  G.uiFX.stagePop = 0; G.ui.hudDimT = 0;
  // 鱼玩法：海域由背景选择层决定（水草森林 / 泳池追鱼，左右滑动切换、跨局记忆）
  S.sea = G.config.targetType === "fish" ? (G.SEA_THEMES.find(t => t.key === G.currentBg()) || G.SEA_THEMES[0]) : null;
  G.buildScene(G.config.targetType);
  G.fx.clear();
  G.buildPreys();
  G.topUpPreys();   // 开局即补足到当前阶段的目标数量（鱼群模式开局就该是一大群，而非 3 条等阶段②）
  if (G.config.keepScreen) { G.platform.keepScreen(true); S._keepOn = true; }
  const beginGame = () => {
    countT = 3; lastInt = -1;
    G.switchScreen("counting");
    G.track("game_start", {
      mode: G.config.targetType,
      dur: G.config.infinite ? 0 : (Number(G.config.duration) || 180),
      pc: Number(G.config.preyCount) || 3
    });
  };
  // 防误触引导：首局进游戏弹一次系统防误触说明（微信内无法拦截系统手势，只能靠
  // iOS 引导式访问 / 安卓防误触模式）；弹窗期间不倒计时，看完再开始。
  if (G.config.antiMistouch && !G.platform.storage.get("catToyAntiShown")) {
    try { G.platform.storage.set("catToyAntiShown", "1"); } catch (e) {}
    G.platform.antiGuide(beginGame);
  } else {
    beginGame();
  }
};

function beginPlay() {
  G.session.counting = false;
  G.session.running = true;
  G.session.lastTs = performance.now();
  G.playGo();
  G.screen = "playing"; // Use direct assignment to avoid repeated calls during transition
  G.nextScreen = null;
  G.transitionT = 0;
}

/* ================= 模式选择弹层（拥有多套模式的玩法专用） =================
   有 ≥2 套模式的玩法（捕鼠/捕鱼）点「开始游戏」先弹一层可左右滑动/点按翻页的模式卡，
   每张卡对应一套布景+运动规则+猎物种类；只有 1 套的玩法照旧直接开始，不额外打扰。
   卡片按「一屏约 1.5 张」布局：CW = W*0.64 + 间距，滑动时露出半张下一张。 */
G.requestStart = () => {
  const arr = G.bgsFor(G.config.targetType);
  if (arr.length > 1) { G.openBgPick(); return; }
  G.startGame();
};

G.openBgPick = () => {
  const arr = G.bgsFor(G.config.targetType);
  const cur = G.currentBg();
  // t0=弹入动画起点；relOff/relT0=松手后的吸附动画（残余位移按缓动归零）；touchActive=本次按压是否落在卡片区（按钮点按不翻页）
  G.bgPick = { idx: Math.max(0, arr.findIndex(b => b.key === cur)), off: 0, drag: false, x0: 0, moved: 0, cw: 0, gap: 0,
    t0: performance.now(), relOff: 0, relT0: 0, touchActive: false };
  G.switchScreen("bgpick");
};

G.closeBgPick = () => { G.bgPick = null; G.switchScreen("home"); };

/* 确认背景 → 记住选择（跨局） → 开局 */
G.confirmBgPick = () => {
  const type = G.config.targetType;
  const arr = G.bgsFor(type);
  const P = G.bgPick;
  const sel = arr[P ? Math.max(0, Math.min(arr.length - 1, P.idx)) : 0];
  if (sel) { G.config["bg_" + type] = sel.key; G.saveConfig(); }
  G.bgPick = null;
  G.startGame();
};

function bgPickStep() {
  const P = G.bgPick;
  return P && P.cw ? P.cw + P.gap : (G.platform.W || 300) * 0.6;
}
/* 箭头按钮切换：与松手吸附共用同一动画（relOff 连续归零），拖动中忽略 */
G.bgPickArrow = (dir) => {
  const P = G.bgPick; if (!P || P.drag) return;
  const arr = G.bgsFor(G.config.targetType);
  const ni = Math.max(0, Math.min(arr.length - 1, P.idx + dir));
  if (ni === P.idx) return;
  const step = bgPickStep();
  P.relOff = P.off + (ni - P.idx) * step;
  P.idx = ni;
  P.relT0 = performance.now();
  P.off = 0;
};

G.bgPickTouchStart = (x) => {
  const P = G.bgPick; if (!P) return;
  P.drag = true; P.x0 = x; P.moved = 0;
  P.touchActive = true;
  P.relOff = 0;                                    // 按下即终止上一次吸附动画
};
G.bgPickTouchMove = (x) => {
  const P = G.bgPick; if (!P || !P.drag) return;
  const arr = G.bgsFor(G.config.targetType);
  let d = x - P.x0;
  P.moved = Math.max(P.moved, Math.abs(d));
  // 首尾边界：继续往外拖只跟 35%，手感"拉不动"而不是硬顶
  const step = bgPickStep();
  const maxScroll = (arr.length - 1) * step;
  const scroll = P.idx * step - d;
  if (scroll < 0) d += scroll * 0.65;
  else if (scroll > maxScroll) d += (scroll - maxScroll) * 0.65;
  P.off = d;
};
G.bgPickTouchEnd = (x) => {
  const P = G.bgPick; if (!P) return;
  P.drag = false;
  const wasActive = P.touchActive; P.touchActive = false;
  if (!wasActive) return;                          // 按钮点按（onTouchStart 已被 hitButton 截走）：不翻页
  const arr = G.bgsFor(G.config.targetType);
  const step = bgPickStep();
  let dir = 0;
  if (P.moved > 8) {                               // 拖动：按位移阈值换页
    if (Math.abs(P.off) > step * 0.16) dir = P.off < 0 ? 1 : -1;
  } else if (x != null) {                          // 点按：当前卡左右边缘之外（层叠露出的邻卡/空侧）翻页
    const W = G.platform.W;
    const half = (P.cw || W * 0.64) / 2;
    if (x < W / 2 - half) dir = -1;
    else if (x > W / 2 + half) dir = 1;
  }
  const newIdx = Math.max(0, Math.min(arr.length - 1, P.idx + dir));
  // 吸附动画：残余位移从「松手位置 + 已换页步长」连续归零（换页/回弹都平滑）
  P.relOff = P.off + (newIdx - P.idx) * step;
  P.idx = newIdx;
  P.relT0 = performance.now();
  P.off = 0;
};

/* ================= 召唤猫咪交互 ================= */
G.summonPickTouchStart = (x) => {
  const P = G.summonPick; if (!P) return;
  P.drag = true; P.x0 = x; P.off = 0; P.relOff = 0;
};
G.summonPickTouchMove = (x) => {
  const P = G.summonPick; if (!P || !P.drag) return;
  P.off = x - P.x0;
};
G.summonPickTouchEnd = (x) => {
  const P = G.summonPick, kinds = G.CAT_KINDS || [];
  if (!P || !P.drag) return;
  P.drag = false;
  const threshold = P.cw * 0.35;
  let dir = 0;
  if (P.off < -threshold) dir = 1;
  else if (P.off > threshold) dir = -1;
  
  const old = P.idx;
  P.idx = G.clamp(P.idx + dir, 0, kinds.length - 1);
  P.relOff = P.off - (P.idx - old) * P.step;
  P.relT0 = performance.now();
  P.off = 0;                     // 清掉拖动残留位移，避免回弹结束后卡片跳位
  if (P.idx !== old) {
    // 滑动/点按翻页只切换卡片，不自动播放：必须点「开始召唤」或卡片才发声
    G.stopSummonMusic();
    G.playTick();
  }
};

/* ================= 每秒心跳 ================= */
function tickSecond() {
  const S = G.session;
  // 无限模式：倒计时仅用于阶段推进，不减到负、不自动结束（给猫玩不中途打断）
  if (S.infinite) {
    if (S.remaining > 0) S.remaining--;
    if (S.remaining < 0) S.remaining = 0;
    const st = G.stageNow();
    if (st !== S.stage) {
      S.stage = st;
      G.uiFX.stageText = G.stageName(st);
      G.uiFX.stagePop = 1.6;
      G.pokeHud();
      G.topUpPreys();   // 多只蝴蝶/激光：随阶段递增数量（3→5→7）
    }
    return;
  }
  S.remaining--;
  if (S.remaining <= 0) { G.endGame(); return; }
  const st = G.stageNow();
  if (st !== S.stage) {
    S.stage = st;
    G.uiFX.stageText = G.stageName(st);
    G.uiFX.stagePop = 1.6;
    G.pokeHud();
    G.topUpPreys();   // 多只蝴蝶/激光：随阶段递增数量（3→5→7）
  }
}

/* ================= 结算 ================= */
G.endGame = (fromPause) => {
  const S = G.session;
  S.running = false;
  S._keepOn = false;
  G.platform.keepScreen(false);
  const totalHits = S.hits + (S.bonusHits || 0);
  const acc = S.touches > 0 ? Math.min(100, Math.round((totalHits / S.touches) * 100)) : 0;
  // 本地记录（最近 50 局）：走 G.getLogs() 做安全解析——存储里若是对象或含 null 元素，
  // 直接 unshift/slice 会在结算时抛错，结算页出不来
  const logs = G.getLogs();
  const d = new Date();
  logs.unshift({
    date: (d.getMonth() + 1) + "/" + d.getDate(),
    type: G.config.targetType,
    dur: Number(G.config.duration) || 180,
    hits: totalHits, touches: S.touches,
    accuracy: acc, combo: S.maxCombo,
    dart: S.dartHits || 0, bonus: S.bonusHits || 0
  });
  G.platform.storage.set("catToyLogs", JSON.stringify(logs.slice(0, 50)));
  // 好友排行榜：本地历史最佳为基准，超过则更新，经 setUserCloudStorage 写入关系链（仅好友可见，无通讯录权限）
  let best = 0;
  try { best = Number(G.platform.storage.get("catToyBest")) || 0; } catch (e) {}
  if (totalHits > best) { best = totalHits; G.platform.storage.set("catToyBest", String(best)); }
  G.platform.reportBest(best);
  // 评级（与原型同阈值）
  // 真实游玩时长（S.time 在 playing 累加、不含倒计时与暂停）= 累计秒数
  const playSec = Math.max(S.time, 1 / 60);
  const mins = Math.max(playSec / 60, 1 / 60);
  const hpm = totalHits / mins;
  const interacted = S.touches >= 8 && (totalHits >= 5 || S.maxCombo >= 3);
  // 累计档案（分享图的"猫档案"维度全从这里取）+ 结束埋点。
  // done=1 是打满时长完赛，done=0 是用户中途"结束本局"；放弃率 = 1 - done1 / game_start。
  try {
    G.recordArchive({ type: G.config.targetType, hits: totalHits, touches: S.touches, hpm });
  } catch (e) {}
  G.track("game_end", {
    mode: G.config.targetType,
    dur: G.config.infinite ? 0 : (Number(G.config.duration) || 180),
    hits: totalHits,
    done: fromPause ? 0 : 1,
    sec: Math.round(playSec)
  });
  let title, desc;
  if (hpm >= 18)      { title = "捕猎大师！"; desc = "这个反应速度，堪称专业级猎手。"; }
  else if (hpm >= 9 || (interacted && hpm >= 6)) { title = "矫健猎手"; desc = "扑击精准、节奏稳健，状态很好。"; }
  else if (hpm >= 3.5 || interacted) { title = "灵巧学徒"; desc = "全程都有参与，正在建立信心。"; }
  else                { title = "慵懒观察员"; desc = "今天兴趣不大？换个猎物类型试试。"; }
  const tag = G.config.targetType === "mouse" ? "追击" : G.config.targetType === "butterfly" ? "精准扑击" : G.config.targetType === "laser" ? "光点落网" : G.config.targetType === "pool" ? "光爆炸裂" : "奖励命中";
  G.result = {
    title, desc, touches: S.touches, hits: totalHits, acc, maxCombo: S.maxCombo,
    bonusTag: S.bonusHits > 0 ? "含" + tag + " ×" + S.bonusHits : ""
  };
  G.switchScreen("result");
};

/* ================= 自适应辅助（与原型 1:1） ================= */
function applyAdaptive() {
  const S = G.session;
  const active = G.config.adaptive && S.combo < 3;
  const boost = active ? Math.min(1 + Math.max(S.missStreak - 3, 0) * 0.09, 1.55) : 1;
  const slow = active ? Math.max(1 - Math.max(S.missStreak - 3, 0) * 0.06, 0.6) : 1;
  G.preys.forEach(p => { p.adaptiveScale = boost; p.adaptiveSlow = slow; p.applySize(); });
  const tier = active ? (S.missStreak >= 9 ? 3 : S.missStreak >= 6 ? 2 : S.missStreak >= 3 ? 1 : 0) : 0;
  if (tier > (S.adaptiveTier || 0)) {
    const hints = { 1: "已自动放慢并放大猎物", 2: "猎物更容易拍了", 3: "辅助力度已拉满" };
    const b = G.bounds();
    G.floatText(b.x + b.w / 2, b.y + b.h * 0.3, hints[tier], "hint");
  }
  S.adaptiveTier = tier;
}

/* ================= 连击提难度（与自适应互斥） ================= */
function applyComboBoost() {
  const S = G.session;
  const c = S.combo;
  let tier = 0;
  for (let i = G.COMBO_TIERS.length - 1; i > 0; i--) { if (c >= G.COMBO_TIERS[i].min) { tier = i; break; } }
  const prevTier = S.comboTier || 0;
  S.comboTier = tier;
  const t = S.missStreak >= 3 ? G.COMBO_TIERS[0] : G.COMBO_TIERS[tier];
  G.preys.forEach(p => { p.comboSpeedTarget = t.speed; p.comboSize = t.size; p.applySize(); });
  /* 连击提示浮字已按需求取消（连续点击时不再弹提示，仅保留提速机制与音效） */
  if (tier < prevTier && performance.now() - (S.lastTierDropAt || 0) > 500) {
    S.lastTierDropAt = performance.now();
    G.tierDrop();
  }
}

/* ================= 命中 ================= */
function onHit(x, y, prey) {
  const S = G.session;
  const isMouse = G.config.targetType === "mouse";
  const isBfly = G.config.targetType === "butterfly";
  const isLaser = G.config.targetType === "laser";
  const isPool = G.config.targetType === "pool";
  const chasing = isMouse && prey.state === "dart";
  const resting = isBfly && prey.state === "RESTING";
  const holding = (isLaser || isPool) && prey.state === "hold";
  S.touches++;
  S.hits++;
  S.combo++;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  S.missStreak = Math.max(0, S.missStreak - 2);
  G.shake = Math.min(G.shake + 8, 20); // Add screen shake
  prey.vanish();
  const sparkC = isPool
    ? "#eaf9ff"
    : isLaser
    ? ((G.laserColorSet && G.laserColorSet())[(prey.laserVar && prey.laserVar.key) || "red"] || {}).spark || "#ff8a8a"
    : (isMouse || isBfly ? (prey.def.sparkColor || "#ffd76a") : (G.seaThemeNow().spark || prey.def.sparkColor || "#ffd76a"));
  G.sparkBurst(x, y, sparkC, 8);
  if (!isLaser) G.ripple(x, y, false);
  G.plantsStartle(x, y);
  if (isMouse) {
    G.dustBurst(x, y, 5);
    G.playSqueak(chasing);
    // 群鼠乱窜：命中撒彩虹纸屑 + 金环（参考猫抓老鼠玩具的 confetti）
    if (G.scene && G.scene.mouseBg === "swarm") G.swarmPopBurst(x, y);
    // 命中洞口 = 好洞：清空蹲守热度（半径 60，两排洞互不误伤）；群鼠模式无洞口跳过
    const Sc = G.scene;
    if (Sc.holes) Sc.holes.forEach((h, i) => { if (Math.hypot(x - h.x, y - h.y) < 60) Sc.holeHeat[i] = []; });
    if (chasing) {
      S.bonusHits++;
      S.dartHits = (S.dartHits || 0) + 1;
      S.dartStreak = (S.dartStreak || 0) + 1;
      if (S.dartStreak >= 3 && S.dartStreak % 3 === 0) {
        G.floatText(prey.x, prey.y - 60, "追击大师！", "big");
        G.playMilestone();
      }
    } else S.dartStreak = 0;
  } else if (isBfly) {
    if (resting) {
      G.petalBurst(prey.x, prey.y, 6);
      G.playMilestone();
      S.bonusHits++;
    } else {
      G.pollenBurst(x, y, 7);
      G.playFlutter();
    }
  } else if (isPool) {
    // 夸张光爆：连击越高越大（hold 停窗命中也走大光爆）
    G.splashBurst(x, y, holding || S.combo >= 5);
    G.playHit(S.combo);
    G.tone("sine", 1320, 320, 0.12, 0.22);        // 高频"叮"叠加，增强炸裂感
    if (holding) { S.bonusHits++; G.playMilestone(); }
  } else if (isLaser) {
    G.sparkBurst(x, y, "#ff5252", 8);
    G.scorch(x, y);
    G.playLaserHit(holding);          // 新激光命中音：pew 下滑 + 玻璃双音（hold 加铃音）
    if (holding) S.bonusHits++;
  } else {
    // 捕鱼命中：泳池海域走夸张的金橙水花、鱼群海域走彩虹纸屑+金环+专属配音（对齐逗猫捕鱼游戏），其余海域维持气泡
    const seaKey = G.session.sea && G.session.sea.key;
    if (seaKey === "pool") G.splashBurst(x, y, S.combo >= 4, "gold");
    else if (seaKey === "school") { G.confettiBurst(x, y); G.sparkBurst(x, y, "#dff2ff", 6); G.playSchoolPop(); }
    else {
      // 水草/珊瑚/深海/冰海：水花四溅（银白）+ 鱼鳞飞散 + 气泡——原来只有几个上浮气泡，几乎看不出"散开"
      G.splashBurst(x, y, false, "silver");
      G.scalesBurst(x, y, 10);
      G.bubbleBurst(x, y, 6);
    }
    G.playHit(S.combo);
    // 所有目标命中均不触发设备震动：真机上震动会带得整块屏幕（设备）一起晃动，喧宾夺主
  }
  if (S.combo > 0 && S.combo % 5 === 0) {
    G.floatText(prey.x, prey.y - 30, "连击 ×" + S.combo + "！", "big");
    G.playMilestone();
  } else {
    if (isMouse) G.floatText(x, y - 20, chasing ? "+2 追击成功！" : "+1 抓住！", chasing ? "big" : "");
    else if (isBfly) G.floatText(prey.x, prey.y - 30, resting ? "精准扑击 +2" : "+1", resting ? "big" : "");
    else if (isPool) G.floatText(x, y - 20, holding ? "+2 光爆连击！" : "光爆 +1", holding ? "big" : "");
    else if (isLaser) G.floatText(x, y - 20, holding ? "+2 光点落网！" : "抓住光点！", "big");
    else G.floatText(x, y - 20, "+1");
  }
  G.pokeHud();
}
G.onHit = onHit;                                   // 测试钩子：命中路径可直接驱动

/* ================= 拍偏 ================= */
function onMiss(x, y) {
  const S = G.session;
  if (!S.running || S.paused || S.counting) return;
  S.touches++;
  // 宽容连击：拍在附近没中 → 减半；拍空气 → 不清
  let nd = Infinity;
  G.preys.forEach(p => { nd = Math.min(nd, Math.hypot(x - p.x, y - p.y)); });
  S.combo = nd <= 140 ? Math.floor(S.combo / 2) : S.combo;
  S.missStreak++;
  applyAdaptive();
  applyComboBoost();
  if (G.config.targetType !== "laser") G.ripple(x, y, true);
  G.plantsStartle(x, y);
  if (G.config.targetType === "mouse") {
    G.dustBurst(x, y, 3);
    S.dartStreak = 0;
    const now = performance.now(), Sc = G.scene;
    if (Sc.holes) Sc.holes.forEach((h, i) => {
      if (Math.hypot(x - h.x, y - h.y) < 60) {
        const arr = Sc.holeHeat[i] || (Sc.holeHeat[i] = []);
        arr.push(now);
        while (arr.length > 3) arr.shift();
      }
    });
  }
  else if (G.config.targetType === "butterfly") G.pollenBurst(x, y, 3);
  else if (G.config.targetType === "pool") {
    // 拍偏：几点萤火碎屑（明显弱于命中，不抢戏）
    G.sparkBurst(x, y, "#e8ff9a", 3);
    G.dustBurst(x, y, 3);
  }
  else G.bubbleBurst(x, y, 3);
  G.playMiss();
  G.pokeHud();
}

/* ================= 触摸路由 ================= */
const HOLD_MS = 600;   // 暂停按钮长按时长
G.platform.onTouchStart = (e) => {
  const tp = e.touches && e.touches[0] || e.changedTouches && e.changedTouches[0];
  if (!tp) return;
  const x = tp.clientX, y = tp.clientY;
  // UI 布局在虚拟手机尺寸空间，按钮命中需换算到同一空间（玩法猎物仍在真实空间）
  const S = G.platform.S || 1;
  const vx = x / S, vy = y / S;
  G.ensureAudio();
  if (G.screen === "bgpick") {
    if (G.hitButton(vx, vy)) return;      // 「开始游戏」/「关闭」按钮
    G.bgPickTouchStart(vx);               // 卡片画廊：按下即开始跟手（虚拟空间位移）
    return;
  }
  if (G.screen === "summon") {
    if (G.hitButton(vx, vy)) return;
    G.summonPickTouchStart(vx);
    return;
  }
  if (G.screen === "playing") {
    // 暂停按钮：长按手势（按下开始计时，松手取消；不判 miss 不影响连击）
    const pr = G.ui.pauseRect;
    if (pr && vx >= pr.x && vx <= pr.x + pr.w && vy >= pr.y && vy <= pr.y + pr.h) {
      G.pauseHold.active = true;
      G.pauseHold.t0 = performance.now();
      G.pauseHold.progress = 0;
      return;
    }
    G.pauseHold.active = false;
    if (G.hitButton(vx, vy)) return;
    // 命中测试（后绘制的优先，对齐 DOM 顶层元素语义）
    let hit = null;
    for (let i = G.preys.length - 1; i >= 0; i--) {
      if (G.preys[i].hittable(x, y)) { hit = G.preys[i]; break; }
    }
    if (hit) onHit(x, y, hit);
    else onMiss(x, y);
    return;
  }
  if (G.screen === "counting") return;
  G.hitButton(vx, vy);   // 其余界面：按钮优先
};
G.platform.onTouchMove = (e) => {
  const tp = e.touches && e.touches[0] || e.changedTouches && e.changedTouches[0];
  if (!tp) return;
  if (G.screen === "bgpick") {
    const S = G.platform.S || 1;
    G.bgPickTouchMove(tp.clientX / S);
  } else if (G.screen === "summon") {
    const S = G.platform.S || 1;
    G.summonPickTouchMove(tp.clientX / S);
  }
};
G.platform.onTouchEnd = (e) => {
  if (G.screen === "bgpick") {
    // 空事件兜底（测试垫片会传 {}）：取不到 x 则跳过点按翻页，仅走拖动收尾
    const tp = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    G.bgPickTouchEnd(tp ? tp.clientX / (G.platform.S || 1) : null);
    return;
  }
  if (G.screen === "summon") {
    const tp = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    G.summonPickTouchEnd(tp ? tp.clientX / (G.platform.S || 1) : null);
    return;
  }
  if (G.pauseHold.active) { G.pauseHold.active = false; G.pauseHold.progress = 0; }   // 未满 600ms：取消，无惩罚
};

/* ================= 画面绘制 ================= */
function drawGameFrame(t) {
  ctx.save();
  if (G.shake > 0.1) {
    const sx = (Math.random() - 0.5) * G.shake;
    const sy = (Math.random() - 0.5) * G.shake;
    ctx.translate(sx, sy);
  }
  G.drawScene(ctx, t);
  // 激光暗室：先压暗背景，让激光光点与拖尾"穿透"黑暗，对比更醒目
  if (G.scene && G.scene.dark) {
    ctx.fillStyle = "rgba(0,0,0,.72)";
    ctx.fillRect(-20, -20, G.platform.W + 40, G.platform.H + 40); // Larger to cover shake
  }
  G.preys.forEach(p => p.render(ctx, t));
  G.fx.draw(ctx);
  ctx.restore();
}

/* ================= 主循环 ================= */
let lastTs = performance.now();
/* 把 UI 绘制放进 ctx.scale(S) 坐标系：UI 在虚拟手机尺寸布局，整体放大适配大屏。
   玩法（猎物/场景）不在此变换内，使用真实坐标系绘制。 */
function uiScaleCtx(fn) {
  const S = G.platform.S || 1;
  if (S === 1) { fn(); return; }
  ctx.save();
  ctx.scale(S, S);
  fn();
  ctx.restore();
}
function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  const S = G.session;
  const t = S.time;

  // 集中收尾：离开游戏态（counting/playing/paused 之外）时关闭屏幕常亮，
  // 覆盖所有直接 G.screen="home" 的返回路径，避免回首页后仍常亮耗电
  if (S._keepOn && G.screen !== "counting" && G.screen !== "playing" && G.screen !== "paused") {
    S._keepOn = false;
    G.platform.keepScreen(false);
  }

  if (G.screen === "counting") {
    if (G.nextScreen === "playing") return; // Prevent logic during transition to playing
    countT -= dt;
    const ci = Math.ceil(countT);
    if (ci !== lastInt && ci > 0) { lastInt = ci; G.playTick(); }
    if (countT <= 0) beginPlay();
  } else if (G.screen === "playing" && S.running && !S.paused) {
    S.time += dt;
    S.secAcc += dt;
    while (S.secAcc >= 1) { S.secAcc -= 1; tickSecond(); }
    G.preys.forEach(p => p.update(dt, S.time));
  }
  G.fx.update(dt, t);
  if (G.shake > 0) G.shake *= 0.88; // Decay shake

  // 暂停按钮长按推进：满 HOLD_MS 触发暂停（震动反馈 + 掉档音效免打扰，用 tick 音）
  const PH = G.pauseHold;
  if (PH.active && G.screen === "playing") {
    PH.progress = Math.min((performance.now() - PH.t0) / HOLD_MS, 1);
    if (PH.progress >= 1) {
      PH.active = false; PH.progress = 0;
      S.paused = true;
      G.switchScreen("paused");
      G.platform.vibrate();
      G.playTick();
    }
  }

  // 绘制当前界面
  G.ui.buttons.length = 0;
  
  // 处理页面切换过渡
  let screenAlpha = 1;
  if (G.nextScreen) {
    G.transitionT += dt;
    const dur = 0.22;
    if (G.transitionT < dur / 2) {
      screenAlpha = 1 - (G.transitionT / (dur / 2));
    } else if (G.transitionT < dur) {
      G.screen = G.nextScreen;
      screenAlpha = (G.transitionT - dur / 2) / (dur / 2);
    } else {
      G.screen = G.nextScreen;
      G.nextScreen = null;
      G.transitionT = 0;
      screenAlpha = 1;
    }
  }
  ctx.globalAlpha = screenAlpha;

  if (G.screen === "home") uiScaleCtx(() => G.ui.drawHome());
  else if (G.screen === "bgpick") {
    // 背景选择层自带实底，不再叠首页（否则首页标题会与弹层文字叠在一起）
    uiScaleCtx(() => G.ui.drawBgPick());
  }
  else if (G.screen === "settings") uiScaleCtx(() => G.ui.drawSettings());
  else if (G.screen === "records") uiScaleCtx(() => G.ui.drawRecords());
  else if (G.screen === "leaderboard") uiScaleCtx(() => G.ui.drawLeaderboard());
  else if (G.screen === "summon") uiScaleCtx(() => G.ui.drawSummon());
  else if (G.screen === "result") {
    // 结算页背景沿用当前玩法的场景：截图或存图时，一眼能看出这一局选的是哪种模式
    if (G.scene && G.scene.type) {
      G.drawScene(ctx, t);
      // 暗室模式沿用游戏内的压暗处理，但结算页比游玩时轻一档：.72 会把光柱压没，
      // 存图后同样看不出是暗室模式，降到 .46 保留窗户光。
      if (G.scene.dark) { ctx.fillStyle = "rgba(0,0,0,.46)"; ctx.fillRect(0, 0, G.platform.W, G.platform.H); }
    }
    uiScaleCtx(() => G.ui.drawResult());
  }
  else {
    drawGameFrame(t);
    if (G.screen === "counting") uiScaleCtx(() => G.ui.drawCountdown(Math.max(countT, 0)));
    else uiScaleCtx(() => G.ui.drawHud(t, dt));
    if (G.screen === "paused") uiScaleCtx(() => G.ui.drawPause());
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(loop);
}

/* 尺寸变化：重建布景并重锚状态机（对齐原型 resize 行为） */
G.platform.resizeCb.push(() => {
  if (G.screen === "playing" || G.screen === "paused" || G.screen === "counting") {
    G.buildScene(G.config.targetType);
    G.buildPreys();
    G.preys.forEach(p => { if (p.stage) p.stage = 0; });   // 触发下帧重进阶段
    G.topUpPreys();   // 旋转屏幕等重建于 3 点后，按当前阶段补足
  }
  if (G.screen === "leaderboard") G.ui.showLB();           // 排行榜卡片区域随屏重发
});

/* ================= 埋点：启动来源 / 次日回访 =================
   后台「数据分析 → 自定义分析」需先建同名事件才能看到数据；未建时 reportAnalytics 静默丢弃，
   不影响游戏。事件与参数说明见项目根目录《埋点事件说明.md》。 */
function dayNum(d) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}
(function trackLaunch() {
  const fromMap = { share: 1, menu: 2, lb: 3, settings: 4 };
  const q = (G.platform.launch && G.platform.launch.query) || {};
  const scene = (G.platform.launch && Number(G.platform.launch.scene)) || 0;
  const from = fromMap[q.from] || 0;
  const today = dayNum(new Date());
  let first = 0;
  try { first = Number(G.platform.storage.get("catToyFirstDay")) || 0; } catch (e) {}
  // 存储被清空/写脏时 first 可能是 0 或未来日期，重置为今天
  if (!(first > 20000 && first <= today)) {
    first = today;
    G.platform.storage.set("catToyFirstDay", String(first));
  }
  const dayn = today - first;
  // dayn=0 首日；dayn>=1 即"次日及以后回访"。按 dayn 分组就能算出 D1/D3/D7 留存。
  G.track("app_open", { scene, from, dayn, ret: dayn > 0 ? 1 : 0 });
})();

/* 切后台：游玩中切走自动暂停，回来接着玩（否则计时要耗在后台，回来只剩几秒） */
G.platform.hideCb.push(() => {
  if (G.screen === "playing" && G.session.running && !G.session.paused) {
    G.session.paused = true;
    G.screen = "paused";
  }
});

/* 回前台：微信可能重置 keepScreenOn 状态，游戏中则重设常亮 */
G.platform.showCb.push(() => {
  if (G.session && G.session._keepOn && G.config.keepScreen) {
    try { G.platform.keepScreen(true); } catch (e) {}
  }
});

requestAnimationFrame(loop);

