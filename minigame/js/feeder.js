/* feeder.js — 电子猫粮机：定时定量 / 手动加餐
   视觉重点只有三样：往下掉的猫粮、猫盆、盆里堆起来的粮。
   三态：
     home  常态    —— 机器居中，机身正面一颗出粮键，左上角返回 + 设置两颗圆键（与首页同规格）
     modal 设置    —— 半透明遮罩 + 设置卡片（份数 / 间隔 / 补粮 / 清空）
     feed  出粮演出 —— 9:16 竖版舞台，两侧压暗，界面全部隐藏，点一下可跳过
   粮粒造型按真实比例做：一颗粮半径 5 个设计单位，盆口直径 152，约 1:15。 */
module.exports = function (G) {
  let ctx = G.platform.ctx;      // 渲染离屏缓存时会被临时替换，所以用 let
  const C = G.COLORS;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const hash = i => { const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453; return s - Math.floor(s); };
  const approach = (cur, tgt, step) => (cur < tgt ? Math.min(tgt, cur + step) : Math.max(tgt, cur - step));

  /* ================= 参数表 ================= */
  /* 一颗干粮约 0.2g，一份 4.5g ≈ 20 颗——按真实的量走，盆里才堆得出东西 */
  const TUNE = {
    portions: [1, 2, 3, 4, 5],
    intervals: [0.5, 1, 5, 30],      // 分钟（0.5 = 30 秒，便于当场看到定时生效）
    piecesPerPortion: 16,
    gramsPerPortion: 3.6,
    bowlCap: 86,                     // 盆放大后容量同比放大，86 颗 ≈ 堆到盆沿
    hopperCost: 1.6,                 // 每份消耗储粮百分比
    kibR: 6.0                        // 单颗粮半径（设计单位，随盆同比放大）
  };
  G.FEED = TUNE;

  /* ================= 设备设计空间（x ∈ [-99, 99]，y ∈ [0, 235]） ================= */
  /* 桶占比再收一档（高 69、宽 118），盆再放大一圈（口径 172）：
     整机的视觉重心彻底压到盆和粮堆上，桶只是上面的一截储粮筒 */
  const DH = {
    lidY: 0, lidH: 9,
    hopTop: 9, hopBot: 78, hopTopW: 118, hopBotW: 104,
    bodyY: 78, bodyH: 44, bodyW: 140,
    btnX: 27, btnY: 94, btnR: 9.8,
    ledX: -60, ledY: 104, ledR: 2.8,
    lcdX: -52, lcdY: 85, lcdW: 50, lcdH: 21,
    chuteY: 120, mouthY: 138,
    /* 猫盆参考 Petsuper 3L 款：浅口不锈钢碗嵌在白色托座里
       bowlFD = 盆底相对盆沿中心的落差（浅碗几乎平底）；colRX/colRY = 白色托座顶面椭圆 */
    bowlCY: 176, bowlFD: 2, bowlRX: 86, bowlRY: 30, inRX: 79, inRY: 25,
    colRX: 94, colRY: 33,
    bottomY: 226
  };

  /* 粮堆分层：底层铺满、往上逐层收窄，形成锥形堆（下密上疏） */
  const PILE_RX = 70, PILE_RY = 11;   // 粮堆铺在盆底上的范围（比盆口小一圈，才看得出是“堆”在盆里）
  const PILE = [
    { rf: 1.00, dy: 0, cap: 30 },
    { rf: 0.88, dy: -5.6, cap: 26 },
    { rf: 0.66, dy: -10.2, cap: 14 },
    { rf: 0.44, dy: -13.6, cap: 10 },
    { rf: 0.22, dy: -16.2, cap: 6 }
  ];
  /* 绘制顺序：远（y 小）的先画，近的后画，遮挡关系才是对的 */
  const DRAW_ORDER = (() => {
    const order = [];
    for (let i = 0; i < TUNE.bowlCap; i++) order.push(i);
    order.sort((a, b) => pileSlot(a).y - pileSlot(b).y);
    return order;
  })();

  function pileSlot(i) {
    let k = 0, j = i;
    while (k < PILE.length - 1 && j >= PILE[k].cap) { j -= PILE[k].cap; k++; }
    const L = PILE[k];
    const t = (j + 0.5) / L.cap;
    const rr = Math.sqrt(t) * L.rf;
    const a = j * 2.399963 + k * 1.27;          // 黄金角，撒得自然不排队
    return {
      x: Math.cos(a) * rr * PILE_RX,
      y: DH.bowlCY + DH.bowlFD + 3 + Math.sin(a) * rr * PILE_RY + L.dy,
      k
    };
  }

  /* ================= 运行时状态 ================= */
  const F = G.feeder = {
    t: 0,
    mode: "home",        // home | modal | feed
    e: 0,                // 过渡进度：0 常态 / 1 演出
    pressT: 0,           // 机身键按下动画
    errT: 0,             // 键抖动（缺粮 / 盆满）
    pellets: [],         // 空中粮粒（设备坐标）
    spawnLeft: 0,        // 本轮还没吐出的颗数
    spawnAcc: 0,
    dispensing: 0,       // 电机转动剩余时间
    dispTotal: 0,
    holdT: 0,            // 落完后停留
    skip: false,
    aug: 0,              // 绞龙相位（出粮时滑道里的粮随它转动）
    dust: [],            // 落盆扬尘
    bites: [],           // 被“吃掉”的粮粒（上扬淡出）
    eatPulse: 0,         // 粮堆被吃时的下压回弹
    eatTip: false,       // 是否已提示过“点粮可以喂猫”
    hint: "", hintT: 0,
    dirtyAt: 0,
    cam: { ox: 0, oy: 0, s: 1 }
  };

  const cfg = () => G.config;
  const nowMs = () => Date.now();
  const portion = () => clamp(Math.round(Number(cfg().feedPortion) || 3), 1, 5);
  const intervalMs = () => clamp(Number(cfg().feedIntervalMin) || 1, 0.5, 30) * 60000;
  const flying = () => F.pellets.length + F.spawnLeft;

  function hint(s, dur) { F.hint = s; F.hintT = dur || 1.8; }

  /* ================= 定时器 =================
     只在本页推进；离开本页期间靠 feedNextAt 记绝对时刻，回页时补发（最多 2 顿）。 */
  function anchorTimer() {
    const c = cfg();
    c.feedNextAt = c.feedMode === "timer" ? nowMs() + intervalMs() : 0;
    G.saveConfig();
  }
  function tickTimer() {
    const c = cfg();
    if (c.feedMode !== "timer") return;
    if (!(c.feedNextAt > 0)) { c.feedNextAt = nowMs() + intervalMs(); G.saveConfig(); return; }
    let guard = 0, fed = 0;
    while (nowMs() >= c.feedNextAt && guard++ < 2) {
      if (dispense(true)) fed++;
      c.feedNextAt += intervalMs();
    }
    if (guard >= 2 && nowMs() >= c.feedNextAt) c.feedNextAt = nowMs() + intervalMs();
    if (guard > 0) G.saveConfig();
    if (fed > 1) hint("离开期间到了饭点，已补发 " + fed + " 顿", 2.6);
  }

  /* ================= 出粮 ================= */
  function dispense(auto) {
    const c = cfg();
    if (F.mode === "modal") return false;
    if (c.feedHopper <= 0.4) { hint("储粮桶空了，先补粮"); G.playMiss(); F.errT = 0.42; return false; }
    const room = TUNE.bowlCap - (c.feedBowl + flying());
    if (room <= 0) { hint("食盆堆满了，先清空再出粮"); G.playMiss(); F.errT = 0.42; return false; }
    const want = portion() * TUNE.piecesPerPortion;
    const pieces = Math.min(want, room);
    const parts = pieces / TUNE.piecesPerPortion;

    c.feedHopper = Math.max(0, c.feedHopper - parts * TUNE.hopperCost);
    F.spawnLeft += pieces;
    F.spawnAcc = 0;
    F.dispensing = Math.max(F.dispensing, 0.34 + pieces * 0.055);
    F.dispTotal = F.dispensing;
    F.holdT = 0;
    F.skip = false;
    F.mode = "feed";                       // 手动、定时一律进演出
    try { G.playFeederDispense(); } catch (e) {}   // 真实录音优先，失败自动回落合成电机声
    hint((auto ? "定时出粮 " : "出粮 ") + (Math.round(parts * 10) / 10) + " 份", 1.5);
    try { G.track("feeder_feed", { auto: auto ? 1 : 0, n: Math.round(parts * 10) / 10, mode: c.feedMode, bowl: c.feedBowl }); } catch (e) {}
    G.saveConfig();
    return true;
  }
  G.feederDispense = () => dispense(false);

  function clearBowl() {
    const c = cfg();
    if (c.feedBowl <= 0 && !flying()) { hint("食盆是空的"); return; }
    c.feedBowl = 0;
    F.pellets.length = 0;
    F.spawnLeft = 0;
    F.bites.length = 0;
    hint("食盆已清空（猫吃完了）");
    G.saveConfig();
  }
  function refill() {
    cfg().feedHopper = 100;
    try { G.playHopperRefill(); } catch (e) {}
    hint("储粮桶已补满");
    G.saveConfig();
  }

  /* ================= 镜头 ================= */
  function layout() {
    const S = G.platform.S || 1;
    const W = G.platform.W / S, H = G.platform.H / S;
    const sf = G.platform.safe || { top: 0, bottom: 0, left: 0, right: 0 };
    const safe = {
      top: (sf.top || 0) / S, bottom: (sf.bottom || 0) / S,
      left: (sf.left || 0) / S, right: (sf.right || 0) / S
    };
    return { W, H, safe };
  }
  function camHome(L) {
    /* 底部那行状态文字已经去掉，机器可以直接站到底边：竖向只留给 toast 一行高，
       横向把左右预留从 28 收到 20（托座是全机最宽处，留 20 已经够呼吸）——盆随之整体变大一圈 */
    const availH = L.H - L.safe.top - L.safe.bottom - 34;
    const s = clamp(Math.min(availH / DH.bottomY, (L.W - 40) / (DH.colRX * 2 + 8)), 0.5, 2.6);
    return { ox: L.W / 2, oy: L.safe.top + 6 + Math.max(0, (availH - DH.bottomY * s) / 2), s };
  }
  function stageRect(L) {
    const topPad = 42;                       // 顶部留出「出粮 N 份」提示的位置
    const availH = L.H - L.safe.top - L.safe.bottom - topPad - 8;
    let h = availH, w = h * 0.75;          // 3:4 竖版：9:16 会把机器压成一条窄带，粮粒看不清
    const maxW = L.W * (L.W > L.H ? 0.5 : 0.84);   // 竖屏兜底时舞台可以更宽
    if (w > maxW) { w = maxW; h = w / 0.75; }
    const x = (L.W - w) / 2;
    const y = L.safe.top + topPad + Math.max(0, (L.H - L.safe.top - L.safe.bottom - topPad - 8 - h) / 2);
    return { x, y, w, h, cx: L.W / 2, cy: y + h / 2 };
  }
  /* 演出镜头：盆铺满舞台宽度做近景，整机在舞台内垂直居中 */
  function camFeed(st) {
    const s = Math.min(st.w * 0.94 / (DH.colRX * 2), st.h / DH.bottomY);
    const oy = st.y + Math.max(0, (st.h - DH.bottomY * s) / 2);
    return { ox: st.cx, oy, s };
  }

  /* ================= 绘制小工具 ================= */
  function roundPath(x, y, w, h, r) {
    const rad = Math.min(r, Math.min(w, h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
  const text = (s, x, y, font, color, align) => G.ui.text(s, x, y, font, color, align);

  function pill(x, y, w, h, label, o) {
    const opt = o || {};
    const on = !!opt.on, pr = !!opt.primary;
    ctx.save();
    if (pr || on) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, pr ? C.startGrad0 : "#2ec4aa");
      g.addColorStop(1, pr ? C.startGrad1 : "#0d6b7d");
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = opt.fill || C.segBg;
    }
    roundPath(x, y, w, h, opt.r != null ? opt.r : 11);
    ctx.fill();
    if (!pr && !on && opt.stroke !== false) {
      ctx.strokeStyle = opt.strokeColor || C.line; ctx.lineWidth = 1;
      roundPath(x, y, w, h, opt.r != null ? opt.r : 11); ctx.stroke();
    }
    const fs = opt.font || clamp(Math.round(h * 0.44), 10, 16);
    const col = (pr || on) ? "#fff" : (opt.color || C.ink2);
    text(label, x + w / 2, y + h / 2 + 0.5, (pr || on ? "bold " : "") + fs + "px sans-serif", col);
    ctx.restore();
    if (opt.cb && opt.key !== false) G.ui.buttons.push({ x, y, w, h, cb: opt.cb, key: opt.key || "" });
  }

  /* ================= 粮粒：圆片 + 厚度 + 高光 ================= */
  const KIB_BODY = ["#e8c084", "#d9a962", "#c4904a"];
  const KIB_WALL = ["#c79a55", "#b3823c", "#9a6a2e"];
  const mixCache = {};
  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    const A = hex2rgb(a), B = hex2rgb(b);
    return "rgb(" + Math.round(A[0] + (B[0] - A[0]) * t) + "," +
      Math.round(A[1] + (B[1] - A[1]) * t) + "," +
      Math.round(A[2] + (B[2] - A[2]) * t) + ")";
  }
  /* 深度调色：k<1 压暗（盆底/下层），k>1 提亮。量化到 1/8 档并缓存，避免每帧拼字符串 */
  function tone(hex, k) {
    const q = Math.round(clamp(k, 0.5, 1.2) * 8);
    const key = hex + q;
    if (mixCache[key]) return mixCache[key];
    const v = q < 8 ? mix(hex, "#6f4413", (8 - q) / 8 * 0.55) : mix(hex, "#fff3da", (q - 8) / 8 * 0.5);
    mixCache[key] = v;
    return v;
  }

  /* 一颗猫粮：侧壁（厚度）→ 主体 → 接触暗面 → 左上高光 → 压痕 */
  function kibble(x, y, rot, s, lit, seed) {
    const r = TUNE.kibR * s, ry = r * 0.72;
    const pick = seed == null ? 1 : (hash(seed * 5.1) < 0.34 ? 0 : hash(seed * 5.1) < 0.68 ? 1 : 2);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = tone(KIB_WALL[pick], lit * 0.92);
    ctx.beginPath(); ctx.ellipse(0, r * 0.26, r, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = tone(KIB_BODY[pick], lit);
    ctx.beginPath(); ctx.ellipse(0, 0, r, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(92,52,14,.15)";
    ctx.beginPath(); ctx.ellipse(0, ry * 0.46, r * 0.78, ry * 0.42, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,242,214,.55)";
    ctx.beginPath(); ctx.ellipse(-r * 0.30, -ry * 0.34, r * 0.33, ry * 0.30, -0.35, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(96,56,18,.18)"; ctx.lineWidth = Math.max(0.45, r * 0.10);
    ctx.beginPath(); ctx.moveTo(-r * 0.44, -ry * 0.06); ctx.quadraticCurveTo(0, ry * 0.55, r * 0.44, -ry * 0.06); ctx.stroke();
    ctx.restore();
  }

  /* ================= 冻干：比猫粮大一圈的浅米色方块 ================= */
  /* 冻干混在粮里，一眼能认出来靠两件事：颜色比猫粮浅一号（米白）、形状是方圆块而不是圆片。
     四角带一点歪，才像冻干碎的块，而不是码好的方糖。 */
  const FD_COL = ["#e8dcc0", "#e0d2b0", "#d6c6a1"];
  const FD_TOP = ["#f4eddd", "#efe8d5", "#e9e1cb"];   // 顶面受光，比正面亮一档
  const FD_DARK = ["#bfa780", "#b79e77", "#ad946b"];
  const FD_RATE = 0.10;                        // 一堆粮里大约十颗混一块冻干
  function isFreezeDry(i) { return hash(i * 9.17 + 4.3) < FD_RATE; }
  function fdPath(hw, hh, dy, w) {
    const r = hw * 0.36;
    ctx.beginPath();
    ctx.moveTo(-hw + r, -hh + dy);
    ctx.quadraticCurveTo(0, -hh + dy - w, hw - r, -hh + dy);
    ctx.quadraticCurveTo(hw, -hh + dy, hw, -hh + dy + r);
    ctx.quadraticCurveTo(hw + w, 0, hw, hh + dy - r);
    ctx.quadraticCurveTo(hw, hh + dy, hw - r, hh + dy);
    ctx.quadraticCurveTo(0, hh + dy + w, -hw + r, hh + dy);
    ctx.quadraticCurveTo(-hw, hh + dy, -hw, hh + dy - r);
    ctx.quadraticCurveTo(-hw - w, 0, -hw, -hh + dy + r);
    ctx.quadraticCurveTo(-hw, -hh + dy, -hw + r, -hh + dy);
    ctx.closePath();
  }
  /* 一块冻干：亮顶面 → 暗侧壁 → 正面 → 左上高光/右下暗面 → 酥孔 */
  function freezeDry(x, y, rot, s, lit, seed) {
    const hw = TUNE.kibR * 1.22 * s, hh = hw * 0.94;
    const sd = seed == null ? 1 : seed;
    const w = (hash(sd * 6.1) - 0.5) * hw * 0.30;      // 每块歪一点
    const pick = hash(sd * 2.9) < 0.4 ? 0 : hash(sd * 2.9) < 0.75 ? 1 : 2;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    // 上下错开两张面：露出来的边就是顶面与侧壁，冻干才是个立方体而不像一张纸
    ctx.fillStyle = tone(FD_TOP[pick], lit * 1.02);
    fdPath(hw * 0.99, hh * 0.99, -hw * 0.26, w);
    ctx.fill();
    ctx.fillStyle = tone(FD_DARK[pick], lit * 0.9);
    fdPath(hw * 0.98, hh * 0.98, hw * 0.22, w);
    ctx.fill();
    ctx.fillStyle = tone(FD_COL[pick], lit);
    fdPath(hw, hh, 0, w);
    ctx.fill();
    ctx.save();
    fdPath(hw, hh, 0, w); ctx.clip();
    const g = ctx.createLinearGradient(-hw * 0.6, -hh, hw * 0.5, hh);
    g.addColorStop(0, "rgba(255,255,255,.26)");
    g.addColorStop(0.46, "rgba(255,255,255,0)");
    g.addColorStop(0.74, "rgba(150,116,70,.12)");
    g.addColorStop(1, "rgba(128,94,52,.26)");
    ctx.fillStyle = g;
    ctx.fillRect(-hw * 1.2, -hh * 1.5, hw * 2.4, hh * 3);
    // 冻干表面是酥的：两颗小孔
    ctx.fillStyle = "rgba(150,116,70,.20)";
    ctx.beginPath(); ctx.arc(-hw * 0.24, hh * 0.16, hw * 0.17, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(hw * 0.32, -hh * 0.24, hw * 0.12, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* ================= 离屏缓存 =================
     粮堆和桶内粮食都是"只在数量变化时才变"的静态图，一帧画四百个椭圆会拖帧。
     缓存成离屏画布，平时一个 drawImage 搞定，只有落一颗粮才重画一次。 */
  const CACHE_S = 3.5;
  const CACHE = { bin: null, binKey: null, pile: null, pileKey: null, ok: true };
  function ensureCache(slot, key, rect, paint) {
    if (!CACHE.ok) { paint(); return false; }
    if (CACHE[slot] && CACHE[slot + "Key"] === key) return true;
    try {
      let cv = CACHE[slot];
      if (!cv) {
        cv = wx.createCanvas();
        cv.width = Math.ceil(rect.w * CACHE_S);
        cv.height = Math.ceil(rect.h * CACHE_S);
        CACHE[slot] = cv;
      }
      const c2 = cv.getContext("2d");
      c2.setTransform(1, 0, 0, 1, 0, 0);
      c2.clearRect(0, 0, cv.width, cv.height);
      c2.setTransform(CACHE_S, 0, 0, CACHE_S, -rect.x * CACHE_S, -rect.y * CACHE_S);
      const prev = ctx;
      ctx = c2;
      try { paint(); } finally { ctx = prev; }
      CACHE[slot + "Key"] = key;
      return true;
    } catch (e) {
      CACHE.ok = false;          // 离屏画布不可用就退回直绘，绝不因为缓存挂掉整页
      paint();
      return false;
    }
  }

  /* ================= 粮堆 ================= */
  const PILE_RECT = { x: -79, y: 154, w: 158, h: 48 };
  function paintPile(n) {
    const t = n / TUNE.bowlCap;
    // 堆底软阴影：堆越大越深越大，颗粒才不会"发飘"
    ctx.fillStyle = "rgba(88,56,18," + (0.10 + t * 0.16).toFixed(3) + ")";
    ctx.beginPath();
    ctx.ellipse(0, DH.bowlCY + DH.bowlFD + 7, PILE_RX * (0.4 + t * 0.6), 4 + t * 4, 0, 0, TAU);
    ctx.fill();
    for (let oi = 0; oi < n; oi++) {
      const i = DRAW_ORDER[oi];
      const p = pileSlot(i);
      const h1 = hash(i * 3.7 + 1.3);
      // 底层压在盆里偏暗，越往上越亮
      const lit = 0.72 + p.k * 0.06 + h1 * 0.14;
      const rot = hash(i * 1.7) * TAU;
      const sc = 0.86 + h1 * 0.3;
      // 冻干比猫粮大一圈，摆上去会往上鼓一点
      if (isFreezeDry(i)) freezeDry(p.x, p.y - 1.4 * sc, rot, sc, lit + 0.04, i);
      else kibble(p.x, p.y, rot, sc, lit, i);
    }
  }
  function drawPile(count) {
    const n = Math.min(count, TUNE.bowlCap);
    if (n <= 0) return;
    if (ensureCache("pile", n, PILE_RECT, () => paintPile(n))) {
      ctx.drawImage(CACHE.pile, PILE_RECT.x, PILE_RECT.y, PILE_RECT.w, PILE_RECT.h);
    }
  }

  /* ================= 猫盆：浅口不锈钢碗 + 白色托座（参考 Petsuper 3L 款） ================= */
  /* 参考图里能看清的只有三样：白色托座、一圈薄亮的金属盆沿、碗内壁的暗面。
     碗的外壁几乎全被托座包住，所以只画盆沿和碗内——多画一段外壁就成了浅碟子。 */
  /* 不锈钢只靠两笔立住：沿口上一道镜面高光、沿口外一条细暗线，其余全靠渐变 */
  const STEEL = {
    spec: "rgba(255,255,255,.96)", edge: "rgba(48,60,66,.60)"
  };

  /* 白色托座：底座往前伸出一圈碗窝，碗坐进去、四周留一圈白，碗底也就自然落了地 */
  function collarPath() {
    const cy = DH.bowlCY, RX = DH.colRX, RY = DH.colRY, by = DH.bottomY;
    const rr = 10;
    ctx.beginPath();
    ctx.ellipse(0, cy, RX, RY, 0, Math.PI, 0, false);          // 远侧半圈贴着碗沿走
    ctx.lineTo(RX, by - rr);                                  // 侧壁直立，不要鼓一圈
    ctx.quadraticCurveTo(RX, by, RX - rr, by);                // 右前小圆角落地
    ctx.quadraticCurveTo(0, by + 5, -RX + rr, by);
    ctx.quadraticCurveTo(-RX, by, -RX, by - rr);
    ctx.closePath();
  }

  function drawCollar() {
    const cy = DH.bowlCY, RX = DH.bowlRX, k = RX / 76;
    // 落地阴影
    ctx.fillStyle = "rgba(20,49,58,.13)";
    ctx.beginPath(); ctx.ellipse(0, DH.bottomY - 0.5, DH.colRX * 1.01, 10 * k, 0, 0, TAU); ctx.fill();

    // 托座本体：越往下越沉
    collarPath();
    const g = ctx.createLinearGradient(0, cy - DH.colRY, 0, DH.bottomY + 4);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.34, "#f5f9f8");
    g.addColorStop(0.72, "#e4ebe8");
    g.addColorStop(1, "#ccd8d5");
    ctx.fillStyle = g; ctx.fill();

    ctx.save();
    collarPath(); ctx.clip();
    // 柱面明暗：仍是左侧迎光、右侧转暗，但托座是白塑，反差要比金属弱得多
    const hg = ctx.createLinearGradient(-DH.colRX, 0, DH.colRX, 0);
    hg.addColorStop(0, "rgba(88,116,110,.13)");
    hg.addColorStop(0.16, "rgba(255,255,255,.45)");
    hg.addColorStop(0.44, "rgba(255,255,255,0)");
    hg.addColorStop(0.86, "rgba(86,114,108,.09)");
    hg.addColorStop(1, "rgba(70,98,92,.18)");
    ctx.fillStyle = hg;
    ctx.fillRect(-DH.colRX, cy - DH.colRY, DH.colRX * 2, DH.bottomY - cy + DH.colRY + 6);

    // 顶面朝上受光，比前帮亮一档
    ctx.beginPath(); ctx.ellipse(0, cy, DH.colRX, DH.colRY, 0, 0, TAU);
    const tg = ctx.createLinearGradient(0, cy - DH.colRY, 0, cy + DH.colRY);
    tg.addColorStop(0, "#ffffff");
    tg.addColorStop(0.62, "#fdfefe");
    tg.addColorStop(1, "#eef3f1");
    ctx.fillStyle = tg; ctx.fill();
    // 顶面后缘一道极淡收边（托座边缘才立得住）
    ctx.strokeStyle = "rgba(146,172,166,.40)"; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.ellipse(0, cy, DH.colRX, DH.colRY, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
    ctx.restore();
  }

  function drawBowl(count) {
    const cy = DH.bowlCY, RX = DH.bowlRX, RY = DH.bowlRY, ix = DH.inRX, iy = DH.inRY;
    const k = RX / 76;

    drawCollar();

    // ① 碗窝：盆沿外面一圈下沉的暗环，碗才是「坐」进去的
    ctx.beginPath();
    ctx.ellipse(0, cy, RX + 4 * k, RY + 2.8 * k, 0, 0, TAU);
    ctx.ellipse(0, cy, RX, RY, 0, TAU, 0, true);
    ctx.fillStyle = "rgba(40,62,58,.30)";
    ctx.fill();

    // ② 盆沿：一圈薄亮的金属边——参考图里最认得出的就是这一圈
    ctx.beginPath();
    ctx.ellipse(0, cy, RX, RY, 0, 0, TAU);
    ctx.ellipse(0, cy, ix, iy, 0, TAU, 0, true);
    const ringG = ctx.createLinearGradient(0, cy - RY, 0, cy + RY);
    ringG.addColorStop(0, "#eef4f6");
    ringG.addColorStop(0.30, "#d8e1e4");
    ringG.addColorStop(0.58, "#b6c2c7");
    ringG.addColorStop(0.82, "#97a4aa");
    ringG.addColorStop(1, "#7c888f");
    ctx.fillStyle = ringG; ctx.fill();
    // 沿口外缘细暗线
    ctx.strokeStyle = STEEL.edge; ctx.lineWidth = 0.8 * k;
    ctx.beginPath(); ctx.ellipse(0, cy, RX, RY, 0, 0, TAU); ctx.stroke();
    // 左上一段镜面高光：不锈钢最认得出的一笔
    const mrX = (RX + ix) / 2, mrY = (RY + iy) / 2;
    ctx.strokeStyle = STEEL.spec; ctx.lineWidth = 1.7 * k; ctx.lineCap = "round";
    ctx.beginPath(); ctx.ellipse(0, cy, mrX, mrY, 0, Math.PI * 1.06, Math.PI * 1.76); ctx.stroke();
    // 沿下一道弱反光（金属的厚）
    ctx.strokeStyle = "rgba(255,255,255,.40)"; ctx.lineWidth = 1 * k;
    ctx.beginPath(); ctx.ellipse(0, cy, mrX, mrY, 0, Math.PI * 0.62, Math.PI * 0.86); ctx.stroke();

    /* ③ 碗内：全部裁到盆口椭圆里。浅口碗的深度不靠碗壁高度，
       靠盆沿内侧一道暗、盆底一圈亮、近壁一路压暗——落差全在明暗上。 */
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, cy, ix, iy, 0, 0, TAU);
    ctx.clip();

    const floorY = cy + DH.bowlFD;
    // 内壁：远壁上沿被盆沿挡住光最暗，往下到中段是一道宽镜面反光，靠盆口一侧的近壁又压下去
    const ig = ctx.createLinearGradient(0, cy - iy, 0, cy + iy);
    ig.addColorStop(0, "#3d484f");
    ig.addColorStop(0.09, "#657179");
    ig.addColorStop(0.17, "#a6b1b7");
    ig.addColorStop(0.24, "#c9d2d6");          // 远壁那道宽镜面反光（参考图最认得出的一笔）
    ig.addColorStop(0.30, "#8d989f");
    ig.addColorStop(0.46, "#7a868d");
    ig.addColorStop(0.66, "#68747b");
    ig.addColorStop(0.86, "#535f66");
    ig.addColorStop(1, "#414c53");             // 近壁背光，最暗
    ctx.fillStyle = ig; ctx.fillRect(-ix, cy - iy, ix * 2, iy * 2);
    // 柱面明暗：左亮右沉
    const iw = ctx.createLinearGradient(-ix, 0, ix, 0);
    iw.addColorStop(0, "rgba(30,42,48,.18)");
    iw.addColorStop(0.20, "rgba(255,255,255,.18)");
    iw.addColorStop(0.54, "rgba(255,255,255,0)");
    iw.addColorStop(1, "rgba(26,38,44,.24)");
    ctx.fillStyle = iw; ctx.fillRect(-ix, cy - iy, ix * 2, iy * 2);

    // 盆底：后缘接住远壁的反光最亮，往近处一路沉下去，盆底才“凹”进去
    const fRX = ix * 0.78, fRY = iy * 0.56;
    const fg = ctx.createLinearGradient(0, floorY - fRY, 0, floorY + fRY);
    fg.addColorStop(0, "#a2abb0");
    fg.addColorStop(0.26, "#869097");
    fg.addColorStop(0.68, "#6e7b81");
    fg.addColorStop(1, "#57636a");
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.ellipse(0, floorY, fRX, fRY, 0, 0, TAU); ctx.fill();
    // 远壁与盆底的交界：金属在这里折出一道细亮线，再压一道暗缝
    ctx.strokeStyle = "rgba(255,255,255,.30)"; ctx.lineWidth = 1.6 * k;
    ctx.beginPath(); ctx.ellipse(0, floorY, fRX, fRY, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
    ctx.strokeStyle = "rgba(34,46,52,.26)"; ctx.lineWidth = 1.3 * k;
    ctx.beginPath(); ctx.ellipse(0, floorY - 1.3 * k, fRX, fRY, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
    // 盆底前缘与近壁的接缝（一条淡暗线，别让两块面糊在一起）
    ctx.strokeStyle = "rgba(30,42,48,.20)"; ctx.lineWidth = 1.4 * k;
    ctx.beginPath(); ctx.ellipse(0, floorY, fRX, fRY, 0, 0.10, Math.PI - 0.10); ctx.stroke();
    // 横贯盆底的窗光反射带（不锈钢最能认的特征）
    const band = ctx.createLinearGradient(0, floorY - fRY * 0.95, 0, floorY + fRY * 0.35);
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(0.42, "rgba(255,255,255,.15)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = band;
    ctx.fillRect(-ix, floorY - fRY * 0.95, ix * 2, fRY * 1.3);
    // 近壁弧面反光：最亮的一条贴着盆口内缘（参考图里近壁只有一线亮）
    ctx.strokeStyle = "rgba(255,255,255,.16)"; ctx.lineWidth = 1.8 * k;
    ctx.beginPath(); ctx.ellipse(0, cy, ix - 1.6 * k, iy - 1.4 * k, 0, 0.34, Math.PI - 0.34); ctx.stroke();
    // 沿内一圈接触暗影：盆沿悬在碗内壁上，这一圈黑才让盆沿“厚”起来
    ctx.strokeStyle = "rgba(32,44,50,.22)"; ctx.lineWidth = 2.2 * k;
    ctx.beginPath(); ctx.ellipse(0, cy, ix - 1.2 * k, iy - 1.2 * k, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
    // 粮粒反过来的暖色映在不锈钢上（参考图里碗内偏糯色，不是冷灰）
    const warm = ctx.createLinearGradient(0, cy - iy * 0.3, 0, cy + iy);
    warm.addColorStop(0, "rgba(154,106,58,0)");
    warm.addColorStop(0.55, "rgba(152,104,56,.05)");
    warm.addColorStop(1, "rgba(150,102,56,.11)");
    ctx.fillStyle = warm;
    ctx.beginPath(); ctx.ellipse(0, cy, ix, iy, 0, 0, TAU); ctx.fill();

    // 粮堆（同一裁剪内，前侧多余的颗粒被碗沿挡住，不会溢出盆外）
    if (F.eatPulse > 0.01) {
      const base = DH.bowlCY + DH.bowlFD;
      ctx.save();
      ctx.translate(0, base);
      ctx.scale(1 + F.eatPulse * 0.05, 1 - F.eatPulse * 0.16);
      ctx.translate(0, -base);
      drawPile(count);
      ctx.restore();
    } else {
      drawPile(count);
    }
    ctx.restore();                             // 结束碗内裁剪

    // ④ 近侧盆沿压在粮堆上：粮才像「躺在碗里」，而不是浮在盆上
    // 沿内一圈接触暗影（粮堆与盆沿之间）
    ctx.strokeStyle = "rgba(30,42,48,.22)"; ctx.lineWidth = 1.6 * k;
    ctx.beginPath(); ctx.ellipse(0, cy, ix - 2.4 * k, iy - 2.4 * k, 0, 0.26, Math.PI - 0.26); ctx.stroke();
    // 金属沿口压在最上层的一道亮线（压在粮堆上，粮才像在碗里）
    ctx.strokeStyle = "rgba(255,255,255,.42)"; ctx.lineWidth = 1.4 * k;
    ctx.beginPath(); ctx.ellipse(0, cy, ix - 0.8 * k, iy - 0.8 * k, 0, 0.22, Math.PI - 0.22); ctx.stroke();
  }

  /* ================= 储粮桶 ================= */
  const BIN_RECT = { x: -64, y: 2, w: 128, h: 83 };
  function bucketPath() {
    const tw = DH.hopTopW / 2, bw = DH.hopBotW / 2;
    ctx.beginPath();
    ctx.moveTo(-tw, DH.hopTop); ctx.lineTo(tw, DH.hopTop);
    ctx.lineTo(bw, DH.hopBot); ctx.lineTo(-bw, DH.hopBot);
    ctx.closePath();
  }
  function xAtY(y) {
    const tw = DH.hopTopW / 2, bw = DH.hopBotW / 2;
    return tw + (bw - tw) * (y - DH.hopTop) / (DH.hopBot - DH.hopTop);
  }
  /* 桶内粮食：颗粒又多又小，才像一桶干粮，而不是一杯饮料 */
  function paintBinGrain(level) {
    const tw = DH.hopTopW / 2, bw = DH.hopBotW / 2, yT = DH.hopTop, yB = DH.hopBot;
    const surf = yB - (yB - yT - 6) * clamp(level, 0, 100) / 100;
    const dip = 7.0;                                   // 下料口在中间，粮面塌成漏斗
    ctx.save();
    bucketPath(); ctx.clip();
    ctx.beginPath();
    ctx.moveTo(-xAtY(surf), surf);
    ctx.quadraticCurveTo(0, surf + dip * 1.6, xAtY(surf), surf);
    ctx.lineTo(bw, yB); ctx.lineTo(-bw, yB); ctx.closePath();
    ctx.fillStyle = "#956a34"; ctx.fill();

    const COLS = 18, SP = 6.6;
    for (let row = 0; row < 23; row++) {
      const yy = surf - 1.5 + row * 4.6;
      if (yy > yB + 2) break;
      const xw = xAtY(yy);
      for (let c = 0; c < COLS; c++) {
        const xx = (c - (COLS - 1) / 2) * SP + (row % 2 ? SP / 2 : 0);
        if (Math.abs(xx) > xw - 2) continue;
        const lf = surf + dip * Math.max(0, 1 - Math.pow(xx / xw, 2));
        if (yy < lf) continue;                          // 粮面之上不画
        const t = hash(row * 13.7 + c * 3.1);
        const jx = (hash(row * 31 + c * 7) - 0.5) * 1.8;
        const jy = (hash(row * 17 + c * 5) - 0.5) * 1.3;
        if (hash(row * 37.1 + c * 11.3 + 0.7) > 0.962) {
          // 冻干也混在桶里：浅一号的米白方块，比猫粮大一圈
          ctx.save();
          ctx.translate(xx + jx, yy + jy);
          ctx.rotate((t - 0.5) * 0.9);
          ctx.fillStyle = t < 0.5 ? "#e7d9b8" : "#dac7a2";
          fdPath(2.5, 2.3, 0.5, 0.4); ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = t < 0.32 ? "#d3a25e" : t < 0.66 ? "#bd8a45" : "#a0723a";
          ctx.beginPath();
          ctx.ellipse(xx + jx, yy + jy, 2.9, 2.0, (t - 0.5) * 1.4, 0, TAU);
          ctx.fill();
        }
      }
    }
    // 两侧桶壁压暗：玻璃厚度与进深
    const dg = ctx.createLinearGradient(-tw, 0, tw, 0);
    dg.addColorStop(0, "rgba(58,38,12,.36)");
    dg.addColorStop(0.16, "rgba(58,38,12,.02)");
    dg.addColorStop(0.84, "rgba(58,38,12,.02)");
    dg.addColorStop(1, "rgba(58,38,12,.32)");
    ctx.fillStyle = dg;
    ctx.fillRect(-tw, surf - 2, tw * 2, yB - surf + 6);
    // 粮面受光：沿漏斗曲线一道亮边
    ctx.strokeStyle = "rgba(255,228,180,.7)"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-xAtY(surf) + 3, surf);
    ctx.quadraticCurveTo(0, surf + dip * 2, xAtY(surf) - 3, surf);
    ctx.stroke();
    ctx.restore();
  }

  function drawBucket(level) {
    const tw = DH.hopTopW / 2, bw = DH.hopBotW / 2, yT = DH.hopTop, yB = DH.hopBot;
    // 桶体（透明亚克力）
    bucketPath();
    ctx.fillStyle = "#f4fbf8"; ctx.fill();

    if (level > 0.6) {
      if (ensureCache("bin", Math.round(level), BIN_RECT, () => paintBinGrain(level))) {
        ctx.drawImage(CACHE.bin, BIN_RECT.x, BIN_RECT.y, BIN_RECT.w, BIN_RECT.h);
      }
    }

    // 玻璃本体 + 竖向反光
    bucketPath();
    ctx.strokeStyle = "#cddfdb"; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.beginPath();
    ctx.moveTo(-tw + 7, yT + 4); ctx.lineTo(-tw + 13.3, yT + 4);
    ctx.lineTo(-bw + 11.9, yB - 4); ctx.lineTo(-bw + 6.3, yB - 4);
    ctx.closePath(); ctx.fill();

    // 刻度
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 0.9;
    for (let i = 1; i <= 3; i++) {
      const yy = yT + (yB - yT) * i / 4;
      const xr = xAtY(yy);
      ctx.beginPath(); ctx.moveTo(xr - 8, yy); ctx.lineTo(xr - 3, yy); ctx.stroke();
    }

    // 盖子：压边 + 硅胶圈 + 两侧卡扣
    ctx.beginPath(); roundPath(-tw - 5.6, DH.lidY, DH.hopTopW + 11.2, DH.lidH, 4.2);
    ctx.fillStyle = "#e9f4f0"; ctx.fill();
    ctx.strokeStyle = "#bcdcd3"; ctx.lineWidth = 0.9;
    ctx.beginPath(); roundPath(-tw - 5.6, DH.lidY, DH.hopTopW + 11.2, DH.lidH, 4.2); ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); roundPath(-tw - 2, DH.lidY + 1.8, DH.hopTopW + 4, 2.8, 1.4); ctx.fill();
    ctx.fillStyle = "#cfe0d9";
    roundPath(-tw - 2.8, DH.lidY + 6, 9, 3.5, 1.6); ctx.fill();
    roundPath(tw - 6.3, DH.lidY + 6, 9, 3.5, 1.6); ctx.fill();
  }

  /* ================= 机身 + 出粮键 ================= */
  function ledColor() {
    if (F.errT > 0) return "#ff5a5a";
    if (F.dispensing > 0) return "#38e08a";
    if (cfg().feedHopper <= 0.4) return "#ff5a5a";
    if (cfg().feedBowl >= TUNE.bowlCap) return "#ffb02e";
    if (cfg().feedMode === "timer") return F.t % 2.6 < 1.3 ? "#38e08a" : "#a9c3bb";   // 定时待机呼吸
    return "#a9c3bb";
  }

  function drawBody() {
    const bx = DH.bodyW / 2, by = DH.bodyY, bh = DH.bodyH;
    const k = bh / 66;                          // 机身内部细节随高度同比缩放
    ctx.save();
    ctx.shadowColor = "rgba(20,49,58,.10)"; ctx.shadowBlur = 12 * k; ctx.shadowOffsetY = 5 * k;
    ctx.fillStyle = "#ffffff";
    roundPath(-bx, by, DH.bodyW, bh, 14 * k); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#cfe6df"; ctx.lineWidth = 0.9;
    roundPath(-bx, by, DH.bodyW, bh, 14 * k); ctx.stroke();

    // 分模线 + 螺钉
    ctx.strokeStyle = "#eaf3ef"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-bx + 7, by + 43 * k); ctx.lineTo(bx - 7, by + 43 * k); ctx.stroke();
    ctx.fillStyle = "#dbeae5";
    for (const sx of [-bx + 9, bx - 9]) { ctx.beginPath(); ctx.arc(sx, by + 10 * k, 1.1, 0, TAU); ctx.fill(); }

    // 小屏：深底青字，像真空荧光屏
    const lx = DH.lcdX, ly = DH.lcdY, lw = DH.lcdW, lh = DH.lcdH;
    roundPath(lx, ly, lw, lh, 3.5);
    ctx.fillStyle = "#14343c"; ctx.fill();
    const c0 = cfg();
    const topTxt = (c0.feedMode === "timer" ? "定时 " : "手动 ") + portion() + "份";
    const botTxt = F.dispensing > 0 ? "出粮中" : (c0.feedMode === "timer" ? countdownText() : "待机");
    text(topTxt, lx + lw / 2, ly + 8, "bold 6.5px sans-serif", "#8ef0d6");
    text(botTxt, lx + lw / 2, ly + 17, "6.5px sans-serif", F.dispensing > 0 ? "#6fe0c6" : "#57a99b");
    ctx.fillStyle = "rgba(255,255,255,.07)";
    roundPath(lx + 2, ly + 2, lw - 4, 6, 2); ctx.fill();

    // 散热格栅
    ctx.strokeStyle = "rgba(20,49,58,.11)"; ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const yy = by + 33 + i * 2.8;
      ctx.beginPath(); ctx.moveTo(-bx + 10, yy); ctx.lineTo(-bx + 38, yy); ctx.stroke();
    }

    // LED 指示灯
    const lc = ledColor();
    if (F.dispensing > 0 || F.errT > 0) {
      ctx.fillStyle = lc === "#ff5a5a" ? "rgba(255,90,90,.18)" : "rgba(56,224,138,.18)";
      ctx.beginPath(); ctx.arc(DH.ledX, DH.ledY, DH.ledR + 3.5, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = lc;
    ctx.beginPath(); ctx.arc(DH.ledX, DH.ledY, DH.ledR, 0, TAU); ctx.fill();

    // 铭牌
    text("FEEDER", bx - 24, by + bh - 8, "bold 5.5px sans-serif", "rgba(20,49,58,.26)");
  }

  function drawFeedBtn(interactive) {
    const r = DH.btnR, cx = DH.btnX, cy = DH.btnY;
    const press = F.pressT;
    const oy = press * 1.1;
    const shake = F.errT > 0 ? Math.sin(F.t * 78) * 1.5 * clamp(F.errT / 0.42, 0, 1) : 0;
    ctx.save();
    ctx.translate(shake, 0);
    // 凹槽
    ctx.fillStyle = "rgba(21,154,140,.10)";
    ctx.beginPath(); ctx.arc(cx, cy, r + 3.2, 0, TAU); ctx.fill();
    // 呼吸光晕（待机时提示"这里能按"）
    if (F.dispensing <= 0 && F.errT <= 0) {
      const k = 0.5 + 0.5 * Math.sin(F.t * 2.2);
      ctx.fillStyle = "rgba(21,154,140," + (0.05 + k * 0.06).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(cx, cy, r + 7.7 + k * 1.4, 0, TAU); ctx.fill();
    }
    // 键体
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, "rgba(255,255,255,.35)");
    g.addColorStop(0.45, "#1ea895");
    g.addColorStop(1, press > 0 ? "#084f58" : "#0d6b7d");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy + oy, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(10,80,90,.35)"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(cx, cy + oy, r, 0, TAU); ctx.stroke();
    // 图标：两颗粮落进碗
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.ellipse(cx - 1.0, cy - 4.5 + oy, 1.5, 1.2, -0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 1.3, cy - 1.8 + oy, 1.5, 1.2, 0.25, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(cx, cy + 1.3, 3.9, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();
    // 出粮进度环
    if (F.dispensing > 0 && F.dispTotal > 0) {
      const p = 1 - clamp(F.dispensing / F.dispTotal, 0, 1);
      ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 1.7; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx, cy, r + 3.9, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
    }
    ctx.restore();

    // 命中区：画在设备坐标系里，必须换算回屏幕坐标
    if (!interactive) return;
    const sxs = F.cam.ox + cx * F.cam.s, sys = F.cam.oy + cy * F.cam.s, hs = (r + 9) * F.cam.s;
    G.ui.buttons.push({
      x: sxs - hs, y: sys - hs, w: hs * 2, h: hs * 2, key: "feed",
      cb: () => { if (F.dispensing > 0 || F.mode !== "home") return; F.pressT = 1; G.playTick(); dispense(false); }
    });
  }

  function drawChute() {
    const y0 = DH.chuteY, y1 = DH.mouthY;
    // 透明滑道：先画管内（深色底 + 绞龙 + 正在输送的粮）
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-17, y0); ctx.lineTo(17, y0); ctx.lineTo(9, y1); ctx.lineTo(-9, y1);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = "#d9e8e2";
    ctx.fillRect(-18, y0, 36, y1 - y0 + 1);
    // 绞龙轴：中心柱 + 螺旋片（相位 aug 推进 = 粮被往下旋送）
    const top = y0 + 1.5, bot = y1 - 2.5;
    ctx.strokeStyle = "#93aaa3"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(0, bot); ctx.stroke();
    ctx.strokeStyle = "#b7ccc5"; ctx.lineWidth = 2.2;
    for (let t = ((F.aug % 1) + 1) % 1; t < 1; t += 0.25) {
      const yy = top + (bot - top) * t;
      const hw = 9 + (17 - 9) * (1 - (yy - y0) / (y1 - y0));
      ctx.beginPath();
      ctx.moveTo(-hw, yy + 2.4); ctx.quadraticCurveTo(0, yy - 2.6, hw, yy + 2.4);
      ctx.stroke();
    }
    // 出粮时管里塞着正在下行的粮：3 列小颗粒跟着绞龙相位往下爬
    if (F.dispensing > 0) {
      for (let i = 0; i < 15; i++) {
        const t = ((F.aug * 0.55 + i / 15) % 1 + 1) % 1;
        const yy = y0 + 2 + t * (y1 - y0 - 4);
        const hw = (9 + (17 - 9) * (1 - (yy - y0) / (y1 - y0))) * 0.62;
        const col = i % 3, xx = (col - 1) * hw * 0.92 + (hash(i * 7.3) - 0.5) * 2;
        ctx.fillStyle = tone(KIB_BODY[i % 3], 0.95);
        ctx.beginPath();
        ctx.ellipse(xx, yy, 2.7, 2.0, hash(i * 2.1) * 2.4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    // 管壳：亚克力描边 + 一道竖向反光
    ctx.beginPath();
    ctx.moveTo(-17, y0); ctx.lineTo(17, y0); ctx.lineTo(9, y1); ctx.lineTo(-9, y1);
    ctx.closePath();
    ctx.strokeStyle = "#c2dcd4"; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.beginPath();
    ctx.moveTo(-13, y0 + 1); ctx.lineTo(-10, y0 + 1); ctx.lineTo(-5.6, y1 - 1); ctx.lineTo(-7.8, y1 - 1);
    ctx.closePath(); ctx.fill();
    // 出粮口
    ctx.fillStyle = "#22403f";
    ctx.beginPath(); ctx.ellipse(0, y1, 9, 2.4, 0, 0, TAU); ctx.fill();
    if (F.dispensing > 0) {
      ctx.fillStyle = "rgba(255,214,150,.55)";
      ctx.beginPath(); ctx.ellipse(0, y1, 6.3, 1.7, 0, 0, TAU); ctx.fill();
    }
  }

  /* 落盆扬尘：一颗粮砸进粮堆会激起一小圈粉尘，小颗粒向外飘散后淡出 */
  function drawDust() {
    for (const d of F.dust) {
      const k = 1 - d.life / d.max;
      ctx.fillStyle = "rgba(206,170,116," + (0.30 * (1 - k)).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(d.x + d.vx * k * 0.12, d.y - d.vy * k * 0.09, d.r * (1 + k * 1.7), 0, TAU);
      ctx.fill();
    }
  }
  function puff(x, y, s) {
    for (let i = 0; i < 3; i++) {
      F.dust.push({ x: x + rand(-3, 3) * s, y: y - rand(0, 3) * s,
        vx: rand(-26, 26), vy: rand(6, 22), r: rand(0.9, 1.9) * s,
        life: 0, max: rand(0.22, 0.38) });
    }
    if (F.dust.length > 60) F.dust.splice(0, F.dust.length - 60);
  }

  function drawMachine() {
    const c = cfg();
    // 地面投影（按托座宽度落影，盆才不是浮着的）
    ctx.fillStyle = "rgba(20,49,58,.10)";
    ctx.beginPath(); ctx.ellipse(0, DH.bottomY - 0.5, DH.colRX * 1.02, 11, 0, 0, TAU); ctx.fill();
    // 电机工作时整机轻微抖动
    ctx.save();
    if (F.dispensing > 0) ctx.translate(Math.sin(F.t * 62) * 0.55, Math.cos(F.t * 74) * 0.28);
    // 底座：真实喂食器的盆是坐在机身托盘里的，盆和机身不再悬空脱节
    const bx = DH.bodyW / 2;
    ctx.fillStyle = "rgba(20,49,58,.07)";
    roundPath(-bx + 6, DH.bodyY + DH.bodyH + 2, DH.bodyW - 12, DH.bottomY - DH.bodyY - DH.bodyH - 4, 16); ctx.fill();
    ctx.strokeStyle = "rgba(160,196,186,.35)"; ctx.lineWidth = 1;
    roundPath(-bx + 6, DH.bodyY + DH.bodyH + 2, DH.bodyW - 12, DH.bottomY - DH.bodyY - DH.bodyH - 4, 16); ctx.stroke();
    drawBucket(c.feedHopper);
    drawBody();
    // 出粮时按钮仍画（显示进度环＝机器在工作），但不再接收点击
    drawFeedBtn(F.mode === "home");
    // 盆先画、滑道后画：滑道末端要露在托座顶面之上，出粮口才看得见
    drawBowl(c.feedBowl);
    drawChute();
    drawPellets();
    drawDust();
    drawBites();
    ctx.restore();
  }

  function drawPellets() {
    for (const p of F.pellets) {
      if (p.vy > 120) {   // 快速下落时的拖影，代替运动模糊
        ctx.fillStyle = "rgba(150,100,40,.14)";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - p.vy * 0.012, TUNE.kibR * 0.5 * p.s, p.vy * 0.02, 0, 0, TAU);
        ctx.fill();
      }
      // 落到冻干槽位的那颗，在空中就得是块冻干，落盆才不会突变
      if (p.fd) freezeDry(p.x, p.y, p.rot, p.s, 1, p.slotIdx);
      else kibble(p.x, p.y, p.rot, p.s, 1, null);
    }
  }

  /* ================= 常态界面 ================= */
  /* 顶部圆键规格与首页设置键完全一致：34px 白圆 / 1px 细边 / 15px 齿轮 / 左上角 (12,10) 起排。
     之前这里的齿轮是自绘的实心 8 齿、还为了躲微信胶囊跑到右上角，用户在两个页面看到两种"设置"。 */
  const HEAD = { size: 34, gap: 8, inset: 12, top: 10, icon: 15 };
  function headPos(L, i) {
    const s = HEAD.size;
    return { x: L.safe.left + HEAD.inset + i * (s + HEAD.gap), y: L.safe.top + HEAD.top, s };
  }
  /* 白圆底 + 细边（与首页同色，不用 C.line 的浅绿，避免两个页面底色深浅不一） */
  function roundBtn(x, y, s) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(20,49,58,.10)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  function drawBack(L) {
    const p = headPos(L, 0);
    roundBtn(p.x, p.y, p.s);
    const cx = p.x + p.s / 2, cy = p.y + p.s / 2;
    ctx.save();
    ctx.strokeStyle = C.tealDeep; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx + 4, cy - 6); ctx.lineTo(cx - 3, cy); ctx.lineTo(cx + 4, cy + 6);
    ctx.stroke();
    ctx.restore();
    G.ui.buttons.push({ x: p.x, y: p.y, w: p.s, h: p.s, cb: () => G.switchScreen("home"), key: "back" });
    // 标题排在两颗圆键之后
    const g = headPos(L, 1);
    return { x: g.x + g.s + 14, y: cy };
  }

  /* 设置键：与首页同一位置（左上角第二颗）、同一尺寸、同一齿轮画法 */
  function drawGearBtn(L) {
    const p = headPos(L, 1);
    roundBtn(p.x, p.y, p.s);
    ctx.save();
    ctx.translate(p.x + p.s / 2, p.y + p.s / 2);
    if (G.ui.gearAt) G.ui.gearAt(ctx, HEAD.icon, C.ink2);
    ctx.restore();
    G.ui.buttons.push({
      x: p.x, y: p.y, w: p.s, h: p.s, key: "settings",
      cb: () => { F.mode = "modal"; G.playTick(); }
    });
  }

  /* 被吃掉的那几颗：从粮堆顶部扬起、缩小淡出 */
  function drawBites() {
    for (const b of F.bites) {
      const k = clamp(b.t / b.life, 0, 1);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      if (b.fd) freezeDry(b.x, b.y, b.rot, b.s * (1 - k * 0.55), 1, b.slotIdx);
      else kibble(b.x, b.y, b.rot, b.s * (1 - k * 0.55), 1, b.seed);
      ctx.restore();
    }
  }

  /* ================= 点食盆喂猫：吃掉一份 ================= */
  /* 每点一次从堆顶吃掉一份（16 颗，与出粮的份量同口径）；不足一份就吃光。 */
  function eatFromBowl() {
    const c = cfg();
    if (F.mode !== "home" || F.e > 0.02 || F.dispensing > 0) return false;
    if (c.feedBowl <= 0) { hint("盆里没有粮，先出点粮"); G.playMiss(); return false; }
    const before = c.feedBowl;
    const n = Math.min(before, TUNE.piecesPerPortion);
    // 被吃的总是堆顶那几颗，位置对得上，才不会像凭空消失
    for (let i = before - n; i < before; i++) {
      const s = pileSlot(i);
      F.bites.push({
        x: s.x, y: s.y, vx: rand(-22, 22), vy: -rand(126, 196),
        rot: rand(0, TAU), vr: rand(-7, 7), s: 0.86 + hash(i * 4.3) * 0.3,
        fd: isFreezeDry(i), slotIdx: i,
        seed: i % 7, t: 0, life: rand(0.44, 0.62)
      });
    }
    c.feedBowl = before - n;
    F.eatPulse = 1;
    try { G.playEatCrunch(); } catch (e) {}
    hint(c.feedBowl > 0 ? "猫咪吃掉 " + n + " 颗" : "盆里的粮被吃光了", 1.2);
    try { G.track("feeder_eat", { n, left: c.feedBowl }); } catch (e) {}
    G.saveConfig();
    return true;
  }
  G.feederEat = () => eatFromBowl();

  function drawHomeUI(L) {
    const back = drawBack(L);
    text("电子猫粮机", back.x, back.y - 1, "bold 19px sans-serif", C.ink, "left");
    drawGearBtn(L);
    // 食盆命中区：点粮堆 = 吃掉一份（只在常态收，演出中不抢触摸）
    // 底部那行「储粮/盆内/份」状态文字已整条移除：机器和猫盆改用腾出来的那 22px，盆更大
    if (F.mode === "home") {
      const s = F.cam.s;
      G.ui.buttons.push({
        x: F.cam.ox - 100 * s, y: F.cam.oy + 146 * s, w: 200 * s, h: 82 * s,
        key: "bowl", cb: eatFromBowl
      });
    }
  }

  function countdownText() {
    const c = cfg();
    if (c.feedMode !== "timer") return "--:--";
    const left = Math.max(0, (c.feedNextAt || 0) - nowMs());
    let sec = Math.ceil(left / 1000);
    const mm = Math.floor(sec / 60), ss = sec % 60;
    if (mm >= 60) {
      const hh = Math.floor(mm / 60);
      return (hh < 10 ? "0" : "") + hh + ":" + (mm % 60 < 10 ? "0" : "") + (mm % 60);
    }
    return (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss;
  }

  /* ================= 设置弹窗 ================= */
  function drawModal(L) {
    ctx.fillStyle = "rgba(8,32,38,.44)";
    ctx.fillRect(0, 0, L.W, L.H);
    G.ui.buttons.push({ x: 0, y: 0, w: L.W, h: L.H, key: "modal-scrim", cb: () => { F.mode = "home"; G.playTick(); } });

    const w = clamp(L.W * 0.44, 300, 390);
    const h = 292;
    const x = (L.W - w) / 2, y = Math.max(L.safe.top + 8, (L.H - h) / 2 - 4);
    const pad = 16, innerX = x + pad, innerW = w - pad * 2;

    ctx.save();
    ctx.shadowColor = "rgba(8,32,38,.28)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10;
    ctx.fillStyle = C.card;
    roundPath(x, y, w, h, 18); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
    roundPath(x, y, w, h, 18); ctx.stroke();

    const timer = cfg().feedMode === "timer";
    text("喂食设置", innerX, y + 22, "bold 15px sans-serif", C.ink, "left");
    // 右侧留出关闭键的位置，别让副标题顶到 × 上
    text(timer ? "按间隔自动出粮" : "按机身按钮出粮", innerX + innerW - 34, y + 22, "11px sans-serif", C.ink3, "right");
    // 关闭
    ctx.strokeStyle = C.ink3; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    const cxp = x + w - 19, cyp = y + 20;
    ctx.beginPath(); ctx.moveTo(cxp - 5, cyp - 5); ctx.lineTo(cxp + 5, cyp + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cxp + 5, cyp - 5); ctx.lineTo(cxp - 5, cyp + 5); ctx.stroke();
    G.ui.buttons.push({ x: cxp - 15, y: cyp - 15, w: 30, h: 30, key: "modal-close", cb: () => { F.mode = "home"; G.playTick(); } });

    let cy = y + 42;

    // 方式
    {
      const rowH = 30;
      text("方式", innerX, cy + rowH / 2, "13px sans-serif", C.ink2, "left");
      const sw = 172, sx = x + w - pad - sw;
      pill(sx, cy, (sw - 6) / 2, rowH, "手动", {
        on: !timer, key: "mode-manual", font: 12,
        cb: () => { cfg().feedMode = "manual"; cfg().feedNextAt = 0; G.saveConfig(); G.playTick(); }
      });
      pill(sx + (sw - 6) / 2 + 6, cy, (sw - 6) / 2, rowH, "定时", {
        on: timer, key: "mode-timer", font: 12,
        cb: () => { cfg().feedMode = "timer"; anchorTimer(); G.playTick(); }
      });
      cy += rowH + 10;
    }

    // 份量
    {
      const rowH = 30;
      text("份量", innerX, cy + rowH / 2, "13px sans-serif", C.ink2, "left");
      const bw = 30, dispW = 96;
      const rx = x + w - pad - (bw * 2 + 6 * 2 + dispW);
      pill(rx, cy, bw, rowH, "−", {
        key: "portion-minus", font: 14,
        cb: () => { cfg().feedPortion = clamp(portion() - 1, 1, 5); G.saveConfig(); G.playTick(); }
      });
      ctx.fillStyle = C.statBg;
      roundPath(rx + bw + 6, cy, dispW, rowH, 9); ctx.fill();
      text(portion() + " 份 · " + portion() * TUNE.gramsPerPortion + "g",
        rx + bw + 6 + dispW / 2, cy + rowH / 2, "bold 12px sans-serif", C.tealDeep);
      pill(rx + bw + 6 + dispW + 6, cy, bw, rowH, "+", {
        key: "portion-plus", font: 14,
        cb: () => { cfg().feedPortion = clamp(portion() + 1, 1, 5); G.saveConfig(); G.playTick(); }
      });
      cy += rowH + 10;
    }

    // 间隔（手动模式置灰）
    {
      const rowH = 26;
      text("间隔", innerX, cy + rowH / 2, "13px sans-serif", timer ? C.ink2 : C.ink3, "left");
      const labels = ["30秒", "1分", "5分", "30分"];
      const availW = 172, pw = (availW - 6 * 3) / 4, sx = x + w - pad - availW;
      TUNE.intervals.forEach((iv, i) => {
        const on = timer && Math.abs(Number(cfg().feedIntervalMin) - iv) < 1e-6;
        pill(sx + i * (pw + 6), cy, pw, rowH, labels[i], {
          on, key: "iv-" + iv, font: 11,
          fill: timer ? C.segBg : "#f3f7f5",
          color: timer ? C.ink2 : C.ink3,
          cb: () => {
            cfg().feedIntervalMin = iv;
            if (cfg().feedMode === "timer") cfg().feedNextAt = nowMs() + intervalMs();
            G.saveConfig(); G.playTick();
          }
        });
      });
      cy += rowH + 10;
    }

    // 倒计时
    {
      const rowH = 24;
      ctx.fillStyle = "rgba(21,154,140,.08)";
      roundPath(innerX, cy, innerW, rowH, 8); ctx.fill();
      text(timer ? "下次出粮" : "当前模式", innerX + 10, cy + rowH / 2, "11px sans-serif", C.ink2, "left");
      text(timer ? countdownText() : "手动控制", innerX + innerW - 10, cy + rowH / 2,
        "bold 12px sans-serif", timer ? C.tealDeep : C.ink3, "right");
      cy += rowH + 10;
    }

    // 补粮 / 清空盆
    {
      const rowH = 28, bw = (innerW - 8) / 2;
      pill(innerX, cy, bw, rowH, "补粮到满", { key: "refill", font: 12, cb: refill });
      pill(innerX + bw + 8, cy, bw, rowH, "清空食盆", { key: "clear", font: 12, cb: clearBowl });
      cy += rowH + 8;
    }

    text("改动即时保存", x + w / 2, cy + 4, "10px sans-serif", C.ink3);
  }

  /* ================= 演出舞台 ================= */
  function drawStage(L, st, e) {
    ctx.save();
    // 两侧压暗
    ctx.fillStyle = "rgba(10,30,34," + (0.74 * e).toFixed(3) + ")";
    ctx.fillRect(0, 0, L.W, L.H);
    // 舞台底
    roundPath(st.x, st.y, st.w, st.h, 16);
    ctx.fillStyle = "#eaf5f0";
    ctx.fill();
    // 舞台内底部轻微压暗，机器"站在"地面上
    const gg = ctx.createLinearGradient(0, st.y + st.h * 0.55, 0, st.y + st.h);
    gg.addColorStop(0, "rgba(180,214,203,0)");
    gg.addColorStop(1, "rgba(150,192,180,.34)");
    roundPath(st.x, st.y, st.w, st.h, 16);
    ctx.fillStyle = gg; ctx.fill();
    // 描边
    ctx.strokeStyle = "rgba(255,255,255," + (0.5 * e).toFixed(3) + ")";
    ctx.lineWidth = 1;
    roundPath(st.x, st.y, st.w, st.h, 16); ctx.stroke();
    ctx.restore();
  }

  function drawHint(L) {
    if (F.hintT <= 0) return;
    const a = Math.min(1, F.hintT / 0.35);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = "13px sans-serif";
    const bw = ctx.measureText(F.hint).width + 28;
    const bx = (L.W - bw) / 2;
    // 演出时挪到舞台上方，别压住盆里的粮；常态时贴底（底部状态文字已移除，不再需要让位）
    const by = F.e > 0.5 ? L.safe.top + 14 : L.H - L.safe.bottom - 32;
    ctx.fillStyle = "rgba(15,47,54,.88)";
    roundPath(bx, by, bw, 30, 15); ctx.fill();
    text(F.hint, L.W / 2, by + 15, "13px sans-serif", "#eafaf4");
    ctx.restore();
  }

  /* 常态：机器站在"桌面"上，脚下有接触阴影，画面才不会飘 */
  function drawFloor(L, cam, alpha) {
    if (alpha <= 0.01) return;
    const gy = cam.oy + DH.bottomY * cam.s;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, gy - 26, 0, gy + 34);
    g.addColorStop(0, "rgba(176,212,201,0)");
    g.addColorStop(0.55, "rgba(176,212,201,.34)");
    g.addColorStop(1, "rgba(176,212,201,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, gy - 26, L.W, 60);
    ctx.strokeStyle = "rgba(150,192,180,.35)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cam.ox - DH.colRX * 1.62 * cam.s, gy + 0.5);
    ctx.lineTo(cam.ox + DH.colRX * 1.62 * cam.s, gy + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  /* ================= 主绘制 ================= */
  G.feeder.draw = () => {
    const L = layout();
    const st = stageRect(L);
    const ch = camHome(L), cf = camFeed(st);
    const e = F.e;

    // 背景（常态）
    const bg = ctx.createLinearGradient(0, 0, L.W, L.H);
    bg.addColorStop(0, C.subBg1); bg.addColorStop(0.6, "#f4fbf7"); bg.addColorStop(1, C.subBg2);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, L.W, L.H);

    if (e > 0.01) drawStage(L, st, e);

    // 镜头：常态 → 舞台 的插值
    F.cam = {
      ox: ch.ox + (cf.ox - ch.ox) * e,
      oy: ch.oy + (cf.oy - ch.oy) * e,
      s: ch.s + (cf.s - ch.s) * e
    };
    // 桌面（只在常态可见：演出时舞台已有自己的地面）
    drawFloor(L, F.cam, 1 - e);
    ctx.save();
    ctx.translate(F.cam.ox, F.cam.oy);
    ctx.scale(F.cam.s, F.cam.s);
    drawMachine();
    ctx.restore();

    // 常态 UI（演出时淡出，且不再注册按钮）
    if (e < 0.99) {
      ctx.save();
      ctx.globalAlpha = 1 - e;
      drawHomeUI(L);
      ctx.restore();
    }

    if (F.mode === "modal") drawModal(L);

    // 演出中：整屏可点跳过
    if (F.mode === "feed") {
      G.ui.buttons.push({
        x: 0, y: 0, w: L.W, h: L.H, key: "skip",
        cb: () => { F.skip = true; }
      });
      if (e > 0.6) {
        ctx.save();
        ctx.globalAlpha = 0.45 * e;
        text("点一下跳过", st.x + st.w - 12, st.y + 16, "11px sans-serif", "#5c7c84", "right");
        ctx.restore();
      }
    }

    drawHint(L);
  };

  /* ================= 每帧更新 ================= */
  G.feeder.update = (dt) => {
    F.t += dt;
    F.aug = (F.aug + dt * (F.dispensing > 0 ? 2.6 : 0)) % 4096;
    F.e = approach(F.e, F.mode === "feed" ? 1 : 0, dt / 0.24);
    if (F.pressT > 0) F.pressT = Math.max(0, F.pressT - dt / 0.1);
    if (F.errT > 0) F.errT = Math.max(0, F.errT - dt);

    tickTimer();

    // 吐粒：间隔带抖动，真机的出粮节奏从来不是节拍器
    if (F.spawnLeft > 0) {
      F.spawnAcc += dt;
      const gap = F.skip ? 0.012 : 0.055;
      let guard = 0;
      while (F.spawnLeft > 0 && F.spawnAcc >= gap && guard++ < 12) {
        F.spawnAcc -= gap * rand(0.72, 1.26);
        F.spawnLeft--;
        spawnPellet();
      }
    }
    if (F.dispensing > 0) F.dispensing = Math.max(0, F.dispensing - dt);

    // 落粒物理：重力加速 → 触底一次反弹 → 停下并入粮堆
    const grav = F.skip ? 2600 : 1500;
    for (let i = F.pellets.length - 1; i >= 0; i--) {
      const p = F.pellets[i];
      p.vy += grav * dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt + (p.tx - p.x) * Math.min(1, dt * 3.4);
      p.rot += p.vr * dt;
      if (p.y >= p.ty) {
        if (p.bounce < 1) {
          p.bounce++;
          p.y = p.ty;
          p.vy = -p.vy * 0.26;
          p.vx *= 0.4;
        } else {
          F.pellets.splice(i, 1);
          const c = cfg();
          if (c.feedBowl < TUNE.bowlCap) { c.feedBowl++; F.dirtyAt = nowMs(); }
          puff(p.x, p.ty, p.s);
          // 落盆声：盆越满越闷（真机最明显的特征）
          try { G.playKibbleDrop(clamp(c.feedBowl / TUNE.bowlCap, 0, 1)); } catch (e) {}
        }
      }
    }

    // 扬尘飘散
    for (let i = F.dust.length - 1; i >= 0; i--) {
      const d = F.dust[i];
      d.life += dt;
      if (d.life >= d.max) F.dust.splice(i, 1);
    }

    // 被吃掉的粮：上扬后坠落淡出；粮堆回弹收尾
    for (let i = F.bites.length - 1; i >= 0; i--) {
      const b = F.bites[i];
      b.t += dt;
      b.vy += 130 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      if (b.t >= b.life) F.bites.splice(i, 1);
    }
    if (F.eatPulse > 0) F.eatPulse = Math.max(0, F.eatPulse - dt * 4.5);

    // 演出收尾：吐完 + 全部落定 → 停 0.5 秒回常态
    if (F.mode === "feed" && F.spawnLeft === 0 && F.pellets.length === 0) {
      F.holdT += dt;
      if (F.holdT > 0.5) {
        // 点过跳过时录音还长，提前收掉，免得机器停了还在响
        if (F.skip) { try { G.stopFeederSound(); } catch (e) {} }
        F.mode = "home";
        F.holdT = 0;
        // 第一次出完粮提示一下：盆里的粮可以点着喂猫
        if (!F.eatTip && cfg().feedBowl > 0) {
          F.eatTip = true;
          hint("点一下盆里的猫粮，猫咪就会来吃", 2.4);
        }
      }
    }

    if (F.hintT > 0) F.hintT = Math.max(0, F.hintT - dt);
    if (F.dirtyAt && nowMs() - F.dirtyAt > 500) { F.dirtyAt = 0; G.saveConfig(); }
  };

  function spawnPellet() {
    const c = cfg();
    const idx = Math.min(TUNE.bowlCap - 1, c.feedBowl + F.pellets.length);
    const slot = pileSlot(idx);
    F.pellets.push({
      x: rand(-6, 6),
      y: DH.mouthY + rand(-1, 2),
      tx: slot.x, ty: slot.y,
      vy: rand(18, 42), vx: rand(-9, 9),
      rot: rand(0, TAU), vr: rand(-8, 8),
      s: rand(0.88, 1.12),
      fd: isFreezeDry(idx), slotIdx: idx,
      bounce: 0
    });
  }

  /* ================= 进入 ================= */
  G.feederEnter = () => {
    G.ensureAudio();
    try { G.stopFeederSound(); } catch (e) {}     // 上次退出时残留的出粮录音
    F.mode = "home";
    F.e = 0;
    F.pellets.length = 0;
    F.spawnLeft = 0;
    F.spawnAcc = 0;
    F.dispensing = 0;
    F.aug = 0;
    F.dust.length = 0;
    F.bites.length = 0;
    F.eatPulse = 0;
    F.eatTip = false;
    F.pressT = 0;
    F.errT = 0;
    F.hint = ""; F.hintT = 0;
    const c = cfg();
    if (c.feedMode === "timer" && !(c.feedNextAt > 0)) c.feedNextAt = nowMs() + intervalMs();
    try { G.track("feeder_open", { mode: c.feedMode, bowl: c.feedBowl, hop: Math.round(c.feedHopper) }); } catch (e) {}
    G.switchScreen("feeder");
    G.saveConfig();
  };
};
