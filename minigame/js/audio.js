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
    const kinds = G.CAT_KINDS || [];
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

  G.playHit = (combo) => {
    const baseF = 480 + Math.min(combo || 0, 10) * 40;
    tone("sine", baseF, 150, 0.16, 0.32); tone("triangle", baseF * 2, 340, 0.1, 0.1);
  };
  G.playMiss = () => tone("triangle", 150, 95, 0.09, 0.16);
  G.playTick = () => tone("sine", 700, 0, 0.06, 0.14);
  G.playGo = () => tone("sine", 1046, 0, 0.2, 0.2);
  G.playMilestone = () => { tone("sine", 660, 0, 0.09, 0.18); tone("sine", 880, 0, 0.09, 0.18, 0.08); tone("sine", 1100, 0, 0.12, 0.18, 0.16); };
  G.playSqueak = (double) => {
    tone("square", 2900, 2100, 0.05, 0.09);
    tone("square", 3300, 2400, 0.05, 0.08, 0.07);
    if (double) tone("square", 3600, 2600, 0.06, 0.09, 0.14);
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
  G.tierDrop = () => tone("sine", 520, 260, 0.22, 0.1);
};
