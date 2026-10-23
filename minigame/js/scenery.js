/* scenery.js — 四套布景（海底/花园/室内/暗室）+ 粒子特效系统 */
module.exports = function (G) {
  const rand = G.rand;
  G.scene = { type: null };
  G.gardenFlowers = [];   // 供蝴蝶降落的花（{x,y,color,nudgeT}）

  /* ================= 布景构建 ================= */
  G.buildScene = (type) => {
    const W = G.platform.W, H = G.platform.H;
    const S = { type, W, H, floorY: type === "mouse" ? H * 0.2 : H * 0.68, holes: [], holeOwners: [], holeHeat: [], dark: type === "laser" };
    G.scene = S;
    G.gardenFlowers = [];
    // 捕鼠可选背景：room（室内房间，默认）/ plaid（深色格纹地毯）
    S.mouseBg = type === "mouse" ? G.currentBg() : "default";
    if (type === "mouse" && S.mouseBg === "plaid") {
      // 整屏格纹地毯：格子边长随屏取，横竖屏都好铺
      S.plaid = { cell: Math.max(64, Math.round(Math.min(W, H) / 4.6)) };
    }
    if (type === "mouse" && S.mouseBg === "neon") {
      // 霓虹格毯：更黑更粗的格纹 + 地毯上零星彩色微光点（缓慢呼吸）
      S.neon = { cell: Math.max(104, Math.round(Math.min(W, H) / 2.5)), dots: [] };
      const PAL = ["94,240,224", "255,122,192", "255,228,94", "157,140,255", "125,255,154", "255,159,94"];
      const dn = Math.floor(rand(9, 13.99));
      for (let i = 0; i < dn; i++) {
        S.neon.dots.push({
          x: rand(0.05, 0.95) * W, y: rand(0.1, 0.9) * H,
          r: rand(2.2, 4.6), rgb: PAL[Math.floor(rand(0, PAL.length))],
          ph: rand(0, Math.PI * 2), f: rand(0.8, 2.2)
        });
      }
    }

    // 只有 room（或激光暗室）才生成墙/窗/家具/地毯；plaid、neon 是整屏铺满的纯地面背景
    const roomBg = type === "laser" || S.mouseBg === "room";
    if ((type === "mouse" || type === "laser") && roomBg) {
      // 窗户（光柱）：捕鼠模式地台全屏化后墙只剩顶部一条，窗户相应缩小
      const isMouse = type === "mouse";
      S.winW = Math.min(isMouse ? 84 : 118, W * (isMouse ? 0.2 : 0.3));
      S.winH = isMouse ? Math.max(34, Math.min(S.floorY - 44, S.winW * 0.9)) : S.winW * 1.25;
      S.winX = W * rand(0.52, 0.62); S.winY = Math.max(30, S.floorY * rand(0.10, 0.2));
      // 家具：台球桌布局要求四边干净可拦截，捕鼠模式不放家具
      const kinds = ["sofa", "shelf", "plant", "lamp"];
      S.furn = [];
      const n = isMouse ? 0 : Math.floor(rand(2, 3.99));
      for (let i = 0; i < n; i++) {
        const fx = rand(0.04, 0.9) * W;
        S.furn.push({ kind: kinds[Math.floor(rand(0, kinds.length))], x: fx, s: rand(0.85, 1.1) });
      }
      S.rugW = W * rand(0.36, 0.46);
      S.rugX = W * rand(0.1, 0.9) - S.rugW / 2;
    }
    if (type === "mouse") {
      // 台球桌布局：四条边各 3 个洞（2 角洞 + 1 边中洞，共 8 个）+ 中场 2 个洞，共 10 个
      // 老鼠从任意洞出现、窜向任意洞，路线横穿台面，猫咪可点击拦截
      const b = G.bounds();
      const L = b.x + 0.07 * b.w, R = b.x + 0.93 * b.w;
      const T = b.y + 0.18 * b.h, B = b.y + 0.86 * b.h, M = b.y + 0.5 * b.h;
      const CX = b.x + 0.5 * b.w;
      const pts = [
        [L, T], [CX, T], [R, T],                        // 上边：左角/中/右角
        [L, M], [R, M],                                 // 左右边中点
        [L, B], [CX, B], [R, B],                        // 下边：左角/中/右角
        [b.x + 0.36 * b.w, M], [b.x + 0.64 * b.w, M]    // 中场两洞
      ];
      pts.forEach(pt => S.holes.push({
        x: pt[0] + rand(-0.012, 0.012) * b.w,
        y: pt[1] + rand(-0.015, 0.015) * b.h
      }));
      S.holeOwners = new Array(S.holes.length).fill(null);
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
      // 海域主题装饰（珊瑚/荧光/浮冰/水草，由 G.seaThemeNow() 决定）
      const th = G.seaThemeNow();
      S.theme = th;
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
      // 水草（每丛 2~3 叶；水草森林主题加密加高）
      S.plants = [];
      const kelp = th.decor === "kelp";
      const pn = Math.floor(rand(kelp ? 7 : 4, kelp ? 10.99 : 6.99));
      for (let i = 0; i < pn; i++) {
        const blades = [];
        const bn = Math.floor(rand(kelp ? 3 : 2, kelp ? 5.99 : 3.99));
        for (let j = 0; j < bn; j++) blades.push({ w: rand(13, 24), h: rand(kelp ? 90 : 52, kelp ? 200 : 120), ph: rand(0, Math.PI * 2), f: rand(0.7, 1.3) });
        S.plants.push({ x: rand(3, Math.max(W - 44, 8)) + 20, y: H - rand(12, 30) - 16, blades, startle: 0 });
      }
      // 主题专属装饰
      S.decor = [];
      if (th.decor === "coral") {
        // 珊瑚丛：分枝剪影，粉/橙/紫三色
        const cols = ["#e86a8a", "#f2955c", "#b06fd0", "#e88a6a"];
        const cn = Math.floor(rand(3, 5.99));
        for (let i = 0; i < cn; i++) {
          S.decor.push({ kind: "coral", x: rand(6, W - 60), y: H - rand(8, 22), s: rand(0.7, 1.25), c: cols[Math.floor(rand(0, cols.length))] });
        }
      } else if (th.decor === "glow") {
        // 荧光珊瑚 + 发光泡泡口：深海发光点
        const cn = Math.floor(rand(4, 7.99));
        for (let i = 0; i < cn; i++) {
          S.decor.push({ kind: "glow", x: rand(10, W - 20), y: H * rand(0.45, 0.92), r: rand(7, 18), ph: rand(0, Math.PI * 2), c: ["#7fe7ff", "#57e0c8", "#9d8cff"][Math.floor(rand(0, 3))] });
        }
      } else if (th.decor === "ice") {
        // 浮冰：上层漂浮冰排 + 底部冰岩
        const cn = Math.floor(rand(3, 5.99));
        for (let i = 0; i < cn; i++) {
          const w2 = rand(70, 150);
          S.decor.push({ kind: "ice", x: rand(4, Math.max(W - w2 - 8, 8)), y: i % 2 ? H * rand(0.1, 0.22) : H - rand(6, 18), w: w2, h: w2 * rand(0.22, 0.34), drift: rand(-4, 4), ph: rand(0, Math.PI * 2) });
        }
      } else if (th.decor === "kelp") {
        // 沉木 + 贝壳：水草森林底床点缀
        const cn = Math.floor(rand(3, 5.99));
        for (let i = 0; i < cn; i++) {
          S.decor.push({
            kind: i % 2 ? "shell" : "wood",
            x: rand(8, W - 60), y: H - rand(6, 20),
            s: rand(0.7, 1.2), rot: rand(-20, 20) * Math.PI / 180
          });
        }
      }
    }
    if (type === "pool") {
      // Peppy Cat 石板墙（对齐官方游玩背景：深棕灰不规则石块 + 深缝，衬托发光猎物）
      S.stones = [];
      const cell = Math.max(88, Math.round(Math.min(W, H) / 4.0));   // 石块基准边长
      const cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1;
      const jx = cell * 0.30;                                        // 格点抖动 → 石块不规则
      // 共享抖动格点：相邻石块共用顶点，拼合无缝
      const P = [];
      for (let i = 0; i <= cols; i++) {
        P[i] = [];
        for (let j = 0; j <= rows; j++) {
          const edgeX = (i === 0 || i === cols), edgeY = (j === 0 || j === rows);
          P[i][j] = {
            x: i * cell + (edgeX ? 0 : rand(-jx, jx)),
            y: j * cell + (edgeY ? 0 : rand(-jx, jx))
          };
        }
      }
      const SWATCH = [
        ["#4c423c", "#5a4f47"], ["#443b36", "#51463f"], ["#544941", "#63564c"],
        ["#3e3631", "#4a413b"], ["#4f453e", "#5d5148"], ["#463d37", "#54483f"]
      ];
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const a = P[i][j], b = P[i + 1][j], c = P[i + 1][j + 1], d = P[i][j + 1];
        const cx = (a.x + b.x + c.x + d.x) / 4, cy = (a.y + b.y + c.y + d.y) / 4;
        const ins = rand(0.055, 0.105);                     // 向心内缩 → 石块之间留深缝
        const pts = [a, b, c, d].map(p => ({ x: p.x + (cx - p.x) * ins, y: p.y + (cy - p.y) * ins }));
        // 石块内部的碎石裂线（1~2 条短折线，只做质感）
        const cracks = [];
        const cn3 = Math.floor(rand(0, 2.99));
        for (let k = 0; k < cn3; k++) {
          const e1 = pts[k % 4], e2 = pts[(k + 2) % 4];
          const mx = (e1.x + e2.x) / 2 + rand(-8, 8), my = (e1.y + e2.y) / 2 + rand(-8, 8);
          cracks.push([e1.x + (cx - e1.x) * 0.25, e1.y + (cy - e1.y) * 0.25, mx, my]);
        }
        const sw = SWATCH[Math.floor(rand(0, SWATCH.length))];
        S.stones.push({
          pts, cracks, c: sw[0], c2: sw[1],
          hi: "rgba(255,255,255," + rand(0.03, 0.075).toFixed(3) + ")"   // 受光边
        });
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
    const th = S.theme || G.seaThemeNow();
    // 背景：主题渐变（珊瑚海=原型色，深海/冰海/水草各自换色系）
    const g = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, Math.max(W, H) * 1.1);
    g.addColorStop(0, th.bg[0]); g.addColorStop(0.52, th.bg[1]); g.addColorStop(1, th.bg[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 光柱（深海调暗、冰海偏冷白）
    const rayA = th.key === "abyss" ? 0.05 : th.key === "ice" ? 0.13 : 0.10;
    const rayC = th.key === "ice" ? "220,240,255" : "180,240,255";
    for (let i = 0; i < 3; i++) {
      const lx = W * (0.18 + i * 0.3) + Math.sin(t * 0.3 + i) * 14;
      const lg = ctx.createLinearGradient(lx, 0, lx + 60, H);
      lg.addColorStop(0, "rgba(" + rayC + "," + rayA + ")"); lg.addColorStop(1, "rgba(" + rayC + ",0)");
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + 56, 0); ctx.lineTo(lx + 130, H); ctx.lineTo(lx + 30, H); ctx.closePath(); ctx.fill();
    }
    // 沙床
    ctx.fillStyle = th.sand;
    ctx.beginPath(); ctx.moveTo(0, H - 14 + S.sandPts[0]);
    const seg = S.sandPts.length - 1, stepX = W / seg;
    for (let i = 1; i <= seg; i++) ctx.quadraticCurveTo(stepX * (i - 0.5), H - 14 + (S.sandPts[i - 1] + S.sandPts[i]) / 2 - 4, stepX * i, H - 14 + S.sandPts[i]);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.beginPath(); ctx.moveTo(0, H - 17 + S.sandPts[0]);
    for (let i = 1; i <= seg; i++) ctx.quadraticCurveTo(stepX * (i - 0.5), H - 17 + (S.sandPts[i - 1] + S.sandPts[i]) / 2 - 4, stepX * i, H - 17 + S.sandPts[i]);
    ctx.lineTo(W, H - 30); ctx.lineTo(0, H - 30); ctx.closePath(); ctx.fill();
    // 石头（冰海偏白、深海偏暗）
    S.stones.forEach(s => {
      ctx.save(); ctx.translate(s.x + s.w / 2, s.y + s.h / 2); ctx.rotate(s.rot);
      ctx.fillStyle = th.key === "ice" ? (s.tone > 0.5 ? "#cfe2ec" : "#b8d2e0")
        : th.key === "abyss" ? (s.tone > 0.5 ? "#1c3446" : "#24425a")
        : (s.tone > 0.5 ? "#3f5c55" : "#4a6b60");
      ctx.beginPath(); ctx.ellipse(0, 0, s.w / 2, s.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.beginPath(); ctx.ellipse(-s.w * 0.12, -s.h * 0.18, s.w * 0.3, s.h * 0.24, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    // 主题装饰：珊瑚丛 / 荧光点 / 浮冰
    (S.decor || []).forEach(d => {
      if (d.kind === "coral") {
        // 分枝珊瑚：主干 + 3~4 根分枝
        ctx.save(); ctx.translate(d.x, d.y); ctx.scale(d.s, d.s);
        ctx.fillStyle = d.c; ctx.strokeStyle = d.c; ctx.lineWidth = 7; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -46); ctx.stroke();
        [[-16, -60], [14, -66], [-10, -84], [12, -90]].forEach(pt => {
          ctx.beginPath(); ctx.moveTo(0, -30); ctx.quadraticCurveTo(pt[0] * 0.5, pt[1] * 0.8, pt[0], pt[1]); ctx.stroke();
        });
        ctx.restore();
      } else if (d.kind === "glow") {
        // 荧光球：呼吸发光（深海）
        const a = 0.35 + 0.3 * Math.sin(t * 1.4 + d.ph);
        const rg = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 2.2);
        rg.addColorStop(0, d.c); rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = a; ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = Math.min(1, a + 0.35); ctx.fillStyle = d.c;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (d.kind === "ice") {
        // 浮冰排：缓慢漂移 + 白蓝渐变
        const dx = Math.sin(t * 0.35 + d.ph) * 6 + d.drift * t * 0.15;
        ctx.save(); ctx.translate(d.x + dx, d.y);
        const ig = ctx.createLinearGradient(0, -d.h / 2, 0, d.h / 2);
        ig.addColorStop(0, "rgba(240,250,255,.95)"); ig.addColorStop(1, "rgba(170,205,225,.85)");
        ctx.fillStyle = ig;
        G.rr(ctx, -d.w / 2, -d.h / 2, d.w, d.h, d.h * 0.42); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.5)";
        G.rr(ctx, -d.w * 0.32, -d.h * 0.34, d.w * 0.5, d.h * 0.3, d.h * 0.15); ctx.fill();
        ctx.restore();
      } else if (d.kind === "wood") {
        // 沉木：斜卧的深褐圆木
        ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.scale(d.s, d.s);
        const wg = ctx.createLinearGradient(0, -10, 0, 12);
        wg.addColorStop(0, "#6b4a2e"); wg.addColorStop(1, "#4a3018");
        ctx.fillStyle = wg;
        G.rr(ctx, -40, -9, 80, 18, 9); ctx.fill();
        ctx.fillStyle = "rgba(255,220,180,.14)";
        G.rr(ctx, -32, -6, 50, 5, 3); ctx.fill();
        ctx.restore();
      } else if (d.kind === "shell") {
        // 贝壳：扇形双色
        ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.scale(d.s, d.s);
        ctx.fillStyle = "#e8d5b8";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 14, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(180,120,80,.35)";
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(Math.PI + (k + 2.5) / 5 * Math.PI) * 14, Math.sin(Math.PI + (k + 2.5) / 5 * Math.PI) * 14);
          ctx.lineWidth = 1.4; ctx.strokeStyle = "rgba(180,120,80,.35)"; ctx.stroke();
        }
        ctx.restore();
      }
    });
    // 水草（受惊加剧摇摆；水草森林更绿更深）
    const cols = th.key === "kelp" ? ["#2f8f5e", "#276f4c", "#1d5a3e", "#38a56c"]
      : th.key === "abyss" ? ["#123c4e", "#0f3242", "#0c2a3a", "#16485c"]
      : th.key === "ice" ? ["#6f9fb8", "#5d8aa4", "#4e778f", "#7fb0c8"]
      : ["#1c6157", "#154b46", "#0f3c3e", "#1f7160"];
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
    else if (S.type === "pool") drawPool(ctx, t);
    else if (S.type === "mouse" && S.mouseBg === "neon") { drawNeonFloor(ctx, t); drawHoles(ctx); }
    else if (S.type === "mouse" && S.mouseBg === "plaid") { drawPlaidFloor(ctx, t); drawHoles(ctx); }
    else { drawRoomBody(ctx, t); drawHoles(ctx); }
  };
  /* 老鼠洞（后排先画，前排盖上面；两个背景共用） */
  function drawHoles(ctx) {
    const S = G.scene;
    S.holes.forEach((h, i) => { if (i % 2 === 0) G.draw.hole(ctx, h.x, h.y); });
    S.holes.forEach((h, i) => { if (i % 2 === 1) G.draw.hole(ctx, h.x, h.y); });
  }

  /* ============ 深色格纹地毯（Peppy Cat 式斜纹格布底） ============
     整屏铺满：墨绿黑底 + 45° 织纹 + 棋盘明暗格 + 格线，顶部压暗保证 HUD 可读。
     暗底让棕色老鼠与洞口边缘仍然清晰，同时给"萤光猎场"的观感 */
  function drawPlaidFloor(ctx, t) {
    const S = G.scene, W = S.W, H = S.H;
    const cell = (S.plaid && S.plaid.cell) || 110;
    // 底色（墨绿黑）
    ctx.fillStyle = "#0f1410"; ctx.fillRect(0, 0, W, H);
    // 织纹：45° 细斜线（布纹感）
    ctx.strokeStyle = "rgba(178,206,178,.045)"; ctx.lineWidth = 1;
    for (let i = -H; i < W + H; i += 11) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    }
    // 棋盘明暗格
    for (let ix = 0, gx = 0; gx < W; ix++, gx += cell) {
      for (let iy = 0, gy = 0; gy < H; iy++, gy += cell) {
        ctx.fillStyle = (ix + iy) % 2 === 0 ? "rgba(0,0,0,.34)" : "rgba(150,180,140,.05)";
        ctx.fillRect(gx, gy, cell, cell);
      }
    }
    // 格线
    ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 1.6;
    for (let x = 0; x <= W; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // 顶部压暗（HUD 区可读）+ 四周暗角
    const tg = ctx.createLinearGradient(0, 0, 0, H * 0.3);
    tg.addColorStop(0, "rgba(0,0,0,.55)"); tg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.3);
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.25, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.42)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  /* ============ 霓虹格毯（更黑更粗的格纹 + 彩色微光点） ============
     对齐参考图：粗格暗毯做底，地毯上散着零星青/粉/黄霓虹反光；
     老鼠自带柔光（见 prey.js render）、命中撒多彩光点 */
  function drawNeonFloor(ctx, t) {
    const S = G.scene, W = S.W, H = S.H;
    const cell = (S.neon && S.neon.cell) || 130;
    ctx.fillStyle = "#0b100b"; ctx.fillRect(0, 0, W, H);
    // 织纹（粗格布，斜纹更明显）
    ctx.strokeStyle = "rgba(190,210,175,.06)"; ctx.lineWidth = 1.1;
    for (let i = -H; i < W + H; i += 9) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    }
    // 交替格（深橄榄 vs 纯黑，明暗要看得出来，否则整片糊黑）
    for (let ix = 0, gx = 0; gx < W; ix++, gx += cell) {
      for (let iy = 0, gy = 0; gy < H; iy++, gy += cell) {
        ctx.fillStyle = (ix + iy) % 2 === 0 ? "rgba(0,0,0,.34)" : "rgba(118,132,92,.17)";
        ctx.fillRect(gx, gy, cell, cell);
      }
    }
    // 格线（更粗）
    ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = 2.2;
    for (let x = 0; x <= W; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // 彩色微光点：呼吸 + 轻微漂移（地毯上的霓虹反光）
    (S.neon ? S.neon.dots : []).forEach(d => {
      const a = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(t * d.f + d.ph));
      const dx = d.x + Math.sin(t * d.f * 0.5 + d.ph) * 6;
      const dy = d.y + Math.cos(t * d.f * 0.4 + d.ph * 1.4) * 4;
      const rg = ctx.createRadialGradient(dx, dy, 0, dx, dy, d.r * 4.4);
      rg.addColorStop(0, "rgba(" + d.rgb + "," + (a * 0.85).toFixed(2) + ")");
      rg.addColorStop(0.4, "rgba(" + d.rgb + "," + (a * 0.3).toFixed(2) + ")");
      rg.addColorStop(1, "rgba(" + d.rgb + ",0)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(dx, dy, d.r * 4.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(" + d.rgb + "," + a.toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(dx, dy, d.r, 0, Math.PI * 2); ctx.fill();
    });
    // 顶部压暗（HUD 可读）+ 暗角
    const tg = ctx.createLinearGradient(0, 0, 0, H * 0.3);
    tg.addColorStop(0, "rgba(0,0,0,.6)"); tg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.3);
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.25, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.45)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  /* ============ 暗夜萤光（Peppy Cat 石板墙） ============
     对齐官方游玩背景：深棕灰不规则石块 + 深缝 + 微弱受光边，整体压暗，
     最大程度衬托发光猎物（黄绿 glow 在暗底上跳出来） */
  function drawPool(ctx, t) {
    const S = G.scene, W = S.W, H = S.H;
    // 石缝底色（深棕黑）
    ctx.fillStyle = "#1b1613"; ctx.fillRect(0, 0, W, H);
    const stones = S.stones || [];
    stones.forEach(s => {
      const p = s.pts, n = p.length;
      const path = (arr, rad) => {
        ctx.beginPath();
        ctx.moveTo((arr[0].x + arr[n - 1].x) / 2, (arr[0].y + arr[n - 1].y) / 2);
        for (let i = 0; i < n; i++) {
          const cur = arr[i], nxt = arr[(i + 1) % n];
          ctx.arcTo(cur.x, cur.y, (cur.x + nxt.x) / 2, (cur.y + nxt.y) / 2, rad);
        }
        ctx.closePath();
      };
      // 石块主体（圆角多边形，圆角取石块尺度的 12%）
      const w0 = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
      path(p, Math.max(8, w0 * 0.10));
      ctx.fillStyle = s.c; ctx.fill();
      // 受光面：向心内缩的亮一档多边形，偏左上 2px（模拟石面明暗）
      const cx = p.reduce((a, q) => a + q.x, 0) / n, cy = p.reduce((a, q) => a + q.y, 0) / n;
      const inner = p.map(q => ({ x: q.x + (cx - q.x) * 0.17 - 2, y: q.y + (cy - q.y) * 0.17 - 2 }));
      path(inner, Math.max(6, w0 * 0.08));
      ctx.fillStyle = s.c2; ctx.fill();
      // 边缘受光细线
      path(p, Math.max(8, w0 * 0.10));
      ctx.strokeStyle = s.hi; ctx.lineWidth = 1.6; ctx.stroke();
      // 碎石裂线
      if (s.cracks && s.cracks.length) {
        ctx.strokeStyle = "rgba(0,0,0,.30)"; ctx.lineWidth = 1.3;
        s.cracks.forEach(k => { ctx.beginPath(); ctx.moveTo(k[0], k[1]); ctx.lineTo(k[2], k[3]); ctx.stroke(); });
      }
    });
    // 全局暗角：四周压暗，中心留亮（让猎物所在的中部更醒目）
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.48, Math.min(W, H) * 0.18, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.46)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  /* ================= 粒子特效 ================= */
  const fx = {
    bubbles: [], dust: [], pollen: [], scales: [], sparks: [], ripples: [],
    trails: [], scorches: [], petals: [], paws: [], floats: [], ambientT: 0,
    droplets: [], shockwaves: [], flash: 0
  };
  G.fx = fx;
  const PUSH = (arr, o, cap) => { arr.push(o); if (arr.length > cap) arr.splice(0, arr.length - cap); };

  G.bubbleBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.bubbles, { x: x + rand(-14, 14), y: y + rand(-10, 10), r: rand(3, 8), vy: rand(-70, -30), vx: rand(-20, 20), life: rand(0.5, 1) }, 60); };
  G.dustBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.dust, { x, y, vx: rand(-55, 55), vy: rand(-60, -8), r: rand(3, 7), life: rand(0.4, 0.8) }, 60); };
  G.pollenBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.pollen, { x: x + rand(-12, 12), y: y + rand(-12, 12), vx: rand(-24, 24), vy: rand(-34, -6), r: rand(1.5, 3.4), life: rand(0.7, 1.4) }, 80); };
  G.scalesBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.scales, { x, y, vx: rand(-20, 20), vy: rand(4, 26), r: rand(1, 2.4), life: rand(0.6, 1.3) }, 60); };
  G.sparkBurst = (x, y, color, n) => { for (let i = 0; i < (n || 8); i++) { const a = rand(0, Math.PI * 2), sp = rand(90, 260); PUSH(fx.sparks, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.55), c: color }, 90); } fx.sparkColor = color; };
  /* 夸张光爆（暗夜萤光专用）：发光碎点四溅 + 双层冲击环 + 闪白 + 大光波 */
  G.splashBurst = (x, y, big) => {
    const n = big ? 26 : 16;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(140, big ? 520 : 360);
      const up = rand(90, big ? 300 : 210);                 // 垂直上抛分量（假 3D 迸溅）
      PUSH(fx.droplets, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - up,
        r: rand(2.2, big ? 7.5 : 5.5), life: rand(0.55, 1.05)
      }, 90);
    }
    // 双层冲击环（外环快、内环慢）
    PUSH(fx.shockwaves, { x, y, r: 10, life: 1, speed: big ? 560 : 420, w: big ? 7 : 5, color: "rgba(255,248,190,.95)" }, 12);
    PUSH(fx.shockwaves, { x, y, r: 6, life: 1, speed: big ? 330 : 250, w: big ? 4.5 : 3.5, color: "rgba(160,244,190,.9)" }, 12);
    // 命中点爆闪（半径快速外扩的实心光斑）
    PUSH(fx.shockwaves, { x, y, r: 4, life: 1, speed: 240, w: 22, color: "rgba(240,255,150,.95)", glow: true }, 12);
    fx.flash = Math.max(fx.flash, big ? 0.26 : 0.16);       // 全屏闪白（短暂，峰值压低护眼）
    // 大光波
    PUSH(fx.ripples, { x, y, r: 8, life: 1, miss: false, color: "rgba(226,255,140,.95)", big: true }, 30);
    PUSH(fx.ripples, { x, y, r: 20, life: 0.85, miss: false, color: "rgba(255,255,255,.8)", big: true }, 30);
    G.sparkBurst(x, y, "#f4ffa8", big ? 12 : 8);
  };
  G.ripple = (x, y, miss) => {
    if (G.scene.type !== "fish" && G.scene.type !== "pool") return;
    const th = G.seaThemeNow();
    const col = G.scene.type === "pool"
      ? (miss ? null : "rgba(226,255,150,.9)")
      : (miss ? null : (th && th.ripple));
    PUSH(fx.ripples, { x, y, r: 6, life: 1, miss: !!miss, color: col }, 30);
  };
  G.laserTrail = (x, y, key) => PUSH(fx.trails, { x, y, life: 0.4, key: key || "red" }, 30);
  G.laserFlash = (x, y, key) => PUSH(fx.scorches, { x, y, life: 0.32, flash: true, key: key || "red" }, 20);
  G.scorch = (x, y) => PUSH(fx.scorches, { x, y, life: 1.05 }, 20);
  G.petalBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.petals, { x, y, vx: rand(-50, 50), vy: rand(-50, 10), rot: rand(0, 6.28), life: rand(0.8, 1.5) }, 40); };
  G.pawPrint = (x, y, dir) => PUSH(fx.paws, { x, y, dir, life: 1 }, 26);
  G.floatText = (x, y, text, kind) => PUSH(fx.floats, { x, y, text, kind: kind || "", life: 1 }, 20);

  fx.update = (dt, t) => {
    // 海底环境粒子：按海域主题分流——气泡 / 荧光浮游 / 雪絮 / 孢子
    if (G.scene.type === "fish" && G.session.running) {
      fx.ambientT += dt;
      const th = G.seaThemeNow();
      const amb = (th && th.amb) || "bubble";
      const interval = amb === "snow" ? 0.35 : amb === "plankton" ? 0.7 : 1.2;
      if (fx.ambientT > interval) {
        fx.ambientT = 0;
        const W = G.platform.W, H = G.platform.H;
        if (amb === "plankton") {
          // 荧光浮游：全屏缓漂的小光点（深海）
          PUSH(fx.pollen, {
            x: rand(0, W), y: rand(H * 0.15, H * 0.95), vx: rand(-6, 6), vy: rand(-9, -2),
            r: rand(1.2, 2.8), life: rand(4, 7), ambient: true, glow: ["#7fe7ff", "#57e0c8", "#9d8cff"][Math.floor(rand(0, 3))]
          }, 90);
        } else if (amb === "snow") {
          // 雪絮：自上而下飘落（冰海）
          PUSH(fx.dust, {
            x: rand(0, W), y: -8, vx: rand(-10, 10), vy: rand(26, 48),
            r: rand(1.6, 3.6), life: rand(5, 8), ambient: true, snow: true
          }, 90);
        } else if (amb === "spore") {
          // 孢子：从水草丛向上飘的绿色小点（水草森林）
          PUSH(fx.pollen, {
            x: rand(0, W), y: H * rand(0.75, 1), vx: rand(-8, 8), vy: rand(-16, -6),
            r: rand(1.4, 3), life: rand(3.5, 6), ambient: true, glow: "#b8f08a"
          }, 90);
        } else {
          // 气泡（珊瑚海，原行为）
          PUSH(fx.bubbles, { x: rand(10, W - 10), y: H + 8, r: rand(2.5, 6), vy: rand(-46, -22), vx: 0, life: rand(3, 5), ambient: true }, 60);
        }
      }
    }
    const step = (arr, fn) => { for (let i = arr.length - 1; i >= 0; i--) { const p = arr[i]; p.life -= dt; if (fn(p, dt) === false || p.life <= 0) arr.splice(i, 1); } };
    step(fx.bubbles, (p, d) => { p.y += p.vy * d; p.x += Math.sin(t * 3 + p.y * 0.05) * 0.5 + (p.vx || 0) * d; if (p.ambient && p.y < G.platform.H * 0.15) return false; });
    step(fx.dust, (p, d) => {
      if (p.snow) { p.x += p.vx * d + Math.sin(t * 1.4 + p.y * 0.03) * 0.6; p.y += p.vy * d; if (p.y > G.platform.H + 8) return false; return; }
      p.x += p.vx * d; p.y += p.vy * d; p.vy += 120 * d;
    });
    step(fx.pollen, (p, d) => {
      p.x += p.vx * d + Math.sin(t * 2 + p.y) * 0.4; p.y += p.vy * d;
      if (p.ambient && (p.y < -10 || p.y > G.platform.H + 10)) return false;
    });
    step(fx.scales, (p, d) => { p.x += p.vx * d; p.y += p.vy * d; p.vx *= 0.96; });
    step(fx.sparks, (p, d) => { p.x += p.vx * d; p.y += p.vy * d; p.vx *= 0.9; p.vy = p.vy * 0.9 + 300 * d; });
    step(fx.ripples, (p, d) => { p.r += (p.big ? 160 : 90) * d; });
    /* 水珠：抛物线上抛 + 重力回落，落点再补一圈小涟漪 */
    step(fx.droplets, (p, d) => {
      p.x += p.vx * d; p.y += p.vy * d;
      p.vy += 560 * d; p.vx *= 0.995;
      if (p.y > G.platform.H - 4 && p.vy > 0) return false;
    });
    step(fx.shockwaves, (p, d) => {
      p.r += p.speed * d;
      p.w = Math.max(0.6, p.w - d * (p.glow ? 30 : 10));
    });
    if (fx.flash > 0) fx.flash = Math.max(0, fx.flash - dt * 3.2);   // 闪白 ~0.3s 衰减完
    step(fx.trails, () => {});
    step(fx.scorches, () => {});
    step(fx.petals, (p, d) => { p.x += p.vx * d; p.y += p.vy * d; p.vy += 60 * d; p.rot += 3 * d; });
    step(fx.paws, () => {});
    /* 飘字：上浮稍快 + 加速淡出（额外 -0.7*dt），缩短猫咪可追逐窗口 */
    step(fx.floats, (p, d) => { p.y -= 40 * d; p.life -= d * 0.7; });
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
      ctx.globalAlpha = p.snow ? Math.min(p.life * 0.5, 0.8) : Math.min(p.life * 1.4, 0.5);
      ctx.fillStyle = p.snow ? "#ffffff" : "#c9b28c";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.snow ? 1 : (1.4 - p.life * 0.5)), 0, Math.PI * 2); ctx.fill();
    });
    fx.pollen.forEach(p => {
      ctx.globalAlpha = Math.min(p.life, 0.9);
      ctx.fillStyle = p.glow || "#ffe27a";
      if (p.glow) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = Math.min(p.life, 0.95);
      }
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
      ctx.fillStyle = p.c || fx.sparkColor || "#ffd76a";   // 逐粒子颜色（多彩爆发靠它）
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    fx.ripples.forEach(p => {
      ctx.globalAlpha = Math.max(p.life * (p.miss ? 0.3 : 0.85), 0);
      const col = p.miss ? "rgba(255,255,255,.3)" : (p.color || "rgba(255,255,255,.85)");
      ctx.strokeStyle = col; ctx.lineWidth = p.miss ? 2 : (p.big ? 4.5 : 3);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
    });
    /* 光爆碎点：黄绿发光小球（暗底上高亮） */
    fx.droplets.forEach(p => {
      const a = Math.min(p.life * 1.5, 0.95);
      ctx.globalAlpha = a;
      const rg = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 0, p.x, p.y, p.r);
      rg.addColorStop(0, "#ffffff");
      rg.addColorStop(0.5, "#f2ff9c");
      rg.addColorStop(1, "rgba(150,240,130,.5)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    /* 冲击环：glow=true 时光斑实心扩散，否则空心环 */
    fx.shockwaves.forEach(p => {
      const a = Math.max(p.life, 0);
      ctx.globalAlpha = a * (p.glow ? 0.55 : 0.9);
      if (p.glow) {
        const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        rg.addColorStop(0, p.color);
        rg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.w;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
    fx.trails.forEach(p => {
      const cs = (G.laserColorSet && G.laserColorSet())[p.key] || G.laserColorSet().red;
      ctx.globalAlpha = Math.max(p.life * 0.8, 0);
      ctx.fillStyle = cs.trail;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 * p.life, 0, Math.PI * 2); ctx.fill();
    });
    fx.scorches.forEach(p => {
      const a = Math.max(p.life, 0);
      const cs = (G.laserColorSet && G.laserColorSet())[p.key] || G.laserColorSet().red;
      if (p.flash) {
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = cs.flash; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 34 * (1 - a) + 8, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.globalAlpha = a * 0.55;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
        g.addColorStop(0, cs.burn[0]);
        g.addColorStop(1, cs.burn[1]);
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
    /* 飘字反馈刻意低调：小字号 + 半透明 + 细描边，避免猫咪把"+1"等文字当成猎物追逐 */
    fx.floats.forEach(p => {
      const a = Math.min(p.life * 1.6, 0.62);            // 整体压低不透明度（≤0.62）
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      if (p.kind === "big") { ctx.font = "bold 14px sans-serif"; ctx.fillStyle = "rgba(255,222,140,.85)"; ctx.strokeStyle = "rgba(30,24,10,.3)"; ctx.lineWidth = 2; ctx.strokeText(p.text, p.x, p.y); }
      else if (p.kind === "hint") { ctx.font = "12px sans-serif"; ctx.fillStyle = "rgba(255,255,255,.78)"; ctx.strokeStyle = "rgba(8,30,44,.4)"; ctx.lineWidth = 2.5; ctx.strokeText(p.text, p.x, p.y); }
      else { ctx.font = "11px sans-serif"; ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.strokeStyle = "rgba(20,30,40,.28)"; ctx.lineWidth = 2; ctx.strokeText(p.text, p.x, p.y); }
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
    /* 命中闪白：全屏罩一层（drawGameFrame 在 UI 之前调 fx.draw，
       所以闪白只盖玩法层、不盖 HUD/结算按钮，亮度峰值已被 splashBurst 压低） */
    if (fx.flash > 0) {
      ctx.globalAlpha = Math.min(fx.flash, 0.3);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, G.platform.W, G.platform.H);
      ctx.globalAlpha = 1;
    }
  };
  fx.clear = () => {
    Object.keys(fx).forEach(k => { if (Array.isArray(fx[k])) fx[k].length = 0; });
    fx.flash = 0;
  };
};
