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

const ctx = G.platform.ctx;
const clamp = G.clamp;
G.screen = "home";        // home | settings | records | counting | playing | paused | result
G.result = null;
G.pauseHold = { active: false, t0: 0, progress: 0 };   // HUD 暂停按钮长按状态（600ms 触发）
let countT = 0, lastInt = -1;

/* ================= 真机调试面板（预览/体验版自动打开 vConsole） ================= */
function initDebug() {
  try {
    if (typeof wx !== "undefined" && wx.setEnableDebug) {
      const info = (typeof wx.getAccountInfoSync === "function") ? wx.getAccountInfoSync() : {};
      const env = (info && info.miniProgram && info.miniProgram.envVersion) || "";
      if (env === "develop" || env === "trial") {
        wx.setEnableDebug({ enableDebug: true });
        console.log("[catToy] vConsole enabled for " + env);
      }
    }
  } catch (e) { console.log("[catToy] setEnableDebug skipped", e && e.message); }
}
initDebug();

/* ================= 开局 ================= */
G.startGame = () => {
  G.ensureAudio();
  const S = G.session;
  S.touches = 0; S.hits = 0; S.bonusHits = 0; S.combo = 0; S.maxCombo = 0;
  S.missStreak = 0; S.dartStreak = 0; S.dartHits = 0;
  S.adaptiveTier = 0; S.comboTier = 0; S.lastTierDropAt = 0;
  S.remaining = Number(G.config.duration) || 180;
  S.running = false; S.paused = false; S.counting = true;
  S.time = 0; S.secAcc = 0; S.stage = 1;
  G.uiFX.stagePop = 0; G.ui.hudDimT = 0;
  G.buildScene(G.config.targetType);
  G.fx.clear();
  G.buildPreys();
  G.platform.keepScreen(true);
  countT = 3; lastInt = -1;
  G.screen = "counting";
};

function beginPlay() {
  G.session.counting = false;
  G.session.running = true;
  G.session.lastTs = performance.now();
  G.playGo();
  G.screen = "playing";
}

/* ================= 每秒心跳 ================= */
function tickSecond() {
  const S = G.session;
  S.remaining--;
  if (S.remaining <= 0) { G.endGame(); return; }
  const st = G.stageNow();
  if (st !== S.stage) {
    S.stage = st;
    G.uiFX.stageText = G.stageName(st);
    G.uiFX.stagePop = 1.6;
    G.pokeHud();
  }
}

/* ================= 结算 ================= */
G.endGame = (fromPause) => {
  const S = G.session;
  S.running = false;
  G.platform.keepScreen(false);
  const totalHits = S.hits + (S.bonusHits || 0);
  const acc = S.touches > 0 ? Math.min(100, Math.round((totalHits / S.touches) * 100)) : 0;
  // 本地记录（最近 50 局）
  let logs = [];
  try { logs = JSON.parse(G.platform.storage.get("catToyLogs") || "[]"); } catch (e) {}
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
  const mins = Math.max((Number(G.config.duration) || 180) / 60, 1 / 60);
  const hpm = totalHits / mins;
  const interacted = S.touches >= 8 && (totalHits >= 5 || S.maxCombo >= 3);
  let title, desc;
  if (hpm >= 18)      { title = "捕猎大师！"; desc = "这个反应速度，堪称专业级猎手。"; }
  else if (hpm >= 9 || (interacted && hpm >= 6)) { title = "矫健猎手"; desc = "扑击精准、节奏稳健，状态很好。"; }
  else if (hpm >= 3.5 || interacted) { title = "灵巧学徒"; desc = "全程都有参与，正在建立信心。"; }
  else                { title = "慵懒观察员"; desc = "今天兴趣不大？换个猎物类型试试。"; }
  const tag = G.config.targetType === "mouse" ? "追击" : G.config.targetType === "butterfly" ? "精准扑击" : G.config.targetType === "laser" ? "光点落网" : "奖励命中";
  G.result = {
    title, desc, touches: S.touches, hits: totalHits, acc, maxCombo: S.maxCombo,
    bonusTag: S.bonusHits > 0 ? "含" + tag + " ×" + S.bonusHits : ""
  };
  G.screen = "result";
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
  const chasing = isMouse && prey.state === "dart";
  const resting = isBfly && prey.state === "RESTING";
  const holding = isLaser && prey.state === "hold";
  S.touches++;
  S.hits++;
  S.combo++;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  S.missStreak = Math.max(0, S.missStreak - 2);
  prey.vanish();
  G.sparkBurst(x, y, prey.def.sparkColor || "#ffd76a", 8);
  if (!isLaser) G.ripple(x, y, false);
  G.plantsStartle(x, y);
  if (isMouse) {
    G.dustBurst(x, y, 5);
    G.playSqueak(chasing);
    G.platform.vibrateHeavy();
    // 命中洞口 = 好洞：清空蹲守热度（半径 60，两排洞互不误伤）
    const Sc = G.scene;
    Sc.holes.forEach((h, i) => { if (Math.hypot(x - h.x, y - h.y) < 60) Sc.holeHeat[i] = []; });
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
    G.platform.vibrate();
  } else if (isLaser) {
    G.sparkBurst(x, y, "#ff5252", 8);
    G.scorch(x, y);
    G.playZap();
    if (holding) G.tone("sine", 1760, 0, 0.14, 0.16);
    G.platform.vibrateHeavy();
    if (holding) S.bonusHits++;
  } else {
    G.bubbleBurst(x, y, 5);
    G.playHit(S.combo);
    G.platform.vibrate();
  }
  if (S.combo > 0 && S.combo % 5 === 0) {
    G.floatText(prey.x, prey.y - 30, "连击 ×" + S.combo + "！", "big");
    G.playMilestone();
  } else {
    if (isMouse) G.floatText(x, y - 20, chasing ? "+2 追击成功！" : "+1 抓住！", chasing ? "big" : "");
    else if (isBfly) G.floatText(prey.x, prey.y - 30, resting ? "精准扑击 +2" : "+1", resting ? "big" : "");
    else if (isLaser) G.floatText(x, y - 20, holding ? "+2 光点落网！" : "抓住光点！", "big");
    else G.floatText(x, y - 20, "+1");
  }
  G.pokeHud();
}

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
    Sc.holes.forEach((h, i) => {
      if (Math.hypot(x - h.x, y - h.y) < 60) {
        const arr = Sc.holeHeat[i] || (Sc.holeHeat[i] = []);
        arr.push(now);
        while (arr.length > 3) arr.shift();
      }
    });
  }
  else if (G.config.targetType === "butterfly") G.pollenBurst(x, y, 3);
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
  G.ensureAudio();
  if (G.screen === "playing") {
    // 暂停按钮：长按手势（按下开始计时，松手取消；不判 miss 不影响连击）
    const pr = G.ui.pauseRect;
    if (pr && x >= pr.x && x <= pr.x + pr.w && y >= pr.y && y <= pr.y + pr.h) {
      G.pauseHold.active = true;
      G.pauseHold.t0 = performance.now();
      G.pauseHold.progress = 0;
      return;
    }
    G.pauseHold.active = false;
    if (G.hitButton(x, y)) return;
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
  G.hitButton(x, y);   // 其余界面：按钮优先
};
G.platform.onTouchEnd = () => {
  if (G.pauseHold.active) { G.pauseHold.active = false; G.pauseHold.progress = 0; }   // 未满 600ms：取消，无惩罚
};

/* ================= 画面绘制 ================= */
function drawGameFrame(t) {
  G.drawScene(ctx, t);
  // 激光暗室：先压暗背景，让激光光点与拖尾"穿透"黑暗，对比更醒目
  if (G.scene && G.scene.dark) {
    ctx.fillStyle = "rgba(0,0,0,.72)";
    ctx.fillRect(0, 0, G.platform.W, G.platform.H);
  }
  G.preys.forEach(p => p.render(ctx, t));
  G.fx.draw(ctx);
}

/* ================= 主循环 ================= */
let lastTs = performance.now();
function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  const S = G.session;
  const t = S.time;

  if (G.screen === "counting") {
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

  // 暂停按钮长按推进：满 HOLD_MS 触发暂停（震动反馈 + 掉档音效免打扰，用 tick 音）
  const PH = G.pauseHold;
  if (PH.active && G.screen === "playing") {
    PH.progress = Math.min((performance.now() - PH.t0) / HOLD_MS, 1);
    if (PH.progress >= 1) {
      PH.active = false; PH.progress = 0;
      S.paused = true;
      G.screen = "paused";
      G.platform.vibrate();
      G.playTick();
    }
  }

  // 绘制当前界面
  G.ui.buttons.length = 0;
  if (G.screen === "home") G.ui.drawHome();
  else if (G.screen === "settings") G.ui.drawSettings();
  else if (G.screen === "records") G.ui.drawRecords();
  else if (G.screen === "leaderboard") G.ui.drawLeaderboard();
  else if (G.screen === "result") G.ui.drawResult();
  else {
    drawGameFrame(t);
    if (G.screen === "counting") G.ui.drawCountdown(Math.max(countT, 0));
    else G.ui.drawHud(t, dt);
    if (G.screen === "paused") G.ui.drawPause();
  }
  requestAnimationFrame(loop);
}

/* 尺寸变化：重建布景并重锚状态机（对齐原型 resize 行为） */
G.platform.resizeCb.push(() => {
  if (G.screen === "playing" || G.screen === "paused" || G.screen === "counting") {
    G.buildScene(G.config.targetType);
    G.buildPreys();
    G.preys.forEach(p => { if (p.stage) p.stage = 0; });   // 触发下帧重进阶段
  }
  if (G.screen === "leaderboard") G.ui.showLB();           // 排行榜卡片区域随屏重发
});

requestAnimationFrame(loop);
