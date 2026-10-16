/* scenery.js — 四套布景（海底/花园/室内/暗室）+ 粒子特效系统 */
module.exports = function (G) {
  const rand = G.rand;
  G.scene = { type: null };
  G.gardenFlowers = [];   // 供蝴蝶降落的花（{x,y,color,nudgeT}）

  /* ================= 布景构建 ================= */
  G.buildScene = (type) => {
    const W = G.platform.W, H = G.platform.H;
    const S = { type, W, H, floorY: H * 0.68, holes: [], holeOwners: [], holeHeat: [], dark: type === "laser" };
    G.scene = S;
    G.gardenFlowers = [];

    if (type === "mouse" || type === "laser") {
      // 窗户（光柱）
      S.winW = Math.min(118, W * 0.3); S.winH = S.winW * 1.25;
      S.winX = W * rand(0.52, 0.62); S.winY = Math.max(30, S.floorY * rand(0.10, 0.2));
      // 家具（2~3 件，沿墙随机）
      const kinds = ["sofa", "shelf", "plant", "lamp"];
      S.furn = [];
      const n = Math.floor(rand(2, 3.99));
      for (let i = 0; i < n; i++) S.furn.push({ kind: kinds[Math.floor(rand(0, kinds.length))], x: rand(0.04, 0.9) * W, s: rand(0.85, 1.1) });
      S.rugW = W * rand(0.36, 0.46);
      S.rugX = W * rand(0.1, 0.9) - S.rugW / 2;
    }
    if (type === "mouse") {
      // 两排交错老鼠洞（6~8 个）：后排贴墙脚、前排地板前缘
      const holeN = Math.floor(rand(6, 8.99));
      const step = 70 / (holeN - 1);
      for (let i = 0; i < holeN; i++) {
        const pct = 15 + step * i + rand(-1.5, 1.5);
        const row = i % 2;
        S.holes.push({ x: W * pct / 100, y: S.floorY + 26 + row * 46 });
      }
      S.holeOwners = new Array(holeN).fill(null);
      S.holeHeat = S.holes.map(() => []);
    }
    if (type === "butterfly") {
      // 前景大花：蝴蝶降落目标（5~7 朵，分布在下 1/3）
      const flowerColors = [
        { petal: "#f6a8c0", heart: "#ffd45e" },
        { petal: "#ffffff", heart: "#ffb02e" },
        { petal: "#ffd94d", heart: "#e88a2a" },
        { petal: "#c39be0", heart: "#ffd45e" }
      ];
      const n = Math.floor(rand(5, 7.99));
      for (let i = 0; i < n; i++) {
        const fx = (i + rand(0.15, 0.85)) / n;
        const c = flowerColors[Math.floor(rand(0, flowerColors.length))];
        const f = {
          x: W * fx, y: H * rand(0.64, 0.74), color: c,
          r: rand(13, 20), nudgeT: 0, swayPh: rand(0, Math.PI * 2)
        };
        S.flowers = S.flowers || []; S.flowers.push(f);
        G.gardenFlowers.push(f);
      }
      // 远景花带点缀
      S.backDots = [];
      for (let i = 0; i < 26; i++) S.backDots.push({
        x: rand(0, 1) * W, y: H * rand(0.6, 0.68), r: rand(2, 4.5),
        c: ["#f6a8c0", "#ffd94d", "#c39be0", "#ffffff"][Math.floor(rand(0, 4))]
      });
    }
    if (type === "fish") {
      // 沙床轮廓
      S.sandPts = [];
      const seg = 8;
      for (let i = 0; i <= seg; i++) S.sandPts.push(rand(6, 16));
      // 石头
      S.stones = [];
      const sn = Math.floor(rand(3, 5.99));
      for (let i = 0; i < sn; i++) {
        const w = rand(30, 88);
        S.stones.push({ x: rand(4, Math.max(W - w - 8, 8)), y: H - rand(10, 26) - 14, w, h: w * rand(0.55, 0.75), rot: rand(-8, 8) * Math.PI / 180, tone: rand(0, 1) });
      }
      // 水草（每丛 2~3 叶）
      S.plants = [];
      const pn = Math.floor(rand(4, 6.99));
      for (let i = 0; i < pn; i++) {
        const blades = [];
        const bn = Math.floor(rand(2, 3.99));
        for (let j = 0; j < bn; j++) blades.push({ w: rand(13, 24), h: rand(52, 120), ph: rand(0, Math.PI * 2), f: rand(0.7, 1.3) });
        S.plants.push({ x: rand(3, Math.max(W - 44, 8)) + 20, y: H - rand(12, 30) - 16, blades, startle: 0 });
      }
    }
  };

  G.plantsStartle = (x, y) => {
    if (G.scene.plants) G.scene.plants.forEach(p => {
      if (Math.hypot(p.x - x, (p.y - y) * 0.6) < 130) p.startle = 1;
    });
  };

  /* ================= 布景绘制 ================= */
  function drawRoomBody(ctx, t) {
    const S = G.scene, W = S.W, H = S.H, fy = S.floorY;
    // 墙（原型 .room-wall）
    let g = ctx.createLinearGradient(0, 0, 0, fy);
    g.addColorStop(0, "#554b40"); g.addColorStop(0.55, "#61564a"); g.addColorStop(1, "#6b5f51");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, fy);
    // 吊顶阴影
    g = ctx.createLinearGradient(0, 0, 0, 46);
    g.addColorStop(0, "rgba(0,0,0,.30)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 46);
    // 墙纸细条纹
    ctx.fillStyle = "rgba(255,238,206,.035)";
    for (let i = 0; i < W; i += 26) ctx.fillRect(i, 0, 3, fy);
    // 墙角环境光遮蔽
    g = ctx.createLinearGradient(0, fy - 90, 0, fy);
    g.addColorStop(0, "rgba(30,20,10,0)"); g.addColorStop(1, "rgba(30,18,8,.28)");
    ctx.fillStyle = g; ctx.fillRect(0, fy - 90, W, 90);
    // 窗户
    const wW = S.winW, wH = S.winH, wx = S.winX, wy = S.winY;
    ctx.fillStyle = "#4a3624"; ctx.fillRect(wx - 4, wy - 4, wW + 8, wH + 8);
    const sky = ctx.createLinearGradient(wx, wy, wx, wy + wH);
    sky.addColorStop(0, "#a9b7a4"); sky.addColorStop(0.55, "#c1c7a4"); sky.addColorStop(1, "#d9cfa4");
    ctx.fillStyle = sky; ctx.fillRect(wx, wy, wW, wH);
    // 窗棂十字
    ctx.strokeStyle = "#4a3624"; ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(wx + wW / 2, wy); ctx.lineTo(wx + wW / 2, wy + wH);
    ctx.moveTo(wx, wy + wH * 0.46); ctx.lineTo(wx + wW, wy + wH * 0.46);
    ctx.stroke();
    // 玻璃反光
    g = ctx.createLinearGradient(wx, wy, wx + wW, wy + wH);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.36, "rgba(255,255,255,.22)"); g.addColorStop(0.48, "rgba(255,255,255,.05)"); g.addColorStop(0.6, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(wx, wy, wW, wH);
    // 窗台
    const sillG = ctx.createLinearGradient(0, wy + wH, 0, wy + wH + 11);
    sillG.addColorStop(0, "#6a5034"); sillG.addColorStop(1, "#523c26");
    ctx.fillStyle = sillG; ctx.fillRect(wx - 9, wy + wH, wW + 18, 11);
    // 光柱
    const lt = wy + wH - 14;
    g = ctx.createLinearGradient(wx - wW * 0.35, lt, wx + wW * 0.35, fy + 46);
    g.addColorStop(0, "rgba(255,238,196,.22)"); g.addColorStop(0.52, "rgba(255,238,196,.08)"); g.addColorStop(1, "rgba(255,238,196,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(wx - wW * 0.35, lt); ctx.lineTo(wx + wW * 1.35, lt);
    ctx.lineTo(wx + wW * 1.9, fy + 46); ctx.lineTo(wx - wW * 0.9, fy + 46);
    ctx.closePath(); ctx.fill();
    // 光柱浮尘
    ctx.fillStyle = "rgba(255,240,200,.6)";
    for (let i = 0; i < 7; i++) {
      const dx = wx + wW * (0.1 + 0.8 * ((i * 37) % 10) / 10);
      const dy = lt + ((t * 9 + i * 53) % (fy + 46 - lt));
      ctx.fillRect(dx, dy, 1.6, 1.6);
    }
    // 地板
    g = ctx.createLinearGradient(0, fy, 0, H);
    g.addColorStop(0, "#bd8a52"); g.addColorStop(0.55, "#a67a48"); g.addColorStop(1, "#8d5f36");
    ctx.fillStyle = g; ctx.fillRect(0, fy, W, H - fy);
    // 木纹肌理
    ctx.fillStyle = "rgba(110,62,26,.10)";
    for (let i = 0; i < W; i += 9) ctx.fillRect(i, fy, 2, H - fy);
    // 地板缝（透视板缝）
    ctx.strokeStyle = "rgba(80,48,22,.34)"; ctx.lineWidth = 3;
    for (let i = 1; i < 6; i++) {
      const yy = fy + (H - fy) * (i / 6) + 4 + i * 2;
      ctx.beginPath(); ctx.moveTo(-30, yy); ctx.lineTo(W + 30, yy); ctx.stroke();
    }
    // 地板远端变暗
    g = ctx.createRadialGradient(W / 2, fy, 0, W / 2, fy, Math.max(W, H - fy));
    g.addColorStop(0, "rgba(60,34,14,0)"); g.addColorStop(1, "rgba(60,34,14,.18)");
    ctx.fillStyle = g; ctx.fillRect(0, fy, W, H - fy);
    // 墙脚接触阴影
    g = ctx.createLinearGradient(0, fy, 0, fy + 30);
    g.addColorStop(0, "rgba(35,20,8,.32)"); g.addColorStop(1, "rgba(35,20,8,0)");
    ctx.fillStyle = g; ctx.fillRect(0, fy, W, 30);
    // 踢脚线
    const skirtG = ctx.createLinearGradient(0, fy - 12, 0, fy);
    skirtG.addColorStop(0, "#8a6a48"); skirtG.addColorStop(1, "#6d5134");
    ctx.fillStyle = skirtG; ctx.fillRect(0, fy - 12, W, 12);
    ctx.fillStyle = "rgba(255,240,210,.14)"; ctx.fillRect(0, fy - 12, W, 2);
    // 家具
    (S.furn || []).forEach(f => drawFurniture(ctx, f, fy));
    // 地毯（前排洞之下）
    if (!S.dark) {
      ctx.save(); ctx.translate(S.rugX + S.rugW / 2, fy + 100 + 27);
      const rugG = ctx.createRadialGradient(0, -10, 4, 0, 0, S.rugW / 2);
      rugG.addColorStop(0, "rgba(148,88,62,.55)"); rugG.addColorStop(0.58, "rgba(122,72,50,.48)"); rugG.addColorStop(1, "rgba(94,54,38,.45)");
      ctx.fillStyle = rugG; ctx.beginPath(); ctx.ellipse(0, 0, S.rugW / 2, 27, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(64,38,26,.4)"; ctx.lineWidth = 3; ctx.setLineDash([]);
      ctx.beginPath(); ctx.ellipse(0, 0, S.rugW / 2, 27, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(255,228,190,.16)"; ctx.lineWidth = 2; ctx.setLineDash([8, 7]);
      ctx.beginPath(); ctx.ellipse(0, 0, S.rugW / 2 * 0.74, 20, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
  }
  function drawFurniture(ctx, f, fy) {
    ctx.save(); ctx.translate(f.x, fy + 4); ctx.scale(f.s, f.s);
    if (f.kind === "sofa") {
      ctx.fillStyle = "rgba(30,18,8,.3)"; ctx.beginPath(); ctx.ellipse(60, 80, 52, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4a3527";
      ctx.fillRect(8, 6, 104, 34); r(ctx, 8, 6, 104, 34, 10);
      ctx.fillStyle = "#543d2c"; r(ctx, 2, 30, 16, 34, 7); r(ctx, 102, 30, 16, 34, 7);
      ctx.fillStyle = "#42301f"; r(ctx, 14, 42, 92, 24, 6);
      ctx.fillStyle = "#5c4430"; r(ctx, 18, 30, 40, 16, 5); r(ctx, 62, 30, 40, 16, 5);
      ctx.fillStyle = "#2e2115"; ctx.fillRect(14, 66, 6, 10); ctx.fillRect(100, 66, 6, 10);
    } else if (f.kind === "shelf") {
      ctx.fillStyle = "rgba(30,18,8,.3)"; ctx.beginPath(); ctx.ellipse(42, 112, 36, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#503a28"; r(ctx, 6, 4, 72, 106, 3);
      ctx.fillStyle = "#3a2a1c";
      for (let i = 0; i < 4; i++) ctx.fillRect(12, 22 + i * 24, 60, 3);
      ctx.fillStyle = ["#a0522d", "#8b6b3f", "#6b8e6b", "#a08a5a"][Math.floor(f.x) % 4];
      ctx.fillRect(18, 12, 12, 10); ctx.fillRect(44, 60, 14, 14); ctx.fillRect(20, 84, 10, 12);
    } else if (f.kind === "plant") {
      ctx.fillStyle = "rgba(30,18,8,.3)"; ctx.beginPath(); ctx.ellipse(32, 96, 24, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7a4a34"; ctx.beginPath(); ctx.moveTo(18, 68); ctx.lineTo(46, 68); ctx.lineTo(42, 94); ctx.lineTo(22, 94); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#8a563c"; ctx.fillRect(16, 64, 32, 6);
      const leaves = ["#3f5a3a", "#48684a", "#3a5236", "#436044", "#4e704e"];
      leaves.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        if (i === 0) ctx.moveTo(32, 64); ctx.quadraticCurveTo(20, 44, 26, 24); ctx.quadraticCurveTo(30, 42, 32, 64);
        if (i === 1) { ctx.moveTo(32, 64); ctx.quadraticCurveTo(44, 42, 40, 20); ctx.quadraticCurveTo(34, 42, 32, 64); }
        if (i === 2) { ctx.moveTo(32, 64); ctx.quadraticCurveTo(14, 52, 10, 36); ctx.quadraticCurveTo(24, 46, 32, 64); }
        if (i === 3) { ctx.moveTo(32, 64); ctx.quadraticCurveTo(50, 54, 56, 40); ctx.quadraticCurveTo(42, 48, 32, 64); }
        if (i === 4) { ctx.moveTo(32, 64); ctx.quadraticCurveTo(28, 36, 32, 14); ctx.quadraticCurveTo(36, 38, 32, 64); }
        ctx.fill();
      });
    } else {
      ctx.fillStyle = "rgba(30,18,8,.3)"; ctx.beginPath(); ctx.ellipse(28, 130, 20, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3a2a1c"; ctx.fillRect(25, 34, 6, 90); ctx.fillRect(12, 122, 32, 6);
      ctx.fillStyle = "rgba(255,220,150,.22)"; ctx.beginPath(); ctx.ellipse(28, 42, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5c4328"; ctx.beginPath(); ctx.moveTo(12, 34); ctx.lineTo(44, 34); ctx.lineTo(38, 8); ctx.lineTo(18, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#4a3520"; ctx.fillRect(16, 32, 24, 4);
    }
    ctx.restore();
  }
  function r(ctx, x, y, w2, h2, rad) {   // 圆角矩形填充（沿用当前 fillStyle）
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w2, y, x + w2, y + h2, rad); ctx.arcTo(x + w2, y + h2, x, y + h2, rad);
    ctx.arcTo(x, y + h2, x, y, rad); ctx.arcTo(x, y, x + w2, y, rad);
    ctx.closePath(); ctx.fill();
  }
  G.rr = r;

  function drawSea(ctx, t) {
    const S = G.scene, W = S.W, H = S.H;
    // 背景：原型 radial-gradient(130% 110% at 50% 0%, #1b7f8f 0%, #10556a 52%, #0b3a4c 100%)
    const g = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, Math.max(W, H) * 1.1);
    g.addColorStop(0, "#1b7f8f"); g.addColorStop(0.52, "#10556a"); g.addColorStop(1, "#0b3a4c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 光柱
    for (let i = 0; i < 3; i++) {
      const lx = W * (0.18 + i * 0.3) + Math.sin(t * 0.3 + i) * 14;
      const lg = ctx.createLinearGradient(lx, 0, lx + 60, H);
      lg.addColorStop(0, "rgba(180,240,255,.10)"); lg.addColorStop(1, "rgba(180,240,255,0)");
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + 56, 0); ctx.lineTo(lx + 130, H); ctx.lineTo(lx + 30, H); ctx.closePath(); ctx.fill();
    }
    // 沙床
    ctx.fillStyle = "#43635e";
    ctx.beginPath(); ctx.moveTo(0, H - 14 + S.sandPts[0]);
    const seg = S.sandPts.length - 1, stepX = W / seg;
    for (let i = 1; i <= seg; i++) ctx.quadraticCurveTo(stepX * (i - 0.5), H - 14 + (S.sandPts[i - 1] + S.sandPts[i]) / 2 - 4, stepX * i, H - 14 + S.sandPts[i]);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(91,128,110,.45)";
    ctx.beginPath(); ctx.moveTo(0, H - 17 + S.sandPts[0]);
    for (let i = 1; i <= seg; i++) ctx.quadraticCurveTo(stepX * (i - 0.5), H - 17 + (S.sandPts[i - 1] + S.sandPts[i]) / 2 - 4, stepX * i, H - 17 + S.sandPts[i]);
    ctx.lineTo(W, H - 30); ctx.lineTo(0, H - 30); ctx.closePath(); ctx.fill();
    // 石头
    S.stones.forEach(s => {
      ctx.save(); ctx.translate(s.x + s.w / 2, s.y + s.h / 2); ctx.rotate(s.rot);
      ctx.fillStyle = s.tone > 0.5 ? "#3f5c55" : "#4a6b60";
      ctx.beginPath(); ctx.ellipse(0, 0, s.w / 2, s.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.beginPath(); ctx.ellipse(-s.w * 0.12, -s.h * 0.18, s.w * 0.3, s.h * 0.24, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    // 水草（受惊加剧摇摆）
    const cols = ["#1c6157", "#154b46", "#0f3c3e", "#1f7160"];
    S.plants.forEach((p, pi) => {
      if (p.startle > 0) p.startle = Math.max(0, p.startle - 0.016);
      p.blades.forEach((b, bi) => {
        const sway = Math.sin(t * 1.6 * b.f + b.ph) * (0.16 + p.startle * 0.4);
        ctx.fillStyle = cols[(pi + bi) % cols.length];
        ctx.save(); ctx.translate(p.x + bi * 6, p.y);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(b.w * sway * b.h * 0.012, -b.h * 0.55, b.w * sway * b.h * 0.02, -b.h);
        ctx.quadraticCurveTo(b.w * 0.9 + b.w * sway * b.h * 0.02, -b.h * 0.5, b.w * 0.55, 0);
        ctx.closePath(); ctx.fill(); ctx.restore();
      });
    });
  }

  function drawGarden(ctx, t) {
    const S = G.scene, W = S.W, H = S.H;
    // 天空：原型 linear-gradient(180deg, #bfe3f5 0%, #e8f4d8 70%, #f5f0c8 100%)
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#bfe3f5"); g.addColorStop(0.7, "#e8f4d8"); g.addColorStop(1, "#f5f0c8");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 太阳
    const sx = W * 0.8, sy = H * 0.1;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 70);
    sg.addColorStop(0, "rgba(255,247,208,.95)"); sg.addColorStop(0.6, "rgba(255,233,138,.5)"); sg.addColorStop(1, "rgba(255,233,138,0)");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 70, 0, Math.PI * 2); ctx.fill();
    // 远山
    ctx.fillStyle = "#8fbf8a";
    ctx.beginPath(); ctx.moveTo(0, H * 0.6);
    ctx.quadraticCurveTo(W * 0.3, H * 0.5, W * 0.55, H * 0.6);
    ctx.quadraticCurveTo(W * 0.8, H * 0.52, W, H * 0.58);
    ctx.lineTo(W, H * 0.68); ctx.lineTo(0, H * 0.68); ctx.closePath(); ctx.fill();
    // 远景花带
    S.backDots.forEach(d => { ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(d.x, d.y + Math.sin(t + d.x) * 1.5, d.r, 0, Math.PI * 2); ctx.fill(); });
    // 草地：远浅 #9ec878 opacity .8，近深 gradient #8fbf6a → #6ba14a → #4f8238
    const grassY = H * 0.62;
    ctx.fillStyle = "#9ec878"; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(0, grassY); ctx.lineTo(W, grassY); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    g = ctx.createLinearGradient(0, grassY, 0, H);
    g.addColorStop(0, "#8fbf6a"); g.addColorStop(0.4, "#6ba14a"); g.addColorStop(1, "#4f8238");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, grassY); ctx.lineTo(W, grassY); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // 前景大花（停花目标，nudge 轻颤回弹；原型五瓣花）
    S.flowers.forEach(f => {
      if (f.nudgeT > 0) f.nudgeT = Math.max(0, f.nudgeT - 0.016);
      const sway = Math.sin(t * 1.2 + f.swayPh) * 3 + Math.sin(f.nudgeT * 40) * f.nudgeT * 4;
      ctx.strokeStyle = "#4a7a2e"; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(f.x, H); ctx.quadraticCurveTo(f.x + sway, (f.y + H) / 2, f.x + sway, f.y + f.r * 0.5); ctx.stroke();
      // 小叶
      ctx.fillStyle = "#5a8c3a";
      ctx.beginPath(); ctx.moveTo(f.x + sway, (f.y + H) / 2); ctx.quadraticCurveTo(f.x + sway - 6, (f.y + H) / 2 - 2, f.x + sway - 8, (f.y + H) / 2 - 5); ctx.quadraticCurveTo(f.x + sway - 2, (f.y + H) / 2 - 3, f.x + sway, (f.y + H) / 2); ctx.fill();
      ctx.save(); ctx.translate(f.x + sway, f.y);
      for (let i = 0; i < 5; i++) {
        const a = i * 72 * Math.PI / 180;
        ctx.save(); ctx.rotate(a);
        ctx.fillStyle = f.color.petal;
        ctx.beginPath(); ctx.ellipse(0, -f.r * 0.72, f.r * 0.34, f.r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = f.color.heart; ctx.beginPath(); ctx.arc(0, 0, f.r * 0.36, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  G.drawScene = (ctx, t) => {
    const S = G.scene;
    if (!S || !S.type) return;
    if (S.type === "fish") drawSea(ctx, t);
    else if (S.type === "butterfly") drawGarden(ctx, t);
    else {
      drawRoomBody(ctx, t);
      // 老鼠洞（后排先画，前排盖上面）
      S.holes.forEach((h, i) => { if (i % 2 === 0) G.draw.hole(ctx, h.x, h.y); });
      S.holes.forEach((h, i) => { if (i % 2 === 1) G.draw.hole(ctx, h.x, h.y); });
    }
  };

  /* ================= 粒子特效 ================= */
  const fx = {
    bubbles: [], dust: [], pollen: [], scales: [], sparks: [], ripples: [],
    trails: [], scorches: [], petals: [], paws: [], floats: [], ambientT: 0
  };
  G.fx = fx;
  const PUSH = (arr, o, cap) => { arr.push(o); if (arr.length > cap) arr.splice(0, arr.length - cap); };

  G.bubbleBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.bubbles, { x: x + rand(-14, 14), y: y + rand(-10, 10), r: rand(3, 8), vy: rand(-70, -30), vx: rand(-20, 20), life: rand(0.5, 1) }, 60); };
  G.dustBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.dust, { x, y, vx: rand(-55, 55), vy: rand(-60, -8), r: rand(3, 7), life: rand(0.4, 0.8) }, 60); };
  G.pollenBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.pollen, { x: x + rand(-12, 12), y: y + rand(-12, 12), vx: rand(-24, 24), vy: rand(-34, -6), r: rand(1.5, 3.4), life: rand(0.7, 1.4) }, 80); };
  G.scalesBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.scales, { x, y, vx: rand(-20, 20), vy: rand(4, 26), r: rand(1, 2.4), life: rand(0.6, 1.3) }, 60); };
  G.sparkBurst = (x, y, color, n) => { for (let i = 0; i < (n || 8); i++) { const a = rand(0, Math.PI * 2), sp = rand(90, 260); PUSH(fx.sparks, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.55) }, 80); } fx.sparkColor = color; };
  G.ripple = (x, y, miss) => { if (G.scene.type !== "fish") return; PUSH(fx.ripples, { x, y, r: 6, life: 1, miss: !!miss }, 30); };
  G.laserTrail = (x, y) => PUSH(fx.trails, { x, y, life: 0.4 }, 30);
  G.laserFlash = (x, y) => PUSH(fx.scorches, { x, y, life: 0.32, flash: true }, 20);
  G.scorch = (x, y) => PUSH(fx.scorches, { x, y, life: 1.05 }, 20);
  G.petalBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.petals, { x, y, vx: rand(-50, 50), vy: rand(-50, 10), rot: rand(0, 6.28), life: rand(0.8, 1.5) }, 40); };
  G.pawPrint = (x, y, dir) => PUSH(fx.paws, { x, y, dir, life: 1 }, 26);
  G.floatText = (x, y, text, kind) => PUSH(fx.floats, { x, y, text, kind: kind || "", life: 1 }, 20);

  fx.update = (dt, t) => {
    // 海底环境气泡
    if (G.scene.type === "fish" && G.session.running) {
      fx.ambientT += dt;
      if (fx.ambientT > 1.2) {
        fx.ambientT = 0;
        PUSH(fx.bubbles, { x: rand(10, G.platform.W - 10), y: G.platform.H + 8, r: rand(2.5, 6), vy: rand(-46, -22), vx: 0, life: rand(3, 5), ambient: true }, 60);
      }
    }
    const step = (arr, fn) => { for (let i = arr.length - 1; i >= 0; i--) { const p = arr[i]; p.life -= dt; if (fn(p, dt) === false || p.life <= 0) arr.splice(i, 1); } };
    step(fx.bubbles, (p, d) => { p.y += p.vy * d; p.x += Math.sin(t * 3 + p.y * 0.05) * 0.5 + (p.vx || 0) * d; if (p.ambient && p.y < G.platform.H * 0.15) return false; });
    step(fx.dust, (p, d) => { p.x += p.vx * d; p.y += p.vy * d; p.vy += 120 * d; });
    step(fx.pollen, (p, d) => { p.x += p.vx * d + Math.sin(t * 2 + p.y) * 0.4; p.y += p.vy * d; });
    step(fx.scales, (p, d) => { p.x += p.vx * d; p.y += p.vy * d; p.vx *= 0.96; });
    step(fx.sparks, (p, d) => { p.x += p.vx * d; p.y += p.vy * d; p.vx *= 0.9; p.vy = p.vy * 0.9 + 300 * d; });
    step(fx.ripples, (p, d) => { p.r += 90 * d; });
    step(fx.trails, () => {});
    step(fx.scorches, () => {});
    step(fx.petals, (p, d) => { p.x += p.vx * d; p.y += p.vy * d; p.vy += 60 * d; p.rot += 3 * d; });
    step(fx.paws, () => {});
    step(fx.floats, (p, d) => { p.y -= 34 * d; });
  };

  fx.draw = (ctx) => {
    fx.bubbles.forEach(p => {
      ctx.globalAlpha = Math.min(p.life, 0.8);
      ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 1;
      const rg = ctx.createRadialGradient(p.x - p.r * 0.15, p.y - p.r * 0.15, 0, p.x, p.y, p.r);
      rg.addColorStop(0, "rgba(255,255,255,.35)"); rg.addColorStop(1, "rgba(255,255,255,.05)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    fx.dust.forEach(p => {
      ctx.globalAlpha = Math.min(p.life * 1.4, 0.5);
      ctx.fillStyle = "#c9b28c";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.4 - p.life * 0.5), 0, Math.PI * 2); ctx.fill();
    });
    fx.pollen.forEach(p => {
      ctx.globalAlpha = Math.min(p.life, 0.9);
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    fx.scales.forEach(p => {
      ctx.globalAlpha = Math.min(p.life, 0.85);
      ctx.fillStyle = "#ffd76a";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    fx.sparks.forEach(p => {
      ctx.globalAlpha = Math.max(p.life * 1.8, 0);
      ctx.fillStyle = fx.sparkColor || "#ffd76a";
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    fx.ripples.forEach(p => {
      ctx.globalAlpha = Math.max(p.life * (p.miss ? 0.3 : 0.85), 0);
      ctx.strokeStyle = "rgba(255,255,255," + (p.miss ? 0.3 : 0.85) + ")"; ctx.lineWidth = p.miss ? 2 : 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
    });
    fx.trails.forEach(p => {
      ctx.globalAlpha = Math.max(p.life * 0.8, 0);
      ctx.fillStyle = "#ff5252";
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 * p.life, 0, Math.PI * 2); ctx.fill();
    });
    fx.scorches.forEach(p => {
      const a = Math.max(p.life, 0);
      if (p.flash) {
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = "#ff7a7a"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 34 * (1 - a) + 8, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.globalAlpha = a * 0.55;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
        g.addColorStop(0, "#3a0f0a"); g.addColorStop(1, "rgba(58,15,10,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
      }
    });
    fx.petals.forEach(p => {
      ctx.globalAlpha = Math.min(p.life, 0.95);
      ctx.fillStyle = "#ffb3c8";
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.beginPath(); ctx.ellipse(0, 0, 5.5, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    fx.paws.forEach(p => {
      ctx.globalAlpha = Math.max(p.life * 0.5, 0);
      ctx.fillStyle = "#7a6753";
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.dir > 0 ? -0.3 : 0.3);
      ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 4, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 2.8, -5.4, 1.3, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    fx.floats.forEach(p => {
      const a = Math.min(p.life * 1.6, 1);
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      if (p.kind === "big") { ctx.font = "bold 22px sans-serif"; ctx.fillStyle = "#ffd45e"; ctx.strokeStyle = "rgba(40,26,4,.75)"; ctx.lineWidth = 4; ctx.strokeText(p.text, p.x, p.y); }
      else if (p.kind === "hint") { ctx.font = "14px sans-serif"; ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.strokeStyle = "rgba(8,30,44,.75)"; ctx.lineWidth = 4; ctx.strokeText(p.text, p.x, p.y); }
      else { ctx.font = "bold 17px sans-serif"; ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "rgba(20,30,40,.7)"; ctx.lineWidth = 3.5; ctx.strokeText(p.text, p.x, p.y); }
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
  };
  fx.clear = () => { Object.keys(fx).forEach(k => { if (Array.isArray(fx[k])) fx[k].length = 0; }); };
};
