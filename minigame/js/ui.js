/* ui.js — 全 Canvas 界面：首页 / 设置 / 记录 / HUD / 倒计时 / 暂停 / 结算
   配色严格对齐 H5 原型（浅色主题 + 青绿主色 + 琥珀强调） */
module.exports = function (G) {
  const ctx = G.platform.ctx;
  const clamp = G.clamp;
  const C = G.COLORS;
  const ui = { buttons: [], hudDimT: 0, stagePop: 0, stageText: "", comboPop: 0, comboShown: 0 };
  G.ui = ui;
  G.uiFX = { stagePop: 0, stageText: "", comboPop: 0 };

  const btn = (x, y, w, h, cb) => { ui.buttons.push({ x, y, w, h, cb }); };
  const inBtn = (x, y, b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  G.hitButton = (x, y) => {
    for (let i = ui.buttons.length - 1; i >= 0; i--) {
      if (inBtn(x, y, ui.buttons[i])) { ui.buttons[i].cb(); return true; }
    }
    return false;
  };

  function panel(x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill || C.panelBg;
    ctx.strokeStyle = stroke || C.line;
    ctx.lineWidth = 1.2;
    G.rr(ctx, x, y, w, h, 16); ctx.fill(); ctx.stroke();
  }
  function text(str, x, y, font, color, align) {
    ctx.font = font; ctx.fillStyle = color || C.ink;
    ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
    ctx.fillText(str, x, y);
  }
  function drawBtn(x, y, w, h, label, opts) {
    const o = opts || {};
    ctx.fillStyle = o.primary ? C.startGrad1 : (o.on ? C.card : C.segBg);
    ctx.strokeStyle = o.primary ? C.teal : (o.on ? C.line : C.line);
    ctx.lineWidth = o.on ? 2 : 1.2;
    G.rr(ctx, x, y, w, h, 14); ctx.fill(); ctx.stroke();
    text(label, x + w / 2, y + h / 2 + 1, o.primary ? "bold 19px sans-serif" : "16px sans-serif",
      o.primary ? "#fff" : (o.on ? C.ink : C.ink2));
    btn(x, y, w, h, o.cb);
  }
  ui.panel = panel; ui.text = text; ui.drawBtn = drawBtn;

  function layout() {
    const W = G.platform.W, H = G.platform.H;
    const safe = G.platform.safe || { top: 0, bottom: 0, left: 0, right: 0 };
    const land = W > H;
    const m = land ? 24 : 18;
    const gap = 12;
    return { W, H, land, m, gap, safe };
  }

  /* ================= 首页 ================= */
  const MODES = [
    { key: "fish",      name: "深海捕鱼", desc: "三条小鱼随波游动" },
    { key: "butterfly", name: "蝴蝶花园", desc: "花间穿梭，还会停花" },
    { key: "mouse",     name: "捕鼠行动", desc: "打地鼠式两排洞口" },
    { key: "laser",     name: "激光暗室", desc: "甩动与停留的红点" }
  ];
  /* 首页常驻小字：适龄提示(12周岁) / 健康游戏忠告(标准原文) / 安全提示 / 免责声明（自动按宽度折行）
     文案依据：《网络游戏适龄提示》团体标准 + 新闻出版署《健康游戏忠告》标准原文，逐字使用 */
  const TIPS = [
    "适龄提示：本游戏适合12周岁以上用户使用，建议未成年人在家长监护下使用本游戏",
    "健康游戏忠告：抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。",
    "安全提示：请勿在行走、乘车或驾驶时游玩；长时间游玩请适当休息、注意用眼健康；游玩时请握稳设备，避免磕碰跌落",
    "免责声明：本游戏为免费休闲玩具，不含付费、抽奖与任何商业推广"
  ];
  function wrapTips(maxW, fs) {
    const lines = [];
    ctx.font = (fs || 10) + "px sans-serif";
    TIPS.forEach(s => {
      let cur = "";
      for (const ch of s) {
        if (cur && ctx.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; }
        else cur += ch;
      }
      if (cur) lines.push(cur);
    });
    return lines;
  }
  function drawTips(x, y, maxW, lineH, align, fs) {
    const lines = wrapTips(maxW, fs);
    ctx.globalAlpha = 0.75;
    lines.forEach((s, i) => text(s, x, y + 8 + i * lineH, (fs || 10) + "px sans-serif", C.ink3, align || "left"));
    ctx.globalAlpha = 1;
    return lines.length * lineH;
  }

  /* 原型同款圆形开始按钮：青绿径向渐变 + 12px 外圈光环 + 内描边圈
     中心小鱼往返游动(swimDrift 3.4s) + 摆尾 + 上升气泡 + 整体呼吸(breath 2.8s) */
  ui.drawStartOrb = (cx, cy, D, label, cb) => {
    const t = Date.now() / 1000;
    const R = D / 2;
    const sc = D / 148;                       // 相对原型 148px 的缩放
    const breath = 1 + Math.sin(t * Math.PI * 2 / 2.8) * 0.018;

    // 外圈光环（原型 box-shadow 0 0 0 12px rgba(142,226,210,.22)）
    ctx.fillStyle = "rgba(142,226,210,.22)";
    ctx.beginPath(); ctx.arc(cx, cy, R * breath + 12 * sc, 0, Math.PI * 2); ctx.fill();

    // 主体：径向渐变（高光在 35% 28% 处）+ 底部投影
    ctx.save();
    ctx.shadowColor = "rgba(16,95,110,.32)"; ctx.shadowBlur = 24 * sc; ctx.shadowOffsetY = 10 * sc;
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.44, R * 0.1, cx, cy, R * breath);
    g.addColorStop(0, "#46d6c0"); g.addColorStop(0.48, "#14a093"); g.addColorStop(1, "#0c5f6e");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * breath, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 内描边圈（原型 ::after inset 7px，1.5px 白 35%）
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, (R - 7 * sc) * breath, 0, Math.PI * 2); ctx.stroke();

    /* --- 中心游动的小鱼（原型 66×42，svg 逐元素复刻） --- */
    const fw = 66 * sc, fh = 42 * sc;
    const fishY = cy - 11 * sc;
    // swimDrift：-16 → +16 → 翻面 → 游回（3.4s 循环，端点处 scaleX 1→-1 翻面）
    const ph = (t % 3.4) / 3.4;
    let dx, face;
    if (ph < 0.43)      { dx = -16 + 32 * (ph / 0.43); face = 1; }
    else if (ph < 0.5)  { dx = 16; face = 1 - 2 * ((ph - 0.43) / 0.07); }
    else if (ph < 0.93) { dx = 16 - 32 * ((ph - 0.5) / 0.43); face = -1; }
    else                { dx = -16; face = -1 + 2 * ((ph - 0.93) / 0.07); }
    dx *= sc;
    // swimWiggle：整体 ±8° 摇摆（0.55s alternate → 1.1s 全周期）
    const rot = Math.sin(t * Math.PI * 2 / 1.1) * 8 * Math.PI / 180;

    ctx.save();
    ctx.translate(cx + dx, fishY);
    ctx.scale(sc * face, sc);
    ctx.rotate(rot);
    ctx.translate(-60, -36);
    // 尾巴独立摆动（原型 .tail 动画）
    const wag = Math.sin(t * Math.PI * 2 / 0.55) * 0.28;
    ctx.save(); ctx.translate(30, 36); ctx.rotate(wag); ctx.translate(-30, -36);
    ctx.fillStyle = "#ff8a2a";
    ctx.beginPath(); ctx.moveTo(30, 36); ctx.lineTo(4, 14); ctx.lineTo(10, 36); ctx.lineTo(4, 58); ctx.closePath(); ctx.fill();
    ctx.restore();
    // 身体（金橘渐变，与原型 linearGradient #ffd45e→#ff8a2a 一致）
    const bg = ctx.createLinearGradient(22, 12, 106, 60);
    bg.addColorStop(0, "#ffd45e"); bg.addColorStop(1, "#ff8a2a");
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(64, 36, 42, 24, 0, 0, Math.PI * 2); ctx.fill();
    // 背鳍
    ctx.fillStyle = "#ff9d42";
    ctx.beginPath(); ctx.moveTo(52, 14); ctx.quadraticCurveTo(66, 2, 80, 14); ctx.quadraticCurveTo(66, 18, 52, 14); ctx.closePath(); ctx.fill();
    // 侧鳍
    ctx.strokeStyle = "#e8811f"; ctx.lineWidth = 3.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(70, 33); ctx.quadraticCurveTo(81, 41, 70, 50); ctx.stroke();
    ctx.lineCap = "butt";
    // 眼睛（白底 + 深瞳 + 高光）
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(90, 30, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#17323b"; ctx.beginPath(); ctx.arc(92, 30, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(93.2, 28.6, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 上升气泡 ×2（原型 start-bubble：左侧 18% / 右侧 22%，2.8s 循环、b2 延迟 1.4s）
    for (const [bxr, delay, r] of [[0.18, 0, 2.5], [0.78, 1.4, 2]]) {
      const bp = ((t + delay) % 2.8) / 2.8;
      const bubY = fishY + fh / 2 - bp * 36 * sc;
      const a = bp < 0.18 ? (bp / 0.18) * 0.75 : 0.75 * (1 - (bp - 0.18) / 0.82);
      ctx.fillStyle = "rgba(255,255,255," + Math.max(a, 0).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(cx + (bxr - 0.5) * fw, bubY, r * sc, 0, Math.PI * 2); ctx.fill();
    }

    // 文字（原型 start-text 15px 900 + 字距 2px）
    const fsz = Math.round(15 * Math.max(sc, 0.82));
    ctx.font = "bold " + fsz + "px sans-serif";
    const label2 = label.split("").join(String.fromCharCode(8202)); // 细空格模拟 letter-spacing
    text(label2, cx, cy + R * 0.42, ctx.font, "#fff");
    btn(cx - R, cy - R, D, D, cb);
  };

  ui.drawHome = () => {
    const { W, H, land, m, gap, safe } = layout();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.homeBg1); g.addColorStop(0.55, C.homeBg2); g.addColorStop(1, C.homeBg3);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 装饰气泡（原型首页小气泡：白边 + 半透明径向）
    ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const bx = (i * 53 + 20) % W, by = H - ((Date.now() / 30 + i * 97) % (H * 0.7));
      const r = 4 + (i % 3) * 3;
      const rg = ctx.createRadialGradient(bx - r * 0.15, by - r * 0.15, 0, bx, by, r);
      rg.addColorStop(0, "rgba(255,255,255,.35)"); rg.addColorStop(1, "rgba(255,255,255,.05)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    if (land) {
      const edgeL = safe.left + m, edgeR = W - safe.right - m;
      const availW = edgeR - edgeL, availH = H - safe.top - safe.bottom;
      const leftW = Math.min(300, Math.floor(availW * 0.38));
      const rightW = availW - leftW - gap * 2;
      const leftX = edgeL, rightX = leftX + leftW + gap * 2;
      const topY = safe.top;
      // 左侧内容块（标题+圆形开始按钮+设置/记录）垂直居中，并为底部提示小字预留空间
      const titleH = 62, subH = 44;
      const tight = availH < 420;                     // SE 级小屏收紧间距与提示字号
      const vgap = tight ? 10 : 16;
      const tfs = tight ? 9 : 10, tlh = tight ? 12 : 15;
      const tipsH = wrapTips(leftW - 2, tfs).length * tlh;
      const orbD = Math.max(96, Math.min(148, Math.floor(availH - tipsH - 26 - titleH - vgap - subH - m)));
      const blockH = titleH + orbD + vgap + subH;
      const blockTop = topY + Math.max(m, (availH - blockH - tipsH - 30) / 2);
      text(G.GAME_NAME, leftX + leftW / 2, blockTop + 16, "bold 28px sans-serif", C.ink);
      text("选一种猎物，开始今天的狩猎吧", leftX + leftW / 2, blockTop + 44, "14px sans-serif", C.ink2);

      const orbY = blockTop + titleH + orbD / 2;
      ui.drawStartOrb(leftX + leftW / 2, orbY, orbD, "开始游戏", () => G.startGame());

      const third = (leftW - gap * 2) / 3;
      const subY = orbY + orbD / 2 + vgap;
      drawBtn(leftX, subY, third, subH, "设置", { cb: () => { G.screen = "settings"; } });
      drawBtn(leftX + third + gap, subY, third, subH, "本周记录", { cb: () => { G.screen = "records"; } });
      drawBtn(leftX + (third + gap) * 2, subY, third, subH, "好友排行", { cb: () => { G.screen = "leaderboard"; ui.showLB(); } });

      // 适龄/健康忠告/安全/免责提示（左栏底部，自动折行）
      drawTips(leftX + 2, H - safe.bottom - tipsH - 8, leftW - 2, tlh, "left", tfs);

      // 右侧模式卡：限制最大尺寸并居中
      const cardMaxW = 210, cardMaxH = 170;
      const cw = Math.min((rightW - gap) / 2, cardMaxW);
      const ch = Math.min((availH - m * 2 - gap) / 2, cardMaxH);
      const totalW = cw * 2 + gap;
      const totalH = ch * 2 + gap;
      const gx = rightX + (rightW - totalW) / 2;
      const gy = topY + m + (availH - m * 2 - totalH) / 2;
      MODES.forEach((mItem, i) => {
        const x = gx + (i % 2) * (cw + gap), y = gy + Math.floor(i / 2) * (ch + gap);
        const sel = G.config.targetType === mItem.key;
        panel(x, y, cw, ch, sel ? "rgba(255,255,255,.98)" : C.card, sel ? C.teal : C.line);
        if (sel) { ctx.strokeStyle = C.teal; ctx.lineWidth = 2.5; G.rr(ctx, x, y, cw, ch, 16); ctx.stroke(); }
        ctx.save();
        ctx.translate(x + cw / 2, y + ch * 0.42);
        const bob = Math.sin(Date.now() / 500 + i) * 3;
        G.draw.icon(ctx, mItem.key, 0, bob, mItem.key === "fish" ? 0.62 : mItem.key === "mouse" ? 0.5 : mItem.key === "laser" ? 1.0 : 0.5);
        ctx.restore();
        text(mItem.name, x + cw / 2, y + ch - 36, "bold 16px sans-serif", sel ? C.tealDeep : C.ink);
        text(mItem.desc, x + cw / 2, y + ch - 18, "11px sans-serif", C.ink3);
        btn(x, y, cw, ch, () => { G.config.targetType = mItem.key; G.saveConfig(); G.playTick(); });
      });
    } else {
      const edgeL = safe.left + 18, edgeR = W - safe.right - 18;
      const availW = edgeR - edgeL, innerH = H - safe.top - safe.bottom;
      text(G.GAME_NAME, W / 2, safe.top + innerH * 0.10, "bold 30px sans-serif", C.ink);
      text("选一种猎物，开始今天的狩猎吧", W / 2, safe.top + innerH * 0.10 + 34, "14px sans-serif", C.ink2);
      const cw = (availW - 14) / 2, ch = 128, gx = edgeL, gy = safe.top + innerH * 0.16;
      MODES.forEach((mItem, i) => {
        const x = gx + (i % 2) * (cw + 14), y = gy + Math.floor(i / 2) * (ch + 14);
        const sel = G.config.targetType === mItem.key;
        panel(x, y, cw, ch, sel ? "rgba(255,255,255,.98)" : C.card, sel ? C.teal : C.line);
        if (sel) { ctx.strokeStyle = C.teal; ctx.lineWidth = 2.5; G.rr(ctx, x, y, cw, ch, 16); ctx.stroke(); }
        ctx.save();
        ctx.translate(x + cw / 2, y + 52);
        const bob = Math.sin(Date.now() / 500 + i) * 3;
        G.draw.icon(ctx, mItem.key, 0, bob, mItem.key === "fish" ? 0.62 : mItem.key === "mouse" ? 0.5 : mItem.key === "laser" ? 1.0 : 0.5);
        ctx.restore();
        text(mItem.name, x + cw / 2, y + ch - 34, "bold 16px sans-serif", sel ? C.tealDeep : C.ink);
        text(mItem.desc, x + cw / 2, y + ch - 14, "11px sans-serif", C.ink3);
        btn(x, y, cw, ch, () => { G.config.targetType = mItem.key; G.saveConfig(); G.playTick(); });
      });
      const by = gy + 2 * (ch + 14) + 10;
      const tipH2 = wrapTips(availW).length * 15;
      const tipsTop2 = H - safe.bottom - tipH2 - 8;
      const orbD2 = Math.max(96, Math.min(148, Math.floor(tipsTop2 - 14 - by - 56)));
      ui.drawStartOrb(W / 2, by + orbD2 / 2, orbD2, "开始游戏", () => G.startGame());
      const subY2 = by + orbD2 + 12;
      const tw = (availW - 20) / 3;
      drawBtn(edgeL, subY2, tw, 44, "设置", { cb: () => { G.screen = "settings"; } });
      drawBtn(edgeL + tw + 10, subY2, tw, 44, "本周记录", { cb: () => { G.screen = "records"; } });
      drawBtn(edgeL + (tw + 10) * 2, subY2, tw, 44, "好友排行", { cb: () => { G.screen = "leaderboard"; ui.showLB(); } });

      // 适龄/健康忠告/安全/免责提示（底部居中，自动折行）
      drawTips(W / 2, tipsTop2, availW, 15, "center");
    }
  };

  /* ================= 设置 ================= */
  ui.drawSettings = () => {
    const { W, H, land, m, gap, safe } = layout();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.subBg1); g.addColorStop(1, C.subBg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    text("设置", W / 2, safe.top + 54, "bold 24px sans-serif", C.ink);

    // 分组：对局（青绿点）/ 体验（琥珀点）
    const groups = [
      { title: "对局", dot: C.teal, rows: [] },
      { title: "体验", dot: C.amber, rows: [] }
    ];
    groups[0].rows.push(
      { label: "猎物数量", options: [{ label: "单只", val: 1 }, { label: "多只", val: 3 }], cur: G.config.preyCount, cb: v => { G.config.preyCount = v; } },
      { label: "难度", options: [{ label: "悠闲", val: "easy" }, { label: "标准", val: "normal" }, { label: "激烈", val: "hard" }], cur: G.config.difficulty, cb: v => { G.config.difficulty = v; } },
      { label: "时长", options: [{ label: "1 分钟", val: 60 }, { label: "3 分钟", val: 180 }, { label: "5 分钟", val: 300 }], cur: G.config.duration, cb: v => { G.config.duration = v; } }
    );
    groups[1].rows.push(
      { label: "音效", options: [{ label: "关", val: false }, { label: "开", val: true }], cur: G.config.sound, cb: v => { G.config.sound = v; } },
      { label: "震动", options: [{ label: "关", val: false }, { label: "开", val: true }], cur: G.config.vibrate, cb: v => { G.config.vibrate = v; } },
      { label: "自适应辅助", options: [{ label: "关", val: false }, { label: "开", val: true }], cur: G.config.adaptive, cb: v => { G.config.adaptive = v; } }
    );

    // 分组卡片：阴影 + 白卡 + 圆点标题 + 分隔线
    function card(x, y, w, h, dot, title, compact) {
      ctx.fillStyle = "rgba(31,64,58,.08)";
      G.rr(ctx, x + 1, y + 4, w - 2, h - 4, 20); ctx.fill();
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
      G.rr(ctx, x, y, w, h, 20); ctx.fill(); ctx.stroke();
      const headY = y + (compact ? 21 : 24);
      ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x + 22, headY, 5, 0, Math.PI * 2); ctx.fill();
      text(title, x + 36, headY, "bold 16px sans-serif", C.ink, "left");
      ctx.strokeStyle = "rgba(0,0,0,.06)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 16, y + (compact ? 38 : 42)); ctx.lineTo(x + w - 16, y + (compact ? 38 : 42)); ctx.stroke();
    }
    // 分段选择器：选中=白底+青绿描边+加粗深青；未选中=灰底浅字
    function seg(x, y, wTotal, h, r) {
      const ow = (wTotal - (r.options.length - 1) * 8) / r.options.length;
      r.options.forEach((op, idx) => {
        const on = op.val === r.cur;
        const ox = x + idx * (ow + 8);
        ctx.fillStyle = on ? C.card : C.segBg;
        ctx.strokeStyle = on ? C.teal : "transparent";
        ctx.lineWidth = on ? 2 : 0;
        G.rr(ctx, ox, y, ow, h, 12); ctx.fill(); ctx.stroke();
        text(op.label, ox + ow / 2, y + h / 2, on ? "bold 15px sans-serif" : "15px sans-serif", on ? C.tealDeep : C.ink2);
        btn(ox, y, ow, h, () => { r.cb(op.val); G.saveConfig(); G.playTick(); });
      });
    }

    const contentTop = safe.top + 84;
    const bottomLimit = H - safe.bottom - 92;
    const availCH = bottomLimit - contentTop;
    const btnH = 34;

    if (land) {
      // 双卡并排，行内布局：label 左 + 选项右；空间不足时切换紧凑档
      const fits = availCH >= 198;
      const headerH = fits ? 44 : 40, stride = fits ? 48 : 44, padB = fits ? 14 : 12;
      const cardH = headerH + 10 + 2 * stride + btnH + padB;
      const edgeL = safe.left + m, edgeR = W - safe.right - m;
      const availW = edgeR - edgeL;
      let cardW = Math.min((availW - gap) / 2, 440);
      const startX = edgeL + (availW - (cardW * 2 + gap)) / 2;
      const cardTop = contentTop + Math.max(0, (availCH - cardH) / 2);
      groups.forEach((grp, gi) => {
        const x = startX + gi * (cardW + gap);
        card(x, cardTop, cardW, cardH, grp.dot, grp.title, !fits);
        const labelW = Math.min(96, cardW * 0.28);
        grp.rows.forEach((r, ri) => {
          const ry = cardTop + headerH + 10 + ri * stride;
          text(r.label, x + 16, ry + btnH / 2, "15px sans-serif", C.ink2, "left");
          seg(x + 16 + labelW, ry, cardW - 32 - labelW, btnH, r);
        });
      });
    } else {
      // 竖屏：卡片纵堆，label 在选项上方
      const headerH = 42, labelH = 18, stride = 74, padB = 14;
      const cardH = headerH + 10 + 2 * stride + labelH + 8 + btnH + padB;
      const edgeL = safe.left + 18;
      const availW = W - safe.left - safe.right - 36;
      const cardW = Math.min(availW, 420);
      const startX = edgeL + (availW - cardW) / 2;
      const availCH2 = bottomLimit - contentTop;
      const cardTop = contentTop + Math.max(0, (availCH2 - (cardH * 2 + gap)) / 2);
      groups.forEach((grp, gi) => {
        const x = startX, y = cardTop + gi * (cardH + gap);
        card(x, y, cardW, cardH, grp.dot, grp.title, false);
        grp.rows.forEach((r, ri) => {
          const ry = y + headerH + 10 + ri * stride;
          text(r.label, x + 16, ry + labelH / 2, "15px sans-serif", C.ink2, "left");
          seg(x + 16, ry + labelH + 8, cardW - 32, btnH, r);
        });
      });
    }

    // 底部返回：原型主按钮青绿渐变（横屏限宽居中，避免次要按钮横贯全屏）
    let bw = land ? W - safe.left - safe.right - m * 2 : W - safe.left - safe.right - 48;
    let bx = land ? safe.left + m : safe.left + 24;
    if (land && bw > 360) { bx = (W - 360) / 2; bw = 360; }
    const by = H - safe.bottom - 75;
    const bg = ctx.createLinearGradient(bx, by, bx, by + 50);
    bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
    ctx.fillStyle = bg; ctx.strokeStyle = C.startInner; ctx.lineWidth = 1.2;
    G.rr(ctx, bx, by, bw, 50, 14); ctx.fill(); ctx.stroke();
    text("返回", W / 2, by + 25, "bold 18px sans-serif", "#fff");
    btn(bx, by, bw, 50, () => { G.screen = "home"; });
  };

  /* ================= 记录 ================= */
  ui.drawRecords = () => {
    const { W, H, land, m, gap, safe } = layout();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.subBg1); g.addColorStop(1, C.subBg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    text("本周记录", W / 2, safe.top + 54, "bold 24px sans-serif", C.ink);
    let logs = [];
    try { logs = JSON.parse(G.platform.storage.get("catToyLogs") || "[]"); } catch (e) {}
    if (!logs.length) text("还没有记录，来一局吧！", W / 2, safe.top + H * 0.4, "15px sans-serif", C.ink3);

    if (land) {
      const edgeL = safe.left + m, edgeR = W - safe.right - m;
      const availW = edgeR - edgeL;
      const availH = H - safe.top - safe.bottom;
      // 列表内容块限宽限高、整体垂直居中：大屏不挤顶、字段不至于拉太散
      const topLimit = safe.top + Math.max(70, Math.min(84, availH * 0.09)) + 40;
      const bottomLimit = H - safe.bottom - 92;
      const rowH = 52;
      const maxPerCol = Math.max(1, Math.floor((bottomLimit - topLimit) / rowH));
      const shown = Math.min(logs.length, maxPerCol * 2);
      const useCols = shown > maxPerCol;
      const listW = Math.min(availW, 900);
      const colW = useCols ? (listW - gap) / 2 : listW;
      const listH = Math.min(shown, useCols ? maxPerCol : shown) * rowH - 8;
      const listTop = topLimit + Math.max(0, (bottomLimit - topLimit - listH) / 2);
      const x1 = edgeL + (availW - listW) / 2, x2 = x1 + colW + gap;
      logs.slice(0, shown).forEach((L, i) => {
        const col = useCols ? (i < maxPerCol ? 0 : 1) : 0;
        const x = col === 0 ? x1 : x2;
        const y = listTop + (col === 0 ? i : i - maxPerCol) * rowH;
        ctx.fillStyle = C.card; ctx.strokeStyle = "#f0f6f3"; ctx.lineWidth = 1;
        G.rr(ctx, x, y, colW, 44, 12); ctx.fill(); ctx.stroke();
        text(L.date || "-", x + 12, y + 22, "13px sans-serif", C.ink3, "left");
        const typeName = { fish: "捕鱼", butterfly: "花园", mouse: "捕鼠", laser: "激光" }[L.type] || "";
        text(typeName, x + 62, y + 22, "13px sans-serif", C.ink3, "left");
        text("捕获 " + (L.hits || 0), x + colW * 0.44, y + 22, "bold 14px sans-serif", C.amberDeep, "left");
        text("命中 " + (L.accuracy || 0) + "%", x + colW * 0.64, y + 22, "13px sans-serif", C.tealDeep, "left");
        text("连击 " + (L.combo || 0), x + colW * 0.86, y + 22, "13px sans-serif", C.danger, "left");
      });
    } else {
      const edgeL = safe.left + 18, availW = W - safe.left - safe.right - 36;
      logs.slice(0, 10).forEach((L, i) => {
        const y = safe.top + 92 + i * 52;
        if (y > H - safe.bottom - 110) return;
        ctx.fillStyle = C.card; ctx.strokeStyle = "#f0f6f3"; ctx.lineWidth = 1;
        G.rr(ctx, edgeL, y, availW, 44, 12); ctx.fill(); ctx.stroke();
        text(L.date || "-", edgeL + 16, y + 22, "13px sans-serif", C.ink3, "left");
        const typeName = { fish: "捕鱼", butterfly: "花园", mouse: "捕鼠", laser: "激光" }[L.type] || "";
        text(typeName, edgeL + 90, y + 22, "13px sans-serif", C.ink3, "left");
        text("捕获 " + (L.hits || 0), edgeL + availW * 0.42, y + 22, "bold 14px sans-serif", C.amberDeep, "left");
        text("命中 " + (L.accuracy || 0) + "%", edgeL + availW * 0.60, y + 22, "13px sans-serif", C.tealDeep, "left");
        text("连击 " + (L.combo || 0), edgeL + availW * 0.80, y + 22, "13px sans-serif", C.danger, "left");
      });
    }
    let bw = land ? W - safe.left - safe.right - m * 2 : W - safe.left - safe.right - 48;
    let bx = land ? safe.left + m : safe.left + 24;
    if (land && bw > 360) { bx = (W - 360) / 2; bw = 360; }
    const by = H - safe.bottom - 75;
    const bg = ctx.createLinearGradient(bx, by, bx, by + 50);
    bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
    ctx.fillStyle = bg;
    G.rr(ctx, bx, by, bw, 50, 14); ctx.fill();
    text("返回", W / 2, by + 25, "bold 18px sans-serif", "#fff");
    btn(bx, by, bw, 50, () => { G.screen = "home"; });
  };

  /* ================= 好友排行（开放数据域渲染） =================
     列表本体由 openDataContext 画在透明覆盖层上；主域负责框架（标题/返回/说明）。
     好友关系链数据无需授权弹窗，仅含同玩本游戏的好友成绩，不涉及通讯录。 */
  function lbRect() {
    const { W, H, land, m, safe } = layout();
    const availW = W - safe.left - safe.right - m * 2;
    const top = safe.top + 96;
    const bottom = H - safe.bottom - 130;   // 底部预留两行说明 + 返回按钮
    const w = land ? Math.min(availW * 0.56, 560) : availW - 12;
    const h = Math.max(120, bottom - top);
    return { x: (W - w) / 2, y: top, w, h };
  }
  ui.showLB = () => {
    const r = lbRect();
    G.platform.odcPost({ type: "show", x: r.x, y: r.y, w: r.w, h: r.h });
  };
  ui.hideLB = () => { G.platform.odcPost({ type: "hide" }); };

  ui.drawLeaderboard = () => {
    const { W, H, land, m, safe } = layout();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.subBg1); g.addColorStop(1, C.subBg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    text("好友排行", W / 2, safe.top + 46, "bold 24px sans-serif", C.ink);
    text("展示同玩本游戏的微信好友单局最佳捕获", W / 2, safe.top + 74, "13px sans-serif", C.ink3);

    // 卡片区域由开放数据域绘制（覆盖层），此处只画卡外说明
    const r = lbRect();
    text("玩过本游戏的好友自动进入榜单，无需授权通讯录", W / 2, r.y + r.h + 20, "11px sans-serif", C.ink3);
    text("你的单局最高捕获数会在结算后自动更新", W / 2, r.y + r.h + 38, "11px sans-serif", C.ink3);

    let bw = land ? W - safe.left - safe.right - m * 2 : W - safe.left - safe.right - 48;
    let bx = land ? safe.left + m : safe.left + 24;
    if (land && bw > 360) { bx = (W - 360) / 2; bw = 360; }
    const by = H - safe.bottom - 75;
    const bg = ctx.createLinearGradient(bx, by, bx, by + 50);
    bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
    ctx.fillStyle = bg;
    G.rr(ctx, bx, by, bw, 50, 14); ctx.fill();
    text("返回", W / 2, by + 25, "bold 18px sans-serif", "#fff");
    btn(bx, by, bw, 50, () => { ui.hideLB(); G.screen = "home"; });
  };

  /* ================= 游戏内 HUD =================
     顶部信息条：整体更小更贴顶（safe.top+8），减少对游戏区的遮挡；
     连击不再弹跳圆徽，改为条内静态小徽 */
  ui.drawHud = (t, dt) => {
    const W = G.platform.W, H = G.platform.H, land = W > H;
    const safe = G.platform.safe || { top: 0, bottom: 0, left: 0, right: 0 };
    const S = G.session;
    ui.hudDimT += dt;
    const dim = ui.hudDimT > 3 ? 0.45 : 1;
    ctx.save();
    ctx.globalAlpha = dim;
    const hx = safe.left, hy = safe.top + 4;
    const PH2 = 28;   // 统一药丸高度
    const m = String(Math.max(Math.floor(S.remaining / 60), 0)).padStart(2, "0");
    const s = String(Math.max(S.remaining % 60, 0)).padStart(2, "0");
    const urgent = S.remaining <= 10 && S.remaining > 0;
    ctx.fillStyle = urgent ? C.hudUrgent : C.hudBg;
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1.2;
    // 倒计时（70×28）
    G.rr(ctx, hx + 10, hy, 70, PH2, 9); ctx.fill(); ctx.stroke();
    text(m + ":" + s, hx + 45, hy + PH2 / 2 + 1, "bold 15px sans-serif", urgent ? "#ffd7d7" : "#fff");
    // 捕获数（64×28）
    ctx.fillStyle = C.hitPill;
    G.rr(ctx, hx + 88, hy, 64, PH2, 9); ctx.fill(); ctx.stroke();
    text("🐾 " + S.hits, hx + 120, hy + PH2 / 2 + 1, "bold 13px sans-serif", "#fff");
    // 连击（静态小徽，无弹跳；combo>=2 才显示）
    if (S.combo >= 2) {
      const hot = S.combo >= 5;
      ctx.fillStyle = hot ? "rgba(255,107,74,.9)" : C.comboPill;
      G.rr(ctx, hx + 160, hy, 50, PH2, 9); ctx.fill(); ctx.stroke();
      text("×" + S.combo, hx + 185, hy + PH2 / 2 + 1, "bold 13px sans-serif", "#fff");
    }

    if (G.uiFX.stagePop > 0) {
      G.uiFX.stagePop -= dt;
      const p = clamp(G.uiFX.stagePop / 0.5, 0, 1);
      const sc2 = 1 + (1 - p) * 0.25;
      ctx.save();
      ctx.translate(W / 2, safe.top + 92);
      ctx.scale(sc2, sc2);
      ctx.globalAlpha = dim * clamp(p * 2, 0, 1);
      text(G.uiFX.stageText, 0, 0, "bold 17px sans-serif", C.amber);
      ctx.restore();
    }

    // 暂停按钮（36×36）：避开右上角微信胶囊按钮（退出/更多）
    // 横屏 → 胶囊左侧同高；竖屏 → 胶囊下方；无胶囊信息时退回旧位置
    ctx.fillStyle = C.pauseBg;
    const pw2 = 36;
    const menu = G.platform.menu;
    let px, py;
    if (menu && menu.width > 0) {
      if (land) {
        px = menu.left - 16 - pw2;
        py = menu.top + (menu.height - pw2) / 2;
        // 极窄屏：靠太左会撞 HUD 药丸（右端 hx+210 + 16px 间距），退到胶囊下方
        if (px < hx + 226) { px = W - safe.right - pw2 - 8; py = menu.bottom + 8; }
      } else {
        px = W - safe.right - pw2 - 8;
        py = menu.bottom + 8;
      }
    } else {
      px = W - safe.right - 52; py = hy;
    }
    G.rr(ctx, px, py, pw2, pw2, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fillRect(px + 11, py + 10, 4, 16); ctx.fillRect(px + 21, py + 10, 4, 16);
    // 长按进度环（600ms）：按住时白环从顶部顺时针填满
    const PH = G.pauseHold || { active: false, progress: 0 };
    if (PH.active && PH.progress > 0) {
      ctx.strokeStyle = C.teal; ctx.lineWidth = 3.5; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(px + pw2 / 2, py + pw2 / 2, 23, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * PH.progress);
      ctx.stroke();
      ctx.lineCap = "butt";
    }
    // 开局前 5 秒提示长按手势（避免玩家不知道怎么暂停）
    if (S.time < 5 && !PH.active) {
      ctx.globalAlpha = dim * Math.min(1, (5 - S.time) / 2);
      text("长按暂停", px + pw2 / 2, py + 48, "11px sans-serif", "rgba(255,255,255,.75)");
      ctx.globalAlpha = dim;
    }
    // 注册区域供 game.js 长按判定（不再走即时点击）
    ui.pauseRect = { x: px, y: py, w: pw2, h: pw2 };
    ctx.restore();
  };
  G.pokeHud = () => { ui.hudDimT = 0; };

  /* ================= 倒计时 ================= */
  ui.drawCountdown = (c) => {
    const W = G.platform.W, H = G.platform.H;
    ctx.fillStyle = C.countMask; ctx.fillRect(0, 0, W, H);
    const frac = c - Math.floor(c);
    const sc2 = 0.8 + frac * 0.5;
    ctx.save();
    ctx.translate(W / 2, H * 0.42); ctx.scale(sc2, sc2);
    ctx.globalAlpha = clamp(frac * 2, 0, 1);
    text(String(Math.ceil(c)), 0, 0, "bold 96px sans-serif", "#fff");
    ctx.restore();
    text("准备……", W / 2, H * 0.42 + 110, "18px sans-serif", "rgba(255,255,255,.85)");
  };

  /* ================= 暂停 ================= */
  ui.drawPause = () => {
    const W = G.platform.W, H = G.platform.H, land = W > H;
    const safe = G.platform.safe || { top: 0, bottom: 0, left: 0, right: 0 };
    const m = land ? 24 : 18;
    const innerW = W - safe.left - safe.right;
    const innerH = H - safe.top - safe.bottom;
    ctx.fillStyle = C.modalMask; ctx.fillRect(0, 0, W, H);
    const pw = Math.min(land ? 420 : W - 72, innerW - m * 2);
    const ph = Math.min(240, innerH - m * 2);
    const px = safe.left + (innerW - pw) / 2, py = safe.top + (innerH - ph) / 2;
    ctx.fillStyle = C.modalCard; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
    G.rr(ctx, px, py, pw, ph, 24); ctx.fill(); ctx.stroke();
    text("暂停中", W / 2, py + 44, "bold 22px sans-serif", C.ink);
    const bg = ctx.createLinearGradient(px + 24, py + 84, px + 24, py + 132);
    bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
    ctx.fillStyle = bg;
    G.rr(ctx, px + 24, py + 84, pw - 48, 48, 14); ctx.fill();
    text("继续本局", W / 2, py + 108, "bold 16px sans-serif", "#fff");
    btn(px + 24, py + 84, pw - 48, 48, () => { G.session.paused = false; G.screen = "playing"; });
    ctx.fillStyle = C.segBg; ctx.strokeStyle = C.line;
    G.rr(ctx, px + 24, py + 148, pw - 48, 48, 14); ctx.fill(); ctx.stroke();
    text("结束本局", W / 2, py + 172, "bold 16px sans-serif", C.ink);
    btn(px + 24, py + 148, pw - 48, 48, () => { G.session.paused = false; G.endGame(true); });
  };

  /* ================= 结算 ================= */
  ui.drawResult = () => {
    const { W, H, land, m, gap, safe } = layout();
    const innerH = H - safe.top - safe.bottom;
    const R = G.result || {};
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.subBg1); g.addColorStop(1, C.subBg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const cells = [
      ["触碰次数", R.touches || 0], ["总捕获", R.hits || 0],
      ["命中率", (R.acc || 0) + "%"], ["最高连击", R.maxCombo || 0]
    ];
    if (land) {
      const edgeL = safe.left + 24, edgeR = W - safe.right - 24;
      const availW = Math.min(edgeR - edgeL, 760);
      const centerX = (edgeL + edgeR) / 2;
      const leftX = centerX - availW / 2;
      const titleTop = safe.top + Math.max(60, Math.min(78, innerH * 0.10));
      text("本局结束", centerX, titleTop, "16px sans-serif", C.ink3);
      text(R.title || "", centerX, titleTop + 34, "bold 30px sans-serif", C.ink);
      text(R.desc || "", centerX, titleTop + 70, "14px sans-serif", C.ink2);
      // 卡片块在「标题底 ↔ 按钮顶」之间垂直居中：大屏不留大空档
      const chh = 78;
      const btnTop = H - safe.bottom - 64;
      const cardBlockH = chh + (R.bonusTag ? 34 : 0);
      const titleBottom = titleTop + 88;
      const cardY = titleBottom + Math.max(16, (btnTop - 18 - titleBottom - cardBlockH) / 2);
      const cw = (availW - gap * 3) / 4;
      cells.forEach((c, i) => {
        const x = leftX + i * (cw + gap);
        ctx.fillStyle = C.statBg; ctx.strokeStyle = C.statBorder; ctx.lineWidth = 1;
        G.rr(ctx, x, cardY, cw, chh, 18); ctx.fill(); ctx.stroke();
        text(c[0], x + cw / 2, cardY + 24, "13px sans-serif", C.ink2);
        text(String(c[1]), x + cw / 2, cardY + 54, "bold 26px sans-serif", C.ink);
      });
      if (R.bonusTag) text(R.bonusTag, centerX, cardY + chh + 20, "14px sans-serif", C.amberDeep);
      const bw = (availW - gap) / 2, by = btnTop;
      const bg = ctx.createLinearGradient(leftX, by, leftX, by + 46);
      bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
      ctx.fillStyle = bg;
      G.rr(ctx, leftX, by, bw, 46, 14); ctx.fill();
      text("再来一局", leftX + bw / 2, by + 23, "bold 17px sans-serif", "#fff");
      btn(leftX, by, bw, 46, () => G.startGame());
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line;
      G.rr(ctx, leftX + bw + gap, by, bw, 46, 14); ctx.fill(); ctx.stroke();
      text("返回首页", leftX + bw + gap + bw / 2, by + 23, "bold 17px sans-serif", C.ink);
      btn(leftX + bw + gap, by, bw, 46, () => { G.screen = "home"; G.clearPreys(); });
    } else {
      text("本局结束", W / 2, safe.top + innerH * 0.09, "16px sans-serif", C.ink3);
      text(R.title || "", W / 2, safe.top + innerH * 0.15, "bold 30px sans-serif", C.ink);
      text(R.desc || "", W / 2, safe.top + innerH * 0.15 + 38, "14px sans-serif", C.ink2);
      const edgeL = safe.left + 24, availW = W - safe.left - safe.right - 48;
      const cw = (availW - 12) / 2, chh = 78;
      const baseY = safe.top + innerH * 0.24;
      cells.forEach((c, i) => {
        const x = edgeL + (i % 2) * (cw + 12), y = baseY + Math.floor(i / 2) * (chh + 12);
        ctx.fillStyle = C.statBg; ctx.strokeStyle = C.statBorder; ctx.lineWidth = 1;
        G.rr(ctx, x, y, cw, chh, 18); ctx.fill(); ctx.stroke();
        text(c[0], x + cw / 2, y + 24, "13px sans-serif", C.ink2);
        text(String(c[1]), x + cw / 2, y + 54, "bold 26px sans-serif", C.ink);
      });
      if (R.bonusTag) text(R.bonusTag, W / 2, baseY + 2 * (chh + 12) + 16, "14px sans-serif", C.amberDeep);
      const by1 = H - safe.bottom - 168, by2 = H - safe.bottom - 104;
      const bg = ctx.createLinearGradient(edgeL, by1, edgeL, by1 + 54);
      bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
      ctx.fillStyle = bg;
      G.rr(ctx, edgeL, by1, availW, 54, 14); ctx.fill();
      text("再来一局", W / 2, by1 + 27, "bold 18px sans-serif", "#fff");
      btn(edgeL, by1, availW, 54, () => G.startGame());
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line;
      G.rr(ctx, edgeL, by2, availW, 50, 14); ctx.fill(); ctx.stroke();
      text("返回首页", W / 2, by2 + 25, "bold 17px sans-serif", C.ink);
      btn(edgeL, by2, availW, 50, () => { G.screen = "home"; G.clearPreys(); });
    }
  };
};
