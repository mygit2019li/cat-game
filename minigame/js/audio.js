/* audio.js — Web Audio 合成音效（wx.createWebAudioContext，与原型同参数） */
module.exports = function (G) {
  let actx = null;
  function ensureAudio() {
    if (!actx) actx = G.platform.audioCtx();
    if (actx && actx.state === "suspended") { try { actx.resume(); } catch (e) {} }
  }
  function tone(type, f0, f1, dur, vol, delay) {
    if (!G.config.sound || !actx) return;
    try {
      const t0 = actx.currentTime + (delay || 0);
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t0);
      if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain); gain.connect(actx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  G.ensureAudio = ensureAudio;
  G.tone = tone;

  let summonTimer = null;   // 兼容旧引用（现用 kindTimer 调度）
  /* 召唤猫咪：优先播放本地真实喵声（assets/audio/ 下的 Mixkit 免费音效，循环播放直到手动停止）；
     本地音频不可用时回落到合成"喵"声。G.CAT_KINDS（config.js）定义各性格卡牌的音频与喵声参数 */
  G.summonKindIdx = 0;
  let kindTimer = null, kindStep = 0;
  let summonToken = 0;      // 递增令牌：旧音频的迟到回调不会污染新一次播放的状态

  function stopSummonAudio() {
    if (kindTimer) { clearTimeout(kindTimer); kindTimer = null; }
    if (summonTimer) { clearTimeout(summonTimer); summonTimer = null; }
    const a = G._currentSummonAudio;
    G._currentSummonAudio = null;
    if (a) { try { a.stop(); a.destroy(); } catch (e) {} }
  }

  /* 合成喵声兜底：按 kind.mews 循环调度 */
  function playSynthMews(kind, token) {
    if (!kind.mews || !kind.mews.length) return;
    kindStep = 0;
    const playNext = () => {
      if (token !== summonToken) return;
      const m = kind.mews[kindStep % kind.mews.length];
      // 主音（正弦上滑下滑的"喵"）+ 低音量高八度三角泛音暖化
      tone("sine", m[0], m[1], m[2], 0.2);
      tone("triangle", m[0] * 2, m[1] * 2, m[2] * 0.85, 0.045);
      kindStep++;
      kindTimer = setTimeout(playNext, m[2] * 1000 + (kind.gap || 300));
    };
    playNext();
  }

  G.startSummonKind = (idx) => {
    ensureAudio();
    const kinds = G.summonKinds ? G.summonKinds() : (G.CAT_KINDS || []);
    if (!kinds.length) { G.summonPlaying = false; return; }
    const i = ((idx % kinds.length) + kinds.length) % kinds.length;
    const kind = kinds[i];
    G.summonKindIdx = i;
    stopSummonAudio();                       // 先停上一段，避免叠音
    const token = ++summonToken;
    if (!kind || !G.config.sound) { G.summonPlaying = false; return; }
    G.summonPlaying = true;

    if (kind.audioPath && typeof wx !== "undefined" && wx.createInnerAudioContext) {
      try {
        const audio = wx.createInnerAudioContext();
        G._currentSummonAudio = audio;
        audio.src = kind.audioPath;
        // 素材已是 15s 以上的长片段，且循环点做了 0.15s 交叉淡化 → 直接 loop 无缝续播
        audio.loop = true;
        audio.volume = 1;
        audio.onPlay(() => { if (token === summonToken) G.summonPlaying = true; });
        audio.onEnded(() => {
          // loop=true 时不触发；万一某些机型忽略 loop，这里补一次续播
          if (token !== summonToken) return;
          try { audio.play(); } catch (e) {}
        });
        audio.onError(() => {
          if (token !== summonToken) return;
          // 本地音频不可用（如未打进代码包）→ 合成喵声保底
          try { audio.destroy(); } catch (e) {}
          if (G._currentSummonAudio === audio) G._currentSummonAudio = null;
          G.summonPlaying = true;
          playSynthMews(kind, token);
        });
        audio.play();
        return;
      } catch (e) {
        playSynthMews(kind, token);
        return;
      }
    }

    playSynthMews(kind, token);
  };
  G.stopSummonMusic = () => {
    summonToken++;                           // 作废所有在途回调
    stopSummonAudio();
    G.summonPlaying = false;
  };

  /* ---------- 声音库（首页「声音」模块）----------
     猫/狗各 12 条情绪音，同一时间只播一条：点新卡会先停旧卡再播。
     只用「一个」InnerAudioContext 反复换 src —— 微信同时存在的实例上限约 10 个，
     24 条音各自建实例会在用户点过一轮后直接超限；换 src 的复用方式没有这个风险。
     G.soundPad 是绘制层读取的播放状态；dur 用来兜底（onEnded 少数机型不回调）。 */
  G.soundPad = { animal: "", key: "", name: "", playing: false, t0: 0, dur: 0 };
  let padPlayer = null, padBroken = false, padSeq = 0;
  function ensurePadPlayer() {
    if (padPlayer || padBroken) return padPlayer;
    const inWx = typeof wx !== "undefined" && typeof wx.createInnerAudioContext === "function";
    try {
      if (inWx) {
        const a = wx.createInnerAudioContext();
        a.loop = false;
        a.volume = 0.95;
        // 不接 onEnded：换 src 时上一条的 ended 可能晚到，会把新一条误标成已结束。
        // 播放中判定统一由 G.soundPadActive() 按 dur 兜底，元数据时长是准的。
        a.onError(() => { G.soundPad.playing = false; });   // 单条素材失败不封死整个播放器
        padPlayer = a;
      } else if (typeof Audio !== "undefined") {
        const a = new Audio();
        a.preload = "auto";
        a.volume = 0.95;
        a.addEventListener("error", () => { G.soundPad.playing = false; });
        padPlayer = a;
      }
    } catch (e) { padBroken = true; }
    return padPlayer;
  }
  function padStop() {
    if (!padPlayer) return;
    try { padPlayer.stop(); } catch (e) {}
    try { padPlayer.pause(); } catch (e) {}
    try { if (typeof padPlayer.seek === "function") padPlayer.seek(0); } catch (e) {}
    try { padPlayer.currentTime = 0; } catch (e) {}
  }
  G.stopAnimalSound = () => {
    padSeq++;
    padStop();
    G.soundPad.playing = false;
    G.soundPad.animal = ""; G.soundPad.key = ""; G.soundPad.name = "";
  };
  /* 播放一条：animal/snd 来自 G.SOUND_PACKS。返回 true 表示已发起播放。
     音效总开关关闭时不播（首页设置里可开），由 UI 提示。 */
  G.playAnimalSound = (animal, snd) => {
    if (!snd || !snd.path) return false;
    ensureAudio();
    if (G.config && G.config.sound === false) { G.stopAnimalSound(); return false; }
    const p = ensurePadPlayer();
    if (!p) return false;
    padStop();
    try {
      const abs = /^(?:data:|blob:|https?:|\/|wxfile:\/\/)/i.test(snd.path);
      const inWx = typeof wx !== "undefined" && typeof wx.createInnerAudioContext === "function";
      p.src = inWx || abs || typeof location === "undefined" ? snd.path : "../" + snd.path;
      /* 先同步置状态再 play()：play 的异步回调可能晚于动画首帧 */
      G.soundPad = {
        animal: (animal && animal.key) || animal || "", key: snd.key || "", name: snd.name || "",
        playing: true, t0: performance.now(), dur: (Number(snd.dur) || 1) * 1000
      };
      const seq = ++padSeq;
      const r = p.play();
      if (r && typeof r.catch === "function") {
        r.catch((err) => {
          // 连点换 src 时浏览器会抛 AbortError（正常中断）；旧一次的回调也不能污染新状态
          if (seq !== padSeq) return;
          if (err && err.name === "AbortError") return;
          G.soundPad.playing = false;
        });
      }
      return true;
    } catch (e) {
      G.soundPad.playing = false;
      return false;
    }
  };
  /* 播放中判定：onEnded 之外的兜底（dur + 120ms 后视为结束） */
  G.soundPadActive = () => {
    const s = G.soundPad;
    if (!s || !s.playing) return false;
    if (s.dur > 0 && performance.now() - s.t0 > s.dur + 120) { s.playing = false; return false; }
    return true;
  };

  /* ---------- 暗夜萤光（三种发光玩具）音效 ----------
     沿用 tools/gen_firefly_sfx.py 按参考视频实测参数合成的原创音：
       兔子 → 通用中频段；老鼠 → 带短吱的鼠音段；瓢虫 → 最脆的翅膜嗡。
       张翅摩擦与出现 ticks 三种共用。 */
  const FF_HIT = "assets/sfx/firefly-hit.wav";
  const FF_HIT_V = {
    dog: "assets/sfx/firefly-hit-dog.wav",
    mouse: "assets/sfx/firefly-hit-mouse.wav",
    ladybug: "assets/sfx/firefly-hit-ladybug.wav"
  };
  /* 没有音频能力时的合成回退：同样按物种换中心频率与低频垫底 */
  const FF_HIT_TONE = { dog: [780, 520, 1], mouse: [1300, 980, 0], ladybug: [1720, 1240, 0] };
  const FF_FLARE = "assets/sfx/firefly-flare.wav";
  /* 兔子音效：参考视频里精确截取的“跳一下”轻响（tools/extract_rabbit_sfx.py）
     只在每次起跳时播放一次，不再按移动计时循环，也不在蹲下时叠音。 */
  const RABBIT_HOP = "assets/sfx/rabbit-hop.wav";
  const RABBIT_LAND = "assets/sfx/rabbit-video-2.wav";
  const RABBIT_HIT = "assets/sfx/rabbit-hit.wav";      // tools/gen_rabbit_hit_sfx.py 合成：低频 pop + 高频星爆 shimmer
  const LADYBUG_APPEAR = "assets/sfx/ladybug-appear.wav";
  const FF_SPAWN = "assets/sfx/firefly-spawn.wav";
  const FF_SHIFT = "assets/sfx/firefly-shift.wav";
  let ffHitAt = 0, ffFlareAt = 0, ffSpawnAt = 0;
  G.playFireflyHit = (species) => {
    if (!G.config.sound) return;
    const now = performance.now();
    if (ffHitAt && now - ffHitAt < 70) return;      // 连击时不要变成机关枪
    ffHitAt = now;
    if (G.platform.sfx && G.platform.sfx(FF_HIT_V[species] || FF_HIT, 0.5)) return;
    // 回退：两层合成近似（主叮 + 低频落点）
    const v = FF_HIT_TONE[species] || [1040, 780, 0];
    tone("sine", v[0], v[1], 0.05, 0.26);
    if (v[2]) tone("sine", 150, 110, 0.07, 0.14);
    else tone("sine", 120, 80, 0.07, 0.10, 0.01);
  };
  G.playFireflyFlare = () => {
    if (!G.config.sound) return;
    const now = performance.now();
    if (ffFlareAt && now - ffFlareAt < 900) return;  // 五只同时张翅 = 一片沙沙声，限流
    ffFlareAt = now;
    if (G.platform.sfx && G.platform.sfx(FF_FLARE, 0.16)) return;
    tone("triangle", 2400, 3000, 0.05, 0.05);
  };
  /* Peppy Cat 式轻量移动提示：偶发短音，不铺持续旋律，避免盖住拍击反馈。 */
  G.playFireflyMove = (species) => {
    if (!G.config.sound) return;
    if (species === "rabbit") {
      if (G.playRabbitHopSfx) G.playRabbitHopSfx();
      else {
        tone("sine", 210, 105, 0.075, 0.055);
        tone("triangle", 690, 430, 0.045, 0.018, 0.035);
      }
    } else {
      tone("sine", 620, 980, 0.095, 0.022);
      tone("sine", 1240, 1560, 0.07, 0.009, 0.025);
    }
  };
  /* 出现/重生：视频里是一串极轻的 ~1kHz 小 ticks（1.9–3.3s 那一串），音量 0.24 */
  G.playFireflySpawn = () => {
    if (!G.config.sound) return;
    const now = performance.now();
    if (ffSpawnAt && now - ffSpawnAt < 260) return;      // 多只同时出现不要叠成一片
    ffSpawnAt = now;
    if (G.platform.sfx && G.platform.sfx(FF_SPAWN, 0.24)) return;
    tone("sine", 1200, 900, 0.03, 0.07);
  };
  /* 换关：柔和高亮 shimmer（配满屏金色火花 + 整屏交叉淡入） */
  G.playFireflyShift = () => {
    if (!G.config.sound) return;
    if (G.platform.sfx && G.platform.sfx(FF_SHIFT, 0.34)) return;
    tone("sine", 1050, 2100, 0.28, 0.10);
    tone("sine", 1560, 2600, 0.24, 0.07, 0.10);
  };
  G.preloadFireflySfx = () => {
    if (!G.platform.preloadSfx) return;
    [FF_HIT, FF_FLARE, FF_SPAWN, FF_SHIFT].concat(Object.keys(FF_HIT_V).map(k => FF_HIT_V[k]))
      .forEach(src => G.platform.preloadSfx(src));
  };

  /* 兔子跳步：参考视频里精确截取的两记轻响（0.125s）。
     视频里的轻响约 0.14–0.18s 一记；我们的 hop 周期约 0.18s，
     所以一次落地只播一声，两段素材交替使用，既有变化又不会叠成机关枪。
     音量从原来的 0.085/0.075 提到 0.32/0.29：旧音量在手机外放上几乎听不见。 */
  G.playRabbitHopSfx = () => {
    if (!G.config.sound) return;
    if (G.platform.sfx && G.platform.sfx(RABBIT_HOP, 0.32)) return;
    tone("sine", 210, 105, 0.075, 0.16);
    tone("triangle", 690, 430, 0.045, 0.05, 0.035);
  };
  G.playRabbitLandSfx = () => {
    if (!G.config.sound) return;
    if (G.platform.sfx && G.platform.sfx(RABBIT_LAND, 0.29)) return;
    tone("sine", 190, 95, 0.08, 0.14);
    tone("triangle", 620, 380, 0.05, 0.045, 0.025);
  };
  /* 一次落地一声：hop/land 两段素材交替；全局 110ms 限流，
     多只兔子同时跑时也只保留最近的一记，避免 3 只 × 5 次/s 叠成噪音。 */
  let rabbitStepAlt = false, rabbitStepAt = 0;
  G.playRabbitStepSfx = () => {
    if (!G.config.sound) return;
    const now = performance.now();
    if (rabbitStepAt && now - rabbitStepAt < 110) return;
    rabbitStepAt = now;
    rabbitStepAlt = !rabbitStepAlt;
    if (rabbitStepAlt) G.playRabbitHopSfx();
    else G.playRabbitLandSfx();
  };
  /* 兔子被拍中：低频 pop + 高频星爆 shimmer，0.45s；比跳步明显更响。 */
  let rabbitHitAt = 0;
  G.playRabbitHitSfx = (big) => {
    if (!G.config.sound) return;
    const now = performance.now();
    if (rabbitHitAt && now - rabbitHitAt < 80) return;
    rabbitHitAt = now;
    const vol = big ? 0.65 : 0.55;
    if (G.platform.sfx && G.platform.sfx(RABBIT_HIT, vol)) return;
    // 素材不可用时退回原有的短促命中音
    if (G.playFireflyHit) G.playFireflyHit("rabbit");
  };
  G.preloadRabbitVideoSfx = () => {
    if (!G.platform.preloadSfx) return;
    [RABBIT_HOP, RABBIT_LAND, RABBIT_HIT, LADYBUG_APPEAR].forEach(src => G.platform.preloadSfx(src));
  };
  /* 瓢虫出现：播放从参考视频 0.33s“瓢虫出现”处截取/降噪的轻响 */
  G.playLadybugAppearSfx = () => {
    if (!G.config.sound) return;
    if (G.platform.sfx && G.platform.sfx(LADYBUG_APPEAR, 0.06)) return;
    // 素材不可用时的合成兜底：极轻的高频振翅
    tone("sine", 1700, 2500, 0.12, 0.035);
    tone("triangle", 2400, 3200, 0.08, 0.018, 0.04);
  };
  /* 瓢虫：出现即开始循环，直到消失（点击/两回趟完成）才停。
     多只瓢虫共用一个循环，避免叠成一片。 */
  let ladybugLoop = null;
  G.ladybugLoopActive = false;
  G.stopLadybugLoop = () => {
    if (ladybugLoop) {
      try { ladybugLoop.stop(); } catch (e) {}
      ladybugLoop = null;
    }
    G.ladybugLoopActive = false;
  };
  G.updateLadybugLoop = () => {
    const S = G.session || {};
    const active = G.screen === "playing" && S.running && !S.paused && !S.counting &&
      G.preys && G.preys.some(p => p.type === "pool" && p.species === "ladybug" &&
        p.fade > 0.05 && !(p.vanishT > 0) && !(p.darkT > 0));
    if (active && !ladybugLoop) {
      ladybugLoop = G.platform.loopSfx ? G.platform.loopSfx(LADYBUG_APPEAR, 0.05) : null;
      G.ladybugLoopActive = !!ladybugLoop;
    } else if (!active && ladybugLoop) {
      G.stopLadybugLoop();
    }
  };
  G.playHit = (combo) => {
    const baseF = 480 + Math.min(combo || 0, 10) * 40;
    tone("sine", baseF, 150, 0.16, 0.32); tone("triangle", baseF * 2, 340, 0.1, 0.1);
  };
  /* 捕鼠室内房间：除老鼠叫声（出洞循环"唧唧" + 命中真实录音）外全部静音——
     拍偏、连击成就、倒计时提示音都不播。群鼠乱窜（swarm）与其它玩法不受影响。 */
  G.quietMouseRoom = () => G.config.targetType === "mouse" &&
    G.scene && G.scene.type === "mouse" &&
    (!G.scene.mouseBg || G.scene.mouseBg === "room");
  G.playMiss = () => { if (G.quietMouseRoom && G.quietMouseRoom()) return; tone("triangle", 150, 95, 0.09, 0.16); };
  G.playTick = () => tone("sine", 700, 0, 0.06, 0.14);
  G.playGo = () => { if (G.quietMouseRoom && G.quietMouseRoom()) return; tone("sine", 1046, 0, 0.2, 0.2); };
  G.playMilestone = () => {
    if (G.quietMouseRoom && G.quietMouseRoom()) return;
    tone("sine", 660, 0, 0.09, 0.18); tone("sine", 880, 0, 0.09, 0.18, 0.08); tone("sine", 1100, 0, 0.12, 0.18, 0.16);
  };
  /* 老鼠命中叫声：真实录音（用户提供的实拍视频 2.05–3.10s，连着 3 声"唧唧"，
     峰值已归一到 -3 dBFS）。素材不可用时退回原来的合成音。
     追击命中（double）只是播得更响一点——录音本身已连着 3 声，不用再叠一遍。 */
  const MOUSE_SQUEAK = "assets/sfx/mouse-squeak.wav";
  G.preloadMouseSfx = () => { if (G.platform.preloadSfx) G.platform.preloadSfx(MOUSE_SQUEAK); };
  G.playSqueak = (double) => {
    if (!G.config.sound) return;
    if (G.platform.sfx && G.platform.sfx(MOUSE_SQUEAK, double ? 0.62 : 0.5)) return;
    tone("square", 2900, 2100, 0.05, 0.09);
    tone("square", 3300, 2400, 0.05, 0.08, 0.07);
    if (double) tone("square", 3600, 2600, 0.06, 0.09, 0.14);
  };
  /* 老鼠出洞期间的循环“唧唧”声：只要有老鼠在 peek/dart 就一直叫，
     全部回洞后停止。多只老鼠共用一个声部并按数量略微加快，
     避免 6~8 个洞口各自起一个循环叠成噪音。
     音源与命中音同一段真实录音（连 3 声，约 1.05s）：每轮放一遍、
     轮间隔必须 ≥ 录音长度（sfx 池每次调用起新实例，叠了会混成一片）；
     出洞的鼠越多轮间隔越短，听感上就是“叫得更密”。素材不可用回退合成音。 */
  let mouseSqueakOn = false, mouseSqueakTimer = null, mouseSqueakN = 0;
  function mouseSqueakTick() {
    if (!mouseSqueakOn) return;
    if (!G.config.sound) { G.stopMouseSqueak(); return; }
    if (!(G.platform.sfx && G.platform.sfx(MOUSE_SQUEAK, 0.30))) {
      const f = 2300 + Math.random() * 900;
      tone("square", f, f * 0.72, 0.045, 0.055);
      tone("square", f * 1.16, f * 0.82, 0.040, 0.040, 0.060);
      if (Math.random() < 0.30) tone("square", f * 1.05, f * 0.80, 0.035, 0.032, 0.140);
    }
    const base = mouseSqueakN > 2 ? 1075 : mouseSqueakN > 1 ? 1120 : 1200;
    mouseSqueakTimer = setTimeout(mouseSqueakTick, base + Math.random() * 260);
  }
  G.stopMouseSqueak = () => {
    mouseSqueakOn = false;
    if (mouseSqueakTimer) { clearTimeout(mouseSqueakTimer); mouseSqueakTimer = null; }
  };
  // 测试/调试用：当前是否有老鼠循环声在播、当前出洞鼠数
  G.mouseSqueakActive = () => mouseSqueakOn;
  G.mouseSqueakCount = () => mouseSqueakN;
  G.updateMouseSqueak = () => {
    const S = G.session || {};
    const playing = G.screen === "playing" && S.running && !S.paused && !S.counting;
    let n = 0;
    if (playing && G.preys) {
      for (let i = 0; i < G.preys.length; i++) {
        const p = G.preys[i];
        if (p.type === "mouse" && (p.state === "peek" || p.state === "dart") &&
            (p.fade == null || p.fade > 0.5)) n++;
      }
    }
    mouseSqueakN = n;
    if (!G.config.sound || n === 0) { if (mouseSqueakOn) G.stopMouseSqueak(); return; }
    if (!mouseSqueakOn) { mouseSqueakOn = true; mouseSqueakTick(); }
  };
  G.playFlutter = () => {
    tone("triangle", 1900, 2400, 0.05, 0.07);
    tone("triangle", 2300, 1700, 0.05, 0.06, 0.05);
    tone("triangle", 2000, 2500, 0.05, 0.05, 0.1);
  };
  G.playZap = () => { tone("square", 880, 220, 0.08, 0.22); tone("sine", 1400, 300, 0.06, 0.1); };
  /* 激光命中：柔和水滴"啵"声（纯正弦、中低频、轻音量——不惊吓猫咪；
     无方波/锯齿等含刺耳谐波的波形）。hold 停驻命中加一颗更柔的八度内暖音 */
  G.playLaserHit = (hold) => {
    tone("sine", 880, 520, 0.13, 0.22);
    tone("triangle", 1180, 760, 0.09, 0.05);
    if (hold) tone("sine", 1046, 0, 0.14, 0.14, 0.05);
  };
  /* 鱼群命中：清脆 pop + 上行三连 sparkle（配彩虹纸屑特效） */
  G.playSchoolPop = () => {
    tone("sine", 760, 300, 0.1, 0.3);
    tone("triangle", 1560, 2100, 0.09, 0.14, 0.03);
    tone("sine", 2100, 2600, 0.1, 0.12, 0.09);
    tone("sine", 2640, 0, 0.12, 0.1, 0.16);
  };
  G.playBounce = () => tone("triangle", 520, 760, 0.05, 0.08);
  /* 青蛙跳音频：只有"蛙叫"，没有起跳音。
     - 落地：呱呱（双声，assets/sfx/frog-land.wav）
     - 静坐偶发：单声呱（两段轮播）
     素材由 tools/cut_frog_voice.py 从真实录音切出（22.05kHz 单声道 wav）。
     用 wav 而非 mp3：微信开发者工具处理 mp3 时会先转出同名 .wav 再读，某些版本这一步会失败并报
     `ENOENT ... frog-croak-2.wav`；短音效直接给 wav 就没有这层转换了。
     播放不了（旧基础库 / 无音频能力）时回落到合成音，保证每次都有反馈 */
  const FROG_CROAKS = ["assets/sfx/frog-croak-1.wav", "assets/sfx/frog-croak-2.wav"];
  const FROG_LAND = "assets/sfx/frog-land.wav";
  const FROG_HIT = "assets/sfx/frog-hit.wav";
  let croakI = 0, lastCroakAt = 0, lastLandAt = 0, lastHitAt = 0;
  G.playFrogCroak = () => {
    if (!G.config.sound) return;
    // 全场限流：满屏 5 只青蛙各叫各的会变成噪音，1.1 秒内只允许一声
    // （lastCroakAt=0 用来标记"还没叫过"：否则开局前 1.1 秒里的第一声会被误吞）
    const now = performance.now();
    if (lastCroakAt && now - lastCroakAt < 1100) return;
    lastCroakAt = now;
    const src = FROG_CROAKS[croakI++ % FROG_CROAKS.length];
    if (G.platform.sfx && G.platform.sfx(src, 0.40)) return;
    tone("sine", 420, 300, 0.16, 0.12);
    tone("triangle", 210, 160, 0.16, 0.05);
  };
  /* 落地"呱呱"：300ms 内只叫一次（多只同时落地不叠成一团），且不受静坐限流压制 */
  G.playFrogLandCroak = () => {
    if (!G.config.sound) return;
    const now = performance.now();
    if (lastLandAt && now - lastLandAt < 300) return;
    lastLandAt = now;
    lastCroakAt = now;
    if (G.platform.sfx && G.platform.sfx(FROG_LAND, 0.50)) return;
    tone("sine", 440, 320, 0.14, 0.12);
    tone("sine", 400, 290, 0.14, 0.1, 0.16);
  };
  /* 拍中时的"惊叫"：140ms 内只响一次（连击时不会变成机关枪） */
  G.playFrogHitCroak = () => {
    if (!G.config.sound) return;
    const now = performance.now();
    if (lastHitAt && now - lastHitAt < 140) return;
    lastHitAt = now;
    lastCroakAt = now;
    if (G.platform.sfx && G.platform.sfx(FROG_HIT, 0.55)) return;
    tone("sine", 480, 320, 0.12, 0.16);
  };
  G.preloadFrogVoices = () => {
    if (!G.platform.preloadSfx) return;
    FROG_CROAKS.concat([FROG_LAND, FROG_HIT]).forEach(src => G.platform.preloadSfx(src));
  };
  G.playFrogHit = (aerial) => {
    tone("sine", 2200, 1500, 0.06, 0.15);
    tone("sine", 720, 170, 0.13, 0.19, 0.02);
    if (aerial) tone("sine", 1320, 0, 0.14, 0.12, 0.07);
  };
  G.tierDrop = () => tone("sine", 520, 260, 0.22, 0.1);

  /* ================= 电子猫粮机：步进电机 + 粮粒落盆 =================
     真实喂食器的声音由三段叠成，这里按声学特征分别合成、由 feeder.js 按节奏触发：
       ① 电机：低转速直流/步进电机——锯齿波经低通（≈300Hz）的"嗡"，
          叠 7.5Hz 调幅（转一圈卡一下的齿槽感）；
       ② 推粮：螺旋杆磨粮——带通噪声（≈780Hz）的"沙沙"；
       ③ 粮粒：先擦过塑料滑道（闷、短、500~900Hz），100ms 后落进瓷盆
          （脆、带高频共振；盆里粮越多撞击越闷、共鸣越短——这是"落在一堆粮上"的关键特征）。 */
  let noiseBuf = null;
  function getNoise() {
    if (!actx) return null;
    if (noiseBuf) return noiseBuf;
    try {
      const n = Math.floor(actx.sampleRate * 0.6);
      const b = actx.createBuffer(1, n, actx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      noiseBuf = b;
    } catch (e) { noiseBuf = null; }
    return noiseBuf;
  }
  /* 一次性噪声爆发（带通 + 指数衰减包络）：颗粒撞击的基本单元 */
  function noiseBurst(t, o) {
    const buf = getNoise();
    if (!buf) return;
    try {
      const src = actx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = o.rate || 1;
      const bp = actx.createBiquadFilter();
      bp.type = o.type || "bandpass";
      bp.frequency.value = o.f || 1500;
      bp.Q.value = o.q || 1.6;
      const g = actx.createGain();
      const vol = Math.max(0.0008, o.vol || 0.08);
      const dec = o.dec || 0.05;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.002));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      src.connect(bp); bp.connect(g); g.connect(actx.destination);
      src.start(t, Math.random() * 0.35, dec + 0.06);
      src.stop(t + dec + 0.07);
    } catch (e) {}
  }
  /* 短共振（瓷盆/塑料盆被打一下的"叮"） */
  function ring(t, f, vol, dur) {
    try {
      const osc = actx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, t);
      const g = actx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0008, vol), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(actx.destination);
      osc.start(t); osc.stop(t + dur + 0.02);
    } catch (e) {}
  }
  /* 出粮全程的电机声（合成兜底：仅真实录音不可用时触发）
     启动时转速从高处跌落（150→88Hz），停机时失速下滑 + 齿轮复位两下“咔哒” */
  G.playFeederMotor = (dur) => {
    if (!G.config.sound) return;
    ensureAudio();
    if (!actx) return;
    try {
      const t0 = actx.currentTime + 0.01;
      const d = Math.max(0.25, Math.min(3.2, dur || 0.6));
      const osc = actx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, t0);
      osc.frequency.exponentialRampToValueAtTime(88, t0 + 0.09);   // 启动：空转高频快速跌入工作转速
      osc.frequency.linearRampToValueAtTime(78, t0 + Math.max(0.14, d - 0.12));
      osc.frequency.exponentialRampToValueAtTime(42, t0 + d);      // 停机：失速下滑
      const lp = actx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 380; lp.Q.value = 0.7;
      const g = actx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.07);
      g.gain.setValueAtTime(0.05, t0 + Math.max(0.1, d - 0.1));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.05);
      osc.connect(lp); lp.connect(g); g.connect(actx.destination);
      osc.start(t0); osc.stop(t0 + d + 0.08);
      // 齿槽抖动：7.5Hz 调幅（机械“一顿一顿”的手感）
      const lfo = actx.createOscillator();
      lfo.type = "sine"; lfo.frequency.value = 7.5;
      const lg = actx.createGain(); lg.gain.value = 0.016;
      lfo.connect(lg); lg.connect(g.gain);
      lfo.start(t0); lfo.stop(t0 + d + 0.08);
      // 推粮摩擦：带通噪声铺底
      const nb = getNoise();
      if (nb) {
        const src = actx.createBufferSource();
        src.buffer = nb; src.loop = true;
        const bp = actx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = 780; bp.Q.value = 0.9;
        const ng = actx.createGain();
        ng.gain.setValueAtTime(0.0001, t0);
        ng.gain.exponentialRampToValueAtTime(0.02, t0 + 0.08);
        ng.gain.setValueAtTime(0.02, t0 + Math.max(0.1, d - 0.1));
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        src.connect(bp); bp.connect(ng); ng.connect(actx.destination);
        src.start(t0); src.stop(t0 + d + 0.02);
      }
      // 停机后齿轮复位：两下闷“咔哒”，间隔不等才像机械
      noiseBurst(t0 + d + 0.10, { f: 260 + Math.random() * 60, q: 2.2, rate: 0.55, vol: 0.05, dec: 0.03, attack: 0.001 });
      noiseBurst(t0 + d + 0.19 + Math.random() * 0.05, { f: 200 + Math.random() * 50, q: 2.0, rate: 0.5, vol: 0.038, dec: 0.026, attack: 0.001 });
    } catch (e) {}
  };

  /* ================= 真实出粮音效（本地录音，取代合成电机声） =================
     ① feeder_real.mp3 —— 用户实拍出粮视频（猫粮.mp4）提取音轨：无需授权，首选
        处理：截取连续出粮段 3.1s、去首尾静音、首尾淡入淡出、-16 LUFS、96kbps 单声道
     ②③④ 备用录音（仅在首选加载失败时逐条尝试）——来自 Freesound，CC BY 4.0 需署名：
        feeder_kibbles.mp3   Bloomboi1《Kibbles》 https://freesound.org/s/762162/
        feeder_dispenser.mp3 designerschoice《Samsung Galaxy Cat Food Dispenser》 https://freesound.org/s/808834/
        feeder_long.mp3      Fred-o-saurus《Cat_feeder》 https://freesound.org/s/766521/
     全部不可用（未打进包等）时回落到合成电机声 G.playFeederMotor。 */
  const FEEDER_CLIPS = [
    "assets/audio/feeder_real.mp3",
    "assets/audio/feeder_kibbles.mp3",
    "assets/audio/feeder_dispenser.mp3",
    "assets/audio/feeder_long.mp3"
  ];
  let feederPool = null, feederLive = null;   // feederLive：正在播的那条，用于停止
  function feederAudioAt(i) {
    if (!feederPool) feederPool = [];
    if (feederPool[i] === undefined) {
      try {
        const a = wx.createInnerAudioContext();
        a.src = FEEDER_CLIPS[i];
        a.volume = 0.9;
        feederPool[i] = a;
      } catch (e) { feederPool[i] = false; }
    }
    return feederPool[i];
  }
  /* 按 FEEDER_CLIPS 顺序取：第 1 条是用户实拍，总会优先；加载失败自动顺延下一条 */
  G.playFeederDispense = () => {
    if (!G.config.sound) return;
    if (typeof wx === "undefined" || !wx.createInnerAudioContext) { G.playFeederMotor(0.8); return; }
    for (let i = 0; i < FEEDER_CLIPS.length; i++) {
      const a = feederAudioAt(i);
      if (a === false) continue;
      try {
        G.stopFeederSound();                       // 上一顿还在响先掐掉，不叠音
        feederLive = a;
        a.onError(() => {
          if (feederLive !== a) return;
          feederLive = null;
          feederPool[i] = false;                   // 这条废了，下次从下一条开始
          G.playFeederMotor(0.8);                  // 合成兜底，保证出粮永远有声
        });
        a.stop();
        a.play();
        return;
      } catch (e) { continue; }
    }
    G.playFeederMotor(0.8);
  };
  G.stopFeederSound = () => {
    const a = feederLive;
    feederLive = null;
    if (a) { try { a.stop(); } catch (e) {} }
  };
  /* 单颗粮落下：warm ∈ [0,1] = 盆里已堆的粮高度（越满 → 越闷、越不脆）
     因主声已换成真实出粮录音（本身就含落盆噼喷），这层只做轻点缀，音量压到一半，
     避免 40 声/秒的合成层把录音糊成一团。
     时序：滑道擦声即时（粮粒刚离口同段下行），落盆脆击 110ms 后（声音滞后于接触瞬间才真实），
     再加一声更轻的小反弹“嗒”（真机上粮从不只响一下） */
  G.playKibbleDrop = (warm) => {
    if (!G.config.sound || !actx) return;
    try {
      const t = actx.currentTime + 0.001;
      const w = Math.max(0, Math.min(1, warm || 0));
      // ① 擦过出粮滑道：闷响
      noiseBurst(t, { f: 520 + Math.random() * 380, q: 1.2, rate: 1.4,
        vol: 0.042 * (1 - w * 0.3), dec: 0.035 });
      // ② 落盆：脆击 + 瓷盆共振，粮堆越高越闷
      const dt = 0.11 + Math.random() * 0.02;
      noiseBurst(t + dt, { f: (2100 + Math.random() * 1400) * (1 - w * 0.3), q: 5.5, rate: 1.7,
        vol: 0.036 * (1 - w * 0.5), dec: 0.028 });
      ring(t + dt, (1250 + Math.random() * 900) * (1 - w * 0.28), 0.013 * (1 - w * 0.6), 0.07 + Math.random() * 0.05);
      // ③ 小反弹二次落地：随机延迟，永远比主击轻
      noiseBurst(t + dt + 0.05 + Math.random() * 0.06, {
        f: (1700 + Math.random() * 900) * (1 - w * 0.3), q: 4.5, rate: 1.5,
        vol: 0.013 * (1 - w * 0.5), dec: 0.022 });
    } catch (e) {}
  };
  /* ================= 猫吃粮：一口咔嚓 =================
     真实着嚼碎硬粮是“密集的小碎裂声”：几簇带通噪声爆点，由密到疏、由脆到闷，
     最后一颗咽下去时补一声略低的“啦”。点一次粮堆播一次，听着就知道粮被吃掉了。 */
  G.playEatCrunch = () => {
    if (!G.config.sound) return;
    ensureAudio();
    if (!actx) return;
    try {
      const t0 = actx.currentTime + 0.01;
      let t = 0;
      for (let i = 0; i < 6; i++) {
        t += 0.03 + Math.random() * 0.04;
        noiseBurst(t0 + t, {
          f: (1500 + Math.random() * 1600) * (1 - i * 0.09),
          q: 2.2 + Math.random() * 1.6,
          rate: 1.2 + Math.random() * 0.9,
          vol: 0.05 * (1 - i * 0.12),
          dec: 0.026 + Math.random() * 0.02
        });
      }
      ring(t0 + t + 0.05, 420 + Math.random() * 120, 0.018, 0.09);   // 咽下去的闷“啦”
    } catch (e) {}
  };
  /* 补粮（往储粮桶里倒粮）：连续的颗粒流 + 收尾几颗落底 */
  G.playHopperRefill = () => {
    if (!G.config.sound) return;
    ensureAudio();
    if (!actx) return;
    try {
      const t0 = actx.currentTime + 0.01;
      const nb = getNoise();
      if (nb) {
        const src = actx.createBufferSource();
        src.buffer = nb;
        const bp = actx.createBiquadFilter();
        bp.type = "bandpass"; bp.Q.value = 0.8;
        bp.frequency.setValueAtTime(900, t0);
        bp.frequency.linearRampToValueAtTime(1650, t0 + 0.5);
        const g = actx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.05);
        for (let i = 0; i < 6; i++) g.gain.linearRampToValueAtTime(0.035 + Math.random() * 0.055, t0 + 0.12 + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.78);
        src.connect(bp); bp.connect(g); g.connect(actx.destination);
        src.start(t0); src.stop(t0 + 0.82);
      }
      for (let i = 0; i < 4; i++)
        noiseBurst(t0 + 0.58 + Math.random() * 0.22, { f: 700 + Math.random() * 600, q: 1.4, vol: 0.045, dec: 0.03 });
    } catch (e) {}
  };
};
