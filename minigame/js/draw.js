/* draw.js — 矢量精灵绘制（Canvas 路径版，替代原型 SVG/CSS） */
module.exports = function (G) {
  const D = {};

  /* ---------- 鱼（设计空间 120×72，中心 60,36） ---------- */
  D.fish = (ctx, p, t) => {
    const sp = p.species || {};
    const c = p.speciesColors || sp.variants && sp.variants[0] || sp;
    if (sp.shape === "shark")  return D.shark(ctx, p, c, t);
    if (sp.shape === "ray")    return D.ray(ctx, p, c, t);
    if (sp.shape === "puffer") return D.puffer(ctx, p, c, t);
    if (sp.shape === "whale")  return D.whale(ctx, p, c, t);
    if (sp.shape === "turtle") return D.turtle(ctx, p, c, t);
    const wag = Math.sin(t * Math.PI * 2 / Math.max(p.wagDur || 0.5, 0.08) + p.phase) * 0.35;
    // 尾
    ctx.save();
    ctx.translate(30, 36); ctx.rotate(wag);
    ctx.fillStyle = c.fin;
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-26, -22); ctx.lineTo(-19, 0); ctx.lineTo(-26, 22); ctx.closePath(); ctx.fill();
    ctx.restore();
    // 身体
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.ellipse(64, 36, 42, 24, 0, 0, Math.PI * 2); ctx.fill();
    // 腹部受光
    ctx.fillStyle = c.belly; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.ellipse(66, 44, 30, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // 斑纹（裁剪到身体）
    if (c.pattern === "spots") {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(64, 36, 42, 24, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = c.accent; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(52, 30, 10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(86, 44, 9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(40, 46, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (c.pattern === "stripes") {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(64, 36, 42, 24, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = c.accent; ctx.globalAlpha = 0.75;
      ctx.fillRect(46, 8, 8, 56);
      ctx.fillRect(66, 8, 8, 56);
      ctx.restore();
    }
    // 背鳍 / 臀鳍
    ctx.fillStyle = c.fin;
    ctx.beginPath(); ctx.moveTo(52, 14); ctx.quadraticCurveTo(66, 0, 80, 14); ctx.quadraticCurveTo(66, 18, 52, 14); ctx.fill();
    ctx.beginPath(); ctx.moveTo(58, 58); ctx.quadraticCurveTo(68, 70, 80, 58); ctx.quadraticCurveTo(68, 61, 58, 58); ctx.fill();
    // 鳃线
    ctx.strokeStyle = c.accent; ctx.lineWidth = 3.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(70, 33); ctx.quadraticCurveTo(81, 41.5, 70, 50.5); ctx.stroke();
    // 眼
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(90, 30, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#17323b"; ctx.beginPath(); ctx.arc(92, 30, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(93.2, 28.6, 1.1, 0, Math.PI * 2); ctx.fill();
    // 嘴
    ctx.strokeStyle = c.accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(103, 41); ctx.quadraticCurveTo(107, 44, 111, 41); ctx.stroke();
  };

  /* ---------- 鲨鱼（灰色鱼雷体 + 新月尾 + 大背鳍 + 鳃裂露齿） ---------- */
  D.shark = (ctx, p, c, t) => {
    const wag = Math.sin(t * Math.PI * 2 / Math.max(p.wagDur || 0.5, 0.08) + p.phase) * 0.26;
    // 新月形尾鳍
    ctx.save();
    ctx.translate(30, 36); ctx.rotate(wag);
    ctx.fillStyle = c.fin;
    ctx.beginPath();
    ctx.moveTo(8, 0); ctx.lineTo(-24, -25); ctx.quadraticCurveTo(-12, -7, -13, 0);
    ctx.lineTo(-24, 25); ctx.closePath(); ctx.fill();
    ctx.restore();
    // 鱼雷形身体（吻部尖）
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.moveTo(113, 36);
    ctx.quadraticCurveTo(96, 17, 64, 17);
    ctx.quadraticCurveTo(32, 18, 24, 36);
    ctx.quadraticCurveTo(32, 54, 64, 55);
    ctx.quadraticCurveTo(96, 55, 113, 36);
    ctx.closePath(); ctx.fill();
    // 腹部受光
    ctx.fillStyle = c.belly; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(66, 48, 36, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // 大背鳍 + 第二背鳍
    ctx.fillStyle = c.fin;
    ctx.beginPath(); ctx.moveTo(50, 18); ctx.quadraticCurveTo(60, -4, 82, 16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(30, 21); ctx.quadraticCurveTo(34, 11, 44, 20); ctx.closePath(); ctx.fill();
    // 胸鳍
    ctx.beginPath(); ctx.moveTo(66, 48); ctx.quadraticCurveTo(60, 66, 42, 64); ctx.quadraticCurveTo(54, 55, 58, 46); ctx.closePath(); ctx.fill();
    // 鳃裂 3 道
    ctx.strokeStyle = c.accent; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(76 + i * 7, 28); ctx.quadraticCurveTo(80 + i * 7, 36, 76 + i * 7, 44); ctx.stroke();
    }
    // 眼（小而凶）
    ctx.fillStyle = "#17323b"; ctx.beginPath(); ctx.arc(98, 30, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(99.4, 28.6, 1.2, 0, Math.PI * 2); ctx.fill();
    // 微张的嘴 + 一排小白牙
    ctx.strokeStyle = c.accent; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(110, 41); ctx.quadraticCurveTo(101, 48, 90, 46); ctx.stroke();
    ctx.fillStyle = "#fff";
    [[106, 43.6], [102, 45.6], [98, 46.6], [94, 46.7]].forEach(([tx, ty]) => {
      ctx.beginPath(); ctx.moveTo(tx - 2, ty - 1.4); ctx.lineTo(tx, ty + 3.4); ctx.lineTo(tx + 2, ty - 1.4); ctx.closePath(); ctx.fill();
    });
  };

  /* ---------- 魔鬼鱼（菱形展翼 + 扇动 + 鞭尾，头端朝右） ---------- */
  D.ray = (ctx, p, c, t) => {
    // 翼面开合比例（0.44 收拢 ~ 1 全展）
    const flap = 0.72 + 0.28 * Math.sin(t * Math.PI * 2 / 0.9 + p.phase);
    const pinch = 1 - flap;
    // 细长鞭尾（随游摆动）
    ctx.strokeStyle = c.fin; ctx.lineWidth = 3; ctx.lineCap = "round";
    const tw = Math.sin(t * 3 + p.phase) * 6;
    ctx.beginPath(); ctx.moveTo(30, 36);
    ctx.quadraticCurveTo(10, 36 + tw, -2, 32 + tw * 1.6); ctx.stroke();
    // 菱形展翼体
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.moveTo(112, 36);
    ctx.quadraticCurveTo(84, 14 + 14 * pinch, 58, 36 - 32 * flap);
    ctx.quadraticCurveTo(30, 24 + 8 * pinch, 18, 36);
    ctx.quadraticCurveTo(30, 48 - 8 * pinch, 58, 36 + 32 * flap);
    ctx.quadraticCurveTo(84, 58 - 14 * pinch, 112, 36);
    ctx.closePath(); ctx.fill();
    // 中央腹面高光
    ctx.fillStyle = c.belly; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.ellipse(64, 36, 30, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // 翼缘描线（两条曲线随扇动）
    ctx.strokeStyle = c.accent; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(96, 30 - 8 * pinch);
    ctx.quadraticCurveTo(74, 18 + 10 * pinch, 58, 36 - 32 * flap);
    ctx.moveTo(96, 42 + 8 * pinch);
    ctx.quadraticCurveTo(74, 54 - 10 * pinch, 58, 36 + 32 * flap);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // 头部双眼（背位）
    ctx.fillStyle = "#17323b";
    ctx.beginPath(); ctx.arc(97, 27, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(97, 45, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(98.2, 25.9, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(98.2, 43.9, 1.1, 0, Math.PI * 2); ctx.fill();
    // 鳃孔 3 道
    ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(72 + i * 6, 31); ctx.lineTo(72 + i * 6, 41); ctx.stroke();
    }
    // 吻部小鳍（头鳍）
    ctx.fillStyle = c.fin;
    ctx.beginPath(); ctx.moveTo(104, 32); ctx.quadraticCurveTo(114, 33, 112, 36); ctx.quadraticCurveTo(114, 39, 104, 40); ctx.closePath(); ctx.fill();
  };

  /* ---------- 河豚（圆身 + 尖刺 + 呼吸鼓胀 + 嘟嘴） ---------- */
  D.puffer = (ctx, p, c, t) => {
    const puff = 1 + 0.045 * Math.sin(t * 2.2 + p.phase);   // 呼吸鼓胀
    const cx = 62, cy = 36, R = 25 * puff;
    // 小扇形尾
    ctx.save();
    ctx.translate(38, 36);
    ctx.rotate(Math.sin(t * Math.PI * 2 / Math.max(p.wagDur || 0.5, 0.08) + p.phase) * 0.3);
    ctx.fillStyle = c.fin;
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-13, -11); ctx.lineTo(-9, 0); ctx.lineTo(-13, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
    // 尖刺一圈（身体后面）
    ctx.fillStyle = c.accent;
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + 0.31;
      const x1 = cx + Math.cos(a) * (R - 1), y1 = cy + Math.sin(a) * (R - 1);
      const x2 = cx + Math.cos(a) * (R + 7), y2 = cy + Math.sin(a) * (R + 7);
      const px = -Math.sin(a), py = Math.cos(a);
      ctx.beginPath();
      ctx.moveTo(x1 + px * 3, y1 + py * 3); ctx.lineTo(x2, y2); ctx.lineTo(x1 - px * 3, y1 - py * 3);
      ctx.closePath(); ctx.fill();
    }
    // 圆身
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    // 肚皮
    ctx.fillStyle = c.belly;
    ctx.beginPath(); ctx.ellipse(cx + 4, cy + 12, R * 0.7, R * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    // 斑点（裁剪到身体）
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = c.accent; ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.arc(48, 22, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(70, 42, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(44, 45, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 胸鳍（小扑扇）
    ctx.save(); ctx.translate(56, 43); ctx.rotate(Math.sin(t * 6 + p.phase) * 0.35);
    ctx.fillStyle = c.fin;
    ctx.beginPath(); ctx.ellipse(0, 6, 4.5, 9, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 突出的大眼
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(80, 27, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#17323b"; ctx.beginPath(); ctx.arc(82, 27, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(83.5, 25.4, 1.4, 0, Math.PI * 2); ctx.fill();
    // 嘟嘴（O 形小嘴）
    ctx.strokeStyle = c.accent; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(89, 40, 3.2, 0, Math.PI * 2); ctx.stroke();
  };

  /* ---------- 老鼠（设计空间 120×78，面向右；花色 variants 参数化） ---------- */
  D.mouse = (ctx, p, t) => {
    const v = p.mouseVar || G.MOUSE_VARIANTS[0];
    const sniff = Math.sin(t * 9 + p.phase) * 1.4;
    // 尾（锥形曲线，随跑动摆动；环节阴影）
    ctx.strokeStyle = v.tail; ctx.lineWidth = 5; ctx.lineCap = "round";
    const tw = p.state === "dart" ? Math.sin(t * 22) * 8 : Math.sin(t * 2.4 + p.phase) * 5;
    ctx.beginPath(); ctx.moveTo(30, 50);
    ctx.bezierCurveTo(14, 46 + tw * 0.4, 4, 52 + tw, 6, 62);
    ctx.stroke();
    ctx.strokeStyle = v.tailRing; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(9, 56); ctx.lineTo(12.4, 54.4); ctx.moveTo(8, 60); ctx.lineTo(11.6, 59.6);
    ctx.moveTo(13.5, 52.6); ctx.lineTo(16.6, 51.8); ctx.stroke();
    // 远耳（耳廓 + 内耳）
    ctx.fillStyle = v.earFar; ctx.beginPath(); ctx.arc(76, 17.5, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = v.earIn; ctx.beginPath(); ctx.arc(76, 17.5, 5.4, 0, Math.PI * 2); ctx.fill();
    // 躯干（梨形渐变：背深腹浅）
    const grad = ctx.createLinearGradient(0, 18, 0, 72);
    grad.addColorStop(0, v.back); grad.addColorStop(0.55, v.mid); grad.addColorStop(1, v.belly);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(111, 44);
    ctx.bezierCurveTo(107, 35, 98, 29.5, 88, 28);
    ctx.bezierCurveTo(83, 19, 68, 15.5, 56, 20);
    ctx.bezierCurveTo(40, 26, 27, 36, 26, 49);
    ctx.bezierCurveTo(25.5, 60, 35, 68.5, 50, 69.5);
    ctx.bezierCurveTo(65, 70.5, 76, 67, 83, 60);
    ctx.bezierCurveTo(93, 57, 105, 52, 111, 44);
    ctx.closePath(); ctx.fill();
    // 后躯阴影 + 腹部受光 + 颊部过渡
    ctx.fillStyle = v.haunch; ctx.beginPath(); ctx.ellipse(43, 52, 16, 12.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = v.sheen; ctx.beginPath(); ctx.ellipse(67, 58.5, 20, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(60,48,38,.1)"; ctx.beginPath(); ctx.ellipse(90, 44, 8.5, 7.5, 0.5, 0, Math.PI * 2); ctx.fill();
    // 背毛毛流（背脊两道 + 后躯三道，顺毛方向）
    ctx.strokeStyle = v.fur; ctx.lineWidth = 1.1; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(40, 30); ctx.quadraticCurveTo(48, 26, 57, 25);
    ctx.moveTo(34, 37); ctx.quadraticCurveTo(41, 33, 48, 31);
    ctx.moveTo(53, 26); ctx.quadraticCurveTo(59, 24, 65, 24);
    ctx.moveTo(31, 45); ctx.quadraticCurveTo(38, 42.5, 44, 41.5);
    ctx.moveTo(38, 52); ctx.quadraticCurveTo(45, 50, 51, 49.5);
    ctx.moveTo(72, 24); ctx.quadraticCurveTo(78, 23.5, 83, 24.5); ctx.stroke();
    // 近耳（耳廓 + 内耳 + 顶缘高光 + 耳根投影）
    ctx.fillStyle = "rgba(60,48,38,.16)"; ctx.beginPath(); ctx.ellipse(90, 26.5, 9, 3.2, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = v.ear; ctx.beginPath(); ctx.arc(92, 17, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = v.earIn; ctx.beginPath(); ctx.arc(92, 16.5, 6.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = v.earRim; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(92, 17, 9, Math.PI * 1.08, Math.PI * 1.85); ctx.stroke();
    // 珠状眼（眼眶 + 双高光）
    ctx.fillStyle = v.eyeRim; ctx.beginPath(); ctx.arc(98.8, 37, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = v.eye; ctx.beginPath(); ctx.arc(99, 37, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(100.3, 35.8, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.arc(97.7, 38.6, 0.8, 0, Math.PI * 2); ctx.fill();
    // 吻部（鼻尖嗅探微动 + 胡须三根）
    ctx.save(); ctx.translate(111.6, 43.6 + sniff * 0.4);
    ctx.strokeStyle = "rgba(90,64,50,.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-3, 0.4); ctx.quadraticCurveTo(-5.4, 2.3, -7.6, 1.4); ctx.stroke();
    ctx.fillStyle = v.nose; ctx.beginPath(); ctx.ellipse(0, 0, 2.7, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(-0.7, -0.7, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(238,228,212,.78)"; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(0, 1.4); ctx.lineTo(-13.6, -1.1);
    ctx.moveTo(0, 2.4); ctx.lineTo(-13.1, 3.2);
    ctx.moveTo(0.2, 3.4); ctx.lineTo(-11.1, 6.9); ctx.stroke();
    ctx.restore();
    // 前爪（三趾）+ 后足
    ctx.fillStyle = v.paw; ctx.beginPath(); ctx.ellipse(86.5, 63.5, 4.8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(118,98,78,.42)"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(84.8, 61.5); ctx.lineTo(84.8, 64.9); ctx.moveTo(87.6, 61.3); ctx.lineTo(87.6, 64.9); ctx.stroke();
    ctx.fillStyle = v.foot; ctx.beginPath(); ctx.ellipse(47, 68, 6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  };

  /* ---------- 鲸鱼（圆钝巨头 + 横向双叶尾鳍 + 喉腹褶，头端朝右） ---------- */
  D.whale = (ctx, p, c, t) => {
    const wag = Math.sin(t * Math.PI * 2 / Math.max(p.wagDur || 0.5, 0.08) + p.phase) * 0.2;
    // 水平尾鳍（鲸类横尾：上下双叶，随游缓摆）
    ctx.save();
    ctx.translate(32, 36); ctx.rotate(wag);
    ctx.fillStyle = c.fin;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.quadraticCurveTo(-2, -10, -24, -24);
    ctx.quadraticCurveTo(-12, -6, -9, 0);
    ctx.quadraticCurveTo(-12, 6, -24, 24);
    ctx.quadraticCurveTo(-2, 10, 8, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // 身体（圆钝巨头 + 渐细尾柄）
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.moveTo(114, 36);
    ctx.bezierCurveTo(113, 21, 94, 12.5, 70, 14);
    ctx.bezierCurveTo(48, 15.5, 31, 26, 28, 36);
    ctx.bezierCurveTo(31, 47, 52, 57.5, 74, 56.5);
    ctx.bezierCurveTo(96, 55.5, 112, 49, 114, 36);
    ctx.closePath(); ctx.fill();
    // 腹部受光 + 喉腹褶（须鲸腹沟 4 道）
    ctx.fillStyle = c.belly; ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.ellipse(82, 50, 30, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c.accent; ctx.lineWidth = 1.5; ctx.lineCap = "round"; ctx.globalAlpha = 0.45;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(110 - i * 1.5, 42 + i * 2.6);
      ctx.quadraticCurveTo(94, 46 + i * 3.4, 76 - i * 5, 45 + i * 3.8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 小镰刀背鳍
    ctx.fillStyle = c.fin;
    ctx.beginPath(); ctx.moveTo(52, 16); ctx.quadraticCurveTo(58, 6, 68, 14.5); ctx.closePath(); ctx.fill();
    // 长桨形胸鳍
    ctx.beginPath();
    ctx.moveTo(78, 52); ctx.quadraticCurveTo(68, 66, 52, 66);
    ctx.quadraticCurveTo(62, 58, 68, 50); ctx.closePath(); ctx.fill();
    // 眼（小而温和）+ 长弧嘴线 + 喷气孔
    ctx.fillStyle = "#17323b"; ctx.beginPath(); ctx.arc(96, 27, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(97.2, 25.9, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c.accent; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(113, 41); ctx.quadraticCurveTo(100, 46, 88, 44); ctx.stroke();
    ctx.fillStyle = c.accent;
    ctx.beginPath(); ctx.ellipse(104, 16.5, 2.2, 1.3, -0.3, 0, Math.PI * 2); ctx.fill();
  };

  /* ---------- 乌龟（椭圆甲壳 + 盾片刻线 + 划水鳍肢，头端朝右） ---------- */
  D.turtle = (ctx, p, c, t) => {
    const pad = Math.sin(t * Math.PI * 2 / 1.4 + p.phase) * 0.32;   // 鳍肢划水
    // 远侧前鳍（壳后上方）
    ctx.save(); ctx.translate(72, 22); ctx.rotate(-0.5 - pad);
    ctx.fillStyle = c.fin;
    ctx.beginPath(); ctx.ellipse(-2, -8, 5.5, 13, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 后鳍 + 小尾
    ctx.fillStyle = c.fin;
    ctx.save(); ctx.translate(24, 50); ctx.rotate(0.4 + pad * 0.6);
    ctx.beginPath(); ctx.ellipse(0, 4, 4.5, 9, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(17, 40); ctx.quadraticCurveTo(10, 42, 12, 46);
    ctx.quadraticCurveTo(17, 45, 20, 43); ctx.closePath(); ctx.fill();
    // 头（从壳前沿伸出；先画头再盖壳根，衔接自然）
    ctx.fillStyle = c.fin;
    ctx.beginPath(); ctx.ellipse(104, 36, 11, 9.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.belly; ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.ellipse(105, 40, 7.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // 眼 + 眼后色斑（红耳龟为标志性红斑，绿海龟呈深色条）
    ctx.fillStyle = "#1c2b22"; ctx.beginPath(); ctx.arc(107.5, 33, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(108.4, 32.2, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.accent; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(101.5, 35.5, 2.6, 3.4, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // 嘴线
    ctx.strokeStyle = c.accent; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(112.5, 38.5); ctx.quadraticCurveTo(109, 40.5, 105.5, 40); ctx.stroke();
    // 甲壳（外缘环带 + 内部盾片刻线）
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.ellipse(54, 36, 41, 24.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.belly; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.ellipse(54, 51.5, 37, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // 盾片：中央一列三块 + 两侧斜块 + 放射线
    ctx.save();
    ctx.beginPath(); ctx.ellipse(54, 36, 38, 21.5, 0, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = c.accent; ctx.lineWidth = 1.7; ctx.globalAlpha = 0.55;
    const hex = (hx, hy, r) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 * (i * 2 + 1);
        const px = hx + Math.cos(a) * r, py = hy + Math.sin(a) * r * 0.72;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    };
    hex(38, 36, 12); hex(58, 36, 12); hex(78, 36, 11);
    hex(30, 24, 9); hex(52, 23, 9); hex(74, 25, 9);
    hex(30, 48, 9); hex(52, 49, 9); hex(74, 47, 9);
    ctx.beginPath();
    ctx.moveTo(20, 30); ctx.lineTo(30, 36); ctx.moveTo(18, 44); ctx.lineTo(30, 48);
    ctx.moveTo(90, 42); ctx.lineTo(80, 38); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    // 甲壳前缘高光
    ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(54, 36, 36, Math.PI * 1.15, Math.PI * 1.6); ctx.stroke();
    // 近侧前鳍（壳下前方，划水）
    ctx.save(); ctx.translate(80, 54); ctx.rotate(pad);
    ctx.fillStyle = c.fin;
    ctx.beginPath(); ctx.ellipse(2, 8, 6, 14, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- 蝴蝶（设计空间 120×104，身体中心 60,56；花色 bflyVar 参数化） ----------
     HD 皮肤：text-to-3D 生成帝王蝶 GLB → three.js 正俯视烘焙(360×336, 3x) → 按身体中线切半，
     左右翼绕体轴 scaleX 压缩翻翅（ws 与矢量版共用同一状态机），叠压暗版模拟收翅受光；
     花色 = 烘焙图色相旋转预生成；贴图未加载时回退矢量绘制。 */
  const BFHD = { tried: false, map: null };
  D.initBflyHD = () => {
    if (BFHD.tried) return;
    BFHD.tried = true;
    const g = typeof globalThis !== "undefined" ? globalThis : {};
    const conf = g.__HD_BFLY || {};
    const items = conf.map || {};
    const prefix = conf.prefix != null ? conf.prefix : "assets/";
    const keys = ["sulawesi", "morpho", "graphium", "cabbage", "monarch", "violet"];
    BFHD.map = {};
    keys.forEach((k) => {
      const sfx = k === "monarch" ? "" : "-" + k;
      const src = items[k] || { n: prefix + "bfly-hd" + sfx + ".png", d: prefix + "bfly-hd" + sfx + "-dim.png" };
      const slot = { n: null, d: null, nOk: false, dOk: false };
      BFHD.map[k] = slot;
      [["n", src.n], ["d", src.d]].forEach(([key, url]) => {
        try {
          const img = (typeof wx !== "undefined" && wx.createImage) ? wx.createImage() : new Image();
          img.onload = () => { slot[key === "n" ? "nOk" : "dOk"] = true; };
          img.src = url;
          slot[key] = img;
        } catch (e) {}
      });
    });
  };
  /* HD 绘制：贴图 360×336 ↔ 设计空间 120×112（3x），pivot(60,56)=身体中心，源图半宽 bh=10px
     贴图本身已含左右翼朝向 → 双翼共用正向 scale(ws,1) 绕体轴压缩，切勿镜像 */
  D.bflyHDBlit = (ctx, ws, vd) => {
    D.bflyHDAssets = BFHD;               // 测试钩子：状态对照页直接取贴图
    const half = 180, bh = 10, dw = 60, dh = 112, dbs = bh / 3;
    ctx.save();
    ctx.translate(60, 56);
    ctx.save(); ctx.scale(ws, 1);                                  // 双翼绕体轴压缩
    ctx.drawImage(vd.n, half, 0, half, 336, 0, 0, dw, dh);         // 右翼（体线右侧）
    ctx.drawImage(vd.n, 0, 0, half, 336, -dw, 0, dw, dh);          // 左翼（体线左侧）
    const dark = (1 - ws) * 0.85;                                  // 收翅受光变暗
    if (dark > 0.03) {
      ctx.globalAlpha = dark;
      ctx.drawImage(vd.d, half, 0, half, 336, 0, 0, dw, dh);
      ctx.drawImage(vd.d, 0, 0, half, 336, -dw, 0, dw, dh);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.drawImage(vd.n, half - bh, 0, bh * 2, 336, -dbs, 0, dbs * 2, dh);   // 身体条不压缩
    ctx.restore();
  };
  D.butterfly = (ctx, p, t) => {
    const v = p.bflyVar || { fore: "#ffc63e", fore2: "#ffd76a", hind: "#ff9d42", hind2: "#ffb257", body: "#5a4632" };
    // 翅面开合比例：0=合拢 1=全展（模拟绕身体轴的扇翅）——矢量/HD 皮肤共用
    let ws = 1, lower = 1;
    if (p.state === "RESTING") { ws = 0.12; lower = 0.08; }        // 停花：立翅合拢
    else if (p.state === "HOVER") ws = 0.3 + 0.7 * Math.abs(Math.sin(t * Math.PI * 2 / 0.18 + p.phase));
    else if (p.state === "GLIDE") ws = 0.92 + 0.08 * Math.sin(t * 6 + p.phase);   // 滑翔：全展微颤
    else if (p.state === "TAKEOFF" || p.state === "STARTLED") ws = 0.2 + 0.8 * Math.abs(Math.sin(t * Math.PI * 2 / 0.12));
    else ws = 0.25 + 0.75 * Math.abs(Math.sin(t * Math.PI * 2 / (p.flapDur || 0.28) + p.phase));   // FLAP/LANDING
    if (!BFHD.tried) D.initBflyHD();
    const vd = BFHD.map && BFHD.map[(p.bflyVar && p.bflyVar.key) || "monarch"];
    if (vd && vd.nOk && vd.dOk) { D.bflyHDBlit(ctx, ws, vd); return; }
    const edge = v.edge || null;
    // 单翅绘制（fill + 可选深色翅缘）
    const wing = (fill, cx, cy, rx, ry, rot, sx, sy) => {
      ctx.save(); ctx.translate(60, 56); ctx.scale(sx, sy);
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
      if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.restore();
    };
    // 后翅（左暗右亮）
    wing(v.hind, -16, 16, 18, 15, -0.15, ws * 0.95, lower);
    wing(v.hind2, 16, 16, 18, 15, 0.15, ws * 0.95, lower);
    // 前翅（左暗右亮）
    wing(v.fore, -24, -20, 27, 23, -0.12, ws, 1);
    wing(v.fore2, 24, -20, 27, 23, 0.12, ws, 1);
    // 翅斑高光
    ctx.save(); ctx.translate(60, 56); ctx.scale(ws, 1);
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath(); ctx.ellipse(-26, -22, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(26, -22, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 身体 + 触角
    ctx.fillStyle = v.body;
    ctx.beginPath(); ctx.ellipse(60, 56, 7, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = v.body; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(56, 34); ctx.quadraticCurveTo(50, 22, 44, 18);
    ctx.moveTo(64, 34); ctx.quadraticCurveTo(70, 22, 76, 18); ctx.stroke();
  };

  /* ---------- 激光光点（原版红色外观，仅增强亮度） ---------- */
  D.laser = (ctx, p, t) => {
    const panic = G.session.combo >= 5;
    const hold = p.state === "hold";
    const pulse = 0.85 + 0.33 * (0.5 + 0.5 * Math.sin(t * (hold ? 7 : 13)));
    let r = (p.sc || 1) * 13 * pulse;
    if (panic) r *= 0.9 + 0.2 * Math.sin(t * 40);
    // 柔光晕（原版 .5 → 提亮至 .8，半径 2.4 → 3）
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3);
    glow.addColorStop(0, "rgba(255,70,70,.8)");
    glow.addColorStop(0.5, "rgba(255,30,30,.28)");
    glow.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, r * 3, 0, Math.PI * 2); ctx.fill();
    // 核心光点（白热区扩大：0.32 → 0.5，中段提亮至 .8）
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.5, panic ? "#ff9a7a" : "#ff7a7a");
    core.addColorStop(0.72, "rgba(255,50,50,.8)");
    core.addColorStop(0.88, "rgba(255,0,0,0)");
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // 停留外圈：主要命中窗口的视觉暗示（原版 .4 → .7）
    if (hold) {
      ctx.strokeStyle = "rgba(255,130,130,.7)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.7 + Math.sin(t * 7) * 3, 0, Math.PI * 2); ctx.stroke();
    }
  };

  /* ---------- 老鼠洞（60×40，碎边 + 渐深 + 抓痕） ---------- */
  D.hole = (ctx, x, y) => {
    ctx.save();
    ctx.translate(x, y);
    // 碎边外圈
    ctx.fillStyle = "#463525";
    ctx.beginPath();
    ctx.moveTo(-29, 15);
    ctx.quadraticCurveTo(-26, 6, -20, 3); ctx.quadraticCurveTo(-22, -3, -16, -5);
    ctx.quadraticCurveTo(-17, -11, -10, -9); ctx.quadraticCurveTo(-6, -16, 1, -12);
    ctx.quadraticCurveTo(9, -16, 12, -9); ctx.quadraticCurveTo(20, -11, 18, -3);
    ctx.quadraticCurveTo(26, -1, 23, 6); ctx.quadraticCurveTo(28, 10, 24, 15);
    ctx.closePath(); ctx.fill();
    // 内部渐深（椭圆裁剪 + 径向渐变）
    ctx.beginPath(); ctx.ellipse(0, 2, 22, 13, 0, 0, Math.PI * 2);
    ctx.save(); ctx.clip();
    const g = ctx.createRadialGradient(0, 8, 2, 0, 6, 24);
    g.addColorStop(0, "#060302"); g.addColorStop(0.6, "#150d07"); g.addColorStop(1, "#2b1f14");
    ctx.scale(1, 13 / 24); ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 6, 24, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 抓痕
    ctx.strokeStyle = "rgba(96,70,44,.5)"; ctx.lineWidth = 1.3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-22, 12); ctx.quadraticCurveTo(-26, 8, -27, 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, 11); ctx.quadraticCurveTo(24, 8, 25, 4); ctx.stroke();
    ctx.restore();
  };

  /* ---------- 首页卡片图标（简化 sprite） ---------- */
  D.icon = (ctx, type, x, y, s) => {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    if (type === "fish") {
      ctx.translate(-60, -36); ctx.globalAlpha = 1;
      const goldSp = G.FISH_SPECIES.find(s => s.key === "gold") || G.FISH_SPECIES[0];
      const fake = { species: goldSp, wagDur: 0.5, phase: 0, state: "FLAP" };
      D.fish(ctx, fake, 1.2);
    } else if (type === "butterfly") {
      ctx.translate(-60, -52);
      const fake = { state: "GLIDE", flapDur: 0.28, phase: 0 };
      D.butterfly(ctx, fake, 0.3);
    } else if (type === "mouse") {
      ctx.translate(-60, -44);
      const fake = { state: "peek", phase: 0 };
      D.mouse(ctx, fake, 0);
    } else if (type === "laser") {
      const fake = { state: "hold", sc: 1 };
      D.laser(ctx, fake, 0.6);
    }
    ctx.restore();
  };

  G.draw = D;
};
