/* ui.js — 全 Canvas 界面：首页 / 设置 / 记录 / HUD / 倒计时 / 暂停 / 结算
   配色严格对齐 H5 原型（浅色主题 + 青绿主色 + 琥珀强调） */
module.exports = function (G) {
  const ctx = G.platform.ctx;
  const clamp = G.clamp;
  const C = G.COLORS;
  const ui = { buttons: [], hudDimT: 0, stagePop: 0, stageText: "", comboPop: 0, comboShown: 0 };
  const SHOW_SUMMON = false;   // 召唤猫咪入口暂时隐藏：改 true 可恢复首页入口（页面代码保留）
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
  // 矢量小图标（与整体 UI 同风格，尺寸/颜色可控，避免 emoji 跨平台渲染不可控）
  function drawVecIcon(key, cx, cy, s, color) {
    const r = s / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (key === "gear") {
      ctx.lineWidth = Math.max(1.5, s * 0.16);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
    } else if (key === "chart") {
      const bw = s * 0.2;
      [0.45, 0.72, 1].forEach((hh, i) => {
        const bx = -r + bw * 0.1 + i * bw * 1.45;
        const bh2 = s * hh * 0.85;
        G.rr(ctx, bx, r - bh2, bw, bh2, bw * 0.3); ctx.fill();
      });
    } else if (key === "trophy") {
      ctx.lineWidth = Math.max(1.5, s * 0.12);
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.8); ctx.lineTo(r * 0.5, -r * 0.8);
      ctx.lineTo(r * 0.4, 0);
      ctx.quadraticCurveTo(0, r * 0.5, -r * 0.4, 0);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 0.68, -r * 0.45, r * 0.22, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(r * 0.68, -r * 0.45, r * 0.22, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, r * 0.45); ctx.lineTo(0, r * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.38, r * 0.85); ctx.lineTo(r * 0.38, r * 0.85); ctx.stroke();
    } else if (key === "cat") {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.15); ctx.lineTo(-r * 0.72, -r * 0.68); ctx.lineTo(-r * 0.05, -r * 0.48); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.15); ctx.lineTo(r * 0.72, -r * 0.68); ctx.lineTo(r * 0.05, -r * 0.48); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.52, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // 召唤猫咪页面的大猫咪插画
  function drawCat(cx, cy, s) {
    const c = "#6b7c75";
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.15); ctx.lineTo(-s * 0.78, -s * 0.75); ctx.lineTo(-s * 0.05, -s * 0.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * 0.5, -s * 0.15); ctx.lineTo(s * 0.78, -s * 0.75); ctx.lineTo(s * 0.05, -s * 0.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, s * 0.05, s * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-s * 0.24, s * 0.0, s * 0.1, 0, Math.PI * 2); ctx.arc(s * 0.24, s * 0.0, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath(); ctx.arc(-s * 0.24, s * 0.02, s * 0.05, 0, Math.PI * 2); ctx.arc(s * 0.24, s * 0.02, s * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff9aa2";
    ctx.beginPath(); ctx.moveTo(0, s * 0.14); ctx.lineTo(-s * 0.07, s * 0.07); ctx.lineTo(s * 0.07, s * 0.07); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.32)"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, s * 0.13); ctx.lineTo(-s * 0.62, s * 0.09);
    ctx.moveTo(-s * 0.08, s * 0.18); ctx.lineTo(-s * 0.62, s * 0.25);
    ctx.moveTo(s * 0.08, s * 0.13); ctx.lineTo(s * 0.62, s * 0.09);
    ctx.moveTo(s * 0.08, s * 0.18); ctx.lineTo(s * 0.62, s * 0.25);
    ctx.stroke();
    ctx.restore();
  }
  function drawBtn(x, y, w, h, label, opts) {
    const o = opts || {};
    ctx.fillStyle = o.primary ? C.startGrad1 : (o.on ? C.card : C.segBg);
    ctx.strokeStyle = o.primary ? C.teal : (o.on ? C.line : C.line);
    ctx.lineWidth = o.on ? 2 : 1.2;
    G.rr(ctx, x, y, w, h, 14); ctx.fill(); ctx.stroke();
    if (o.icon) {
      const lc = o.primary ? "#fff" : (o.on ? C.ink : C.ink2);
      const gap = 6;
      let fsize = o.primary ? 19 : 16;
      let lf = (o.primary ? "bold " : "") + fsize + "px sans-serif";
      ctx.font = lf;
      let tw = ctx.measureText(label).width;
      let ih = Math.min(15, h * 0.42);
      let total = ih + gap + tw;
      const pad = 10;                       // 左右内边距，保证不贴边
      const avail = w - pad;
      const scale = total > avail ? avail / total : 1;  // 超宽则整体等比缩小
      if (scale < 1) {
        fsize *= scale; ih *= scale;
        lf = (o.primary ? "bold " : "") + fsize + "px sans-serif";
        ctx.font = lf; tw = ctx.measureText(label).width;
        total = ih + gap + tw;
      }
      const iconX = x + w / 2 - total / 2;
      const labelX = iconX + ih + gap;
      drawVecIcon(o.icon, iconX + ih / 2, y + h / 2, ih, lc);
      text(label, labelX + tw / 2, y + h / 2 + 1, lf, lc);
    } else {
      text(label, x + w / 2, y + h / 2 + 1, o.primary ? "bold 19px sans-serif" : "16px sans-serif",
        o.primary ? "#fff" : (o.on ? C.ink : C.ink2));
    }
    btn(x, y, w, h, o.cb);
  }
  ui.panel = panel; ui.text = text; ui.drawBtn = drawBtn;

  function layout() {
    const S = G.platform.S || 1;
    // UI 在「虚拟手机尺寸」里布局，外层由 ctx.scale(S) 整体放大，字号/尺寸自动等比适配大屏
    const W = G.platform.W / S, H = G.platform.H / S;
    const sr = G.platform.safe || { top: 0, bottom: 0, left: 0, right: 0 };
    const safe = { top: sr.top / S, bottom: sr.bottom / S, left: sr.left / S, right: sr.right / S };
    const land = W > H;
    const m = land ? 24 : 18;
    const gap = 12;
    return { W, H, land, m, gap, safe, S };
  }

  /* ================= 首页 ================= */
  const MODES = [
    { key: "fish",      name: "深海捕鱼", desc: "三条小鱼随波游动" },
    { key: "butterfly", name: "蝴蝶花园", desc: "花间穿梭，还会停花" },
    { key: "mouse",     name: "捕鼠行动", desc: "打地鼠式两排洞口" },
    { key: "laser",     name: "激光暗室", desc: "甩动与停留的红点" },
    { key: "pool",      name: "暗夜萤光", desc: "发光小兽在石板上乱窜" }
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
  /* 横屏底部合规小字：四条合并后按宽度平衡折成两行，字号 10→7 自适应；
     实在放不下（极窄屏）退回普通多行折行 */
  function fitTips2(maxW) {
    const all = TIPS.join("   ");
    for (let fs = 10; fs >= 7; fs--) {
      ctx.font = fs + "px sans-serif";
      const chars = [...all];
      const total = ctx.measureText(all).width;
      let acc = 0, split = chars.length;
      for (let i = 0; i < chars.length; i++) {
        acc += ctx.measureText(chars[i]).width;
        if (acc >= total / 2) { split = i + 1; break; }
      }
      // 在平衡切点附近找最近的句读（。；空格）断行，避免词语被拦腰截断
      for (let d = 0; d <= 14; d++) {
        for (const j of [split - d, split + d]) {
          if (j > 0 && j < chars.length && "。； ".includes(chars[j - 1])) { split = j; d = 99; break; }
        }
      }
      const l1 = chars.slice(0, split).join(""), l2 = chars.slice(split).join("");
      if (Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) <= maxW) {
        return { lines: [l1, l2], fs, lh: fs + 5 };
      }
    }
    return { lines: wrapTips(maxW, 9), fs: 9, lh: 13 };
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
      // 左侧内容块（标题+圆形开始按钮）偏上放置：剩余空隙只取 30%，其余留在底部，为底部提示小字预留空间
      const titleH = 62, subH = 44;
      const tight = availH < 420;                     // SE 级小屏收紧间距
      const vgap = tight ? 10 : 16;
      // 底部合规小字：通栏两行（自适应字号），左栏/卡片均不再为其堆叠预留
      const tip2 = fitTips2(availW);
      const tipsH = tip2.lines.length * tip2.lh + 10;
      const orbD = Math.max(96, Math.min(148, Math.floor(availH - tipsH - 26 - titleH - vgap - m)));
      const blockH = titleH + orbD;
      const blockTop = topY + Math.max(m, (availH - blockH - tipsH - 30) * 0.3);
      text(G.GAME_NAME, leftX + leftW / 2, blockTop + 16, "bold 28px sans-serif", C.ink);
      text("选一种猎物，开始今天的狩猎吧", leftX + leftW / 2, blockTop + 44, "14px sans-serif", C.ink2);

      const orbY = blockTop + titleH + orbD / 2;
      ui.drawStartOrb(leftX + leftW / 2, orbY, orbD, "开始游戏", () => G.requestStart());

      // 适龄/健康忠告/安全/免责提示（底部通栏两行居中）
      ctx.globalAlpha = 0.75;
      const tipsTop = H - safe.bottom - tipsH;
      tip2.lines.forEach((s, i) => text(s, edgeL, tipsTop + 6 + i * tip2.lh, tip2.fs + "px sans-serif", C.ink3, "left"));
      ctx.globalAlpha = 1;

      // 右侧：单张「模式选择」卡片
      const headH = 34, rowH = 46, pad = 12;
      // 底部通栏一行：设置/本周记录/好友排行（召唤猫咪入口按 SHOW_SUMMON 开关）
      const rowY = tipsTop - rowH - 8;
      const rowBtns = [
        { label: "设置", icon: "gear", cb: () => { G.screen = "settings"; } },
        { label: "本周记录", icon: "chart", cb: () => { G.screen = "records"; } },
        { label: "好友排行", icon: "trophy", cb: () => { G.screen = "leaderboard"; G.track("lb_open", { best: Number(G.platform.storage.get("catToyBest")) || 0 }); ui.showLB(); } }
      ];
      if (SHOW_SUMMON) rowBtns.push({ label: "召唤猫咪", icon: "cat", cb: () => { G.ensureAudio(); G.screen = "summon"; } });
      const bwN = (availW - gap * (rowBtns.length - 1)) / rowBtns.length;
      rowBtns.forEach((b, i) => drawBtn(edgeL + (bwN + gap) * i, rowY, bwN, rowH, b.label, { icon: b.icon, cb: b.cb }));

      const cardTop = topY + m;
      const cardBottomLimit = rowY - m;
      const gridH = cardBottomLimit - cardTop - headH - pad; // 卡内网格区高度
      // 5 个模式时改 3 列×2 行（保持 2 行不动垂直空间，避免横屏矮屏卡片区压到按钮行）
      const cols = MODES.length > 4 ? 3 : 2;
      const rows = Math.ceil(MODES.length / cols);
      const cw = Math.min((rightW - gap * (cols - 1)) / cols, 148);
      // 卡高下限 60 而不是 76：真机横屏带刘海时（safe.left/right≈44、bottom≈34），高度预算变紧，
      // 76 保底会让卡片盖住底部按钮行；60 时图标按 0.3 缩放下限刚好不压模式名
      const ch = Math.min(Math.max((gridH - gap * (rows - 1)) / rows, 60), 112);
      const totalW = cw * cols + gap * (cols - 1);
      const totalH = ch * rows + gap * (rows - 1);
      const gx = rightX + (rightW - totalW) / 2;
      const cardW = totalW + pad * 2, cardH = headH + totalH + pad;
      const cardX = gx - pad;
      // 卡片缩到更紧后，在可用区里垂直居中（不再死盯顶部，避免上方大片留白）
      const cardY = Math.max(cardTop, cardTop + (cardBottomLimit - cardTop - cardH) / 2);
      // 卡片容器
      ctx.fillStyle = "rgba(31,64,58,.08)";
      G.rr(ctx, cardX + 1, cardY + 4, cardW - 2, cardH - 4, 20); ctx.fill();
      panel(cardX, cardY, cardW, cardH, C.card, C.line);
      text("模式选择", cardX + 18, cardY + headH / 2, "bold 16px sans-serif", C.ink, "left");
      const gy = cardY + headH;
      MODES.forEach((mItem, i) => {
        const x = gx + (i % cols) * (cw + gap), y = gy + Math.floor(i / cols) * (ch + gap);
        const sel = G.config.targetType === mItem.key;
        panel(x, y, cw, ch, sel ? "rgba(255,255,255,.98)" : C.card, sel ? C.teal : C.line);
        if (sel) { ctx.strokeStyle = C.teal; ctx.lineWidth = 2.5; G.rr(ctx, x, y, cw, ch, 16); ctx.stroke(); }
        // 自适应布局：图标占「文字区之上」的剩余空间并随卡高缩放，矮卡不再与文字重叠
        const iconZone = ch - 42;
        const baseS = mItem.key === "fish" ? 0.55 : mItem.key === "mouse" ? 0.45 : mItem.key === "laser" ? 1.0 : mItem.key === "pool" ? 1.0 : mItem.key === "butterfly" ? 0.6 : 0.5;
        const scl = Math.min(baseS, Math.max(0.3, (iconZone - 6) / 115));
        ctx.save();
        ctx.translate(x + cw / 2, y + iconZone / 2);
        const bob = Math.sin(Date.now() / 500 + i) * 2;
        G.draw.icon(ctx, mItem.key, 0, bob, scl);
        ctx.restore();
        text(mItem.name, x + cw / 2, y + ch - 30, "bold 13px sans-serif", sel ? C.tealDeep : C.ink);
        text(mItem.desc, x + cw / 2, y + ch - 14, "9.5px sans-serif", C.ink3);
        btn(x, y, cw, ch, () => {
          if (G.config.targetType !== mItem.key) G.track("mode_pick", { mode: mItem.key });
          G.config.targetType = mItem.key; G.saveConfig(); G.playTick();
        });
      });
    } else {
      const edgeL = safe.left + 18, edgeR = W - safe.right - 18;
      const availW = edgeR - edgeL, innerH = H - safe.top - safe.bottom;
      text(G.GAME_NAME, W / 2, safe.top + innerH * 0.10, "bold 30px sans-serif", C.ink);
      text("选一种猎物，开始今天的狩猎吧", W / 2, safe.top + innerH * 0.10 + 34, "14px sans-serif", C.ink2);
      const colsP = MODES.length > 4 ? 3 : 2;
      const rowsP = Math.ceil(MODES.length / colsP);
      const cw = (availW - 14 * (colsP - 1)) / colsP, ch = 88, gx = edgeL, gy = safe.top + innerH * 0.16;
      // 模式选择卡片容器
      const cardX = gx - 12, cardY = gy - 36, cardW = availW + 24, cardH = ch * rowsP + 14 * (rowsP - 1) + 36;
      ctx.fillStyle = "rgba(31,64,58,.08)";
      G.rr(ctx, cardX + 1, cardY + 4, cardW - 2, cardH - 4, 20); ctx.fill();
      panel(cardX, cardY, cardW, cardH, C.card, C.line);
      text("模式选择", cardX + 18, cardY + 22, "bold 16px sans-serif", C.ink, "left");
      const gy2 = gy;
      MODES.forEach((mItem, i) => {
        const x = gx + (i % colsP) * (cw + 14), y = gy2 + Math.floor(i / colsP) * (ch + 14);
        const sel = G.config.targetType === mItem.key;
        panel(x, y, cw, ch, sel ? "rgba(255,255,255,.98)" : C.card, sel ? C.teal : C.line);
        if (sel) { ctx.strokeStyle = C.teal; ctx.lineWidth = 2.5; G.rr(ctx, x, y, cw, ch, 16); ctx.stroke(); }
        const iconZone = ch - 42;
        const baseS = mItem.key === "fish" ? 0.55 : mItem.key === "mouse" ? 0.45 : mItem.key === "laser" ? 1.0 : mItem.key === "pool" ? 1.0 : mItem.key === "butterfly" ? 0.6 : 0.5;
        const scl = Math.min(baseS, Math.max(0.3, (iconZone - 6) / 115));
        ctx.save();
        ctx.translate(x + cw / 2, y + iconZone / 2);
        const bob = Math.sin(Date.now() / 500 + i) * 2;
        G.draw.icon(ctx, mItem.key, 0, bob, scl);
        ctx.restore();
        text(mItem.name, x + cw / 2, y + ch - 30, "bold 13px sans-serif", sel ? C.tealDeep : C.ink);
        text(mItem.desc, x + cw / 2, y + ch - 14, "9.5px sans-serif", C.ink3);
        btn(x, y, cw, ch, () => {
          if (G.config.targetType !== mItem.key) G.track("mode_pick", { mode: mItem.key });
          G.config.targetType = mItem.key; G.saveConfig(); G.playTick();
        });
      });
      // 召唤猫咪入口（暂时隐藏，恢复时改回 SHOW_SUMMON）
      const cardBottom = cardY + cardH;
      let afterCard = cardBottom + 12;
      if (SHOW_SUMMON) {
        drawBtn(edgeL, afterCard, availW, 46, "召唤猫咪", { icon: "cat", cb: () => { G.ensureAudio(); G.screen = "summon"; } });
        afterCard += 46 + 14;
      }
      const by = afterCard;
      const tipH2 = wrapTips(availW).length * 15;
      const tipsTop2 = H - safe.bottom - tipH2 - 8;
      const orbD2 = Math.max(96, Math.min(148, Math.floor(tipsTop2 - 14 - by - 84)));
      ui.drawStartOrb(W / 2, by + orbD2 / 2, orbD2, "开始游戏", () => G.requestStart());
      const subY2 = by + orbD2 + 40;
      const tw = (availW - 20) / 3;
      drawBtn(edgeL, subY2, tw, 44, "设置", { icon: "gear", cb: () => { G.screen = "settings"; } });
      drawBtn(edgeL + tw + 10, subY2, tw, 44, "本周记录", { icon: "chart", cb: () => { G.screen = "records"; } });
      drawBtn(edgeL + (tw + 10) * 2, subY2, tw, 44, "好友排行", { icon: "trophy", cb: () => { G.screen = "leaderboard"; G.track("lb_open", { best: Number(G.platform.storage.get("catToyBest")) || 0 }); ui.showLB(); } });

      // 适龄/健康忠告/安全/免责提示（底部居中，自动折行）
      drawTips(edgeL, tipsTop2, availW, 15, "left");
    }
  };

  /* ================= 设置 ================= */
  /* 背景缩略预览：不复用 drawScene（依赖全局 scene 状态），各背景单独画一张小图 */
  function drawBgPreview(c, key, x, y, w, h) {
    c.save();
    G.rr(c, x, y, w, h, 12); c.clip();
    if (key === "neon") {
      // 霓虹格毯：更黑 + 更大格 + 几个彩色微光点
      c.fillStyle = "#0b100b"; c.fillRect(x, y, w, h);
      c.strokeStyle = "rgba(190,210,175,.12)"; c.lineWidth = 1;
      for (let i = -h; i < w + h; i += 7) { c.beginPath(); c.moveTo(x + i, y); c.lineTo(x + i + h, y + h); c.stroke(); }
      const nc = Math.max(34, Math.round(w / 4));
      for (let ix = 0, gx = x; gx < x + w; ix++, gx += nc) {
        for (let iy = 0, gy = y; gy < y + h; iy++, gy += nc) {
          c.fillStyle = (ix + iy) % 2 === 0 ? "rgba(0,0,0,.34)" : "rgba(118,132,92,.18)";
          c.fillRect(gx, gy, nc, nc);
        }
      }
      c.strokeStyle = "rgba(0,0,0,.55)"; c.lineWidth = 1.8;
      for (let gx = x; gx <= x + w; gx += nc) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx, y + h); c.stroke(); }
      for (let gy = y; gy <= y + h; gy += nc) { c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w, gy); c.stroke(); }
      const dots = [[0.2, 0.34, "94,240,224"], [0.63, 0.26, "255,122,192"], [0.38, 0.72, "255,228,94"], [0.8, 0.62, "157,140,255"]];
      dots.forEach(d => {
        const dx = x + w * d[0], dy = y + h * d[1];
        const rg = c.createRadialGradient(dx, dy, 0, dx, dy, 16);
        rg.addColorStop(0, "rgba(" + d[2] + ",.55)"); rg.addColorStop(1, "rgba(" + d[2] + ",0)");
        c.fillStyle = rg; c.beginPath(); c.arc(dx, dy, 16, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(" + d[2] + ",.95)";
        c.beginPath(); c.arc(dx, dy, 3, 0, Math.PI * 2); c.fill();
      });
    } else if (key === "plaid") {
      c.fillStyle = "#0f1410"; c.fillRect(x, y, w, h);
      c.strokeStyle = "rgba(178,206,178,.10)"; c.lineWidth = 1;
      for (let i = -h; i < w + h; i += 8) { c.beginPath(); c.moveTo(x + i, y); c.lineTo(x + i + h, y + h); c.stroke(); }
      const cell = Math.max(20, Math.round(w / 8));
      for (let ix = 0, gx = x; gx < x + w; ix++, gx += cell) {
        for (let iy = 0, gy = y; gy < y + h; iy++, gy += cell) {
          c.fillStyle = (ix + iy) % 2 === 0 ? "rgba(0,0,0,.35)" : "rgba(150,180,140,.07)";
          c.fillRect(gx, gy, cell, cell);
        }
      }
      // 荧光小点（示意猎物）
      const fx2 = x + w * 0.68, fy2 = y + h * 0.42;
      const rg = c.createRadialGradient(fx2, fy2, 0, fx2, fy2, 20);
      rg.addColorStop(0, "rgba(226,255,130,.45)"); rg.addColorStop(1, "rgba(226,255,130,0)");
      c.fillStyle = rg; c.beginPath(); c.arc(fx2, fy2, 20, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(240,255,150,.95)";
      c.beginPath(); c.arc(fx2, fy2, 5, 0, Math.PI * 2); c.fill();
    } else {
      // 室内：墙 + 地板木纹 + 窗光 + 两个洞口
      c.fillStyle = "#554b40"; c.fillRect(x, y, w, h * 0.42);
      c.fillStyle = "#7a6a58"; c.fillRect(x, y + h * 0.42, w, h * 0.58);
      c.strokeStyle = "rgba(0,0,0,.16)"; c.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const yy = y + h * 0.42 + (h * 0.58 / 5) * i;
        c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke();
      }
      c.fillStyle = "rgba(205,232,255,.5)";
      c.fillRect(x + w * 0.62, y + h * 0.1, w * 0.24, h * 0.23);
      c.fillStyle = "#2b211a";
      [0.28, 0.62].forEach(f => {
        c.beginPath(); c.ellipse(x + w * f, y + h * 0.8, w * 0.06, h * 0.045, 0, 0, Math.PI * 2); c.fill();
      });
    }
    c.restore();
  }

  /* ================= 背景选择层（左右滑动，一屏约 1.5 张卡） =================
     卡片本身不注册按钮（走拖动判定），弹层开头清空按钮表，避免命中首页残留按钮。 */
  ui.drawBgPick = () => {
    const { W, H, safe } = layout();
    const P = G.bgPick;
    if (!P) return;
    const list = G.bgsFor(G.config.targetType);
    ui.buttons.length = 0;                                  // 弹层独占按钮表

    // 实底渐变（不叠首页：首页大标题会和"选择背景"叠字，底部合规小字也会透出来）
    const bgG = ctx.createLinearGradient(0, 0, W, H);
    bgG.addColorStop(0, C.homeBg1); bgG.addColorStop(0.55, C.homeBg2); bgG.addColorStop(1, C.homeBg3);
    ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(6,22,20,.55)"; ctx.fillRect(0, 0, W, H);

    const CW = Math.round(W * 0.64);                        // 卡宽 ≈ 0.64 屏 → 露出一半下一张
    const CH = Math.min(Math.round(H * 0.44), Math.round(CW * 0.6));
    const gap = Math.round(W * 0.035);
    const pad = Math.round(W * 0.05);
    const step = CW + gap;
    P.cw = CW; P.gap = gap;
    // 整块（标题 + 卡片 + 指示点 + 按钮）垂直居中，避免横屏压到首页 UI、竖屏顶在上面
    const bh = 44;
    const blockH = 30 + CH + 24 + 16 + bh;
    const top = Math.max(safe.top + 16, Math.round((H - blockH) / 2));
    const cardY = top + 30;

    text("选择背景", pad, cardY - 18, "bold 17px sans-serif", "#fff", "left");
    text("左右滑动切换", pad + 78, cardY - 17, "11px sans-serif", "rgba(255,255,255,.7)", "left");

    // 画廊：裁到屏幕内，滑出的卡不画到屏幕外
    ctx.save();
    ctx.beginPath(); ctx.rect(0, cardY - 6, W, CH + 12); ctx.clip();
    const baseX = pad - P.idx * step + (P.off || 0);
    list.forEach((b, i) => {
      const x = baseX + i * step;
      if (x > W || x + CW < 0) return;
      const active = i === P.idx;
      panel(x, cardY, CW, CH, active ? "#fbfaf7" : "rgba(250,249,245,.86)", active ? C.teal : "rgba(255,255,255,.5)");
      if (active) { ctx.strokeStyle = C.teal; ctx.lineWidth = 2.5; G.rr(ctx, x, cardY, CW, CH, 16); ctx.stroke(); }
      const pvH = Math.round(CH * 0.64);
      drawBgPreview(ctx, b.key, x + 10, cardY + 10, CW - 20, pvH - 10);
      text(b.name, x + CW / 2, cardY + pvH + 16, "bold 15px sans-serif", active ? C.tealDeep : C.ink);
      text(b.desc, x + CW / 2, cardY + pvH + 34, "10.5px sans-serif", C.ink3);
    });
    ctx.restore();

    // 指示点
    const dotY = cardY + CH + 14;
    list.forEach((b, i) => {
      const dx = W / 2 + (i - (list.length - 1) / 2) * 16;
      ctx.fillStyle = i === P.idx ? C.teal : "rgba(255,255,255,.35)";
      ctx.beginPath(); ctx.arc(dx, dotY, i === P.idx ? 4 : 3, 0, Math.PI * 2); ctx.fill();
    });

    // 开始按钮（宽条按钮，比圆形开始球更适配方屏；紧随指示点，整块居中）
    const bw = Math.min(Math.round(W * 0.42), 260);
    const bx = (W - bw) / 2, by = Math.min(dotY + 16, H - safe.bottom - bh - 12);
    ctx.fillStyle = C.tealDeep;
    G.rr(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.4;
    G.rr(ctx, bx + 3, by + 3, bw - 6, bh - 6, (bh - 6) / 2); ctx.stroke();
    text("开始游戏", W / 2, by + bh / 2, "bold 16px sans-serif", "#fff");
    btn(bx, by, bw, bh, () => G.confirmBgPick());

    // 关闭（右上角 ×）
    const cs = 30, cx = W - safe.right - cs - 10, cy = safe.top + 8;
    ctx.fillStyle = "rgba(255,255,255,.16)";
    ctx.beginPath(); ctx.arc(cx + cs / 2, cy + cs / 2, cs / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx + cs * 0.34, cy + cs * 0.34); ctx.lineTo(cx + cs * 0.66, cy + cs * 0.66);
    ctx.moveTo(cx + cs * 0.66, cy + cs * 0.34); ctx.lineTo(cx + cs * 0.34, cy + cs * 0.66);
    ctx.stroke();
    btn(cx, cy, cs, cs, () => G.closeBgPick());
  };

  ui.drawSettings = () => {
    const { W, H, land, m, gap, safe } = layout();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.subBg1); g.addColorStop(1, C.subBg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 标题左上角横排一行（原居中两行占 84px 顶部，会把卡片挤成紧凑档、按钮压到底边）
    const titleFont = "bold 22px sans-serif";
    text("设置", safe.left + m, safe.top + 28, titleFont, C.ink, "left");
    ctx.font = titleFont;
    const titleW = ctx.measureText("设置").width;
    text("逗猫偏好，一次设好", safe.left + m + titleW + 12, safe.top + 29, "13px sans-serif", C.ink3, "left");

    // 分组：对局（青绿点）/ 体验（琥珀点）
    const groups = [
      { title: "对局", dot: C.teal, rows: [] },
      { title: "体验", dot: C.amber, rows: [] }
    ];
    groups[0].rows.push(
      { label: "猎物数量", options: [{ label: "单只", val: 1 }, { label: "多只", val: 3 }], cur: G.config.preyCount, cb: v => { G.config.preyCount = v; } },
      { label: "难度", options: [{ label: "悠闲", val: "easy" }, { label: "标准", val: "normal" }, { label: "激烈", val: "hard" }], cur: G.config.difficulty, cb: v => { G.config.difficulty = v; } },
      { label: "时长", options: [{ label: "1 分钟", val: 60 }, { label: "3 分钟", val: 180 }, { label: "5 分钟", val: 300 }, { label: "∞ 无限", val: 0 }], cur: G.config.infinite ? 0 : G.config.duration, cb: v => { if (v === 0) G.config.infinite = true; else { G.config.infinite = false; G.config.duration = v; } } }
    );
    groups[1].rows.push(
      { label: "音效", options: [{ label: "关", val: false }, { label: "开", val: true }], cur: G.config.sound, cb: v => { G.config.sound = v; } },
      { label: "震动", options: [{ label: "关", val: false }, { label: "开", val: true }], cur: G.config.vibrate, cb: v => { G.config.vibrate = v; } },
      { label: "自适应辅助", options: [{ label: "关", val: false }, { label: "开", val: true }], cur: G.config.adaptive, cb: v => { G.config.adaptive = v; } }
    );

    // 分组卡片：柔和阴影 + 白卡 + 圆点标题 + 分隔线
    function card(x, y, w, h, dot, title, compact) {
      // 柔和投影（绘制后重置，避免污染后续绘制）
      ctx.save();
      ctx.shadowColor = "rgba(20,49,58,.12)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
      ctx.fillStyle = C.card;
      G.rr(ctx, x, y, w, h, 22); ctx.fill();
      ctx.restore();
      // 描边：G.rr 内部会 fill，须显式给白底，否则被 restore 后遗留的 fillStyle（如文字色）覆盖
      ctx.fillStyle = C.card;
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
      G.rr(ctx, x, y, w, h, 22); ctx.stroke();
      const headY = y + (compact ? 21 : 24);
      // 圆点 + 外圈微光
      ctx.save(); ctx.globalAlpha = .18;
      ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x + 22, headY, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x + 22, headY, 5, 0, Math.PI * 2); ctx.fill();
      text(title, x + 38, headY, "bold 16px sans-serif", C.ink, "left");
      ctx.strokeStyle = "rgba(0,0,0,.05)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 16, y + (compact ? 38 : 42)); ctx.lineTo(x + w - 16, y + (compact ? 38 : 42)); ctx.stroke();
    }
    // 分段选择器：选中=青绿渐变填充+白字（像"按下"的按钮）；未选中=极淡灰+深青灰字
    function seg(x, y, wTotal, h, r) {
      const ow = (wTotal - (r.options.length - 1) * 8) / r.options.length;
      r.options.forEach((op, idx) => {
        const on = op.val === r.cur;
        const ox = x + idx * (ow + 8);
        if (on) {
          const grad = ctx.createLinearGradient(ox, y, ox, y + h);
          grad.addColorStop(0, C.startGrad0); grad.addColorStop(1, C.startGrad1);
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = C.segBg;
        }
        ctx.strokeStyle = "transparent"; ctx.lineWidth = 0;
        G.rr(ctx, ox, y, ow, h, 12); ctx.fill();
        if (on) { ctx.strokeStyle = C.startGrad1; ctx.lineWidth = 1.2; ctx.stroke(); }
        text(op.label, ox + ow / 2, y + h / 2, on ? "bold 15px sans-serif" : "15px sans-serif", on ? "#fff" : C.ink2);
        btn(ox, y, ow, h, () => { r.cb(op.val); G.saveConfig(); G.playTick(); });
      });
    }

    // 标题收到左上角后顶部只需留 52px；底部预留加大到 104px，让返回等按钮不贴屏幕底边
    const contentTop = safe.top + 52;
    const bottomLimit = H - safe.bottom - 104;
    const availCH = bottomLimit - contentTop;
    const btnH = 34;

    if (land) {
      // 双卡并排，行内布局：label 左 + 选项右；空间不足时切换紧凑档
      // 阈值 = 完整档实际卡高 190（旧值 180 会算出放不下的卡、压到功能行）
      const fits = availCH >= 190;
      const headerH = fits ? 42 : 38, stride = fits ? 46 : 42, padB = fits ? 12 : 9;
      const rowH = fits ? 34 : 32;   // 选项行高（空间不足时略压，给底部功能行让位）
      const cardH = headerH + 10 + 2 * stride + rowH + padB;
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
          text(r.label, x + 16, ry + rowH / 2, "15px sans-serif", C.ink2, "left");
          seg(x + 16 + labelW, ry, cardW - 32 - labelW, rowH, r);
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

    // 底部一行：联系客服（白卡）/ 分享给好友（青绿字白卡）/ 返回（青绿渐变主按钮）
    let bw = land ? W - safe.left - safe.right - m * 2 : W - safe.left - safe.right - 48;
    let bx = land ? safe.left + m : safe.left + 24;
    if (land && bw > 440) { bx = (W - 440) / 2; bw = 440; }
    const gapB = 12;
    const cw = (bw - gapB * 2) / 3;
    // 底部功能行：屏幕常亮（iOS 风格开关）+ 防误触说明（带图标按钮），两块等高等宽对称
    const fy = bottomLimit + 8;
    const fh = 38;            // 功能块高
    const bh = 34;            // 主按钮高
    const by = fy + fh + 8;   // 功能行 + 8 间距

    // iOS 风格开关：开=青绿渐变、关=浅灰，白色圆形滑块带微阴影
    function toggle(cx, cy, w, h, on, cb) {
      const r = h / 2;
      ctx.save();
      if (on) {
        const grad = ctx.createLinearGradient(cx, cy, cx + w, cy);
        grad.addColorStop(0, C.startGrad0); grad.addColorStop(1, C.startGrad1);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = "#e1eae7";
      }
      G.rr(ctx, cx, cy, w, h, r);
      const knob = h - 6;
      const kx = on ? cx + w - r - 3 : cx + r + 3;
      ctx.shadowColor = "rgba(0,0,0,.2)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(kx, cy + r, knob / 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      btn(cx, cy, w, h, cb);
    }

    // 屏幕常亮块（白卡，左标签 + 右开关）
    {
      const fw = (bw - gapB) / 2;
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
      G.rr(ctx, bx, fy, fw, fh, 12); ctx.fill(); ctx.stroke();
      text("屏幕常亮", bx + 16, fy + fh / 2, "bold 15px sans-serif", C.ink, "left");
      const on = !!G.config.keepScreen;
      const tw = 52, th = 30;
      toggle(bx + fw - tw - 14, fy + (fh - th) / 2, tw, th, on, () => {
        G.config.keepScreen = !on;
        try { G.platform.keepScreen(G.config.keepScreen); } catch (e) {}
        G.session._keepOn = G.config.keepScreen;
        G.saveConfig(); G.playTick();
      });
    }
    // 防误触说明块（白卡，图标 + 文字整体居中）
    {
      const fw = (bw - gapB) / 2;
      const tx = bx + fw + gapB;
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
      G.rr(ctx, tx, fy, fw, fh, 12); ctx.fill(); ctx.stroke();
      const iy = fy + fh / 2;
      ctx.font = "bold 15px sans-serif";
      const tw = ctx.measureText("防误触说明").width;
      const gx = tx + (fw - (22 + 12 + tw)) / 2;   // 图标22 + 间距12 + 文字，整组居中
      const ix = gx + 11;
      ctx.fillStyle = C.teal; ctx.beginPath(); ctx.arc(ix, iy, 11, 0, Math.PI * 2); ctx.fill();
      text("?", ix, iy, "bold 15px sans-serif", "#fff");
      text("防误触说明", gx + 34, iy, "bold 15px sans-serif", C.teal, "left");
      btn(tx, fy, fw, fh, () => { try { G.platform.antiGuide(() => {}); } catch (e) {} });
    }

    // 联系客服 / 分享给好友 / 返回（主按钮带柔和投影）
    ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
    G.rr(ctx, bx, by, cw, bh, 13); ctx.fill(); ctx.stroke();
    text("联系客服", bx + cw / 2, by + bh / 2, "bold 15px sans-serif", C.ink);
    btn(bx, by, cw, bh, () => G.platform.openSupport());
    // 分享给好友：无本局结果时回落「猫档案」测评图，带我家猫的战绩邀请好友来比
    const bx2 = bx + cw + gapB;
    ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
    G.rr(ctx, bx2, by, cw, bh, 13); ctx.fill(); ctx.stroke();
    text("分享给好友", bx2 + cw / 2, by + bh / 2, "bold 15px sans-serif", C.teal);
    btn(bx2, by, cw, bh, () => { try { G.shareInvite("settings"); } catch (e) {} });
    // 返回
    const bx3 = bx2 + cw + gapB;
    ctx.save();
    ctx.shadowColor = "rgba(20,160,147,.35)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
    const bg = ctx.createLinearGradient(bx3, by, bx3, by + bh);
    bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
    ctx.fillStyle = bg; G.rr(ctx, bx3, by, cw, bh, 13); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = C.startInner; ctx.lineWidth = 1.2; G.rr(ctx, bx3, by, cw, bh, 13); ctx.stroke();
    text("返回", bx3 + cw / 2, by + bh / 2, "bold 17px sans-serif", "#fff");
    btn(bx3, by, cw, bh, () => { G.screen = "home"; });
  };

  /* ================= 记录 ================= */
  ui.drawRecords = () => {
    const { W, H, land, m, gap, safe } = layout();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.subBg1); g.addColorStop(1, C.subBg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    text("本周记录", W / 2, safe.top + 54, "bold 24px sans-serif", C.ink);
    // 安全读取：历史里若混入 null / 非对象元素，原样 forEach 会抛错（记录页白屏）
    const logs = G.getLogs();
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
        const typeName = { fish: "捕鱼", butterfly: "花园", mouse: "捕鼠", laser: "激光", pool: "萤光" }[L.type] || "";
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
        const typeName = { fish: "捕鱼", butterfly: "花园", mouse: "捕鼠", laser: "激光", pool: "萤光" }[L.type] || "";
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
    const top = safe.top + 92;
    // 底部让出一行说明 + 两个按钮（邀猫友 / 返回）的位置
    const bottom = H - safe.bottom - 24 - 46 - 30;
    const w = land ? Math.min(availW * 0.56, 560) : availW - 12;
    const h = Math.max(120, bottom - top);
    return { x: (W - w) / 2, y: top, w, h };
  }
  function lbRow() {
    const { W, H, land, m, safe } = layout();
    const full = Math.min(W - safe.left - safe.right - m * 2, land ? 520 : W - safe.left - safe.right - 48);
    const bh = 46, gp = 12;
    return { bx: (W - full) / 2, by: H - safe.bottom - 24 - bh, bh, full, half: (full - gp) / 2, gp };
  }
  ui.showLB = () => {
    const r = lbRect();
    const S = G.platform.S || 1;   // ODC 覆盖层用真实坐标，需把虚拟布局换算回真实尺寸
    G.platform.odcPost({ type: "refresh" });   // 每次进排行榜先拉最新好友成绩，避免显示旧缓存
    G.platform.odcPost({ type: "show", x: r.x * S, y: r.y * S, w: r.w * S, h: r.h * S });
  };
  ui.hideLB = () => { G.platform.odcPost({ type: "hide" }); };

  ui.drawLeaderboard = () => {
    const { W, H, m, safe } = layout();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.subBg1); g.addColorStop(1, C.subBg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    text("好友排行", W / 2, safe.top + 46, "bold 24px sans-serif", C.ink);
    text("展示同玩本游戏的微信好友单局最佳捕获", W / 2, safe.top + 74, "13px sans-serif", C.ink3);

    // 卡片区域由开放数据域绘制（覆盖层），此处只画卡外说明
    const r = lbRect();
    const row = lbRow();
    text("玩过本游戏的好友自动进入榜单，无需授权通讯录", W / 2, r.y + r.h + 18, "11px sans-serif", C.ink3);

    // 左：邀猫友。空榜时这是唯一能让用户「做点什么」的动作——把"等人来"变成"发出邀请"。
    // 文案必须和开放数据域空榜里的指引一字一致（"点下方「邀猫友比一比」"），否则用户找不到。
    // 合规说明：不奖励分享、不设解锁条件，只是邀请好友来玩。
    const bg = ctx.createLinearGradient(row.bx, row.by, row.bx, row.by + row.bh);
    bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
    ctx.fillStyle = bg;
    G.rr(ctx, row.bx, row.by, row.half, row.bh, 14); ctx.fill();
    text("邀猫友比一比", row.bx + row.half / 2, row.by + row.bh / 2, "bold 17px sans-serif", "#fff");
    btn(row.bx, row.by, row.half, row.bh, () => G.shareInvite("lb"));

    const rx = row.bx + row.half + row.gp;
    ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
    G.rr(ctx, rx, row.by, row.half, row.bh, 14); ctx.fill(); ctx.stroke();
    text("返回", rx + row.half / 2, row.by + row.bh / 2, "bold 17px sans-serif", C.ink);
    btn(rx, row.by, row.half, row.bh, () => { ui.hideLB(); G.screen = "home"; });
  };

  /* ================= 召唤猫咪（播放轻音乐吸引猫） ================= */
  ui.drawSummon = () => {
    const { W, H, land, m, safe } = layout();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.subBg1); g.addColorStop(1, C.subBg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const playing = !!G.summonPlaying;

    // 返回（左上角圆钮，返回即停音乐）
    const bs = 42, bx = safe.left + 16, by = safe.top + 14;
    ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
    G.rr(ctx, bx, by, bs, bs, 14); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = C.ink2; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx + bs * 0.6, by + bs * 0.32); ctx.lineTo(bx + bs * 0.38, by + bs * 0.5); ctx.lineTo(bx + bs * 0.6, by + bs * 0.68);
    ctx.stroke();
    btn(bx, by, bs, bs, () => { G.stopSummonMusic(); G.screen = "home"; });

    text("召唤猫咪", W / 2, safe.top + 54, "bold 24px sans-serif", C.ink);

    // 猫咪插画
    const cs = Math.min(W, H) * 0.2;
    const catY = H * 0.40;
    drawCat(W / 2, catY, cs);

    text(playing ? "音乐播放中…用摇篮曲召唤你的猫" : "点击下方按钮，播放吸引猫咪的轻音乐", W / 2, catY + cs * 1.15, "14px sans-serif", C.ink2);

    // 播放/暂停 大圆钮
    const pr = Math.min(W, H) * 0.11;
    const py = H * 0.70;
    ctx.fillStyle = C.teal;
    ctx.beginPath(); ctx.arc(W / 2, py, pr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    if (playing) {
      ctx.fillRect(W / 2 - pr * 0.3, py - pr * 0.28, pr * 0.18, pr * 0.56);
      ctx.fillRect(W / 2 + pr * 0.12, py - pr * 0.28, pr * 0.18, pr * 0.56);
    } else {
      ctx.beginPath();
      ctx.moveTo(W / 2 - pr * 0.16, py - pr * 0.3); ctx.lineTo(W / 2 - pr * 0.16, py + pr * 0.3); ctx.lineTo(W / 2 + pr * 0.32, py);
      ctx.closePath(); ctx.fill();
    }
    btn(W / 2 - pr, py - pr, pr * 2, pr * 2, () => {
      G.ensureAudio();
      if (G.summonPlaying) G.stopSummonMusic(); else G.startSummonMusic();
    });
  };

  /* ================= 游戏内 HUD =================
     顶部信息条：整体更小更贴顶（safe.top+8），减少对游戏区的遮挡；
     连击不再弹跳圆徽，改为条内静态小徽 */
  ui.drawHud = (t, dt) => {
    const { W, H, land, safe } = layout();
    const S = G.session;
    const uiS = G.platform.S || 1;
    // HUD 缩略系数：大屏时 HUD 元素比整体 UI 少放大一档（真实尺寸 = 设计值 × √S），手机 S=1 不变
    const ks = 1 / Math.sqrt(uiS);
    ui.hudDimT += dt;
    const dim = ui.hudDimT > 3 ? 0.45 : 1;
    ctx.save();
    ctx.globalAlpha = dim;
    const hx = safe.left, hy = safe.top + 4;
    const PH2 = Math.round(28 * ks);   // 统一药丸高度
    const infinite = !!S.infinite;
    const m = String(Math.max(Math.floor(S.remaining / 60), 0)).padStart(2, "0");
    const s = String(Math.max(S.remaining % 60, 0)).padStart(2, "0");
    const timeTxt = infinite ? "∞" : (m + ":" + s);
    const urgent = !infinite && S.remaining <= 10 && S.remaining > 0;
    ctx.fillStyle = urgent ? C.hudUrgent : C.hudBg;
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1.2;
    // 倒计时药丸（无限模式显示 ∞）
    const wTime = Math.round(70 * ks);
    G.rr(ctx, hx + 10, hy, wTime, PH2, Math.round(9 * ks)); ctx.fill(); ctx.stroke();
    text(timeTxt, hx + 10 + wTime / 2, hy + PH2 / 2 + 1, "bold " + Math.round(15 * ks) + "px sans-serif", urgent ? "#ffd7d7" : "#fff");
    // 捕获数药丸（64×28 × ks）
    const wHit = Math.round(64 * ks);
    const xHit = hx + 10 + wTime + 8;
    ctx.fillStyle = C.hitPill;
    G.rr(ctx, xHit, hy, wHit, PH2, Math.round(9 * ks)); ctx.fill(); ctx.stroke();
    text("🐾 " + S.hits, xHit + wHit / 2, hy + PH2 / 2 + 1, "bold " + Math.round(13 * ks) + "px sans-serif", "#fff");
    // 连击（静态小徽，无弹跳；combo>=2 才显示，50×28 × ks）
    if (S.combo >= 2) {
      const hot = S.combo >= 5;
      const wCb = Math.round(50 * ks);
      const xCb = xHit + wHit + 8;
      ctx.fillStyle = hot ? "rgba(255,107,74,.9)" : C.comboPill;
      G.rr(ctx, xCb, hy, wCb, PH2, Math.round(9 * ks)); ctx.fill(); ctx.stroke();
      text("×" + S.combo, xCb + wCb / 2, hy + PH2 / 2 + 1, "bold " + Math.round(13 * ks) + "px sans-serif", "#fff");
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
    // 横屏需额外预留胶囊左侧微信「游戏中心/更多游戏」圆形手柄入口的宽度
    ctx.fillStyle = C.pauseBg;
    const pw2 = Math.round(36 * ks);
    const menu0 = G.platform.menu;
    const menu = menu0 && menu0.width > 0
      ? { left: menu0.left / uiS, top: menu0.top / uiS, width: menu0.width / uiS, height: menu0.height / uiS,
          right: menu0.right / uiS, bottom: menu0.bottom / uiS }
      : null;
    const gcW = menu && menu.width > 0 ? menu.height + 12 : 0;   // 手柄入口占位（约一个胶囊高度）
    let px, py;
    if (menu && menu.width > 0) {
      if (land) {
        px = menu.left - 16 - pw2 - gcW;
        py = menu.top + (menu.height - pw2) / 2;
        // 大屏 S>1 时按钮比胶囊高，居中补偿可能顶出屏幕，钳制在安全区内
        py = Math.max(py, safe.top + 6);
        // 极窄屏：靠太左会撞 HUD 药丸（右端 hx+26+184·ks + 16px 间距），退到胶囊下方
        if (px < hx + 26 + 184 * ks + 16) { px = W - safe.right - pw2 - 8; py = menu.bottom + 8; }
      } else {
        px = W - safe.right - pw2 - 8;
        py = Math.max(menu.bottom + 8, safe.top + 6);   // 竖屏防御：刘海/状态栏下方，不钻进安全区
      }
    } else {
      px = W - safe.right - 52; py = hy;
    }
    G.rr(ctx, px, py, pw2, pw2, Math.round(10 * ks)); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff";
    const bw = Math.max(3, Math.round(4 * ks)), bh = Math.round(16 * ks);
    ctx.fillRect(px + Math.round(11 * ks), py + Math.round(10 * ks), bw, bh);
    ctx.fillRect(px + Math.round(21 * ks), py + Math.round(10 * ks), bw, bh);
    // 长按进度环（600ms）：按住时白环从顶部顺时针填满
    const PH = G.pauseHold || { active: false, progress: 0 };
    if (PH.active && PH.progress > 0) {
      ctx.strokeStyle = C.teal; ctx.lineWidth = Math.max(2.5, 3.5 * ks); ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(px + pw2 / 2, py + pw2 / 2, pw2 / 2 + 5 * ks, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * PH.progress);
      ctx.stroke();
      ctx.lineCap = "butt";
    }
    // 开局前 5 秒提示长按手势（避免玩家不知道怎么暂停）
    if (S.time < 5 && !PH.active) {
      ctx.globalAlpha = dim * Math.min(1, (5 - S.time) / 2);
      text("长按暂停", px + pw2 / 2, py + pw2 + 12 * ks, Math.round(11 * ks) + "px sans-serif", "rgba(255,255,255,.75)");
      ctx.globalAlpha = dim;
    }
    // 注册区域供 game.js 长按判定（不再走即时点击）
    ui.pauseRect = { x: px, y: py, w: pw2, h: pw2 };
    ctx.restore();
  };
  G.pokeHud = () => { ui.hudDimT = 0; };

  /* ================= 倒计时 ================= */
  ui.drawCountdown = (c) => {
    const { W, H } = layout();
    ctx.fillStyle = C.countMask; ctx.fillRect(0, 0, W, H);
    const frac = c - Math.floor(c);
    const sc2 = 0.8 + frac * 0.5;
    ctx.save();
    ctx.translate(W / 2, H * 0.42); ctx.scale(sc2, sc2);
    ctx.globalAlpha = clamp(frac * 2, 0, 1);
    text(String(Math.ceil(c)), 0, 0, "bold 96px sans-serif", "#fff");
    ctx.restore();
    text("准备……", W / 2, H * 0.42 + 110, "18px sans-serif", "rgba(255,255,255,.85)");
    // 鱼玩法：开局亮出本局海域主题名（每局自动轮换）
    const sea = G.config.targetType === "fish" && G.session.sea;
    if (sea) text("本局海域 · " + sea.name, W / 2, H * 0.42 + 138, "14px sans-serif", "rgba(255,255,255,.62)");
  };

  /* ================= 暂停 ================= */
  ui.drawPause = () => {
    const { W, H, land } = layout();
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
    // 模式名：结算页标题要标出这一局选的是哪种玩法（鱼玩法再带海域主题名）
    const seaName = G.config.targetType === "fish" && G.session.sea ? " · " + G.session.sea.name : "";
    const modeName = ((MODES.find(md => md.key === G.config.targetType) || {}).name || "") + seaName;
    // 背景半透明：下层是当前玩法的场景（由 game.js 在结算时绘制），透出来才能看出是哪个模式。
    // 蒙版从 .76 降到 .50 一档——之前场景几乎被洗白，截图存图后看不出玩法差异。
    // 文字可读性不再靠压低透明度，改由「标题区柔光 + 文字白描边」解决，见下。
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "rgba(234,250,244,.50)");
    g.addColorStop(0.55, "rgba(240,251,247,.54)");
    g.addColorStop(1, "rgba(253,246,233,.60)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 场景暗（暗室模式）时深色文字压不住：补一层极淡的整体提亮，冷色不同步压太重
    if (G.scene && G.scene.dark) {
      ctx.fillStyle = "rgba(240,255,250,.26)"; ctx.fillRect(0, 0, W, H);
    }
    // 标题区柔光：只在标题周围铺一圈白雾，替代原来"整条顶部白化"——既压得住窗户/台面亮块，
    // 又不会把整片场景洗掉，所以背景能明显更清晰。
    const halo = (cx, cy, rx, ry, a) => {
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(1, ry / rx);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      rg.addColorStop(0, "rgba(255,255,255," + a + ")");
      rg.addColorStop(0.5, "rgba(255,255,255," + (a * 0.52).toFixed(3) + ")");
      rg.addColorStop(0.78, "rgba(255,255,255," + (a * 0.18).toFixed(3) + ")");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fillStyle = rg; ctx.fill();
      ctx.restore();
    };
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
      const modeLabel = modeName ? "本局结束 · " + modeName : "本局结束";
      // 标题药丸底衬：场景里的窗户/台面亮块会干扰小字，铺一层半透明白底
      ctx.font = "16px sans-serif";
      const lw = ctx.measureText(modeLabel).width + 30;
      ctx.fillStyle = "rgba(255,255,255,.76)";
      G.rr(ctx, centerX - lw / 2, titleTop - 14, lw, 28, 14); ctx.fill();
      text(modeLabel, centerX, titleTop, "16px sans-serif", C.ink3);
      // 标题柔光 + 白描边：蒙版调淡后靠这两层兜住文字可读性
      halo(centerX, titleTop + 44, Math.min(availW * 0.52, 360), 94, 0.80);
      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,.92)"; ctx.shadowBlur = 14;
      text(R.title || "", centerX, titleTop + 34, "bold 30px sans-serif", C.ink);
      text(R.desc || "", centerX, titleTop + 70, "14px sans-serif", C.ink2);
      ctx.restore();
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
      if (R.bonusTag) {
        // 琥珀色小字在浅色场景上偏弱，加一层白描边
        ctx.save();
        ctx.shadowColor = "rgba(255,255,255,.95)"; ctx.shadowBlur = 8;
        text(R.bonusTag, centerX, cardY + chh + 20, "bold 14px sans-serif", C.amberDeep);
        ctx.restore();
      }
      const bw = (availW - gap * 3) / 4, by = btnTop;
      const bg = ctx.createLinearGradient(leftX, by, leftX, by + 46);
      bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
      ctx.fillStyle = bg;
      G.rr(ctx, leftX, by, bw, 46, 14); ctx.fill();
      text("再来一局", leftX + bw / 2, by + 23, "bold 17px sans-serif", "#fff");
      btn(leftX, by, bw, 46, () => G.requestStart());
      // 晒给猫友：分享带「猫咪反应测评图」，而不是"我得了 X 分"
      const x2 = leftX + bw + gap;
      ctx.fillStyle = C.card; ctx.strokeStyle = C.teal; ctx.lineWidth = 1.4;
      G.rr(ctx, x2, by, bw, 46, 14); ctx.fill(); ctx.stroke();
      text("晒给猫友", x2 + bw / 2, by + 23, "bold 17px sans-serif", C.teal);
      btn(x2, by, bw, 46, () => G.shareResult());
      // 存成图片：朋友圈发图不受游戏类分享限制
      const x3 = leftX + (bw + gap) * 2;
      ctx.fillStyle = C.card; ctx.strokeStyle = C.amber; ctx.lineWidth = 1.4;
      G.rr(ctx, x3, by, bw, 46, 14); ctx.fill(); ctx.stroke();
      text("存成图片", x3 + bw / 2, by + 23, "bold 17px sans-serif", C.amberDeep);
      btn(x3, by, bw, 46, () => G.saveCard());
      const x4 = leftX + (bw + gap) * 3;
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
      G.rr(ctx, x4, by, bw, 46, 14); ctx.fill(); ctx.stroke();
      text("返回首页", x4 + bw / 2, by + 23, "bold 17px sans-serif", C.ink);
      btn(x4, by, bw, 46, () => { G.screen = "home"; G.clearPreys(); });
    } else {
      const modeLabel = modeName ? "本局结束 · " + modeName : "本局结束";
      const pTitleY = safe.top + innerH * 0.09;
      ctx.font = "16px sans-serif";
      const lw2 = ctx.measureText(modeLabel).width + 30;
      ctx.fillStyle = "rgba(255,255,255,.76)";
      G.rr(ctx, W / 2 - lw2 / 2, pTitleY - 14, lw2, 28, 14); ctx.fill();
      text(modeLabel, W / 2, pTitleY, "16px sans-serif", C.ink3);
      halo(W / 2, safe.top + innerH * 0.15 + 12, W * 0.66, 108, 0.80);
      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,.92)"; ctx.shadowBlur = 14;
      text(R.title || "", W / 2, safe.top + innerH * 0.15, "bold 30px sans-serif", C.ink);
      text(R.desc || "", W / 2, safe.top + innerH * 0.15 + 38, "14px sans-serif", C.ink2);
      ctx.restore();
      const edgeL = safe.left + 24, availW = W - safe.left - safe.right - 48;
      const cw = (availW - 12) / 2, chh = 78;
      // 按钮几何先算出来：数据卡在「标题底 ↔ 按钮顶」之间垂直居中。
      // 原来固定 innerH*0.24 定位，在 2×2 按钮布局下会留出一大片空白。
      const bw2 = (availW - 12) / 2, bh2 = 54;
      const by4 = H - safe.bottom - 26 - bh2;
      const by1 = by4 - (bh2 + 14);
      const titleBottom = safe.top + innerH * 0.15 + 30;
      const blockH = 2 * chh + 12 + (R.bonusTag ? 26 : 0);
      const baseY = titleBottom + Math.max(20, (by1 - 22 - titleBottom - blockH) / 2);
      cells.forEach((c, i) => {
        const x = edgeL + (i % 2) * (cw + 12), y = baseY + Math.floor(i / 2) * (chh + 12);
        ctx.fillStyle = C.statBg; ctx.strokeStyle = C.statBorder; ctx.lineWidth = 1;
        G.rr(ctx, x, y, cw, chh, 18); ctx.fill(); ctx.stroke();
        text(c[0], x + cw / 2, y + 24, "13px sans-serif", C.ink2);
        text(String(c[1]), x + cw / 2, y + 54, "bold 26px sans-serif", C.ink);
      });
      if (R.bonusTag) {
        ctx.save();
        ctx.shadowColor = "rgba(255,255,255,.95)"; ctx.shadowBlur = 8;
        text(R.bonusTag, W / 2, baseY + 2 * (chh + 12) + 16, "bold 14px sans-serif", C.amberDeep);
        ctx.restore();
      }
      // 四个按钮 2×2 网格：竖屏四段纵排会压到数据卡，网格更省高度、热区也更大
      const rx = edgeL + bw2 + 12;
      const bg = ctx.createLinearGradient(edgeL, by1, edgeL, by1 + bh2);
      bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
      ctx.fillStyle = bg;
      G.rr(ctx, edgeL, by1, bw2, bh2, 14); ctx.fill();
      text("再来一局", edgeL + bw2 / 2, by1 + bh2 / 2, "bold 18px sans-serif", "#fff");
      btn(edgeL, by1, bw2, bh2, () => G.requestStart());
      ctx.fillStyle = C.card; ctx.strokeStyle = C.teal; ctx.lineWidth = 1.4;
      G.rr(ctx, rx, by1, bw2, bh2, 14); ctx.fill(); ctx.stroke();
      text("晒给猫友", rx + bw2 / 2, by1 + bh2 / 2, "bold 17px sans-serif", C.teal);
      btn(rx, by1, bw2, bh2, () => G.shareResult());
      ctx.fillStyle = C.card; ctx.strokeStyle = C.amber; ctx.lineWidth = 1.4;
      G.rr(ctx, edgeL, by4, bw2, bh2, 14); ctx.fill(); ctx.stroke();
      text("存成图片", edgeL + bw2 / 2, by4 + bh2 / 2, "bold 17px sans-serif", C.amberDeep);
      btn(edgeL, by4, bw2, bh2, () => G.saveCard());
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
      G.rr(ctx, rx, by4, bw2, bh2, 14); ctx.fill(); ctx.stroke();
      text("返回首页", rx + bw2 / 2, by4 + bh2 / 2, "bold 17px sans-serif", C.ink);
      btn(rx, by4, bw2, bh2, () => { G.screen = "home"; G.clearPreys(); });
    }
  };
};
