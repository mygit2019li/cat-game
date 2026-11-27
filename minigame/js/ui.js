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
  const btnKey = (x, y, w, h, key, cb) => { if (ui.silent) return; ui.buttons.push({ x, y, w, h, key, cb }); };   // 与 btn 一致：silent（抽屉背后复绘首页）时不注册命中区
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

  /* 分享图标：开口向上的盒子 + 向上箭头（小尺寸下比三点连线好认，不会看成"下一页"）。
     c2 需已 translate 到图标中心，三个模块页面共用这一份。 */
  function shareIconAt(c2, s, color) {
    const r = s / 2;
    c2.save();
    c2.strokeStyle = color; c2.fillStyle = color;
    c2.lineWidth = Math.max(1.5, s * 0.10);
    c2.lineCap = "round"; c2.lineJoin = "round";
    // 盒子：左右两边 + 底边，顶部敞开
    c2.beginPath();
    c2.moveTo(-r * 0.66, -r * 0.06);
    c2.lineTo(-r * 0.66, r * 0.76);
    c2.lineTo(r * 0.66, r * 0.76);
    c2.lineTo(r * 0.66, -r * 0.06);
    c2.stroke();
    // 从盒口射出的向上箭头
    c2.beginPath();
    c2.moveTo(0, -r * 0.82); c2.lineTo(0, r * 0.46);
    c2.moveTo(-r * 0.34, -r * 0.48);
    c2.lineTo(0, -r * 0.82);
    c2.lineTo(r * 0.34, -r * 0.48);
    c2.stroke();
    c2.restore();
  }
  ui.shareIconAt = shareIconAt;

  function drawVecIcon(key, cx, cy, s, color) {
    const r = s / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (key === "share") {
      shareIconAt(ctx, s, color);        // 已在 (cx,cy) 上做过 translate
    } else if (key === "gear") {
      gearAt(ctx, s, color);              // 已在 (cx,cy) 上做过 translate
    } else if (key === "heart") {
      ctx.beginPath();
      ctx.moveTo(0, r * .72);
      ctx.bezierCurveTo(-r * 1.30, -r * .02, -r * .52, -r * .96, 0, -r * .36);
      ctx.bezierCurveTo(r * .52, -r * .96, r * 1.30, -r * .02, 0, r * .72);
      ctx.closePath(); ctx.fill();
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
    } else if (key === "play") {
      // 播放：右向实心三角（常见播放按钮符号）
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, -r * 0.58);
      ctx.lineTo(r * 0.52, 0);
      ctx.lineTo(-r * 0.42, r * 0.58);
      ctx.closePath(); ctx.fill();
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
    } else if (key === "sound") {
      // 声音：喇叭主体（实心）+ 两道声波弧
      ctx.beginPath();
      ctx.moveTo(-r * 0.92, -r * 0.20);
      ctx.lineTo(-r * 0.44, -r * 0.20);
      ctx.lineTo(-r * 0.02, -r * 0.58);
      ctx.lineTo(-r * 0.02, r * 0.58);
      ctx.lineTo(-r * 0.44, r * 0.20);
      ctx.lineTo(-r * 0.92, r * 0.20);
      ctx.closePath(); ctx.fill();
      ctx.lineWidth = Math.max(1.5, s * 0.12);
      ctx.beginPath(); ctx.arc(r * 0.08, 0, r * 0.38, -0.62, 0.62); ctx.stroke();
      ctx.beginPath(); ctx.arc(r * 0.08, 0, r * 0.72, -0.58, 0.58); ctx.stroke();
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
    } else if (key === "target") {
      // 靶心：双环 + 中心点 + 右上准星尾（「选择猎物」标题用）
      ctx.lineWidth = Math.max(1.6, s * 0.11);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.52, -r * 0.52); ctx.lineTo(r * 0.92, -r * 0.92); ctx.stroke();
    } else if (key === "loop") {
      // 循环箭头（底部「返回」用）
      ctx.lineWidth = Math.max(1.8, s * 0.13);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.64, -Math.PI * 0.72, Math.PI * 0.98); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.88, -r * 0.66); ctx.lineTo(-r * 0.44, -r * 0.76); ctx.lineTo(-r * 0.58, -r * 0.30);
      ctx.closePath(); ctx.fill();
    } else if (key === "leaf") {
      // 小绿叶（模式说明文案前）
      ctx.beginPath();
      ctx.moveTo(-r * 0.70, r * 0.60);
      ctx.quadraticCurveTo(-r * 0.92, -r * 0.62, r * 0.76, -r * 0.80);
      ctx.quadraticCurveTo(r * 0.92, r * 0.48, -r * 0.70, r * 0.60);
      ctx.closePath(); ctx.fill();
      ctx.lineWidth = Math.max(1, s * 0.07);
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.beginPath(); ctx.moveTo(-r * 0.52, r * 0.44); ctx.lineTo(r * 0.52, -r * 0.54); ctx.stroke();
    } else if (key === "back") {
      ctx.lineWidth = Math.max(2, s * 0.16);
      ctx.beginPath();
      ctx.moveTo(r * 0.24, -r * 0.42); ctx.lineTo(-r * 0.22, 0); ctx.lineTo(r * 0.24, r * 0.42);
      ctx.stroke();
    } else if (key === "shield") {
      ctx.lineWidth = Math.max(1.4, s * 0.11);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.82);
      ctx.lineTo(r * 0.62, -r * 0.55); ctx.lineTo(r * 0.62, r * 0.1);
      ctx.quadraticCurveTo(r * 0.6, r * 0.55, 0, r * 0.85);
      ctx.quadraticCurveTo(-r * 0.6, r * 0.55, -r * 0.62, r * 0.1);
      ctx.lineTo(-r * 0.62, -r * 0.55);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.22, r * 0.05); ctx.lineTo(-r * 0.04, r * 0.26); ctx.lineTo(r * 0.3, -r * 0.18); ctx.stroke();
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
      let lf = fsize + "px sans-serif";
      ctx.font = lf;
      let tw = ctx.measureText(label).width;
      let ih = Math.min(16, h * 0.45); // Increased from 15
      let total = ih + gap + tw;
      const pad = 12; // Increased from 10
      const avail = w - pad;
      const scale = total > avail ? avail / total : 1;
      if (scale < 1) {
        fsize *= scale; ih *= scale;
        lf = fsize + "px sans-serif";
        ctx.font = lf; tw = ctx.measureText(label).width;
        total = ih + gap + tw;
      }
      const iconX = x + w / 2 - total / 2;
      const labelX = iconX + ih + gap;
      drawVecIcon(o.icon, iconX + ih / 2, y + h / 2, ih, lc);
      text(label, labelX + tw / 2, y + h / 2 + 1, lf, lc);
    } else {
      const fsize = o.primary ? 19 : 17; // Increased from 16
      const font = fsize + "px sans-serif";
      text(label, x + w / 2, y + h / 2 + 1, font,
        o.primary ? "#fff" : (o.on ? C.ink : C.ink2));
    }
    ctx.restore();
    if (o.key) btnKey(x, y, w, h, o.key, o.cb); else btn(x, y, w, h, o.cb);
  }
  ui.panel = panel; ui.text = text; ui.drawBtn = drawBtn;
  /* 按内容量算按钮宽度：文案短就窄一些，避免"内容少却撑成大宽条"（有图标时额外留图标位） */
  function fitBtnWidth(label, h, opts) {
    const o = opts || {};
    const primary = !!o.primary;
    const fsize = h >= 50 ? (primary ? 19 : 18) : (primary ? 19 : 17);
    ctx.font = fsize + "px sans-serif";
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
    const mr = G.platform.menu || null;
    const menu = mr ? { left: mr.left / S, top: mr.top / S, right: mr.right / S, bottom: mr.bottom / S, width: mr.width / S, height: mr.height / S } : null;
    const land = W > H;
    const m = land ? 24 : 18;
    const gap = 12;
    return { W, H, land, m, gap, safe, menu, S };
  }

  /* ================= 首页图片素材 =================
     3D 猫咪插画与 6 个猎物图标都从设计稿（assets/home-reference.png）裁切而来。
     加载失败时首页自动回退到矢量绘制，不影响可玩性。 */
  const HOME_IMG = { tried: false, cat: null, scene: null, icons: {} };
  const HOME_ICON_SRC = {
    fish: "assets/home/icon-fish.jpg", frog: "assets/home/icon-frog.jpg",
    mouse: "assets/home/icon-mouse.jpg", firefly: "assets/home/icon-firefly.jpg",
    butterfly: "assets/home/icon-butterfly.jpg"
  };
  /* 首页卡片 key → 素材 key（暗夜荧光用「暗夜荧光」；激光乐园不贴图，改走矢量红色激光点） */
  const HOME_ICON_KEY = { pool: "firefly" };
  ui.initHomeImages = () => {
    if (HOME_IMG.tried) return;
    HOME_IMG.tried = true;
    // 浏览器垫片页面在 test/ 下：拼一层 ../ 才能找到 assets（真机不受影响）
    const sub = (typeof location !== "undefined" && location.protocol === "file:" &&
                 /\/test\/[^/]*$/.test(decodeURIComponent(location.pathname))) ? "../" : "";
    const load = (src, cb) => {
      try {
        const img = (typeof wx !== "undefined" && wx.createImage) ? wx.createImage() : new Image();
        img.onload = () => cb(img);
        img.src = sub + src;
      } catch (e) {}
    };
    load("assets/home/cat-hero.png", img => { HOME_IMG.cat = img; });
    /* 首页「小猫看蝴蝶」场景的新背景图（自带猫与蝴蝶的整幅场景）。
       加载失败时 HOME_IMG.scene 保持 null，绘制层会自动退回旧猫图 / 矢量猫，不影响可玩性。 */
    load("assets/home/hero-scene.jpg", img => { HOME_IMG.scene = img; });
    Object.keys(HOME_ICON_SRC).forEach(k => load(HOME_ICON_SRC[k], img => { HOME_IMG.icons[k] = img; }));
  };
  const homeImg = (key) => (key === "cat" ? HOME_IMG.cat
    : key === "scene" ? HOME_IMG.scene : HOME_IMG.icons[key]) || null;
  /* 首页「激光乐园」卡图标：一颗红色激光点。
     三层结构（外柔光 / 橙红主体 / 白热核心）+ 轻微呼吸，浅底卡片上也看得出「在发光」。
     外晕收在 1.6R：横屏卡高只有 70px，光晕再大就会溢到卡外/压到卡名。
     上下浮动由调用方按 t 给 y 偏移，本函数只管画点。 */
  function drawLaserDotIcon(c, x, y, r, t) {
    const pulse = 1 + Math.sin(t * 3.4) * .08;      // 呼吸：命中光点的"灼热感"
    const R = r * pulse;
    let g = c.createRadialGradient(x, y, 0, x, y, R * 1.6);
    g.addColorStop(0, "rgba(255,104,96,.44)");
    g.addColorStop(.45, "rgba(233,48,42,.16)");
    g.addColorStop(1, "rgba(214,26,26,0)");
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, R * 1.6, 0, Math.PI * 2); c.fill();

    g = c.createRadialGradient(x - R * .2, y - R * .24, R * .05, x, y, R);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(.26, "#ffd9cd");
    g.addColorStop(.56, "#ff5f4c");
    g.addColorStop(.85, "#e62520");
    g.addColorStop(1, "rgba(196,18,18,.94)");
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fill();

    c.fillStyle = "rgba(255,255,255,.88)";
    c.beginPath(); c.ellipse(x - R * .30, y - R * .34, R * .20, R * .13, -.6, 0, Math.PI * 2); c.fill();
  }

  /* 猫图（assets/home/cat-hero.png，540×253）与其主体占位。
     素材四周本来就是 alpha 渐隐的透明留白（左缘 14→210、上缘 37→190 渐变），
     所以不需要再在离屏画布上二次羽化——再擦一遍只会把右上角的蝴蝶擦薄、并让照片发白发灰。
     下面这组数字是从素材里量出来的「主体框」与「蝴蝶框」（像素）：
     缩放只保证主体完整可见，四周留白允许溢出屏外，既不裁内容也不拉伸。 */
  const HERO_BOX = { x: 61, y: 17, w: 418, h: 173 };
  /* 首页「小猫看蝴蝶」场景图（assets/home/hero-scene.jpg，1400×787）。
     蝴蝶在图里的归一化位置（连通域量出来的中心），cover 裁剪时以它为锚，保证不被裁到。 */
  const HERO_SCENE = { fx: .693, fy: .197, feather: .07 };
  /* 场景图柔边：整幅照片铺进 hero 容器后，四条边做 7% 的 alpha 渐隐，
     照片才能和页面的暖砂底融在一起，而不是一块硬边贴图。
     只在首次用到时算一遍离屏画布，之后每帧直接贴缓存。 */
  let sceneSoft = null, sceneSoftSrc = null;
  function featheredScene(img, edge) {
    if (sceneSoftSrc === img && sceneSoft) return sceneSoft;
    try {
      const mk = () => {
        const cv = (typeof wx !== "undefined" && wx.createCanvas) ? wx.createCanvas() : document.createElement("canvas");
        cv.width = img.width; cv.height = img.height;
        return cv;
      };
      const photo = mk(), mask = mk();
      const pc = photo.getContext("2d"), mc = mask.getContext("2d");
      pc.drawImage(img, 0, 0);
      /* 遮罩单独一张画布：铺满不透明黑，再按四条边用 destination-out 擦出渐变 */
      mc.fillStyle = "#000"; mc.fillRect(0, 0, img.width, img.height);
      mc.globalCompositeOperation = "destination-out";
      const cut = (x, y, w, h, x0, y0, x1, y1) => {
        const g = mc.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
        mc.fillStyle = g; mc.fillRect(x, y, w, h);
      };
      const IW = img.width, IH = img.height;
      const ex = Math.max(2, Math.round(IW * edge)), ey = Math.max(2, Math.round(IH * edge));
      cut(0, 0, ex, IH, 0, 0, ex, 0);
      cut(IW - ex, 0, ex, IH, IW, 0, IW - ex, 0);
      cut(0, 0, IW, ey, 0, 0, 0, ey);
      cut(0, IH - ey, IW, ey, 0, IH, 0, IH - ey);
      pc.globalCompositeOperation = "destination-in";
      pc.drawImage(mask, 0, 0);
      sceneSoft = photo; sceneSoftSrc = img;
      return photo;
    } catch (e) { return img; }
  }
  const HERO_BFLY = { x0: 395, y0: 60, x1: 478, y1: 140 };

  /* 只画不填的圆角矩形路径（G.rr 内部会 fill，描边/裁剪要用这个） */
  function rrPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* 按可用宽度自动收敛字号：任何文案在窄屏都不撑出容器（设计稿字号 × 屏幕系数后再过这道闸） */
  function fitFont(str, size, maxW, weight) {
    let fs = Math.max(9, Math.round(size));
    const w = weight || "normal";
    ctx.font = w + " " + fs + "px sans-serif";
    while (fs > 9 && ctx.measureText(str).width > maxW) {
      fs -= 1;
      ctx.font = w + " " + fs + "px sans-serif";
    }
    return fs;
  }
  /* 爪印：首页品牌与模式选择页品牌共用（同一形状，避免两处各画一套） */
  function pawMarkAt(cx, cy, size, color) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(size / 36, size / 36); ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 5, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
    [[-11, -8, 4.1], [-4, -14, 4.3], [4, -14, 4.3], [11, -8, 4.1]].forEach(([x, y, r]) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  /* ================= 现代设计基元（全站共用的薄荷绿视觉系统） =================
     对齐设计稿：浅薄荷绿页底 / 纯白圆角卡 + 柔影 / 青绿选中 / 青绿渐变主行动。
     orange* 是历史键名，色值已换成青绿主色，全站 CTA 不再出现橙色。
     用法：pageBg 画页底；softCard 画卡片；chipIcon 画标题/列表的图标芯片；
     chipBtn 画返回/分享这类白色圆键；CTA 直接铺青绿渐变 + 柔光（见各页）。 */
  const DK = {
    page: ["#eaf7ef", "#f8fcf7", "#eef6e8"],
    card: "#ffffff", cardLine: "rgba(214,232,218,.92)",
    shadow: "rgba(46,92,72,.14)",
    track: "#e7f2e9", trackLine: "rgba(163,203,178,.55)",
    chipTeal: "rgba(21,154,140,.13)", chipOrange: "rgba(64,178,133,.16)", chipAmber: "rgba(120,196,120,.20)",
    orange0: "#4fcba4", orange1: "#0d8b76", orangeGlow: "rgba(14,110,90,.28)",
    orangeRing: "rgba(190,244,220,.72)"
  };
  /* ================= 轻薄线性基元（无阴影 / 无厚度 / 无球面高光） =================
     从「浮雕实体」换成「细描边」：极淡渐变底 + 1.4px 青绿细线框，圆角更柔；
     按钮改两段柔和青绿渐变 + 一圈细描边，不再有投影、底部厚度带和顶部高光块。
     调用点里遗留的 shadow/blur/dy/edge/gloss 参数已不再生效（保留是为了兼容旧调用）。
     G.rr 内部自带 fill；描边一律用 rrPath 重建路径。 */
  function raisedCard(x, y, w, h, r, o) {
    const op = o || {}, rad = r == null ? 18 : r;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, op.top || "#ffffff");
    g.addColorStop(1, op.bottom || "#f7fcf8");
    ctx.fillStyle = g;
    G.rr(ctx, x, y, w, h, rad); ctx.fill();
    ctx.fillStyle = "transparent";
    ctx.strokeStyle = op.line || "rgba(21,154,140,.26)";
    ctx.lineWidth = op.lineW || 1.4;
    rrPath(x + .8, y + .8, w - 1.6, h - 1.6, rad); ctx.stroke();
  }
  function raisedButton(x, y, w, h, o) {
    const op = o || {};
    const r = op.r == null ? Math.max(8, Math.min(h * .42, 26)) : op.r;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, op.c0 || "#3ec8a5");
    g.addColorStop(1, op.c1 || "#0e8e78");
    ctx.fillStyle = g;
    G.rr(ctx, x, y, w, h, r); ctx.fill();
    ctx.fillStyle = "transparent";
    ctx.strokeStyle = op.ring || (op.light ? "rgba(21,154,140,.38)" : "rgba(255,255,255,.85)");
    ctx.lineWidth = 1.5;
    rrPath(x + 1.5, y + 1.5, w - 3, h - 3, Math.max(2, r - 1.5)); ctx.stroke();
  }

  /* 薄荷绿页面底（与首页同一族，页面之间不跳色）；e 可选淡入系数 */
  function pageBg(W, H, e) {
    const bg = ctx.createLinearGradient(0, 0, W * 0.86, H);
    bg.addColorStop(0, DK.page[0]); bg.addColorStop(.46, DK.page[1]); bg.addColorStop(1, DK.page[2]);
    ctx.save();
    ctx.globalAlpha = e == null ? 1 : e;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  /* 全站白卡：细描边轻薄卡（设置/记录/排行/暂停等页共用） */
  function softCard(x, y, w, h, r, big) {
    raisedCard(x, y, w, h, r == null ? 18 : r, { line: DK.cardLine });
  }
  /* 图标芯片：淡色圆底 + 矢量图标（标题/列表用） */
  function chipIcon(key, cx, cy, d, tint, iconColor) {
    ctx.fillStyle = tint || DK.chipTeal;
    ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill();
    drawVecIcon(key, cx, cy, d * 0.60, iconColor || C.tealDeep);
  }
  /* 白色圆键：纯白 + 青绿细描边，无阴影无球面高光 */
  function chipBtn(x, y, s, iconKey, o) {
    const op = o || {}, cx = x + s / 2, cy = y + s / 2, R = s / 2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(21,154,140,.32)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, R - .8, 0, Math.PI * 2); ctx.stroke();
    if (iconKey) drawVecIcon(iconKey, x + s / 2, y + s / 2, s * 0.52, op.color || C.ink2);
    if (op.cb) { if (op.key) btnKey(x, y, s, s, op.key, op.cb); else btn(x, y, s, s, op.cb); }
  }
  /* 胶囊返回键（二级页面统一）：横向圆角胶囊 + ‹ 箭头 + 「返回」文字，替代原来的圆形返回键。
     与页面里的步骤胶囊 / 分段 tab / 主按钮同一套视觉语言，白底 + 青绿细描边，无阴影。
     h 沿用原圆键直径保证视觉份量；宽度按字号自适应，可用 o.w 指定。返回实际宽度 w，
     调用方据此把紧随其后的标题 / 分享键 / 自定义键顺移，避免重叠。 */
  function backPill(x, y, h, o) {
    const op = o || {};
    const fs = op.fs || Math.max(12, Math.round(h * 0.40));
    const pad = op.pad == null ? Math.round(h * 0.30) : op.pad;
    const gap = op.gap == null ? Math.round(h * 0.16) : op.gap;
    ctx.font = fs + "px sans-serif";
    const tw = ctx.measureText("返回").width;
    const ax = fs * 0.72;                              // 箭头占位宽
    const w = Math.ceil(op.w || (pad + ax + gap + tw + pad));
    const r = op.r == null ? h / 2 : op.r;
    const col = op.color || C.ink2;
    ctx.fillStyle = "#ffffff";
    G.rr(ctx, x, y, w, h, r); ctx.fill();
    ctx.fillStyle = "transparent";
    ctx.strokeStyle = op.line || "rgba(21,154,140,.32)"; ctx.lineWidth = 1.4;
    rrPath(x + .8, y + .8, w - 1.6, h - 1.6, Math.max(2, r - .8)); ctx.stroke();
    const cy = y + h / 2;
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, h * 0.085);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const acx = x + pad + ax / 2;
    ctx.beginPath();
    ctx.moveTo(acx + ax * 0.22, cy - ax * 0.34);
    ctx.lineTo(acx - ax * 0.22, cy);
    ctx.lineTo(acx + ax * 0.22, cy + ax * 0.34);
    ctx.stroke();
    text("返回", acx + ax / 2 + gap + tw / 2, cy + 1, fs + "px sans-serif", col);
    if (op.cb) { if (op.key) btnKey(x, y, w, h, op.key, op.cb); else btn(x, y, w, h, op.cb); }
    return w;
  }
  ui.backPill = backPill;    // 电子猫粮机页（feeder.js）复用同一份胶囊返回键
  /* 青绿主行动按钮（全站同款细描边按钮，文字由调用方画） */
  function orangePill(x, y, w, h, o) {
    const op = o || {};
    raisedButton(x, y, w, h, {
      ring: op.ring === false ? "rgba(255,255,255,.42)" : DK.orangeRing
    });
  }

  /* ================= 首页 =================
     卡片顺序即数组顺序（3 列排列，一行 3 个）：
     第一行 捕鱼 / 青蛙 / 激光　第二行 捕鼠 / 暗夜 / 蝴蝶 */
  const MODES = [
    { key: "fish",      name: "小鱼水波", desc: "三条小鱼随波游动" },
    { key: "frog",      name: "青蛙池塘", desc: "荷叶之间来回跳" },
    { key: "mouse",     name: "小鼠迷宫", desc: "打地鼠式两排洞口" },
    { key: "pool",      name: "暗夜荧光",   desc: "荧光小虫爬过石板地" },
    { key: "butterfly", name: "蝴蝶花园", desc: "花间穿梭，还会停花" },
    { key: "laser",     name: "激光乐园", desc: "红点甩动与停留" }
  ];
  /* 原型同款圆形开始按钮：青绿径向渐变 + 12px 外圈光环 + 内描边圈
     中心小鱼往返游动(swimDrift 3.4s) + 摆尾 + 上升气泡 + 整体呼吸(breath 2.8s) */
  ui.drawStartOrb = (cx, cy, D, label, cb) => {
    const t = Date.now() / 1000;
    const R = D / 2;
    const sc = D / 148;                       // 相对原型 148px 的缩放
    const breath = 1 + Math.sin(t * Math.PI * 2 / 2.8) * 0.018;

    // 外圈光环（青蓝海水）
    ctx.fillStyle = "rgba(96,206,214,.18)";
    ctx.beginPath(); ctx.arc(cx, cy, R * breath + 15 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(96,206,214,.26)";
    ctx.beginPath(); ctx.arc(cx, cy, R * breath + 8 * sc, 0, Math.PI * 2); ctx.fill();

    // 海洋球体：径向渐变（左上高光）—— 青蓝海面到深海
    ctx.save();
    const g = ctx.createRadialGradient(cx - R * .32, cy - R * .46, R * .1, cx, cy, R * breath);
    g.addColorStop(0, "#93e6e1"); g.addColorStop(.42, "#37b5c6"); g.addColorStop(.78, "#157f9c"); g.addColorStop(1, "#0a5673");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * breath, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 水下光束 + 海面波纹（clip 在球内）
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, (R - 1) * breath, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = .11; ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(cx - R * .55, cy - R); ctx.lineTo(cx - R * .12, cy - R);
    ctx.lineTo(cx + R * .34, cy + R); ctx.lineTo(cx - R * .12, cy + R);
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.lineWidth = 1.2;
    for (let i = 0; i < 2; i++) {
      const wy = cy - R * .5 + i * 7 * sc + Math.sin(t * 1.6 + i) * 1.4 * sc;
      ctx.beginPath(); ctx.moveTo(cx - R * .68, wy);
      ctx.quadraticCurveTo(cx, wy + 3 * sc, cx + R * .68, wy); ctx.stroke();
    }
    ctx.restore();

    // 内描边圈
    ctx.strokeStyle = "rgba(255,255,255,.38)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, (R - 7 * sc) * breath, 0, Math.PI * 2); ctx.stroke();

    /* --- 中心游动的鲸鱼（矢量绘制） --- */
    const fishY = cy - 9 * sc;
    // swimDrift：-14 → +14 → 翻面 → 游回（3.4s 循环）
    const ph = (t % 3.4) / 3.4;
    let dx, face;
    if (ph < 0.43)      { dx = -14 + 28 * (ph / 0.43); face = 1; }
    else if (ph < 0.5)  { dx = 14; face = 1 - 2 * ((ph - 0.43) / 0.07); }
    else if (ph < 0.93) { dx = 14 - 28 * ((ph - 0.5) / 0.43); face = -1; }
    else                { dx = -14; face = -1 + 2 * ((ph - 0.93) / 0.07); }
    dx *= sc;
    const bob = Math.sin(t * Math.PI * 2 / 1.6) * 2 * sc;
    const rot = Math.sin(t * Math.PI * 2 / 1.6 + .6) * 4 * Math.PI / 180;

    ctx.save();
    ctx.translate(cx + dx, fishY + bob);
    ctx.scale(sc * face, sc);
    ctx.rotate(rot);
    ctx.translate(-58, -34);

    // 尾鳍（独立摆动）
    const wag = Math.sin(t * Math.PI * 2 / .7) * .22;
    ctx.save(); ctx.translate(20, 38); ctx.rotate(wag); ctx.translate(-20, -38);
    ctx.fillStyle = "#1f8fa6";
    ctx.beginPath();
    ctx.moveTo(26, 34); ctx.quadraticCurveTo(8, 18, 2, 12);
    ctx.quadraticCurveTo(10, 30, 14, 38); ctx.quadraticCurveTo(10, 46, 2, 64);
    ctx.quadraticCurveTo(8, 58, 26, 42); ctx.closePath(); ctx.fill();
    ctx.restore();

    // 身体（青蓝渐变）
    const body = ctx.createLinearGradient(30, 12, 90, 60);
    body.addColorStop(0, "#a9edf1"); body.addColorStop(.55, "#5cc6d8"); body.addColorStop(1, "#2b93ae");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(22, 36);
    ctx.bezierCurveTo(34, 16, 76, 12, 96, 26);
    ctx.quadraticCurveTo(106, 32, 104, 40);
    ctx.quadraticCurveTo(102, 50, 84, 54);
    ctx.bezierCurveTo(58, 58, 34, 52, 22, 36);
    ctx.closePath(); ctx.fill();
    // 肚皮（浅色）
    ctx.fillStyle = "rgba(242,254,253,.9)";
    ctx.beginPath();
    ctx.moveTo(30, 44); ctx.bezierCurveTo(52, 56, 82, 56, 99, 43);
    ctx.quadraticCurveTo(88, 52, 60, 50); ctx.quadraticCurveTo(40, 49, 30, 44);
    ctx.closePath(); ctx.fill();
    // 背鳍
    ctx.fillStyle = "#2c93ac";
    ctx.beginPath(); ctx.moveTo(52, 18); ctx.quadraticCurveTo(58, 6, 70, 16);
    ctx.quadraticCurveTo(60, 20, 52, 18); ctx.closePath(); ctx.fill();
    // 胸鳍（轻摆）
    ctx.save(); ctx.translate(66, 46); ctx.rotate(Math.sin(t * 3) * .12); ctx.translate(-66, -46);
    ctx.fillStyle = "#2b90a8";
    ctx.beginPath(); ctx.moveTo(64, 44); ctx.quadraticCurveTo(78, 52, 74, 62);
    ctx.quadraticCurveTo(64, 56, 64, 44); ctx.closePath(); ctx.fill(); ctx.restore();
    // 眼睛
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(90, 32, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#17323b"; ctx.beginPath(); ctx.arc(92, 32, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(93, 31, 1, 0, Math.PI * 2); ctx.fill();
    // 微笑嘴
    ctx.strokeStyle = "rgba(12,70,88,.55)"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(92, 44); ctx.quadraticCurveTo(99, 49, 104, 42); ctx.stroke();
    ctx.lineCap = "butt";

    // 喷水（每 3.4s 一次，周期前段喷发）
    if (ph < .3) {
      const sp = ph / .3;
      const fade = sp < .15 ? sp / .15 : 1 - (sp - .15) / .85;
      const H = (16 + 10 * Math.sin(sp * Math.PI)) * Math.max(fade, 0);
      if (H > 1) {
        const sx = 76, sy = 15;                 // 喷水孔（头顶）
        ctx.save();
        const jet = ctx.createLinearGradient(sx, sy, sx, sy - H);
        jet.addColorStop(0, "rgba(233,252,255,.95)");
        jet.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = jet;
        ctx.beginPath();
        ctx.moveTo(sx - 3, sy);
        ctx.quadraticCurveTo(sx - 1, sy - H * .6, sx - 5 - sp * 3, sy - H);
        ctx.lineTo(sx + 5 + sp * 3, sy - H);
        ctx.quadraticCurveTo(sx + 1, sy - H * .6, sx + 3, sy);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255," + (.85 * Math.max(fade, 0)).toFixed(3) + ")";
        for (const [ox, oy, rr] of [[-7,-2,2.2],[6,-3,1.9],[0,-5,2.6],[-4,-8,1.5],[5,-9,1.7],[1,-12,1.3]]) {
          ctx.beginPath(); ctx.arc(sx + ox * (1 + sp * .4), sy - H + oy, rr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    }
    ctx.restore();  // 鲸鱼

    // 上升气泡（水下）
    for (const [bxr, delay, r] of [[0.2, 0, 2.6], [0.78, 1.4, 2.1], [0.52, .7, 1.7]]) {
      const bp = ((t + delay) % 2.8) / 2.8;
      const bubY = cy + R * .34 - bp * R * .95;
      const a = bp < .18 ? (bp / .18) * .7 : .7 * (1 - (bp - .18) / .82);
      ctx.fillStyle = "rgba(255,255,255," + Math.max(a, 0).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(cx + (bxr - .5) * R * 1.25 + Math.sin(bp * 8 + bxr * 10) * 2 * sc, bubY, r * sc, 0, Math.PI * 2);
      ctx.fill();
    }

    // 文字
    const fsz = Math.round(15 * Math.max(sc, 0.82));
    ctx.font = fsz + "px sans-serif";
    const label2 = label.split("").join(String.fromCharCode(8202));
    text(label2, cx, cy + R * 0.44, ctx.font, "#fff");
    btn(cx - R, cy - R, D, D, cb);
  };

  /* 设计稿同款「开始玩耍」胶囊按钮（首页-green.png）：
     青绿竖向渐变体 + 顶部内高光 + 柔和投影 + 左侧白色播放三角 + 右端淡爪印水印 + 慢速掠过的高光。
     文字用常规字重，靠字号和留白撑层级（不加粗）。命中区仍是调用方给的矩形。 */
  ui.drawStartPill = (x, y, w, h, label, cb) => {
    const t = Date.now() / 1000;
    const r = h / 2;
    const cy = y + h / 2;

    // 投影：向下偏移 + 大模糊，落在暖底上像"立"起来
    ctx.save();
    ctx.shadowColor = "rgba(26,74,58,.28)";
    ctx.shadowBlur = Math.max(8, h * .38);
    ctx.shadowOffsetY = Math.max(3, h * .17);
    const body = ctx.createLinearGradient(0, y, 0, y + h);
    body.addColorStop(0, "#7cc2a2"); body.addColorStop(.46, "#3d9479"); body.addColorStop(1, "#2a6d5b");
    ctx.fillStyle = body;
    rrPath(x, y, w, h, r); ctx.fill();
    ctx.restore();

    // 体面细节都裁进胶囊内
    ctx.save();
    rrPath(x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5); ctx.clip();
    // 顶部内高光
    const hl = ctx.createLinearGradient(0, y, 0, y + h * .66);
    hl.addColorStop(0, "rgba(255,255,255,.34)"); hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl; ctx.fillRect(x, y, w, h * .66);
    // 慢速掠过的高光（4.4s 一次，避免整块按钮死板）
    const sweep = ((t % 4.4) / 4.4) * 1.6 - .3;
    if (sweep > -.2 && sweep < 1.2) {
      const sx = x + w * sweep;
      const sg = ctx.createLinearGradient(sx - h * .8, y, sx + h * .8, y + h);
      sg.addColorStop(0, "rgba(255,255,255,0)");
      sg.addColorStop(.5, "rgba(255,255,255,.13)");
      sg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(sx - h * .5, y); ctx.lineTo(sx + h * .22, y);
      ctx.lineTo(sx + h * .92, y + h); ctx.lineTo(sx + h * .2, y + h);
      ctx.closePath(); ctx.fill();
    }
    // 右端淡爪印水印（两颗，一高一低，像是按钮上的压印）
    const pawAt = (px, py, s, a) => {
      ctx.save(); ctx.translate(px, py); ctx.scale(s, s);
      ctx.globalAlpha = a; ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(0, 1.6, 3.4, 2.9, 0, 0, Math.PI * 2); ctx.fill();
      for (const [ox, oy, rr] of [[-3.3, -2.6, 1.3], [0, -3.9, 1.35], [3.3, -2.6, 1.3]]) {
        ctx.beginPath(); ctx.arc(ox, oy, rr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };
    const pawS = h / 26;
    pawAt(x + w - h * .62, y + h * .40, pawS, .22);
    pawAt(x + w - h * .40, y + h * .62, pawS * .82, .16);
    ctx.restore();

    // 细描边：右上亮、左下暗，做出玻璃感
    ctx.strokeStyle = "rgba(255,255,255,.40)"; ctx.lineWidth = 1.4;
    rrPath(x + 1.4, y + 1.4, w - 2.8, h - 2.8, r - 1.4); ctx.stroke();

    // 左侧播放三角
    const tri = h * .40;
    const triX = x + h * .70;
    ctx.save();
    ctx.shadowColor = "rgba(12,60,46,.28)"; ctx.shadowBlur = Math.max(2, h * .10); ctx.shadowOffsetY = 1;
    ctx.fillStyle = "rgba(255,255,255,.97)";
    ctx.beginPath();
    ctx.moveTo(triX - tri * .34, cy - tri * .56);
    ctx.lineTo(triX + tri * .62, cy);
    ctx.lineTo(triX - tri * .34, cy + tri * .56);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // 文字：三角右侧的剩余空间居中，字号受按钮高度约束
    const textX0 = triX + tri * .74;
    const textW = Math.max(24, x + w - h * .46 - textX0);
    const fs = fitFont(label, Math.min(h * .44, 21), textW, "normal");
    text(label, textX0 + textW / 2, cy - .5, fs + "px sans-serif", "#ffffff");

    btn(x, y, w, h, cb);
  };

  ui.drawHome = () => {
    ui.initHomeImages();
    const { W, H, land, m, gap, safe, menu, S } = layout();
    const padX = land ? 24 : 16;
    let edgeL = safe.left + padX, edgeR = W - safe.right - padX;
    let availW = edgeR - edgeL;
    const availH = H - safe.top - safe.bottom;
    /* 平板判定：横屏 + 已被倍率放大。缩放因子只由面积决定，横屏手机最高约 1.1（如 932×430），
       iPad 4:3 横屏是 1.55、13" 是 2.0，用 S 单独判断即可，不能再叠加宽高比条件（4:3 只有 1.33）。
       平板做两件事——① 内容列收敛到物理 1120vp 并居中，13" 与 10" 元素尺寸一致；
       ② 左右分区从 49/51 改成 38/62，面板变宽后 3 列卡片回到接近方形。 */
    const tablet = land && S > 1.35;
    if (tablet) {
      const maxW = 1120 / S;
      if (availW > maxW) { const cut = (availW - maxW) * .5; edgeL += cut; edgeR -= cut; availW = maxW; }
    }
    const t = Date.now() / 1000;
    /* 字号统一按屏幕档位缩放：虚拟 765×431 为基准 k=1；矮横屏（虚拟 H≈390）k≈0.90。
       旧版只缩品牌、不缩面板/卡片/CTA，导致「品牌小、卡片字大」的层级失衡；
       现在所有文字共用一个系数，再由 fitFont 按各自容器宽度兜底。竖屏沿用独立字号 k=1。 */
    const k = land ? Math.max(.78, Math.min(1.12, Math.min(H / 431, W / 765))) : 1;
    const F = (n) => Math.max(9, Math.round(n * k));

    /* 首页背景：暖阳房景（对齐设计稿「首页-green.png」的照片感柔焦底）。
       分层顺序——暖砂渐变 → 左上窗光 → 右上冷反光 → 景深光斑 → 四角虚焦绿植 → 奶白软垫 → 边缘暗角。
       全部矢量绘制、不新增图片素材；颜色按设计稿取样（顶 #f4e6dc / 底 #decdc1 / 右 #e4d6be / 左下绿植 #b6ad87）。 */
    const bg = ctx.createLinearGradient(0, 0, W * .72, H);
    bg.addColorStop(0, "#f8f4ed"); bg.addColorStop(.34, "#f0e4d4");
    bg.addColorStop(.70, "#e6d5c0"); bg.addColorStop(1, "#dbc7b4");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    /* 柔光圆盘：大半径 + 多段透明，边缘永远看不到硬圈（窗光、反光、光斑共用） */
    const softDisc = (cx, cy, r, c0, c1) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, c0); g.addColorStop(.58, c1); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    };
    softDisc(W * .30, -H * .18, Math.max(W, H) * .78, "rgba(255,253,247,.72)", "rgba(255,250,240,.16)");
    softDisc(W * .93, -H * .22, Math.max(W, H) * .52, "rgba(224,237,242,.44)", "rgba(224,237,242,.10)");
    // 景深光斑：照片感的关键，暖白小光点散在焦外
    [[.12,.24,62,.09],[.21,.70,44,.07],[.40,.11,74,.06],[.55,.32,38,.05],
     [.76,.72,66,.08],[.89,.26,50,.07],[.33,.87,82,.06],[.66,.56,36,.05],
     [.05,.52,48,.06],[.47,.78,30,.04]].forEach(bk => {
      const r = Math.min(W, H) * bk[2] / 100;
      softDisc(W * bk[0], H * bk[1], r,
        "rgba(255,249,236," + bk[3] + ")", "rgba(255,246,232," + (bk[3] * .34).toFixed(3) + ")");
    });
    // 四角虚焦绿植（更大、更淡，模拟阳光房的景深）
    const foliage = (x, y, s, flip, rot0) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(flip || 1, 1); ctx.rotate(rot0 || -.55);
      ctx.shadowColor = "rgba(94,116,58,.16)"; ctx.shadowBlur = s * .34;
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = layer ? "rgba(152,170,112,.10)" : "rgba(120,140,78,.16)";
        for (let i = 0; i < 7; i++) {
          ctx.save(); ctx.rotate((i - 3) * .26 + layer * .12);
          ctx.beginPath();
          ctx.ellipse(layer * s * .04, -s * (.36 + i * .09), s * (.18 - layer * .03), s * (.44 - layer * .05), 0, 0, Math.PI * 2);
          ctx.fill(); ctx.restore();
        }
      }
      ctx.restore();
    };
    const fs = Math.min(W, H) * .42;
    foliage(6, H * .18, fs, 1, -.52); foliage(W - 6, H * .16, fs * .94, -1, .52);
    foliage(W * .02, H * 1.02, fs * .92, 1, -.9); foliage(W * .98, H * 1.04, fs, -1, .9);
    // 奶白色软垫（参考图猫趴着的 cushion）：上缘留一道受光的高光
    const rug = ctx.createLinearGradient(0, H * .66, 0, H);
    rug.addColorStop(0, "rgba(255,251,243,.58)"); rug.addColorStop(.55, "rgba(246,236,222,.86)");
    rug.addColorStop(1, "rgba(236,222,205,.94)");
    ctx.fillStyle = rug; ctx.beginPath(); ctx.ellipse(W * .43, H * 1.04, W * .74, H * .34, 0, 0, Math.PI * 2); ctx.fill();
    // 边缘暗角：压住四周，让中间的光和白卡更"立"
    const vg = ctx.createRadialGradient(W * .42, H * .46, Math.min(W, H) * .30, W * .42, H * .46, Math.max(W, H) * .82);
    vg.addColorStop(0, "rgba(118,94,62,0)"); vg.addColorStop(1, "rgba(118,94,62,.16)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // 顶部提亮：设计稿上缘是被窗光打亮的一面墙，品牌字压在上面也更清楚
    const topScrim = ctx.createLinearGradient(0, 0, 0, H * .36);
    topScrim.addColorStop(0, "rgba(255,252,246,.46)"); topScrim.addColorStop(1, "rgba(255,252,246,0)");
    ctx.fillStyle = topScrim; ctx.fillRect(0, 0, W, H * .36);

    // 设置入口固定在左上角；平板居中内容列时贴着内容列左侧，避免跑到屏幕最外缘。
    const gs = 36;
    const gx = Math.max(safe.left + 10, edgeL - gs - 12);
    const gy = safe.top + 8;
    const bottomH = 60, bottomY = H - safe.bottom - bottomH - 14;
    /* 右侧玩法面板的取景：横向收窄一档、纵向上下各放开一点。
       面板从「扁宽」变成更接近竖向矩形——三列卡变窄后整块不再顶到安全区右缘，
       省出的高度分给两行卡片，卡片能长高（横屏下 ch 一直是高度受限，不是宽度受限）。
       竖屏（面板横铺整屏）不改，仍用原来的两条边距。 */
    /* 广告不参与版式：这里不再给广告留横带——面板、猫图、「开始捕猎」的位置与尺寸
       完全不随广告变化。广告作为浮卡盖在猫图区下半（见文件末尾 G.homeAdRect）。 */
    const modesTopBase = land ? safe.top + Math.max(46, availH * .17) : safe.top + 72;
    const modesBottom = land ? bottomY - Math.max(6, availH * .03) : Math.min(bottomY - 14, modesTopBase + availH * .52);
    const modesTop = modesTopBase;
    const panelX = land ? edgeL + availW * (tablet ? .405 : .525) + (tablet ? 14 : 0) : edgeL;
    const panelW = land ? edgeR - panelX : availW;
    const panelY = modesTop, panelH = modesBottom - modesTop;
    const headH = land ? 48 : 40, pad = land ? 20 : 14, gridGap = land ? 16 : 12;
    const cols = 3, rows = 2;
    const cw = (panelW - pad * 2 - gridGap * (cols - 1)) / cols;
    let ch = (panelH - headH - pad - gridGap * (rows - 1)) / rows;
    // 卡片高度：横屏用「卡宽 × 系数」做上限，多出的面板空间由 gridY 垂直居中吸收，不会溢出。
    // 系数决定卡片「偏方」还是「偏方高」——调大提升格子垂直空间与可读性：
    //   平板 1.24：面板收窄后 cw 变小，若仍按 1.14 封顶，平板上的卡片反而会比改版前矮一截；
    //              抬到 1.24 后 ch 跟着变高的面板一起长，格子仍贴着面板上下内边距；
    //   手机横屏 1.22：面板窄、ch 本就受 panelH 限制（高度受限），这个上限基本不生效。
    if (land) ch = Math.min(ch, cw * (tablet ? 1.24 : 1.22));
    // 卡片高度 +3%：等比微增，宽度/内边距/圆角/内部布局全部不变，
    // gridY 垂直居中公式自动吸收多出的空间，不会溢出。
    ch *= 1.03;
    const gridY = panelY + headH + Math.max(0, (panelH - headH - pad - (rows * ch + gridGap * (rows - 1))) * .5);

    // Left brand and hero, all drawn natively so each part stays responsive and interactive.
    const heroCenterX = land ? (tablet ? (Math.max(-8, safe.left) + panelX - 16) * .5 : edgeL + availW * .245) : W / 2;
    /* 设置键移到左边后，品牌整体右移，给左上角留出 36px 键位与呼吸间距。 */
    const brandX = land ? edgeL + 74 : edgeL + 78;
    // 设计稿基准字号：品牌 34 / 副标 15（竖屏 28 / 13），全部乘 k
    const brandFs = Math.min(F(land ? 34 : 28), availH * .13);
    const subFs   = Math.min(F(land ? 15 : 13), availH * .06);
    const brandY = safe.top + (land ? (H < 400 ? 42 : 54) : 26);
    /* 副标题按两行字盒算净空（标题字盒下缘 + 3px），小字不会压进标题。
       设计稿里没有橙色下划线，弧线已删除——它压在副标题下方时看起来像删除线。 */
    const subY = brandY + brandFs * .52 + subFs * .52 + 3;

    /* 主按钮尺寸：进一步收小，避免横屏左侧过重；竖屏也同步收窄。 */
    const startW = land ? Math.min(176, availW * .24) : Math.min(210, availW * .58);
    const startH = land ? 44 : 42;
    // 猫图整体挑高：仅上移绘制位置，不改 heroBottom / startY，开始按钮锚点保持不动。
    const catLift = land ? 20 : 24;
    // Hero cat perched on the soft rug, reaching toward a small floating butterfly.
    const catScale = land ? Math.min(1, Math.max(.68, availH / 550)) : Math.min(.67, availW / 420);
    const catX = heroCenterX, catY = land ? safe.top + availH * .44 : modesBottom + 111 * catScale + 8;
    const headR = 72 * catScale;
    // 参考图裁出的 3D 猫咪插画：等宽放进左侧区域、底部贴着「开始玩耍」按钮上沿。
    // 图片自带蝴蝶，命中该分支时跳过下面的矢量蝴蝶。
    const catPic = homeImg("cat");
    // 竖屏时猫图一直伸到「开始玩耍」上方，避免被面板空间挤得过小
    /* 横屏猫图底 = min(自然底, 底栏上缘 - 96)。96 = 按钮高 72 + 猫/按钮间隙 12 + 按钮/底栏间隙 12；
       正常屏（≥1000 高的虚拟布局）自然底更小，公式不变，只有矮横屏会自动收短猫图。 */
    /* 猫图底帽随按钮高联动（按钮高 + 上间隙 12 + 下间隙 12）：
       按钮缩小后猫图不用再被无谓压短。 */
    const heroBottom = land ? Math.min(catY + 100 * catScale + 40, bottomY - startH - 24)
      : Math.min(bottomY - startH - 12, modesBottom + 190) - 8;
    const scenePic = homeImg("scene");
    if (scenePic) {
      /* 「小猫看蝴蝶」场景：新背景图按 cover 等比铺满 hero 容器（不拉伸、不留边），
         蝴蝶在图中偏右上，裁剪锚点用它的归一化位置，任何容器比例下都完整留在画面内。
         猫与蝴蝶都在图里，绘制顺序仍在品牌/面板/按钮/底栏之前 → 前景层级不变。
         图片加载失败时 scenePic 为 null，自动落到下面的旧猫图 / 矢量猫兜底。 */
      const sBoxL = land ? Math.max(-6, safe.left) : 6;
      const sBoxR = land ? panelX - 12 : W - 6;
      const sBoxW = Math.max(160, sBoxR - sBoxL);
      const sBoxT = land ? Math.min(brandY + brandFs * 1.45, subY + subFs + 8) : modesBottom + 2;
      /* 场景图显示底：横屏延伸到「开始玩耍」按钮之下、底栏之上，让图把按钮也盖在里头；
         竖屏仍按 heroBottom。heroBottom 只控制按钮锚点，不限制图片底边。 */
      const sBoxBottom = land ? bottomY - 10 : heroBottom;
      const sBoxH = Math.max(90, sBoxBottom - sBoxT);
      const iw = scenePic.width, ih = scenePic.height;
      const soft = featheredScene(scenePic, HERO_SCENE.feather);
      /* 大屏（平板，S>1.35）横屏用 contain 完整显示：整张图（猫头+蝴蝶+身体）全露出、
         不裁切、不变形，在 hero 框内水平+垂直居中，多余空间留两侧/上下边（feather 边缘
         自然淡入页面背景，不突兀）。小屏（手机横屏 / 竖屏）容器窄、cover 裁掉的是边缘
         留白，猫和蝴蝶本就在画面内，保持原 cover 不变。 */
      const bigLandscape = land && S > 1.35;
      let sc, vw, vh, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH;
      if (bigLandscape) {
        // contain：取较小缩放比，整图装进框内，居中；drawImage 用「整图→目标矩形」重载
        sc = Math.min(sBoxW / iw, sBoxH / ih);
        srcX = 0; srcY = 0; srcW = iw; srcH = ih;
        vw = iw * sc; vh = ih * sc;
        dstX = sBoxL + (sBoxW - vw) / 2;
        dstY = sBoxT + (sBoxH - vh) / 2;
        dstW = vw; dstH = vh;
      } else {
        // cover：两轴同一缩放比裁进框，绝不拉伸；水平锚点锁猫头中心(~.36)保住左侧猫头+右侧蝴蝶
        sc = Math.max(sBoxW / iw, sBoxH / ih);
        vw = Math.min(iw, sBoxW / sc); vh = Math.min(ih, sBoxH / sc);
        srcX = Math.max(0, Math.min(.36 * iw - vw / 2, iw - vw));
        srcY = Math.max(0, Math.min(HERO_SCENE.fy * ih - vh * .30, ih - vh));
        dstX = sBoxL; dstY = sBoxT; dstW = sBoxW; dstH = sBoxH;
      }
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (bigLandscape) {
        ctx.drawImage(soft, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
      } else {
        ctx.drawImage(soft, srcX, srcY, vw, vh, dstX, dstY, dstW, dstH);
      }
      ctx.restore();
      G.__heroScene = { x: sBoxL, y: sBoxT, w: sBoxW, h: sBoxH, scale: sc, mode: bigLandscape ? "contain" : "cover", dstX, dstY, dstW, dstH };
      G.__heroButterfly = null;
    } else if (catPic) {
      /* 兜底①：旧猫图。按「主体框」等比缩放：主体(猫+蝴蝶)完整装进可用区，四周透明留白溢到框外，
         这样整体比原来大 50%（横屏 picK 0.56→0.85），又不会裁掉任何内容、也不变形。
         水平以主体中心对齐；右侧永远停在选择面板左边（面板后画，绝不能让白卡压住蝴蝶）。 */
      const boxL = land ? Math.max(-6, safe.left) : 6;
      const boxR = land ? panelX - 12 : W - 6;
      const boxW = Math.max(160, boxR - boxL);
      const boxT = land ? brandY + brandFs * 1.45 : modesBottom + 2;
      const boxH = Math.max(90, heroBottom - boxT);
      const picK = Math.min((boxW - 10) / HERO_BOX.w, boxH / HERO_BOX.h);
      const dw = catPic.width * picK, dh = catPic.height * picK;
      const dx = boxL + boxW / 2 - (HERO_BOX.x + HERO_BOX.w / 2) * picK;
      const dy = heroBottom - (HERO_BOX.y + HERO_BOX.h) * picK - catLift;
      ctx.save();
      ctx.imageSmoothingEnabled = true;      // 放大后保持清晰，避免逐帧抖动
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(catPic, dx, dy, dw, dh);
      ctx.restore();
      // 蝴蝶安全区自检用（自动化截图脚本读它，不参与绘制）
      G.__heroButterfly = {
        x0: dx + HERO_BFLY.x0 * picK, y0: dy + HERO_BFLY.y0 * picK,
        x1: dx + HERO_BFLY.x1 * picK, y1: dy + HERO_BFLY.y1 * picK, k: picK
      };
    } else {
    ctx.save(); ctx.translate(catX, catY - catLift);
    // soft shadow and body
    ctx.fillStyle = "rgba(99,71,47,.13)"; ctx.beginPath(); ctx.ellipse(0, 88 * catScale, 116 * catScale, 24 * catScale, 0, 0, Math.PI * 2); ctx.fill();
    const fur = ctx.createLinearGradient(-80 * catScale, -40 * catScale, 80 * catScale, 110 * catScale);
    fur.addColorStop(0, "#d8c7b3"); fur.addColorStop(.5, "#f5eee4"); fur.addColorStop(1, "#a99784");
    ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(0, 62 * catScale, 105 * catScale, 48 * catScale, 0, Math.PI, Math.PI * 2); ctx.fill();
    // ears and head
    ctx.fillStyle = "#b9a28e";
    ctx.beginPath(); ctx.moveTo(-58 * catScale, -30 * catScale); ctx.lineTo(-68 * catScale, -111 * catScale); ctx.quadraticCurveTo(-25 * catScale, -95 * catScale, -15 * catScale, -60 * catScale); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(58 * catScale, -30 * catScale); ctx.lineTo(68 * catScale, -111 * catScale); ctx.quadraticCurveTo(25 * catScale, -95 * catScale, 15 * catScale, -60 * catScale); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e9aaa0";
    ctx.beginPath(); ctx.moveTo(-54 * catScale, -48 * catScale); ctx.lineTo(-60 * catScale, -96 * catScale); ctx.lineTo(-28 * catScale, -64 * catScale); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(54 * catScale, -48 * catScale); ctx.lineTo(60 * catScale, -96 * catScale); ctx.lineTo(28 * catScale, -64 * catScale); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fur; ctx.beginPath(); ctx.arc(0, -24 * catScale, headR, 0, Math.PI * 2); ctx.fill();
    // Tabby markings: layered forehead and cheek stripes give the mascot a more individual coat.
    ctx.strokeStyle = "rgba(114,91,72,.56)"; ctx.lineWidth = 5 * catScale; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-25 * catScale, -79 * catScale); ctx.quadraticCurveTo(-18 * catScale, -65 * catScale, -16 * catScale, -53 * catScale);
    ctx.moveTo(0, -88 * catScale); ctx.lineTo(0, -58 * catScale);
    ctx.moveTo(25 * catScale, -79 * catScale); ctx.quadraticCurveTo(18 * catScale, -65 * catScale, 16 * catScale, -53 * catScale);
    ctx.moveTo(-59 * catScale, -31 * catScale); ctx.quadraticCurveTo(-48 * catScale, -23 * catScale, -43 * catScale, -12 * catScale);
    ctx.moveTo(59 * catScale, -31 * catScale); ctx.quadraticCurveTo(48 * catScale, -23 * catScale, 43 * catScale, -12 * catScale);
    ctx.stroke(); ctx.lineCap = "butt";
    // white muzzle, bright eyes and nose
    ctx.fillStyle = "#fffaf2"; ctx.beginPath(); ctx.ellipse(0, 2 * catScale, 48 * catScale, 32 * catScale, 0, 0, Math.PI * 2); ctx.fill();
    for (const ex of [-27, 27]) {
      ctx.fillStyle = "#fffdfa"; ctx.beginPath(); ctx.ellipse(ex * catScale, -33 * catScale, 18 * catScale, 22 * catScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2a211c"; ctx.beginPath(); ctx.ellipse(ex * catScale, -32 * catScale, 12 * catScale, 16 * catScale, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc((ex - 4) * catScale, -39 * catScale, 5 * catScale, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.beginPath(); ctx.arc((ex + 4) * catScale, -26 * catScale, 2.2 * catScale, 0, Math.PI * 2); ctx.fill();
    }
    // 脸颊腮红 + 额前细虎斑，贴近参考图的 3D 质感
    ctx.fillStyle = "rgba(232,148,142,.22)";
    ctx.beginPath(); ctx.ellipse(-42 * catScale, 2 * catScale, 13 * catScale, 8 * catScale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(42 * catScale, 2 * catScale, 13 * catScale, 8 * catScale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(114,91,72,.22)"; ctx.lineWidth = 2.2 * catScale;
    ctx.beginPath();
    ctx.moveTo(-12 * catScale, -84 * catScale); ctx.quadraticCurveTo(-9 * catScale, -72 * catScale, -8 * catScale, -62 * catScale);
    ctx.moveTo(12 * catScale, -84 * catScale); ctx.quadraticCurveTo(9 * catScale, -72 * catScale, 8 * catScale, -62 * catScale);
    ctx.stroke();
    ctx.fillStyle = "#e98f89"; ctx.beginPath(); ctx.moveTo(-7 * catScale, -3 * catScale); ctx.lineTo(7 * catScale, -3 * catScale); ctx.lineTo(0, 5 * catScale); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(79,66,55,.6)"; ctx.lineWidth = 1.5 * catScale;
    ctx.beginPath(); ctx.moveTo(0, 5 * catScale); ctx.lineTo(0, 12 * catScale); ctx.moveTo(0, 12 * catScale); ctx.quadraticCurveTo(-9 * catScale, 19 * catScale, -17 * catScale, 13 * catScale); ctx.moveTo(0, 12 * catScale); ctx.quadraticCurveTo(9 * catScale, 19 * catScale, 17 * catScale, 13 * catScale); ctx.stroke();
    // One paw reaches toward the butterfly; the other rests over the blanket edge.
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(54 * catScale, 56 * catScale);
    ctx.quadraticCurveTo(78 * catScale, 45 * catScale, 88 * catScale, 23 * catScale);
    ctx.lineTo(104 * catScale, -38 * catScale);
    ctx.quadraticCurveTo(111 * catScale, -55 * catScale, 126 * catScale, -50 * catScale);
    ctx.quadraticCurveTo(140 * catScale, -45 * catScale, 137 * catScale, -29 * catScale);
    ctx.lineTo(119 * catScale, 39 * catScale);
    ctx.quadraticCurveTo(109 * catScale, 78 * catScale, 68 * catScale, 88 * catScale);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff9f0"; ctx.beginPath(); ctx.ellipse(129 * catScale, -42 * catScale, 23 * catScale, 18 * catScale, -.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e9aaa0";
    [-.55, 0, .55].forEach(a => { ctx.beginPath(); ctx.arc((129 + Math.sin(a) * 12) * catScale, (-42 - Math.cos(a) * 7) * catScale, 4.3 * catScale, 0, Math.PI * 2); ctx.fill(); });
    ctx.beginPath(); ctx.ellipse(129 * catScale, -39 * catScale, 7 * catScale, 5.5 * catScale, 0, 0, Math.PI * 2); ctx.fill();
    // The left paw rests on the blanket edge.
    ctx.fillStyle = "#fff9f0";
    ctx.beginPath(); ctx.ellipse(-52 * catScale, 76 * catScale, 32 * catScale, 17 * catScale, -.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    }

    // Small butterfly accent above the cat.（素材里的猫已带蝴蝶，仅在矢量兜底时补画）
    if (!catPic) {
    ctx.save(); ctx.translate(land ? heroCenterX + 156 * catScale : heroCenterX + 58, land ? catY - 105 * catScale - catLift : catY - 85 - catLift);
    ctx.rotate(Math.sin(t * 1.5) * .09);
    const bw = 1 + Math.sin(t * 6) * .12;
    ctx.scale(bw, 1);
    for (const sgn of [-1, 1]) {
      ctx.save(); ctx.scale(sgn, 1);
      const wg = ctx.createLinearGradient(0, -22, 14, 16);
      wg.addColorStop(0, "#ffb43c"); wg.addColorStop(1, "#e3701a");
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.ellipse(11, -7, 11, 21, .46, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(9, 12, 8, 12, -.32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#33261c"; ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.ellipse(11, -7, 11, 21, .46, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(9, 12, 8, 12, -.32, 0, Math.PI * 2); ctx.stroke();
      // 黑脉 + 翅缘白点
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(18, -18); ctx.moveTo(2, 2); ctx.lineTo(20, -4); ctx.moveTo(2, 2); ctx.lineTo(14, 10); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.9)";
      for (const [px, py] of [[17,-19],[21,-12],[20,-3],[16,4],[14,16],[8,19]]) { ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.fillStyle = "#33261c"; ctx.beginPath(); ctx.ellipse(0, 0, 2.8, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#54402c"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1, -11); ctx.quadraticCurveTo(-8, -23, -12, -23); ctx.moveTo(1, -11); ctx.quadraticCurveTo(8, -23, 12, -23); ctx.stroke(); ctx.restore();
    }

    /* 图层顺序：猫图(上面已画)作为最底的背景层；设置按钮与品牌文字后画，
       保证压在猫图之上，不再被猫图遮挡。*/
    ctx.fillStyle = "rgba(255,255,255,.78)"; ctx.strokeStyle = "rgba(32,68,70,.10)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(gx + gs / 2, gy + gs / 2, gs / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawVecIcon("gear", gx + gs / 2, gy + gs / 2, 18, C.ink2); btn(gx, gy, gs, gs, () => G.openSettings());

    // 品牌与左上角设置键同排：爪印在文字左侧，整体按设置键宽度顺移。
    pawMarkAt(brandX - 30, brandY, F(land ? 34 : 26), "#2fb398");
    text("逗猫乐园", brandX, brandY - (land ? 3 : 4),
      fitFont("逗猫乐园", brandFs, land ? availW * .34 : availW - 96, "normal") + "px sans-serif", C.ink, "left");
    text("让猫咪，快乐每一天", brandX + 2, subY,
      fitFont("让猫咪，快乐每一天", subFs, land ? availW * .30 : availW - 96, "normal") + "px sans-serif", C.ink2, "left");

    // Mode selector panel and six responsive tiles.
    raisedCard(panelX, panelY, panelW, panelH, 24, {
      top: "#ffffff", bottom: "#fdf9f2", line: "rgba(158,136,108,.20)", lineW: 1.4
    });
    pawMarkAt(panelX + 26, panelY + headH / 2, F(20), "#2fb18c");
    text("选择猎物", panelX + 47, panelY + headH / 2,
      Math.min(F(18), headH * .48) + "px sans-serif", C.ink, "left");
    MODES.forEach((item, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const x = panelX + pad + c * (cw + gridGap), y = gridY + r * (ch + gridGap);
      /* 蝌蚪属于青蛙卡：targetType 停在 tadpole 时，首页仍要高亮"青蛙池塘"这张卡。 */
      const sel = G.config.targetType === item.key || (item.key === "frog" && G.config.targetType === "tadpole");
      const isPressed = ui.pressedBtn && ui.pressedBtn.x === x && ui.pressedBtn.y === y &&
        ui.pressedBtn.w === cw && ui.pressedBtn.h === ch;
      // 按下反馈：整体微缩 + 略淡，松手后恢复
      if (isPressed) {
        ctx.save();
        ctx.translate(x + cw / 2, y + ch / 2);
        ctx.scale(0.97, 0.97);
        ctx.translate(-(x + cw / 2), -(y + ch / 2));
        ctx.globalAlpha = 0.92;
      }
      // 轻薄线性玩法卡：细描边 + 极淡渐变；选中态只靠青绿描边、淡青绿底与文字色区分
      raisedCard(x, y, cw, ch, 18, sel ? {
        top: "#ffffff", bottom: "#f2faf5", line: "#2fb18c", lineW: 2.2
      } : {
        top: "#ffffff", bottom: "#fdfaf4", line: "rgba(158,136,108,.22)"
      });
      /* 兼容性关键：卡片内按高度分区——上部 60% 给图标，下部留给名称。
         旧版图标固定占 70% 卡高、名称固定 y=ch-12，矮横屏（ch≈65）两者直接叠在一起；
         现在图标尺寸/位置随 ch 走，名称字号同时受「卡宽」与「卡高」双重约束。
         平板卡片更高，多出的空间给 desc 副标题（新手能直接看懂玩法差异）。 */
      /* 图标区与名称区按卡高分区。图标尺寸用「卡宽 × 卡高」双约束的响应式比例，
         随容器等比缩放：iconBoxW = 卡宽 70%（旧 94% → 图标过大），iconH = 卡高 45%（两行）/52%（一行）。
         图标实际尺寸 = min(iconBoxW, iconH, 按宽高比换算)，任何分辨率下都等比、不变形、不溢出。 */
      /* 平板卡片高度够（ch≥96）时多排一行 desc；不够就与手机一致只留名称，
         强行塞两行会和名称挤在一起（1080×608 这类档 ch≈90）。 */
      const showDesc = tablet && ch >= 96;
      // 图标带：上部约 53% 卡高给图标，iconCY 取该带「垂直中心」——卡片变高后图标在带内仍居中。
      // 要排两行的卡片图标带略收（.48→.45），把省下的高度让给「名称 + desc」。
      const iconH = ch * (showDesc ? .45 : .52), iconCY = y + ch * (showDesc ? .265 : .275);
      const iconBoxW = cw * .70;                 // 图标宽上限：占卡宽 70%（响应式，随 cw 缩放）
      const nameFs = fitFont(item.name, Math.min(F(17), ch * (showDesc ? .19 : .21)), cw - 12, "normal");
      /* 名称：只有一行时取「图标带下缘 → 卡底」的垂直中心（.775ch）；
         要带 desc 时上提到 .70ch，desc 落在 .91ch，两行之间留出约 4px 净空。 */
      const nameY = y + (showDesc ? ch * .70 : (ch * .55 + ch) / 2);
      const iconS = Math.max(.36, Math.min(iconBoxW, iconH) / 115 * .86);
      const iconPic = homeImg(HOME_ICON_KEY[item.key] || item.key);
      const bobY = Math.sin(t * 1.4 + i) * 1.2;
      if (iconPic) {
        const ar = iconPic.width / iconPic.height;
        let iw2 = iconBoxW, ih2 = iw2 / ar;
        if (ih2 > iconH) { ih2 = iconH; iw2 = ih2 * ar; }
        ctx.save();
        rrPath(x + 2, y + 2, cw - 4, ch - 4, 12);
        ctx.clip();
        /* 3D 图标是白底 JPG：multiply 让白底融进卡片渐变（白×底色=底色），
           彩色主体只轻微加深，卡片换成任何底色都不再露出白色方块。 */
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(iconPic, x + (cw - iw2) / 2, iconCY - ih2 / 2 + bobY, iw2, ih2);
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(x + cw / 2, iconCY + (item.key === "butterfly" ? -4 : 0));
        if (item.key === "laser") {
          /* 激光乐园：矢量红色激光点。
             尺寸按「卡高图标带」与「卡宽」双重收敛（比其它图标小一档，红点实心更"重"，同尺寸会显得过大）；
             浮动直接复用上面的 bobY，与其它卡片同一套幅度(±1.2)与频率(1.4)，整体节奏统一。 */
          const dotR = Math.max(5, Math.min(iconH * .16, cw * .075));
          drawLaserDotIcon(ctx, 0, bobY, dotR, t);
        } else {
          ctx.shadowColor = "rgba(150,120,70,.16)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
          G.draw.icon(ctx, item.key, 0, bobY, iconS);
        }
        ctx.restore();
      }
      // 名称：手机只留这一行
      text(item.name, x + cw / 2, nameY, nameFs + "px sans-serif", sel ? "#0f8064" : "#243430");
      /* 平板补一行 desc 说明玩法差异（见上方 showDesc 的卡高门槛） */
      if (showDesc) {
        const descFs = fitFont(item.desc, Math.min(F(10), ch * .11), cw - 14, "normal");
        /* desc 固定落在卡高 91% 处（名称在 70%），与名称同一套「按卡高定比例」的定位方式，
           卡片变高时两行一起往下舒展，不会因绝对坐标算错而飘出卡片。
           历史上这里写成 (nameY + ch*.08 + ch)/2 —— nameY 已是绝对坐标，又叠了一次 ch，
           结果这行 desc 被算到卡片下方、甚至跑到面板与底栏之外。 */
        const descY = y + ch * .91;
        text(item.desc, x + cw / 2, descY, descFs + "px sans-serif",
          sel ? "rgba(15,128,100,.72)" : "rgba(96,104,96,.62)");
      }
      // 选中态角标：翠绿圆 + 白色对勾（设计稿里卡右上角的勾），卡片太小时不画，免得挤掉图标
      if (sel && cw >= 92) {
        const br = Math.max(7, Math.min(11, cw * .085));
        const bx = x + cw - br - 5, by = y + br + 5;
        ctx.save();
        ctx.fillStyle = "#2fb18c";
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(bx, by, br - .9, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(1.6, br * .30);
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(bx - br * .38, by + br * .04);
        ctx.lineTo(bx - br * .08, by + br * .34);
        ctx.lineTo(bx + br * .42, by - br * .32);
        ctx.stroke();
        ctx.restore();
      }
      if (isPressed) ctx.restore();
      btn(x, y, cw, ch, () => { if (G.config.targetType !== item.key) G.track("mode_pick", { mode: item.key }); G.config.targetType = item.key; G.saveConfig(); G.playTick(); });
    });

    /* 开始玩耍：设计稿同款「青绿胶囊按钮」——左侧白色播放三角 + 白色文字 + 右端淡爪印水印。
       仍是胶囊形状的实心按钮（不是圆形球），高度沿用 startH，宽度沿用 startW，命中区不变。 */
    const startY = land ? Math.max(heroBottom, bottomY - startH - 22) : Math.min(bottomY - startH - 14, modesBottom + 190);
    const pillCY = Math.min(startY + startH / 2, bottomY - startH / 2 - 8);
    ui.drawStartPill(heroCenterX - startW / 2, pillCY - startH / 2, startW, startH,
      "开始捕猎", () => G.requestStart());

    // Four familiar quick links in the reference's floating bottom bar.
    const rowBtns = [
      { label: "召唤猫咪", icon: "cat", cb: () => { G.ensureAudio(); G.stopSummonMusic(); G.summonKindIdx = 0; G.switchScreen("summon"); } },
      { label: "电子猫粮", icon: "bowl", cb: () => G.feederEnter() },
      { label: "猫咪状态", icon: "heart", key: "home-sound", cb: () => G.openSound() },
      { label: "捕猎记录", icon: "chart", cb: () => G.openModal("records") },
      { label: "好友排行", icon: "trophy", cb: () => G.openModal("lb") }
    ];
    const rowX = edgeL + (land ? availW * .11 : 0), rowW = land ? availW * .78 : availW;
    /* 底栏：落在照片底上的半透明白胶囊（带柔和投影，不用描边青绿） */
    ctx.save();
    ctx.shadowColor = "rgba(92,74,50,.20)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillStyle = "rgba(255,255,255,.93)";
    G.rr(ctx, rowX, bottomY, rowW, bottomH, Math.min(22, bottomH * .44)); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.78)"; ctx.lineWidth = 1.2;
    rrPath(rowX + .6, bottomY + .6, rowW - 1.2, bottomH - 1.2, Math.min(22, bottomH * .44)); ctx.stroke();
    const cellW = rowW / rowBtns.length;
    const homeIconColor = { cat: "#2a6f63", bowl: "#2a6f63", heart: "#2a6f63", chart: "#2a6f63", trophy: "#b8791a" };
    rowBtns.forEach((item, i) => {
      const x = rowX + i * cellW;
      if (i > 0) { ctx.strokeStyle = "rgba(122,108,88,.20)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, bottomY + 14); ctx.lineTo(x, bottomY + bottomH - 14); ctx.stroke(); }
      const compact = cellW < 116;
      if (compact) {
        /* 竖屏 / 窄横屏 5 格：图标在上、文字在下，各自整格居中。
           旧版横排（图标 .2w + 文字 .68w）在 5 格下必然撞字，必须竖排。 */
        drawVecIcon(item.icon, x + cellW / 2, bottomY + bottomH * .33, F(20), homeIconColor[item.icon] || C.ink2);
        const cellFs = fitFont(item.label, Math.min(F(12), bottomH * .26), cellW * .92, "normal");
        text(item.label, x + cellW / 2, bottomY + bottomH * .73, cellFs + "px sans-serif", "#2b3230");
      } else {
        drawVecIcon(item.icon, x + cellW * .27, bottomY + bottomH / 2, F(26), homeIconColor[item.icon] || C.ink2);
        const cellFs = fitFont(item.label, Math.min(F(15), bottomH * .36), cellW * .62, "normal");
        text(item.label, x + cellW * .62, bottomY + bottomH / 2, cellFs + "px sans-serif", "#2b3230");
      }
      btn(x, bottomY, cellW, bottomH, item.cb);
    });
  };

  /* ================= 首页原生模板广告（浮卡） =================
     只遮挡、不挤压：面板 / 卡片 / 猫图 / 「开始捕猎」/ 底栏的位置与尺寸完全不因广告改变。
     落点按屏幕方向分开：
       竖屏：贴玩法面板下缘、靠右（猫头在左，窄卡盖窗光/蝴蝶，不压猫脸）
       横屏：紧贴顶部、靠右（右缘止于胶囊左侧，浮在玩法面板上沿之上）。
             冷启动加载屏（横屏）期间 G.screen 仍是 home，这张卡就是加载页右上角的广告。
     位置算完交给 G.ad.fit 统一夹进安全区、避开微信右上角胶囊与下面声明的禁区；
     放不下（矮屏 + 大图模板）就返回 null，这条广告不出，也不去动页面。
     高度用实测值（onResize 回传），未回报时按 96 估。 */
  const HOME_AD_W = 160;        // 竖屏期望宽度：窄卡，靠右不压猫脸
  const HOME_AD_W_LAND = 200;   // 横屏同上（猫图更宽，可用 200）
  const HOME_AD_W_RATIO = .42;  // 再按猫图宽度收敛
  const HOME_AD_H = 96;         // 实测高度回来之前的估算（只用于判定能否放下）
  G.homeAdRect = () => {
    if (!G.ad || !G.ad.fit) return null;
    const { W, H, land, safe, menu, S } = layout();
    const availH = H - safe.top - safe.bottom;
    const bottomH = 60, bottomY = H - safe.bottom - bottomH - 14;   // 与 drawHome 同式，改动必须同步
    const h = Number(G.homeAdMeasuredH) || HOME_AD_H;

    if (land) {
      /* 横屏：紧贴顶部、靠右的窄卡。
         上缘贴安全区顶部；右缘止于微信胶囊左侧——这样广告与胶囊水平不相交，
         ad.fit 就不会因撞胶囊把卡自动挪到胶囊下方（那会表现为广告往下移）。
         广告是浮层：浮在玩法面板白卡上沿之上，但不碰胶囊与底部开始键/底栏。 */
      const startH = 44;
      const startY = bottomY - startH - 22;      // 开始键上沿（底部禁区）
      const top = Math.round(safe.top + 8);      // 紧贴顶部，留 8px 呼吸
      const menuL = menu ? menu.left : W - safe.right;
      const rightLimit = Math.floor(menuL - 8);  // 右缘贴胶囊左侧，避免撞胶囊被 fit 下移
      const width = Math.max(120, Math.round(W * 0.173));  // 窄卡 ≈146@844宽；保底120，避免窄虚拟宽(如683)时卡在门槛下不出
      const left = rightLimit - width;
      if (width < 120 || left < safe.left || top + h > startY) return null;
      return G.ad.fit([{ left: left, top: top, width: width, height: h }], {
        pad: 8,
        avoid: [{ left: 0, top: startY, width: W, height: H - startY }]  // 开始键 + 底栏
      });
    }

    const modesTop = safe.top + 72;
    const modesBottom = Math.min(bottomY - 14, modesTop + availH * .52);
    const startH = 42;
    /* 与 drawHome 里的 startY / heroBottom 同式——猫图区上缘即广告的垂直参考线 */
    const startY = Math.min(bottomY - startH - 14, modesBottom + 190);
    const heroBottom = Math.min(bottomY - startH - 12, modesBottom + 190) - 8;
    const width = Math.min(HOME_AD_W, Math.round(W * HOME_AD_W_RATIO), W - safe.left - safe.right - 32);
    if (width < 120) return null;
    const top = modesBottom + 8;               // 贴猫图区上缘
    if (top + h > heroBottom) return null;     // 猫图区装不下这么高的模板：不出，也不压猫
    return G.ad.fit([{ left: W - safe.right - 16 - width, top: top, width: width, height: h }], {
      pad: 10,
      avoid: [
        { left: 0, top: 0, width: W, height: modesBottom },        // 品牌 + 玩法面板：整块不许盖
        { left: 0, top: startY, width: W, height: H - startY }     // 开始捕猎 + 底栏：整块不许盖
      ]
    });
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
    if (key === "ff-walk" || key === "ff-dash") {
      /* 暗夜荧光二级卡：暗夜石板 + 会呼吸的荧光小虫；急爬卡多两道尾迹。 */
      const dash = key === "ff-dash";
      const sg = c.createLinearGradient(0, y, 0, y + h);
      sg.addColorStop(0, "#3b2a19"); sg.addColorStop(.55, "#24170e"); sg.addColorStop(1, "#160c07");
      c.fillStyle = sg; c.fillRect(x, y, w, h);
      const cell = Math.max(24, w / 8);
      c.strokeStyle = "rgba(8,3,1,.45)"; c.lineWidth = 1.3;
      for (let gx = x; gx <= x + w; gx += cell) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx, y + h); c.stroke(); }
      for (let gy = y; gy <= y + h; gy += cell) { c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w, gy); c.stroke(); }
      const cx0 = x + w * .5, cy0 = y + h * .48, s0 = Math.min(w, h) / 108;
      c.save(); c.globalCompositeOperation = "lighter";
      for (let i = 0; i < 9; i++) {
        const px = x + w * (.1 + ((i * 31) % 82) / 100), py = y + h * (.12 + ((i * 47) % 76) / 100);
        c.fillStyle = "rgba(214,255,172,.48)";
        c.beginPath(); c.arc(px, py, Math.max(1, w / 300) * (i % 3 ? 1 : 1.5), 0, Math.PI * 2); c.fill();
      }
      c.restore();
      if (dash) {
        c.strokeStyle = "rgba(226,255,152,.45)"; c.lineWidth = Math.max(2, w / 110); c.lineCap = "round";
        for (let i = 0; i < 3; i++) {
          const yy = y + h * (.36 + i * .14);
          c.beginPath(); c.moveTo(x + w * .16, yy); c.quadraticCurveTo(x + w * .32, yy - h * .06, x + w * .39, yy); c.stroke();
        }
      }
      G.draw.icon(c, "pool", cx0, cy0, s0);
    } else if (key === "bf-garden" || key === "bf-white") {
      /* 蝴蝶二级卡：花园彩蝶 / 素白蝴蝶，直接复用游戏内蝴蝶绘制。 */
      const white = key === "bf-white";
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, white ? "#dff2f4" : "#bfe3f5");
      g.addColorStop(.62, white ? "#eef7e6" : "#e8f4d8");
      g.addColorStop(1, "#9ec878");
      c.fillStyle = g; c.fillRect(x, y, w, h);
      const s0 = Math.min(w, h) / 142;
      for (let i = 0; i < 8; i++) {
        const fx = x + w * (.09 + ((i * 29) % 86) / 100), fy = y + h * (.68 + ((i * 37) % 26) / 100);
        c.fillStyle = ["#f7d3e0", "#ffe6a3", "#d9c5f2", "#ffffff"][i % 4];
        for (let k = 0; k < 5; k++) {
          const a = k / 5 * Math.PI * 2;
          c.beginPath(); c.ellipse(fx + Math.cos(a) * w * .025, fy + Math.sin(a) * h * .025,
            w * .022, h * .028, a, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = "#f6c85f"; c.beginPath(); c.arc(fx, fy, Math.max(1.4, w / 160), 0, Math.PI * 2); c.fill();
      }
      c.save(); c.translate(x + w * .5, y + h * .42); c.scale(s0, s0); c.translate(-60, -56);
      const variants = G.BFLY_VARIANTS || [];
      const fake = { state: "GLIDE", phase: .6,
        bflyVar: white ? (variants[0] || { key: "cabbage", fore: "#eeeade", fore2: "#fafaf2", hind: "#dcd9c8", hind2: "#f0eee2", body: "#6a675a" })
                       : (variants[variants.length - 1] || variants[0]) };
      G.draw.butterfly(c, fake, .6);
      c.restore();
    } else if (key === "lz-classic" || key === "lz-swift") {
      const swift = key === "lz-swift";
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, "#17181a"); g.addColorStop(.62, "#23232a"); g.addColorStop(1, "#0f1013");
      c.fillStyle = g; c.fillRect(x, y, w, h);
      c.fillStyle = "rgba(90,66,46,.26)"; c.fillRect(x, y + h * .68, w, h * .32);
      const cx0 = x + w * .5, cy0 = y + h * .46;
      if (swift) {
        c.save(); c.strokeStyle = "rgba(255,90,90,.5)"; c.lineWidth = Math.max(2, w / 120); c.lineCap = "round";
        for (let i = 0; i < 4; i++) {
          const yy = y + h * (.26 + i * .15);
          c.beginPath(); c.moveTo(x + w * .12, yy); c.lineTo(x + w * .43, yy - h * .04); c.stroke();
        }
        c.restore();
      }
      G.draw.icon(c, "laser", cx0, cy0, Math.min(w, h) / 78);
    } else if (key === "tadpole" || key === "paper") {
      /* 白纸墨影：纯白卡面 + 一条折返轨迹 + 黑色剪影。
         轨迹用虚线画，折点打淡环并标 +2，一屏说清「触边折返 / 折返时更好拍」。 */
      c.fillStyle = "#ffffff"; c.fillRect(x, y, w, h);
      const pts = [
        [x + w * .04, y + h * .70], [x + w * .36, y + h * .30],
        [x + w * .68, y + h * .62], [x + w * .97, y + h * .34]
      ];
      c.save();
      c.strokeStyle = "rgba(16,18,22,.20)";
      c.lineWidth = Math.max(1, w / 230);
      c.setLineDash([Math.max(3, w * .035), Math.max(3, w * .03)]);
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.stroke();
      c.restore();
      // 折返点：淡灰环 + 极小的 +2
      [pts[1], pts[2]].forEach((pt, i) => {
        c.strokeStyle = "rgba(16,18,22,.26)"; c.lineWidth = Math.max(1, w / 260);
        c.beginPath(); c.arc(pt[0], pt[1], Math.max(4, w * .036), 0, Math.PI * 2); c.stroke();
        if (i === 1) {
          c.fillStyle = "rgba(16,18,22,.55)";
          c.font = Math.max(7, Math.round(h * .1)) + "px sans-serif";
          c.textAlign = "center"; c.textBaseline = "middle";
          c.fillText("+2", pt[0], pt[1] - Math.max(10, h * .13));
          c.textAlign = "left"; c.textBaseline = "alphabetic";
        }
      });
      // 当前造型的大图预览：换造型时这张卡立即跟着变，是样式选择的主反馈
      G.draw.tadpolePreview(c, (G.config && G.config.tadStyle) || "ink",
        x + w * .5, y + h * .48, Math.min(w * .74, h * .86), 0.8);
      // 右下角一枚小墨点，补足"墨"的语义
      c.fillStyle = "rgba(16,18,22,.20)";
      c.beginPath(); c.arc(x + w * .86, y + h * .80, Math.max(2, w * .02), 0, Math.PI * 2); c.fill();
    } else if (key === "frog" || key === "lotus" || key === "dusk" || key === "pond") {
      /* 青蛙玩法组与荷塘卡：只画荷塘，不复用任何老鼠布景。 */
      const dusk = key === "dusk";
      const frogCard = key === "frog" || key === "pond";
      const wg = c.createLinearGradient(0, y, 0, y + h);
      if (dusk) { wg.addColorStop(0, "#101b3a"); wg.addColorStop(.52, "#1d2d55"); wg.addColorStop(1, "#0a1226"); }
      else if (frogCard) { wg.addColorStop(0, "#1c5860"); wg.addColorStop(.5, "#206e6a"); wg.addColorStop(1, "#0b313b"); }
      else { wg.addColorStop(0, "#2fa7ab"); wg.addColorStop(.5, "#33b5ab"); wg.addColorStop(1, "#156473"); }
      c.fillStyle = wg; c.fillRect(x, y, w, h);
      // 晨光光束 / 暮色高光
      if (!dusk) {
        [[.16, .10, .30], [.38, .12, .26], [.62, .10, .30], [.83, .09, .22]].forEach(bp => {
          const lg = c.createLinearGradient(0, y, 0, y + h);
          lg.addColorStop(0, "rgba(220,255,250,.19)"); lg.addColorStop(1, "rgba(220,255,250,0)");
          c.fillStyle = lg;
          c.beginPath();
          c.moveTo(x + w * bp[0], y); c.lineTo(x + w * (bp[0] + bp[1]), y);
          c.lineTo(x + w * (bp[0] + bp[1] + bp[2]), y + h); c.lineTo(x + w * (bp[0] + bp[2] * .3), y + h);
          c.closePath(); c.fill();
        });
      }
      // 藕叶 / 荷叶
      const pad = (px, py, pr) => {
        c.fillStyle = dusk ? "rgba(70,110,90,.45)" : (frogCard ? "rgba(35,112,72,.72)" : "rgba(54,142,92,.5)");
        c.beginPath(); c.ellipse(px, py, pr, pr * .82, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = "rgba(220,245,210,.28)"; c.lineWidth = Math.max(1, w / 240);
        c.beginPath(); c.moveTo(px, py);
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2 + .3;
          c.lineTo(px + Math.cos(a) * pr * .88, py + Math.sin(a) * pr * .7);
        }
        c.stroke();
      };
      pad(x + w * .20, y + h * .27, w * .13);
      pad(x + w * .82, y + h * .72, w * .16);
      pad(x + w * .55, y + h * .86, w * .10);
      // 猎物：青蛙卡用青蛙，其余用水中蝌蚪
      const ic = Math.min(w, h) / 148;
      if (frogCard) G.draw.icon(c, "frog", x + w * .5, y + h * .47, ic);
      else G.draw.icon(c, "tadpole", x + w * .5 - 58 * ic, y + h * .45 - 60 * ic, ic);
      // 浮尘 / 荧光点
      for (let i = 0; i < 9; i++) {
        const px = x + w * (.08 + ((i * 37) % 90) / 100), py = y + h * (.14 + ((i * 53) % 72) / 100);
        c.fillStyle = dusk ? "rgba(214,255,158,.75)" : "rgba(235,255,230,.62)";
        c.beginPath(); c.arc(px, py, Math.max(1, w / 320) * (i % 3 ? 1 : 1.6), 0, Math.PI * 2); c.fill();
      }
    } else if (key === "swarm") {
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
      // 微光小点（示意猎物）
      const fx2 = x + w * 0.68, fy2 = y + h * 0.42;
      const rg = c.createRadialGradient(fx2, fy2, 0, fx2, fy2, 20);
      rg.addColorStop(0, "rgba(226,255,130,.45)"); rg.addColorStop(1, "rgba(226,255,130,0)");
      c.fillStyle = rg; c.beginPath(); c.arc(fx2, fy2, 20, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(240,255,150,.95)";
      c.beginPath(); c.arc(fx2, fy2, 5, 0, Math.PI * 2); c.fill();
    } else if (key === "kelp") {
      // 水草森林：青绿海水 + 光束 + 气泡 + 圆润水草 + 鹅卵石 + 两条金鱼（贴近设计稿的 3D 水下感）
      const wg = c.createLinearGradient(0, y, 0, y + h);
      wg.addColorStop(0, "#39b6bd"); wg.addColorStop(.42, "#128a9c"); wg.addColorStop(1, "#0a4a63");
      c.fillStyle = wg; c.fillRect(x, y, w, h);
      const sun = c.createRadialGradient(x + w * .5, y - h * .15, 4, x + w * .5, y - h * .15, h * 1.5);
      sun.addColorStop(0, "rgba(215,255,250,.42)"); sun.addColorStop(1, "rgba(215,255,250,0)");
      c.fillStyle = sun; c.fillRect(x, y, w, h);
      // 光束：顶部窄、底部散开
      [[.14, .10, .30], [.34, .13, .38], [.56, .10, .32], [.76, .12, .26]].forEach(bp => {
        const lg = c.createLinearGradient(0, y, 0, y + h);
        lg.addColorStop(0, "rgba(200,250,255,.19)"); lg.addColorStop(1, "rgba(200,250,255,0)");
        c.fillStyle = lg;
        c.beginPath();
        c.moveTo(x + w * bp[0], y); c.lineTo(x + w * (bp[0] + bp[1]), y);
        c.lineTo(x + w * (bp[0] + bp[1] + bp[2]), y + h); c.lineTo(x + w * (bp[0] + bp[2] * .3), y + h);
        c.closePath(); c.fill();
      });
      // 远景水草剪影
      c.fillStyle = "rgba(9,66,76,.32)";
      for (let i = 0; i < 9; i++) {
        const bx0 = x + w * (i + .5) / 9, bh0 = h * (.17 + (i % 3) * .05);
        c.beginPath(); c.moveTo(bx0 - w * .012, y + h * .87);
        c.quadraticCurveTo(bx0 + w * .012, y + h * .87 - bh0 * .6, bx0, y + h * .87 - bh0);
        c.quadraticCurveTo(bx0 + w * .022, y + h * .87 - bh0 * .55, bx0 + w * .014, y + h * .87);
        c.closePath(); c.fill();
      }
      // 沙床
      const sand = c.createLinearGradient(0, y + h * .80, 0, y + h);
      sand.addColorStop(0, "rgba(196,214,170,0)"); sand.addColorStop(.38, "rgba(190,205,157,.55)"); sand.addColorStop(1, "#9db58c");
      c.fillStyle = sand; c.fillRect(x, y + h * .80, w, h * .20);
      // 鹅卵石
      const stone = (sx, sy, sw, sh, rot) => {
        c.save(); c.translate(sx, sy); c.rotate(rot || 0);
        const sg = c.createLinearGradient(0, -sh, 0, sh);
        sg.addColorStop(0, "#8fa8a4"); sg.addColorStop(.55, "#637f80"); sg.addColorStop(1, "#486164");
        c.fillStyle = sg;
        c.beginPath(); c.ellipse(0, 0, sw, sh, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(255,255,255,.18)";
        c.beginPath(); c.ellipse(-sw * .25, -sh * .42, sw * .48, sh * .28, -.2, 0, Math.PI * 2); c.fill();
        c.restore();
      };
      stone(x + w * .14, y + h * .91, w * .085, h * .055, -.12);
      stone(x + w * .31, y + h * .96, w * .065, h * .040, .18);
      stone(x + w * .63, y + h * .93, w * .095, h * .058, .10);
      stone(x + w * .85, y + h * .96, w * .075, h * .045, -.16);
      // 前景水草丛（圆润叶片）
      const kelp = (kx, ky, sc2, cnt) => {
        c.save(); c.translate(kx, ky); c.scale(sc2, sc2);
        const greens = ["#2f9b62", "#3bb372", "#268257", "#56c184"];
        for (let i = 0; i < cnt; i++) {
          c.save(); c.rotate((i - (cnt - 1) / 2) * .34);
          const lh = 42 + (i % 2) * 16, lw = 9 + (i % 2) * 3;
          c.fillStyle = greens[i % greens.length];
          c.beginPath();
          c.moveTo(0, 0);
          c.quadraticCurveTo(-lw, -lh * .48, -lw * .25, -lh);
          c.quadraticCurveTo(lw * .5, -lh * .72, lw * .35, 0);
          c.closePath(); c.fill();
          c.strokeStyle = "rgba(255,255,255,.14)"; c.lineWidth = 1;
          c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-lw * .2, -lh * .5, -lw * .2, -lh * .88); c.stroke();
          c.restore();
        }
        c.restore();
      };
      const ks = Math.min(w / 420, h / 240);
      kelp(x + w * .08, y + h * .93, ks * 1.15, 5);
      kelp(x + w * .26, y + h * .94, ks * .80, 3);
      kelp(x + w * .74, y + h * .94, ks * 1.20, 5);
      kelp(x + w * .93, y + h * .95, ks * .85, 3);
      // 气泡
      [[.18,.30,5],[.24,.42,3],[.32,.25,4],[.44,.55,3],[.55,.30,6],[.62,.45,3.4],[.70,.22,4.2],[.82,.50,3],[.88,.34,5]].forEach(bp => {
        const bx = x + w * bp[0], by2 = y + h * bp[1], br = Math.max(1.4, bp[2] * ks * 1.35);
        c.strokeStyle = "rgba(230,255,255,.55)"; c.lineWidth = 1;
        c.beginPath(); c.arc(bx, by2, br, 0, Math.PI * 2); c.stroke();
        c.fillStyle = "rgba(255,255,255,.16)";
        c.beginPath(); c.arc(bx, by2, br, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(255,255,255,.8)";
        c.beginPath(); c.arc(bx - br * .32, by2 - br * .35, br * .22, 0, Math.PI * 2); c.fill();
      });
      // 两条金鱼：复用游戏内 gold 鱼种，预览与实机造型一致
      const spG = (G.FISH_SPECIES || []).find(sp => sp.key === "gold");
      if (spG) {
        const fk = Math.min(w / 430, h / 250);
        drawRealFish(c, spG, spG.variants[0], x + w * .43, y + h * .42, fk * .78, .8);
        drawRealFish(c, spG, spG.variants[0], x + w * .67, y + h * .57, fk * .55, 2.1);
      }
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
      /* 小河戏鱼：与游戏内同一套配色的小幅缩略图——青绿水 + 卵石河床 + 岸边草丛/河石 +
         水面涟漪，再放两条河鱼（红金鱼 + 乌白云锦鲤），与实机布景对得上 */
      const th = (G.SEA_THEMES || []).find(t => t.key === "pool") || { bg: ["#5f9573", "#356b52", "#1e4736"] };
      // 缩略图整体比实机亮一档（小图+白底卡片里，深色水会糊成一块）
      const pg = c.createLinearGradient(0, y, 0, y + h);
      pg.addColorStop(0, "#8cc19b"); pg.addColorStop(0.55, "#579874"); pg.addColorStop(1, "#37735a");
      c.fillStyle = pg; c.fillRect(x, y, w, h);
      // 卵石河床（沙砾底 + 一把碎石）
      c.fillStyle = "rgba(146,156,116,.6)";
      c.fillRect(x, y + h * 0.26, w, h * 0.74);
      const tone = ["#8d9078", "#7c8069", "#9aa088", "#6f745c", "#a8a992"];
      for (let i = 0; i < 26; i++) {
        const hh2 = Math.sin(i * 78.233) * 43758.5453; const r1 = hh2 - Math.floor(hh2);
        const hh3 = Math.sin(i * 12.9898) * 43758.5453; const r2 = hh3 - Math.floor(hh3);
        const px2 = x + r1 * w, py2 = y + h * (0.30 + r2 * 0.68), pr = 2 + r2 * 5;
        c.fillStyle = tone[i % tone.length];
        c.globalAlpha = 0.75;
        c.beginPath(); c.ellipse(px2, py2, pr, pr * 0.72, 0, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
      // 岸边草丛（顶边两丛）
      [[0.16, 0.02], [0.78, 0.01]].forEach(gp => {
        const gx = x + w * gp[0], gy = y + h * gp[1];
        ["#a6d45f", "#8fc051", "#6f9f3f", "#c3dd7c"].forEach((gc, i2) => {
          const hh4 = 12 + i2 * 4, lx = (i2 - 1.5) * 5;
          c.strokeStyle = gc; c.lineWidth = 2; c.lineCap = "round";
          c.beginPath(); c.moveTo(gx + lx * 0.4, gy + 6);
          c.quadraticCurveTo(gx + lx * 1.1, gy - hh4 * 0.6, gx + lx * 1.5, gy - hh4);
          c.stroke();
        });
      });
      // 河石（右下角一块，带苔藓帽）
      const rkx = x + w * 0.87, rky = y + h * 0.90, rkr = Math.min(w, h) * 0.16;
      c.fillStyle = "#7c8079";
      c.beginPath(); c.ellipse(rkx, rky, rkr, rkr * 0.72, -0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#a2a598";
      c.beginPath(); c.ellipse(rkx - rkr * 0.1, rky - rkr * 0.22, rkr * 0.78, rkr * 0.46, -0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(84,132,56,.55)";
      c.beginPath(); c.ellipse(rkx - rkr * 0.1, rky - rkr * 0.46, rkr * 0.56, rkr * 0.2, 0.1, 0, Math.PI * 2); c.fill();
      // 水面涟漪（两圈，椭圆压扁）
      c.strokeStyle = "rgba(240,255,238,.6)"; c.lineWidth = 1.2;
      [0.42, 0.62].forEach((k2, i2) => {
        c.globalAlpha = 0.7 - i2 * 0.22;
        c.beginPath(); c.ellipse(x + w * 0.44, y + h * 0.56, Math.min(w, h) * k2 * 0.5, Math.min(w, h) * k2 * 0.21, 0, 0, Math.PI * 2); c.stroke();
      });
      c.globalAlpha = 1;
      // 河鱼：红金鱼（大）+ 乌白云锦鲤（小）
      const spR = (G.POOL_FISH_SPECIES || [])[0];
      const spK = (G.POOL_FISH_SPECIES || [])[2] || spR;
      const fk2 = Math.min(w / 430, h / 250);
      if (spR) drawRealFish(c, spR, spR.variants[0], x + w * 0.45, y + h * 0.44, fk2 * 0.86, 0.6);
      if (spK) drawRealFish(c, spK, spK.variants[0], x + w * 0.68, y + h * 0.72, fk2 * 0.60, 2.4);
    } else if (key === "room" || key === "plaid") {
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
    } else {
      // 兜底：未知 key 用中性水色，不能误画成老鼠房间。
      const bg2 = c.createLinearGradient(0, y, 0, y + h);
      bg2.addColorStop(0, "#dff3ec"); bg2.addColorStop(1, "#b8ddd2");
      c.fillStyle = bg2; c.fillRect(x, y, w, h);
    }
    c.restore();
  }

  /* ================= 场景 / 模式选择层（设计稿：浅薄荷绿 + 三卡画廊） =================
     对齐「鱼list.png」：顶部返回圆键 + 品牌、中间整幅场景插画大卡 + 左右露出的侧卡、
     卡下指示点与绿叶说明文案、底部「返回 / 开始游戏」双按钮。
     交互仍走 game.js 的 bgPick 状态机（左右滑动、点侧卡翻页、确认开局），
     只把绘制层换掉：绘制副本循环取模，逻辑 idx / 指示点不循环，保持跨局记忆正确。 */
  const PLAY_TITLE = {
    fish: "小鱼游玩", frog: "青蛙跳跳", mouse: "小鼠迷宫", pool: "暗夜荧光",
    butterfly: "蝴蝶飞舞", laser: "激光乐园", tadpole: "蝌蚪快跑"
  };
  /* 底部设置面板的文案必须跟着当前玩法走：不能玩老鼠还写「小鱼数量 / 水声陪伴」。
     prey=猎物名 / unit=量词 / amb=环境音名；进场景选择页的只有 fish / mouse / tadpole，
     但七种玩法都填齐，避免以后给别的玩法加多场景时串台。 */
  const PLAY_TERM = {
    fish:      { prey: "小鱼",   unit: "条", amb: "水声" },
    frog:      { prey: "青蛙",   unit: "只", amb: "水声" },
    mouse:     { prey: "小鼠",   unit: "只", amb: "环境音" },
    pool:      { prey: "萤火虫", unit: "只", amb: "夜风" },
    butterfly: { prey: "蝴蝶",   unit: "只", amb: "风声" },
    laser:     { prey: "光点",   unit: "个", amb: "环境音" },
    tadpole:   { prey: "蝌蚪",   unit: "只", amb: "水声" }
  };

  const BG_TAGLINE = {
    kelp: "清新水下世界，和小鱼一起玩耍吧~",
    pool: "清清小河里，和鱼儿一起玩水吧~",
    school: "跟着鱼群，一起巡游深海吧~",
    room: "暖暖的房间里，小鼠探出头来~",
    swarm: "好多小鼠乱窜，看你能拍中几只~",
    lotus: "晨光浅塘，小蝌蚪摇着尾巴跑~",
    dusk: "暮色深塘，荧光点点慢慢游~"
  };
  /* 浅薄荷绿页底（仅用于没有照片素材的页面；首页有猫图，必须走 drawHome 那套暖白底） */
  function greenPageBg(W, H, e) {
    const g = ctx.createLinearGradient(0, 0, W * .9, H);
    g.addColorStop(0, "#e4f4ea"); g.addColorStop(.5, "#f7fcf6"); g.addColorStop(1, "#e8f3e6");
    ctx.save(); ctx.globalAlpha = e == null ? 1 : e;
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const gl = ctx.createRadialGradient(W * .5, -H * .1, 10, W * .5, -H * .1, W * .8);
    gl.addColorStop(0, "rgba(255,255,255,.75)"); gl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    const leaf = (lx, ly, ls, flip, rot0) => {
      ctx.save(); ctx.translate(lx, ly); ctx.scale(flip || 1, 1); ctx.rotate(rot0 || -.5);
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = layer ? "rgba(122,178,102,.16)" : "rgba(86,150,86,.19)";
        for (let i = 0; i < 6; i++) {
          ctx.save(); ctx.rotate((i - 2.5) * .29 + layer * .12);
          ctx.beginPath();
          ctx.ellipse(layer * ls * .04, -ls * (.34 + i * .085), ls * (.16 - layer * .03), ls * (.40 - layer * .05), 0, 0, Math.PI * 2);
          ctx.fill(); ctx.restore();
        }
      }
      ctx.restore();
    };
    const fs = Math.min(W, H) * .34;
    leaf(4, H * .18, fs, 1, -.52); leaf(W - 4, H * .16, fs * .94, -1, .52);
    leaf(W * .02, H * 1.02, fs * .92, 1, -.9); leaf(W * .98, H * 1.04, fs, -1, .9);
    ctx.restore();
  }

  ui.drawBgPick = () => {
    const { W, H, land, safe, menu } = layout();
    const P = G.bgPick;
    if (!P) return;
    const group = (P && P.group && G.MODE_GROUPS) ? G.MODE_GROUPS[P.group] : null;
    const list = group ? group.cards : G.bgsFor(G.config.targetType);
    const n = list.length;
    if (!n) return;
    const visIdx = P.visIdx == null ? P.idx : P.visIdx;
    ui.buttons.length = 0;

    const k = land ? Math.max(.78, Math.min(1.12, Math.min(H / 431, W / 765))) : 1;
    const F = (v) => Math.max(1, Math.round(v * k));
    const openK = Math.min(1, (performance.now() - (P.t0 || 0)) / 260);
    const openE = 1 - Math.pow(1 - openK, 3);
    greenPageBg(W, H, openE);
    ctx.save();
    ctx.translate(0, (1 - openE) * 16);

    const edgeL = safe.left + 14, edgeR = W - safe.right - 14;
    const cx0 = safe.left + (W - safe.left - safe.right) / 2;

    /* ---- 顶部：胶囊返回键 + 玩法标题 + 右上步骤胶囊 ---- */
    const navS = F(40), top = safe.top + F(10);
    const backW = backPill(safe.left + F(6), top, navS, { color: C.ink2, w: F(96), key: "bgpick-top-back", cb: () => G.closeBgPick() });
    const titleFs = land ? F(30) : F(26), subFs = F(13);
    const tx = edgeL + backW + F(8), ty = top + navS * .30;
    const playTitle = group ? group.title : (PLAY_TITLE[G.config.targetType] || "逗猫乐园");
    const realTitleFs = fitFont(playTitle, titleFs, W * .34, "normal");
    text(playTitle, tx, ty, realTitleFs + "px sans-serif", C.ink, "left");
    text(group ? group.sub : "挑一个世界，让好奇心出发",
      tx + 1, ty + realTitleFs * .52 + subFs * .52 + F(3),
      subFs + "px sans-serif", C.ink2, "left");
    const stepTxt = group ? group.step : "01 选猎物  /  02 选场景";
    const stepFs = land ? F(12) : F(10);
    ctx.font = stepFs + "px sans-serif";
    const stepW = ctx.measureText(stepTxt).width + F(28), stepH = F(30);
    // 避开微信原生胶囊（devtools 的「···|◎」会盖在右上）：胶囊右缘不超过 menu.left
    const menuLimit = land && menu ? menu.left - F(10) : W + 100;
    const stepX = Math.min(edgeR - stepW, menuLimit - stepW), stepY = top + F(2);
    ctx.fillStyle = "rgba(214,235,218,.78)";
    G.rr(ctx, stepX, stepY, stepW, stepH, stepH / 2); ctx.fill();
    text(stepTxt, stepX + stepW / 2, stepY + stepH / 2, stepFs + "px sans-serif", C.ink2, "center");

    /* ---- 纵向：卡片 + 指示点 + 底部设置面板 ---- */
    const vert = !land;
    const panelH = vert ? F(150) : F(94);
    const panelW = edgeR - edgeL;
    const panelY = H - safe.bottom - F(10) - panelH;
    const dotY = panelY - F(18), dotR = F(4), dsp = F(20);
    const cardBottom = dotY - F(12);
    const topEnd = top + navS + F(12);
    const zoneH = cardBottom - topEnd;
    const CH = Math.max(150, Math.min(
      Math.round(zoneH * (vert ? .52 : .94)),
      vert ? Math.round(panelW * .58) : Math.round(panelW * .29)));
    const CW = Math.min(Math.round(CH * 1.78), Math.round(panelW - F(10)));
    const cardY = topEnd + Math.max(0, (zoneH - CH) / 2);
    const cardCY = cardY + CH / 2;
    P.cw = CW; P.ch = CH; P.gap = Math.round(W * .04);
    const step = CW + P.gap;
    /* 侧卡中心距：收到 .52 CW，让白底信息栏（名称+描述）完整露在屏幕内；
       侧卡右半被中间卡压住，实际露出宽度仍接近设计稿的约 150 虚拟像素。 */
    const dxSide = CW * .52;
    const infoH = F(58), picH = CH - infoH, rad = F(18);

    /* ---- 画廊动画：沿用拖动/吸附的 off，绘制副本循环取模 ---- */
    let off = P.off || 0;
    if (!P.drag && P.relOff) {
      const rk = Math.min(1, (performance.now() - P.relT0) / 240);
      off = P.relOff * Math.pow(1 - rk, 3);
      if (rk >= 1) P.relOff = 0;   // 回弹结束清零（与 drawSummon 同款），避免 relOff 残留、每帧空算
    }
    const cards = [];
    if (n === 1) cards.push({ b: list[0], d: off / step });
    else {
      for (let j = visIdx - 2; j <= visIdx + 2; j++) {
        const i = ((j % n) + n) % n, d = j - visIdx + off / step;
        // 只画 3 张：中间完整 + 左右各露一部分。拖动时 off 变化会让 j±2 之一进入 |d|<1.5，
        // 因此滑到边界时仍会有新卡补入，不会露出空白。
        if (Math.abs(d) < 1.5) cards.push({ b: list[i], d });
      }
    }
    if (!cards.length) cards.push({ b: list[((visIdx % n) + n) % n], d: 0 });
    cards.sort((A, B) => Math.abs(B.d) - Math.abs(A.d));

    ctx.save();
    ctx.beginPath(); ctx.rect(0, cardY - CH * .16, W, CH * 1.32); ctx.clip();
    cards.forEach(c => {
      const a = Math.min(Math.abs(c.d), 2), active = Math.abs(c.d) < .5;
      const baseSc = active ? 1 : .72;
      const sc = baseSc * (1 - Math.min(.05, Math.max(0, a - 1) * .05))
        * (active && P.selT0 ? 1 + Math.max(0, 1 - (performance.now() - P.selT0) / 220) * .035 : 1);
      const cx = cx0 + (c.d < 0 ? -1 : 1) * Math.min(a * dxSide, W * .56);
      ctx.save();
      ctx.translate(cx, cardCY); ctx.scale(sc, sc);
      if (!active) ctx.rotate(c.d < 0 ? -.015 : .015);
      const x = -CW / 2, y = -CH / 2;
      // 白底卡
      ctx.fillStyle = "#ffffff";
      G.rr(ctx, x, y, CW, CH, rad); ctx.fill();
      // 上半插画：只裁上两角圆，下沿平齐信息栏
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.lineTo(x + CW - rad, y);
      ctx.arcTo(x + CW, y, x + CW, y + rad + F(6), rad);
      ctx.lineTo(x + CW, y + picH);
      ctx.lineTo(x, y + picH);
      ctx.lineTo(x, y + rad + F(6));
      ctx.arcTo(x, y, x + rad, y, rad);
      ctx.closePath(); ctx.clip();
      drawBgPreview(ctx, c.b.key, x + F(5), y + F(5), CW - F(10), picH - F(5));
      ctx.restore();
      if (active) {
        ctx.fillStyle = "transparent"; ctx.strokeStyle = C.teal; ctx.lineWidth = 2.2;
        rrPath(x + 1.1, y + 1.1, CW - 2.2, CH - 2.2, rad); ctx.stroke();
        // 名称 + 描述同一行
        const nameFs = fitFont(c.b.name, F(17), CW * .34, "normal");
        text(c.b.name, x + F(16), y + picH + infoH * .44, nameFs + "px sans-serif", C.ink, "left");
        const descFs = fitFont(c.b.desc, F(11), CW * .58, "normal");
        text(c.b.desc, x + CW - F(14), y + picH + infoH * .44, descFs + "px sans-serif", C.ink2, "right");
        // 右上「✓ 已选择」
        const lb = "✓ 已选择", lfs = F(12);
        ctx.font = lfs + "px sans-serif";
        const lw = ctx.measureText(lb).width + F(24), lh = F(26);
        ctx.fillStyle = "#eafaf2";
        G.rr(ctx, x + CW - F(16) - lw, y + F(14), lw, lh, lh / 2); ctx.fill();
        text(lb, x + CW - F(16) - lw / 2, y + F(14) + lh / 2, lfs + "px sans-serif", "#0f9a7f");
      } else {
        if (a > 1) {
          ctx.fillStyle = "rgba(24,66,58,.10)";
          G.rr(ctx, x, y, CW, CH, rad); ctx.fill();
        }
        // 侧卡露出的是不同半边：左卡露左侧、右卡露右侧，文字/箭头都要放到可见那侧
        const leftSide = c.d < 0;
        const textX = leftSide ? x + F(14) : x + CW - F(14);
        const align = leftSide ? "left" : "right";
        const nameFs = fitFont(c.b.name, F(14), CW - F(28), "normal");
        text(c.b.name, textX, y + picH + F(19), nameFs + "px sans-serif", C.ink, align);
        const descFs = fitFont(c.b.desc, F(10), CW - F(28), "normal");
        text(c.b.desc, textX, y + picH + F(40), descFs + "px sans-serif", C.ink3, align);
        if (a < 1.7) {
          const ax = leftSide ? x + F(30) : x + CW - F(30), ay = y + picH * .48;
          ctx.save();
          ctx.globalAlpha = .72; ctx.strokeStyle = "#fff"; ctx.lineWidth = F(2.4);
          ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath();
          if (leftSide) { ctx.moveTo(ax + F(5), ay - F(8)); ctx.lineTo(ax - F(4), ay); ctx.lineTo(ax + F(5), ay + F(8)); }
          else { ctx.moveTo(ax - F(5), ay - F(8)); ctx.lineTo(ax + F(4), ay); ctx.lineTo(ax - F(5), ay + F(8)); }
          ctx.stroke(); ctx.restore();
        }
      }
      ctx.restore();
    });
    ctx.restore();

    /* ---- 指示点：只有多张卡时才需要；单卡模式不画点、不注册跳卡热区 ---- */
    if (n > 1) {
      list.forEach((b, i) => {
        const dx = cx0 + (i - (n - 1) / 2) * dsp;
        ctx.fillStyle = "rgba(90,140,118,.32)";
        ctx.beginPath(); ctx.arc(dx, dotY, dotR, 0, Math.PI * 2); ctx.fill();
        btn(dx - F(16), dotY - F(16), F(32), F(32), () => G.bgPickJump(i));
      });
      const dotPos = ((visIdx - off / step) % n + n) % n;
      ctx.fillStyle = "#12a489";
      G.rr(ctx, cx0 + (dotPos - (n - 1) / 2) * dsp - F(8), dotY - F(4), F(16), F(8), F(4)); ctx.fill();
    }

    /* ---- 底部设置面板：速度 / 数量 / 水声 + 开始游戏 ---- */
    raisedCard(edgeL, panelY, panelW, panelH, F(20), {
      top: "#ffffff", bottom: "#fbfdf9", line: "rgba(21,154,140,.14)"
    });
    const btnW = vert ? Math.min(F(230), panelW * .74) : Math.min(F(212), panelW * .28);
    const btnH = F(46);
    const btnX = vert ? cx0 - btnW / 2 : edgeR - F(14) - btnW;
    const btnY = vert ? panelY + panelH - btnH - F(12) : panelY + (panelH - btnH) / 2;
    const settingsTop = vert ? panelY + F(10) : panelY + F(14);
    const settingsW = vert ? panelW - F(20) : panelW - btnW - F(36);
    const colW = settingsW / 3;
    const colX = [edgeL + F(10), edgeL + F(10) + colW, edgeL + F(10) + colW * 2];
    const lblFs = F(11);
    /* 「当前展示卡」是底部面板的基准（数量控件形态 + 猎物/量词/环境音文案）：
       玩法卡页上用户翻到哪张卡就以哪张为准，不再等点「开始游戏」确认 targetType 后才跟着变。 */
    const selCard = list[((P.idx % n) + n) % n] || list[0];
    const selTarget = (group && group.targetByKey)
      ? (group.targetByKey[selCard.key] || G.config.targetType)
      : G.config.targetType;
    const term = PLAY_TERM[selTarget] || PLAY_TERM.fish;   // 当前玩法的猎物/量词/环境音文案

    // 游戏速度（舒缓 / 适中 / 活泼 → easy / normal / hard）
    text("游戏速度", colX[0], settingsTop + F(12), lblFs + "px sans-serif", C.ink2, "left");
    const speeds = [{ l: "舒缓", v: "easy" }, { l: "适中", v: "normal" }, { l: "活泼", v: "hard" }];
    const sw = (colW - F(26)) / 3, sy = settingsTop + F(24), sh = F(24);
    speeds.forEach((sp, i) => {
      const ox = colX[0] + i * (sw + F(4)), on = G.config.difficulty === sp.v;
      if (on) {
        ctx.fillStyle = "rgba(214,235,218,.88)";
        G.rr(ctx, ox, sy, sw, sh, sh / 2); ctx.fill();
      }
      text(sp.l, ox + sw / 2, sy + sh / 2, F(12) + "px sans-serif", on ? C.tealDeep : C.ink2);
      btn(ox, sy, sw, sh, () => { G.config.difficulty = sp.v; G.saveConfig(); G.playTick(); });
    });

    // 猎物数量：控件形态按「当前展示卡」判定（G.countModeFor，与 prey.js 的数量分支同步），
    // 翻到不支持调数量的卡时立即变化，不再等点「开始游戏」确认 targetType 后才跟着变。
    //   auto   —— 数量由引擎自动决定，显示只读徽章，不展示任何增减控件；
    //   binary —— 局内只认「单只/多只」两档（preyCount 为 1 / 非 1），展示两档切换（与全局设置同值）；
    //   exact  —— 设定值即同屏实际数量，展示 ± 步进（青蛙按组 countMax 封顶；暗夜荧光读 ffCount）。
    const countMode = G.countModeFor(selTarget, selCard.key);
    const countKey = (group && group.countKey) || "preyCount";
    /* 只读徽章文案（仅 auto 形态出现）：
       - group.count === "fixed"：固定 1 只（历史口径，保留）；
       - tadpole：蝌蚪快跑——同屏数量由阶段基线 + 命中能力动态调节（1–3）；
       - mouse + swarm：群鼠乱窜——同屏数量由阶段固定为 4/5/6，preyCount 不生效。 */
    const countNote = countMode === "auto"
      ? ((group && group.count === "fixed") ? "固定 1 只"
        : (selTarget === "tadpole") ? "自动 1–3 只" : "自动 4–6 只")
      : null;
    const isTadNow = countMode === "tad";
    const countLbl = countMode === "exact" ? term.prey + "数量" : "猎物数量";
    /* 标题统一左对齐（与小鱼游 / 蝴蝶 / 激光的 binary 卡一致），不另做居中特殊处理。 */
    text(countLbl, colX[1], settingsTop + F(12), lblFs + "px sans-serif", C.ink2, "left");
    const os = F(24), oy = settingsTop + F(24);
    if (countMode === "auto") {
      const t = countNote;
      ctx.font = F(13) + "px sans-serif";
      const tw = ctx.measureText(t).width;
      const bw = Math.min(colW - F(10), tw + F(22));
      ctx.fillStyle = "rgba(214,235,218,.62)";
      G.rr(ctx, colX[1] + F(4), oy - F(2), bw, os + F(4), F(10)); ctx.fill();
      text(t, colX[1] + F(4) + bw / 2, oy + os / 2, F(13) + "px sans-serif", C.tealDeep);
    } else if (isTadNow) {
      /* 蝌蚪快跑「猎物数量」：两档选项卡（单条 / 多条）。
         外观与「小鱼游 / 蝴蝶 / 激光」的 binary「单只 / 多只」按钮完全一致——
         两个独立胶囊、选中项浅绿底（rgba(214,235,218,.88)）+ 深青字、未选中平文字，
         不另造轨道 / 白滑块样式。仅两点不同：
         · 文案为「单条 / 多条」（蝌蚪用「条」作量词，与小鱼「单只 / 多只」区分）；
         · 写入键固定为 tadCount（1 单条 / 3 多条，跨局记忆）——prey.js stageTargetCount 只认它，
           不复用 countKey：frog 玩法组没配 countKey，回落到 preyCount 会把蝌蚪档位写错键。
         单条 = 全程固定 1 条；多条 = 按阶段 1→2→3 动态增减（命中多可加到 3 条）。 */
      const tadKey = "tadCount";
      const isSingle = Number(G.config[tadKey]) === 1;
      [{ l: "单条", v: 1 }, { l: "多条", v: 3 }].forEach((sp, i) => {
        const bw = (colW - F(26) - F(4)) / 2;
        const ox = colX[1] + F(4) + i * (bw + F(4)), on = (i === 0) === isSingle;
        if (on) {
          ctx.fillStyle = "rgba(214,235,218,.88)";
          G.rr(ctx, ox, oy, bw, os, os / 2); ctx.fill();
        }
        text(sp.l, ox + bw / 2, oy + os / 2, F(12) + "px sans-serif", on ? C.tealDeep : C.ink2);
        btn(ox, oy, bw, os, () => {
          G.config[tadKey] = sp.v; G.saveConfig(); G.playTick();
        });
      });
    } else if (countMode === "binary") {
      /* 单只/多只两档切换：写入值与全局设置抽屉一致（1 / 3），局内按 preyCount === 1 判定。
         过去这里给的是 ± 步进（可显示 1–7 但局内只有「1 / 非 1」两档生效，显示值与实际数量对不上），
         改成两档开关后界面所见即所得，也消除了「调到 5 只却按阶段出 3/5/7」的误解。
         外观沿用左列「游戏速度」的分段样式：选中项底纹 + 深绿字。 */
      const isSingle = Number(G.config[countKey]) === 1;
      [{ l: "单只", v: 1 }, { l: "多只", v: 3 }].forEach((sp, i) => {
        const bw = (colW - F(26) - F(4)) / 2;
        const ox = colX[1] + F(4) + i * (bw + F(4)), on = (i === 0) === isSingle;
        if (on) {
          ctx.fillStyle = "rgba(214,235,218,.88)";
          G.rr(ctx, ox, oy, bw, os, os / 2); ctx.fill();
        }
        text(sp.l, ox + bw / 2, oy + os / 2, F(12) + "px sans-serif", on ? C.tealDeep : C.ink2);
        btn(ox, oy, bw, os, () => {
          G.config[countKey] = sp.v; G.saveConfig(); G.playTick();
        });
      });
    } else {
      const minusX = colX[1] + F(4), plusX = colX[1] + colW - os - F(6);
      /* 上限按玩法收口：青蛙受荷叶数限制最多 5 只（MODE_GROUPS.frog.countMax），其余按 7。
         显示值也走同一条钳制：preyCount 是全局设置，可能在别的玩法里被调到 6/7，
         切到青蛙卡时界面要显示"实际会出现的只数"，不能显示 7 却只有 5 只。 */
      const countMax = (group && group.countMax) || 7;
      const countNow = () => Math.max(1, Math.min(countMax, Math.round(Number(G.config[countKey]) || 1)));
      [[minusX, -1], [plusX, 1]].forEach(pb => {
        ctx.fillStyle = "#ffffff";
        G.rr(ctx, pb[0], oy, os, os, F(7)); ctx.fill();
        ctx.fillStyle = "transparent"; ctx.strokeStyle = "rgba(21,154,140,.28)"; ctx.lineWidth = 1;
        rrPath(pb[0] + .5, oy + .5, os - 1, os - 1, F(7)); ctx.stroke();
        ctx.strokeStyle = C.ink2; ctx.lineWidth = F(1.6); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(pb[0] + os * .30, oy + os / 2); ctx.lineTo(pb[0] + os * .70, oy + os / 2);
        if (pb[1] > 0) { ctx.moveTo(pb[0] + os / 2, oy + os * .30); ctx.lineTo(pb[0] + os / 2, oy + os * .70); }
        ctx.stroke(); ctx.lineCap = "butt";
        btn(pb[0], oy, os, os, () => {
          G.config[countKey] = Math.max(1, Math.min(countMax, countNow() + pb[1]));
          G.saveConfig(); G.playTick();
        });
      });
      text(countNow() + " " + term.unit, (minusX + plusX + os) / 2, oy + os / 2,
        F(15) + "px sans-serif", C.ink);
    }

    /* 蝌蚪卡：第三列换成「蝌蚪造型」——四种黑白造型可点选，跨局记忆。
       非蝌蚪卡仍显示原来的环境音开关。（selCard 在数量控件段已按当前展示卡求出） */
    const isTadCard = !!(group && group.targetByKey && group.targetByKey[selCard.key] === "tadpole");
    if (isTadCard) {
      const styles = G.TAD_STYLES || [];
      const cur = styles.find(st => st.key === G.config.tadStyle) || styles[0] || { name: "墨影" };
      text("蝌蚪造型 · " + cur.name, colX[2], settingsTop + F(12), lblFs + "px sans-serif", C.ink2, "left");
      const gap2 = F(4);
      const chip = Math.min(F(34), (colW - F(6) - (styles.length - 1) * gap2) / Math.max(1, styles.length));
      styles.forEach((st, i) => {
        const sx = colX[2] + F(4) + i * (chip + gap2), sy2 = settingsTop + F(22);
        const on = st.key === G.config.tadStyle;
        ctx.fillStyle = on ? "rgba(214,235,218,.92)" : "#ffffff";
        G.rr(ctx, sx, sy2, chip, chip, F(8)); ctx.fill();
        ctx.fillStyle = "transparent";
        ctx.strokeStyle = on ? "#12a489" : "rgba(21,154,140,.24)";
        ctx.lineWidth = on ? 1.8 : 1;
        rrPath(sx + .5, sy2 + .5, chip - 1, chip - 1, F(8)); ctx.stroke();
        G.draw.tadpolePreview(ctx, st.key, sx + chip / 2, sy2 + chip / 2, chip * 0.82, 0.6 + i * 0.3);
        btn(sx, sy2, chip, chip, () => {
          if (G.config.tadStyle === st.key) return;
          G.config.tadStyle = st.key; G.saveConfig(); G.playTick();
          if (P) P.selT0 = performance.now();
        });
      });
    } else {
    // 环境音陪伴（true / false）：标签跟玩法走（水声/夜风/风声…）
    text(term.amb + "陪伴", colX[2], settingsTop + F(12), lblFs + "px sans-serif", C.ink2, "left");
    const tgX = colX[2] + F(4), tgY = settingsTop + F(24), tgW = F(38), tgH = F(22);
    const soundOn = G.config.sound !== false;
    ctx.fillStyle = soundOn ? "#12a489" : "#cfe0d3";
    G.rr(ctx, tgX, tgY, tgW, tgH, tgH / 2); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(tgX + (soundOn ? tgW - tgH / 2 : tgH / 2), tgY + tgH / 2, tgH / 2 - F(2), 0, Math.PI * 2); ctx.fill();
    text(soundOn ? "已开启" : "已关闭", tgX + tgW + F(8), tgY + tgH / 2, F(12) + "px sans-serif", C.ink2, "left");
    btn(tgX - F(4), tgY - F(4), tgW + F(92), tgH + F(8), () => {
      G.config.sound = !soundOn; G.saveConfig(); G.playTick();
    });
    }

    // 开始游戏
    raisedButton(btnX, btnY, btnW, btnH, {
      c0: "#5fd2ac", c1: "#0e8e78", ring: "rgba(255,255,255,.82)",
      r: Math.min(btnH * .44, 22)
    });
    const triX = btnX + btnW * .24, triH = btnH * .30;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(triX - triH * .42, btnY + btnH / 2 - triH * .52);
    ctx.lineTo(triX - triH * .42, btnY + btnH / 2 + triH * .52);
    ctx.lineTo(triX + triH * .55, btnY + btnH / 2);
    ctx.closePath(); ctx.fill();
    const startFs = fitFont("开始游戏", F(20), btnW * .62, "normal");
    text("开始游戏", btnX + btnW * .60, btnY + btnH / 2, startFs + "px sans-serif", "#fff");
    btn(btnX, btnY, btnW, btnH, () => G.confirmBgPick());

    if (!vert) {
      text("建议每次玩耍 5-10 分钟，注意让猫咪休息", edgeL + F(12), panelY + panelH - F(11),
        F(10) + "px sans-serif", C.ink3, "left");
      text("横屏放稳手机，再交给猫咪", edgeR - F(12), panelY + panelH - F(11),
        F(10) + "px sans-serif", C.ink3, "right");
    }

    /* ---- 左右侧卡点击翻页：单卡模式没有侧卡，不铺热区 ---- */
    if (n > 1) {
      const leftW = Math.max(F(50), cx0 - CW / 2), rightX = cx0 + CW / 2;
      btn(0, cardY, leftW, CH, () => G.bgPickArrow(-1));
      btn(rightX, cardY, Math.max(F(50), W - rightX), CH, () => G.bgPickArrow(1));
    }
    ctx.restore();
  };

  /* ================= 设置（左上角抽屉） =================
     从首页左上角浮出，不占满屏：点右上角 X 关闭，点抽屉外的遮罩也能关闭。
     入场动画改为缩放 + 上浮淡入，不再从屏幕边缘滑入。
     抽屉宽度约屏幕 85%、高度按内容自适应，所以看起来是"浮出来的一层"，不是新开一个页面。 */
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

    /* ---------- 抽屉面板（缩放 + 上浮淡入） ---------- */
    // 从中心轻微放大并同时上浮，避免从屏幕边缘滑入的生硬感；关闭时反向缩小下沉淡出
    const panelScale = 0.92 + 0.08 * vis;      // 收起 0.92 → 展开 1
    const floatY = (1 - vis) * 16;             // 收起时偏下 16px，展开归位
    const panelAlpha = Math.pow(vis, 0.85);
    const cx = px + pw / 2, cy = py + ph / 2;
    ctx.save();
    ctx.globalAlpha = panelAlpha;
    ctx.translate(0, floatY);
    ctx.translate(cx, cy);
    ctx.scale(panelScale, panelScale);
    ctx.translate(-cx, -cy);
    ctx.save();
    ctx.shadowColor = "rgba(8,40,52,.28)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#fdfcf8";
    G.rr(ctx, px, py, pw, ph, 20);            // G.rr 内部已做 fill
    ctx.restore();
    // 同上：描边前清空填充色，别用遮罩色把面板盖灰
    ctx.fillStyle = "transparent";
    ctx.strokeStyle = "rgba(20,49,58,.10)"; ctx.lineWidth = 1;
    G.rr(ctx, px, py, pw, ph, 20); ctx.stroke();

    // 标题（图标芯片 + 标题/副题）+ 关闭 X
    chipIcon("gear", px + 29, py + 27, 26, DK.chipTeal, C.tealDeep);
    text("设置", px + 48, py + 22, "18px sans-serif", C.ink, "left");
    text("改完自动保存", px + 48, py + 40, "11px sans-serif", C.ink3, "left");
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
      ctx.fillStyle = "#faf9f1";
      G.rr(ctx, x, y, w, h, 14); ctx.fill();
      ctx.strokeStyle = "#e9e5d4"; ctx.lineWidth = 1;
      G.rr(ctx, x, y, w, h, 14); ctx.stroke();
      const hy = y + 16;
      ctx.globalAlpha = vis * 0.18;
      ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x + 16, hy, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = vis;
      ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x + 16, hy, 4, 0, Math.PI * 2); ctx.fill();
      text(title, x + 29, hy, "14px sans-serif", C.ink, "left");
      ctx.strokeStyle = "rgba(0,0,0,.05)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 12, y + 30); ctx.lineTo(x + w - 12, y + 30); ctx.stroke();
    }
    // 分段选择器（iOS 风）：白色浮起选中段 + 青绿描边粗体，未选中平文字
    const segFS = cardW < 250 ? 13 : 14;
    function seg(x, y, wTotal, h, r) {
      const ow = (wTotal - (r.options.length - 1) * 6) / r.options.length;
      r.options.forEach((op, idx) => {
        const on = op.val === r.cur;
        const ox = x + idx * (ow + 6);
        if (on) {
          ctx.save();
          ctx.fillStyle = "#ffffff";
          G.rr(ctx, ox, y, ow, h, 9);
          ctx.restore();
          ctx.fillStyle = "transparent";
          ctx.strokeStyle = "rgba(21,154,140,.6)"; ctx.lineWidth = 1.4;
          rrPath(ox, y, ow, h, 9); ctx.stroke();
        }
        text(op.label, ox + ow / 2, y + h / 2, segFS + "px sans-serif", on ? C.tealDeep : C.ink2);
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
    text("屏幕常亮", innerX + 14, fy + 16, "13px sans-serif", C.ink, "left");
    {
      const on = !!G.config.keepScreen;
      const tw = 44, th = 24, tx = innerX + innerW - tw - 12, ty = fy + 4;
      const rr2 = th / 2;
      if (on) {
        const grad = ctx.createLinearGradient(tx, ty, tx + tw, ty);
        grad.addColorStop(0, C.startGrad0); grad.addColorStop(1, C.startGrad1);
        ctx.fillStyle = grad;
      } else ctx.fillStyle = "#ded9c8";
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
    // 一排三个：意见反馈 / 分享给好友 / 防误触
    const by = fy + 40;
    const bGap = 8, bw3 = (innerW - bGap * 2) / 3;
    const footBtns = [
      { label: "意见反馈", icon: "chat", tint: "rgba(74,107,116,.12)", color: C.ink, cb: () => G.platform.openSupport() },
      { label: "分享给好友", icon: "share", tint: DK.chipTeal, color: C.teal, cb: () => { try { G.shareInvite("settings"); } catch (err) {} } },
      { label: "防误触", icon: "shield", tint: DK.chipAmber, color: C.teal, cb: () => { try { G.platform.antiGuide(() => {}); } catch (err) {} } }
    ];
    footBtns.forEach((b, i) => {
      const bx = innerX + i * (bw3 + bGap);
      ctx.save();
      ctx.fillStyle = "#ffffff"; G.rr(ctx, bx, by, bw3, 32, 16);
      ctx.restore();
      ctx.fillStyle = "transparent";
      ctx.strokeStyle = "rgba(214,218,200,.9)"; ctx.lineWidth = 1;
      rrPath(bx, by, bw3, 32, 16); ctx.stroke();
      chipIcon(b.icon, bx + 18, by + 16, 19, b.tint, b.color);
      text(b.label, bx + bw3 / 2 + 9, by + 16, "12px sans-serif", b.color);
      if (open) btn(bx, by, bw3, 32, b.cb);
    });
    ctx.restore();                                  // 结束抽屉的位移/透明度

    // 抽屉按钮与关闭 X 都用最终坐标（动画结束后才注册，避免滑动中误点）
    if (open) {
      btn(xcx - xr - 4, xcy - xr - 4, (xr + 4) * 2, (xr + 4) * 2, () => G.closeSettings());
    }
    // 关闭动画播完：回到首页（设置抽屉只从首页进入），面板此时已完全滑出屏幕
    if (closing && k >= 1) {
      G.settings = null; G.screen = "home";
    }
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

    chipIcon("chart", px + 35, py + 28, 30, DK.chipTeal, C.tealDeep);
    text("本周记录", px + 56, py + 27, "19px sans-serif", C.ink, "left");
    text(
      "近 7 天 · 最多 200 条 · 共 " + logs.length + " 局",
      px + 56, py + 49, "11px sans-serif", C.ink3, "left"
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
        ctx.save();
        ctx.shadowColor = "rgba(70,92,80,.10)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
        ctx.fillStyle = "#ffffff"; G.rr(ctx, x, y, cellW, rowH, 12);
        ctx.restore();
        ctx.fillStyle = "transparent";
        ctx.strokeStyle = "rgba(214,218,200,.85)"; ctx.lineWidth = 1;
        rrPath(x, y, cellW, rowH, 12); ctx.stroke();
        const cy = y + rowH / 2;
        text(L.date || "-", x + 12, cy, "12px sans-serif", C.ink3, "left");
        const typeName = { fish: "小鱼", butterfly: "蝴蝶", mouse: "小鼠", laser: "红点", pool: "荧光", frog: "青蛙", tadpole: "蝌蚪" }[L.type] || "";
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
        ctx.font = "13px sans-serif";
        const capW = ctx.measureText(capStr).width;
        ctx.font = fs2 + "px sans-serif";
        const hitW = ctx.measureText(hitStr).width, comboW = ctx.measureText(comboStr).width;
        const capX = x + 56 + tagW + 9;
        const comboX = x + cellW - 10;                        // 右对齐
        const hitX = comboX - comboW - 9 - hitW;              // 命中排在连击左侧
        const showCombo = capX + capW + 6 <= hitX;            // 实在挤不下就省掉连击
        text(capStr, capX, cy, "13px sans-serif", C.amberDeep, "left");
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
    /* 把自己的最好成绩带进开放数据域：关系链 getUserCloudStorage 在真机/开发者工具
       常返回空或延迟，仅靠它会导致「自己那行」消失。主域本地存档是可靠来源，
       作为兜底传过去，ODC 与关系链结果取较大值。名字/头像仍由 ODC 自己读。 */
    let self = null;
    try {
      const b = G.readRankBest && G.readRankBest();
      if (b && b.score > 0) self = { score: b.score, ts: b.ts, mode: b.mode, diff: b.diff };
    } catch (e) {}
    /* 自己那行显示真昵称头像，不用"我"占位。主域原生按钮授权过的资料优先，
       ODC 里的关系链 / getUserInfo 只作为没授权过时的兜底。 */
    try {
      const p = G.myProfile;
      if (p && p.name) {
        if (!self) self = {};
        self.name = p.name; self.avatar = p.avatar;
      }
    } catch (e) {}
    G.platform.odcPost({ type: "refresh" });   // 每次进排行榜先拉最新好友成绩，避免显示旧缓存
    G.platform.odcPost({ type: "show", x: r.x * S, y: r.y * S, w: r.w * S, h: r.h * S, self: self });
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

    chipIcon("trophy", px + 35, py + 28, 30, DK.chipAmber, C.amberDeep);
    text("好友排行", px + 56, py + 27, "19px sans-serif", C.ink, "left");
    text(
      authed ? "近 30 天最高猎手分 · 按玩法难度校准"
        : (auth === "denied" ? "需要「微信朋友信息」权限" : "点下方按钮一次开启"),
      px + 56, py + 49, "11px sans-serif",
      authed || auth !== "denied" ? C.ink3 : C.amberDeep, "left"
    );
    const hit = modalX(M);

    // 列表区（开放数据域按这块矩形绘制）+ 下方说明与按钮
    // 需要微信昵称授权时多留一行给原生按钮（微信要求用 createUserInfoButton，画出来的假按钮点不动）
    const nickNeeded = authed && (G.nickAuthState === "needButton" || G.nickAuthState === "unknown");
    const needNick = nickNeeded && !!G.nickStepReady;   // 点过合并入口才放出原生按钮
    const nickRowH = nickNeeded ? 34 : 0, nickGap = nickNeeded ? 8 : 0;
    const btnH = 40, hintY = py + ph - 14 - btnH - nickRowH - nickGap - 20;
    const rect = { x: px + 14, y: py + 64, w: pw - 28, h: Math.max(90, hintY - 20 - (py + 64)) };
    G.modal.lbRect = rect;
    const nickBy = py + ph - 14 - btnH - nickGap - nickRowH;

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
      text("还看不到好友成绩", cx, cy - 34, "16px sans-serif", C.ink);
      text("微信需要你允许「使用你的微信朋友信息」，", cx, cy - 6, "12px sans-serif", C.ink3);
      text("才能读取好友的猎手分（不含通讯录）。", cx, cy + 14, "12px sans-serif", C.ink3);
      // 小锁：锁梁 + 锁体
      const ly = cy + 62;
      ctx.strokeStyle = "rgba(232,137,12,.6)"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx, ly, 9, Math.PI, 0); ctx.stroke();
      ctx.lineCap = "butt";
      ctx.fillStyle = "rgba(232,137,12,.6)";
      G.rr(ctx, cx - 13, ly - 1, 26, 18, 5);
    } else if (auth === "asking") {
      // 正在弹授权框 / 还没回来：别写"加载中"，否则用户以为数据在等
      text("正在请求好友权限…", cx, cy - 6, "14px sans-serif", C.ink3);
      text("（只读同玩好友的成绩，不含通讯录）", cx, cy + 18, "11px sans-serif", C.ink3);
    } else if (!authed) {
      // 还没授权过：明确告诉玩家要做一次开启，而不是显示假的"正在请求"
      text("点下方按钮开启好友榜", cx, cy - 6, "14px sans-serif", C.ink2);
      text("一次开启：好友榜 · 超越提醒 · 微信昵称", cx, cy + 18, "11px sans-serif", C.ink3);
    } else {
      // 占位底：覆盖层还没画上来时（真机首帧 / 浏览器调试）不至于是一片空白
      text("正在加载好友排行…", cx, cy, "12px sans-serif", C.ink3);
    }

    // 说明文案随状态变
    text(
      auth === "denied" ? "开启后好友成绩会自动出现在这里" : "猎手分 = 每分钟命中 × 玩法/难度系数，取近 30 天最高",
      px + pw / 2, hintY, "11px sans-serif", C.ink3
    );

    // 微信昵称授权行：canvas 只画提示，真正的按钮由微信原生层盖在这里（假按钮点不出授权框）
    if (nickNeeded) {
      ctx.fillStyle = needNick ? "rgba(12,125,114,.16)" : "rgba(12,125,114,.06)";
      G.rr(ctx, px + 14, nickBy, pw - 28, nickRowH, nickRowH / 2); ctx.fill();
      text(
        needNick ? "点这里获取微信昵称（好友可见）" : "先点下方按钮，再在这里获取微信昵称",
        px + pw / 2, nickBy + nickRowH / 2, "10px sans-serif", needNick ? C.ink2 : C.ink3
      );
    }

    // 底部只有一个入口：微信不允许把三种授权合成一个弹窗，但可以让玩家只认一个按钮。
    // 点一次在同一次手势里触发好友授权 + 提醒订阅，再引导点上面的原生昵称按钮。
    const bx = px + 14, bw = pw - 28, by = py + ph - 14 - btnH;
    const ns = G.rankNoticeState;
    const noticeNeed = ns !== "ok";
    const noticeBlocked = ns === "denied" || ns === "ban" || ns === "off";
    const allReady = authed && !nickNeeded && !noticeNeed;
    let mainLabel;
    if (!authed) mainLabel = auth === "denied" ? "去设置开启好友榜" : "开启好友榜";
    else if (nickNeeded && noticeNeed) mainLabel = "开启完整好友榜";
    else if (nickNeeded) mainLabel = "下一步：获取微信昵称";
    else if (noticeBlocked) mainLabel = "去设置开启提醒";
    else if (noticeNeed) mainLabel = "开启超越提醒";
    else mainLabel = "邀猫友比一比";
    orangePill(bx, by, bw, btnH, { dy: 4, blur: 14, ring: false });
    text(mainLabel, bx + bw / 2, by + btnH / 2, "16px sans-serif", "#fff");

    // 同步原生授权按钮位置（展开后才创建，关闭/切屏时销毁）
    if (M.open && !M.closing && G.syncNickButton) {
      G.syncNickButton({ x: px + 14, y: nickBy, w: pw - 28, h: nickRowH }, needNick);
    } else if (G.syncNickButton) {
      G.syncNickButton(null, false);
    }

    // 覆盖层时序：只有已授权才拉起子域；完全展开后 show（避免列表在缩放中"贴死"），开始关闭立刻 hide
    if (!authed && !G.modal.lbHidden) { G.modal.lbHidden = true; ui.hideLB(); }
    if (authed && M.open && !G.modal.lbShown) { G.modal.lbShown = true; ui.showLB(); }
    if (M.closing && !G.modal.lbHidden) { G.modal.lbHidden = true; ui.hideLB(); }

    modalEnd(M, hit, () => { ui.hideLB(); });
    if (M.open) {
      if (allReady) btn(bx, by, bw, btnH, () => G.shareInvite("lb"));
      else if (G.enableLbFeatures) btn(bx, by, bw, btnH, G.enableLbFeatures);
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

    text("自定义召唤卡", x + pad, y + 24, "17px sans-serif", C.ink, "left");
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
      ctx.font = "13px sans-serif";
      const vw = ctx.measureText(r.value).width;
      const pill = i === 2 && E.audio && !recOn ? 52 : 0;
      const maxW = fw - 30 - pill - (hot ? 44 : 12);
      text(vw > maxW ? String(r.value).slice(0, 10) + "…" : r.value,
        fx + fw - 15 - pill, ry + rowH / 2, "13px sans-serif",
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
          text(E.previewOn ? "停止" : "试听", px2 + pw / 2, py2 + 13, "12px sans-serif",
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
      text("删除本卡", fx + dw / 2, by + 18, "13px sans-serif", "#e2593a");
      btnKey(fx, by, dw, 36, "edit-del", () => removeCustomSummon(E));
    }
    const sw = 132, sx2 = fx + fw - sw;
    const sg = ctx.createLinearGradient(sx2, by, sx2, by + 36);
    sg.addColorStop(0, C.startGrad0); sg.addColorStop(1, C.startGrad1);
    ctx.save();
    ctx.fillStyle = sg; G.rr(ctx, sx2, by, sw, 36, 18); ctx.fill();
    ctx.restore();
    text("保存到本机", sx2 + sw / 2, by + 18, "14px sans-serif", "#fff");
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
    text(cfg.title, x + w / 2, y + 26, "15px sans-serif", C.ink);

    cfg.items.forEach((it, i) => {
      const ry = y + 46 + i * oh, cyc = ry + oh / 2, ix = x + pad + 14;
      if (i) {
        ctx.strokeStyle = "rgba(46,196,170,.14)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + pad, ry); ctx.lineTo(x + w - pad, ry); ctx.stroke();
      }
      ctx.fillStyle = "rgba(46,196,170,.12)";
      ctx.beginPath(); ctx.arc(ix, cyc, 15, 0, Math.PI * 2); ctx.fill();
      drawVecIcon(it.icon, ix, cyc, 17, C.tealDeep);
      text(it.label, ix + 26, ry + 21, "14px sans-serif", C.ink, "left");
      text(it.hint, ix + 26, ry + 38, "11px sans-serif", C.ink3, "left");
      btnKey(x, ry, w, oh, "edit-src-" + it.key, () => { G.playTick(); chooseSummonSource(E, it.key); });
    });

    const cy2 = y + h - 40;
    ctx.fillStyle = "#f6faf9"; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    G.rr(ctx, x + pad, cy2, w - pad * 2, 32, 16); ctx.fill(); ctx.stroke();
    text("取消", x + w / 2, cy2 + 16, "13px sans-serif", C.ink3);
    btnKey(x + pad, cy2, w - pad * 2, 32, "edit-src-cancel", () => { E.sheet = ""; G.playTick(); });
  }

  /* ================= 召唤猫咪（猫种卡牌 + 专属召唤语音） =================
     展现形式为卡牌滑动切换，点击卡牌或下方大按钮播放语音 */
  /* ================= 声音库（猫 / 狗情绪音） =================
     插画：Q 版漫画头像。猫取「奶油大橘」、狗取「奶黄柴犬」——国内最常见的两种萌系形象。
     圆润大头 + 扁平色块 + 暖棕描边 + 大眼高光 + 粉腮红，同一个头型按 12 种情绪换
     眼睛 / 眉毛 / 嘴 / 表情小符号，全部矢量绘制，不额外占包体。 */
  const FACE_TINT = {
    angry: "#ffe3dc", alert: "#e1f1ff", confused: "#efe6ff", cry: "#e2edff",
    happy: "#fff0c7", grumpy: "#ffe2cd", bliss: "#ffe4ef", hungry: "#fff1d6",
    sad: "#e7ebff", sorry: "#e2f5ea", surprise: "#fff6d2", tired: "#eaeef3"
  };
  const FACE_EXPR = {
    angry:    { brow: "angry",   eye: "narrow",  mouth: "grit",    extra: "vein",    tilt: -0.03 },
    alert:    { brow: "up",      eye: "wide",    mouth: "small",   extra: "",        tilt: -0.05 },
    confused: { brow: "one",     eye: "squint",  mouth: "wave",    extra: "quest",   tilt: 0.08 },
    cry:      { brow: "sad",     eye: "cry",     mouth: "wail",    extra: "tears",   tilt: 0 },
    happy:    { brow: "soft",    eye: "happy",   mouth: "smile",   extra: "",        tilt: 0 },
    grumpy:   { brow: "angry",   eye: "angry",   mouth: "frown",   extra: "steam",   tilt: 0.03 },
    bliss:    { brow: "soft",    eye: "happy",   mouth: "small",   extra: "hearts",  tilt: 0 },
    hungry:   { brow: "sad",     eye: "wide",    mouth: "tongue",  extra: "drool",   tilt: 0 },
    sad:      { brow: "sad",     eye: "sad",     mouth: "frown",   extra: "tear",    tilt: 0 },
    sorry:    { brow: "worried", eye: "side",    mouth: "awkward", extra: "sweat",   tilt: 0.04 },
    surprise: { brow: "up",      eye: "huge",    mouth: "o",       extra: "sparkle", tilt: 0 },
    tired:    { brow: "soft",    eye: "half",    mouth: "yawn",    extra: "zzz",     tilt: 0.05 }
  };
  /* 暖色扁平盘：奶油白 + 橘（猫）、奶黄 + 白面罩（狗），描边统一暖棕，不用写实渐变 */
  const CAT_PAL = {
    base: "#FFF4E5", base2: "#FFE6CC", patch: "#F7AC55", patchDark: "#E38C39",
    earInner: "#FFB7C3", muzzle: "#FFFCF5", blush: "rgba(255,138,163,.58)",
    outline: "#714F3D", ink: "#4A332A", iris: "#453029", nose: "#F58CA3"
  };
  const DOG_PAL = {
    base: "#F9CD72", base2: "#EDAE56", patch: "#E9A64C", patchDark: "#D8913F",
    earInner: "#F8BEA6", muzzle: "#FFF9EF", blush: "rgba(255,140,158,.52)",
    outline: "#714F3D", ink: "#45301F", iris: "#453029", nose: "#4A342B"
  };

  /* 只建圆角矩形路径（不填充），给咬牙嘴这类小形状用 */
  function faceRR(c2, x, y, w, h, r) {
    c2.beginPath();
    c2.moveTo(x + r, y);
    c2.lineTo(x + w - r, y); c2.quadraticCurveTo(x + w, y, x + w, y + r);
    c2.lineTo(x + w, y + h - r); c2.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c2.lineTo(x + r, y + h); c2.quadraticCurveTo(x, y + h, x, y + h - r);
    c2.lineTo(x, y + r); c2.quadraticCurveTo(x, y, x + r, y);
    c2.closePath();
  }

  /* 单只眼睛：白眼球 + 大瞳孔 + 双高光（国产萌系最标志性的画法），
     上眼睑用脸底色压出不同眼型；happy/closed/cry 直接画弯月眼。 */
  function faceEye(c2, style, x, y, side, pal) {
    c2.save(); c2.translate(x, y);
    c2.lineCap = "round"; c2.lineJoin = "round";
    if (style === "happy" || style === "closed" || style === "cry") {
      c2.strokeStyle = pal.ink; c2.lineWidth = 4.4;
      c2.beginPath();
      if (style === "cry") { c2.moveTo(-12, -4); c2.quadraticCurveTo(0, 9, 12, -4); }
      else { c2.moveTo(-12, 4); c2.quadraticCurveTo(0, -12, 12, 4); }
      c2.stroke();
      c2.restore(); return;
    }
    const dim = { normal: [14, 16], wide: [14, 17], huge: [16, 19], sad: [14, 16],
      angry: [14, 16], narrow: [14, 16], half: [14, 16], side: [14, 16] }[style] || [14, 16];
    const rw = dim[0], rh = dim[1];
    c2.fillStyle = "#FFFDF8";
    c2.beginPath(); c2.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2); c2.fill();
    c2.save();
    c2.beginPath(); c2.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2); c2.clip();

    // 瞳孔：不同表情的视线 / 大小 / 高低
    let px = 0, py = 2, pr = 8.6;
    if (style === "sad") { py = 6; pr = 7.8; }
    else if (style === "angry" || style === "narrow") { py = 5; pr = 7.4; }
    else if (style === "half") { py = 6; pr = 7.6; }
    else if (style === "side") { px = 5.2; pr = 8.2; }
    else if (style === "wide") { py = 1; pr = 9.2; }
    else if (style === "huge") { py = 1; pr = 10.2; }
    c2.fillStyle = pal.iris;
    c2.beginPath(); c2.ellipse(px, py, pr * 0.88, pr * 1.08, 0, 0, Math.PI * 2); c2.fill();
    c2.fillStyle = "#fff";
    c2.beginPath(); c2.arc(px - pr * 0.34, py - pr * 0.42, pr * 0.38, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.arc(px + pr * 0.42, py + pr * 0.46, pr * 0.17, 0, Math.PI * 2); c2.fill();

    // 上眼睑：用脸底色压住眼球上半，形成生气 / 困倦 / 悲伤眼型
    if (style === "angry") {
      c2.fillStyle = pal.base;
      c2.beginPath();
      c2.moveTo(-rw - 6, -rh - 8); c2.lineTo(rw + 6, -rh - 8);
      c2.lineTo(rw + 6, -3 - 6 * side); c2.lineTo(-rw - 6, -3 + 6 * side);
      c2.closePath(); c2.fill();
      c2.strokeStyle = pal.ink; c2.lineWidth = 3;
      c2.beginPath(); c2.moveTo(-rw - 4, -3 + 6 * side); c2.lineTo(rw + 4, -3 - 6 * side); c2.stroke();
    } else if (style === "sad" || style === "narrow" || style === "half") {
      const cut = style === "half" ? 1 : (style === "narrow" ? -3 : 0);
      c2.fillStyle = pal.base; c2.fillRect(-rw - 6, -rh - 8, rw * 2 + 12, rh + 8 + cut);
      c2.strokeStyle = pal.ink; c2.lineWidth = 3;
      c2.beginPath(); c2.moveTo(-rw - 4, cut); c2.lineTo(rw + 4, cut); c2.stroke();
    }
    c2.restore();

    // 上眼线：粗一点才有漫画感，缩小到卡片里依然清楚
    c2.strokeStyle = pal.ink; c2.lineWidth = 2.8;
    c2.beginPath(); c2.ellipse(0, 0, rw, rh, 0, Math.PI * 1.08, Math.PI * 1.92); c2.stroke();
    c2.restore();
  }

  function faceBrow(c2, style, x, y, side, ink) {
    c2.save(); c2.translate(x, y); c2.scale(side, 1);  // 局部 +x 恒为「外侧」，两边自然对称
    c2.strokeStyle = ink; c2.lineWidth = 3.4; c2.lineCap = "round";
    c2.beginPath();
    if (style === "angry") { c2.moveTo(-12, 5); c2.lineTo(11, -7); }        // 倒八：皱眉生气
    else if (style === "sad") { c2.moveTo(-12, -7); c2.lineTo(11, 5); }     // 八字：委屈
    else if (style === "up") { c2.moveTo(-11, 3); c2.quadraticCurveTo(0, -10, 11, 1); }
    else if (style === "soft") { c2.moveTo(-9, 1); c2.quadraticCurveTo(0, -6, 9, 1); }
    else if (style === "worried") { c2.moveTo(-11, 5); c2.quadraticCurveTo(0, -6, 11, -1); }
    else { c2.moveTo(-9, 0); c2.lineTo(9, 0); }
    c2.stroke();
    c2.restore();
  }

  function faceMouth(c2, style, ink) {
    const dark = "#8E4A55", tongue = "#FF9DB0", white = "#FFFCF6";
    c2.save(); c2.translate(0, 51);
    c2.strokeStyle = ink; c2.fillStyle = ink; c2.lineWidth = 3; c2.lineCap = "round"; c2.lineJoin = "round";
    if (style === "smile") {
      c2.fillStyle = dark;
      c2.beginPath(); c2.moveTo(-17, -5); c2.quadraticCurveTo(0, 2, 17, -5);
      c2.quadraticCurveTo(0, 22, -17, -5); c2.closePath(); c2.fill();
      c2.fillStyle = tongue; c2.beginPath(); c2.ellipse(0, 8, 8, 5, 0, 0, Math.PI * 2); c2.fill();
    } else if (style === "small") {
      // ω 形三瓣嘴：猫狗表情包里最常见的一笔
      c2.beginPath();
      c2.moveTo(-12, -1); c2.quadraticCurveTo(-6, 9, 0, 1);
      c2.quadraticCurveTo(6, 9, 12, -1); c2.stroke();
    } else if (style === "flat") {
      c2.beginPath(); c2.moveTo(-9, 0); c2.lineTo(9, 0); c2.stroke();
    } else if (style === "frown") {
      c2.beginPath(); c2.moveTo(-12, 5); c2.quadraticCurveTo(0, -11, 12, 5); c2.stroke();
    } else if (style === "wave") {
      c2.beginPath();
      c2.moveTo(-15, 1); c2.bezierCurveTo(-9, -8, -3, 9, 3, 1); c2.bezierCurveTo(8, -5, 12, 4, 16, 0);
      c2.stroke();
    } else if (style === "grit") {
      faceRR(c2, -19, -8, 38, 17, 6);
      c2.fillStyle = white; c2.fill(); c2.lineWidth = 3; c2.stroke();
      c2.strokeStyle = "rgba(113,79,61,.55)"; c2.lineWidth = 1.6;
      for (let i = -1; i <= 1; i++) { c2.beginPath(); c2.moveTo(i * 9, -7); c2.lineTo(i * 9, 8); c2.stroke(); }
      c2.strokeStyle = ink; c2.lineWidth = 3;
      c2.beginPath(); c2.moveTo(-22, 13); c2.quadraticCurveTo(0, 7, 22, 13); c2.stroke();
    } else if (style === "wail") {
      c2.fillStyle = dark; c2.beginPath(); c2.ellipse(0, 3, 16, 19, 0, 0, Math.PI * 2); c2.fill();
      c2.fillStyle = tongue; c2.beginPath(); c2.ellipse(0, 13, 9, 6, 0, 0, Math.PI * 2); c2.fill();
    } else if (style === "o") {
      c2.fillStyle = dark; c2.beginPath(); c2.ellipse(0, 2, 10, 12, 0, 0, Math.PI * 2); c2.fill();
      c2.fillStyle = tongue; c2.beginPath(); c2.ellipse(0, 8, 5, 3, 0, 0, Math.PI * 2); c2.fill();
    } else if (style === "tongue") {
      c2.fillStyle = dark; c2.beginPath(); c2.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2); c2.fill();
      c2.fillStyle = tongue;
      c2.beginPath(); c2.moveTo(-8, 5); c2.quadraticCurveTo(-7, 23, 0, 24);
      c2.quadraticCurveTo(7, 23, 8, 5); c2.closePath(); c2.fill();
      c2.strokeStyle = "rgba(150,60,80,.35)"; c2.lineWidth = 1.3;
      c2.beginPath(); c2.moveTo(0, 7); c2.lineTo(0, 19); c2.stroke();
    } else if (style === "awkward") {
      c2.beginPath();
      c2.moveTo(-11, 2); c2.quadraticCurveTo(-5, -5, 0, 1); c2.quadraticCurveTo(5, 7, 11, 0);
      c2.stroke();
    } else if (style === "yawn") {
      c2.fillStyle = dark; c2.beginPath(); c2.ellipse(0, 3, 15, 18, 0, 0, Math.PI * 2); c2.fill();
      c2.fillStyle = tongue; c2.beginPath(); c2.ellipse(0, 14, 8, 5, 0, 0, Math.PI * 2); c2.fill();
    }
    c2.restore();
  }

  /* 情绪小符号：放在脸外缘，尺寸压小，避免盖住五官 */
  function faceExtra(c2, extra, t, pal) {
    const blue = "rgba(104,178,214,.85)";
    if (extra === "tears" || extra === "tear") {
      const sides = extra === "tears" ? [-1, 1] : [1];
      sides.forEach(side => {
        c2.strokeStyle = "rgba(126,187,217,.75)"; c2.lineWidth = 4.4; c2.lineCap = "round";
        c2.beginPath(); c2.moveTo(side * 34, 14); c2.quadraticCurveTo(side * 38, 34, side * 41, 48); c2.stroke();
        c2.fillStyle = "#9BD6EE";
        c2.beginPath(); c2.ellipse(side * 41, 51, 3.4, 5, side * 0.16, 0, Math.PI * 2); c2.fill();
      });
    } else if (extra === "drool") {
      c2.strokeStyle = "rgba(126,187,217,.65)"; c2.lineWidth = 2.8; c2.lineCap = "round";
      c2.beginPath(); c2.moveTo(17, 61); c2.quadraticCurveTo(20, 72, 17, 79); c2.stroke();
      c2.fillStyle = "#9BD6EE"; c2.beginPath(); c2.ellipse(17, 81, 2.6, 4, 0, 0, Math.PI * 2); c2.fill();
    } else if (extra === "sweat") {
      c2.globalAlpha = 0.9; c2.fillStyle = "#6FC7E8";
      const d = (t * 0.5) % 1;
      c2.beginPath();
      const sx = -74, sy = -56 + d * 10, r = 7;
      c2.moveTo(sx, sy - r * 1.3);
      c2.bezierCurveTo(sx + r, sy - r * 0.2, sx + r, sy + r * 0.6, sx, sy + r);
      c2.bezierCurveTo(sx - r, sy + r * 0.6, sx - r, sy - r * 0.2, sx, sy - r * 1.3);
      c2.fill(); c2.globalAlpha = 1;
    } else if (extra === "hearts") {
      for (let i = 0; i < 3; i++) {
        const d = (t * 0.42 + i * 0.33) % 1;
        const hx = -74 - i * 9 + Math.sin((t + i) * 2) * 3, hy = -66 - d * 30;
        c2.globalAlpha = 0.25 + 0.72 * (1 - d);
        c2.fillStyle = i === 1 ? "#FF8FB1" : "#FF6F9B";
        c2.beginPath();
        c2.moveTo(hx, hy + 7);
        c2.bezierCurveTo(hx - 11, hy - 3, hx - 6, hy - 12, hx, hy - 4);
        c2.bezierCurveTo(hx + 6, hy - 12, hx + 11, hy - 3, hx, hy + 7);
        c2.fill();
      }
      c2.globalAlpha = 1;
    } else if (extra === "sparkle") {
      c2.fillStyle = "#FFC93C";
      [[-80, -66, 1], [84, -30, 0.8], [88, 24, 0.6], [-84, 22, 0.55]].forEach(([sx, sy, ss], i) => {
        c2.globalAlpha = 0.5 + 0.45 * Math.abs(Math.sin(t * 2.4 + i));
        const k = 8 * ss;
        c2.beginPath();
        c2.moveTo(sx, sy - k); c2.quadraticCurveTo(sx + 2, sy - 2, sx + k, sy);
        c2.quadraticCurveTo(sx + 2, sy + 2, sx, sy + k);
        c2.quadraticCurveTo(sx - 2, sy + 2, sx - k, sy);
        c2.quadraticCurveTo(sx - 2, sy - 2, sx, sy - k);
        c2.fill();
      });
      c2.globalAlpha = 1;
    } else if (extra === "zzz") {
      c2.fillStyle = "#8A93A6"; c2.textAlign = "center"; c2.textBaseline = "middle";
      for (let i = 0; i < 3; i++) {
        const d = (t * 0.35 + i * 0.3) % 1;
        c2.globalAlpha = 0.3 + 0.65 * (1 - d);
        c2.font = (28 - i * 6) + "px sans-serif";
        c2.fillText("Z", -64 - i * 11 - d * 7, -62 - i * 14 - d * 12);
      }
      c2.globalAlpha = 1;
    } else if (extra === "steam") {
      c2.fillStyle = "rgba(255,255,255,.9)";
      [[-88, -60], [88, -46]].forEach(([sx, sy], i) => {
        for (let k = 0; k < 2; k++) {
          const d = (t * 0.55 + k * 0.4 + i * 0.2) % 1;
          c2.globalAlpha = 0.5 * (1 - d);
          c2.beginPath(); c2.arc(sx + Math.sin((t + k) * 2) * 4, sy - d * 22, 6 + d * 5, 0, Math.PI * 2); c2.fill();
        }
      });
      c2.globalAlpha = 1;
    } else if (extra === "vein") {
      c2.strokeStyle = "#F2686A"; c2.lineWidth = 4; c2.lineCap = "round";
      const vx = -76, vy = -68;
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
        c2.beginPath(); c2.moveTo(vx + dx * 3, vy + dy * 3); c2.lineTo(vx + dx * 11, vy + dy * 11); c2.stroke();
      });
    } else if (extra === "quest" || extra === "excl") {
      c2.fillStyle = extra === "quest" ? "#8A7BD8" : "#EF8A3C";
      c2.font = "42px sans-serif"; c2.textAlign = "center"; c2.textBaseline = "middle";
      c2.fillText(extra === "quest" ? "?" : "!", -72, -66 + Math.sin(t * 4) * 2);
    }
  }

  function drawAnimalFace(c2, kind, emotion, cx, cy, R, t) {
    const ex = FACE_EXPR[emotion] || FACE_EXPR.happy;
    const pal = kind === "dog" ? DOG_PAL : CAT_PAL;
    const cat = kind !== "dog";
    c2.save();
    c2.translate(cx, cy);
    c2.scale(R / 100, R / 100);
    c2.rotate((ex.tilt || 0) + Math.sin(t * 1.5 + (cat ? 0 : 1.1)) * 0.013);
    const breathe = 1 + Math.sin(t * 2 + (cat ? 0 : 1.6)) * 0.012;
    c2.scale(breathe, breathe);
    c2.lineCap = "round"; c2.lineJoin = "round";

    /* 耳朵：猫是大尖耳（橘 + 粉内耳），柴犬是小立耳（深黄 + 粉内耳）；先画头后压耳根 */
    const drawEar = (side) => {
      c2.save(); c2.scale(side, 1);
      c2.fillStyle = cat ? pal.patch : pal.base2;
      c2.strokeStyle = pal.outline; c2.lineWidth = 3.4;
      c2.beginPath();
      if (cat) {
        c2.moveTo(-76, -38);
        c2.quadraticCurveTo(-85, -78, -66, -92);
        c2.quadraticCurveTo(-56, -99, -49, -91);
        c2.quadraticCurveTo(-30, -77, -23, -56);
      } else {
        c2.moveTo(-67, -40);
        c2.quadraticCurveTo(-79, -72, -65, -87);
        c2.quadraticCurveTo(-55, -95, -47, -85);
        c2.quadraticCurveTo(-32, -71, -31, -51);
      }
      c2.closePath(); c2.fill(); c2.stroke();
      c2.fillStyle = pal.earInner;
      c2.beginPath();
      if (cat) {
        c2.moveTo(-69, -48);
        c2.quadraticCurveTo(-74, -74, -63, -82);
        c2.quadraticCurveTo(-42, -71, -36, -54);
      } else {
        c2.moveTo(-61, -48);
        c2.quadraticCurveTo(-69, -70, -62, -78);
        c2.quadraticCurveTo(-46, -68, -42, -52);
      }
      c2.closePath(); c2.fill();
      c2.restore();
    };
    drawEar(-1); drawEar(1);

    /* 头型：略扁的圆润大脸，脸颊鼓出来，下巴收圆 */
    const headPath = () => {
      c2.beginPath();
      c2.moveTo(0, -70);
      c2.bezierCurveTo(50, -70, 84, -40, 84, 8);
      c2.bezierCurveTo(84, 54, 52, 82, 0, 82);
      c2.bezierCurveTo(-52, 82, -84, 54, -84, 8);
      c2.bezierCurveTo(-84, -40, -50, -70, 0, -70);
      c2.closePath();
    };
    const hg = c2.createLinearGradient(0, -70, 0, 84);
    hg.addColorStop(0, pal.base); hg.addColorStop(1, pal.base2);
    c2.fillStyle = hg; headPath(); c2.fill();

    c2.save(); headPath(); c2.clip();
    if (cat) {
      // 橘色「帽子」：下缘走一道 M 形波浪，是国产大橘猫最经典的记号
      c2.fillStyle = pal.patch;
      c2.beginPath();
      c2.moveTo(-90, -80); c2.lineTo(90, -80); c2.lineTo(90, -32);
      c2.bezierCurveTo(66, -20, 42, -36, 24, -30);
      c2.quadraticCurveTo(12, -26, 0, -16);
      c2.quadraticCurveTo(-12, -26, -24, -30);
      c2.bezierCurveTo(-42, -36, -66, -20, -90, -32);
      c2.closePath(); c2.fill();
      // 额上三道虎斑纹
      c2.strokeStyle = pal.patchDark; c2.lineWidth = 5;
      [[-26, -62, -20, -40], [0, -66, 0, -40], [26, -62, 20, -40]].forEach(([x1, y1, x2, y2]) => {
        c2.beginPath(); c2.moveTo(x1, y1); c2.quadraticCurveTo((x1 + x2) / 2 + 3, (y1 + y2) / 2, x2, y2); c2.stroke();
      });
      // 两颊浅色口鼻区
      c2.fillStyle = pal.muzzle;
      c2.beginPath(); c2.ellipse(-20, 43, 32, 26, -0.08, 0, Math.PI * 2); c2.fill();
      c2.beginPath(); c2.ellipse(20, 43, 32, 26, 0.08, 0, Math.PI * 2); c2.fill();
    } else {
      // 柴犬白色面罩：上缘呈心形起伏，覆盖两颊与吻部
      c2.fillStyle = pal.muzzle;
      c2.beginPath();
      c2.moveTo(-90, 8);
      c2.bezierCurveTo(-78, -8, -62, -8, -52, 6);
      c2.quadraticCurveTo(-28, 22, 0, 16);
      c2.quadraticCurveTo(28, 22, 52, 6);
      c2.bezierCurveTo(62, -8, 78, -8, 90, 8);
      c2.lineTo(90, 92); c2.lineTo(-90, 92);
      c2.closePath(); c2.fill();
      // 额上两枚浅色眉点（柴犬标志）
      c2.fillStyle = "rgba(255,250,238,.92)";
      c2.beginPath(); c2.ellipse(-31, -48, 9, 6, -0.16, 0, Math.PI * 2); c2.fill();
      c2.beginPath(); c2.ellipse(31, -48, 9, 6, 0.16, 0, Math.PI * 2); c2.fill();
    }
    // 粉腮红：除愤怒 / 哭喊 / 疲倦外常驻，营造软萌感
    const blushA = (emotion === "angry" || emotion === "grumpy" || emotion === "cry" || emotion === "tired") ? 0.24 : 0.62;
    c2.globalAlpha = blushA;
    c2.fillStyle = pal.blush;
    c2.beginPath(); c2.ellipse(-58, 25, 15, 9, -0.12, 0, Math.PI * 2); c2.fill();
    c2.beginPath(); c2.ellipse(58, 25, 15, 9, 0.12, 0, Math.PI * 2); c2.fill();
    c2.globalAlpha = 1;
    c2.restore();
    c2.strokeStyle = pal.outline; c2.lineWidth = 3.4; headPath(); c2.stroke();

    /* 猫胡须：两侧各两根短弧，画在头外，短而翘才不显老气 */
    if (cat) {
      c2.strokeStyle = "rgba(113,79,61,.62)"; c2.lineWidth = 2.2;
      [[-52, 28, -84, 20], [-54, 42, -86, 44], [52, 28, 84, 20], [54, 42, 86, 44]].forEach(([x1, y1, x2, y2]) => {
        c2.beginPath(); c2.moveTo(x1, y1);
        c2.quadraticCurveTo((x1 + x2) / 2, y1 + (x2 > 0 ? -4 : -4), x2, y2);
        c2.stroke();
      });
    }

    // 眼睛 / 眉毛
    if (ex.eye === "squint") {
      faceEye(c2, "closed", -32, -3, -1, pal);
      faceEye(c2, "wide", 32, -3, 1, pal);
    } else {
      faceEye(c2, ex.eye, -32, -3, -1, pal);
      faceEye(c2, ex.eye, 32, -3, 1, pal);
    }
    if (ex.brow === "one") {
      faceBrow(c2, "up", -32, -34, -1, pal.ink);
      faceBrow(c2, "flat", 32, -36, 1, pal.ink);
    } else {
      faceBrow(c2, ex.brow, -32, -36, -1, pal.ink);
      faceBrow(c2, ex.brow, 32, -36, 1, pal.ink);
    }

    // 鼻子：猫是粉色小三角，狗是黑色圆鼻，都留一点高光
    if (cat) {
      c2.fillStyle = pal.nose; c2.strokeStyle = pal.outline; c2.lineWidth = 2;
      c2.beginPath();
      c2.moveTo(-9, 24); c2.quadraticCurveTo(0, 20, 9, 24);
      c2.quadraticCurveTo(7, 33, 0, 34); c2.quadraticCurveTo(-7, 33, -9, 24);
      c2.closePath(); c2.fill(); c2.stroke();
      c2.strokeStyle = pal.ink; c2.lineWidth = 2.4;
      c2.beginPath(); c2.moveTo(0, 34); c2.lineTo(0, 41); c2.stroke();
    } else {
      c2.fillStyle = pal.nose;
      c2.beginPath();
      c2.moveTo(-14, 22); c2.quadraticCurveTo(0, 17, 14, 22);
      c2.quadraticCurveTo(16, 32, 0, 35); c2.quadraticCurveTo(-16, 32, -14, 22);
      c2.closePath(); c2.fill();
      c2.fillStyle = "rgba(255,255,255,.55)";
      c2.beginPath(); c2.ellipse(-4, 24, 4.2, 2.4, -0.3, 0, Math.PI * 2); c2.fill();
      c2.strokeStyle = pal.ink; c2.lineWidth = 2.4;
      c2.beginPath(); c2.moveTo(0, 35); c2.lineTo(0, 41); c2.stroke();
    }

    faceMouth(c2, ex.mouth, pal.ink);
    faceExtra(c2, ex.extra, t, pal);

    c2.restore();
  }

  /* 声音页（首页「猫咪状态」入口）版式：绘制层与广告位（G.soundAdRect）共用同一份计算。
     共享的只有顶部这几条线——tab 行与卡片网格上沿；网格内部怎么排（几列几行）
     由卡片数决定，广告只需要知道"网格从哪一行开始"。全部是虚拟手机坐标。 */
  function soundLayout() {
    const { W, H, land, safe, menu } = layout();
    const tabW = Math.min(240, Math.max(184, W * 0.30));
    const tabH = 36, tabX = (W - tabW) / 2, tabY = safe.top + 48;
    return { W, H, land, safe, menu, tabW, tabH, tabX, tabY, gridTop: tabY + tabH + 13 };
  }

  ui.drawSound = () => {
    const { W, H, safe } = layout();
    const now = performance.now();
    const packs = G.SOUND_PACKS || [];
    const pack = packs.find(p => p.key === (G.soundTab || "cat")) || packs[0];
    if (!pack) return;
    ui.buttons.length = 0;

    // 背景：与首页同族的暖米白底 + 慢速气泡，页与页之间不跳色
    pageBg(W, H);
    ctx.strokeStyle = "rgba(150,155,130,.22)"; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const bx = (i * 61 + 30) % W, by = H - ((now / 32 + i * 89) % (H * 0.72));
      const r = 4 + (i % 3) * 3;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.stroke();
    }

    const active = G.soundPadActive ? G.soundPadActive() : !!(G.soundPad && G.soundPad.playing);
    const sp = G.soundPad || {};
    const playingCard = active ? sp.key : "";
    const playingPack = active ? sp.animal : "";
    const animBase = G.soundAnimT0 || now;

    // 顶部：胶囊返回 / 标题（停止键放在下面的 tab 行，避开微信胶囊）
    const bs = 40, bX = safe.left + 14, bY = safe.top + 10;
    const backW = backPill(bX, bY, bs, { key: "sound-back", cb: () => { G.closeSound(); } });

    // 分享键：紧跟返回胶囊放右边（右上角是微信胶囊的固定地盘，不能占）
    const shX = bX + backW + 8;
    chipBtn(shX, bY, bs, "share", { key: "sound-share", cb: () => { G.playTick(); G.shareModule("sound"); } });

    text("动物情绪", W / 2, safe.top + 28, "21px sans-serif", C.ink);

    // 猫 / 狗 分段 tab
    const SL = soundLayout();
    const { tabW, tabH, tabX, tabY } = SL;
    ctx.fillStyle = DK.track; G.rr(ctx, tabX, tabY, tabW, tabH, tabH / 2);
    ctx.fillStyle = "transparent"; ctx.strokeStyle = DK.trackLine; ctx.lineWidth = 1;
    rrPath(tabX, tabY, tabW, tabH, tabH / 2); ctx.stroke();
    const segW = (tabW - 8) / packs.length;
    packs.forEach((p, i) => {
      const on = p.key === pack.key;
      const sx = tabX + 4 + i * segW;
      if (on) {
        ctx.save();
        ctx.fillStyle = "#ffffff";
        G.rr(ctx, sx, tabY + 4, segW, tabH - 8, (tabH - 8) / 2);
        ctx.restore();
        ctx.fillStyle = "transparent";
        ctx.strokeStyle = "rgba(21,154,140,.6)"; ctx.lineWidth = 1.4;
        rrPath(sx, tabY + 4, segW, tabH - 8, (tabH - 8) / 2); ctx.stroke();
      }
      text(p.name, sx + segW / 2, tabY + tabH / 2 + 1, "15px sans-serif", on ? C.tealDeep : C.ink2);
      btnKey(sx, tabY + 3, segW, tabH - 6, "sound-tab-" + p.key, () => G.setSoundTab(p.key));
    });
    /* 停止键放在 tab 右侧而不是屏幕右上角：右上角是微信胶囊（···/关闭）的固定地盘，
       横屏时还会被「游戏中心」手柄入口再占一格。放在 tab 同一行既避开胶囊，也不压标题。 */
    if (active) {
      const sw = 46, sh = tabH - 4, sx = tabX + tabW + 10, sy = tabY + 2;
      if (sx + sw <= W - safe.right - 8) {
        const g2 = ctx.createLinearGradient(sx, sy, sx, sy + sh);
        g2.addColorStop(0, C.startGrad0); g2.addColorStop(1, C.startGrad1);
        ctx.fillStyle = g2;
        G.rr(ctx, sx, sy, sw, sh, sh / 2); ctx.fill();
        ctx.fillStyle = "#fff";
        G.rr(ctx, sx + 8, sy + sh / 2 - 3.5, 7, 7, 2); ctx.fill();
        text("停止", sx + 18, sy + sh / 2 + 1, "11px sans-serif", "#fff", "left");
        btnKey(sx, sy, sw, sh, "sound-stop", () => { G.stopAnimalSound(); G.playTick(); });
      }
    }

    // 网格：三套候选布局里取单格最大，横屏手机自然落到 6×2
    const gridTop = SL.gridTop;
    const gridBottom = H - safe.bottom - 32;
    const gridW = W - safe.left - safe.right - 28;
    const gridH = Math.max(80, gridBottom - gridTop);
    const gap = Math.min(12, Math.max(8, W * 0.012));
    const n = pack.sounds.length;
    const cands = n <= 6 ? [[3, 2], [2, 3]] : [[6, 2], [4, 3], [3, 4]];
    let best = null;
    cands.forEach(([cols, rows]) => {
      if (cols * rows < n) return;
      const cw = (gridW - gap * (cols - 1)) / cols;
      const ch = (gridH - gap * (rows - 1)) / rows;
      if (cw < 36 || ch < 36) return;
      // 过于扁长/瘦长的格子不好看：按 min(cw,ch) 打分，再用 1.45 的宽高比偏好做轻微修正
      const score = Math.min(cw, ch) - Math.abs(cw / ch - 1.08) * 8;
      if (!best || score > best.score) best = { cols, rows, cw, ch, score };
    });
    if (!best) return;
    const { cols, rows, cw, ch } = best;
    const totalW = cw * cols + gap * (cols - 1);
    const totalH = ch * rows + gap * (rows - 1);
    const gx = safe.left + (W - safe.left - safe.right - totalW) / 2;
    const gy = gridTop + Math.max(0, (gridH - totalH) / 2);

    pack.sounds.forEach((snd, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const nInRow = (r < rows - 1) ? cols : (n % cols || cols);
      const offX = (cols - nInRow) * (cw + gap) / 2;
      const x = gx + c * (cw + gap) + offX;
      const y = gy + r * (ch + gap);
      const isPlaying = active && playingCard === snd.key && playingPack === pack.key;
      const tint = FACE_TINT[snd.face] || "#e8f4ef";
      const ek = clamp((now - animBase - i * 18) / 240, 0, 1);
      const ease = 1 - Math.pow(1 - ek, 3);
      const press = ui.pressedBtn && Math.abs(ui.pressedBtn.x - x) < 0.5 &&
        Math.abs(ui.pressedBtn.y - y) < 0.5 ? 0.965 : 1;

      ctx.save();
      ctx.globalAlpha = ease;
      ctx.translate(x + cw / 2, y + ch / 2 + (1 - ease) * 12);
      ctx.scale(press, press);
      ctx.translate(-(x + cw / 2), -(y + ch / 2));

      // 卡片：播放中青绿描边 + 柔光，其余白卡细边
      ctx.save();
      if (isPlaying) { ctx.shadowColor = "rgba(21,154,140,.35)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4; }
      else { ctx.shadowColor = "rgba(20,49,58,.10)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; }
      ctx.fillStyle = isPlaying ? "#ffffff" : "rgba(255,255,255,.95)";
      G.rr(ctx, x, y, cw, ch, 16); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = isPlaying ? C.teal : "rgba(220,235,230,.95)";
      ctx.lineWidth = isPlaying ? 2.2 : 1.1;
      rrPath(x, y, cw, ch, 16); ctx.stroke();

      // 插画：淡色圆底 + 矢量猫/狗脸，播放中向外扩散两道声波
      const labelH = Math.min(24, Math.max(18, ch * 0.15));
      const faceCy = y + (ch - labelH) * 0.50 + 2;
      const faceR = Math.max(12, Math.min(cw * 0.40, (faceCy - y - 6) / 1.12,
        (y + ch - labelH - faceCy) / 0.92, 52));
      const cx = x + cw / 2;
      ctx.save();
      rrPath(x, y, cw, ch, 16); ctx.clip();
      ctx.fillStyle = tint;
      ctx.beginPath(); ctx.arc(cx, faceCy, Math.min(faceR * 1.16, cw * 0.47), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, faceCy, Math.min(faceR * 1.16, cw * 0.47) - 1.5, 0, Math.PI * 2); ctx.stroke();
      if (isPlaying) {
        const ph = (now / 900) % 1;
        for (let k = 0; k < 2; k++) {
          const alpha = Math.max(0, 0.55 * (1 - ph - k * 0.22));
          if (alpha <= 0) continue;
          ctx.strokeStyle = "rgba(21,154,140," + alpha.toFixed(3) + ")";
          ctx.lineWidth = 2;
          const rad = faceR * (1.22 + k * 0.16 + ph * 0.14);
          ctx.beginPath(); ctx.arc(cx, faceCy, rad, -0.62, 0.62); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx, faceCy, rad, Math.PI - 0.62, Math.PI + 0.62); ctx.stroke();
        }
      }
      drawAnimalFace(ctx, pack.key, snd.face, cx, faceCy + Math.sin(now / 620 + i) * 1.1, faceR, now / 1000);
      ctx.restore();

      // 右上角播放标记：小三角（待播） / 三格跳动（播放中）
      const badgeX = x + cw - 15, badgeY = y + 15, badgeR = Math.min(10, cw * 0.09);
      ctx.fillStyle = isPlaying ? "rgba(21,154,140,.14)" : "rgba(20,49,58,.055)";
      ctx.beginPath(); ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2); ctx.fill();
      if (isPlaying) {
        ctx.fillStyle = C.teal;
        for (let k = 0; k < 3; k++) {
          const bh = 3.5 + Math.abs(Math.sin(now / 150 + k * 1.2)) * 7;
          G.rr(ctx, badgeX - 5 + k * 4, badgeY - bh / 2, 2.4, bh, 1.2); ctx.fill();
        }
      } else {
        ctx.fillStyle = C.ink3;
        ctx.beginPath();
        ctx.moveTo(badgeX - 2.5, badgeY - 3.6); ctx.lineTo(badgeX + 4, badgeY);
        ctx.lineTo(badgeX - 2.5, badgeY + 3.6); ctx.closePath(); ctx.fill();
      }

      // 情绪名
      text(snd.name, cx, y + ch - Math.min(13, labelH * 0.56),
        Math.min(14, Math.max(11, cw * 0.11)) + "px sans-serif",
        isPlaying ? C.tealDeep : C.ink);
      ctx.restore();

      btnKey(x, y, cw, ch, "sound-card-" + pack.key + "-" + snd.key, () => {
        G.playSoundCard(pack.key, snd);
      });
    });

    // 底部提示：播放中显示当前曲目，音效关闭时给出开启指引
    let foot;
    if (G.config && G.config.sound === false) foot = "音效已在设置中关闭，去首页设置里打开后即可试听";
    else if (active) foot = "正在播放：" + (packs.find(p => p.key === playingPack) || pack).name + " · " + (sp.name || "");
    else foot = pack.desc + " · 点一下卡片就能听";
    text(foot, W / 2, H - safe.bottom - 13, "12px sans-serif", active ? C.tealDeep : C.ink3);
    /* 广告层只在横屏出现：每帧渲染完打个点，供它判定"主内容已完成布局"后再 show */
    if (G.ad && G.ad.pageFrame) G.ad.pageFrame("sound");
    // 正在淡出到别的页面：本帧不再接收点击，避免"返回后又被点响一条"
    if (G.nextScreen && G.nextScreen !== "sound") ui.buttons.length = 0;
  };

  /* 召唤页卡牌区版式：绘制层与广告位（G.summonAdRect）共用同一份计算，
     避免两处公式各算一遍然后漂移。所有长度都是虚拟手机坐标，外层由 S 统一放大。 */
  function summonLayout() {
    const { W, H, land, m, safe } = layout();
    const bh = 56;                                     // 底部按钮高度
    const bMargin = 20;                                // 底部间距
    const titleH = safe.top + 60;                      // 标题区占用高度
    const footerH = safe.bottom + bh + bMargin + 10;   // 底部按钮占用高度（指示点已删）
    const availH = Math.max(0, H - titleH - footerH);  // 卡牌区可用总高度
    // 动态调整卡牌尺寸：加高卡身吃满可用空间（不压底部按钮）
    const CWbase = Math.min(W * 0.68, 280);
    const CH = Math.min(Math.round(CWbase * 1.3), Math.max(0, availH - 8));   // 高度优先吃满可用空间
    const CW = Math.min(Math.round(CWbase), Math.max(0, Math.round(CH / 1.3)));
    const gap = 20;
    return {
      W, H, land, m, safe, titleH, availH, CW, CH, gap,
      step: CW + gap,
      cx0: W / 2,                                      // 水平中心
      cy0: titleH + availH / 2                         // 垂直中心：在可用区域内平分空间
    };
  }

  ui.drawSummon = () => {
    const { W, H, safe, CW, CH, step, cx0, cy0 } = summonLayout();
    const kinds = G.summonKinds ? G.summonKinds() : (G.CAT_KINDS || []);
    const P = G.summonPick || { idx: 0, off: 0, t0: performance.now() };
    if (!G.summonPick) G.summonPick = P;
    // 自定义卡被删除后索引会超出范围：先收回来，否则会画出一张空白卡
    if (P.idx > kinds.length - 1) P.idx = Math.max(0, kinds.length - 1);
    
    const sel = P.idx;
    const kind = kinds[sel] || {};
    const playing = !!G.summonPlaying;
    
    pageBg(W, H);
    ui.buttons.length = 0;

    // 弹入动画
    const openK = Math.min(1, (performance.now() - P.t0) / 300);
    const openE = 1 - Math.pow(1 - openK, 3);
    ctx.save();
    ctx.translate(0, (1 - openE) * 20);
    ctx.globalAlpha = openE;

    // 胶囊返回按钮
    const bs = 40, bX = safe.left + 14, bY = safe.top + 10;
    const backW = backPill(bX, bY, bs, { cb: () => { G.stopSummonMusic(); G.switchScreen("home"); } });

    /* 自定义召唤卡入口（左上角，紧跟返回胶囊）：标题/图片/音频都可自己传，
       存本机后永远排在卡牌列表第一个。图标-only 42×42，不挤居中标题 */
    const eX = bX + backW + 8;
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
    text("自定义", eX + bs / 2, bY + 32, "9px sans-serif", hasCustom ? C.tealDeep : C.ink2);
    btnKey(eX, bY, bs, bs, "edit-open", () => { G.ensureAudio(); G.playTick(); openSummonEdit(); });

    text("召唤猫咪", W / 2, safe.top + 34, "22px sans-serif", C.ink);

    // 卡牌滑动切换逻辑：尺寸与中心点全部来自 summonLayout（与广告位共用同一份计算）
    
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
        text(k.name, 0, CH * 0.17, nameF + "px sans-serif", active ? C.tealDeep : C.ink);
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
    
    orangePill(bX2_fixed, bY2_fixed, bW_fixed, bH_fixed, { dy: 5, blur: 16, ring: false });
    
    const iconS = 20;
    const label = playing ? "停止召唤" : "开始召唤";
    ctx.font = "15px sans-serif";
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
    text(label, startX + iconS + 10 + tW / 2, bY2_fixed + bH_fixed / 2, "18px sans-serif", "#fff");
    btn(bX2_fixed, bY2_fixed, bW_fixed, bH_fixed, () => {
      G.ensureAudio();
      if (G.summonPlaying) G.stopSummonMusic(); else G.startSummonKind(sel);
    });

    // 分享键：与「开始召唤」等高等底，放在它右侧（顶部已有返回 / 自定义两颗，不再挤）
    const shS = bH_fixed, shX2 = bX2_fixed + bW_fixed + 10;
    if (shX2 + shS <= W - safe.right - 8) {
      ctx.fillStyle = "rgba(255,255,255,.96)"; ctx.strokeStyle = C.teal; ctx.lineWidth = 1.4;
      G.rr(ctx, shX2, bY2_fixed, shS, shS, 14); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(shX2 + shS / 2, bY2_fixed + shS / 2);
      shareIconAt(ctx, 22, C.tealDeep);
      ctx.restore();
      btnKey(shX2, bY2_fixed, shS, shS, "summon-share", () => { G.playTick(); G.shareModule("summon"); });
    }

    ctx.restore();

    // 自定义录入弹窗画在卡牌之上（命中区也后 push，优先于背面卡牌）
    if (ui.summonEdit) drawSummonEdit({ W, H, safe });

    /* 广告层只在召唤页出现：每帧渲染完打个点，供它判定"主内容已完成布局"后再 show */
    if (G.ad && G.ad.pageFrame) G.ad.pageFrame("summon");
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
    G.rr(ctx, hx + 10, hy, wTime, PH2, Math.round(PH2 / 2)); ctx.fill(); ctx.stroke();
    text(timeTxt, hx + 10 + wTime / 2, hy + PH2 / 2 + 1, Math.round(15 * ks) + "px sans-serif", urgent ? "#ffd7d7" : "#fff");
    ui.timePillRect = { x: hx + 10, y: hy, w: wTime, h: PH2 };   // 测试钩子：HUD 同行校验用
    // 捕获数药丸（64×28 × ks）
    const wHit = Math.round(64 * ks);
    const xHit = hx + 10 + wTime + 8;
    ctx.fillStyle = C.hitPill;
    G.rr(ctx, xHit, hy, wHit, PH2, Math.round(PH2 / 2)); ctx.fill(); ctx.stroke();
    text("🐾 " + S.hits, xHit + wHit / 2, hy + PH2 / 2 + 1, Math.round(13 * ks) + "px sans-serif", "#fff");
    // 连击（静态小徽，无弹跳；combo>=2 才显示，50×28 × ks）
    if (S.combo >= 2) {
      const hot = S.combo >= 5;
      const wCb = Math.round(50 * ks);
      const xCb = xHit + wHit + 8;
      ctx.fillStyle = hot ? "rgba(255,107,74,.9)" : C.comboPill;
      G.rr(ctx, xCb, hy, wCb, PH2, Math.round(PH2 / 2)); ctx.fill(); ctx.stroke();
      text("×" + S.combo, xCb + wCb / 2, hy + PH2 / 2 + 1, Math.round(13 * ks) + "px sans-serif", "#fff");
    }
    /* 蝌蚪：漏击计数（灰徽，只在真的漏过时出现；3 次以上加重，提醒连击已经掉档） */
    if (G.config.targetType === "tadpole" && (S.escapes || 0) > 0) {
      const wEsc = Math.round(46 * ks);
      let xEsc = xHit + wHit + 8;
      if (S.combo >= 2) xEsc += Math.round(50 * ks) + 8;
      ctx.fillStyle = (S.escapes >= 3) ? "rgba(90,96,108,.78)" : "rgba(16,18,22,.34)";
      G.rr(ctx, xEsc, hy, wEsc, PH2, Math.round(PH2 / 2)); ctx.fill(); ctx.stroke();
      text("漏击 " + S.escapes, xEsc + wEsc / 2, hy + PH2 / 2 + 1,
        Math.round(12 * ks) + "px sans-serif", "#fff");
    }

    if (G.uiFX.stagePop > 0) {
      G.uiFX.stagePop -= dt;
      const p = clamp(G.uiFX.stagePop / 0.5, 0, 1);
      const sc2 = 1 + (1 - p) * 0.25;
      ctx.save();
      ctx.translate(W / 2, safe.top + 92);
      ctx.scale(sc2, sc2);
      ctx.globalAlpha = dim * clamp(p * 2, 0, 1);
      text(G.uiFX.stageText, 0, 0, "17px sans-serif", C.amber);
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

  /* 原生模板广告位（由 ad.js 读取）：仅横屏倒计时页。
     倒计时是全屏蒙版 + 中央大数字，顶部右侧（胶囊左侧）是干净留白——广告贴顶靠右浮在那里，
     不压数字与「准备……」文案。竖屏顶部太窄、蒙版上数字占比大 → 不出。 */
  G.countdownAdRect = () => {
    if (!G.ad || !G.ad.fit) return null;
    const { W, H, land, safe, menu } = layout();
    if (!land) return null;
    const menuL = menu ? menu.left : W - safe.right;
    const rightLimit = Math.floor(menuL - 8);
    const width = Math.max(120, Math.min(160, Math.round(W * 0.19)));
    const left = rightLimit - width;
    const top = Math.round(safe.top + 8);
    if (width < 120 || left < safe.left || top + 96 > H * 0.42 - 48) return null;
    return G.ad.fit([{ left, top, width, height: 96 }], {
      pad: 8,
      avoid: []
    });
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
    ctx.save();
    ctx.shadowColor = "rgba(70,92,80,.28)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#ffffff";
    G.rr(ctx, px, py, pw, ph, 24);
    ctx.restore();
    ctx.fillStyle = "transparent"; ctx.strokeStyle = "rgba(214,218,200,.9)"; ctx.lineWidth = 1;
    rrPath(px, py, pw, ph, 24); ctx.stroke();
    text("暂停中", W / 2, py + 44, "22px sans-serif", C.ink);
    if (G.config.targetType === "tadpole") {
      /* 竖屏面板只有 ~270px 内宽：按可用宽度收字号，避免规则提示溢出面板。 */
      const tip = "折返瞬间命中 +2 · 漏击 1 次扣 3 连击";
      text(tip, W / 2, py + 66, fitFont(tip, 12, pw - 44, "normal") + "px sans-serif", C.ink3);
    }
    orangePill(px + 24, py + 84, pw - 48, 48, { dy: 4, blur: 14, ring: false });
    text("继续本局", W / 2, py + 108, "17px sans-serif", "#fff");
    btn(px + 24, py + 84, pw - 48, 48, () => { G.session.paused = false; G.screen = "playing"; });
    ctx.fillStyle = "#ffffff";
    G.rr(ctx, px + 24, py + 148, pw - 48, 48, 24); ctx.fill();
    ctx.fillStyle = "transparent"; ctx.strokeStyle = "rgba(214,218,200,.95)"; ctx.lineWidth = 1;
    rrPath(px + 24, py + 148, pw - 48, 48, 24); ctx.stroke();
    text("结束本局", W / 2, py + 172, "16px sans-serif", C.ink2);
    btn(px + 24, py + 148, pw - 48, 48, () => { G.session.paused = false; G.endGame(true); });
  };

  /* ================= 结算 ================= */
  ui.drawResult = () => {
    const { W, H, land, m, gap, safe } = layout();
    const innerH = H - safe.top - safe.bottom;
    const R = G.result || {};
    // 入场节奏：数据卡依次浮现（结算弹出太快，全静态显得生硬）
    const rNow = performance.now();
    const entA = (delay) => R.t0 ? clamp((rNow - R.t0 - delay) / 360, 0, 1) : 1;
    const entE = (k) => 1 - Math.pow(1 - k, 3);
    // 模式名：结算页标题要标出这一局选的是哪种玩法（鱼玩法再带海域主题名）
    const seaName = G.config.targetType === "fish" && G.session.sea ? " · " + G.session.sea.name : "";
    const modeName = ((MODES.find(md => md.key === G.config.targetType)) || {}).name + seaName;
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
    /* 左上角返回入口：回到二级菜单的选项卡页（玩法卡 / 场景卡），不再开设置抽屉。
       胶囊尺寸、位置、底色描边与原来的设置键完全一致，只把图标与文案换成返回语义；
       图标沿用二级页胶囊返回键(backPill)的 ‹ 箭头画法，保证同一套视觉语言。
       内部分组（箭头 + 间距 + 文字）按实测文字宽整体居中——齿轮换成细线箭头后视觉重量变轻，
       左对齐会显得内容贴边、右侧空出一大块。 */
    {
      const sw = 96, sh = 34, sx = safe.left + 6, sy = safe.top + 10;
      ctx.fillStyle = "rgba(255,255,255,.94)";
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
      G.rr(ctx, sx, sy, sw, sh, sh / 2); ctx.fill(); ctx.stroke();
      ctx.font = "13px sans-serif";
      const lab = "返回", tw = ctx.measureText(lab).width;
      const arrowW = 6, gap = 7, group = arrowW + gap + tw;
      const gx = sx + (sw - group) / 2, acy = sy + sh / 2, acx = gx + arrowW / 2;
      // ‹ 箭头：线宽/端点与 backPill 一致（同样两笔折线，不做填充）
      ctx.save();
      ctx.strokeStyle = C.tealDeep; ctx.lineWidth = 2;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(acx + 2.8, acy - 4.4);
      ctx.lineTo(acx - 2.8, acy);
      ctx.lineTo(acx + 2.8, acy + 4.4);
      ctx.stroke();
      ctx.restore();
      text(lab, gx + arrowW + gap + tw / 2, acy + 1, "13px sans-serif", C.tealDeep);
      btn(sx, sy, sw, sh, () => G.backToPick());
    }
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
      text(R.title || "", centerX, titleTop + 34, "30px sans-serif", C.ink);
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
        const ea = entE(entA(60 + i * 70));
        ctx.save();
        ctx.globalAlpha = ea;
        ctx.translate(0, (1 - ea) * 10);
        ctx.save();
        ctx.shadowColor = "rgba(70,92,80,.14)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
        ctx.fillStyle = "rgba(255,255,255,.92)";
        G.rr(ctx, x, cardY, cw, chh, 18);
        ctx.restore();
        ctx.fillStyle = "transparent"; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1;
        rrPath(x, cardY, cw, chh, 18); ctx.stroke();
        text(c[0], x + cw / 2, cardY + 24, "13px sans-serif", C.ink2);
        text(String(c[1]), x + cw / 2, cardY + 54, "26px sans-serif", C.tealDeep);
        ctx.restore();
      });
      if (R.bonusTag) {
        // 琥珀色小字在浅色场景上偏弱，加一层白描边
        ctx.save();
        ctx.shadowColor = "rgba(255,255,255,.95)"; ctx.shadowBlur = 8;
        text(R.bonusTag, centerX, cardY + chh + 20, "14px sans-serif", C.amberDeep);
        ctx.restore();
      }
      // 四个按钮文案等长（4 字）：宽度按文案收紧、整行居中，不再撑满整个横屏宽度
      ctx.font = "17px sans-serif";
      const rLabW = ctx.measureText("再来一局").width;
      const bw = Math.min((availW - gap * 3) / 4, rLabW + 46), by = btnTop;
      const rowOff = Math.max(0, (availW - (bw * 4 + gap * 3)) / 2);
      const rX = leftX + rowOff;
      orangePill(rX, by, bw, 46, { dy: 4, blur: 13, ring: false });
      text("再来一局", rX + bw / 2, by + 23, "17px sans-serif", "#fff");
      btn(rX, by, bw, 46, () => G.requestStart());
      // 晒给猫友：分享带「猫咪反应测评图」，而不是"我得了 X 分"
      const x2 = rX + bw + gap;
      ctx.fillStyle = C.card; ctx.strokeStyle = C.teal; ctx.lineWidth = 1.4;
      G.rr(ctx, x2, by, bw, 46, 14); ctx.fill(); ctx.stroke();
      text("晒给猫友", x2 + bw / 2, by + 23, "17px sans-serif", C.teal);
      btn(x2, by, bw, 46, () => G.shareResult());
      // 存成图片：朋友圈发图不受游戏类分享限制
      const x3 = rX + (bw + gap) * 2;
      ctx.fillStyle = C.card; ctx.strokeStyle = C.amber; ctx.lineWidth = 1.4;
      G.rr(ctx, x3, by, bw, 46, 14); ctx.fill(); ctx.stroke();
      text("存成图片", x3 + bw / 2, by + 23, "17px sans-serif", C.amberDeep);
      btn(x3, by, bw, 46, () => G.saveCard());
      const x4 = rX + (bw + gap) * 3;
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
      G.rr(ctx, x4, by, bw, 46, 14); ctx.fill(); ctx.stroke();
      text("返回首页", x4 + bw / 2, by + 23, "17px sans-serif", C.ink);
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
      text(R.title || "", W / 2, safe.top + innerH * 0.15, "30px sans-serif", C.ink);
      text(R.desc || "", W / 2, safe.top + innerH * 0.15 + 38, "14px sans-serif", C.ink2);
      ctx.restore();
      const edgeL = safe.left + 24, availW = W - safe.left - safe.right - 48;
      const cw = (availW - 12) / 2, chh = 78;
      // 按钮几何先算出来：数据卡在「标题底 ↔ 按钮顶」之间垂直居中。
      // 原来固定 innerH*0.24 定位，在 2×2 按钮布局下会留出一大片空白。
      // 按钮宽度按文案收紧（4 字文案不再撑满两列），一对按钮整行居中
      const bh2 = 54;
      const bw2 = Math.min((availW - 12) / 2, fitBtnWidth("再来一局", bh2) + 8);
      const pairL = edgeL + Math.max(0, (availW - (bw2 * 2 + 12)) / 2);
      const by4 = H - safe.bottom - 26 - bh2;
      const by1 = by4 - (bh2 + 14);
      const titleBottom = safe.top + innerH * 0.15 + 30;
      const blockH = 2 * chh + 12 + (R.bonusTag ? 26 : 0);
      const baseY = titleBottom + Math.max(20, (by1 - 22 - titleBottom - blockH) / 2);
      cells.forEach((c, i) => {
        const x = edgeL + (i % 2) * (cw + 12), y = baseY + Math.floor(i / 2) * (chh + 12);
        const ea = entE(entA(60 + i * 70));
        ctx.save();
        ctx.globalAlpha = ea;
        ctx.translate(0, (1 - ea) * 10);
        ctx.save();
        ctx.shadowColor = "rgba(70,92,80,.14)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
        ctx.fillStyle = "rgba(255,255,255,.92)";
        G.rr(ctx, x, y, cw, chh, 18);
        ctx.restore();
        ctx.fillStyle = "transparent"; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1;
        rrPath(x, y, cw, chh, 18); ctx.stroke();
        text(c[0], x + cw / 2, y + 24, "13px sans-serif", C.ink2);
        text(String(c[1]), x + cw / 2, y + 54, "26px sans-serif", C.tealDeep);
        ctx.restore();
      });
      if (R.bonusTag) {
        ctx.save();
        ctx.shadowColor = "rgba(255,255,255,.95)"; ctx.shadowBlur = 8;
        text(R.bonusTag, W / 2, baseY + 2 * (chh + 12) + 16, "14px sans-serif", C.amberDeep);
        ctx.restore();
      }
      // 四个按钮 2×2 网格：竖屏四段纵排会压到数据卡，网格更省高度、热区也更大
      const rx = pairL + bw2 + 12;
      orangePill(pairL, by1, bw2, bh2, { dy: 4, blur: 13, ring: false });
      text("再来一局", pairL + bw2 / 2, by1 + bh2 / 2, "18px sans-serif", "#fff");
      btn(pairL, by1, bw2, bh2, () => G.requestStart());
      ctx.fillStyle = C.card; ctx.strokeStyle = C.teal; ctx.lineWidth = 1.4;
      G.rr(ctx, rx, by1, bw2, bh2, 14); ctx.fill(); ctx.stroke();
      text("晒给猫友", rx + bw2 / 2, by1 + bh2 / 2, "17px sans-serif", C.teal);
      btn(rx, by1, bw2, bh2, () => G.shareResult());
      ctx.fillStyle = C.card; ctx.strokeStyle = C.amber; ctx.lineWidth = 1.4;
      G.rr(ctx, pairL, by4, bw2, bh2, 14); ctx.fill(); ctx.stroke();
      text("存成图片", pairL + bw2 / 2, by4 + bh2 / 2, "17px sans-serif", C.amberDeep);
      btn(pairL, by4, bw2, bh2, () => G.saveCard());
      ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
      G.rr(ctx, rx, by4, bw2, bh2, 14); ctx.fill(); ctx.stroke();
      text("返回首页", rx + bw2 / 2, by4 + bh2 / 2, "17px sans-serif", C.ink);
      btn(rx, by4, bw2, bh2, () => { G.switchScreen("home"); G.clearPreys(); });
    }
  };

  /* 原生模板广告位（由 ad.js 读取）：横屏「标题右侧」那块空白。
     标题与 tab 行都是居中的，右侧从 tab 右缘（播放中还会多一颗「停止」）一直到微信胶囊之间
     是整片空背景，广告就落在这里：右缘贴胶囊左侧、下缘贴网格上沿——不碰标题/停止键，也不压卡片。
     竖屏不出：网格几乎顶到 tab 行，右侧只剩一条缝，硬塞会盖住最右一列卡片。 */
  G.soundAdRect = () => {
    if (!G.ad || !G.ad.fit) return null;
    const L = soundLayout();
    if (!L.land) return null;
    const pad = 8;
    /* 所有边界都取整再算：ad.fit 里 R.right 是 left + Math.floor(w)，
       边界留小数会让"贴边"变成"差 0.02px 相交"，整条被 avoid 判掉。
       左边界 = tab 右缘 + 停止键预留（10 间距 + 46 宽 + 余量）。
       【窄屏保底】虚拟宽较小的档（如 1024×768 → 662），tab 居中后右侧整片留白只有
       ~100px，标准 58 预留会把广告压到 <MIN_WIDTH(120) 直接不出。这里按右缘可达宽度
       反推 leftLimit，确保留白至少 120；代价是广告可能盖住停止键最右一小段——浮卡
       本就允许遮挡，宁可轻微遮挡也要出得来（与高度截断同一原则）。 */
    const navRight = L.menu ? L.menu.left : L.W - L.safe.right;
    const leftLimit = Math.min(
      Math.ceil(L.tabX + L.tabW + 58),
      Math.floor(navRight - pad - 120)
    );  // 停止键预留（10间距+46宽+2呼吸）；大屏窄虚拟宽下多留 6px 给广告过 MIN_WIDTH
    /* 右边界：微信胶囊左缘（横屏胶囊就钉在右上角，广告不许钻到它下面去） */
    const rightLimit = Math.floor((L.menu ? L.menu.left : L.W - L.safe.right) - pad);
    const gridTop = Math.round(L.gridTop);
    const bandW = rightLimit - leftLimit;
    const bandH = gridTop - 6 - (Math.ceil(L.safe.top) + pad);
    if (bandW < 120 || bandH < 60) return null;   // 空白带太窄：这条广告不出
    const measured = Number(G.soundAdMeasuredH) || 0;
    const cands = [];
    /* 模板高度随宽度等比走：从最宽往窄试。没实测值时按 0.6×宽 估（原生模板 左图右文 /
       上图下文 之间的中间值）。
       【关键】实测高度只用来定 top（让下缘贴齐网格上沿），绝不再拿它做淘汰判定——
       真机素材回传的真实高度可能比这条右上窄带还高（bandH≈81，素材常 100+），
       旧的 if(h>bandH) continue 会把所有候选跳过 → 返回 null → ad.realign
       立刻 leave 把已 show 的广告销毁，表现就是测试正常、真机不出。
       改成 Math.min 截断到带高：浮卡本就允许遮挡，宁可素材略溢出压到网格上沿一点，
       也要保证广告出得来（与 result 横屏的截断做法一致）。 */
    for (let w = Math.min(200, bandW); w >= 120; w -= 10) {
      const rawH = measured || Math.round(w * 0.6);
      const h = Math.min(rawH, bandH);
      cands.push({ left: rightLimit - w, top: gridTop - 6 - h, width: w, height: h });
    }
    if (!cands.length) return null;
    return G.ad.fit(cands, {
      pad: pad,
      avoid: [
        { left: 0, top: 0, width: leftLimit, height: gridTop },              // 返回/分享/标题/tab/停止
        { left: 0, top: gridTop, width: L.W, height: L.H - gridTop }         // 卡片网格
      ]
    });
  };

  /* 原生模板广告位（由 ad.js 读取）：只落在横屏「卡牌左侧」那半屏留白里。
     竖屏卡片自身就吃掉 68% 屏宽，左右只剩一条缝 → 返回 null，不硬塞。
     右边界贴住当前卡左缘（留 14px 呼吸），宽度上限 260——不按"左侧那张缩小半透明卡"
     再往里收：那样在 765 / 667 宽的横屏上只剩 100 出头，宁可窄成一条缝不如不出，
     而一旦收窄就变成"大屏窄、小屏宽"的怪比例。代价是滑到中间时广告会浮在
     左侧那张半透明卡上方（原生广告层本就在 canvas 之上），这是刻意的取舍。
     top 与当前卡顶对齐，视觉上与卡片平齐；高度由广告模板自己决定。 */
  G.summonAdRect = () => {
    if (!G.ad || !G.ad.fit) return null;
    const L = summonLayout();
    if (!L.land) return null;
    const left = L.safe.left + 14;
    const right = L.cx0 - L.CW / 2 - 14;          // 当前卡左缘 − 呼吸
    const width = Math.min(260, Math.floor(right - left));
    if (width < 120) return null;                 // 留白太窄：这条广告不出，宁可空着
    return G.ad.fit([{ left: left, top: L.cy0 - L.CH / 2, width: width, height: 110 }], {
      pad: 8,
      /* 只避当前卡：左侧那张半透明卡是刻意的遮挡（见上），不进 avoid */
      avoid: [{ left: L.cx0 - L.CW / 2, top: L.cy0 - L.CH / 2, width: L.CW, height: L.CH }]
    });
  };

  /* 原生模板广告位（由 ad.js 读取）：二级卡页横屏「贴顶靠右」窄卡。
     与首页横屏同一条基线：上缘贴安全区顶部（留 8px 呼吸），右缘止于微信胶囊左侧——
     这样广告与胶囊水平不相交，ad.fit 不会因撞胶囊把它自动挪到胶囊下方。
     浮卡原则：只遮挡不改版式，卡片区不进 avoid；仍避底部设置面板。
     竖屏主卡几乎占满屏宽、顶部无干净留白 → 返回 null 不出。 */
  G.bgpickAdRect = () => {
    if (!G.ad || !G.ad.fit) return null;
    const { W, H, land, safe, menu } = layout();
    if (!land) return null;
    const k = Math.max(.78, Math.min(1.12, Math.min(H / 431, W / 765)));
    const F = n => Math.max(1, Math.round(n * k));
    const panelH = F(94), panelY = H - safe.bottom - F(10) - panelH;
    const h = Number(G.bgpickAdMeasuredH) || 110;
    const top = Math.round(safe.top + 8);
    const rightLimit = Math.floor((menu ? menu.left : W - safe.right) - 8);  // 右缘贴胶囊左侧
    const width = Math.max(120, Math.min(160, Math.round(rightLimit - safe.left - 16)));
    const left = rightLimit - width;
    if (width < 120 || left < safe.left || top + h > panelY - 6) return null;
    return G.ad.fit([{ left: left, top: top, width: width, height: h }], {
      pad: 8,
      avoid: [
        { left: 0, top: panelY, width: W, height: H - panelY }  // 底部设置面板
      ]
    });
  };

  /* 原生模板广告位（由 ad.js 读取）：只落在结算页竖屏的"标题 ↔ 数据卡"窄带里，
     整条位于四按钮（2×2 网格，by1/by4）与数据卡上方，不压任何按钮与数据。
     带子太窄（卡片被推得靠上、留白不足）时返回 null，静默跳过。 */
  G.resultAdRect = () => {
    if (!G.ad || !G.ad.fit) return null;
    const { W, H, land, safe } = layout();
    const innerH = H - safe.top - safe.bottom;
    const h = Number(G.resultAdMeasuredH) || 96;   // 实测高度回传前的估算
    if (land) {
      /* 横屏：左上角留白——返回键下方、居中标题左侧、数据卡上方那块空地（用户标注的落点）。
         标题与模式标签都居中（centerX），不占左缘；数据卡整行在 cardY 以下，广告下缘留 8px。 */
      const navBottom = safe.top + 10 + 34 + 8;            // 返回胶囊下沿 + 呼吸
      const titleTop = safe.top + Math.max(60, Math.min(78, innerH * 0.10));
      const cardY = titleTop + 88 + Math.max(16, (H - safe.bottom - 64 - 18 - (titleTop + 88) - 78) / 2);
      const left = Math.ceil(safe.left + 12);
      const top = Math.ceil(navBottom);
      const width = Math.min(200, Math.round(W * 0.25));
      const maxH = cardY - top - 8;
      if (width < 120 || maxH < 60) return null;
      const height = Math.min(h, maxH);
      return G.ad.fit([{ left: left, top: top, width: width, height: height }], {
        pad: 8,
        avoid: [
          { left: 0, top: 0, width: W, height: navBottom - 4 },    // 返回键 + 顶部
          { left: 0, top: cardY, width: W, height: H - cardY }     // 数据卡 + 按钮整块
        ]
      });
    }
    const left = 24;
    const top = safe.top + innerH * 0.15 + 52;   // 描述行（标题 +38，约 14px）之下
    const width = Math.min(W - left - safe.right - 24, 320);
    const bh2 = 54;
    const btnTop = H - safe.bottom - 26 - 2 * (bh2 + 14);   // 2×2 网格上沿
    const height = btnTop - top - 8;             // 距按钮留 8
    if (width < 160 || height < 84) return null; // 留白太窄不出
    return G.ad.fit([{ left: left, top: top, width: width, height: height }], {
      pad: 10,
      avoid: [{ left: 0, top: btnTop, width: W, height: H - btnTop }]   // 2×2 按钮网格
    });
  };
};
