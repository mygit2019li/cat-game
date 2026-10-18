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

  // 召唤猫咪：循环播放一段轻柔旋律（无需音频文件，纯振荡器合成）
  let summonTimer = null, summonStep = 0;
  const SUMMON = [523.25, 659.25, 783.99, 659.25, 587.33, 783.99, 880.0, 783.99, 659.25, 587.33];
  G.summonPlaying = false;
  G.startSummonMusic = () => {
    ensureAudio();
    if (!actx || !G.config.sound || summonTimer) return;
    summonStep = 0; G.summonPlaying = true;
    const stepMs = 280;
    const playStep = () => {
      const f = SUMMON[summonStep % SUMMON.length];
      tone("sine", f, f, 0.22, 0.16);
      tone("triangle", f * 1.5, f * 1.5, 0.16, 0.04);
      summonStep++;
      summonTimer = setTimeout(playStep, stepMs);
    };
    playStep();
  };
  G.stopSummonMusic = () => {
    if (summonTimer) { clearTimeout(summonTimer); summonTimer = null; }
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
  G.playBounce = () => tone("triangle", 520, 760, 0.05, 0.08);
  G.tierDrop = () => tone("sine", 520, 260, 0.22, 0.1);
};
