/* rank.js —— 好友排行榜「猎手分」计算、本地存档与关系链写入

   为什么要换掉旧的 bestHits：
     bestHits 是「单局最高捕获数」，直接比绝对值。玩 5 分钟、选群鼠、简单难度的人
     天然碾压玩 1 分钟、选激光、困难难度的人——榜单比的是设置，不是本事。

   猎手分公式：
     单局分 = round( min(HPM, 60) × 玩法系数 × 难度系数 × 完赛系数 )
     HPM    = 有效命中数 ÷ 实际游玩分钟（有效命中 = hits + bonusHits）
     榜单分 = 近 30 天内的最高单局分（滚动窗口，避免一次运气好就永久霸榜）

   防刷边界：
     · 实际游玩 < 30s 不计入（连点几下的短局不算成绩）
     · HPM 封顶 60（异常数据/脚本连点不会拉出天价分）
     · 中途「结束本局」×0.85（打满时长才拿满系数）
     · 无限模式按真实时长算 HPM，同样走封顶与完赛系数

   玩法系数来自猎物尺寸与速度的比值（speed / sqrt(area)），再做对数压缩。
   初版为经验值，集中在此表，后续有真实对局数据可整表回归校准，不改公式。
*/
module.exports = function (G) {
  const K_MODE = {
    butterfly: 0.65,   // 大、慢、会停在花瓣上
    mouse:     0.85,
    fish:      0.90,
    frog:      0.95,
    tadpole:   1.40,   // 小、折返快
    laser:     1.60,   // 54×54、速度 265
    pool:      1.60    // 彩星 66×66、速度 330
  };
  const K_DIFF = { easy: 1.0, normal: 1.15, hard: 1.3 };
  const MIN_SEC = 30;
  const MAX_HPM = 60;
  const WINDOW_MS = 30 * 24 * 3600 * 1000;
  const LS_KEY = "catToyRankBest";

  const num = (v) => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; };

  /* 纯函数：给一局结算数据，算猎手分。不读存储、不写存储，方便单测。 */
  G.computeRankScore = (o) => {
    const src = o || {};
    const hits = num(src.hits);
    const sec = num(src.playSec);
    const mode = K_MODE[src.type] ? src.type : "fish";
    const diff = K_DIFF[src.difficulty] ? src.difficulty : "easy";
    if (!hits || sec < MIN_SEC) {
      return { valid: false, score: 0, hpm: 0, reason: sec < MIN_SEC ? "too_short" : "no_hits" };
    }
    const rawHpm = hits * 60 / sec;
    const hpm = Math.min(MAX_HPM, rawHpm);
    const doneK = src.done ? 1 : 0.85;
    const score = Math.max(1, Math.round(hpm * K_MODE[mode] * K_DIFF[diff] * doneK));
    return {
      valid: true, score, hpm: Math.round(hpm * 10) / 10,
      mode, diff, done: !!src.done, capped: rawHpm > MAX_HPM
    };
  };

  /* 读本地最好成绩；超过 30 天窗口视作过期，返回空分。 */
  G.readRankBest = () => {
    let raw = null;
    try { raw = JSON.parse(G.platform.storage.get(LS_KEY) || "null"); } catch (e) { raw = null; }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const score = Math.floor(num(raw.score));
    const ts = Math.floor(num(raw.ts));
    if (!score || !ts || Date.now() - ts >= WINDOW_MS) return null;
    return {
      score, ts,
      hpm: num(raw.hpm),
      mode: K_MODE[raw.mode] ? raw.mode : "fish",
      diff: K_DIFF[raw.diff] ? raw.diff : "easy"
    };
  };

  /* 结算时调用：分数更高（或旧分已过期）才覆盖，并同步写入微信关系链 KV。
     写失败不影响游戏——好友榜下次打开会读到本地缓存之外的旧数据，但不该让结算崩。 */
  G.updateRankBest = (result, meta) => {
    if (!result || !result.valid || !result.score) return null;
    const prev = G.readRankBest();
    if (prev && prev.score >= result.score) return prev;
    const next = {
      score: Math.floor(result.score),
      ts: Date.now(),
      hpm: result.hpm || 0,
      mode: result.mode,
      diff: result.diff
    };
    try { G.platform.storage.set(LS_KEY, JSON.stringify(next)); } catch (e) {}
    try {
      if (G.platform.reportRank) G.platform.reportRank(next);
    } catch (e) {}
    /* 微信排行榜（MP 后台配置 + 好友超越服务通知）只认标准 wxgame 格式的另一个 key。
       同样只在刷新最高分时写，避免每局都覆盖 update_time 导致周期榜单判定异常。 */
    try {
      if (G.platform.reportOfficialRank) G.platform.reportOfficialRank(next.score, next.ts);
    } catch (e) {}
    return next;
  };

  /* 给开放数据域用的「我」的兜底分：读本地存档，空则返回 0。 */
  G.myRankScore = () => { const b = G.readRankBest(); return b ? b.score : 0; };

  G.RANK_WINDOW_MS = WINDOW_MS;
  G.RANK_MIN_SEC = MIN_SEC;
};
