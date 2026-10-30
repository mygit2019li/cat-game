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
