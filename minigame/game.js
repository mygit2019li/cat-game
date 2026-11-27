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
require("./js/ad.js")(G);        // 原生模板广告（仅非游戏页面：猫粮机 / 首页 / 结算页）
require("./js/feeder.js")(G);     // 电子猫粮机（定时定量 / 手动出粮）

/* 自定义召唤卡（标题/图片/音频都存在本机）：卡牌列表要在第一帧就把它排在第一，
   所以模块装配完就先读一次存储 */
G.loadCustomSummon();

const ctx = G.platform.ctx;
const clamp = G.clamp;
G.screen = "home";        // home | settings | records | leaderboard | summon | sound | feeder | bgpick | counting | playing | paused | result
G.nextScreen = null;
G.transitionT = 0;
G.shake = 0;
G.result = null;
G.pauseHold = { active: false, t0: 0, progress: 0, id: null };   // HUD 暂停按钮长按状态（600ms 触发，id=按住它的那根手指）
let countT = 0, lastInt = -1;

/* 设置抽屉：从首页左上角浮出，直接切屏（不走整屏淡入淡出），关闭时同样直接回首页。
   入场动画为缩放 + 上浮淡入；G.settings.t0 是抽屉的入场时间戳，绘制层据此算展开进度。
   入口只有首页左上角的设置键——结算页已改为「返回」，抽屉不再需要「关掉后回哪页」的上下文。 */
G.openSettings = () => {
  // 先解锁音频再记 t0：ensureAudio 首次创建 WebAudio 上下文可能阻塞上百毫秒，
  // 放在前面会把抽屉的入场时间戳"吃掉"，动画一帧都看不到
  if (G.ensureAudio) G.ensureAudio();
  G.settings = { t0: performance.now() };
  G.screen = "settings"; G.nextScreen = null; G.transitionT = 0;
};
/* 关闭：先播反向滑出动画（200ms），动画结束后由 drawSettings 真正切回首页。
   这里不立刻改 screen，否则抽屉会"啪"地消失 */
/* 记录 / 排行弹窗：与设置抽屉同一套"先播动画、播完再切屏"的做法 */
G.openModal = (key) => {
  if (G.ensureAudio) G.ensureAudio();
  G.modal = { key, t0: performance.now() };
  G.screen = key === "lb" ? "leaderboard" : "records";
  G.nextScreen = null; G.transitionT = 0;
  /* 打开「本周记录」弹窗时触发一次插屏广告（仅 records，不含好友排行 lb）。
     show 由 ad.js 内部兜底：实例未就绪 / 无填充 / 环境不支持都只记日志，不挡弹窗。 */
  if (key === "records" && G.ad && G.ad.showInterstitial) G.ad.showInterstitial();
};

/* ================= 好友排行授权 =================
   读好友成绩必须先有 scope.WxFriendInteraction（官方要求）。
   四种状态：unknown / asking / ok / denied；unsupported（浏览器、旧基础库）按 ok 处理。
   授权成功后把「已展示」标记清掉，让 drawLeaderboard 下一帧重新 show 排行榜。 */
G.friendAuthState = "unknown";
G.askFriendAuth = (force) => {
  if (!force && (G.friendAuthState === "ok" || G.friendAuthState === "asking")) return;
  G.friendAuthState = "asking";
  if (G.modal) { G.modal.lbShown = false; G.modal.lbHidden = false; }
  G.platform.friendAuth((st) => {
    const ok = st === "ok" || st === "unsupported";
    G.friendAuthState = ok ? "ok" : (st === "denied" ? "denied" : "ok");
    if (G.modal) { G.modal.lbShown = false; G.modal.lbHidden = false; }   // 重新拉一次
    if (G.track) G.track("lb_auth", { state: G.friendAuthState });
  });
};
/* 点了「去设置开启」：openSetting 回来后回读状态，成功就直接出榜 */
G.grantFriendAuth = () => {
  G.platform.openFriendSetting(() => {
    G.friendAuthState = "unknown";
    G.askFriendAuth(true);
  });
};
G.closeModal = () => {
  if (!G.modal) { G.screen = "home"; return; }
  if (G.modal.closing) return;                 // 已在关闭动画中
  G.modal.closing = { t0: performance.now() };
  if (G.playTick) G.playTick();
};

G.closeSettings = () => {
  if (!G.settings) { G.screen = "home"; return; }
  if (G.settings.closing) return;               // 已在关闭动画中，忽略重复点击
  G.settings.closing = { t0: performance.now() };
  if (G.playTick) G.playTick();
};

/* ================= 声音模块（猫 / 狗情绪音） =================
   首页「声音」入口进入；页面内点猫/狗切 tab，点卡片播放对应音频，右上角可停止。
   播放状态在 G.soundPad（audio.js），绘制层按它做选中态与声波动效。 */
G.soundTab = "cat";
G.openSound = () => {
  G.ensureAudio();
  if (G.stopSummonMusic) G.stopSummonMusic();    // 召唤页的喵声不要串进来
  if (G.stopAnimalSound) G.stopAnimalSound();
  if (G.SOUND_PACKS && !G.SOUND_PACKS.some(p => p.key === G.soundTab)) G.soundTab = "cat";
  G.soundAnimT0 = performance.now();
  G.switchScreen("sound");
};
G.closeSound = () => {
  if (G.stopAnimalSound) G.stopAnimalSound();
  G.switchScreen("home");
};
G.setSoundTab = (key) => {
  if (!G.SOUND_PACKS || !G.SOUND_PACKS.some(p => p.key === key)) return;
  if (G.soundTab === key) return;
  G.soundTab = key;
  if (G.stopAnimalSound) G.stopAnimalSound();    // 换 tab 先静音，避免上一只动物的声音继续响
  G.soundAnimT0 = performance.now();
  G.playTick();
};
G.playSoundCard = (animal, snd) => {
  G.ensureAudio();
  const ok = G.playAnimalSound ? G.playAnimalSound(animal, snd) : false;
  if (ok && G.track) G.track("sound_play", { animal, key: snd && snd.key });
  return ok;
};

/* 带原生模板广告位的页面白名单（与 js/ad.js 的 page key 一一对应）。
   对局页只有横屏倒计时（counting）带广告；playing / paused 与设置、记录、声音、背景选择页不在其中：
   这些页面要么打断操作、要么没有干净留白，一律不建实例。
   挂在 G 上而不是用顶层 const：开发者工具热重载时旧作用域的闭包会留在 G.switchScreen 上，
   顶层 const 在新作用域里拿不到（ReferenceError: AD_SCREENS is not defined），
   走 G 就不会有这个问题。 */
G.AD_SCREENS = ["feeder", "home", "result", "bgpick", "sound", "summon", "counting"];

G.switchScreen = (name) => {
  if (G.screen === name) return;
  // 离开召唤页时收起自定义录入面板（面板只在 summon 页画，不收会在下次进页时错弹出来）
  if (G.ui && G.ui.summonEdit && G.ui.closeSummonEdit) G.ui.closeSummonEdit();
  // 离开声音页时停止试听（含从声音页直接跳设置等所有路径）
  if (G.screen === "sound" && name !== "sound" && G.stopAnimalSound) G.stopAnimalSound();
  // 离开任一广告位页面时销毁广告实例（hide + destroy），再进页会重新创建，不重复堆实例
  if (G.ad && G.AD_SCREENS.indexOf(G.screen) >= 0 && name !== G.screen) {
    G.ad.leave("switch:" + name);
  }
  // 进入带广告位的页面：尽早建实例（页面生命周期早期，早于首帧）。
  // show 交给 pageFrame（首页/结算/召唤每帧打点）与 900ms 兜底；留白不足时 rect 返回 null，
  // ad.enter 自行静默跳过，不残留 page 标记。
  if (G.ad && G.AD_SCREENS.indexOf(name) >= 0) {
    G.ad.enter(name);
  }
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
const HIT_UNIT = { fish: "条", butterfly: "只", mouse: "只", laser: "个", pool: "只", tadpole: "只" };
const HIT_NOUN = { fish: "小鱼", butterfly: "蝴蝶", mouse: "老鼠", laser: "光点", pool: "荧光虫", tadpole: "小蝌蚪" };
/* 兔子场所命中碎屑主色（黄色本体） */
const POOL_SPARK = { firefly: "#ffe479" };
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
/* ===== 三个功能模块的分享：召唤猫咪 / 电子猫粮 / 动物情绪（原名「声音」）=====
   每个模块用自己的转发文案和「页面卡」，不套用本局成绩卡；query 按模块区分落地来源。 */
const MODULE_SHARE = {
  summon: "我用猫咪召唤音把我家猫叫过来了，你也来试试",
  feeder: "给猫主子配了台自动出粮机，一出粮就冲过来",
  sound: "猫和狗的情绪音都在这儿，看看你家猫什么反应"
};
G.shareModule = (src) => {
  const key = MODULE_SHARE[src] ? src : "sound";
  let imageUrl = "";
  try { imageUrl = G.buildShareCard(key); } catch (e) {}
  G.track("share_tap", { src: key, has_img: imageUrl ? 1 : 0 });
  G.platform.shareApp({
    title: MODULE_SHARE[key],
    imageUrl: imageUrl || undefined,
    query: "from=" + key
  });
};

G.platform.initShare(() => ({
  title: "给你家猫开个捕猎场：小鱼、蝴蝶、老鼠、光点、荧光虫轮着来，看它能抓到几个",
  query: "from=menu"
}));

/* ================= 开局 ================= */
G.startGame = () => {
  G.stopSummonMusic();   // 召唤语音不串进对局
  if (G.stopLadybugLoop) G.stopLadybugLoop();   // 上一局的瓢虫循环不要带进新一局
  if (G.stopMouseSqueak) G.stopMouseSqueak();
  G.ensureAudio();
  // 青蛙跳：进局先把两段蛙鸣预取好，第一声"呱"就不用等下载
  if (G.config.targetType === "pool" && G.preloadRabbitVideoSfx) G.preloadRabbitVideoSfx();
  if (G.config.targetType === "frog" && G.preloadFrogVoices) G.preloadFrogVoices();
  // 捕鼠：预取真实老鼠叫录音，第一下命中就不等下载
  if (G.config.targetType === "mouse" && G.preloadMouseSfx) G.preloadMouseSfx();
  const S = G.session;
  S.touches = 0; S.hits = 0; S.bonusHits = 0; S.combo = 0; S.maxCombo = 0;
  S.missStreak = 0; S.dartStreak = 0; S.dartHits = 0;
  S.adaptiveTier = 0; S.comboTier = 0; S.lastTierDropAt = 0;
  S.remaining = Number(G.config.duration) || 180;
  S.infinite = !!G.config.infinite;   // 无限模式：倒计时仅用于阶段推进，不自动结束
  S.running = false; S.paused = false; S.counting = true;
  S.time = 0; S.secAcc = 0; S.stage = 1;
  S.lastHitT = 0; S.tadHolds = []; S.strugglePrey = null;        // 蝌蚪快跑：长按尾巴挣扎 + 无命中悬停档位
  S.tadCount = 1; S.tadEval = 0; S.tadMark = 0; S.tadDown = 0;   // 蝌蚪快跑：同屏 1→2→3
  S.escapes = 0;                                                  // 蝌蚪快跑：漏击次数
  G.uiFX.stagePop = 0; G.ui.hudDimT = 0;
  // 鱼玩法：海域由背景选择层决定（水草森林 / 泳池追鱼，左右滑动切换、跨局记忆）
  S.sea = G.config.targetType === "fish" ? (G.SEA_THEMES.find(t => t.key === G.currentBg()) || G.SEA_THEMES[0]) : null;
  G.buildScene(G.config.targetType);
  G.fx.clear();
  G.buildPreys();
  G.topUpPreys();   // 开局即补足到当前阶段的目标数量（鱼群模式开局就该是一大群，而非 3 条等阶段②）
  if (G.waveReset) G.waveReset();   // 波次制：新一局所有猎物在场
  if (G.config.keepScreen) { G.platform.keepScreen(true); S._keepOn = true; }
  const beginGame = () => {
    countT = 3; lastInt = -1;
    G.switchScreen("counting");
    G.track("game_start", {
      mode: G.config.targetType,
      dur: G.config.infinite ? 0 : (Number(G.config.duration) || 180),
      pc: Number(G.config.preyCount) || 1
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
  if (G.playCountdownGo) G.playCountdownGo();
  else G.playGo();
  G.screen = "playing"; // Use direct assignment to avoid repeated calls during transition
  G.nextScreen = null;
  G.transitionT = 0;
}

/* ================= 模式选择弹层（拥有多套模式的玩法专用） =================
   有 ≥2 套模式的玩法（捕鼠/捕鱼）点「开始游戏」先弹一层可左右滑动/点按翻页的模式卡，
   每张卡对应一套布景+运动规则+猎物种类；只有 1 套的玩法照旧直接开始，不额外打扰。
   卡片按「一屏约 1.5 张」布局：CW = W*0.64 + 间距，滑动时露出半张下一张。 */
G.requestStart = () => {
  /* 青蛙/暗夜荧光/蝴蝶/激光都有二级玩法卡：先选卡，再进场景或直接开局。 */
  const group = G.groupForType && G.groupForType(G.config.targetType);
  if (group) { G.openModePick(G.groupKeyForType(G.config.targetType)); return; }
  const arr = G.bgsFor(G.config.targetType);
  if (arr.length > 1) { G.openBgPick(); return; }
  G.startGame();
};

/* 当前卡片层的数据源：普通玩法走背景表，玩法组走对应卡片表。 */
G.bgPickList = () => {
  const g = G.bgPick && G.bgPick.group && G.MODE_GROUPS && G.MODE_GROUPS[G.bgPick.group];
  return g ? g.cards : G.bgsFor(G.config.targetType);
};

G.openModePick = (groupKey) => {
  const g = G.MODE_GROUPS && G.MODE_GROUPS[groupKey];
  if (!g || !g.cards || !g.cards.length) return;
  const cur = G.config[g.configKey];
  const idx0 = Math.max(0, g.cards.findIndex(b => b.key === cur));
  G.bgPick = { idx: idx0, visIdx: idx0, off: 0, drag: false, x0: 0, moved: 0, cw: 0, gap: 0,
    t0: performance.now(), relOff: 0, relT0: 0, touchActive: false, selT0: 0, group: groupKey };
  G.switchScreen("bgpick");
};
G.openFrogPick = () => G.openModePick("frog");

G.openBgPick = () => {
  const arr = G.bgsFor(G.config.targetType);
  const cur = G.currentBg();
  // t0=弹入动画起点；relOff/relT0=松手后的吸附动画（残余位移按缓动归零）；touchActive=本次按压是否落在卡片区（按钮点按不翻页）
  const idx0 = Math.max(0, arr.findIndex(b => b.key === cur));
  /* visIdx = 绘制用的「连续」索引，可超出 [0,n-1]；idx 是它对列表长度取模后的真实索引。
     画廊左右都画了邻卡，点击也必须能循环，否则「看得见左卡却点不动」。 */
  G.bgPick = { idx: idx0, visIdx: idx0, off: 0, drag: false, x0: 0, moved: 0, cw: 0, gap: 0,
    t0: performance.now(), relOff: 0, relT0: 0, touchActive: false, selT0: 0 };
  G.switchScreen("bgpick");
};

G.closeBgPick = () => { G.bgPick = null; G.switchScreen("home"); };

/* 结算页左上角「返回」：回到二级菜单的选项卡页（玩法卡 / 场景卡），而不是首页。
   入口路由与 G.requestStart 保持一致——有玩法组先回玩法卡页，否则回场景卡页；
   两者都没有（理论上不会出现）才退回首页，保证「返回」永远有落点。
   跳转前把本局残留状态收干净：预览用的旧猎物/特效、结算动画计时、暂停长按与
   音频循环都不能带进选卡页，否则选卡页会带着上一局的余温重开。 */
G.backToPick = () => {
  const S = G.session;
  S.running = false;
  S.paused = false;
  S.counting = false;
  G.pauseHold.active = false; G.pauseHold.progress = 0; G.pauseHold.id = null;
  G.shake = 0;
  if (G.ui) G.ui.hudDimT = 0;
  if (G.uiFX) G.uiFX.stagePop = 0;
  if (G.stopMouseSqueak) G.stopMouseSqueak();
  if (G.stopLadybugLoop) G.stopLadybugLoop();
  if (G.fx && G.fx.clear) G.fx.clear();
  if (G.clearPreys) G.clearPreys();
  G.platform.keepScreen(false);
  // 结算数据保留（切屏有 0.22s 淡出，此刻清空会让标题/数据先闪一下空值）；
  // 下一次 G.endGame 会整体覆写，不会串到下一局。
  const group = G.groupForType && G.groupForType(G.config.targetType);
  if (group) { G.openModePick(G.groupKeyForType(G.config.targetType)); return; }
  if (G.bgsFor && G.bgsFor(G.config.targetType).length) { G.openBgPick(); return; }
  G.switchScreen("home");
};

/* 确认卡片 → 记住选择（跨局） → 开局 / 进入玩法场景选择 */
G.confirmBgPick = () => {
  const arr = G.bgPickList();
  const P = G.bgPick;
  const sel = arr[P ? Math.max(0, Math.min(arr.length - 1, P.idx)) : 0];
  const group = P && P.group && G.MODE_GROUPS && G.MODE_GROUPS[P.group];
  if (group) {
    const key = sel ? sel.key : group.cards[0].key;
    G.config[group.configKey] = key;
    if (group.targetByKey && group.targetByKey[key]) G.config.targetType = group.targetByKey[key];
    G.saveConfig();
    G.bgPick = null;
    if (group.next && group.next[key] === "bgs") G.openBgPick(); else G.startGame();
    return;
  }
  const type = G.config.targetType;
  if (sel) { G.config["bg_" + type] = sel.key; G.saveConfig(); }
  G.bgPick = null;
  G.startGame();
};

function bgPickStep() {
  const P = G.bgPick;
  // P.cw / P.gap 都是虚拟单位（ui.js layout() 里按 W/S 算的），回退值也要用虚拟宽，
  // 否则 S≠1（大屏/平板/开发者工具）时步长单位错乱，翻页动画幅度不对。
  const vW = G.platform.W / (G.platform.S || 1);
  return P && P.cw ? P.cw + P.gap : (vW || 300) * 0.6;
}
/* 点侧卡切换：绘制层是循环画廊，这里也按 visIdx 连续 ±1，第一张点左边照样能翻到上一张。
   与松手吸附共用同一动画（relOff 连续归零），拖动中忽略。 */
G.bgPickArrow = (dir) => {
  const P = G.bgPick; if (!P || P.drag) return;
  const arr = G.bgPickList();
  if (arr.length < 2) return;
  const ni = (P.visIdx == null ? P.idx : P.visIdx) + dir;
  const step = bgPickStep();
  P.relOff = P.off + (ni - (P.visIdx == null ? P.idx : P.visIdx)) * step;
  P.visIdx = ni;
  P.idx = ((ni % arr.length) + arr.length) % arr.length;
  P.relT0 = performance.now();
  P.off = 0;
  P.selT0 = P.relT0;
};
/* 点指示点直接跳到对应卡：走环形最短路径，动画与点侧卡一致 */
G.bgPickJump = (target) => {
  const P = G.bgPick; if (!P || P.drag) return;
  const arr = G.bgPickList();
  const n = arr.length; if (n < 2) return;
  const cur = P.visIdx == null ? P.idx : P.visIdx;
  const curReal = ((cur % n) + n) % n;
  let delta = target - curReal;
  if (delta > n / 2) delta -= n;
  else if (delta < -n / 2) delta += n;
  if (!delta) return;
  const ni = cur + delta, step = bgPickStep();
  P.relOff = P.off + delta * step;
  P.visIdx = ni;
  P.idx = ((ni % n) + n) % n;
  P.relT0 = performance.now();
  P.off = 0;
  P.selT0 = P.relT0;
};

G.bgPickTouchStart = (x) => {
  const P = G.bgPick; if (!P) return;
  if (G.bgPickList().length < 2) return;   // 单卡页不跟手
  P.drag = true; P.x0 = x; P.moved = 0;
  P.touchActive = true;
  P.visIdx = P.idx;                                // 拖动从真实索引起步，避免从循环索引跳变
  P.relOff = 0;                                    // 按下即终止上一次吸附动画
};
G.bgPickTouchMove = (x) => {
  const P = G.bgPick; if (!P || !P.drag) return;
  const arr = G.bgPickList();
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
  const arr = G.bgPickList();
  const step = bgPickStep();
  let dir = 0;
  if (P.moved > 8) {                               // 拖动：按位移阈值换页
    if (Math.abs(P.off) > step * 0.16) dir = P.off < 0 ? 1 : -1;
  } else if (x != null) {                          // 点按：当前卡左右边缘之外（层叠露出的邻卡/空侧）翻页
    // x 是虚拟坐标（touch 入口已 clientX/S），P.cw 也是虚拟单位 → 宽度必须用虚拟宽，
    // 否则 S≠1 时右卡点按区消失、左区变大（真实宽 vs 虚拟 x 单位混用）。
    const W = G.platform.W / (G.platform.S || 1);
    const half = (P.cw || W * 0.64) / 2;
    if (x < W / 2 - half) dir = -1;
    else if (x > W / 2 + half) dir = 1;
  }
  const newIdx = Math.max(0, Math.min(arr.length - 1, P.idx + dir));
  const changed = newIdx !== P.idx;
  // 吸附动画：残余位移从「松手位置 + 已换页步长」连续归零（换页/回弹都平滑）
  P.relOff = P.off + (newIdx - P.idx) * step;
  P.visIdx = newIdx;
  P.idx = newIdx;
  P.relT0 = performance.now();
  P.off = 0;
  if (changed) P.selT0 = P.relT0;
};

/* ================= 召唤猫咪交互 ================= */
G.summonPickTouchStart = (x) => {
  const P = G.summonPick; if (!P) return;
  if (G.ui && G.ui.summonEdit) return;      // 自定义录入弹窗开着：背面卡牌不跟手
  P.drag = true; P.x0 = x; P.off = 0; P.relOff = 0;
};
G.summonPickTouchMove = (x) => {
  const P = G.summonPick; if (!P || !P.drag) return;
  P.off = x - P.x0;
};
G.summonPickTouchEnd = (x) => {
  const P = G.summonPick, kinds = G.summonKinds ? G.summonKinds() : (G.CAT_KINDS || []);
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
/* 阶段切换统一入口：青蛙模式进入第④阶段时换一套荷叶布景，
   并让在场青蛙重新落位，避免 padIdx 仍指向旧荷叶。 */
function changeStage(st) {
  const S = G.session;
  if (st === S.stage) return;
  const prev = S.stage;
  S.stage = st;
  G.uiFX.stageText = G.stageName(st);
  G.uiFX.stagePop = 1.6;
  G.pokeHud();
  /* 蝌蚪：阶段推进时把同屏基线抬到 1→2→3（topUpPreys 会补上从边缘进场的个体）。 */
  if (G.config.targetType === "tadpole") S.tadCount = Math.max(S.tadCount || 1, Math.min(3, st));
  if (G.config.targetType === "frog" && st >= 4 && prev < 4 && G.rebuildFrogPads) {
    G.rebuildFrogPads(4);
    (G.preys || []).forEach(p => { if (p.type === "frog" && p.spawnOnPad) p.spawnOnPad(); });
  }
  G.topUpPreys();
  if (G.waveReset) G.waveReset();   // 波次制：阶段加员后放行待命个体，避免被永久卡住
}
function tickSecond() {
  const S = G.session;
  /* 兔子模式是单一木地板，这里保留旧钩子但 poolMix=false 时不会触发换景。 */
  if (G.config.targetType === "pool" && G.scene && S.time >= 20 && !G.scene.poolShift && G.poolShiftTheme) {
    G.poolShiftTheme();
  }

  // 无限模式：倒计时仅用于阶段推进，不减到负、不自动结束（给猫玩不中途打断）
  if (S.infinite) {
    if (S.remaining > 0) S.remaining--;
    if (S.remaining < 0) S.remaining = 0;
    changeStage(G.stageNow());
    return;
  }
  S.remaining--;
  if (S.remaining <= 0) { G.endGame(); return; }
  changeStage(G.stageNow());
}

/* ================= 结算 ================= */
G.endGame = (fromPause) => {
  const S = G.session;
  S.running = false;
  S._keepOn = false;
  if (G.stopMouseSqueak) G.stopMouseSqueak();
  G.platform.keepScreen(false);
  const totalHits = S.hits + (S.bonusHits || 0);
  const acc = S.touches > 0 ? Math.min(100, Math.round((totalHits / S.touches) * 100)) : 0;
  // 本地记录：只留最近 7 天、最多 200 条（G.pruneLogs 负责裁剪）。
  // 走 G.getLogs() 做安全解析——存储里若是对象或含 null 元素，
  // 直接 unshift/slice 会在结算时抛错，结算页出不来
  const logs = G.getLogs();
  const d = new Date();
  logs.unshift({
    ts: d.getTime(),
    date: (d.getMonth() + 1) + "/" + d.getDate(),
    type: G.config.targetType,
    dur: Number(G.config.duration) || 180,
    hits: totalHits, touches: S.touches,
    accuracy: acc, combo: S.maxCombo,
    dart: S.dartHits || 0, bonus: S.bonusHits || 0
  });
  G.platform.storage.set("catToyLogs", JSON.stringify(G.pruneLogs(logs)));
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
  const tag = G.config.targetType === "mouse" ? "追击" : G.config.targetType === "butterfly" ? "精准扑击" : G.config.targetType === "laser" ? "光点落网" : G.config.targetType === "pool" ? "彩星爆散" : G.config.targetType === "frog" ? "空中截击" : G.config.targetType === "tadpole" ? "折返截击" : "奖励命中";
  const bonusBits = [];
  if (S.bonusHits > 0) bonusBits.push("含" + tag + " ×" + S.bonusHits);
  if (G.config.targetType === "tadpole" && S.escapes > 0) bonusBits.push("漏击 " + S.escapes + " 次");
  G.result = {
    t0: performance.now(),
    title, desc, touches: S.touches, hits: totalHits, acc, maxCombo: S.maxCombo,
    bonusTag: bonusBits.join(" · ")
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
  const isFrog = G.config.targetType === "frog";
  const isTad = G.config.targetType === "tadpole";
  const chasing = isMouse && prey.state === "dart";
  const resting = isBfly && prey.state === "RESTING";
  const holding = (isLaser || isPool) && prey.state === "hold";
  const aerial = isFrog && prey.fState === "leap";   // 空中截击：青蛙唯一的 +2 窗口
  S.touches++;
  S.hits++;
  S.lastHitT = S.time;   // 蝌蚪快跑：悬停档位按"距上次击中时长"评估
  S.combo++;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  S.missStreak = Math.max(0, S.missStreak - 2);
  G.shake = Math.min(G.shake + (isTad ? 5 : 8), 20); // 白纸画面震动更克制，只保留"拍实了"的触感
  prey.vanish();
  const sparkC = isPool
    ? (POOL_SPARK[prey.species] || "#eaf9ff")
    : isLaser
    ? ((G.laserColorSet && G.laserColorSet())[(prey.laserVar && prey.laserVar.key) || "red"] || {}).spark || "#ff8a8a"
    : isFrog
    ? "#bdf58a"
    : isTad
    ? "#14161a"
    : (isMouse || isBfly ? (prey.def.sparkColor || "#ffd76a") : (G.seaThemeNow().spark || prey.def.sparkColor || "#ffd76a"));
  // 兔子是整只玩具被拍散：星爆/碎光以兔子中心为准，不跟着手指边缘跑
  G.sparkBurst(isPool ? prey.x : x, isPool ? prey.y : y, sparkC, isPool ? 6 : 8);
  // 发光玩具在布面上被拍散：不画水面涟漪（布垫上出现水圈很违和），爆散交给 lightPop
  if (isPool) { /* 光爆自带碎光 + 双环，不再叠扬尘 */ }
  else if (!isLaser) G.ripple(x, y, false);
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
    // 荧光小虫被拍散：一小把暖金色碎光 + 两点冷色，配一声低频 pop + 高频 shimmer 的星爆音。
    G.lightPop(prey.x, prey.y, holding || S.combo >= 5, prey.species);
    if (G.playFireflyHit) G.playFireflyHit(prey.species);
  } else if (isLaser) {
    G.sparkBurst(x, y, "#ff5252", 8);
    G.scorch(x, y);
    G.playLaserHit(holding);          // 新激光命中音：pew 下滑 + 玻璃双音（hold 加铃音）
    if (holding) S.bonusHits++;
  } else if (isFrog) {
    // 青蛙：荷叶绿爆开（专属特效）+ 被拍时"呱"一声 + 打击音，荷叶跟着晃
    G.frogPop(x, y, aerial);
    G.playFrogHitCroak();
    G.playFrogHit(aerial);
    if (G.padSway) G.padSway(prey.x, prey.y);
    if (aerial) { S.bonusHits++; G.playMilestone(); }
  } else if (isTad) {
    /* 白纸墨影：命中即墨爆（黑点 + 灰环）+ 短促音效。
       折返弧里命中算「折返截击」+2——这是唯一的速度低谷，也是唯一需要预判的窗口。 */
    const foldHit = (prey.tadFold || 0) > 0.12;
    G.inkBurst(x, y, prey.tadAng || 0, foldHit);
    if (G.tadpoleWake) G.tadpoleWake(x, y, true);
    if (G.playTadpoleHit) G.playTadpoleHit(foldHit);
    if (foldHit) { S.bonusHits++; G.playMilestone(); }
    G.floatText(x, y - 28, foldHit ? "折返截击 +2" : "+1", foldHit ? "big" : "");
  } else {
    // 捕鱼命中：小河海域走浅色水花（青绿反光的白水花）、鱼群海域走彩虹纸屑+金环+专属配音（对齐逗猫捕鱼游戏），其余海域维持气泡
    const seaKey = G.session.sea && G.session.sea.key;
    if (seaKey === "pool") G.splashBurst(x, y, S.combo >= 4, "creek");
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
    if (!isPool) G.floatText(prey.x, prey.y - 30, "连击 ×" + S.combo + "！", "big");
    G.playMilestone();
  } else if (!isPool) {
    // 兔子模式不弹"光爆 +1"文字：猫不识字，文字会挡住星爆；分数看左上角 HUD 即可
    if (isMouse) G.floatText(x, y - 20, chasing ? "+2 追击成功！" : "+1 抓住！", chasing ? "big" : "");
    else if (isBfly) G.floatText(prey.x, prey.y - 30, resting ? "精准扑击 +2" : "+1", resting ? "big" : "");
    else if (isLaser) G.floatText(x, y - 20, holding ? "+2 光点落网！" : "抓住光点！", "big");
    else if (isFrog) G.floatText(prey.x, prey.y - (prey.jumpH || 0) - 62, aerial ? "空中截击 +2！" : "抓住！", aerial ? "big" : "");
    else if (!isTad) G.floatText(x, y - 20, "+1");
  }
  G.pokeHud();
}

G.onHit = onHit;                                   // 测试钩子：命中路径可直接驱动

/* ================= 蝌蚪漏击 =================
   蝌蚪完整穿出画面（不是被拍散）才算一次漏击：
   · 连击 -3（最低 0），漏击计数 +1，连续漏击会触发原有的自适应放慢；
   · 只给一圈灰环 + 一声低音，不弹"漏击"浮字——这是给猫玩的，文字对猫没有意义。 */
G.tadpoleEscape = (prey) => {
  const S = G.session;
  if (!S || !S.running) return;
  S.escapes = (S.escapes || 0) + 1;
  S.combo = Math.max(0, (S.combo || 0) - 3);
  S.missStreak = (S.missStreak || 0) + 1;
  G.playTadpoleMiss && G.playTadpoleMiss();
  if (G.ripple) G.ripple(prey.x, prey.y, true);
  /* 漏击不弹"漏击"浮字：这是给猫玩的，文字对猫没有意义，灰环 + 低音足矣。 */
  applyAdaptive();
  applyComboBoost();
  G.pokeHud();
};

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
  // 蝌蚪：拍近（未命中）也触发逃跑——追逐反射的可见来源（方案 v0.2 §4.1）
  if (G.config.targetType === "tadpole") {
    G.preys.forEach(p => {
      if (p.type === "tadpole" && (p.invulnT || 0) <= 0 &&
          Math.hypot(x - p.x, y - p.y) < 160) p.fleeFrom(x, y);
    });
  }
  if (G.config.targetType !== "laser" && G.config.targetType !== "pool") G.ripple(x, y, true);
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
    // 拍偏：几点发光碎屑（明显弱于命中，不抢戏）
    G.sparkBurst(x, y, "#e8ff9a", 3);
    G.dustBurst(x, y, 3);
  }
  else if (G.config.targetType === "frog") {
    // 拍偏：水面溅几颗水珠 + 附近荷叶被拍得晃一下
    G.bubbleBurst(x, y, 3);
    if (G.padSway) G.padSway(x, y);
  }
  else G.bubbleBurst(x, y, 3);
  if (G.config.targetType !== "pool") G.playMiss();
  G.pokeHud();
}

/* ================= 触摸路由 ================= */
const HOLD_MS = 600;   // 暂停按钮长按时长
/* ================= 触摸（多点触控，PRD 5.9） =================
   猫的两只爪子会同时落在屏幕上，旧实现只取 e.touches[0]，
   结果「第一只爪子按住时，第二只爪子按下的位置不参与命中判定」。
   现在按本次事件的触点逐个派发；页面按钮仍只认第一根手指，
   避免双爪同时踩中按钮触发两次跳转。 */
const TOUCH_MAX = 5;                        // 单次事件最多处理 5 个触点（异常数据保护）
const tpOk = (t) => !!t && isFinite(t.clientX) && isFinite(t.clientY);
const tpId = (t) => (t && (t.identifier != null ? t.identifier : t.id));
function tpList(e) {
  const src = (e && e.changedTouches && e.changedTouches.length) ? e.changedTouches
    : (e && e.touches && e.touches.length ? e.touches : null);
  const out = [];
  if (!src) return out;
  for (let i = 0; i < src.length && out.length < TOUCH_MAX; i++) if (tpOk(src[i])) out.push(src[i]);
  return out;
}

/* 双爪乱拍（PRD 5.9）：300ms 内出现 ≥2 个不同触点、间距 ≥40px → 记一次高光。
   只做计数与反馈，不加分（得分口径见 5.5）。 */
function noteDualPaw(list) {
  const S = G.session;
  if (!S) return;
  const now = performance.now();
  const S1 = G.platform.S || 1;
  S.touchLog = (S.touchLog || []).filter(o => now - o.t <= 300);
  list.forEach(tp => S.touchLog.push({ t: now, x: tp.clientX / S1, y: tp.clientY / S1, id: tpId(tp) }));
  if (S.touchLog.length < 2) return;
  if (G.screen !== "playing" || S.paused || S.counting) return;
  if (now - (S.lastDualAt || 0) < 300) return;          // 同一 300ms 窗口只记一次
  let far = 0, mx = 0, my = 0;
  for (let i = 0; i < S.touchLog.length; i++) {
    for (let j = i + 1; j < S.touchLog.length; j++) {
      const a = S.touchLog[i], b = S.touchLog[j];
      if (a.id != null && a.id === b.id) continue;       // 同一根手指的重复采样
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d >= 40 && d > far) { far = d; mx = (a.x + b.x) / 2; my = (a.y + b.y) / 2; }
    }
  }
  if (!far) return;
  S.lastDualAt = now;
  S.dualPaw = (S.dualPaw || 0) + 1;                      // 埋点用：本局双爪次数
  if (G.floatText) G.floatText(mx, my - 30, "双爪！", "big");
  if (G.sparkBurst) G.sparkBurst(mx, my, "#ffe9a8", 8);
  if (G.playMilestone) G.playMilestone();
}

G.platform.onTouchStart = (e) => {
  if (!G.assetsReady) return;   // 资源未就绪：不响应触摸（防误触 ensureAudio / hitButton）
  const list = tpList(e);
  if (!list.length) return;
  const S = G.platform.S || 1;
  G.ensureAudio();

  if (G.screen === "playing") {
    noteDualPaw(list);
    const pr = G.ui.pauseRect;
    for (let k = 0; k < list.length; k++) {
      const x = list[k].clientX, y = list[k].clientY;
      // UI 布局在虚拟手机尺寸空间，按钮命中需换算到同一空间（玩法猎物仍在真实空间）
      const vx = x / S, vy = y / S;
      // 按钮只认第一根触点：双爪同时踩两个按钮不会触发两次
      if (k === 0 && pr && vx >= pr.x && vx <= pr.x + pr.w && vy >= pr.y && vy <= pr.y + pr.h) {
        if (!G.pauseHold.active) {
          G.pauseHold.active = true;
          G.pauseHold.id = tpId(list[k]);
          G.pauseHold.t0 = performance.now();
          G.pauseHold.progress = 0;
        }
        continue;
      }
      if (k === 0 && G.hitButton(vx, vy)) continue;
      /* 蝌蚪长按尾巴：压到尾巴先记"按住"，延迟结算——
         满 300ms 触发挣扎（位置冻结、尾巴快摆 + 头扭动）；
         松手 = 抓住，结算为命中；快速松开（<300ms）按普通命中结算，
         保留"压到尾就算中"的原语义。 */
      let holdTaken = false;
      if (G.config.targetType === "tadpole") {
        for (let i = G.preys.length - 1; i >= 0; i--) {
          const q = G.preys[i];
          if (q.type === "tadpole" && !(q.tadStruggle > 0) && q.hittable(x, y) && q._hitPart === "tail") {
            const SESS = G.session;
            (SESS.tadHolds = SESS.tadHolds || []).push({ id: tpId(list[k]), t0: performance.now(), x, y, p: q, active: false });
            holdTaken = true;
            break;
          }
        }
      }
      if (holdTaken) continue;
      // 命中测试（后绘制的优先，对齐 DOM 顶层元素语义）；每根手指各自判定，互不顶替
      let hit = null;
      for (let i = G.preys.length - 1; i >= 0; i--) {
        if (G.preys[i].hittable(x, y)) { hit = G.preys[i]; break; }
      }
      if (hit) onHit(x, y, hit);
      else onMiss(x, y);
    }
    return;
  }

  // 其余界面：按钮与手势只认第一个触点，避免双指同时点触发两次跳转
  const tp = list[0];
  const vx = tp.clientX / S, vy = tp.clientY / S;
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
  if (G.screen === "counting") return;
  if (G.screen === "records") {
    // 记录列表：落在列表区就先接管（拖动滚动），否则交给按钮（✕ / 面板外关闭）
    if (G.ui.recTouchStart && G.ui.recTouchStart(vx, vy)) return;
    G.hitButton(vx, vy);
    return;
  }
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
  } else if (G.screen === "records") {
    if (G.ui.recTouchMove) G.ui.recTouchMove(tp.clientY / (G.platform.S || 1));
  }
};
G.platform.onTouchEnd = (e) => {
  const list = tpList(e);
  const S = G.platform.S || 1;
  /* 蝌蚪长按尾巴：松手结算——
     挣扎已触发（位置冻结）→ 清挣扎状态，松手 = 抓住，结算命中；
     未触发（快速松开）→ 目标仍存活则按普通命中结算（压到尾=中）；
     目标已不在 → 静默丢弃。 */
  if (G.screen === "playing" && G.session.tadHolds && G.session.tadHolds.length) {
    const holds = G.session.tadHolds;
    for (let i = holds.length - 1; i >= 0; i--) {
      const h = holds[i];
      const lifted = list.length
        ? list.some(t => tpId(t) == null || h.id == null || tpId(t) === h.id)
        : true;
      if (!lifted) continue;
      const p = h.p;
      const alive = G.preys.indexOf(p) >= 0 && p.vanishT <= 0 && p.darkT <= 0;
      if (h.active && alive) { p.tadStruggle = 0; p.tadStruggleT = 0; p.tadStruggleW = 0; G.session.strugglePrey = null; }
      if (alive) onHit(h.x, h.y, p);
      holds.splice(i, 1);
    }
  }
  if (G.screen === "bgpick") {
    // 空事件兜底（测试垫片会传 {}）：取不到 x 则跳过点按翻页，仅走拖动收尾
    G.bgPickTouchEnd(list.length ? list[0].clientX / S : null);
    return;
  }
  if (G.screen === "summon") {
    G.summonPickTouchEnd(list.length ? list[0].clientX / S : null);
    return;
  }
  if (G.screen === "records") {
    if (G.ui.recTouchEnd) G.ui.recTouchEnd();   // 松手：交给惯性滚动
    return;
  }
  // 暂停长按：只有「按下长按的那根手指」抬起才取消（另一只爪子抬起不影响）
  if (G.pauseHold.active) {
    const lifted = list.length
      ? list.some(t => tpId(t) == null || G.pauseHold.id == null || tpId(t) === G.pauseHold.id)
      : true;
    if (lifted) { G.pauseHold.active = false; G.pauseHold.progress = 0; G.pauseHold.id = null; }
  }
};

/* ================= 画面绘制 ================= */
let _lastDt = 0.016;   // 最近一帧 dt（供局部照明等需要帧率无关平滑的地方读取）
function drawGameFrame(t) {
  /* 渲染体整体兜底：任何单帧绘制异常（如某些 Chromium 本地预览下跨域画布
     taint 抛 SecurityError）都不能上抛——loop() 末尾的 requestAnimationFrame 在
     try 之外，异常一旦出本函数 RAF 循环就永久停摆，表现为「点开始游戏后页面卡死」。
     吞掉异常只丢一帧（下一帧继续），游戏逻辑（update）不受影响。 */
  try {
    ctx.save();
    if (G.shake > 0.1) {
      const sx = (Math.random() - 0.5) * G.shake;
      const sy = (Math.random() - 0.5) * G.shake;
      ctx.translate(sx, sy);
    }
    G.drawScene(ctx, t);
    // 群鼠乱窜 · 局部照明：顶灯跟着鼠群走，鼠处被照亮、其余压暗（在地板之后、老鼠之前）
    if (G.scene && G.scene.type === "mouse" && G.scene.mouseBg === "swarm") G.drawSwarmLight(ctx, t, _lastDt);
    // 激光暗室：先压暗背景，让激光光点与拖尾"穿透"黑暗，对比更醒目
    if (G.scene && G.scene.dark) {
      ctx.fillStyle = "rgba(0,0,0,.72)";
      ctx.fillRect(-20, -20, G.platform.W + 40, G.platform.H + 40); // Larger to cover shake
    }
    G.preys.forEach(p => p.render(ctx, t));
    G.fx.draw(ctx);
    ctx.restore();
  } catch (e) { /* 单帧渲染失败：保持 ctx 状态可恢复，下帧照常 */ }
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
function loop() {
  // 微信小游戏的 RAF 时间戳在不同基础库/重进前后台场景下可能与 performance.now() 不同基准，
  // 两者混算会让倒计时帧差变成负数或异常值（数字会一直停在「3」并反复闪动）。统一用同一时钟。
  const now = performance.now();
  const dt = Math.max(0, Math.min((now - lastTs) / 1000, 0.05));
  lastTs = now;
  if (dt > 0) _lastDt = dt;
  G.lastDt = _lastDt;   // 暴露给场景层做帧率无关衰减（120Hz 高刷设备不再 2 倍速衰减）

  // assets 分包未就绪：只画加载屏，不推进游戏逻辑（避免 drawImage 失败出白图/黑块）
  if (!G.assetsReady) {
    drawAssetsLoadingScreen();
    /* 加载屏上也尽早 show 广告（G.screen 仍是 "home"，横屏浮卡即加载页右上角横带）。
       旧逻辑加载期间不打 pageFrame，只能等 900ms 兜底——分包加载快时广告出现得晚，
       甚至加载结束都没来得及 show，加载页看起来像没有广告。 */
    if (G.ad && G.ad.pageFrame) G.ad.pageFrame(G.screen);
    requestAnimationFrame(loop);
    return;
  }

  const S = G.session;
  const t = S.time;


  // 集中收尾：离开游戏态（counting/playing/paused 之外）时关闭屏幕常亮，
  // 覆盖所有直接 G.screen="home" 的返回路径，避免回首页后仍常亮耗电
  if (S._keepOn && G.screen !== "counting" && G.screen !== "playing" && G.screen !== "paused") {
    S._keepOn = false;
    G.platform.keepScreen(false);
  }

  if (G.screen === "counting") {
    // 过渡到 playing 期间跳过倒计时逻辑（避免重复 beginPlay / 再响 tick），
    // 但不能整体 return：裸 return 会跳过 loop() 末尾的 requestAnimationFrame，主循环永久停摆。
    if (G.nextScreen !== "playing") {
      countT -= dt;
      const ci = Math.ceil(countT);
      if (ci !== lastInt && ci > 0) {
        lastInt = ci;
        if (G.playCountdownTick) G.playCountdownTick(ci);
        else if (!(G.quietMouseRoom && G.quietMouseRoom())) G.playTick();   // 室内捕鼠局：倒计时也不出声
      }
      if (countT <= 0) beginPlay();
    }
  } else if (G.screen === "playing" && S.running && !S.paused) {
    S.time += dt;
    S.secAcc += dt;
    while (S.secAcc >= 1) { S.secAcc -= 1; tickSecond(); }
    // 蝌蚪快跑：数量按击中能力动态调节（每 8s 评估，1–7 只）
    if (G.tadpoleTick) G.tadpoleTick(dt);
    if (G.waveArm) G.waveArm();   // 对局运行帧：打开波次门闸（多只玩法才真正拦截）
    G.preys.forEach(p => p.update(dt, S.time));
    // 多只波次制（鼠/蛙/蝌蚪/激光/萤火虫）：全灭→空场 0.6s→统一补下一波
    if (G.waveTick) G.waveTick(dt);
    /* 蝌蚪长按尾巴：按住满 300ms 且目标仍存活 → 挣扎（位置冻结、尾巴快摆、头扭动、瞪眼）；
       目标已不在（被另一只爪子拍走/离场）→ 静默丢弃，不结算 */
    const holds = S.tadHolds;
    if (holds && holds.length) {
      const holdMs = (G.TADPOLE && G.TADPOLE.holdMs) || 300;
      const now = performance.now();
      for (let i = holds.length - 1; i >= 0; i--) {
        const h = holds[i];
        if (h.active || now - h.t0 < holdMs) continue;
        const p = h.p;
        const alive = G.preys.indexOf(p) >= 0 && p.vanishT <= 0 && p.darkT <= 0 && !(p.tadStruggle > 0);
        if (alive) {
          h.active = true;
          p.tadStruggle = 1; p.tadStruggleT = 0;
          S.strugglePrey = p;
          if (G.ripple) G.ripple(h.x, h.y, true);
        } else {
          holds.splice(i, 1);
        }
      }
    }
    /* 挣扎目标已消失的兜底清理（正常路径由 onTouchEnd 负责） */
    if (S.strugglePrey) {
      const sp = S.strugglePrey;
      if (G.preys.indexOf(sp) < 0 || sp.vanishT > 0 || sp.darkT > 0 || !(sp.tadStruggle > 0)) S.strugglePrey = null;
    }
  }
  // 老鼠出洞循环声：有 peek/dart 的鼠就唧唧叫，全部回洞就停；暂停/切后台也会停
  if (G.updateMouseSqueak) G.updateMouseSqueak();
  // 荷塘荷叶的缓慢漂移 / 沉浮（结算页背景也继续漂，不是静止贴图）
  if (G.updateLadybugLoop) G.updateLadybugLoop();
  // 荷塘荷叶的缓慢漂移 / 沉浮（结算页背景也继续漂，不是静止贴图）
  if (G.scene && G.scene.type === "frog" && G.padsUpdate) G.padsUpdate(dt, t);
  G.fx.update(dt, t);
  if (G.shake > 0) G.shake *= 0.88; // Decay shake

  // 暂停按钮长按推进：满 HOLD_MS 触发暂停（震动反馈 + 掉档音效免打扰，用 tick 音）
  const PH = G.pauseHold;
  if (PH.active && G.screen === "playing") {
    PH.progress = Math.min((performance.now() - PH.t0) / HOLD_MS, 1);
    if (PH.progress >= 1) {
      PH.active = false; PH.progress = 0; PH.id = null;
      S.paused = true;
      if (G.stopMouseSqueak) G.stopMouseSqueak();
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

  // 广告实例兜底巡检：任何绕过 switchScreen 的页面切换，下一帧销毁，避免实例残留
  if (G.ad && G.ad.watchdog) G.ad.watchdog(G.screen);
  // 广告首帧心跳：首页/结算/选场景每帧打一次点，累计两帧（布局已稳、入场动效已起）后再 show。
  // 猫粮机页自带打点（feeder.js），声音/召唤页在各自绘制末尾打点，这里跳过以免重复计数。
  if (G.ad && G.ad.pageFrame && (G.screen === "home" || G.screen === "result" || G.screen === "bgpick" || G.screen === "counting")) {
    G.ad.pageFrame(G.screen);
  }

  if (G.screen === "home") uiScaleCtx(() => G.ui.drawHome());
  else if (G.screen === "bgpick") {
    // 背景选择层自带实底，不再叠首页（否则首页标题会与弹层文字叠在一起）
    uiScaleCtx(() => G.ui.drawBgPick());
  }
  else if (G.screen === "settings") uiScaleCtx(() => G.ui.drawSettings());
  else if (G.screen === "records") uiScaleCtx(() => G.ui.drawRecords());
  else if (G.screen === "leaderboard") uiScaleCtx(() => G.ui.drawLeaderboard());
  else if (G.screen === "summon") uiScaleCtx(() => G.ui.drawSummon());
  else if (G.screen === "sound") uiScaleCtx(() => G.ui.drawSound());
  else if (G.screen === "feeder") {
    // 猫粮机自带整屏绘制与粮粒物理：先推进状态（定时器 / 落粒），再画
    G.feeder.update(dt);
    uiScaleCtx(() => G.feeder.draw());
  }
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
    if (G.waveReset) G.waveReset();   // 波次制：重建后放行待命个体
  }
  if (G.screen === "leaderboard") G.ui.showLB();           // 排行榜卡片区域随屏重发
  /* 尺寸/安全区/胶囊变化后，重算已挂载广告的落点。冷启动瞬间部分安卓机横屏尚未生效，
     广告是按竖屏坐标创建的（首页浮卡会卡在加载屏中部偏下的旧位置）——这里统一纠正，
     让加载页/首页横屏的广告始终回到「贴顶靠右」。无实例时 realign 是空操作。 */
  if (G.ad && G.ad.realign) G.ad.realign();
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
  if (G.stopMouseSqueak) G.stopMouseSqueak();
  // 切后台把声音页的试听停掉：回来不自动续播，避免"看不见来源的声音"
  if (G.screen === "sound" && G.stopAnimalSound) G.stopAnimalSound();
});

/* 回前台：微信可能重置 keepScreenOn 状态，游戏中则重设常亮 */
G.platform.showCb.push(() => {
  if (G.session && G.session._keepOn && G.config.keepScreen) {
    try { G.platform.keepScreen(true); } catch (e) {}
  }
});

/* 冷启动首屏就是首页：没走 switchScreen，所以这里补一次 ad.enter。
   （否则「第一次打开小游戏」这条最常见的路径上，首页广告永远不会建出来。） */
if (G.screen === "home" && G.ad && G.ad.enter) G.ad.enter("home");

/* ===== assets 分包门控 =====
   assets/ 已配为子包（game.json subpackages root:"assets/"），主包不再含这些资源。
   真机编译时子包需 wx.loadSubpackage 显式加载，否则 drawImage 全失败回退旧造型。
   浏览器垫片（harness.html）无 wx.loadSubpackage，直接放行。

   两个已确认的坑：
   ① 开发者工具：wx.loadSubpackage 有「success/fail 都不触发」的已知 bug（官方社区确认，
      重新编译后行为还会漂移）；且工具里资源本来就是本地文件、直接路径可用（工具容忍直读），
      → 工具环境直接放行，不进加载屏，从根上避开这个坑；
   ② 真机：个别基础库同样会挂起（两个回调都不来）。看门狗：30s 无 success 且 0 进度
      → 置错误态显示「资源加载失败」，让用户退出重进，而不是永远卡在「加载中…」。 */
G.assetsReady = false;
G.assetsProgress = 0;
G.assetsError = null;
/* 分包进度归一到 0~100：
   微信 onProgressUpdate 的 progress 值域跨平台不一致——文档/模拟器是 0~100，
   但 iOS 真机（基础库 2.1.x）实测返回 0~1，直接当百分比会让 0.5 显示成 1%、进度条几乎不动。
   字节比 totalBytesWritten/totalBytesExpectedToWrite 在两端都是 0~1 的权威比例，优先用它；
   拿不到字节数时再按 progress 值域兜底（<=1 视为 0~1 乘 100）。 */
G.normSubpackageProgress = function normSubpackageProgress(res) {
  if (!res) return null;
  const p = Number(res.progress);
  if (!isFinite(p) || p < 0) return null;
  let v;
  const written = Number(res.totalBytesWritten), total = Number(res.totalBytesExpectedToWrite);
  if (isFinite(written) && isFinite(total) && total > 0 && written >= 0) {
    v = written / total * 100;
  } else {
    v = p <= 1 ? p * 100 : p;
  }
  return Math.max(0, Math.min(100, v));
};
(function startAssetsSubpackage() {
  let isDevtools = false;
  try { isDevtools = typeof wx !== "undefined" && wx.getSystemInfoSync().platform === "devtools"; } catch (e) {}
  if (typeof wx === "undefined" || typeof wx.loadSubpackage !== "function" || isDevtools) {
    G.assetsReady = true;   // 浏览器垫片 / 开发者工具：资源走本地路径直接可用，无需分包下载
    return;
  }
  let task = null;
  let lastProgAt = Date.now();   // 进度最近一次真正变化的时刻（"进度停滞"判定基准）
  let wdTimer = null;
  const stopWd = () => { if (wdTimer) { clearInterval(wdTimer); wdTimer = null; } };
  try {
    task = wx.loadSubpackage({
      name: "assets",
      success: () => { G.assetsReady = true; G.assetsProgress = 100; stopWd(); },
      fail: (err) => { G.assetsError = (err && (err.errMsg || err.errno)) || "unknown"; stopWd(); }
    });
  } catch (e) { G.assetsError = String((e && e.message) || e); }
  if (task && typeof task.onProgressUpdate === "function") {
    task.onProgressUpdate((res) => {
      // 归一到 0~100（跨平台值域不一致，见 normSubpackageProgress）
      // 单调不回退：回调可能乱序/重复推旧值，倒退会让进度条往回跳
      const v = normSubpackageProgress(res);
      if (v != null && v > G.assetsProgress) {
        G.assetsProgress = v;
        lastProgAt = Date.now();
      }
    });
  }
  // 看门狗：分包挂起（无回调、或进度停在某处不再推进）时兜底，避免永久卡在加载屏。
  // 连续 30s 无进度变化才判停滞，慢网络不误报；success/fail 到来即释放计时器。
  wdTimer = setInterval(() => {
    if (G.assetsReady || G.assetsError) { stopWd(); return; }
    if (Date.now() - lastProgAt > 30000) { G.assetsError = "加载超时"; stopWd(); }
  }, 5000);
})();

/* 资源未就绪时的加载屏：暖砂 4 段渐变 + 玩法画面轮播卡（上半部分）
   + 标题 + 进度条（小灰鼠跑在进度上、终点一块奶酪）+ 流光 + 百分比
   + 每 2.6s 轮换一条实用小提示。整体走 uiScaleCtx，且在「虚拟手机尺寸」
   (W/S × H/S，与 ui.js layout() 同一套约定) 里布局，由 ctx.scale(S) 放大铺满整窗——
   否则平板/高分屏(S>1) 下内容会溢出屏幕。
   进度用缓动跟随真实值（onProgressUpdate 常跳变，直接画会一顿一顿）。出错时显示错误文案。 */
let _loadShownPct = 0, _loadLastT = 0;
/* 轮播话术：平板体验 / 屏幕保护 / 猫咪心情判读（引导「猫咪状态」页）/ 陪伴建议。
   文案短句优先（横屏窄虚拟宽也放得下），绘制时按可用宽度自适应缩字号。 */
const _LOAD_TIPS = [
  "用平板玩更过瘾，大屏捕猎更真实",
  "记得给屏幕贴膜，别让猫爪划伤它",
  "猫咪呼噜呼噜是开心，去「猫咪状态」听听心情",
  "耳朵后贴、尾巴快甩，说明猫咪有点烦",
  "瞳孔放大、身体压低，它要扑猎啦",
  "猫咪打哈欠伸懒腰，是想休息了",
  "「电子猫粮」定时投喂，猫咪干饭更规律",
  "猫粮一次别放太多，新鲜才爱吃",
  "录下你喊它的声音，「召唤猫咪」一喊就到",
  "猫咪认得你的声音，走远了也能唤回来",
  "每天陪玩十分钟，猫咪更健康亲近",
  "轻轻晃动逗猫棒，比一直点屏更吸引猫"
];
/* 玩法画面轮播：用主包矢量图标（D.icon），不碰尚未加载的 assets 子包贴图。
   每 3.6s 切一张、首尾 0.5s 淡入淡出，图标带轻微浮动，卡片用各玩法主题色。 */
const _LOAD_SCENES = [
  { icon: "fish", name: "逗小鱼", desc: "指尖轻点，看金鱼摆尾" },
  { icon: "mouse", name: "小鼠迷宫", desc: "洞口探头，伏地冲刺" },
  { icon: "butterfly", name: "花园彩蝶", desc: "扇翅起落，追着蝴蝶跑" },
  { icon: "frog", name: "青蛙跳跳", desc: "荷叶之间，比谁跳得远" },
  { icon: "tadpole", name: "蝌蚪快跑", desc: "一群小家伙摆尾冲刺" },
  { icon: "ladybug", name: "昆虫乐园", desc: "瓢虫数星星，慢慢散步" },
  { icon: "pool", name: "暗夜荧光", desc: "关灯之后，小虫会发光" },
  { icon: "laser", name: "激光逗猫", desc: "红点飘啊飘，猫咪追不停" },
  { icon: "bowl", name: "电子猫粮", desc: "一键出粮，猫咪来干饭" },
  { icon: "cat", name: "召唤猫咪", desc: "录下叫声，把猫咪喊过来" },
  { icon: "heart", name: "猫咪心情", desc: "听叫声，读懂猫咪心情" }
];
const _LOAD_SCENE_DUR = 3.6;
function _drawLoadScene(W, H, t) {
  const idx = Math.floor(t / _LOAD_SCENE_DUR) % _LOAD_SCENES.length;
  const sc = _LOAD_SCENES[idx];
  const f = t % _LOAD_SCENE_DUR;
  const alpha = Math.max(0, Math.min(1, f / 0.5, (_LOAD_SCENE_DUR - f) / 0.5));
  /* 轮播大卡做背景板：占据上半屏主体，图标+玩法名居中放大、置于底层；
     「加载中…」与进度条作为前景叠在卡内下部——位置由返回值 LB 供
     drawAssetsLoadingScreen 定位，两层同一张卡，视觉上轮播即背景。 */
  const cw = Math.min(W * 0.86, 520), ch = Math.min(H * 0.60, 330);
  const cx = (W - cw) / 2, cy = H * 0.055;
  const icx = cx + cw / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  // 白卡背景板（与游戏内面板同一套语言：白卡 + 浅青描边 + 柔和阴影）
  ctx.save();
  ctx.shadowColor = "rgba(20,49,58,.10)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(cx, cy, cw, ch, 18) : ctx.rect(cx, cy, cw, ch);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#dcebe6"; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(cx, cy, cw, ch, 18) : ctx.rect(cx, cy, cw, ch);
  ctx.stroke();
  // 图标：大尺寸居中，轻微浮动；D.icon 自带 save/restore
  ctx.save();
  ctx.translate(icx, cy + ch * 0.24 + Math.sin(t * 2.4 + idx) * 3);
  const s = ch / 270;
  ctx.scale(s, s);
  if (G.draw && G.draw.icon) G.draw.icon(ctx, sc.icon, 0, 0, 1, true);  // 强制矢量：子包未就绪
  ctx.restore();
  // 玩法名 + 描述（居中，按卡宽自适应缩字号）
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#14313a";
  let nameFs = Math.min(26, Math.max(15, ch * 0.105));
  ctx.font = "bold " + nameFs + "px sans-serif";
  while (ctx.measureText(sc.name).width > cw - 40 && nameFs > 13) ctx.font = "bold " + (--nameFs) + "px sans-serif";
  ctx.fillText(sc.name, icx, cy + ch * 0.575);
  let descFs = Math.min(15, Math.max(11, ch * 0.055));
  ctx.font = descFs + "px sans-serif";
  ctx.globalAlpha = alpha * 0.8;
  while (ctx.measureText(sc.desc).width > cw - 40 && descFs > 10) ctx.font = (--descFs) + "px sans-serif";
  ctx.fillStyle = "#4a6b74";
  ctx.fillText(sc.desc, icx, cy + ch * 0.66);
  // 轮播指示点（卡正下方）：当前卡 teal 实心，其余浅青
  ctx.globalAlpha = alpha * 0.75;
  const dotR = 2.5, gapR = 9, totalW = (_LOAD_SCENES.length - 1) * gapR;
  const dx0 = icx - totalW / 2, dy = cy + ch + 9;
  for (let i = 0; i < _LOAD_SCENES.length; i++) {
    ctx.beginPath();
    ctx.arc(dx0 + i * gapR, dy, i === idx ? dotR + 0.8 : dotR, 0, Math.PI * 2);
    ctx.fillStyle = i === idx ? "#159a8c" : "rgba(21,154,140,.32)";
    ctx.fill();
  }
  ctx.restore();
  return { cx, cy, cw, ch };
}
function _drawLoadMouse(x, y, t) {
  // 面向右的小灰鼠（跑在进度条上）：身体 + 头 + 耳 + 眼鼻 + 尾巴 + 小短腿
  const bob = Math.sin(t * 12) * 1.3;
  const yy = y + bob;
  ctx.strokeStyle = "rgba(74,107,116,.8)";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 9, yy + 1);
  ctx.quadraticCurveTo(x - 17, yy + 3, x - 15, yy - 4);
  ctx.stroke();
  const run = Math.sin(t * 15) * 1.6;
  ctx.fillStyle = "#7f95a0";
  ctx.beginPath();
  ctx.ellipse(x - 7, yy + 3.4 + run * 0.4, 2.2, 2.6, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 2, yy + 3.4 - run * 0.4, 2.2, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#93a8b2";
  ctx.beginPath();
  ctx.ellipse(x, yy, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 8.5, yy - 2.5, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 5.5, yy - 6.5, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e5a8a0";
  ctx.beginPath();
  ctx.arc(x + 5.5, yy - 6.5, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#33302b";
  ctx.beginPath();
  ctx.arc(x + 10.5, yy - 3, 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e07a7a";
  ctx.beginPath();
  ctx.arc(x + 14, yy - 1, 1.5, 0, Math.PI * 2);
  ctx.fill();
}
function _drawCheese(x, y) {
  // 进度条终点的小奶酪块
  ctx.fillStyle = "#f0bf52";
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 5);
  ctx.lineTo(x + 8, y - 4);
  ctx.lineTo(x + 8, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#c8922f";
  ctx.beginPath();
  ctx.arc(x + 1, y + 2, 1.6, 0, Math.PI * 2);
  ctx.arc(x + 5.4, y - 0.6, 1.2, 0, Math.PI * 2);
  ctx.fill();
}
function drawAssetsLoadingScreen() {
  const t = performance.now() / 1000;
  // 与 ui.js layout() 一致：UI 在「虚拟手机尺寸」(W/S × H/S)里布局，外层 ctx.scale(S) 放大铺满整窗
  const S = G.platform.S || 1;
  const W = (G.platform.W || 390) / S, H = (G.platform.H || 844) / S;
  uiScaleCtx(() => {
  /* 与首页/全游戏同一主题：白 → 淡青 → 浅青背景（homeBg1/2/3），墨青文字（C.ink），
     teal 主色进度条。加载页不再自成一套暖砂色。 */
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.45, "#e6f8f1");
  g.addColorStop(1, "#cdefe4");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#14313a";
  ctx.font = "bold 22px sans-serif";
  // 玩法画面轮播大卡做背景（前景加载信息叠在卡上），错误态不展示
  const LB = (!G.assetsError) ? _drawLoadScene(W, H, t) : null;
  if (G.assetsError) {
    ctx.fillText("资源加载失败", W / 2, H * 0.42);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#4a6b74";
    ctx.fillText("请退出后重新进入小游戏", W / 2, H * 0.50);
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "rgba(74,107,116,.6)";
    ctx.fillText(String(G.assetsError).slice(0, 40), W / 2, H * 0.545);
    return;
  }
  // 前景层：加载中 + 进度条叠在轮播卡内下部（z 序在轮播之上），与描述留足呼吸空隙
  ctx.fillText("加载中…", W / 2, LB.cy + LB.ch * 0.80);
  // 进度条：宽随卡收窄，居中；小鼠跑在进度位置，终点一块奶酪
  const bw = Math.min(LB.cw * 0.66, 300), bh = 10, bx = (W - bw) / 2, by = LB.cy + LB.ch - 26;
  ctx.fillStyle = "rgba(21,154,140,.14)";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 5) : ctx.rect(bx, by, bw, bh);
  ctx.fill();
  const target = Math.max(0, Math.min(1, G.assetsProgress / 100));
  const dtL = _loadLastT ? Math.min(0.05, t - _loadLastT) : 0.016;
  _loadLastT = t;
  _loadShownPct += (target - _loadShownPct) * Math.min(1, dtL * 7);
  if (Math.abs(target - _loadShownPct) < 0.002) _loadShownPct = target;
  const pct = _loadShownPct;
  if (pct > 0.004) {
    const fw = Math.max(bh, bw * pct);
    const fg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    fg.addColorStop(0, "#46d6c0"); fg.addColorStop(1, "#14a093");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, fw, bh, 5) : ctx.rect(bx, by, fw, bh);
    ctx.fill();
    // 流光：填充区里一道缓慢扫过的亮带
    ctx.save();
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, fw, bh, 5) : ctx.rect(bx, by, fw, bh);
    ctx.clip();
    const sw = 26, sx = bx + ((t * 90) % (fw + sw * 2)) - sw;
    const sg = ctx.createLinearGradient(sx - sw, 0, sx + sw, 0);
    sg.addColorStop(0, "rgba(255,255,255,0)");
    sg.addColorStop(0.5, "rgba(255,255,255,.30)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(bx, by, fw + sw * 2, bh);
    ctx.restore();
  }
  _drawCheese(bx + bw + 17, by + bh / 2 + 1);
  // 注意必须传时间 t：缺参时 bob=Math.sin(NaN) 会让全部坐标变 NaN，canvas 静默跳过绘制
  _drawLoadMouse(bx + 2 + bw * pct, by - 2, t);
  ctx.fillStyle = "#4a6b74";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(Math.round(G.assetsProgress) + "%", W / 2, LB.cy + LB.ch + 30);
  // 轮换提示：2.6s 一条，首尾 0.25s 淡入淡出
  const ti = Math.floor(t / 2.6) % _LOAD_TIPS.length;
  const tf = t % 2.6;
  const ta = Math.min(1, tf / 0.25, (2.6 - tf) / 0.25);
  ctx.fillStyle = "rgba(74,107,116," + (0.9 * ta).toFixed(3) + ")";
  let tipFs = 14;
  ctx.font = tipFs + "px sans-serif";
  while (ctx.measureText(_LOAD_TIPS[ti]).width > W * 0.9 && tipFs > 10) ctx.font = (--tipFs) + "px sans-serif";
  ctx.fillText(_LOAD_TIPS[ti], W / 2, LB.cy + LB.ch + 56);
  });
}

requestAnimationFrame(loop);

