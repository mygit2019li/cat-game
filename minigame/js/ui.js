/* ui.js — 全 Canvas 界面：首页 / 设置 / 记录 / HUD / 倒计时 / 暂停 / 结算
   配色严格对齐 H5 原型（浅色主题 + 青绿主色 + 琥珀强调） */
module.exports = function (G) {
  const ctx = G.platform.ctx;
  const clamp = G.clamp;
  const C = G.COLORS;
  const ui = { buttons: [], hudDimT: 0, stagePop: 0, stageText: "", comboPop: 0, comboShown: 0, pressedBtn: null };
  const SHOW_SUMMON = true;    // 召唤猫咪首页入口
  G.ui = ui;
  G.uiFX = { stagePop: 0, stageText: "", comboPop: 0 };

  /* silent=true 时只画不注册（抽屉背后复用的首页就是这样画的，避免"抽屉外"的卡片被点到） */
  const btn = (x, y, w, h, cb) => { if (ui.silent) return; ui.buttons.push({ x, y, w, h, cb }); };
  /* 带 key 的命中区：给自动化测试一个不依赖坐标算式的查找入口 */
  const btnKey = (x, y, w, h, key, cb) => { ui.buttons.push({ x, y, w, h, key, cb }); };
  const inBtn = (x, y, b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  G.hitButton = (x, y) => {
    for (let i = ui.buttons.length - 1; i >= 0; i--) {
      const b = ui.buttons[i];
      if (inBtn(x, y, b)) {
        ui.pressedBtn = b;
        setTimeout(() => {
          if (ui.pressedBtn === b) ui.pressedBtn = null;
        }, 100);
        b.cb();
        return true;
      }
    }
    return false;
  };

  function panel(x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill || C.panelBg;
    ctx.strokeStyle = stroke || C.line;
    ctx.lineWidth = 1.2;
    G.rr(ctx, x, y, w, h, 16); ctx.fill(); ctx.stroke();
  }
  /* 只建圆角矩形路径不填充（描边专用；G.rr 是"建路径+顺带填充"，描边前误填当前 fillStyle） */
  function rrPath(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
  function text(str, x, y, font, color, align) {
    ctx.font = font; ctx.fillStyle = color || C.ink;
    ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
    ctx.fillText(str, x, y);
  }
  // 矢量小图标（与整体 UI 同风格，尺寸/颜色可控，避免 emoji 跨平台渲染不可控）
  /* 齿轮图标：以原点为中心画（调用方自己 translate/save）。
     首页设置键与电子猫粮设置键共用这一份，避免两处各画一套、看着不一样。 */
  function gearAt(c2, s, color) {
    const r = s / 2;
    c2.save();
    c2.strokeStyle = color; c2.fillStyle = color;
    c2.lineWidth = Math.max(1.5, s * 0.16);
    c2.lineCap = "round"; c2.lineJoin = "round";
    c2.beginPath(); c2.arc(0, 0, r * 0.55, 0, Math.PI * 2); c2.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      c2.beginPath();
      c2.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
      c2.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      c2.stroke();
    }
    c2.restore();
  }
  ui.gearAt = gearAt;      // 电子猫粮页（feeder.js）用自己的 ctx 调用同一份绘制

  function drawVecIcon(key, cx, cy, s, color) {
    const r = s / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (key === "gear") {
      gearAt(ctx, s, color);              // 已在 (cx,cy) 上做过 translate
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
    } else if (key === "bowl") {
      // 猫粮盆：盆体弧 + 盆沿 + 三颗露在外面的干粮
      ctx.lineWidth = Math.max(1.5, s * 0.13);
      ctx.beginPath();
      ctx.moveTo(-r * 0.86, -r * 0.02);
      ctx.quadraticCurveTo(-r * 0.72, r * 0.78, 0, r * 0.78);
      ctx.quadraticCurveTo(r * 0.72, r * 0.78, r * 0.86, -r * 0.02);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, -r * 0.1); ctx.lineTo(r * 0.95, -r * 0.1);
      ctx.stroke();
      [[-0.42, -0.38, 0.16], [0.0, -0.5, 0.17], [0.42, -0.36, 0.15]].forEach(([dx, dy, rr2]) => {
        ctx.beginPath(); ctx.arc(r * dx, r * dy, r * rr2, 0, Math.PI * 2); ctx.fill();
      });
    } else if (key === "album") {
      // 相册：相框 + 小太阳 + 一座山（线框用 rrPath，G.rr 会顺手把形状填成实心）
      ctx.lineWidth = Math.max(1.4, s * 0.11);
      rrPath(-r * 0.85, -r * 0.7, r * 1.7, r * 1.4, r * 0.22); ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 0.38, -r * 0.28, r * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, r * 0.52); ctx.lineTo(-r * 0.18, -r * 0.06); ctx.lineTo(r * 0.2, r * 0.3);
      ctx.lineTo(r * 0.46, r * 0.04); ctx.lineTo(r * 0.75, r * 0.52);
      ctx.stroke();
    } else if (key === "chat") {
      // 聊天气泡：圆角框 + 小尾巴 + 三个点
      ctx.lineWidth = Math.max(1.4, s * 0.11);
      rrPath(-r * 0.85, -r * 0.72, r * 1.7, r * 1.16, r * 0.34); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, r * 0.42); ctx.lineTo(-r * 0.36, r * 0.78); ctx.lineTo(r * 0.02, r * 0.44);
      ctx.closePath(); ctx.fill();
      [-0.4, 0, 0.4].forEach((dx) => {
        ctx.beginPath(); ctx.arc(r * dx, -r * 0.14, r * 0.12, 0, Math.PI * 2); ctx.fill();
      });
    } else if (key === "camera") {
      // 相机：机身 + 镜头 + 顶上快门凸台
      ctx.lineWidth = Math.max(1.4, s * 0.11);
      rrPath(-r * 0.88, -r * 0.4, r * 1.76, r * 1.18, r * 0.22); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, -r * 0.4); ctx.lineTo(-r * 0.26, -r * 0.68); ctx.lineTo(r * 0.1, -r * 0.68); ctx.lineTo(r * 0.24, -r * 0.4);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0, r * 0.18, r * 0.34, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, r * 0.18, r * 0.13, 0, Math.PI * 2); ctx.fill();
    } else if (key === "mic") {
      // 麦克风：拾音头 + 托架 + 底座
      ctx.lineWidth = Math.max(1.4, s * 0.12);
      G.rr(ctx, -r * 0.22, -r * 0.82, r * 0.44, r * 1.0, r * 0.22); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -r * 0.02, r * 0.55, Math.PI * 0.12, Math.PI * 0.88, false); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, r * 0.5); ctx.lineTo(0, r * 0.78); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.36, r * 0.8); ctx.lineTo(r * 0.36, r * 0.8); ctx.stroke();
    } else if (key === "file") {
      // 文件：折角纸张 + 两行内容
      ctx.lineWidth = Math.max(1.4, s * 0.11);
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, -r * 0.84); ctx.lineTo(r * 0.24, -r * 0.84); ctx.lineTo(r * 0.66, -r * 0.42);
      ctx.lineTo(r * 0.66, r * 0.84); ctx.lineTo(-r * 0.62, r * 0.84);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.22, -r * 0.8); ctx.lineTo(r * 0.24, -r * 0.44); ctx.lineTo(r * 0.64, -r * 0.42);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.32, r * 0.02); ctx.lineTo(r * 0.34, r * 0.02); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.32, r * 0.38); ctx.lineTo(r * 0.34, r * 0.38); ctx.stroke();
    }
    ctx.restore();
  }
  // 召唤猫咪页面的大猫咪插画
  function drawCat(cx, cy, s, color) {
    const c = color || "#6b7c75";
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
    const isPressed = ui.pressedBtn && ui.pressedBtn.x === x && ui.pressedBtn.y === y && ui.pressedBtn.w === w && ui.pressedBtn.h === h;
    
    ctx.save();
    if (isPressed) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(0.96, 0.96);
      ctx.translate(-(x + w / 2), -(y + h / 2));
      ctx.globalAlpha = 0.9;
    }

    ctx.fillStyle = o.primary ? C.startGrad1 : (o.on ? C.card : C.segBg);
    ctx.strokeStyle = o.primary ? C.teal : (o.on ? C.line : C.line);
    ctx.lineWidth = o.on ? 2 : 1.2;
    G.rr(ctx, x, y, w, h, 14); ctx.fill(); ctx.stroke();
    
    if (o.icon) {
      const lc = o.primary ? "#fff" : (o.on ? C.ink : C.ink2);
      const gap = 6;
      let fsize = o.primary ? 19 : 17; // Increased from 16
      let lf = (o.primary ? "bold " : (o.bold ? "bold " : "")) + fsize + "px sans-serif";
      ctx.font = lf;
      let tw = ctx.measureText(label).width;
      let ih = Math.min(16, h * 0.45); // Increased from 15
      let total = ih + gap + tw;
      const pad = 12; // Increased from 10
      const avail = w - pad;
      const scale = total > avail ? avail / total : 1;
      if (scale < 1) {
        fsize *= scale; ih *= scale;
        lf = (o.primary ? "bold " : (o.bold ? "bold " : "")) + fsize + "px sans-serif";
        ctx.font = lf; tw = ctx.measureText(label).width;
        total = ih + gap + tw;
      }
      const iconX = x + w / 2 - total / 2;
      const labelX = iconX + ih + gap;
      drawVecIcon(o.icon, iconX + ih / 2, y + h / 2, ih, lc);
      text(label, labelX + tw / 2, y + h / 2 + 1, lf, lc);
    } else {
      const fsize = o.primary ? 19 : 17; // Increased from 16
      const font = (o.primary ? "bold " : (o.bold ? "bold " : "")) + fsize + "px sans-serif";
      text(label, x + w / 2, y + h / 2 + 1, font,
        o.primary ? "#fff" : (o.on ? C.ink : C.ink2));
    }
    ctx.restore();
    btn(x, y, w, h, o.cb);
  }
  ui.panel = panel; ui.text = text; ui.drawBtn = drawBtn;
  /* 按内容量算按钮宽度：文案短就窄一些，避免"内容少却撑成大宽条"（有图标时额外留图标位） */
  function fitBtnWidth(label, h, opts) {
    const o = opts || {};
    const primary = !!o.primary;
    const fsize = h >= 50 ? (primary ? 19 : 18) : (primary ? 19 : 17);
    ctx.font = (primary ? "bold " : (o.bold ? "bold " : "")) + fsize + "px sans-serif";
    const tw = ctx.measureText(label).width;
    const ic = o.icon ? Math.min(16, h * 0.45) + 6 : 0;
    return Math.ceil(tw + ic + (o.icon ? 38 : 48));
  }
  ui.fitBtnWidth = fitBtnWidth;

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

  /* ================= 首页 =================
     卡片顺序即数组顺序（3 列排列，一行 3 个）：
     第一行 捕鱼 / 青蛙 / 激光　第二行 捕鼠 / 暗夜 / 蝴蝶 */
  const MODES = [
    { key: "fish",      name: "深海捕鱼", desc: "三条小鱼随波游动" },
    { key: "frog",      name: "青蛙跳",   desc: "荷叶之间来回跳" },
    { key: "laser",     name: "激光暗室", desc: "甩动与停留的红点" },
    { key: "mouse",     name: "捕鼠行动", desc: "打地鼠式两排洞口" },
    { key: "pool",      name: "暗夜萤光", desc: "萤光小虫爬过石板地" },
    { key: "butterfly", name: "蝴蝶花园", desc: "花间穿梭，还会停花" }
  ];
  /* 原型同款圆形开始按钮：青绿径向渐变 + 12px 外圈光环 + 内描边圈
     中心小鱼往返游动(swimDrift 3.4s) + 摆尾 + 上升气泡 + 整体呼吸(breath 2.8s) */
  ui.drawStartOrb = (cx, cy, D, label, cb) => {
    const t = Date.now() / 1000;
    const R = D / 2;
    const sc = D / 148;                       // 相对原型 148px 的缩放
    const breath = 1 + Math.sin(t * Math.PI * 2 / 2.8) * 0.018;

    // 外圈光环（增加双层光环，更显精致）
    ctx.fillStyle = "rgba(142,226,210,.18)";
    ctx.beginPath(); ctx.arc(cx, cy, R * breath + 15 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(142,226,210,.25)";
    ctx.beginPath(); ctx.arc(cx, cy, R * breath + 8 * sc, 0, Math.PI * 2); ctx.fill();

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

    /* 左上角小齿轮：设置入口。抽屉就是从这一角滑出来的，位置与动画方向一致 */
    {
      const gs = 34, gx = safe.left + 12, gy = safe.top + 10;
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.strokeStyle = "rgba(20,49,58,.10)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(gx + gs / 2, gy + gs / 2, gs / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      drawVecIcon("gear", gx + gs / 2, gy + gs / 2, 15, C.ink2);
      btn(gx, gy, gs, gs, () => G.openSettings());
    }

    if (land) {
      const edgeL = safe.left + m, edgeR = W - safe.right - m;
      const availW = edgeR - edgeL, availH = H - safe.top - safe.bottom;
      const leftW = Math.min(300, Math.floor(availW * 0.38));
      const rightW = availW - leftW - gap * 2;
      const leftX = edgeL, rightX = leftX + leftW + gap * 2;
      const topY = safe.top;
      // 左侧内容块（标题+圆形开始按钮）偏上放置：剩余空隙只取 30%，其余留在底部
      const titleH = 62;
      const tight = availH < 420;                     // SE 级小屏收紧间距
      const vgap = tight ? 10 : 16;
      const orbD = Math.max(96, Math.min(148, Math.floor(availH - 26 - titleH - vgap - m)));
      const blockH = titleH + orbD;
      const blockTop = topY + Math.max(m, (availH - blockH - 30) * 0.3);
      text(G.GAME_NAME, leftX + leftW / 2, blockTop + 16, "bold 28px sans-serif", C.ink);
      text("选一种猎物，开始今天的狩猎吧", leftX + leftW / 2, blockTop + 44, "14px sans-serif", C.ink2);

      const orbY = blockTop + titleH + orbD / 2;
      ui.drawStartOrb(leftX + leftW / 2, orbY, orbD, "开始游戏", () => G.requestStart());

      // 右侧：单张「猎物选择」卡片
      const headH = 34, rowH = 46, pad = 12;
      // 底部通栏一行：设置/本周记录/好友排行（召唤猫咪入口按 SHOW_SUMMON 开关）
      const rowY = H - safe.bottom - rowH - 8;
      const rowBtns = [
        { label: "召唤猫咪", icon: "cat", cb: () => { G.ensureAudio(); G.stopSummonMusic(); G.summonKindIdx = 0; G.switchScreen("summon"); } },
        { label: "电子猫粮", icon: "bowl", cb: () => { G.feederEnter(); } },
        { label: "本周记录", icon: "chart", cb: () => { G.openModal("records"); } },
        { label: "好友排行", icon: "trophy", cb: () => {
          G.openModal("lb");
          G.track("lb_open", { best: Number(G.platform.storage.get("catToyBest")) || 0 });
          G.askFriendAuth();          // 在同一手势里发起授权：拒绝过的不再弹窗，改为引导去设置
        } }
      ];
      // 底部通栏一行：设置/本周记录/好友排行——按钮宽度按文案自适应，整行居中（不再强行三等分撑满）
      const rowW = rowBtns.map(b => fitBtnWidth(b.label, rowH, { icon: true }));
      const rowSum = rowW.reduce((a, w) => a + w, 0) + gap * (rowBtns.length - 1);
      let rowXs = [];
      if (rowSum <= availW) {
        let rxCur = edgeL + (availW - rowSum) / 2;
        rowW.forEach(w => { rowXs.push(rxCur); rxCur += w + gap; });
      } else {
        const eq = (availW - gap * (rowBtns.length - 1)) / rowBtns.length;
        rowBtns.forEach((b, i) => rowXs.push(edgeL + (eq + gap) * i));
        rowW.fill(eq);
      }
      rowBtns.forEach((b, i) => drawBtn(rowXs[i], rowY, rowW[i], rowH, b.label, { icon: b.icon, cb: b.cb }));

      const cardTop = topY + m;
      const cardBottomLimit = rowY - m;
      const gridH = cardBottomLimit - cardTop - headH - pad; // 卡内网格区高度
      // 5 个模式时改 3 列×2 行，最后一行居中以消除视觉空缺
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
      text("猎物选择", cardX + 18, cardY + headH / 2, "bold 16px sans-serif", C.ink, "left");
      const gy = cardY + headH;
      MODES.forEach((mItem, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const nInRow = (r < rows - 1) ? cols : (MODES.length % cols || cols);
        const offX = (cols - nInRow) * (cw + gap) / 2;
        const x = gx + c * (cw + gap) + offX, y = gy + r * (ch + gap);
        const sel = G.config.targetType === mItem.key;
        panel(x, y, cw, ch, sel ? "rgba(255,255,255,.98)" : C.card, sel ? C.teal : C.line);
        if (sel) {
          ctx.save();
          ctx.shadowColor = "rgba(46,196,170,.3)"; ctx.shadowBlur = 10;
          ctx.strokeStyle = C.teal; ctx.lineWidth = 2.5;
          G.rr(ctx, x, y, cw, ch, 16); ctx.stroke();
          ctx.restore();
        }
        // 自适应布局：图标占「文字区之上」的剩余空间并随卡高缩放，矮卡不再与文字重叠
        const iconZone = ch - 42;
        const baseS = mItem.key === "fish" ? 0.55 : mItem.key === "mouse" ? 0.45 : mItem.key === "laser" ? 1.0 : mItem.key === "pool" ? 1.0 : mItem.key === "butterfly" ? 0.6 : mItem.key === "frog" ? 0.62 : 0.5;
        const scl = Math.min(baseS, Math.max(0.3, (iconZone - 6) / 115));
        ctx.save();
        ctx.translate(x + cw / 2, y + iconZone / 2);
        const bob = Math.sin(Date.now() / 500 + i) * 2;
        G.draw.icon(ctx, mItem.key, 0, bob, scl);
        ctx.restore();
        text(mItem.name, x + cw / 2, y + ch - 32, "bold 14px sans-serif", sel ? C.tealDeep : C.ink);
        text(mItem.desc, x + cw / 2, y + ch - 15, "11px sans-serif", sel ? C.teal : C.ink3);
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
      // 猎物选择卡片容器
      const cardX = gx - 12, cardY = gy - 36, cardW = availW + 24, cardH = ch * rowsP + 14 * (rowsP - 1) + 36;
      ctx.fillStyle = "rgba(31,64,58,.08)";
      G.rr(ctx, cardX + 1, cardY + 4, cardW - 2, cardH - 4, 20); ctx.fill();
      panel(cardX, cardY, cardW, cardH, C.card, C.line);
      text("猎物选择", cardX + 18, cardY + 22, "bold 16px sans-serif", C.ink, "left");
      const gy2 = gy;
      MODES.forEach((mItem, i) => {
        const r = Math.floor(i / colsP), c = i % colsP;
        const nInRow = (r < rowsP - 1) ? colsP : (MODES.length % colsP || colsP);
        const offX = (colsP - nInRow) * (cw + 14) / 2;
        const x = gx + c * (cw + 14) + offX, y = gy2 + r * (ch + 14);
        const sel = G.config.targetType === mItem.key;
        panel(x, y, cw, ch, sel ? "rgba(255,255,255,.98)" : C.card, sel ? C.teal : C.line);
        if (sel) {
          ctx.save();
          ctx.shadowColor = "rgba(46,196,170,.3)"; ctx.shadowBlur = 10;
          ctx.strokeStyle = C.teal; ctx.lineWidth = 2.5;
          G.rr(ctx, x, y, cw, ch, 16); ctx.stroke();
          ctx.restore();
        }
        const iconZone = ch - 42;
        const baseS = mItem.key === "fish" ? 0.55 : mItem.key === "mouse" ? 0.45 : mItem.key === "laser" ? 1.0 : mItem.key === "pool" ? 1.0 : mItem.key === "butterfly" ? 0.6 : mItem.key === "frog" ? 0.62 : 0.5;
        const scl = Math.min(baseS, Math.max(0.3, (iconZone - 6) / 115));
        ctx.save();
        ctx.translate(x + cw / 2, y + iconZone / 2);
        const bob = Math.sin(Date.now() / 500 + i) * 2;
        G.draw.icon(ctx, mItem.key, 0, bob, scl);
        ctx.restore();
        text(mItem.name, x + cw / 2, y + ch - 32, "bold 14px sans-serif", sel ? C.tealDeep : C.ink);
        text(mItem.desc, x + cw / 2, y + ch - 15, "11px sans-serif", sel ? C.teal : C.ink3);
        btn(x, y, cw, ch, () => {
          if (G.config.targetType !== mItem.key) G.track("mode_pick", { mode: mItem.key });
          G.config.targetType = mItem.key; G.saveConfig(); G.playTick();
        });
      });
      // 召唤猫咪 / 电子猫粮 两个入口并排（半宽，给下方圆形开始按钮留高度）
      const cardBottom = cardY + cardH;
      let afterCard = cardBottom + 12;
      if (SHOW_SUMMON) {
        const halfW = (availW - 10) / 2;
        drawBtn(edgeL, afterCard, halfW, 44, "召唤猫咪", { icon: "cat", cb: () => { G.ensureAudio(); G.stopSummonMusic(); G.summonKindIdx = 0; G.switchScreen("summon"); } });
        drawBtn(edgeL + halfW + 10, afterCard, halfW, 44, "电子猫粮", { icon: "bowl", cb: () => { G.feederEnter(); } });
        afterCard += 44 + 12;
      }
      const by = afterCard;
      const orbD2 = Math.max(96, Math.min(148, Math.floor(H - safe.bottom - 14 - by - 84)));
      ui.drawStartOrb(W / 2, by + orbD2 / 2, orbD2, "开始游戏", () => G.requestStart());
      const subY2 = by + orbD2 + 40;
      // 设置/本周记录/好友排行：按文案自适应宽度，整行水平居中
      const subBtns = [
        { label: "本周记录", icon: "chart", cb: () => { G.openModal("records"); } },
        { label: "好友排行", icon: "trophy", cb: () => {
          G.openModal("lb");
          G.track("lb_open", { best: Number(G.platform.storage.get("catToyBest")) || 0 });
          G.askFriendAuth();          // 在同一手势里发起授权：拒绝过的不再弹窗，改为引导去设置
        } }
      ];
      const subW = subBtns.map(b => fitBtnWidth(b.label, 44, { icon: true }));
      const subSum = subW.reduce((a, w) => a + w, 0) + 10 * (subBtns.length - 1);
      let subX = edgeL + Math.max(0, (availW - subSum) / 2);
      if (subSum > availW) { const eq = (availW - 20) / 3; subW.fill(eq); subX = edgeL; }
      subBtns.forEach((b, i) => { drawBtn(subX, subY2, subW[i], 44, b.label, { icon: b.icon, cb: b.cb }); subX += subW[i] + 10; });
    }
  };

  /* ================= 设置 ================= */
  /* 用游戏内的鱼绘制函数画预览鱼：预览与实机造型完全一致（设计空间 120×72，中心 60,36） */
  function drawRealFish(c, sp, v, cx, cy, k, ph) {
    if (!sp || !G.draw || !G.draw.fish) return;
    c.save();
    c.translate(cx - 60 * k, cy - 36 * k);
    c.scale(k, k);
    G.draw.fish(c, { species: sp, speciesColors: v, wagDur: 0.5, phase: ph || 0, state: "FLAP" }, 1.2);
    c.restore();
  }
  /* 背景缩略预览：不复用 drawScene（依赖全局 scene 状态），各背景单独画一张小图 */
  function drawBgPreview(c, key, x, y, w, h) {
    c.save();
    G.rr(c, x, y, w, h, 12); c.clip();
    if (key === "swarm") {
      // 群鼠乱窜：深色斑驳地板 + 3 只俯视小灰鼠（大粉耳/粉尾）
      const sg = c.createLinearGradient(0, y, 0, y + h);
      sg.addColorStop(0, "#28312a"); sg.addColorStop(1, "#141a15");
      c.fillStyle = sg; c.fillRect(x, y, w, h);
      c.fillStyle = "rgba(0,0,0,.15)";
      [[0.25, 0.3, 0.2], [0.7, 0.55, 0.16], [0.45, 0.82, 0.13]].forEach(sp => {
        c.beginPath(); c.ellipse(x + w * sp[0], y + h * sp[1], w * sp[2], h * sp[2] * 0.7, 0.5, 0, Math.PI * 2); c.fill();
      });
      const miniMouse = (mx, my, ms, rot) => {
        // 直接复用游戏内的俯视鼠绘制：预览与实机造型完全一致
        c.save(); c.translate(mx, my); c.rotate(rot || 0); c.scale(ms, ms);
        c.translate(-60, -50);
        G.draw.mouseTop(c, { phase: mx * 0.01 }, 1.2);
        c.restore();
      };
      miniMouse(x + w * 0.30, y + h * 0.42, 0.42, Math.PI / 2);
      miniMouse(x + w * 0.60, y + h * 0.68, 0.38, -Math.PI / 2 + 0.3);
      miniMouse(x + w * 0.78, y + h * 0.26, 0.33, 0.2);
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
    } else if (key === "kelp") {
      // 水草森林：用游戏内同一套主题色 + 真实鱼种绘制（预览即实机画面缩影）
      const th = (G.SEA_THEMES || []).find(t => t.key === "kelp") || { bg: ["#1b7f8f", "#10556a", "#0b3a4c"], sand: "#43635e" };
      const kg = c.createRadialGradient(x + w / 2, y, 0, x + w / 2, y, Math.max(w, h) * 1.1);
      kg.addColorStop(0, th.bg[0]); kg.addColorStop(0.52, th.bg[1]); kg.addColorStop(1, th.bg[2]);
      c.fillStyle = kg; c.fillRect(x, y, w, h);
      // 光柱（与 drawSea 同色同透明度）
      c.fillStyle = "rgba(180,240,255,.10)";
      c.beginPath(); c.moveTo(x + w * 0.22, y); c.lineTo(x + w * 0.3, y); c.lineTo(x + w * 0.42, y + h); c.lineTo(x + w * 0.28, y + h); c.closePath(); c.fill();
      // 沙床 + 石头
      c.fillStyle = th.sand; c.fillRect(x, y + h * 0.88, w, h * 0.12);
      c.fillStyle = "#4a6b60";
      c.beginPath(); c.ellipse(x + w * 0.18, y + h * 0.9, w * 0.07, h * 0.045, 0.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(x + w * 0.62, y + h * 0.92, w * 0.09, h * 0.05, -0.15, 0, Math.PI * 2); c.fill();
      // 水草（游戏内 kelp 主题的绿色系）
      const kc = ["#2f8f5e", "#276f4c", "#1d5a3e", "#38a56c"];
      [0.1, 0.22, 0.7, 0.82].forEach((f, i) => {
        c.fillStyle = kc[i % kc.length];
        const bx0 = x + w * f, bh0 = h * (0.32 + (i % 2) * 0.12);
        c.beginPath(); c.moveTo(bx0, y + h * 0.9);
        c.quadraticCurveTo(bx0 + 4, y + h * 0.9 - bh0 * 0.55, bx0 - 2, y + h * 0.9 - bh0);
        c.quadraticCurveTo(bx0 + 6, y + h * 0.9 - bh0 * 0.5, bx0 + 7, y + h * 0.9);
        c.closePath(); c.fill();
      });
      // 真实鱼种（小丑鱼 + 锦鲤，都是水草海域会出现的鱼）
      const spClown = (G.FISH_SPECIES || []).find(s => s.key === "clown");
      const spKoi = (G.FISH_SPECIES || []).find(s => s.key === "koi");
      if (spClown) drawRealFish(c, spClown, spClown.variants[0], x + w * 0.42, y + h * 0.44, 0.42, 0.8);
      if (spKoi) drawRealFish(c, spKoi, spKoi.variants[0], x + w * 0.72, y + h * 0.62, 0.36, 2.1);
    } else if (key === "school") {
      // 鱼群巡游：深海蓝（与 school 主题同色）+ 小银鱼群（贴在一起，像游戏里的"饵球"）
      const th = (G.SEA_THEMES || []).find(t => t.key === "school") || { bg: ["#12406b", "#0c2e50", "#071e38"], sand: "#22405c" };
      const sg = c.createRadialGradient(x + w / 2, y, 0, x + w / 2, y, Math.max(w, h) * 1.1);
      sg.addColorStop(0, th.bg[0]); sg.addColorStop(0.52, th.bg[1]); sg.addColorStop(1, th.bg[2]);
      c.fillStyle = sg; c.fillRect(x, y, w, h);
      c.fillStyle = "rgba(180,240,255,.09)";
      c.beginPath(); c.moveTo(x + w * 0.3, y); c.lineTo(x + w * 0.4, y); c.lineTo(x + w * 0.52, y + h); c.lineTo(x + w * 0.36, y + h); c.closePath(); c.fill();
      c.fillStyle = th.sand; c.fillRect(x, y + h * 0.9, w, h * 0.1);
      const spM = (G.SCHOOL_FISH_SPECIES || [])[0];
      if (spM) {
        const pts = [[0.42, 0.42], [0.5, 0.5], [0.58, 0.4], [0.36, 0.5], [0.54, 0.58], [0.46, 0.34], [0.62, 0.5], [0.4, 0.6]];
        pts.forEach((pt, i) => {
          drawRealFish(c, spM, spM.variants[i % spM.variants.length], x + w * pt[0], y + h * pt[1], 0.24, i * 0.6);
        });
      }
    } else if (key === "pool") {
      // 泳池追鱼：与游戏内 pool 主题同色 + 同款焦散 + 真实的泳池金鱼
      const th = (G.SEA_THEMES || []).find(t => t.key === "pool") || { bg: ["#2aa4e0", "#1565b5", "#0e4a9e"] };
      const pg = c.createRadialGradient(x + w / 2, y, 0, x + w / 2, y, Math.max(w, h) * 1.1);
      pg.addColorStop(0, th.bg[0]); pg.addColorStop(0.52, th.bg[1]); pg.addColorStop(1, th.bg[2]);
      c.fillStyle = pg; c.fillRect(x, y, w, h);
      // 阳光辉光
      const sgp = c.createRadialGradient(x + w * 0.5, y - h * 0.3, 0, x + w * 0.5, y - h * 0.3, h * 1.6);
      sgp.addColorStop(0, "rgba(255,255,255,.3)"); sgp.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = sgp; c.fillRect(x, y, w, h);
      // 网状焦散（静态示意：抖动格点连网，两层线）
      const hh = (i, j, k) => { const s2 = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return s2 - Math.floor(s2); };
      const cs2 = Math.max(22, Math.round(w / 7));
      const cols2 = Math.ceil(w / cs2), rows2 = Math.ceil(h / cs2);
      const px = (i, j) => x + i * cs2 + (hh(i, j, 1) - 0.5) * cs2 * 0.55;
      const py = (i, j) => y + j * cs2 + (hh(i, j, 2) - 0.5) * cs2 * 0.55;
      c.save(); c.globalCompositeOperation = "lighter"; c.lineCap = "round";
      for (let pass = 0; pass < 2; pass++) {
        c.strokeStyle = pass ? "rgba(200,245,255,.4)" : "rgba(120,210,255,.16)";
        c.lineWidth = pass ? 1 : 2.2;
        for (let i = 0; i <= cols2; i++) for (let j = 0; j <= rows2; j++) {
          if (i < cols2) { c.beginPath(); c.moveTo(px(i, j), py(i, j)); c.lineTo(px(i + 1, j), py(i + 1, j)); c.stroke(); }
          if (j < rows2) { c.beginPath(); c.moveTo(px(i, j), py(i, j)); c.lineTo(px(i, j + 1), py(i, j + 1)); c.stroke(); }
        }
      }
      // 星芒两枚（四角十字星）
      [[0.24, 0.3, 7], [0.74, 0.62, 5]].forEach(sd => {
        const sx = x + w * sd[0], sy = y + h * sd[1], sr = sd[2];
        c.fillStyle = "rgba(240,252,255,.85)";
        [[sr, sr * 0.18], [sr * 0.18, sr]].forEach(dd => {
          c.beginPath();
          c.moveTo(sx - dd[0], sy); c.lineTo(sx, sy - dd[1]); c.lineTo(sx + dd[0], sy); c.lineTo(sx, sy + dd[1]);
          c.closePath(); c.fill();
        });
      });
      c.restore();
      // 真实的泳池金鱼（游戏内 POOL_FISH_SPECIES 造型）
      const spG = (G.POOL_FISH_SPECIES || [])[0];
      if (spG) drawRealFish(c, spG, spG.variants[0], x + w * 0.5, y + h * 0.46, 0.62, 0.6);
    } else {
      // 室内房间：墙 + 窗体 + 木地板 + 一排老鼠洞 + 一只探头的鼠（与游戏内布局一致）
      c.fillStyle = "#554b40"; c.fillRect(x, y, w, h * 0.40);
      c.fillStyle = "#7a6a58"; c.fillRect(x, y + h * 0.40, w, h * 0.60);
      // 地板拼缝
      c.strokeStyle = "rgba(0,0,0,.16)"; c.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const yy = y + h * 0.40 + (h * 0.60 / 5) * i;
        c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke();
      }
      // 窗体（暖光）
      c.fillStyle = "rgba(205,232,255,.55)";
      c.fillRect(x + w * 0.60, y + h * 0.08, w * 0.26, h * 0.22);
      c.strokeStyle = "rgba(120,110,96,.5)"; c.lineWidth = 1.4;
      c.strokeRect(x + w * 0.60, y + h * 0.08, w * 0.26, h * 0.22);
      // 地毯
      c.fillStyle = "rgba(150,96,66,.35)";
      c.beginPath(); c.ellipse(x + w * 0.5, y + h * 0.72, w * 0.34, h * 0.16, 0, 0, Math.PI * 2); c.fill();
      // 一排老鼠洞（游戏内是两排共 10 个，这里示意后排 5 个）
      for (let i = 0; i < 5; i++) {
        const hx = x + w * (0.14 + i * 0.18), hy = y + h * 0.62;
        c.fillStyle = "#2b211a";
        c.beginPath(); c.ellipse(hx, hy, w * 0.045, h * 0.035, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(0,0,0,.55)";
        c.beginPath(); c.ellipse(hx, hy + h * 0.008, w * 0.032, h * 0.022, 0, 0, Math.PI * 2); c.fill();
      }
      // 一只探头的老鼠（复用游戏内的侧视鼠绘制）
      if (G.draw && G.draw.mouse) {
        const mk = 0.34, mcx = x + w * 0.32, mcy = y + h * 0.60;
        c.save();
        c.translate(mcx - 60 * mk, mcy - 40 * mk);
        c.scale(mk, mk);
        G.draw.mouse(c, { state: "peek", phase: 0.7, mouseVar: G.MOUSE_VARIANTS[0] }, 1.2);
        c.restore();
      }
    }
    c.restore();
  }

  /* ================= 模式选择弹层（左右滑动/点按两侧翻页，一屏约 1.5 张卡） =================
     每张卡 = 一套玩法模式（不同布景/运动规则/猎物种类）；卡片本身不注册按钮（走拖动判定），
     弹层开头清空按钮表，避免命中首页残留按钮。 */
  ui.drawBgPick = () => {
    const { W, H, land, safe } = layout();
    const P = G.bgPick;
    if (!P) return;
    const list = G.bgsFor(G.config.targetType);
    ui.buttons.length = 0;                                  // 弹层独占按钮表

    // 弹入动画：整层淡入 + 内容轻微上滑归位（背后是冻结的首页帧，透出即自然过渡）
    const openK = Math.min(1, (performance.now() - (P.t0 || 0)) / 260);
    const openE = 1 - Math.pow(1 - openK, 3);
    // 实底渐变（不叠首页：首页大标题会和弹层文字叠字，底部合规小字也会透出来）
    const bgG = ctx.createLinearGradient(0, 0, W, H);
    bgG.addColorStop(0, C.homeBg1); bgG.addColorStop(0.55, C.homeBg2); bgG.addColorStop(1, C.homeBg3);
    ctx.fillStyle = bgG; ctx.globalAlpha = openE; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(6,22,20,.55)"; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(0, (1 - openE) * 18);

    // 纵向布局：卡片 + 指示点 + 按钮作为一个整体在可用区垂直居中，
    // 卡与按钮之间固定 24px 间距（之前按钮钉死在底部，高屏上卡下留出大片空白，看着不居中）
    const bh = 44;
    const spanTop = safe.top + 34;                           // 标题下缘
    const spanBot = H - safe.bottom - 14;                    // 按钮区底缘
    const spanH = Math.max(140, spanBot - spanTop);
    const dotGap = 26, btnGap = 24;                          // 卡→指示点 / 指示点→按钮
    const CH0 = Math.round(H * 0.56);
    const chCap = spanH - dotGap - btnGap - bh - 8;
    // 宽度再收窄（横屏 44% / 竖屏 60%）；高度按原基准宽度算，宽度收窄不影响卡片高度
    const refW = Math.min(Math.round(W * (land ? 0.54 : 0.72)), Math.round(CH0 * 2.1), Math.round(chCap * 2.1));
    const CW = Math.min(Math.round(W * (land ? 0.44 : 0.60)), Math.round(chCap * 1.9));
    // 横屏长宽比 ≤2.1 防扁长；竖屏卡片可更高（≤1.15 倍宽）比例更协调
    const CH = Math.min(CH0, Math.round(refW * (land ? 0.78 : 1.15)), chCap);
    const gap = Math.round(W * 0.035);
    const pad = Math.round(W * 0.05);
    const step = CW + gap;
    // 水平居中基准取「安全区中点」（有刘海/圆角时按可用区居中，视觉上才真的居中）
    const cx0 = safe.left + (W - safe.left - safe.right) / 2;
    P.cw = CW; P.ch = CH; P.gap = gap;
    const edgeL = safe.left + pad;
    const blockH = CH + dotGap + btnGap + bh;
    const cardY = Math.round(spanTop + Math.max(0, (spanH - blockH) / 2));

    // 背景氛围：当前卡后方一团柔光（把视觉焦点聚在卡片上）
    const glow = ctx.createRadialGradient(cx0, cardY + CH / 2, 20, cx0, cardY + CH / 2, CW * 0.95);
    glow.addColorStop(0, "rgba(255,255,255,.10)"); glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    // 标题：青绿竖条作节标 + 白色粗标题 + 灰白副题
    ctx.fillStyle = C.teal;
    G.rr(ctx, edgeL, safe.top + 11, 4, 14, 2);
    text("模式选择", edgeL + 13, safe.top + 18, "bold 17px sans-serif", "#fff", "left");
    ctx.font = "bold 17px sans-serif";
    const titleW2 = ctx.measureText("模式选择").width;
    text("左右滑动 · 点按两侧翻页", edgeL + 13 + titleW2 + 10, safe.top + 19, "11px sans-serif", "rgba(255,255,255,.7)", "left");

    // 画廊：卡片层叠——当前卡 1:1 居中，其余卡缩压在左右后方错位露出（后卡先画、前卡压上面）；
    // 拖动 / 点按翻页时各卡在自己的层位间连续插值，松手吸附回弹
    ctx.save();
    ctx.beginPath(); ctx.rect(0, cardY - CH * 0.22, W, CH * 1.44); ctx.clip();
    // 松手吸附：残余位移按缓出归零（换页滑动 / 边界回弹都连续，不再瞬移）
    let off = P.off || 0;
    if (!P.drag && P.relOff) {
      const rk = Math.min(1, (performance.now() - P.relT0) / 240);
      off = P.relOff * Math.pow(1 - rk, 3);
    }
    // 层位映射（按 |d| 分段线性）：0 居中 → 1 级（±0.30CW、0.90 倍、上移）→ 2 级（±0.48CW、0.80 倍）
    const stackAt = (a) => {
      const k1 = Math.min(a, 1), k2 = G.clamp(a - 1, 0, 1);
      return {
        dx: (0.30 * k1 + 0.18 * k2) * CW,
        sc: 1 - 0.10 * k1 - 0.10 * k2,
        dy: -7 * k1 - 7 * k2,
        veil: Math.min(0.5, 0.24 * k1 + 0.22 * k2)
      };
    };
    const cardCY = cardY + CH / 2;
    // 侧卡错位上限：保证最远端（0.8 倍）卡片的右缘不出屏，窄屏也不会被切掉
    const dxCap = Math.max(CW * 0.22, W - 12 - cx0 - CW * 0.40);
    list.map((b, i) => ({ b, d: (i - P.idx) + off / step }))  // d = 层位（拖动时连续变化）
      .filter(c => Math.abs(c.d) < 2.55)
      .sort((A, B) => Math.abs(B.d) - Math.abs(A.d))          // 后层先画，当前卡最后压顶
      .forEach(c => {
      const d = c.d, b = c.b;
      const st = stackAt(Math.abs(d));
      const cx = cx0 + (d < 0 ? -1 : 1) * Math.min(st.dx, dxCap);   // 左侧层向左错、右侧层向右错
      const sc = st.sc;
      const active = Math.abs(d) < 0.5;
      const veil = st.veil;                                   // 层越深压得越暗
      ctx.save();
      ctx.translate(cx, cardCY + st.dy);
      ctx.scale(sc, sc);
      const x = -CW / 2, y = -CH / 2;
      if (active) {                                   // 当前卡：软投影 + 高亮描边（微发光），比邻卡更"浮"出来
        ctx.save();
        ctx.shadowColor = "rgba(8,40,36,.35)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 6;
        ctx.fillStyle = "#fbfaf7";
        G.rr(ctx, x, y, CW, CH, 16); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.shadowColor = "rgba(46,196,170,.45)"; ctx.shadowBlur = 12;
        ctx.strokeStyle = C.teal; ctx.lineWidth = 2.5;
        rrPath(x, y, CW, CH, 16); ctx.stroke();
        ctx.restore();
      } else {
        panel(x, y, CW, CH, "rgba(250,249,245,.86)", "rgba(255,255,255,.5)");
      }
      const pvH = CH - 38;
      drawBgPreview(ctx, b.key, x + 10, y + 10, CW - 20, pvH - 10);
      ctx.strokeStyle = "rgba(20,60,54,.14)"; ctx.lineWidth = 1;   // 预览图描一圈细边
      rrPath(x + 10.5, y + 10.5, CW - 21, pvH - 11, 12); ctx.stroke();
      // 模式名：预览图左上角深色圆角条 + 青绿圆点（白字，任何预览底色上都可读）
      ctx.font = "bold 14px sans-serif";
      const nw = ctx.measureText(b.name).width;
      ctx.fillStyle = "rgba(8,30,44,.6)";
      G.rr(ctx, x + 18, y + 18, nw + 32, 24, 12);
      ctx.fillStyle = "#3ee6c8";
      ctx.beginPath(); ctx.arc(x + 31, y + 30, 3.2, 0, Math.PI * 2); ctx.fill();
      text(b.name, x + 41, y + 30, "bold 14px sans-serif", "#fff", "left");
      if (active) {                                   // 当前卡预览右上角 ✓ 角标
        const bx2 = x + CW - 30, by2 = y + 30;
        ctx.fillStyle = C.teal;
        ctx.beginPath(); ctx.arc(bx2, by2, 11, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(bx2 - 4.4, by2 + 0.4); ctx.lineTo(bx2 - 1.2, by2 + 3.8); ctx.lineTo(bx2 + 4.6, by2 - 3.4);
        ctx.stroke();
      }
      // 游戏说明：卡底靠左（上方一道发丝分隔线）
      ctx.strokeStyle = "rgba(20,60,54,.10)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 14, y + CH - 38); ctx.lineTo(x + CW - 14, y + CH - 38); ctx.stroke();
      text(b.desc, x + 18, y + CH - 19, "10.5px sans-serif", active ? C.ink2 : C.ink3, "left");
      if (veil > 0.01) {                                    // 压暗蒙层（随卡位距离加深）
        ctx.fillStyle = "rgba(16,38,34," + veil.toFixed(2) + ")";
        G.rr(ctx, x, y, CW, CH, 16); ctx.fill();
      }
      ctx.restore();
    });
    ctx.restore();

    // 指示点：灰点静态铺底，青绿胶囊跟随滑动位置连续移动（吸附动画同样跟手）
    const dotY = cardY + CH + 14;
    const dsp = 20;
    list.forEach((b, i) => {
      const dx = cx0 + (i - (list.length - 1) / 2) * dsp;
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.beginPath(); ctx.arc(dx, dotY, 3, 0, Math.PI * 2); ctx.fill();
    });
    const dotPos = Math.max(0, Math.min(list.length - 1, P.idx - off / step));
    ctx.fillStyle = C.teal;
    G.rr(ctx, cx0 + (dotPos - (list.length - 1) / 2) * dsp - 9, dotY - 3, 18, 6, 3); ctx.fill();

    // 左右切换箭头：压在当前卡左右边缘的圆形按钮（点按翻页，复用松手吸附动画）
    const arR = 21;
    [[-1, cx0 - CW / 2], [1, cx0 + CW / 2]].forEach(aa => {
      const dir = aa[0], ax = aa[1];
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      ctx.fillStyle = "rgba(255,255,255,.18)";
      ctx.beginPath(); ctx.arc(ax, cardCY, arR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(ax, cardCY, arR, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      if (dir < 0) { ctx.moveTo(ax + 4, cardCY - 8); ctx.lineTo(ax - 4, cardCY); ctx.lineTo(ax + 4, cardCY + 8); }
      else { ctx.moveTo(ax - 4, cardCY - 8); ctx.lineTo(ax + 4, cardCY); ctx.lineTo(ax - 4, cardCY + 8); }
      ctx.stroke();
      btn(ax - arR, cardCY - arR, arR * 2, arR * 2, () => G.bgPickArrow(dir));
    });

    // 底部双按钮（钉在底部安全区上方）：「返回」次级 + 「开始游戏 · 模式名」主按钮。
    // 不再用右上角 × 关闭——真机上会被微信胶囊按钮（退出/更多）遮挡点不到。
    const gap2 = Math.round(W * 0.035);
    // 按钮按文案自适应：短文案（返回）不再撑成大宽条，主按钮仍比次级宽一些
    const bwBack = G.clamp(fitBtnWidth("返回", bh), 80, 130);
    const startLabel = "开始游戏 · " + (list[P.idx] ? list[P.idx].name : "");
    // 宽度贴近文案（只留 32px 内边距）+ 上限收紧，避免短文案被拉成长条
    ctx.font = "bold 16px sans-serif";
    const bw = G.clamp(Math.round(ctx.measureText(startLabel).width) + 32, 140, 210);
    const bx0 = Math.round(cx0 - (bwBack + gap2 + bw) / 2);
    const by = cardY + CH + dotGap + btnGap;                  // 紧跟卡片下方（固定间距，不再钉底部）
    // 返回（次级：磨砂白底 + 白描边，适配深色弹层）
    ctx.fillStyle = "rgba(255,255,255,.18)";
    G.rr(ctx, bx0, by, bwBack, bh, bh / 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.4;
    rrPath(bx0, by, bwBack, bh, bh / 2); ctx.stroke();
    text("返回", bx0 + bwBack / 2, by + bh / 2, "bold 16px sans-serif", "#fff");
    btn(bx0, by, bwBack, bh, () => G.closeBgPick());
    // 开始游戏（主按钮：青绿渐变 + 辉光 + 内描边，文案带当前模式名）
    const bx = bx0 + bwBack + gap2;
    ctx.save();
    ctx.shadowColor = "rgba(13,107,125,.5)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
    const sbg = ctx.createLinearGradient(0, by, 0, by + bh);
    sbg.addColorStop(0, "#17b5a1"); sbg.addColorStop(1, "#0c5f6e");
    ctx.fillStyle = sbg;
    G.rr(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.4;
    rrPath(bx + 3, by + 3, bw - 6, bh - 6, (bh - 6) / 2); ctx.stroke();
    text(startLabel, bx + bw / 2, by + bh / 2, "bold 16px sans-serif", "#fff");
    btn(bx, by, bw, bh, () => G.confirmBgPick());
    ctx.restore();                                   // 弹入动画整体位移结束
  };

  /* ================= 设置（左上角抽屉） =================
     从首页左上角滑出，不占满屏：点右上角 X 关闭，点抽屉外的遮罩也能关闭。
     抽屉宽度约屏幕 85%、高度按内容自适应，所以看起来是"抽出来的一层"，不是新开一个页面。 */
  ui.drawSettings = () => {
    const { W, H, land, safe } = layout();
    const now = performance.now();
    if (!G.settings) G.settings = { t0: now };
    const closing = G.settings.closing || null;     // 关闭动画的起始时间戳
    const durIn = 240, durOut = 200;
    const k = closing
      ? Math.min(1, (now - closing.t0) / durOut)
      : Math.min(1, (now - G.settings.t0) / durIn);
    const eased = 1 - Math.pow(1 - k, 3);           // easeOutCubic
    const vis = closing ? 1 - eased : eased;        // 1=完全展开，0=完全收起
    const open = !closing && k >= 1;
    G._settingsEase = vis;                          // 测试钩子：抽屉展开进度（0→1）

    // 背景直接画真实首页（静音注册按钮）：抽屉"浮在首页上"，关闭时首页自然露出来
    const silentBak = ui.silent;
    ui.silent = true;
    ui.drawHome();
    ui.silent = silentBak;
    ctx.fillStyle = "rgba(8,32,42," + (0.36 * vis).toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);

    // 关闭动画期间不注册任何可点区域，避免点穿到首页
    if (!closing) btn(0, 0, W, H, () => { if (open) G.closeSettings(); });

    /* ---------- 抽屉几何 ---------- */
    const pad = 14;
    const px = safe.left + 12, py = safe.top + 10;
    const pw = land ? Math.min(W * 0.62, 560) : Math.min(W - safe.left - safe.right - 44, 344);
    const innerX = px + pad, innerW = pw - pad * 2;
    const headH = 40;

    // 分组数据（与旧版设置页完全一致）
    const groups = [
      { title: "对局", dot: C.teal, rows: [] },
      { title: "体验", dot: C.amber, rows: [] }
    ];
    groups[0].rows.push(
      { label: "猎物数量", options: [{ label: "单只", val: 1 }, { label: "多只", val: 3 }], cur: G.config.preyCount, cb: v => { G.config.preyCount = v; } },
      { label: "难度", options: [{ label: "悠闲", val: "easy" }, { label: "标准", val: "normal" }, { label: "激烈", val: "hard" }], cur: G.config.difficulty, cb: v => { G.config.difficulty = v; } },
      { label: "时长", options: [{ label: "1分钟", val: 60 }, { label: "3分钟", val: 180 }, { label: "5分钟", val: 300 }, { label: "无限", val: 0 }], cur: G.config.infinite ? 0 : G.config.duration, cb: v => { if (v === 0) G.config.infinite = true; else { G.config.infinite = false; G.config.duration = v; } } }
    );
    groups[1].rows.push(
      { label: "音效", options: [{ label: "关", val: false }, { label: "开", val: true }], cur: G.config.sound, cb: v => { G.config.sound = v; } },
      { label: "震动", options: [{ label: "关", val: false }, { label: "开", val: true }], cur: G.config.vibrate, cb: v => { G.config.vibrate = v; } },
      { label: "自适应辅助", options: [{ label: "关", val: false }, { label: "开", val: true }], cur: G.config.adaptive, cb: v => { G.config.adaptive = v; } }
    );

    /* ---------- 紧凑尺寸 ---------- */
    const cardHeader = 32, cardPadB = 10, labelH = 16, rowGap = 6, segH = 30;
    const rowH = labelH + rowGap + segH;
    const cardH = cardHeader + 6 + rowH * 3 + cardPadB;
    const sideBySide = land;                        // 横屏两张卡并排，竖屏上下堆叠
    const cardW = sideBySide ? (innerW - 10) / 2 : innerW;
    const cardsH = sideBySide ? cardH : cardH * 2 + 10;
    const footH = 32 + 8 + 32;                      // 常亮开关行 + 间距 + 底部按钮行
    const needH = pad + headH + cardsH + 12 + footH + pad;
    const ph = Math.min(needH, H - safe.top - safe.bottom - 24);

    /* ---------- 抽屉面板（带投影 + 从左上角滑入） ---------- */
    // 位移量随面板尺寸走：关闭时整块滑出屏幕左上角，打开时从屏幕外滑进来（不是原地淡入）
    const slideOut = 1 - vis;
    const dx = Math.min(pw * 0.92 + 28, 420) * slideOut;
    const dy = Math.min(ph * 0.62 + 24, 420) * slideOut;
    ctx.save();
    ctx.globalAlpha = Math.pow(vis, 0.85);
    ctx.translate(-dx, -dy);
    ctx.save();
    ctx.shadowColor = "rgba(8,40,52,.28)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
    ctx.fillStyle = "rgba(252,255,253,.99)";
    G.rr(ctx, px, py, pw, ph, 20);            // G.rr 内部已做 fill
    ctx.restore();
    // 同上：描边前清空填充色，别用遮罩色把面板盖灰
    ctx.fillStyle = "transparent";
    ctx.strokeStyle = "rgba(20,49,58,.10)"; ctx.lineWidth = 1;
    G.rr(ctx, px, py, pw, ph, 20); ctx.stroke();

    // 标题 + 关闭 X
    text("设置", px + 16, py + 26, "bold 18px sans-serif", C.ink, "left");
    text("改完自动保存", px + 60, py + 27, "11px sans-serif", C.ink3, "left");
    const xr = 15, xcx = px + pw - 14 - xr, xcy = py + 26;
    ctx.fillStyle = "#eef5f2";
    ctx.beginPath(); ctx.arc(xcx, xcy, xr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(xcx - 4.2, xcy - 4.2); ctx.lineTo(xcx + 4.2, xcy + 4.2);
    ctx.moveTo(xcx + 4.2, xcy - 4.2); ctx.lineTo(xcx - 4.2, xcy + 4.2);
    ctx.stroke();
    ctx.lineCap = "butt";

    /* ---------- 分组卡 ---------- */
    function card(x, y, w, h, dot, title) {
      ctx.fillStyle = "#f7fbf9";
      G.rr(ctx, x, y, w, h, 14); ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      G.rr(ctx, x, y, w, h, 14); ctx.stroke();
      const hy = y + 16;
      ctx.globalAlpha = vis * 0.18;
      ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x + 16, hy, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = vis;
      ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x + 16, hy, 4, 0, Math.PI * 2); ctx.fill();
      text(title, x + 29, hy, "bold 14px sans-serif", C.ink, "left");
      ctx.strokeStyle = "rgba(0,0,0,.05)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 12, y + 30); ctx.lineTo(x + w - 12, y + 30); ctx.stroke();
    }
    // 分段选择器：字号随卡片宽度收放，窄卡不挤行
    const segFS = cardW < 250 ? 13 : 14;
    function seg(x, y, wTotal, h, r) {
      const ow = (wTotal - (r.options.length - 1) * 6) / r.options.length;
      r.options.forEach((op, idx) => {
        const on = op.val === r.cur;
        const ox = x + idx * (ow + 6);
        if (on) {
          const grad = ctx.createLinearGradient(ox, y, ox, y + h);
          grad.addColorStop(0, C.startGrad0); grad.addColorStop(1, C.startGrad1);
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = C.segBg;
        }
        G.rr(ctx, ox, y, ow, h, 9); ctx.fill();
        text(op.label, ox + ow / 2, y + h / 2, (on ? "bold " : "") + segFS + "px sans-serif", on ? "#fff" : C.ink2);
        if (open) btn(ox, y, ow, h, () => { r.cb(op.val); G.saveConfig(); G.playTick(); });
      });
    }
    const cardsTop = py + pad + headH;
    groups.forEach((grp, gi) => {
      const x = innerX + (sideBySide ? gi * (cardW + 10) : 0);
      const y = cardsTop + (sideBySide ? 0 : gi * (cardH + 10));
      card(x, y, cardW, cardH, grp.dot, grp.title);
      grp.rows.forEach((r, ri) => {
        const ry = y + cardHeader + 6 + ri * rowH;
        text(r.label, x + 14, ry + labelH / 2, "13px sans-serif", C.ink2, "left");
        seg(x + 14, ry + labelH + rowGap, cardW - 28, segH, r);
      });
    });

    /* ---------- 底部：屏幕常亮 + 三个功能按钮 ---------- */
    const fy = cardsTop + cardsH + 12;
    // 屏幕常亮（白底药丸 + 小开关）
    ctx.fillStyle = "#f7fbf9"; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    G.rr(ctx, innerX, fy, innerW, 32, 10); ctx.fill(); G.rr(ctx, innerX, fy, innerW, 32, 10); ctx.stroke();
    text("屏幕常亮", innerX + 14, fy + 16, "bold 13px sans-serif", C.ink, "left");
    {
      const on = !!G.config.keepScreen;
      const tw = 44, th = 24, tx = innerX + innerW - tw - 12, ty = fy + 4;
      const rr2 = th / 2;
      if (on) {
        const grad = ctx.createLinearGradient(tx, ty, tx + tw, ty);
        grad.addColorStop(0, C.startGrad0); grad.addColorStop(1, C.startGrad1);
        ctx.fillStyle = grad;
      } else ctx.fillStyle = "#dfe9e6";
      G.rr(ctx, tx, ty, tw, th, rr2); ctx.fill();
      const kx = on ? tx + tw - rr2 - 2 : tx + rr2 + 2;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(kx, ty + rr2, (th - 5) / 2, 0, Math.PI * 2); ctx.fill();
      if (open) btn(tx - 6, ty - 3, tw + 12, th + 6, () => {
        G.config.keepScreen = !on;
        try { G.platform.keepScreen(G.config.keepScreen); } catch (err) {}
        G.session._keepOn = G.config.keepScreen;
        G.saveConfig(); G.playTick();
      });
    }
    // 一排三个：联系客服 / 分享给好友 / 防误触
    const by = fy + 40;
    const bGap = 8, bw3 = (innerW - bGap * 2) / 3;
    const footBtns = [
      { label: "联系客服", color: C.ink, cb: () => G.platform.openSupport() },
      { label: "分享给好友", color: C.teal, cb: () => { try { G.shareInvite("settings"); } catch (err) {} } },
      { label: "防误触", color: C.teal, cb: () => { try { G.platform.antiGuide(() => {}); } catch (err) {} } }
    ];
    footBtns.forEach((b, i) => {
      const bx = innerX + i * (bw3 + bGap);
      ctx.fillStyle = "#ffffff"; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      G.rr(ctx, bx, by, bw3, 32, 10); ctx.fill(); G.rr(ctx, bx, by, bw3, 32, 10); ctx.stroke();
      text(b.label, bx + bw3 / 2, by + 16, "bold 12px sans-serif", b.color);
      if (open) btn(bx, by, bw3, 32, b.cb);
    });
    ctx.restore();                                  // 结束抽屉的位移/透明度

    // 抽屉按钮与关闭 X 都用最终坐标（动画结束后才注册，避免滑动中误点）
    if (open) {
      btn(xcx - xr - 4, xcy - xr - 4, (xr + 4) * 2, (xr + 4) * 2, () => G.closeSettings());
    }
    // 关闭动画播完：真正切回首页（面板此时已完全滑出屏幕）
    if (closing && k >= 1) { G.settings = null; G.screen = "home"; }
  };

  /* ================= 弹窗壳（本周记录 / 好友排行共用） =================
     和设置抽屉是一套语言：背后画真实首页（静音注册）+ 遮罩，面板 0.94→1 缩放 + 上浮淡入，
     关闭时反向。返回的 M 里带 vis/open/closing/面板矩形，末尾必须调用 modalEnd(M) 收尾。 */
  function modalShell(key, maxW, wantH) {
    const { W, H, safe } = layout();
    const now = performance.now();
    if (!G.modal || G.modal.key !== key) G.modal = { key, t0: now };
    const closing = G.modal.closing || null;
    const k = closing
      ? Math.min(1, (now - closing.t0) / 200)
      : Math.min(1, (now - G.modal.t0) / 260);
    const eased = 1 - Math.pow(1 - k, 3);
    const vis = closing ? 1 - eased : eased;
    const open = !closing && k >= 1;
    G._modalEase = vis;                              // 测试钩子

    // 背景：真实首页（只画不注册）+ 遮罩
    const silentBak = ui.silent;
    ui.silent = true;
    ui.drawHome();
    ui.silent = silentBak;
    ctx.fillStyle = "rgba(8,32,42," + (0.5 * vis).toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);
    if (!closing) btn(0, 0, W, H, () => { if (open) G.closeModal(); });

    const pw = Math.min(W - safe.left - safe.right - 44, maxW || 460);
    const availH = H - safe.top - safe.bottom - 56;
    const ph = Math.min(availH, Math.max(240, wantH || availH * 0.74));
    const px = Math.round((W - pw) / 2), py = Math.round((H - ph) / 2);   // 取整：半像素坐标会让圆角路径出问题

    // 面板：以中心缩放 + 轻微上浮
    const sc = 0.94 + 0.06 * vis;
    const cx = px + pw / 2, cy = py + ph / 2;
    ctx.save();
    ctx.globalAlpha = Math.pow(vis, 0.9);
    ctx.translate(cx, cy - (1 - vis) * 16);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = "rgba(255,255,255,.99)";
    G.rr(ctx, px, py, pw, ph, 22);            // G.rr 内部已做 fill
    // 描边前把填充色清空：G.rr 自带 fill，不清会拿上一个 fillStyle（遮罩色）把面板盖灰
    ctx.fillStyle = "transparent";
    ctx.strokeStyle = "rgba(20,49,58,.08)"; ctx.lineWidth = 1;
    G.rr(ctx, px, py, pw, ph, 22); ctx.stroke();
    // 面板本体吞掉点击：点内容区（标题、列表、说明）不该关闭弹窗，只有点面板外才关
    if (!closing) btn(px, py, pw, ph, () => {});
    G.modal.geo = { px, py, pw, ph };         // 面板矩形：测试与排障用
    return { W, H, safe, px, py, pw, ph, vis, open, closing, k };
  }
  /* 弹窗右上角关闭 X（画在面板内），收尾时再注册命中区 */
  function modalX(M) {
    const xr = 15, xcx = M.px + M.pw - 16 - xr, xcy = M.py + 26;
    ctx.fillStyle = "#eef5f2";
    ctx.beginPath(); ctx.arc(xcx, xcy, xr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(xcx - 4.2, xcy - 4.2); ctx.lineTo(xcx + 4.2, xcy + 4.2);
    ctx.moveTo(xcx + 4.2, xcy - 4.2); ctx.lineTo(xcx - 4.2, xcy + 4.2);
    ctx.stroke(); ctx.lineCap = "butt";
    return { x: xcx - xr - 4, y: xcy - xr - 4, w: (xr + 4) * 2, h: (xr + 4) * 2 };
  }
  function modalEnd(M, hit, onDone) {
    ctx.restore();                                   // 结束缩放/透明度
    if (M.open && hit) {
      btn(hit.x, hit.y, hit.w, hit.h, () => G.closeModal());
    }
    if (M.closing && M.k >= 1) {
      if (onDone) onDone();
      G.modal = null; G.screen = "home";
    }
  }

  /* ================= 本周记录（弹窗 + 上下滚动） =================
     数据上限：最近 7 天、最多 200 条（G.getLogs / G.pruneLogs）。
     超出一屏的部分靠手指上下拖 + 惯性滚动，右侧有细滚动条；拖到顶/底自动回弹停住。 */
  const REC_ROW_H = 46, REC_ROW_GAP = 6;
  /* 滚动状态挂在 G.modal 上：弹窗重建（openModal 新建对象）时自动归零 */
  const recState = () => {
    if (!G.modal) return { y: 0, v: 0, drag: null, t: 0, geo: null };
    if (!G.modal.rec) G.modal.rec = { y: 0, v: 0, drag: null, t: 0, geo: null };
    return G.modal.rec;
  };
  const recGeo = () => (G.modal && G.modal.rec && G.modal.rec.geo) || null;

  /* 手势入口（game.js 触摸路由调用）：返回 true 表示这一下归列表，不再走按钮 */
  ui.recTouchStart = (vx, vy) => {
    const g = recGeo();
    if (!g || g.maxScroll <= 0) return false;
    if (vx < g.x || vx > g.x + g.w || vy < g.y || vy > g.y + g.h) return false;
    const st = recState();
    st.drag = { lastY: vy, lastT: performance.now() };
    st.v = 0;
    return true;
  };
  ui.recTouchMove = (vy) => {
    const st = G.modal && G.modal.rec, g = recGeo();
    if (!st || !st.drag || !g) return;
    const now = performance.now();
    const dy = vy - st.drag.lastY;
    const dtm = Math.max(8, now - st.drag.lastT) / 1000;   // 下限 8ms：过滤同一帧内的抖动
    st.y = Math.max(0, Math.min(g.maxScroll, st.y - dy));
    st.v = -dy / dtm;                                      // 手指上拖 → 内容上移 → 速度为正
    st.drag.lastY = vy; st.drag.lastT = now;
  };
  ui.recTouchEnd = () => {
    const st = G.modal && G.modal.rec;
    if (!st || !st.drag) return;
    // 松手前停了一下（>90ms 没移动）就不该甩出去，避免"按一下也滚很远"
    const idle = performance.now() - st.drag.lastT;
    st.v = idle > 90 ? 0 : Math.max(-2200, Math.min(2200, st.v || 0));
    st.drag = null;
  };

  ui.drawRecords = () => {
    const { H, land, safe } = layout();
    // 安全读取：历史里若混入 null / 非对象元素，原样 forEach 会抛错（页面白屏）
    const logs = G.getLogs();
    const rowH = REC_ROW_H, rowGap = REC_ROW_GAP;
    const availH = H - safe.top - safe.bottom - 56;
    const footH = 22;                              // 列表下方的提示条（滚动提示 / 位置）
    const cols = land ? 2 : 1;                     // 横屏双列：一屏能看到两倍条数，不用狂滑
    const maxRows = Math.max(1, Math.floor((availH - 66 - footH - 8 + rowGap) / (rowH + rowGap)));
    const willShow = Math.min(Math.ceil(logs.length / cols), maxRows);
    // 高度按内容收缩：行数少就矮一点；行数超一屏则固定满高，改为内部滚动
    const wantH = logs.length ? 66 + willShow * (rowH + rowGap) - rowGap + footH + 10 : 260;
    const M = modalShell("records", land ? 720 : 440, wantH);
    const { px, py, pw, ph } = M;

    text("本周记录", px + 22, py + 28, "bold 19px sans-serif", C.ink, "left");
    text(
      "近 7 天 · 最多 200 条 · 共 " + logs.length + " 局",
      px + 22, py + 49, "11px sans-serif", C.ink3, "left"
    );
    const hit = modalX(M);

    // 右侧留 18px 给滚动条
    const listX = px + 16, listW = pw - 34;
    const listY = py + 66, listH = ph - 66 - footH - 10;

    if (!logs.length) {
      text("还没有记录，来一局吧！", px + pw / 2, py + ph / 2 - 6, "15px sans-serif", C.ink3);
      text("每局结束会自动记在这里", px + pw / 2, py + ph / 2 + 18, "11px sans-serif", C.ink3);
      modalEnd(M, hit);
      return;
    }

    /* ---------- 滚动：惯性衰减 + 边界夹紧 ---------- */
    const st = recState();
    const now = performance.now();
    const dt = st.t ? Math.min(0.05, (now - st.t) / 1000) : 0;
    st.t = now;
    const colGap = 8;
    const cellW = (listW - colGap * (cols - 1)) / cols;
    const totalRows = Math.ceil(logs.length / cols);
    const contentH = totalRows * (rowH + rowGap) - rowGap;
    const maxScroll = Math.max(0, contentH - listH);
    if (!st.drag && Math.abs(st.v) > 4) {
      st.y += st.v * dt;
      st.v *= Math.pow(0.05, dt);              // 约 0.4s 衰减到 5%，手感接近原生
    } else if (!st.drag) {
      st.v = 0;
    }
    st.y = Math.max(0, Math.min(maxScroll, st.y));
    if ((st.y <= 0 && st.v < 0) || (st.y >= maxScroll && st.v > 0)) st.v = 0;
    st.geo = { x: listX, y: listY, w: listW, h: listH, maxScroll };

    /* ---------- 列表（裁剪 + 位移，只画可见行；横屏每行两列） ---------- */
    const visible = Math.ceil(listH / (rowH + rowGap)) + 1;
    const first = Math.max(0, Math.floor(st.y / (rowH + rowGap)));
    ctx.save();
    ctx.beginPath(); ctx.rect(listX, listY, listW, listH); ctx.clip();
    for (let r = first; r < Math.min(totalRows, first + visible); r++) {
      const y = listY + r * (rowH + rowGap) - st.y;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (i >= logs.length) break;
        const L = logs[i];
        const x = listX + c * (cellW + colGap);
        ctx.fillStyle = "#f8fbf9"; ctx.strokeStyle = "#eef4f1"; ctx.lineWidth = 1;
        G.rr(ctx, x, y, cellW, rowH, 12); ctx.stroke();
        const cy = y + rowH / 2;
        text(L.date || "-", x + 12, cy, "12px sans-serif", C.ink3, "left");
        const typeName = { fish: "捕鱼", butterfly: "花园", mouse: "捕鼠", laser: "激光", pool: "萤光", frog: "青蛙" }[L.type] || "";
        // 玩法标签：浅色药丸，比纯文字更好扫读
        const tagW = 38, tagX = x + 56;
        ctx.fillStyle = "rgba(21,154,140,.10)";
        G.rr(ctx, tagX, cy - 9, tagW, 18, 9);
        text(typeName, tagX + tagW / 2, cy, "11px sans-serif", C.tealDeep);
        // 统计列：从右往左排 + 实测文字宽度，避免窄列（横屏双列）里挤成一团
        const fs2 = cellW < 300 ? 10 : 11;
        const capStr = "捕获 " + (L.hits || 0);
        const hitStr = "命中 " + (L.accuracy || 0) + "%";
        const comboStr = "连击 " + (L.combo || 0);
        ctx.font = "bold 13px sans-serif";
        const capW = ctx.measureText(capStr).width;
        ctx.font = fs2 + "px sans-serif";
        const hitW = ctx.measureText(hitStr).width, comboW = ctx.measureText(comboStr).width;
        const capX = x + 56 + tagW + 9;
        const comboX = x + cellW - 10;                        // 右对齐
        const hitX = comboX - comboW - 9 - hitW;              // 命中排在连击左侧
        const showCombo = capX + capW + 6 <= hitX;            // 实在挤不下就省掉连击
        text(capStr, capX, cy, "bold 13px sans-serif", C.amberDeep, "left");
        text(hitStr, showCombo ? hitX : comboX - hitW, cy, fs2 + "px sans-serif", C.tealDeep, "left");
        if (showCombo) text(comboStr, comboX, cy, fs2 + "px sans-serif", C.danger, "right");
      }
    }
    ctx.restore();

    /* ---------- 滚动条（内容超一屏才出现） ---------- */
    if (maxScroll > 1) {
      const barX = listX + listW + 7, trackY = listY, trackH = listH;
      ctx.fillStyle = "rgba(20,49,58,.07)";
      G.rr(ctx, barX, trackY, 4, trackH, 2);
      const thumbH = Math.max(26, trackH * (listH / contentH));
      const thumbY = trackY + (trackH - thumbH) * (st.y / maxScroll);
      ctx.fillStyle = st.drag ? "rgba(21,154,140,.55)" : "rgba(21,154,140,.32)";
      G.rr(ctx, barX, thumbY, 4, thumbH, 2);
      // 底部渐隐：只在"还没滚到底"时加，让被裁切的那一行看起来是滚出去的；
      // 滚到底时最后一条要完整露出，再加渐隐反而像被吃掉半边
      if (st.y < maxScroll - 1) {
        const fade = ctx.createLinearGradient(0, listY + listH - 16, 0, listY + listH);
        fade.addColorStop(0, "rgba(255,255,255,0)");
        fade.addColorStop(1, "rgba(255,255,255,.85)");
        ctx.fillStyle = fade;
        ctx.fillRect(listX, listY + listH - 16, listW, 16);
      }
      // 顶部同样的渐隐：往上滚过之后，最上面被切掉半行才不会像"画漏了"
      if (st.y > 1) {
        const fadeT = ctx.createLinearGradient(0, listY, 0, listY + 14);
        fadeT.addColorStop(0, "rgba(255,255,255,.85)");
        fadeT.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = fadeT;
        ctx.fillRect(listX, listY, listW, 14);
      }
    }

    /* ---------- 底部提示：能滚就提示拖动，滚到哪儿也顺带告诉位置 ---------- */
    const footY = py + ph - footH + 4;
    if (maxScroll > 1) {
      const firstIdx = Math.min(logs.length, Math.floor(st.y / (rowH + rowGap)) * cols + 1);
      const lastIdx = Math.min(logs.length, (Math.floor((st.y + listH) / (rowH + rowGap)) + 1) * cols);
      text("上下拖动查看更多", listX + 2, footY, "11px sans-serif", C.ink3, "left");
      text(firstIdx + "–" + lastIdx + " / " + logs.length,
        listX + listW - 10, footY, "11px sans-serif", C.ink3, "right");
    } else if (logs.length > 3) {
      text("全部 " + logs.length + " 局都在这里了", listX + listW / 2, footY, "11px sans-serif", C.ink3);
    }

    modalEnd(M, hit);
  };

  /* ================= 好友排行（弹窗 + 开放数据域列表） =================
     列表本体由 openDataContext 画在透明覆盖层上；主域负责弹窗外壳与按钮。
     好友关系链数据无需授权弹窗，仅含同玩本游戏的好友成绩，不涉及通讯录。 */
  ui.showLB = () => {
    const r = (G.modal && G.modal.lbRect) || null;
    if (!r) return;
    const S = G.platform.S || 1;   // ODC 覆盖层用真实坐标，需把虚拟布局换算回真实尺寸
    G.platform.odcPost({ type: "refresh" });   // 每次进排行榜先拉最新好友成绩，避免显示旧缓存
    G.platform.odcPost({ type: "show", x: r.x * S, y: r.y * S, w: r.w * S, h: r.h * S });
  };
  ui.hideLB = () => { G.platform.odcPost({ type: "hide" }); };

  ui.drawLeaderboard = () => {
    const { H, land, safe } = layout();
    const availH = H - safe.top - safe.bottom - 56;
    const M = modalShell("lb", land ? 580 : 460, availH * (land ? 0.94 : 0.8));
    const { px, py, pw, ph } = M;

    // 授权状态：unknown/asking=正在问，ok=能读，denied=用户拒绝过（要引导去设置）
    const auth = G.friendAuthState || "unknown";
    const authed = auth === "ok";

    text("好友排行", px + 22, py + 28, "bold 19px sans-serif", C.ink, "left");
    text(
      authed ? "同玩好友的单局最佳捕获" : "需要「微信朋友信息」权限",
      px + 22, py + 49, "11px sans-serif", authed ? C.ink3 : C.amberDeep, "left"
    );
    const hit = modalX(M);

    // 列表区（开放数据域按这块矩形绘制）+ 下方说明与按钮
    const btnH = 40, hintY = py + ph - 14 - btnH - 20;
    const rect = { x: px + 14, y: py + 64, w: pw - 28, h: Math.max(90, hintY - 20 - (py + 64)) };
    G.modal.lbRect = rect;

    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    if (!authed) {
      /* 未授权时这块区域本来就空着，用一张虚线占位卡托住文字，
         既说明"这里将来是榜单"，也不至于让一段话飘在整片白色里 */
      ctx.fillStyle = "rgba(247,251,249,.85)";
      G.rr(ctx, rect.x, rect.y, rect.w, rect.h, 16); ctx.fill();
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "rgba(31,64,58,.16)"; ctx.lineWidth = 1.2;
      G.rr(ctx, rect.x, rect.y, rect.w, rect.h, 16); ctx.stroke();
      ctx.restore();
    }
    if (!authed && auth === "denied") {
      /* ---- 拒绝过授权：这里必须给出可执行动作，而不是让用户看空榜 ---- */
      text("还看不到好友成绩", cx, cy - 34, "bold 16px sans-serif", C.ink);
      text("微信需要你允许「使用你的微信朋友信息」，", cx, cy - 6, "12px sans-serif", C.ink3);
      text("才能读取好友的单局成绩（不含通讯录）。", cx, cy + 14, "12px sans-serif", C.ink3);
      // 小锁：锁梁 + 锁体
      const ly = cy + 62;
      ctx.strokeStyle = "rgba(232,137,12,.6)"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx, ly, 9, Math.PI, 0); ctx.stroke();
      ctx.lineCap = "butt";
      ctx.fillStyle = "rgba(232,137,12,.6)";
      G.rr(ctx, cx - 13, ly - 1, 26, 18, 5);
    } else if (!authed) {
      // 正在弹授权框 / 还没回来：别写"加载中"，否则用户以为数据在等
      text("正在请求好友权限…", cx, cy - 6, "14px sans-serif", C.ink3);
      text("（只读同玩好友的成绩，不含通讯录）", cx, cy + 18, "11px sans-serif", C.ink3);
    } else {
      // 占位底：覆盖层还没画上来时（真机首帧 / 浏览器调试）不至于是一片空白
      text("正在加载好友排行…", cx, cy, "12px sans-serif", C.ink3);
    }

    // 说明文案随状态变
    text(
      auth === "denied" ? "开启后好友成绩会自动出现在这里" : "玩过本游戏的好友自动进榜，无需授权通讯录",
      px + pw / 2, hintY, "11px sans-serif", C.ink3
    );

    // 主按钮：未授权=去开启；已授权=邀猫友
    const bx = px + 14, bw = pw - 28, by = py + ph - 14 - btnH;
    const bg = ctx.createLinearGradient(bx, by, bx, by + btnH);
    bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
    ctx.fillStyle = bg;
    G.rr(ctx, bx, by, bw, btnH, 13); ctx.fill();
    text(auth === "denied" ? "去设置开启" : "邀猫友比一比", bx + bw / 2, by + btnH / 2, "bold 16px sans-serif", "#fff");

    // 覆盖层时序：只有已授权才拉起子域；完全展开后 show（避免列表在缩放中"贴死"），开始关闭立刻 hide
    if (!authed && !G.modal.lbHidden) { G.modal.lbHidden = true; ui.hideLB(); }
    if (authed && M.open && !G.modal.lbShown) { G.modal.lbShown = true; ui.showLB(); }
    if (M.closing && !G.modal.lbHidden) { G.modal.lbHidden = true; ui.hideLB(); }

    modalEnd(M, hit, () => { ui.hideLB(); });
    if (M.open) {
      if (auth === "denied") btn(bx, by, bw, btnH, () => G.grantFriendAuth());
      else btn(bx, by, bw, btnH, () => G.shareInvite("lb"));
    }
  };

  /* 卡面插画：有照片用照片；没照片（猫粮开饭 / 自定义还没传图）走矢量插画，
     不能只铺一块纯色——那看着像没加载出来的占位框 */
  function drawKindArt(k, x, y, w, h) {
    const cached = k.img && G.platform.assets ? G.platform.assets[k.img] : null;
    let drew = false;
    if (cached && cached.ok) {
      try { ctx.drawImage(cached, x, y, w, h); drew = true; } catch (e) { drew = false; }
    } else if (k.img && G.platform.loadImage) {
      G.platform.loadImage(k.img);            // 异步预加载，下一帧照片就绪后自然绘出
    }
    if (drew) return;
    if (k.icon === "food") drawFoodArt(x, y, w, h);
    else if (k.custom) drawCustomArt(x, y, w, h);
    else drawPhotoFallback(k, x, y, w, h);
  }

  /* 照片卡但图还没解码出来：铺一层该性格的主色 + 一个爪印，
     不能走自定义那张虚线加号占位（看上去像“这猫没传图”） */
  function drawPhotoFallback(k, x, y, w, h) {
    ctx.fillStyle = k.color || "#dfe8e4";
    ctx.fillRect(x, y, w, h);
    const cx = x + w / 2, cy = y + h / 2, s = Math.min(w, h) * 0.42;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.42)";
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.20, s * 0.34, s * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    [[-0.40, -0.16, 0.15], [-0.15, -0.36, 0.16], [0.15, -0.36, 0.16], [0.40, -0.16, 0.15]].forEach(t => {
      ctx.beginPath(); ctx.ellipse(cx + s * t[0], cy + s * t[1], s * t[2], s * t[2] * 0.92, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  /* 猫粮开饭：上方出粮口 + 中间落粮 + 下方不锈钢盆，盆两侧配声波弧（声音才是这张卡的主角） */
  function drawFoodArt(x, y, w, h) {
    const cx = x + w / 2, bowlY = y + h * 0.74, rx = w * 0.30, ry = w * 0.085;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#fdeecb"); g.addColorStop(0.6, "#f7d79a"); g.addColorStop(1, "#eeb95f");
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // 声波：以盆心为圆心的三道弧，只画左右两侧
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const r = w * (0.34 + i * 0.09);
      ctx.lineWidth = Math.max(1.6, w * (0.026 - i * 0.005));
      ctx.globalAlpha = 0.9 - i * 0.26;
      ctx.beginPath(); ctx.arc(cx, bowlY - h * 0.04, r, -1.05, -0.35); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, bowlY - h * 0.04, r, Math.PI - 0.35, Math.PI + 1.05); ctx.stroke();
    }
    ctx.restore();
    // 出粮口（白色小漏斗）
    ctx.fillStyle = "#f4f8f6";
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.10, y + h * 0.06); ctx.lineTo(cx + w * 0.10, y + h * 0.06);
    ctx.lineTo(cx + w * 0.05, y + h * 0.21); ctx.lineTo(cx - w * 0.05, y + h * 0.21);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#2f4f4a";
    G.rr(ctx, cx - w * 0.055, y + h * 0.035, w * 0.11, h * 0.035, w * 0.016); ctx.fill();
    // 下落的粮粒（错开三列，越往下越大，读出“正在落”）
    [[-0.055, 0.31, 0.030], [0.05, 0.41, 0.034], [-0.03, 0.52, 0.037], [0.06, 0.60, 0.036]].forEach(p => {
      ctx.fillStyle = "#a8703a";
      ctx.beginPath(); ctx.ellipse(cx + w * p[0], y + h * p[1], w * p[2], w * p[2] * 0.86, 0.5, 0, Math.PI * 2); ctx.fill();
    });
    // 不锈钢盆：先铺盆内，再画沿，最后堆粮
    ctx.fillStyle = "#8e999f";
    ctx.beginPath(); ctx.ellipse(cx, bowlY, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5d686f";
    ctx.beginPath(); ctx.ellipse(cx, bowlY + ry * 0.18, rx * 0.86, ry * 0.74, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#f7fbfa"; ctx.lineWidth = Math.max(2, w * 0.028);
    ctx.beginPath(); ctx.ellipse(cx, bowlY, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#e3ecea"; ctx.lineWidth = Math.max(2, w * 0.05);
    ctx.beginPath(); ctx.arc(cx, bowlY + ry * 0.2, rx * 0.98, 0.18, Math.PI - 0.18); ctx.stroke();
    for (let i = 0; i < 7; i++) {
      // 沿盆口横排铺开（上一版用 cos 做横坐标，七颗全挤到盆右边）
      const u = (i - 3) / 3;                           // -1..1
      const px2 = cx + u * rx * 0.60;
      const py2 = bowlY - ry * 0.10 + Math.sqrt(Math.max(0, 1 - u * u)) * ry * 0.34;
      ctx.fillStyle = i % 2 ? "#b8813f" : "#93611f";
      ctx.beginPath();
      ctx.ellipse(px2, py2, w * 0.032, w * 0.027, i * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* 自定义卡未传图：淡青底 + 虚线框 + 中间一个大加号（提示“这里可以放你自己的图”） */
  function drawCustomArt(x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#e7f7f3"); g.addColorStop(1, "#bfe6dc");
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.strokeStyle = "rgba(46,196,170,.55)"; ctx.lineWidth = Math.max(1.5, w * 0.012);
    ctx.setLineDash([w * 0.05, w * 0.038]);
    G.rr(ctx, x + w * 0.12, y + h * 0.12, w * 0.76, h * 0.76, w * 0.06); ctx.stroke();
    ctx.restore();
    const cx = x + w / 2, cy = y + h / 2, a = Math.min(w, h) * 0.13;
    ctx.strokeStyle = "#2ec4aa"; ctx.lineCap = "round"; ctx.lineWidth = Math.max(2.5, w * 0.028);
    ctx.beginPath(); ctx.moveTo(cx - a, cy); ctx.lineTo(cx + a, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - a); ctx.lineTo(cx, cy + a); ctx.stroke();
  }

  /* ---------- 自定义召唤卡录入弹窗 ----------
     小游戏画布上没有原生输入框，文本走 platform.promptText（真机 = 系统键盘，
     浏览器 = prompt）；图片和音频都不是“点一下就直调 API”，而是先弹一层渠道抽屉，
     按用户熟悉的入口分：图片 = 相册 / 微信聊天 / 拍照，音频 = 现场录音 / 微信聊天 / 文件。
     选回来的都是临时路径，只有 saveAsset 复制进 USER_DATA_PATH 才能抗住杀进程重启。 */
  const SUMMON_SOURCES = {
    image: {
      title: "图片从哪里来",
      items: [
        { key: "album", icon: "album", label: "从相册选", hint: "手机相册里的现成照片" },
        { key: "chat", icon: "chat", label: "从微信聊天选", hint: "聊天里发过的图，电脑端可选本地文件" },
        { key: "camera", icon: "camera", label: "拍一张", hint: "用相机现拍，比如拍你家猫吃饭" }
      ]
    },
    audio: {
      title: "音频从哪里来",
      items: [
        { key: "record", icon: "mic", label: "现场录音", hint: "摇一下粮桶，最长 15 秒" },
        { key: "chat", icon: "chat", label: "从微信聊天选", hint: "聊天里发过的音频文件" },
        { key: "file", icon: "file", label: "从文件选", hint: "手机或电脑上的 mp3 / m4a / wav" }
      ]
    }
  };
  function openSummonEdit() {
    const c = G.customSummon || {};
    ui.summonEdit = {
      name: c.name || "", img: c.img || "", audio: c.audio || "",
      t0: performance.now(), msg: "", msgUntil: 0, preview: null, previewOn: false,
      sheet: "", rec: null   // sheet：正在选渠道（"image"/"audio"）；rec：录音中的句柄
    };
  }
  function closeSummonEdit() {
    const E = ui.summonEdit;
    if (E) { discardSummonRecord(E); stopPreview(E); }
    ui.summonEdit = null;
  }
  /* 给切页面时用：game.js 直接置 null 会把麦克风漏在手里 */
  ui.closeSummonEdit = closeSummonEdit;
  function editMsg(E, s) { E.msg = s; E.msgUntil = performance.now() + 2000; }
  /* 落盘文件名要带后缀：从 dataURL 的 mime 或路径尾部推，推不出用默认值 */
  function assetExt(src, def) {
    let m = /^data:[a-z]+\/([a-z0-9.+-]+)/i.exec(src);
    if (m) {
      const s = m[1].toLowerCase().split("+")[0];
      return "." + (s === "jpeg" ? "jpg" : s);
    }
    m = /\.([a-z0-9]{2,4})(?:[?#]|$)/i.exec(src);
    return m ? "." + m[1].toLowerCase() : def;
  }
  function stopPreview(E) {
    if (E.preview) { try { E.preview.stop(); } catch (e) {} }
    E.preview = null; E.previewOn = false;
  }
  /* 选不回来时分四种说法：自己取消 / 微信版本不支持这个渠道 / 选错了类型 / 麦克风被拒 */
  function pickFailMsg(why, what, key) {
    if (why === "unsupported") {
      return key === "record"
        ? "当前微信版本不支持录音，升级到最新版再试"
        : "当前微信版本不支持从聊天/文件选" + what + "，升级到 2.23.0 以上再试";
    }
    if (why === "badtype") return "那个文件不是音频，换 mp3 / m4a / wav 试试";
    if (why === "denied") return "麦克风权限被拒了，在微信设置里开一下再录";
    return "没选" + what + "，保持原样";
  }
  /* 录音是个“过程”而不是“一下”：选完渠道就开始，音频行当场变成停止键；
     到 15 秒微信自己会停（platform 里 duration + 万一没回调的兜底定时器） */
  function startSummonRecord(E) {
    G.stopSummonMusic();
    stopPreview(E);   // 录音要抢麦克风，先把手里的试听关掉
    const h = G.platform.recordAsset({
      onStart() { if (E.rec) { E.rec.live = true; editMsg(E, "录音中…再点一下音频行就停"); } },
      onDone(p) {
        if (!E.rec) return;
        E.rec = null;
        if (!p) { editMsg(E, "录音取消了，保持原样"); return; }
        E.audio = p;
        editMsg(E, "这段录音已抓好，点保存生效");
      },
      onFail(why) {
        if (!E.rec) return;
        E.rec = null;
        editMsg(E, why === "denied" ? "麦克风权限被拒了，在微信设置里开一下再录" : "录音断了，再试一次");
      }
    }, 15000);
    if (!h) { editMsg(E, pickFailMsg("unsupported", "音频", "record")); return; }
    E.rec = { t0: performance.now(), handle: h, live: false, stopping: false };
  }
  /* 停：保留 E.rec 等 onStop 回调把路径递回来（先清空会把刚录好的音频弄丢） */
  function stopSummonRecord(E) {
    if (!E.rec || E.rec.stopping) return;
    E.rec.stopping = true;
    try { E.rec.handle.stop(); } catch (e) { E.rec = null; }
  }
  /* 作废：关面板 / 删卡 / 切页面，这次录音直接扔 */
  function discardSummonRecord(E) {
    const r = E.rec;
    if (!r) return;
    E.rec = null;
    try { r.handle.cancel(); } catch (e) {}
  }
  /* 渠道抽屉里点一项：录音走 recordAsset，其余走 pickAsset 的对应渠道 */
  function chooseSummonSource(E, key) {
    const kind = E.sheet;
    E.sheet = "";
    if (!kind) return;
    if (kind === "audio" && key === "record") { startSummonRecord(E); return; }
    G.platform.pickAsset(kind, key, (p, why) => {
      if (!p) { editMsg(E, pickFailMsg(why, kind === "audio" ? "音频" : "图片", key)); return; }
      stopPreview(E);
      if (kind === "audio") { E.audio = p; editMsg(E, "音频已选好，点保存生效"); }
      else {
        E.img = p;
        G.platform.loadImage(p);
        editMsg(E, "图片已选好，点保存生效");
      }
    });
  }
  function commitSummonEdit(E) {
    const P = G.platform, old = G.customSummon || {};
    const name = String(E.name || "").trim().slice(0, 12);
    if (!name && !E.img && !E.audio) { editMsg(E, "至少给个标题，或选一张图 / 一段音频"); return; }
    G.stopSummonMusic();
    stopPreview(E);
    const ts = Date.now();
    // 新选的素材才复制，沿用旧路径的不重复写盘；文件名带时间戳，避开 loadImage 的同路径缓存
    let img = E.img, audio = E.audio;
    if (img && img !== old.img) img = P.saveAsset(img, "summon-img-" + ts + assetExt(img, ".jpg"));
    if (audio && audio !== old.audio) audio = P.saveAsset(audio, "summon-audio-" + ts + assetExt(audio, ".mp3"));
    if (old.img && old.img !== img) P.removeAsset(old.img);
    if (old.audio && old.audio !== audio) P.removeAsset(old.audio);
    G.saveCustomSummon({ name: name, img: img, audio: audio });
    if (img) P.loadImage(img);
    if (G.summonPick) { G.summonPick.idx = 0; G.summonPick.off = 0; G.summonPick.relOff = 0; G.summonPick.t0 = performance.now(); }
    closeSummonEdit();
    G.playMilestone();
  }
  function removeCustomSummon(E) {
    const old = G.customSummon || {};
    G.stopSummonMusic();
    discardSummonRecord(E);
    stopPreview(E);
    if (old.img) G.platform.removeAsset(old.img);
    if (old.audio) G.platform.removeAsset(old.audio);
    G.saveCustomSummon(null);
    if (G.summonPick) { G.summonPick.idx = 0; G.summonPick.off = 0; G.summonPick.relOff = 0; }
    closeSummonEdit();
    G.playTick();
  }

  function drawSummonEdit(L) {
    const E = ui.summonEdit, W = L.W, H = L.H;
    // 万一 onStop 一直没回来（系统弹了个电话之类），17 秒硬收，别把用户锁在这页
    if (E.rec && !E.rec.stopping && performance.now() - E.rec.t0 > 17000) stopSummonRecord(E);
    const k = Math.min(1, (performance.now() - E.t0) / 240);
    const ee = 1 - Math.pow(1 - k, 3);
    ctx.fillStyle = "rgba(8,32,38," + (0.5 * ee).toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);
    btnKey(0, 0, W, H, "edit-scrim", () => { closeSummonEdit(); });

    const rowH = 44, gap = 10, pad = 16;
    const w = Math.min(W * 0.88, 372);
    const h = 62 + (rowH + gap) * 3 + 54;
    const x = (W - w) / 2, y = Math.max(L.safe.top + 8, (H - h) / 2 - 8);
    ctx.save();
    ctx.globalAlpha = ee;
    ctx.shadowColor = "rgba(20,60,60,.2)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#fff";
    G.rr(ctx, x, y, w, h, 20); ctx.fill();
    ctx.restore();

    text("自定义召唤卡", x + pad, y + 24, "bold 17px sans-serif", C.ink, "left");
    text("标题 / 图片 / 音频都存在本机，排在卡牌第一个", x + pad, y + 45, "11px sans-serif", C.ink3, "left");
    // 右上角关闭叉
    const ccx = x + w - pad - 4, ccy = y + 24;
    ctx.strokeStyle = C.ink3; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ccx - 7, ccy - 7); ctx.lineTo(ccx + 7, ccy + 7);
    ctx.moveTo(ccx + 7, ccy - 7); ctx.lineTo(ccx - 7, ccy + 7);
    ctx.stroke();
    btnKey(ccx - 16, ccy - 16, 32, 32, "edit-close", () => { closeSummonEdit(); });

    const fx = x + pad, fw = w - pad * 2;
    const recOn = !!E.rec;
    const recSec = recOn ? Math.min(15, (performance.now() - E.rec.t0) / 1000) : 0;
    const rows = [
      { label: "标题", value: E.name || "点这里输入（最多 12 字）", ok: !!E.name },
      { label: "图片", value: E.img ? "已选择，再点可换来源" : "未选择 · 相册 / 聊天 / 拍照", ok: !!E.img },
      {
        label: "音频",
        value: recOn ? ("录音中 " + recSec.toFixed(1) + "″ 点我停止")
          : (E.audio ? "已选择，再点可换来源" : "未选择 · 录音 / 聊天 / 文件"),
        ok: recOn ? true : !!E.audio
      }
    ];
    rows.forEach((r, i) => {
      const ry = y + 58 + i * (rowH + gap);
      const hot = i === 2 && recOn;   // 录音中的音频行就是停止键，整行转成红态
      ctx.fillStyle = hot ? "rgba(255,107,74,.08)" : "#f6faf9";
      ctx.strokeStyle = hot ? "rgba(255,107,74,.5)" : C.line; ctx.lineWidth = 1.2;
      G.rr(ctx, fx, ry, fw, rowH, 12); ctx.fill(); ctx.stroke();
      text(r.label, fx + 12, ry + rowH / 2, "12px sans-serif", hot ? "#e2593a" : C.ink3, "left");
      if (hot) {
        // 跳动红点：麦克风是不是真的开着，一眼看得出来
        const pulse = 0.55 + 0.45 * Math.sin((performance.now() - E.rec.t0) / 170);
        ctx.globalAlpha = pulse; ctx.fillStyle = "#e2593a";
        ctx.beginPath(); ctx.arc(fx + 46, ry + rowH / 2, 4.2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.font = "bold 13px sans-serif";
      const vw = ctx.measureText(r.value).width;
      const pill = i === 2 && E.audio && !recOn ? 52 : 0;
      const maxW = fw - 30 - pill - (hot ? 44 : 12);
      text(vw > maxW ? String(r.value).slice(0, 10) + "…" : r.value,
        fx + fw - 15 - pill, ry + rowH / 2, "bold 13px sans-serif",
        hot ? "#e2593a" : (r.ok ? C.tealDeep : C.ink3), "right");
      if (i === 0) {
        btnKey(fx, ry, fw, rowH, "edit-name", () => {
          if (E.rec) { editMsg(E, "先把录音停了再改别的"); return; }
          G.platform.promptText("给这张召唤卡取个名字", E.name, (v) => {
            if (v == null) return;
            E.name = String(v).trim().slice(0, 12);
            editMsg(E, E.name ? "标题已填好" : "标题已清空");
          });
        });
      } else if (i === 1) {
        // 不直接调 API：先弹渠道抽屉（相册 / 微信聊天 / 拍照）
        btnKey(fx, ry, fw, rowH, "edit-img", () => {
          if (E.rec) { editMsg(E, "先把录音停了再改别的"); return; }
          E.sheet = "image"; G.playTick();
        });
      } else {
        btnKey(fx, ry, fw, rowH, "edit-audio", () => {
          if (E.rec) { stopSummonRecord(E); G.playTick(); return; }   // 录音中点这行 = 停
          E.sheet = "audio"; G.playTick();
        });
        // 试听小胶囊（后 push，盖在整行命中区上面；录音中不出现）
        if (E.audio && !recOn) {
          const pw = 46, px2 = fx + fw - pw - 6, py2 = ry + (rowH - 26) / 2;
          ctx.fillStyle = E.previewOn ? C.teal : "rgba(46,196,170,.14)";
          G.rr(ctx, px2, py2, pw, 26, 13); ctx.fill();
          text(E.previewOn ? "停止" : "试听", px2 + pw / 2, py2 + 13, "bold 12px sans-serif",
            E.previewOn ? "#fff" : C.tealDeep);
          btnKey(px2, py2, pw, 26, "edit-preview", () => {
            if (E.previewOn) { stopPreview(E); return; }
            E.preview = G.platform.previewAsset(E.audio);
            E.previewOn = !!E.preview;
            if (!E.previewOn) editMsg(E, "这段音频听不了，换个 mp3/m4a 试试");
          });
        }
      }
    });

    // 底部：删除本卡（已有自定义卡时）+ 保存
    const by = y + h - 46;
    if (G.customSummon) {
      const dw = 88;
      ctx.fillStyle = "rgba(255,107,74,.10)"; ctx.strokeStyle = "rgba(255,107,74,.5)"; ctx.lineWidth = 1.2;
      G.rr(ctx, fx, by, dw, 36, 18); ctx.fill(); ctx.stroke();
      text("删除本卡", fx + dw / 2, by + 18, "bold 13px sans-serif", "#e2593a");
      btnKey(fx, by, dw, 36, "edit-del", () => removeCustomSummon(E));
    }
    const sw = 132, sx2 = fx + fw - sw;
    const sg = ctx.createLinearGradient(sx2, by, sx2, by + 36);
    sg.addColorStop(0, C.startGrad0); sg.addColorStop(1, C.startGrad1);
    ctx.save();
    ctx.shadowColor = "rgba(20,160,147,.3)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    ctx.fillStyle = sg; G.rr(ctx, sx2, by, sw, 36, 18); ctx.fill();
    ctx.restore();
    text("保存到本机", sx2 + sw / 2, by + 18, "bold 14px sans-serif", "#fff");
    btnKey(sx2, by, sw, 36, "edit-save", () => {
      // 录音没收尾就按保存：先把手收住，免得把一条还在录的引用存进本地
      if (E.rec) { stopSummonRecord(E); editMsg(E, "录音收尾中，再点一次保存"); return; }
      commitSummonEdit(E);
    });

    if (E.msg && performance.now() < E.msgUntil) {
      ctx.globalAlpha = Math.min(1, (E.msgUntil - performance.now()) / 400);
      text(E.msg, x + w / 2, by - 12, "12px sans-serif", C.tealDeep);
      ctx.globalAlpha = 1;
    }
    // 渠道抽屉画在最后：命中区后 push，天然压住背后的录入面板
    drawSummonSources(E, L);
  }

  /* 渠道抽屉：从屏幕底边推上来的小白卡，一行一个入口，图标 + 主标题 + 说明 */
  function drawSummonSources(E, L) {
    const cfg = SUMMON_SOURCES[E.sheet];
    if (!cfg) return;
    const W = L.W, H = L.H, pad = 16;
    ctx.fillStyle = "rgba(8,32,38,.45)";
    ctx.fillRect(0, 0, W, H);
    btnKey(0, 0, W, H, "edit-src-scrim", () => { E.sheet = ""; G.playTick(); });

    const w = Math.min(W - 24, 372), x = (W - w) / 2;
    const oh = 52;
    const h = 46 + cfg.items.length * oh + 46;
    const y = Math.max(L.safe.top + 8, H - h - 12 - (L.safe.bottom || 0));
    ctx.save();
    ctx.shadowColor = "rgba(20,60,60,.24)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = -6;
    ctx.fillStyle = "#fff";
    G.rr(ctx, x, y, w, h, 20); ctx.fill();
    ctx.restore();
    text(cfg.title, x + w / 2, y + 26, "bold 15px sans-serif", C.ink);

    cfg.items.forEach((it, i) => {
      const ry = y + 46 + i * oh, cyc = ry + oh / 2, ix = x + pad + 14;
      if (i) {
        ctx.strokeStyle = "rgba(46,196,170,.14)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + pad, ry); ctx.lineTo(x + w - pad, ry); ctx.stroke();
      }
      ctx.fillStyle = "rgba(46,196,170,.12)";
      ctx.beginPath(); ctx.arc(ix, cyc, 15, 0, Math.PI * 2); ctx.fill();
      drawVecIcon(it.icon, ix, cyc, 17, C.tealDeep);
      text(it.label, ix + 26, ry + 21, "bold 14px sans-serif", C.ink, "left");
      text(it.hint, ix + 26, ry + 38, "11px sans-serif", C.ink3, "left");
      btnKey(x, ry, w, oh, "edit-src-" + it.key, () => { G.playTick(); chooseSummonSource(E, it.key); });
    });

    const cy2 = y + h - 40;
    ctx.fillStyle = "#f6faf9"; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    G.rr(ctx, x + pad, cy2, w - pad * 2, 32, 16); ctx.fill(); ctx.stroke();
    text("取消", x + w / 2, cy2 + 16, "bold 13px sans-serif", C.ink3);
    btnKey(x + pad, cy2, w - pad * 2, 32, "edit-src-cancel", () => { E.sheet = ""; G.playTick(); });
  }

  /* ================= 召唤猫咪（猫种卡牌 + 专属召唤语音） =================
     展现形式为卡牌滑动切换，点击卡牌或下方大按钮播放语音 */
  ui.drawSummon = () => {
    const { W, H, land, m, safe } = layout();
    const kinds = G.summonKinds ? G.summonKinds() : (G.CAT_KINDS || []);
    const P = G.summonPick || { idx: 0, off: 0, t0: performance.now() };
    if (!G.summonPick) G.summonPick = P;
    // 自定义卡被删除后索引会超出范围：先收回来，否则会画出一张空白卡
    if (P.idx > kinds.length - 1) P.idx = Math.max(0, kinds.length - 1);
    
    const sel = P.idx;
    const kind = kinds[sel] || {};
    const playing = !!G.summonPlaying;
    
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.subBg1); g.addColorStop(1, C.subBg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ui.buttons.length = 0;

    // 弹入动画
    const openK = Math.min(1, (performance.now() - P.t0) / 300);
    const openE = 1 - Math.pow(1 - openK, 3);
    ctx.save();
    ctx.translate(0, (1 - openE) * 20);
    ctx.globalAlpha = openE;

    // 返回按钮
    const bs = 42, bX = safe.left + 16, bY = safe.top + 14;
    ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
    G.rr(ctx, bX, bY, bs, bs, 14); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = C.ink2; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bX + bs * 0.6, bY + bs * 0.32); ctx.lineTo(bX + bs * 0.38, bY + bs * 0.5); ctx.lineTo(bX + bs * 0.6, bY + bs * 0.68);
    ctx.stroke();
    btn(bX, bY, bs, bs, () => { G.stopSummonMusic(); G.switchScreen("home"); });

    /* 自定义召唤卡入口（左上角，紧跟返回键）：标题/图片/音频都可自己传，
       存本机后永远排在卡牌列表第一个。图标-only 42×42，不挤居中标题 */
    const eX = bX + bs + 10;
    const hasCustom = !!G.customSummon;
    ctx.fillStyle = hasCustom ? "rgba(46,196,170,.14)" : C.card;
    ctx.strokeStyle = hasCustom ? C.teal : C.line;
    ctx.lineWidth = hasCustom ? 1.6 : 1.2;
    G.rr(ctx, eX, bY, bs, bs, 14); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = hasCustom ? C.tealDeep : C.ink2; ctx.lineCap = "round"; ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(eX + bs / 2, bY + 9); ctx.lineTo(eX + bs / 2, bY + 23);
    ctx.moveTo(eX + bs / 2 - 7, bY + 16); ctx.lineTo(eX + bs / 2 + 7, bY + 16);
    ctx.stroke();
    text("自定义", eX + bs / 2, bY + 32, "bold 9px sans-serif", hasCustom ? C.tealDeep : C.ink2);
    btnKey(eX, bY, bs, bs, "edit-open", () => { G.ensureAudio(); G.playTick(); openSummonEdit(); });

    text("召唤猫咪", W / 2, safe.top + 34, "bold 22px sans-serif", C.ink);

    // 卡牌滑动切换逻辑：优化尺寸计算，确保在不同高度屏幕下均不被遮挡
    const bh = 56;                                     // 底部按钮高度
    const bMargin = 20;                                // 底部间距
    const titleH = safe.top + 60;                      // 标题区占用高度
    const footerH = safe.bottom + bh + bMargin + 10;   // 底部按钮占用高度（指示点已删）
    const availH = H - titleH - footerH;               // 卡牌区可用总高度
    
    // 动态调整卡牌尺寸：加高卡身吃满可用空间（不压底部按钮）
    const CWbase = Math.min(W * 0.68, 280);
    const CH = Math.min(Math.round(CWbase * 1.3), availH - 8);   // 高度优先吃满可用空间
    const CW = Math.min(Math.round(CWbase), Math.round(CH / 1.3));
    const gap = 20, step = CW + gap;
    // 垂直中心点：在可用区域内平分空间
    const cx0 = W / 2, cy0 = titleH + availH / 2;
    
    // 位移量：拖动中跟手，松手后按回弹动画衰减（不能回落到残留的拖动位移，否则会跳位）
    let off = 0;
    if (P.drag) {
      off = P.off || 0;
    } else if (P.relOff) {
      const rk = Math.min(1, (performance.now() - P.relT0) / 240);
      off = P.relOff * Math.pow(1 - rk, 3);
      if (rk >= 1) P.relOff = 0;
    } else {
      P.off = 0;
    }
    P.cw = CW; P.ch = CH; P.step = step;

    kinds.map((k, i) => ({ k, i, d: (i - P.idx) + off / step }))
      .filter(c => Math.abs(c.d) < 2.5)
      .sort((A, B) => Math.abs(B.d) - Math.abs(A.d))
      .forEach(c => {
        const d = c.d, k = c.k, idx = c.i;
        const absD = Math.abs(d);
        const active = absD < 0.5;
        
        // 层级变换：活跃卡片正常大小，非活跃卡片缩小、偏移、半透明
        const sc = 1 - absD * 0.18;
        const opacity = 1 - absD * 0.55;
        const dx = (d < 0 ? -1 : 1) * (Math.min(absD, 1) * CW * 0.78 + Math.max(0, absD - 1) * CW * 0.4);
        
        ctx.save();
        ctx.translate(cx0 + dx, cy0);
        ctx.scale(sc, sc);
        ctx.globalAlpha = Math.max(0, opacity * openE);
        
        const x = -CW / 2, y = -CH / 2;
        
        // 卡片容器
        ctx.save();
        if (active) {
          ctx.shadowColor = "rgba(0,0,0,.15)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
        }
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = active ? C.teal : "rgba(0,0,0,.08)";
        ctx.lineWidth = active ? 2.5 : 1.2;
        G.rr(ctx, x, y, CW, CH, 20); ctx.fill(); ctx.stroke();
        ctx.restore();
        
        // 猫咪形象：展示真实照片
        const imgS = CW * 0.84;
        const imgH = imgS * 0.75;
        const imgX = -imgS / 2, imgY = -CH * 0.42;
        
        ctx.save();
        G.rr(ctx, imgX, imgY, imgS, imgH, 16);
        ctx.clip();
        drawKindArt(k, imgX, imgY, imgS, imgH);
        ctx.restore();
        
        // 名字与品种小字（字号随卡宽收缩，保证不出卡边）
        const nameF = Math.min(17, Math.round(CW * 0.115));
        const breedF = Math.min(11, Math.max(9.5, Math.round(CW * 0.055 * 10) / 10));
        text(k.name, 0, CH * 0.17, "bold " + nameF + "px sans-serif", active ? C.tealDeep : C.ink);
        text(k.breed, 0, CH * 0.3, breedF + "px sans-serif", C.ink3);
        
        // 播放状态指示：环绕卡片的动效
        if (active && playing) {
          ctx.save();
          const waveT = Date.now() / 300;
          for (let wv = 0; wv < 2; wv++) {
            const r2 = imgS * 0.5 + ((waveT + wv * 0.5) % 1) * 20;
            const alpha2 = 1 - ((waveT + wv * 0.5) % 1);
            ctx.strokeStyle = C.teal; ctx.lineWidth = 2; ctx.globalAlpha = alpha2 * 0.6;
            ctx.strokeRect(imgX - (r2 - imgS * 0.5), imgY - (r2 - imgS * 0.5), imgS + (r2 - imgS * 0.5) * 2, imgH + (r2 - imgS * 0.5) * 2);
          }
          ctx.restore();
        }
        
        btn(cx0 + dx - CW / 2, cy0 - CH / 2, CW, CH, () => {
          if (active) {
            G.ensureAudio();
            if (G.summonPlaying) G.stopSummonMusic(); else G.startSummonKind(P.idx);
          } else {
            // 平滑切换到点击的卡片：切换卡牌时不自动播放语音
            const oldIdx = P.idx;
            P.idx = idx;
            P.off = 0;
            P.relOff = (oldIdx - idx) * step;
            P.relT0 = performance.now();
            G.stopSummonMusic(); // 切换时停止当前播放
            G.playTick();
          }
        });
        ctx.restore();
      });

    // 底部播放大按钮
    const bH_fixed = 46, bW_fixed = 176;
    const bY2_fixed = H - safe.bottom - bH_fixed - 20;
    const bX2_fixed = W / 2 - bW_fixed / 2;
    
    ctx.save();
    ctx.shadowColor = "rgba(20,160,147,.3)"; ctx.shadowBlur = 15; ctx.shadowOffsetY = 5;
    const bgGrad = ctx.createLinearGradient(bX2_fixed, bY2_fixed, bX2_fixed, bY2_fixed + bH_fixed);
    bgGrad.addColorStop(0, C.startGrad0); bgGrad.addColorStop(1, C.startGrad1);
    ctx.fillStyle = bgGrad;
    G.rr(ctx, bX2_fixed, bY2_fixed, bW_fixed, bH_fixed, bH_fixed / 2); ctx.fill();
    ctx.restore();
    
    const iconS = 20;
    const label = playing ? "停止召唤" : "开始召唤";
    ctx.font = "bold 15px sans-serif";
    const tW = ctx.measureText(label).width;
    const totalW = iconS + 10 + tW;
    const startX = bX2_fixed + (bW_fixed - totalW) / 2;
    
    // 图标
    ctx.fillStyle = "#fff";
    if (playing) {
      ctx.fillRect(startX, bY2_fixed + (bH_fixed - iconS) / 2, 8, iconS);
      ctx.fillRect(startX + 12, bY2_fixed + (bH_fixed - iconS) / 2, 8, iconS);
    } else {
      ctx.beginPath();
      ctx.moveTo(startX, bY2_fixed + (bH_fixed - iconS) / 2);
      ctx.lineTo(startX, bY2_fixed + (bH_fixed + iconS) / 2);
      ctx.lineTo(startX + iconS, bY2_fixed + bH_fixed / 2);
      ctx.fill();
    }
    text(label, startX + iconS + 10 + tW / 2, bY2_fixed + bH_fixed / 2, "bold 18px sans-serif", "#fff");
    btn(bX2_fixed, bY2_fixed, bW_fixed, bH_fixed, () => {
      G.ensureAudio();
      if (G.summonPlaying) G.stopSummonMusic(); else G.startSummonKind(sel);
    });

    ctx.restore();

    // 自定义录入弹窗画在卡牌之上（命中区也后 push，优先于背面卡牌）
    if (ui.summonEdit) drawSummonEdit({ W, H, safe });
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
    ui.timePillRect = { x: hx + 10, y: hy, w: wTime, h: PH2 };   // 测试钩子：HUD 同行校验用
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
        // 纵向锚定倒计时药丸中线（不跟胶囊的 top 走——部分机型胶囊偏下，会把暂停带离倒计时行）
        py = hy + (PH2 - pw2) / 2;
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
      // 四个按钮文案等长（4 字）：宽度按文案收紧、整行居中，不再撑满整个横屏宽度
      ctx.font = "bold 17px sans-serif";
      const rLabW = ctx.measureText("再来一局").width;
      const bw = Math.min((availW - gap * 3) / 4, rLabW + 46), by = btnTop;
      const rowOff = Math.max(0, (availW - (bw * 4 + gap * 3)) / 2);
      const rX = leftX + rowOff;
      const bg = ctx.createLinearGradient(rX, by, rX, by + 46);
      bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
      ctx.fillStyle = bg;
      G.rr(ctx, rX, by, bw, 46, 14); ctx.fill();
      text("再来一局", rX + bw / 2, by + 23, "bold 17px sans-serif", "#fff");
      btn(rX, by, bw, 46, () => G.requestStart());
      // 晒给猫友：分享带「猫咪反应测评图」，而不是"我得了 X 分"
      const x2 = rX + bw + gap;
      ctx.fillStyle = C.card; ctx.strokeStyle = C.teal; ctx.lineWidth = 1.4;
      G.rr(ctx, x2, by, bw, 46, 14); ctx.fill(); ctx.stroke();
      text("晒给猫友", x2 + bw / 2, by + 23, "bold 17px sans-serif", C.teal);
      btn(x2, by, bw, 46, () => G.shareResult());
      // 存成图片：朋友圈发图不受游戏类分享限制
      const x3 = rX + (bw + gap) * 2;
      ctx.fillStyle = C.card; ctx.strokeStyle = C.amber; ctx.lineWidth = 1.4;
      G.rr(ctx, x3, by, bw, 46, 14); ctx.fill(); ctx.stroke();
      text("存成图片", x3 + bw / 2, by + 23, "bold 17px sans-serif", C.amberDeep);
      btn(x3, by, bw, 46, () => G.saveCard());
      const x4 = rX + (bw + gap) * 3;
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
      G.rr(ctx, x4, by, bw, 46, 14); ctx.fill(); ctx.stroke();
      text("返回首页", x4 + bw / 2, by + 23, "bold 17px sans-serif", C.ink);
      btn(x4, by, bw, 46, () => { G.switchScreen("home"); G.clearPreys(); });
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
      // 按钮宽度按文案收紧（4 字文案不再撑满两列），一对按钮整行居中
      const bh2 = 54;
      const bw2 = Math.min((availW - 12) / 2, fitBtnWidth("再来一局", bh2, { bold: true }) + 8);
      const pairL = edgeL + Math.max(0, (availW - (bw2 * 2 + 12)) / 2);
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
      const rx = pairL + bw2 + 12;
      const bg = ctx.createLinearGradient(pairL, by1, pairL, by1 + bh2);
      bg.addColorStop(0, C.startGrad0); bg.addColorStop(1, C.startGrad1);
      ctx.fillStyle = bg;
      G.rr(ctx, pairL, by1, bw2, bh2, 14); ctx.fill();
      text("再来一局", pairL + bw2 / 2, by1 + bh2 / 2, "bold 18px sans-serif", "#fff");
      btn(pairL, by1, bw2, bh2, () => G.requestStart());
      ctx.fillStyle = C.card; ctx.strokeStyle = C.teal; ctx.lineWidth = 1.4;
      G.rr(ctx, rx, by1, bw2, bh2, 14); ctx.fill(); ctx.stroke();
      text("晒给猫友", rx + bw2 / 2, by1 + bh2 / 2, "bold 17px sans-serif", C.teal);
      btn(rx, by1, bw2, bh2, () => G.shareResult());
      ctx.fillStyle = C.card; ctx.strokeStyle = C.amber; ctx.lineWidth = 1.4;
      G.rr(ctx, pairL, by4, bw2, bh2, 14); ctx.fill(); ctx.stroke();
      text("存成图片", pairL + bw2 / 2, by4 + bh2 / 2, "bold 17px sans-serif", C.amberDeep);
      btn(pairL, by4, bw2, bh2, () => G.saveCard());
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
      G.rr(ctx, rx, by4, bw2, bh2, 14); ctx.fill(); ctx.stroke();
      text("返回首页", rx + bw2 / 2, by4 + bh2 / 2, "bold 17px sans-serif", C.ink);
      btn(rx, by4, bw2, bh2, () => { G.switchScreen("home"); G.clearPreys(); });
    }
  };
};
