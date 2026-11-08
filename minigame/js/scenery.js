/* scenery.js — 四套布景（海底/花园/室内/暗室）+ 粒子特效系统 */
module.exports = function (G) {
  const rand = G.rand;
  G.scene = { type: null };
  G.gardenFlowers = [];   // 供蝴蝶降落的花（{x,y,color,nudgeT}）

  /* ================= 布景构建 ================= */
  G.buildScene = (type) => {
    const W = G.platform.W, H = G.platform.H;
    const S = { type, W, H, floorY: type === "mouse" ? H * 0.2 : H * 0.68, holes: [], holeOwners: [], holeHeat: [], dark: type === "laser" };
    S.night = type === "butterfly" && G.currentBg() === "night";
    G.scene = S;
    G.gardenFlowers = [];
    // 捕鼠可选背景：room（室内房间，默认）/ plaid（深色格纹地毯）
    S.mouseBg = type === "mouse" ? G.currentBg() : "default";
    if (type === "mouse" && S.mouseBg === "plaid") {
      // 整屏格纹地毯：格子边长随屏取，横竖屏都好铺
      S.plaid = { cell: Math.max(64, Math.round(Math.min(W, H) / 4.6)) };
    }

    // 只有 room（或激光暗室）才生成墙/窗/家具/地毯；plaid、swarm 是整屏铺满的纯地面背景
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
    if (type === "mouse" && S.mouseBg === "swarm") {
      // 群鼠乱窜地板：深色底 + 大块暗斑（参考图的斑驳石地）；无洞口、无家具
      S.swarmSpots = [];
      const nsp = Math.floor(rand(9, 13.99));
      for (let i = 0; i < nsp; i++) S.swarmSpots.push({
        x: rand(0, W), y: rand(0, H), rx: rand(60, 150), ry: rand(40, 110),
        rot: rand(0, Math.PI), a: rand(0.08, 0.2), lite: Math.random() < 0.3
      });
    }
    if (type === "mouse" && S.mouseBg !== "swarm") {
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
      // 石头（泳池主题为开阔池水，不放石头/水草/底床装饰）
      S.stones = [];
      const pool = th.decor === "pool";
      const sn = pool ? 0 : Math.floor(rand(3, 5.99));
      for (let i = 0; i < sn; i++) {
        const w = rand(30, 88);
        S.stones.push({ x: rand(4, Math.max(W - w - 8, 8)), y: H - rand(10, 26) - 14, w, h: w * rand(0.55, 0.75), rot: rand(-8, 8) * Math.PI / 180, tone: rand(0, 1) });
      }
      // 水草（每丛 2~3 叶；水草森林主题加密加高）
      S.plants = [];
      const kelp = th.decor === "kelp";
      const pn = pool ? 0 : Math.floor(rand(kelp ? 7 : 4, kelp ? 10.99 : 6.99));
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
      // 泳池主题专属：焦散网格间距 + 四角星芒（对齐泳池玩具参考图的网状光网 + 星光点）
      if (th.decor === "pool") {
        S.poolNet = { cs: Math.max(56, Math.round(Math.min(W, H) / 5.8)) };
        S.poolStars = [];
        const ns = Math.round(G.clamp(Math.min(W, H) / 85, 7, 13));
        for (let i = 0; i < ns; i++) S.poolStars.push({
          x: rand(0.06, 0.94), y: rand(0.08, 0.92), r: rand(5, 12),
          ph: rand(0, Math.PI * 2), f: rand(0.6, 1.5), dx: rand(4, 12)
        });
      }
    }
    if (type === "pool") {
      /* 第一版萤光：深色石板地 + 环境萤尘（微光点缓漂呼吸），不再轮换主题。 */
      S._groundSeed = Math.floor(rand(0, 1e9));
      S.poolMix = false;
      S.poolTheme = 0;
      S.poolShift = null;
      S._lastShiftTime = -999;
      // 环境萤尘：微光点缓漂 + 呼吸发光，是暗场里的"夜气"
      S.dust = [];
      const nd = Math.round(G.clamp(Math.min(W, H) / 26, 16, 42));
      for (let i = 0; i < nd; i++) S.dust.push({
        x: rand(0, W), y: rand(0, H), r: rand(0.8, 2.2),
        ph: rand(0, Math.PI * 2), sp: rand(4, 12),
        a: rand(0.10, 0.30), br: rand(0.5, 1.4)
      });
    }
    if (type === "frog") {
      /* 夏夜荷塘：开局 3×2 共 6 片荷叶；第④阶段由 G.rebuildFrogPads(4) 换成连片密布的大小混排布景。 */
      G.rebuildFrogPads(1);
      // 芦苇剪影：贴左右两侧，弱对比不抢戏
      S.reeds = [];
      for (let i = 0; i < 7; i++) {
        const left = i % 2 === 0;
        S.reeds.push({
          x: left ? rand(2, W * 0.06) : rand(W * 0.94, W - 2),
          y: H * rand(0.42, 0.98), h: rand(70, 150), ph: rand(0, Math.PI * 2)
        });
      }
      // 水面微光：暖黄小光点慢漂
      S.pondDust = [];
      const nf = Math.round(G.clamp(Math.min(W, H) / 46, 8, 16));
      for (let i = 0; i < nf; i++) S.pondDust.push({
        x: rand(0, W), y: rand(0, H), r: rand(1.4, 2.8),
        ph: rand(0, Math.PI * 2), sp: rand(3, 8), amp: rand(5, 14),
        hue: Math.random() < 0.7 ? "214,255,170" : "255,238,170"
      });
      // 小浮萍：飘在水面的碎叶，填充空白但不抢戏
      S.duckweed = [];
      for (let i = 0; i < 9; i++) S.duckweed.push({
        x: rand(W * 0.04, W * 0.96), y: rand(H * 0.3, H * 0.95),
        r: rand(6, 13), n: Math.floor(rand(2, 4.99)), rot: rand(0, 6.28), ph: rand(0, 6.28)
      });
      // 远景水波条（横向缓移的高光带）
      S.glints = [];
      for (let i = 0; i < 16; i++) S.glints.push({
        x: rand(0, W), y: rand(0, H), w: rand(18, 64), a: rand(0.03, 0.08), sp: rand(3, 9), ph: rand(0, 6.28)
      });
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
    // 泳池追鱼：整屏泳池布景（渐变池水 + 阳光 + 网状焦散 + 星芒 + 猫爪），无沙床/石头/水草
    if (th.decor === "pool") { drawPoolSea(ctx, t); return; }
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
    // 鱼群巡游：鱼团底一大团银白柔光（把整群鱼托成"一团亮光"；画在鱼层之下）
    if (th.decor === "school") {
      const fish = (G.preys || []).filter(q => q.type === "fish" && q.vx != null);
      if (fish.length) {
        let cx = 0, cy = 0;
        fish.forEach(f => { cx += f.x; cy += f.y; });
        cx /= fish.length; cy /= fish.length;
        let r = 0;
        fish.forEach(f => { r = Math.max(r, Math.hypot(f.x - cx, f.y - cy)); });
        const rr = Math.max(r * 1.9, 130);
        const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        gg.addColorStop(0, "rgba(228,246,255,.30)");
        gg.addColorStop(0.55, "rgba(190,232,255,.13)");
        gg.addColorStop(1, "rgba(190,232,255,0)");
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
      }
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

  /* ============ 泳池追鱼布景（对齐泳池玩具参考图；玩家是猫，画面只留水景） ============
     亮蓝池水纵向渐变 + 阳光辉光/光柱 + 网状焦散光网（不规则格点缓漂连网，
     青白细线双层 + 亮斑呼吸）+ 四角星芒闪烁 */
  const vhash = (i, j, k) => {                    // 确定性格点杂湊（焦散网顶点漂移相位）
    const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  function drawPoolSea(ctx, t) {
    const S = G.scene, W = S.W, H = S.H;
    // 池水：纵向渐变（浅亮天蓝 → 钴蓝，阳光泳池）
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#41b7ee"); g.addColorStop(0.36, "#1e8fdc");
    g.addColorStop(0.72, "#1560b8"); g.addColorStop(1, "#0e4a9e");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 顶部阳光辉光
    g = ctx.createRadialGradient(W * 0.5, -H * 0.3, 0, W * 0.5, -H * 0.3, Math.max(W, H) * 0.95);
    g.addColorStop(0, "rgba(255,255,255,.28)"); g.addColorStop(0.45, "rgba(255,255,255,.10)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 阳光光柱（泳池比海域更透亮）
    for (let i = 0; i < 3; i++) {
      const lx = W * (0.16 + i * 0.31) + Math.sin(t * 0.3 + i) * 14;
      const lg = ctx.createLinearGradient(lx, 0, lx + 60, H);
      lg.addColorStop(0, "rgba(215,245,255,.20)"); lg.addColorStop(1, "rgba(215,245,255,0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(lx, 0); ctx.lineTo(lx + 56, 0); ctx.lineTo(lx + 132, H); ctx.lineTo(lx + 30, H);
      ctx.closePath(); ctx.fill();
    }
    drawPoolCaustics(ctx, t, W, H);               // 网状焦散光网 + 光斑
    drawPoolStars(ctx, t);                        // 四角星芒（最上层的闪亮光点）
  }

  /* 网状焦散：格点随时间正弦合成缓漂（无状态、确定性），连成不规则网格；
     每条边两遍描边（宽柔光 + 细亮线），透明度按各自相位呼吸 → 光网流动闪烁。
     性能：整层画到离屏 canvas，每 ~1/24s 才重绘一次（2~3 帧一换），主循环只做一次 drawImage */
  const poolCausticsCache = { cv: null, ctx: null, frame: -1 };
  function drawPoolCaustics(ctx, t, W, H) {
    const dpr = G.platform.dpr || 2;
    if (!poolCausticsCache.cv) {
      const mk = (typeof wx !== "undefined" && wx.createCanvas) ? () => wx.createCanvas() : () => document.createElement("canvas");
      poolCausticsCache.cv = mk();
      poolCausticsCache.cv.width = Math.ceil(W * dpr);
      poolCausticsCache.cv.height = Math.ceil(H * dpr);
      poolCausticsCache.ctx = poolCausticsCache.cv.getContext("2d");
    }
    const f = Math.floor(t * 24);
    if (f !== poolCausticsCache.frame) {
      poolCausticsCache.frame = f;
      const c2 = poolCausticsCache.ctx;
      c2.setTransform(1, 0, 0, 1, 0, 0);
      c2.clearRect(0, 0, poolCausticsCache.cv.width, poolCausticsCache.cv.height);
      c2.scale(dpr, dpr);
      const S = G.scene;
      const cs = (S.poolNet && S.poolNet.cs) || 76;
      const cols = Math.ceil(W / cs), rows = Math.ceil(H / cs);
      const vx = (i, j) => i * cs + Math.sin(t * 0.30 + vhash(i, j, 1) * 6.283 + j * 0.53) * cs * 0.30
                          + Math.sin(t * 0.16 + vhash(i, j, 3) * 6.283) * cs * 0.12;
      const vy = (i, j) => j * cs + Math.cos(t * 0.26 + vhash(i, j, 2) * 6.283 + i * 0.47) * cs * 0.30
                          + Math.cos(t * 0.13 + vhash(i, j, 4) * 6.283) * cs * 0.12;
      const edge = (x1, y1, x2, y2) => {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
        const bow = Math.sin(t * 0.7 + mx * 0.028 + my * 0.02) * cs * 0.09;
        c2.beginPath();
        c2.moveTo(x1, y1);
        c2.quadraticCurveTo(mx - dy / L * bow, my + dx / L * bow, x2, y2);
        c2.stroke();
      };
      c2.save();
      c2.globalCompositeOperation = "lighter";
      c2.lineCap = "round";
      // 亮斑：格内四边形淡填充（呼吸），对比度压低（长时间看不疲劳）
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const sh = 0.5 + 0.5 * Math.sin(t * 1.1 + vhash(i, j, 5) * 6.283);
        const a = 0.012 + 0.034 * sh * sh;
        const p = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(q => ({ x: vx(q[0], q[1]), y: vy(q[0], q[1]) }));
        const mid = (a2, b2) => ({ x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 });
        const m = mid(p[3], p[0]);
        c2.beginPath(); c2.moveTo(m.x, m.y);
        for (let k = 0; k < 4; k++) { const n = mid(p[k], p[(k + 1) % 4]); c2.quadraticCurveTo(p[k].x, p[k].y, n.x, n.y); }
        c2.closePath();
        c2.fillStyle = "rgba(170,235,255," + a.toFixed(3) + ")";
        c2.fill();
      }
      // 网线：两遍（宽柔光打底 + 细亮线提神），透明度整体压低
      for (let pass = 0; pass < 2; pass++) {
        c2.strokeStyle = pass ? "rgba(200,245,255,.85)" : "rgba(120,210,255,.35)";
        c2.lineWidth = pass ? 1.5 : 4.2;
        for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
          const sh = 0.55 + 0.45 * Math.sin(t * 1.25 + vhash(i, j, 6) * 6.283);
          c2.globalAlpha = (pass ? 0.22 : 0.15) * (0.35 + 0.65 * sh);
          const x1 = vx(i, j), y1 = vy(i, j);
          if (i < cols) edge(x1, y1, vx(i + 1, j), vy(i + 1, j));
          if (j < rows) edge(x1, y1, vx(i, j + 1), vy(i, j + 1));
        }
      }
      c2.globalAlpha = 1;
      c2.restore();
    }
    ctx.drawImage(poolCausticsCache.cv, 0, 0, W, H);
  }

  /* 四角星芒：全屏稀疏的十字星光点，呼吸闪烁 + 缓慢漂移（lighter 叠加） */
  function drawPoolStars(ctx, t) {
    const S = G.scene, W = S.W, H = S.H;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    (S.poolStars || []).forEach(st => {
      const tw = 0.5 + 0.5 * Math.sin(t * st.f + st.ph);
      const a = (0.38 + 0.62 * tw * tw) * 0.95;
      const r = st.r * (0.68 + 0.42 * tw);
      const x = st.x * W + Math.sin(t * 0.22 + st.ph) * st.dx;
      const y = st.y * H + Math.cos(t * 0.17 + st.ph * 1.3) * st.dx * 0.6;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
      rg.addColorStop(0, "rgba(215,246,255," + (a * 0.45).toFixed(2) + ")");
      rg.addColorStop(1, "rgba(215,246,255,0)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(240,252,255," + a.toFixed(2) + ")";
      const dia = (rx, ry) => {                   // 细长菱形（十字星的一支）
        ctx.beginPath();
        ctx.moveTo(x - rx, y); ctx.lineTo(x, y - ry); ctx.lineTo(x + rx, y); ctx.lineTo(x, y + ry);
        ctx.closePath(); ctx.fill();
      };
      dia(r, r * 0.18); dia(r * 0.18, r);
    });
    ctx.restore();
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
    else if (S.type === "butterfly" && S.night) drawNight(ctx, t);
    else if (S.type === "butterfly") drawGarden(ctx, t);
    else if (S.type === "pool") drawPool(ctx, t);
    else if (S.type === "frog") drawPond(ctx, t);
    else if (S.type === "mouse" && S.mouseBg === "swarm") { drawSwarmFloor(ctx, t); }
    else if (S.type === "mouse" && S.mouseBg === "plaid") { drawPlaidFloor(ctx, t); drawHoles(ctx); }
    else { drawRoomBody(ctx, t); drawHoles(ctx); }
  };
  function drawNight(ctx, t) {
    const S=G.scene,W=S.W,H=S.H,phase=((G.session&&G.session.nightPhase)||0)%4;
    const skies=["#07172b","#10122f","#071c32","#15152a"], aura=["rgba(255,74,85,.14)","rgba(189,121,255,.14)","rgba(72,223,255,.14)","rgba(255,230,107,.14)"];
    ctx.fillStyle=skies[phase];ctx.fillRect(0,0,W,H);
    const rg=ctx.createRadialGradient(W*.5,H*.46,0,W*.5,H*.46,Math.max(W,H)*.72);rg.addColorStop(0,aura[phase]);rg.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=rg;ctx.fillRect(0,0,W,H);
    for(let i=0;i<52;i++){const x=(i*137.5+31)%W,y=(i*83.7+17)%H;ctx.fillStyle="rgba(194,229,255,"+(0.18+0.25*(.5+.5*Math.sin(t*1.7+i)))+")";ctx.beginPath();ctx.arc(x,y,1+(i%3)*.45,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle="rgba(4,11,23,.55)";ctx.fillRect(0,H*.82,W,H*.18);
  }
  /* 老鼠洞（后排先画，前排盖上面；两个背景共用） */
  function drawHoles(ctx) {
    const S = G.scene;
    S.holes.forEach((h, i) => { if (i % 2 === 0) G.draw.hole(ctx, h.x, h.y); });
    S.holes.forEach((h, i) => { if (i % 2 === 1) G.draw.hole(ctx, h.x, h.y); });
  }

  /* ============ 深色格纹地毯（Peppy Cat 式斜纹格布底） ============
     整屏铺满：墨绿黑底 + 45° 织纹 + 棋盘明暗格 + 格线，顶部压暗保证 HUD 可读。
     暗底让棕色老鼠与洞口边缘仍然清晰 */
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

  /* ============ 群鼠乱窜地板：深色斑驳石地（俯视群鼠模式，参考猫抓老鼠玩具） ============ */
  function drawSwarmFloor(ctx, t) {
    const S = G.scene, W = S.W, H = S.H;
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#28312a"); g.addColorStop(1, "#141a15");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 大块暗斑/浅斑：斑驳石地质感
    (S.swarmSpots || []).forEach(s => {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      ctx.fillStyle = s.lite ? "rgba(255,255,240," + (s.a * 0.35).toFixed(3) + ")" : "rgba(0,0,0," + s.a.toFixed(3) + ")";
      ctx.beginPath(); ctx.ellipse(0, 0, s.rx, s.ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    // 顶部压暗（HUD 可读）+ 四周暗角
    const tg = ctx.createLinearGradient(0, 0, 0, H * 0.3);
    tg.addColorStop(0, "rgba(0,0,0,.5)"); tg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.3);
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.3, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.4)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  /* ============ 兔子场所地面（旧草地/石板绘制保留但不再调用） ============
     当前只用 paintStone：深色石板地（第一版萤光场景）；paintRabbitFloor 等 theme 函数是历史备用
     两套都压得很暗（亮度中位数 < 40），让黄色发光玩具跳出来；
     纹理只在离屏 canvas 里画一次并缓存，运行时只 drawImage。 */
  const groundCache = {};
  /* ---------- 主题 0：暗夜草地（兔子） ----------
     深绿/枯黄的草叶 + 少量碎石，整体压暗；兔子蹲守时能融进草里，发光时又跳得出来。 */
  function paintGrass(c2, W, H, S) {
    let g = c2.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, "#28351e");
    g.addColorStop(0.52, "#1b2614");
    g.addColorStop(1, "#10170c");
    c2.fillStyle = g;
    c2.fillRect(0, 0, W, H);

    // 土色/草色的斑驳
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = (0.10 + Math.random() * 0.26) * Math.max(W, H);
      const rg = c2.createRadialGradient(x, y, 0, x, y, r);
      const dark = Math.random() < 0.55;
      rg.addColorStop(0, dark ? "rgba(10,14,8,.30)" : "rgba(96,100,54,.10)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      c2.fillStyle = rg;
      c2.beginPath(); c2.arc(x, y, r, 0, Math.PI * 2); c2.fill();
    }

    // 草叶：一次画进缓存（约千余根），长短/方向/颜色都随机
    const n = Math.round(W * H / 135);
    const PAL = ["#4f5e38", "#607047", "#738052", "#879267", "#5b4a2e", "#6b5a38", "#8a9160"];
    c2.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const ang = -Math.PI / 2 + rand(-0.62, 0.62);
      const len = rand(7, 24) * (0.7 + Math.random() * 0.8);
      const bend = rand(-5, 5);
      const mx = x + Math.cos(ang) * len * 0.5 - Math.sin(ang) * bend;
      const my = y + Math.sin(ang) * len * 0.5 + Math.cos(ang) * bend;
      c2.globalAlpha = rand(0.22, 0.64);
      c2.strokeStyle = PAL[Math.floor(Math.random() * PAL.length)];
      c2.lineWidth = rand(0.7, 1.7);
      c2.beginPath();
      c2.moveTo(x, y);
      c2.quadraticCurveTo(mx, my, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      c2.stroke();
    }
    c2.globalAlpha = 1;

    // 成簇的草：从同一个根部扇形长出来，避免全是散乱单根
    const clumps = Math.round(W * H / 16000);
    for (let c = 0; c < clumps; c++) {
      const cx = Math.random() * W, cy = Math.random() * H;
      for (let j = 0; j < 9; j++) {
        const ang = -Math.PI / 2 + rand(-0.95, 0.95);
        const len = rand(9, 23);
        const bend = rand(-3, 3);
        c2.globalAlpha = rand(0.22, 0.55);
        c2.strokeStyle = PAL[Math.floor(Math.random() * PAL.length)];
        c2.lineWidth = rand(0.7, 1.5);
        c2.beginPath();
        c2.moveTo(cx, cy);
        c2.quadraticCurveTo(cx + Math.cos(ang) * len * 0.5 - Math.sin(ang) * bend,
          cy + Math.sin(ang) * len * 0.5 + Math.cos(ang) * bend,
          cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
        c2.stroke();
      }
    }
    c2.globalAlpha = 1;

    // 草籽 / 碎石
    const dots = Math.round(W * H / 2200);
    for (let i = 0; i < dots; i++) {
      c2.fillStyle = Math.random() < 0.6 ? "rgba(120,120,70,.28)" : "rgba(70,62,44,.34)";
      c2.beginPath(); c2.arc(Math.random() * W, Math.random() * H, rand(0.7, 2.4), 0, Math.PI * 2); c2.fill();
    }

    // 中心微暖光 + 四周压暗
    const warm = c2.createRadialGradient(W * 0.5, H * 0.48, 0, W * 0.5, H * 0.48, Math.max(W, H) * 0.6);
    warm.addColorStop(0, "rgba(170,150,80,.07)");
    warm.addColorStop(0.6, "rgba(100,100,50,.025)");
    warm.addColorStop(1, "rgba(0,0,0,0)");
    c2.fillStyle = warm;
    c2.fillRect(0, 0, W, H);
    const vg = c2.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.2, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.30)");
    c2.fillStyle = vg;
    c2.fillRect(0, 0, W, H);
  }

  /* ---------- 备用石板墙（当前暗夜萤光已改用草地，保留给其他场景） ----------
     不规则的深棕灰石块 + 深缝 + 微弱受光边，整体压暗，衬托发光玩具。 */
  /* ---------- 第一版萤光石板地（按用户参考截图复刻） ----------
     暖灰棕大块圆角石板、宽黑缝、石面斜划痕；整体比旧版亮一档，衬萤火虫的暖光。 */
  function paintStone(c2, W, H, S) {
    c2.fillStyle = "#141009";
    c2.fillRect(0, 0, W, H);
    const ss = S || 1;

    const cols = Math.max(4, Math.round(W / (232 * ss)));
    const rows = Math.max(4, Math.round(H / (148 * ss)));
    const cw = W / cols, ch = H / rows;
    const seam = 10 * ss;                       // 黑缝宽（石板间留出的暗底）
    const rc = 16 * ss;                         // 石板圆角
    const pts = [];
    for (let r = 0; r <= rows; r++) {
      const row = [];
      for (let c = 0; c <= cols; c++) {
        row.push({
          x: c * cw + (c === 0 || c === cols ? 0 : rand(-0.16, 0.16) * cw),
          y: r * ch + (r === 0 || r === rows ? 0 : rand(-0.14, 0.14) * ch)
        });
      }
      pts.push(row);
    }
    // 暖棕灰石面（明暗随机、偏暖偏深，贴参考图）
    const PAL = ["#71675c", "#655c53", "#5c544b", "#7b7166", "#514a43", "#827768", "#6a6156"];
    // 圆角不规则四边形：顶点带抖动，各角用 arcTo 倒圆
    const rpoly = (P, r) => {
      c2.beginPath();
      for (let i = 0; i < 4; i++) {
        const q = P[i], nx = P[(i + 1) % 4], pv = P[(i + 3) % 4];
        const ex = nx.x - q.x, ey = nx.y - q.y, el = Math.hypot(ex, ey) || 1;
        const px = pv.x - q.x, py = pv.y - q.y, pl = Math.hypot(px, py) || 1;
        const rr2 = Math.min(r, el * 0.4, pl * 0.4);
        const sx = q.x + px / pl * rr2, sy = q.y + py / pl * rr2;
        if (i === 0) c2.moveTo(sx, sy); else c2.lineTo(sx, sy);
        c2.arcTo(q.x, q.y, q.x + ex / el * rr2, q.y + ey / el * rr2, rr2);
      }
      c2.closePath();
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const raw = [pts[r][c], pts[r][c + 1], pts[r + 1][c + 1], pts[r + 1][c]];
        const cx = (raw[0].x + raw[1].x + raw[2].x + raw[3].x) / 4;
        const cy = (raw[0].y + raw[1].y + raw[2].y + raw[3].y) / 4;
        // 各顶点向中心收 seam/2，留出黑缝
        const Q = raw.map(q => {
          const dx = cx - q.x, dy = cy - q.y, dl = Math.hypot(dx, dy) || 1;
          const k = seam * 0.5 / dl;
          return { x: q.x + dx * k, y: q.y + dy * k };
        });
        const x0 = Math.min(Q[0].x, Q[3].x), y0 = Math.min(Q[0].y, Q[1].y);
        const x1 = Math.max(Q[1].x, Q[2].x), y1 = Math.max(Q[3].y, Q[2].y);
        if (x1 - x0 <= rc * 2 || y1 - y0 <= rc * 2) continue;
        const base = PAL[Math.floor(rand(0, PAL.length))];
        const sg = c2.createLinearGradient(x0, y0, x1, y1);
        sg.addColorStop(0, shade(base, 12)); sg.addColorStop(0.55, base); sg.addColorStop(1, shade(base, -14));
        c2.fillStyle = sg;
        rpoly(Q, rc);
        c2.fill();
        // 上沿受光 + 下沿落影
        c2.strokeStyle = "rgba(255,236,200,.10)"; c2.lineWidth = 1.6 * ss;
        c2.beginPath(); c2.moveTo(Q[0].x + rc, Q[0].y); c2.lineTo(Q[1].x - rc, Q[1].y); c2.stroke();
        c2.strokeStyle = "rgba(0,0,0,.30)"; c2.lineWidth = 2.0 * ss;
        c2.beginPath(); c2.moveTo(Q[3].x + rc, Q[3].y); c2.lineTo(Q[2].x - rc, Q[2].y); c2.stroke();
        // 斜划痕：约四成石面有 1~2 条细斜线
        const bw = x1 - x0, bh = y1 - y0;
        const ns = Math.random() < 0.42 ? (Math.random() < 0.3 ? 2 : 1) : 0;
        for (let i = 0; i < ns; i++) {
          const sx = rand(x0 + bw * 0.15, x1 - bw * 0.15), sy = rand(y0 + bh * 0.2, y1 - bh * 0.2);
          const len = rand(bw * 0.18, bw * 0.42), k = rand(-0.5, 0.5);
          c2.strokeStyle = "rgba(46,36,26," + rand(0.14, 0.26).toFixed(2) + ")";
          c2.lineWidth = Math.max(0.8, 1.1 * ss);
          c2.beginPath(); c2.moveTo(sx - len / 2, sy - len / 2 * k - len * 0.2); c2.lineTo(sx + len / 2, sy + len / 2 * k + len * 0.2); c2.stroke();
        }
      }
    }
    // 细碎颗粒噪点
    const n = Math.round(W * H / 900);
    for (let i = 0; i < n; i++) {
      c2.fillStyle = "rgba(215,200,180," + rand(0.02, 0.05).toFixed(3) + ")";
      c2.fillRect(rand(0, W), rand(0, H), rand(0.7, 1.8), rand(0.7, 1.8));
    }
    // 中心暖光 + 轻暗角（drawPool 还会再压一层暗角，这里收着点）
    const warm = c2.createRadialGradient(W * 0.5, H * 0.48, 0, W * 0.5, H * 0.48, Math.max(W, H) * 0.6);
    warm.addColorStop(0, "rgba(255,190,110,.07)");
    warm.addColorStop(0.6, "rgba(150,100,60,.03)");
    warm.addColorStop(1, "rgba(0,0,0,0)");
    c2.fillStyle = warm;
    c2.fillRect(0, 0, W, H);
    const vg = c2.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.30, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.18)");
    c2.fillStyle = vg;
    c2.fillRect(0, 0, W, H);
  }

  /* 十六进制颜色明暗调整（+亮 / -暗），石面渐变用 */
  function shade(hex, amt) {
    const v = parseInt(hex.slice(1), 16);
    const ch = (v >> 16) + amt, cg = ((v >> 8) & 255) + amt, cb = (v & 255) + amt;
    return "#" + ((1 << 24) + (Math.max(0, Math.min(255, ch)) << 16)
      + (Math.max(0, Math.min(255, cg)) << 8) + Math.max(0, Math.min(255, cb))).toString(16).slice(1);
  }

  function paintMat(c2, W, H, S) {
    /* 底：墨绿到近黑，保留一点布料在夜里的暖色 */
    let g = c2.createLinearGradient(0, 0, W * 0.45, H);
    g.addColorStop(0, "#171c13");
    g.addColorStop(0.55, "#11160f");
    g.addColorStop(1, "#0a0e0a");
    c2.fillStyle = g;
    c2.fillRect(0, 0, W, H);

    /* 斜一点的深色格子：两种近黑交替。为了低端机首帧不卡，格子只做纯色铺底，
       织纹和接缝用几次全局描线完成（不要每格建渐变/描边，900 格会拖慢启动）。 */
    const cs = Math.max(54, Math.min(112, Math.min(W, H) / 6.2));
    const R = Math.hypot(W, H);
    const c0 = Math.floor(-R / cs), c1 = Math.ceil(R / cs);
    c2.save();
    c2.translate(W / 2, H / 2);
    c2.rotate(-0.07);
    for (let r = c0; r <= c1; r++) {
      for (let c = c0; c <= c1; c++) {
        const alt = ((c + r) & 1) === 0;
        c2.fillStyle = alt ? "#1a1e11" : "#0c110c";
        c2.fillRect(c * cs, r * cs, cs + 0.5, cs + 0.5);
      }
    }
    // 斜织纹：整片一次画完（45° 细线，横向约 260 条）
    c2.strokeStyle = "rgba(146,132,82,.045)";
    c2.lineWidth = 1;
    for (let k = -2 * R; k <= 2 * R; k += 7) {
      c2.beginPath();
      c2.moveTo(k - R, -R);
      c2.lineTo(k + R, R);
      c2.stroke();
    }
    // 格子接缝：整片横竖各几十条
    c2.strokeStyle = "rgba(0,0,0,.30)";
    c2.lineWidth = 1.4;
    for (let c = c0; c <= c1 + 1; c++) {
      c2.beginPath(); c2.moveTo(c * cs, c0 * cs); c2.lineTo(c * cs, (c1 + 1) * cs); c2.stroke();
      c2.beginPath(); c2.moveTo(c0 * cs, c * cs); c2.lineTo((c1 + 1) * cs, c * cs); c2.stroke();
    }
    c2.restore();

    /* 布料细颗粒（远看是绒面，近看有杂色） */
    const n = Math.round(W * H / 620);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const a = 0.02 + Math.random() * 0.05;
      c2.fillStyle = (Math.random() < 0.5 ? "rgba(210,190,130," : "rgba(90,150,120,") + a.toFixed(3) + ")";
      c2.fillRect(x, y, 1 + Math.random() * 1.4, 1 + Math.random() * 1.4);
    }

    /* 中心一团很淡的暖光：像玩具本身把垫子照亮了一圈 */
    const warm = c2.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, Math.max(W, H) * 0.55);
    warm.addColorStop(0, "rgba(150,116,62,.10)");
    warm.addColorStop(0.55, "rgba(110,86,48,.045)");
    warm.addColorStop(1, "rgba(0,0,0,0)");
    c2.fillStyle = warm;
    c2.fillRect(0, 0, W, H);
  }

  function paintWood(c2, W, H, S) {
    /* 底：深棕木色 */
    let g = c2.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, "#25150a");
    g.addColorStop(0.55, "#1a0e06");
    g.addColorStop(1, "#100804");
    c2.fillStyle = g;
    c2.fillRect(0, 0, W, H);

    /* 横向木板：板宽固定、板长随机，接缝压在下面 */
    const rowH = Math.max(64, Math.min(112, H / 8));
    const PAL = ["#35200e", "#3d2511", "#2e1c0c", "#422913", "#281609"];
    for (let y = -rowH; y < H + rowH; y += rowH) {
      const base = PAL[Math.floor(Math.random() * PAL.length)];
      c2.fillStyle = base;
      c2.fillRect(0, y, W, rowH - 2);
      // 板面上亮下暗
      const vg = c2.createLinearGradient(0, y, 0, y + rowH);
      vg.addColorStop(0, "rgba(255,206,140,.075)");
      vg.addColorStop(0.5, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,.28)");
      c2.fillStyle = vg;
      c2.fillRect(0, y, W, rowH - 2);
      // 木纹：几条缓慢起伏的深/浅线
      for (let i = 0; i < 9; i++) {
        const gy = y + 4 + Math.random() * (rowH - 10);
        const amp = 1 + Math.random() * 4;
        c2.strokeStyle = Math.random() < 0.5 ? "rgba(18,8,2,.20)" : "rgba(255,196,120,.055)";
        c2.lineWidth = 0.7 + Math.random() * 1.2;
        c2.beginPath();
        c2.moveTo(-10, gy);
        for (let x = 0; x <= W + 20; x += 46) {
          c2.lineTo(x, gy + Math.sin((x + i * 37) * 0.012) * amp);
        }
        c2.stroke();
      }
      // 竖向拼缝（有的板从中间断开）
      if (Math.random() < 0.7) {
        const jx = Math.random() * W;
        c2.strokeStyle = "rgba(10,4,1,.55)";
        c2.lineWidth = 2;
        c2.beginPath(); c2.moveTo(jx, y); c2.lineTo(jx + (Math.random() * 12 - 6), y + rowH); c2.stroke();
      }
      // 板底接缝
      c2.fillStyle = "rgba(8,3,1,.62)";
      c2.fillRect(0, y + rowH - 2, W, 2);
      // 偶尔一个木节
      if (Math.random() < 0.35) {
        const kx = Math.random() * W, ky = y + rowH * (0.35 + Math.random() * 0.3);
        const kg = c2.createRadialGradient(kx, ky, 0, kx, ky, rowH * 0.18);
        kg.addColorStop(0, "rgba(12,5,1,.55)");
        kg.addColorStop(0.55, "rgba(40,20,6,.30)");
        kg.addColorStop(1, "rgba(0,0,0,0)");
        c2.fillStyle = kg;
        c2.beginPath(); c2.ellipse(kx, ky, rowH * 0.18, rowH * 0.10, 0, 0, Math.PI * 2); c2.fill();
      }
    }

    /* 中心暖光 + 轻微暗角（drawPool 还会再压一层暗角） */
    const warm = c2.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, Math.max(W, H) * 0.6);
    warm.addColorStop(0, "rgba(255,186,104,.065)");
    warm.addColorStop(0.6, "rgba(130,80,30,.025)");
    warm.addColorStop(1, "rgba(0,0,0,0)");
    c2.fillStyle = warm;
    c2.fillRect(0, 0, W, H);
    const vg = c2.createRadialGradient(W * 0.5, H * 0.48, Math.min(W, H) * 0.20, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.30)");
    c2.fillStyle = vg;
    c2.fillRect(0, 0, W, H);
  }

  /* ---------- 兔子场所：深棕竖直木纹地板（按 29.8s 实拍视频取样） ----------
     取样底色 #28170D；木板竖直排列、板缝 1.5px，板内是沿 y 方向缓慢起伏的细纹，
     加少量横向端缝与木节。一次性画进离屏 canvas 缓存，运行时只 drawImage。 */
  function paintRabbitFloor(c2, W, H) {
    const bg = c2.createLinearGradient(0, 0, W * 0.35, H);
    bg.addColorStop(0, "#2c1a0e");
    bg.addColorStop(0.55, "#211309");
    bg.addColorStop(1, "#160b05");
    c2.fillStyle = bg; c2.fillRect(0, 0, W, H);

    const cols = Math.max(7, Math.round(W / 46));
    const cw = W / cols;
    const PAL = ["#33200f", "#3a2512", "#2c1b0c", "#402914", "#2a180b", "#37220f"];
    for (let c = 0; c < cols; c++) {
      const x = c * cw;
      c2.fillStyle = PAL[Math.floor(Math.random() * PAL.length)];
      c2.fillRect(x, 0, cw - 1.6, H);
      // 板面左右明暗（立体感）
      const vg = c2.createLinearGradient(x, 0, x + cw, 0);
      vg.addColorStop(0, "rgba(0,0,0,.24)");
      vg.addColorStop(0.38, "rgba(255,196,120,.055)");
      vg.addColorStop(1, "rgba(0,0,0,.20)");
      c2.fillStyle = vg; c2.fillRect(x, 0, cw - 1.6, H);
      // 竖直木纹：深/浅交替，缓慢起伏
      for (let i = 0; i < 9; i++) {
        const gx = x + 3 + Math.random() * (cw - 7);
        const amp = 0.8 + Math.random() * 2.6;
        c2.strokeStyle = Math.random() < 0.52 ? "rgba(12,5,2,.30)" : "rgba(255,190,110,.06)";
        c2.lineWidth = 0.6 + Math.random() * 1.3;
        c2.beginPath(); c2.moveTo(gx, -10);
        for (let y = 0; y <= H + 20; y += 52) c2.lineTo(gx + Math.sin((y + i * 29) * 0.013) * amp, y);
        c2.stroke();
      }
      // 竖缝 + 偶尔的横向端缝
      c2.fillStyle = "rgba(8,3,1,.62)"; c2.fillRect(x + cw - 1.6, 0, 1.6, H);
      const jy = rand(0, H);
      c2.fillStyle = "rgba(8,3,1,.42)"; c2.fillRect(x, jy, cw - 1.6, 1.4);
      c2.fillStyle = "rgba(255,190,110,.035)"; c2.fillRect(x, jy + 1.4, cw - 1.6, 1);
      // 木节
      if (Math.random() < 0.28) {
        const kx = x + cw * (0.25 + Math.random() * 0.5), ky = rand(0, H);
        const kg = c2.createRadialGradient(kx, ky, 0, kx, ky, cw * 0.30);
        kg.addColorStop(0, "rgba(12,5,1,.55)");
        kg.addColorStop(0.6, "rgba(40,20,6,.24)");
        kg.addColorStop(1, "rgba(0,0,0,0)");
        c2.fillStyle = kg;
        c2.beginPath(); c2.ellipse(kx, ky, cw * 0.28, cw * 0.52, 0, 0, Math.PI * 2); c2.fill();
      }
    }
    // 中心一点暖光 + 四周压暗
    const warm = c2.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, Math.max(W, H) * 0.62);
    warm.addColorStop(0, "rgba(255,170,90,.06)");
    warm.addColorStop(1, "rgba(0,0,0,0)");
    c2.fillStyle = warm; c2.fillRect(0, 0, W, H);
    const vg2 = c2.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.18, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    vg2.addColorStop(0, "rgba(0,0,0,0)"); vg2.addColorStop(1, "rgba(0,0,0,.34)");
    c2.fillStyle = vg2; c2.fillRect(0, 0, W, H);
  }

  function drawGroundLayer(ctx, theme) {
    const S = G.scene, W = S.W, H = S.H;
    const dpr = Math.min(G.platform.dpr || 2, 2);
    const key = W + "x" + H + ":" + (S._groundSeed || 0) + ":" + theme;
    let cache = groundCache[theme];
    if (!cache || cache.key !== key) {
      const mk = (typeof wx !== "undefined" && wx.createCanvas) ? () => wx.createCanvas() : () => document.createElement("canvas");
      const cv = (cache && cache.cv) || mk();
      const c2 = cv.getContext("2d");
      if (!c2) return;
      cv.width = Math.ceil(W * dpr); cv.height = Math.ceil(H * dpr);
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2.clearRect(0, 0, W, H);
      paintStone(c2, W, H, G.platform.S || 1);   // 第一版萤光：深色石板地
      cache = groundCache[theme] = { cv, ctx: c2, key };
    }
    ctx.drawImage(cache.cv, 0, 0, W, H);
  }

  function drawPool(ctx, t) {
    const S = G.scene, W = S.W, H = S.H;
    drawGroundLayer(ctx, 0);
    // 四周再压一层暗角（石板地边缘明显更暗）
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.46, Math.min(W, H) * 0.16, W * 0.5, H * 0.5, Math.max(W, H) * 0.74);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.42)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // 环境萤尘：微光点缓漂 + 呼吸（画在暗角之上，像夜里的浮尘）
    (S.dust || []).forEach(d => {
      const x = ((d.x + t * d.sp) % (W + 40)) - 20;
      const y = d.y + Math.sin(t * 0.4 + d.ph) * 6;
      const a = d.a * (0.55 + 0.45 * Math.sin(t * d.br + d.ph * 2));
      ctx.fillStyle = "rgba(214,255,172," + Math.max(0, a).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, Math.PI * 2); ctx.fill();
    });
  }

  function drawPond(ctx, t) {
    const S = G.scene, W = S.W, H = S.H;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b2b34"); g.addColorStop(0.45, "#12414a"); g.addColorStop(1, "#08222b");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 水面高光条：横向缓移，制造"水面在动"的底噪
    (S.glints || []).forEach(gl => {
      const x = ((gl.x + t * gl.sp) % (W + gl.w)) - gl.w / 2;
      const y = gl.y + Math.sin(t * 0.5 + gl.ph) * 3;
      ctx.fillStyle = "rgba(190,240,225," + gl.a.toFixed(3) + ")";
      ctx.beginPath(); ctx.ellipse(x, y, gl.w / 2, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    });
    // 芦苇剪影（贴边，弱对比）
    (S.reeds || []).forEach(r => {
      const sway = Math.sin(t * 0.7 + r.ph) * 5;
      ctx.strokeStyle = "rgba(6,26,28,.62)"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(r.x, r.y);
      ctx.quadraticCurveTo(r.x + sway * 0.4, r.y - r.h * 0.6, r.x + sway, r.y - r.h);
      ctx.stroke();
    });
    // 小浮萍
    (S.duckweed || []).forEach(d => {
      ctx.save();
      ctx.translate(d.x + Math.sin(t * 0.6 + d.ph) * 4, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = "rgba(58,122,84,.55)";
      for (let i = 0; i < d.n; i++) {
        const a = i / d.n * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * d.r * 0.7, Math.sin(a) * d.r * 0.32, d.r * 0.55, d.r * 0.26, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    // 荷叶：先画上排（远），再画下排（近），远的被近的遮住更自然
    (S.pads || []).slice().sort((a, b) => a.y - b.y).forEach(p => drawPad(ctx, p, t));
    // 睡莲
    (S.lilies || []).forEach(l => {
      const r = l.r * (1 + Math.sin(t * 1.1 + l.ph) * 0.04);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + l.ph * 0.2;
        ctx.fillStyle = l.c;
        ctx.beginPath();
        ctx.ellipse(l.x + Math.cos(a) * r * 0.52, l.y + Math.sin(a) * r * 0.24, r * 0.5, r * 0.24, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffe9a8";
      ctx.beginPath(); ctx.arc(l.x, l.y, r * 0.24, 0, Math.PI * 2); ctx.fill();
    });
    // 萤火：呼吸 + 慢漂
    (S.pondDust || []).forEach(d => {
      let y = (d.y - t * d.sp) % (H + 40);
      if (y < 0) y += H + 40;
      const x = d.x + Math.sin(t * 0.5 + d.ph) * d.amp;
      const a = 0.16 + 0.14 * Math.sin(t * 1.5 + d.ph);
      if (a <= 0.02) return;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, d.r * 4.2);
      rg.addColorStop(0, "rgba(" + d.hue + "," + (a * 0.8).toFixed(2) + ")");
      rg.addColorStop(1, "rgba(" + d.hue + ",0)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y, d.r * 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(" + d.hue + "," + a.toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, Math.PI * 2); ctx.fill();
    });
    // 顶部压暗（HUD 区可读）+ 四周暗角
    const tg = ctx.createLinearGradient(0, 0, 0, H * 0.28);
    tg.addColorStop(0, "rgba(0,0,0,.42)"); tg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.28);
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.24, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.42)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  /* 荷叶布景生成：stage < 4 是 3×2 固定 6 片；stage ≥ 4「换场」改为贴叶生长的随机连片布叶
     （20 片左右、中间汇集两边稀疏、允许轻微重叠），其中 3 片小叶被青蛙踩到会沉没且不再浮起；
     padNeighborDist = 相邻叶间距，供第④阶段「周边 2 片叶距离内任选落点」使用。 */
  G.rebuildFrogPads = (stage) => {
    const S = G.scene;
    if (!S || S.type !== "frog") return;
    const W = S.W, H = S.H;
    const b = G.bounds();
    const R0 = G.clamp(Math.min(W, H) * 0.13, 44, 84);
    const roam = stage >= 4;
    const pads = [];
    const makePad = (x, y, r, tone) => ({
      x, y, bx: x, by: y, r,
      rot: rand(-0.16, 0.16),
      notch: rand(0, Math.PI * 2),
      tone,
      ph: rand(0, Math.PI * 2),
      hint: 0, swayT: 0, swayAmt: 0,
      drift: {
        ax: rand(0.16, 0.30), ay: rand(0.11, 0.22),
        px: rand(0, Math.PI * 2), py: rand(0, Math.PI * 2),
        ampX: rand(7, 16), ampY: rand(4, 9)
      },
      sink: 0, sinkState: "float", sinkT: 0,
      small: false, gone: false
    });
    if (roam) {
      /* ④ 换场：随机撒点密集布叶，相邻叶允许轻微重叠（叶与叶尽量挨着，像连片荷塘），
         大小自然混排；再随机挑 3 片压成小叶。横竖屏都按可用区自适应，不怕比例差。 */
      const target = 20;
      let guard = 0;
      while (pads.length < target && guard < 900) {
        guard++;
        const r = R0 * rand(0.80, 1.38);
        if (b.w < r * 1.35 || b.h < r * 0.75) continue;
        // 贴叶生长：大部分新叶沿已有叶边缘落位（椭圆纵向按 0.42 压缩），
        // 放不下再全局随机——叶子自然连成片，而不是均匀撒一地
        let x = 0, y = 0, okPos = false;
        for (let t = 0; t < 8 && !okPos; t++) {
          if (pads.length && Math.random() < 0.8) {
            const q = pads[Math.floor(rand(0, pads.length))];
            const ang = rand(0, Math.PI * 2);
            const d = 0.97 * (r + q.r);
            x = q.bx + Math.cos(ang) * d;
            y = q.by + Math.sin(ang) * d * 0.42;
          } else {
            // 中间汇集：x 用两个均匀随机取平均（三角分布），主簇压在中央 0.16~0.84
            const xn = (rand(0, 1) + rand(0, 1)) / 2;
            x = b.x + b.w * (0.16 + 0.68 * xn);
            y = b.y + rand(r * 0.34, b.h - r * 0.34);
          }
          if (x < b.x + r * 0.55 || x > b.x + b.w - r * 0.55) continue;
          if (y < b.y + r * 0.30 || y > b.y + b.h - r * 0.30) continue;
          // 叶子是扁椭圆（纵向半高 ≈ 0.42r）：间距按椭圆归一化算，纵向也能贴着排
          if (pads.every(p => Math.hypot(x - p.bx, (y - p.by) / 0.42) >= (r + p.r) * 0.92)) okPos = true;
        }
        if (!okPos) continue;
        pads.push(makePad(x, y, r, (y - b.y) / b.h > 0.52 ? 1 : 0));
      }
      // 两边稀疏：左右边缘各点缀 1 片（放得下才放），主簇不外溢
      [[0.055, 0.45], [0.945, 0.55]].forEach(([cx, ry]) => {
        for (let t = 0; t < 20; t++) {
          const r = R0 * rand(0.72, 0.95);
          const x = b.x + b.w * cx + rand(-b.w * 0.02, b.w * 0.02);
          const y = b.y + b.h * ry + rand(-b.h * 0.10, b.h * 0.10);
          if (x < b.x + r * 0.55 || x > b.x + b.w - r * 0.55) continue;
          if (y < b.y + r * 0.30 || y > b.y + b.h - r * 0.30) continue;
          if (!pads.every(p => Math.hypot(x - p.bx, (y - p.by) / 0.42) >= (r + p.r) * 0.92)) continue;
          pads.push(makePad(x, y, r, 1));
          break;
        }
      });
      // 补密：给近邻数为 0 的孤立叶旁边再补一片小一点的叶，保证整片荷塘没有"孤岛"
      for (let pass = 0; pass < 2 && pads.length < target + 3; pass++) {
        const lonely = pads.filter(p => pads.every(q => q === p ||
          Math.hypot(p.bx - q.bx, (p.by - q.by) / 0.42) > (p.r + q.r) * 1.25));
        for (const q of lonely) {
          if (pads.length >= target + 3) break;
          for (let t = 0; t < 30; t++) {
            const r = R0 * rand(0.70, 0.95);
            const ang = rand(0, Math.PI * 2);
            const d = 0.96 * (r + q.r);
            const x = q.bx + Math.cos(ang) * d;
            const y = q.by + Math.sin(ang) * d * 0.42;
            if (x < b.x + r * 0.55 || x > b.x + b.w - r * 0.55) continue;
            if (y < b.y + r * 0.30 || y > b.y + b.h - r * 0.30) continue;
            if (!pads.every(p => Math.hypot(x - p.bx, (y - p.by) / 0.42) >= (r + p.r) * 0.92)) continue;
            pads.push(makePad(x, y, r, (y - b.y) / b.h > 0.52 ? 1 : 0));
            break;
          }
        }
      }
      const idx = pads.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(rand(0, i + 1));
        const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
      }
      idx.slice(0, Math.min(3, pads.length)).forEach(i => {
        pads[i].small = true; pads[i].r = R0 * rand(0.48, 0.62);
      });
    } else {
      const cols = [0.17, 0.50, 0.83], rows = [0.22, 0.66];
      rows.forEach((ry, ri) => {
        cols.forEach(cx => {
          const near = ri === rows.length - 1;
          const j = 0.012;
          const bx = b.x + (cx + rand(-j, j)) * b.w;
          const by = b.y + (ry + rand(-j * 1.6, j * 1.6)) * b.h;
          pads.push(makePad(bx, by, R0 * (near ? rand(1.0, 1.07) : rand(0.92, 1.0)), near ? 1 : 0));
        });
      });
    }
    S.pads = pads;
    // 相邻叶间距：取两两距离的低四分位，作为「1 片叶距离」
    const ds = [];
    for (let i = 0; i < pads.length; i++) {
      for (let j = i + 1; j < pads.length; j++) ds.push(Math.hypot(pads[i].x - pads[j].x, pads[i].y - pads[j].y));
    }
    ds.sort((a, c) => a - c);
    S.padNeighborDist = ds.length ? ds[Math.floor(ds.length * 0.25)] : 160;
    // 睡莲重新摆放（避开新荷叶），换场时多摆一朵
    S.lilies = [];
    for (let i = 0; i < (roam ? 3 : 2); i++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const lx = rand(b.x + b.w * 0.12, b.x + b.w * 0.88);
        const ly = rand(b.y + b.h * 0.34, b.y + b.h * 0.92);
        const clear = pads.every(p => Math.hypot(lx - p.x, (ly - p.y) / 0.45) > p.r * 1.25);
        const apart = S.lilies.every(l => Math.hypot(lx - l.x, ly - l.y) > 90);
        if (!clear || !apart) continue;
        S.lilies.push({
          x: lx, y: ly, r: rand(15, 22), ph: rand(0, Math.PI * 2),
          c: i === 0 ? "#f7c9dc" : "#f6e7f0"
        });
        break;
      }
    }
  };

  /* ===== 青蛙跳：荷叶的漂浮 / 沉浮 / 载蛙 =====
     每帧由主循环调用（不限玩法状态，结算页背景里的荷叶也继续漂）。 */
  G.padsUpdate = (dt, t) => {
    const S = G.scene;
    if (!S || S.type !== "frog" || !S.pads) return;
    S.pads.forEach(p => {
      // 1) 缓慢漂流：两条不同周期的正弦叠加，像被水面环流缓缓推着走
      const d = p.drift || (p.drift = { ax: 0.22, ay: 0.16, px: 0, py: 0, ampX: 10, ampY: 6 });
      p.x = p.bx + Math.sin(t * d.ax + d.px) * d.ampX + Math.sin(t * 0.11 + d.px * 1.7) * d.ampX * 0.32;
      p.y = p.by + Math.sin(t * d.ay + d.py) * d.ampY;
      // 2) 沉浮状态机：被三只青蛙压沉 → 没入水里 1.5s → 缓缓浮起
      if (p.sinkState === "sinking") {
        p.sinkT += dt;
        p.sink = Math.min(1, p.sinkT / 0.55);
        if (p.sink >= 1) { p.sinkState = p.gone ? "gone" : "sunk"; p.sinkT = 0; }
      } else if (p.sinkState === "sunk") {
        p.sinkT += dt;
        if (p.sinkT >= 1.5) { p.sinkState = "rising"; p.sinkT = 0; }
      } else if (p.sinkState === "rising") {
        p.sinkT += dt;
        const k = Math.min(1, p.sinkT / 0.95);
        p.sink = Math.pow(1 - k, 3);                  // 缓出：先快后慢地浮回水面
        if (k >= 1) {
          p.sink = 0; p.sinkState = "float"; p.sinkT = 0;
          G.padSplash(p.x, p.y, p.r * 0.92, false);   // 浮回水面时漾开一圈
        }
      }
    });
  };

  /* 池塘水花：沿荷叶边缘溅起一圈水珠 + 贴水面的扁椭圆波纹（俯视透视，正圆会像肥皂泡） */
  G.padSplash = (x, y, r, strong) => {
    const R = Math.max(10, r || 24);
    const n = strong ? 20 : 11;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const rr = R * rand(0.86, 1.16);
      PUSH(fx.droplets, {
        x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.44,
        vx: Math.cos(a) * rand(60, 190), vy: Math.sin(a) * rand(20, 80) - rand(90, strong ? 230 : 170),
        r: rand(1.8, strong ? 4.4 : 3.4), life: rand(0.4, 0.82),
        c0: "#ffffff", c1: "#dcffef", c2: "rgba(130,220,205,.35)"
      }, 90);
    }
    // 贴水面的扁圆波纹：从叶缘向外扩散两圈
    PUSH(fx.shockwaves, { x, y, r: R * 0.94, life: 0.75, speed: strong ? 170 : 120, w: strong ? 2.4 : 1.8, color: "rgba(206,255,236,.8)", flat: true }, 12);
    PUSH(fx.shockwaves, { x, y, r: R * 0.58, life: 0.95, speed: strong ? 90 : 62, w: 1.4, color: "rgba(170,240,222,.55)", flat: true }, 12);
    if (strong) {
      PUSH(fx.ripples, { x, y, r: R * 0.9, life: 1, color: "rgba(206,255,236,.85)", big: true, flat: true }, 30);
    }
  };

  /* 荷叶座位：三只青蛙同叶时错开摆放，避免完全重叠（0 叶心 / 1 左 / 2 右） */
  G.padSlotPos = (p, slot) => {
    const r = p ? p.r : 48;
    if (slot === 1) return { dx: -r * 0.42, dy: r * 0.10 };
    if (slot === 2) return { dx: r * 0.42, dy: -r * 0.04 };
    return { dx: 0, dy: -r * 0.05 };
  };
  /* 叶上已落定的青蛙（占着座位） */
  G.padOccupants = (idx) => (G.preys || []).filter(f =>
    f.type === "frog" && f.padIdx === idx && f.slot >= 0 &&
    f.fState !== "drown" && !(f.vanishT > 0) && !(f.rspT > 0));
  /* 找空座位；includeLeaping=true 时把"正跳向这片叶"的青蛙也视为占位，避免两只同时落同一点 */
  G.padFreeSlot = (idx, self, includeLeaping) => {
    const used = [0, 0, 0];
    (G.preys || []).forEach(f => {
      if (f === self || f.type !== "frog") return;
      if (f.fState === "drown" || f.vanishT > 0 || f.rspT > 0) return;
      if (f.padIdx === idx && f.slot >= 0) used[f.slot] = 1;
      if (includeLeaping && f.fState === "leap" && f.targetPadIdx === idx && f.targetSlot >= 0) used[f.targetSlot] = 1;
    });
    for (let s = 0; s < 3; s++) if (!used[s]) return s;
    return -1;
  };
  /* 三只同叶 → 荷叶被压沉，叶上的青蛙一起落水 */
  G.padSink = (idx) => {
    const S = G.scene;
    const p = S && S.pads && S.pads[idx];
    if (!p || p.sinkState !== "float") return;
    p.gone = !!p.small;      // ④ 换场的小荷叶：一踩就沉，不再浮起
    p.sinkState = "sinking"; p.sinkT = 0;
    G.padSplash(p.x, p.y, p.r * 1.08, true);
    (G.preys || []).forEach(f => {
      if (f.type === "frog" && f.padIdx === idx && f.slot >= 0 && f.startDrown) f.startDrown(p);
    });
  };

  /* 单片荷叶：水下投影 + 叶面双色 + 叶缘缺口 + 叶脉 + 落点预兆光圈 */
  function drawPad(ctx, p, t) {
    const sway = p.swayAmt > 0 ? Math.sin(t * 11) * p.swayAmt : 0;
    if (p.swayAmt > 0) p.swayAmt = Math.max(0, p.swayAmt - 0.09);   // 被拍后约 0.7s 停止晃动
    const y = p.y + sway + Math.sin(t * 0.9 + p.ph) * 1.5;
    const sinkK = p.sink || 0;
    if (sinkK >= 0.995) return;                       // 完全没入水下：这一帧不画叶片
    const rx = p.r, ry = p.r * 0.42;
    ctx.save();
    // 下沉：叶片整体往下移、缩小、变暗（水越深越看不清），浮回时反向
    ctx.globalAlpha = 1 - sinkK * 0.88;
    ctx.translate(p.x, y + sinkK * p.r * 1.05);
    const padSc = 1 - sinkK * 0.16;
    ctx.scale(padSc, padSc);
    // 水下投影（荷叶浮在水面，边缘一圈暗）
    ctx.fillStyle = "rgba(3,22,26,.42)";
    ctx.beginPath(); ctx.ellipse(3, ry * 0.62, rx * 1.04, ry * 1.06, 0, 0, Math.PI * 2); ctx.fill();
    // 叶面
    ctx.fillStyle = p.tone ? "#37955a" : "#2d7350";
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    // 受光面（偏上）
    ctx.fillStyle = p.tone ? "#4bb074" : "#3c8560";
    ctx.beginPath(); ctx.ellipse(0, -ry * 0.16, rx * 0.9, ry * 0.72, 0, 0, Math.PI * 2); ctx.fill();
    // 叶缘高光：把荷叶从深水里"托"起来，避免看着像贴纸
    ctx.strokeStyle = "rgba(190,244,214,.14)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.99, ry * 0.99, 0, 0, Math.PI * 2); ctx.stroke();
    // 叶缘缺口（V 形通到叶心，用半透明水色挖掉一个楔子）
    const na = p.notch, nw2 = p.r * 0.118;
    ctx.fillStyle = "rgba(9,38,46,.58)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(na - nw2) * rx * 1.02, Math.sin(na - nw2) * ry * 1.02);
    ctx.lineTo(Math.cos(na + nw2) * rx * 1.02, Math.sin(na + nw2) * ry * 1.02);
    ctx.closePath(); ctx.fill();
    // 叶脉：从叶心放射
    ctx.strokeStyle = "rgba(8,44,34,.34)"; ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      if (Math.abs(((a - na + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.34) continue;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * rx * 0.94, Math.sin(a) * ry * 0.94);
      ctx.stroke();
    }
    // 落点预兆光圈：青蛙蓄力末尾点亮，起跳后 420ms 内自然淡出
    const dt = p.hint ? (performance.now() - p.hint) : 9999;
    if (dt < 420) {
      const k = 1 - dt / 420;
      const pulse = 1 + Math.sin(performance.now() / 110) * 0.03;
      ctx.strokeStyle = "rgba(255,214,102," + (0.85 * k).toFixed(2) + ")";
      ctx.lineWidth = 2.4;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 1.1 * pulse, ry * 1.16 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /* 拍偏/落水时荷叶轻晃（场景侧反馈，不影响逻辑） */
  G.padSway = (x, y) => {
    const S = G.scene;
    if (!S || !S.pads) return;
    S.pads.forEach(p => {
      if (Math.hypot(x - p.x, y - p.y) < p.r * 1.25) p.swayAmt = 4;
    });
  };

  /* ================= 粒子特效 ================= */
  const fx = {
    bubbles: [], dust: [], pollen: [], scales: [], sparks: [], ripples: [],
    trails: [], scorches: [], petals: [], paws: [], floats: [], ambientT: 0,
    droplets: [], shockwaves: [], flash: 0, confetti: [], shower: []
  };
  G.fx = fx;
  const PUSH = (arr, o, cap) => { arr.push(o); if (arr.length > cap) arr.splice(0, arr.length - cap); };

  /* 兔子跑动时身后偶尔冒一颗小星：视频里是一颗若隐若现的黄星，不是密集拖尾。
     借 droplets 的 star 渲染，给一点向上的初速，0.3s 内明灭。 */
  G.emberTrail = (x, y) => {
    PUSH(fx.droplets, {
      x: x + rand(-5, 5), y: y + rand(-5, 5),
      vx: rand(-10, 10), vy: rand(-90, -50),
      r: rand(4.5, 6.5), life: rand(0.30, 0.45),
      star: true, rot: rand(0, Math.PI * 2), spin: rand(-3, 3),
      c1: Math.random() < 0.35 ? "#fff6b0" : "#ffe36a",
      edge: "rgba(120,70,0,.32)"
    }, 60);
  };

  G.bubbleBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.bubbles, { x: x + rand(-14, 14), y: y + rand(-10, 10), r: rand(3, 8), vy: rand(-70, -30), vx: rand(-20, 20), life: rand(0.5, 1) }, 60); };
  G.dustBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.dust, { x, y, vx: rand(-55, 55), vy: rand(-60, -8), r: rand(3, 7), life: rand(0.4, 0.8) }, 60); };
  G.pollenBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.pollen, { x: x + rand(-12, 12), y: y + rand(-12, 12), vx: rand(-24, 24), vy: rand(-34, -6), r: rand(1.5, 3.4), life: rand(0.7, 1.4) }, 80); };
  G.nightBurst = (x,y,color) => { for(let i=0;i<30;i++){const a=rand(0,Math.PI*2),sp=rand(110,360);PUSH(fx.pollen,{x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rand(5,11),life:rand(.75,1.45),glow:color},100);} PUSH(fx.shockwaves,{x,y,r:12,life:.7,speed:260,w:4,color:color},20); };
  G.scalesBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.scales, { x, y, vx: rand(-20, 20), vy: rand(4, 26), r: rand(1, 2.4), life: rand(0.6, 1.3) }, 60); };
  /* 兔子被拍中：视频里是一簇橙/蓝/黄/红的实心五角星先聚团、再散成小星点飘走。
     只有命中瞬间出现，不做周边常驻星装饰。 */
  const RB_STAR_COLORS = ["#FF8A1E", "#2E9BFF", "#FFD21E", "#FF3B30", "#FFB03A", "#4FB8FF"];
  G.lightPop = (x, y, big, species) => {
    const n = big ? 16 : 12;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(95, big ? 320 : 255);
      PUSH(fx.droplets, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(10, 55),
        r: rand(10, big ? 24 : 18), life: rand(0.45, 0.80),
        star: true, rot: rand(0, Math.PI * 2), spin: rand(-3.5, 3.5),
        c1: RB_STAR_COLORS[i % RB_STAR_COLORS.length],
        edge: "rgba(78,32,8,.55)"
      }, 90);
    }
    // 随后散开的细碎小星（视频 21.2s 那一帧）
    for (let i = 0; i < (big ? 12 : 9); i++) {
      const a = rand(0, Math.PI * 2), sp = rand(120, 330);
      PUSH(fx.droplets, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(0, 60),
        r: rand(4.0, 8.0), life: rand(0.50, 0.90),
        star: true, rot: rand(0, Math.PI * 2), spin: rand(-5, 5),
        c1: RB_STAR_COLORS[(i + 2) % RB_STAR_COLORS.length],
        edge: "rgba(78,32,8,.40)"
      }, 90);
    }
    fx.flash = Math.max(fx.flash, big ? 0.14 : 0.09);
  };
  /* ---------- 换关特效：视频 15.0s 那一下是"满屏金色火花爆散" ---------- */
  G.goldShower = () => {
    const W = G.platform.W / (G.platform.S || 1), H = G.platform.H / (G.platform.S || 1);
    for (let i = 0; i < 110; i++) {
      PUSH(fx.shower, {
        x: rand(0, W), y: rand(0, H),
        vx: rand(-16, 16), vy: rand(-34, -4),
        r: rand(1.0, 3.4), life: rand(0.55, 1.55),
        tw: rand(7, 16), ph: rand(0, Math.PI * 2),
        c: Math.random() < 0.22 ? "#fff4d2" : (Math.random() < 0.5 ? "#ffc45c" : "#ff9a32")
      }, 220);
    }
    fx.flash = Math.max(fx.flash, 0.12);
  };
  /* 自动切换动物与背景：火花 + 1.1s 整屏交叉淡入，完成时同步换动物动作 */
  G.poolShiftTheme = () => {
    const S = G.scene;
    if (!S || S.type !== "pool" || !S.poolMix || S.poolShift) return false;
    const now = G.session ? (G.session.time || 0) : 0;
    if (S._lastShiftTime != null && now - S._lastShiftTime < 18) return false;
    S._lastShiftTime = now;
    const from = S.poolTheme || 0;
    const to = (from + 1) % 2;
    S.poolShift = {
      t0: performance.now(), dur: 1100,
      from, to
    };
    G.goldShower();
    /* 视频里火花不是均匀撒的：拍击点还有一团集中的亮橙爆闪 */
    const W = G.platform.W / (G.platform.S || 1), H = G.platform.H / (G.platform.S || 1);
    const cx = W * 0.5, cy = H * 0.20;
    if (G.lightPop) G.lightPop(cx, cy, true, ["rabbit", "ladybug"][to]);
    for (let i = 0; i < 16; i++) {
      const a = rand(0, Math.PI * 2), r = rand(4, 34);
      PUSH(fx.droplets, {
        x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.6,
        vx: Math.cos(a) * rand(60, 240), vy: Math.sin(a) * rand(50, 190),
        r: rand(2.4, 5.6), life: rand(0.35, 0.85),
        c0: "#fff8dc", c1: "#ff9a32", c2: "rgba(255,110,20,0)"
      }, 90);
    }
    return true;
  };

  G.sparkBurst = (x, y, color, n) => { for (let i = 0; i < (n || 8); i++) { const a = rand(0, Math.PI * 2), sp = rand(90, 260); PUSH(fx.sparks, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.55), c: color }, 90); } fx.sparkColor = color; };
  /* 彩纸屑爆炸（鱼群巡游命中特效）：多彩小纸条四溅 + 金色扩散环（参考图的彩虹 confetti + 金圈） */
  G.confettiBurst = (x, y) => {
    const COLS = ["#ff5e8a", "#ffe45e", "#5ef0c0", "#5eb8ff", "#c07aff", "#ff9a4d", "#7dff8a"];
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(120, 380);
      PUSH(fx.confetti, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(40, 160),
        rot: rand(0, 6.28), vr: rand(-9, 9), len: rand(6, 12), w: rand(2.4, 3.6),
        life: rand(0.5, 0.95), c: COLS[i % COLS.length]
      }, 60);
    }
    // 金色扩散环（细圈、慢扩）
    PUSH(fx.shockwaves, { x, y, r: 14, life: 0.65, speed: 300, w: 3.5, color: "rgba(255,202,96,.95)" }, 12);
  };
  /* 群鼠命中爆彩：彩虹纸屑 + 外圈发光彩点 + 白色星芒点（对齐参考图"拍中炸出一圈彩色亮点"） */
  G.swarmPopBurst = (x, y) => {
    G.confettiBurst(x, y);
    const COLS = [["#ffffff", "#7dff8a"], ["#ffffff", "#ffe45e"], ["#ffffff", "#5eb8ff"],
                  ["#ffffff", "#c07aff"], ["#ffffff", "#ff7ad1"], ["#ffffff", "#7dffd4"]];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rand(-0.18, 0.18), sp = rand(110, 300);
      const c = COLS[i % COLS.length];
      PUSH(fx.droplets, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(2.2, 4.6),
        life: rand(0.45, 0.9), c0: c[0], c1: c[1], c2: "rgba(0,0,0,0)"
      }, 90);
    }
    for (let i = 0; i < 7; i++) {
      const a = rand(0, Math.PI * 2), rr = rand(18, 58);
      PUSH(fx.sparks, {
        x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr,
        vx: rand(-14, 14), vy: rand(-14, 14), life: rand(0.35, 0.6), c: "#ffffff"
      }, 90);
    }
  };

  /* 室内房间里的老鼠被拍中：毛屑/饼干屑颗粒炸开 + 灰尘 + 金环。
     与群鼠模式的彩虹纸屑区分开，配色压在家居木地板的暖色里，不抢戏。 */
  G.mousePopBurst = (x, y, big) => {
    const COLS = [
      ["#fffaf0", "#c9a97f", "rgba(0,0,0,0)"],
      ["#e3d2b8", "#7a5438", "rgba(0,0,0,0)"],
      ["#ffe27a", "#d9821a", "rgba(0,0,0,0)"],
      ["#f0dfc8", "#8c6a4a", "rgba(0,0,0,0)"],
      ["#ffffff", "#b98a5a", "rgba(0,0,0,0)"]
    ];
    const FUR = ["#fffaf0", "#e8d8bf", "#6b4a33", "#8c6a4a", "#ffb02e", "#d98b4a", "#c9b28c"];
    const n = big ? 26 : 18;
    // 毛屑/饼干屑：小颗粒四散，落地前有重力
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(100, big ? 360 : 280);
      const c = COLS[i % COLS.length];
      PUSH(fx.droplets, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(30, 120),
        r: rand(3.2, big ? 7.4 : 6.0), life: rand(0.42, 0.85),
        c0: c[0], c1: c[1], c2: c[2]
      }, 100);
    }
    // 条状毛/碎屑：比圆点更像“炸开的一团”
    for (let i = 0; i < (big ? 12 : 8); i++) {
      const a = rand(0, Math.PI * 2), sp = rand(90, big ? 320 : 250);
      PUSH(fx.confetti, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(40, 140),
        rot: rand(0, 6.28), vr: rand(-10, 10), len: rand(4, 9), w: rand(1.5, 2.8),
        life: rand(0.5, 0.95), c: FUR[i % FUR.length]
      }, 60);
    }
    // 灰尘团：把爆点撑大，避免只有几个小点
    for (let i = 0; i < (big ? 12 : 8); i++) {
      PUSH(fx.dust, {
        x: x + rand(-10, 10), y: y + rand(-6, 6),
        vx: rand(-90, 90), vy: rand(-100, -25),
        r: rand(4, 9), life: rand(0.40, 0.75)
      }, 80);
    }
    // 双层金环 + 中心光斑
    PUSH(fx.shockwaves, {
      x, y, r: 8, life: 0.5, speed: big ? 380 : 300,
      w: big ? 4.0 : 3.0, color: "rgba(120,70,30,.55)"
    }, 12);
    PUSH(fx.shockwaves, {
      x, y, r: 6, life: 0.55, speed: big ? 300 : 240,
      w: 2, color: "rgba(255,250,230,.92)"
    }, 12);
    PUSH(fx.shockwaves, {
      x, y, r: 3, life: 0.30, speed: 80, w: 12,
      color: "rgba(255,240,200,.85)", glow: true
    }, 12);
    G.sparkBurst(x, y, "#ffd76a", big ? 14 : 10);
    fx.flash = Math.max(fx.flash, big ? 0.12 : 0.08);
  };

  /* 夸张水花（银白 / 泳池金橙两套配色）：
     发光碎点四溅 + 双层冲击环 + 闪白 + 大光波 */
  const SPLASH_PAL = {
    lime: { drop: ["#ffffff", "#f2ff9c", "rgba(150,240,130,.5)"], ring1: "rgba(255,248,190,.95)", ring2: "rgba(160,244,190,.9)",
            glow: "rgba(240,255,150,.95)", spark: "#f4ffa8", rip: "rgba(226,255,140,.95)" },
    gold: { drop: ["#ffffff", "#ffe27a", "rgba(255,150,40,.5)"], ring1: "rgba(255,236,170,.95)", ring2: "rgba(255,196,90,.9)",
            glow: "rgba(255,220,120,.95)", spark: "#ffd76a", rip: "rgba(255,224,130,.95)" },
    silver: { drop: ["#ffffff", "#d8f2ff", "rgba(140,200,255,.5)"], ring1: "rgba(238,250,255,.95)", ring2: "rgba(168,220,250,.9)",
            glow: "rgba(205,238,255,.95)", spark: "#cfeaff", rip: "rgba(205,238,255,.95)" }
  };
  G.splashBurst = (x, y, big, pal) => {
    const P = SPLASH_PAL[pal] || SPLASH_PAL.lime;
    const n = big ? 26 : 16;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(140, big ? 520 : 360);
      const up = rand(90, big ? 300 : 210);                 // 垂直上抛分量（假 3D 迸溅）
      PUSH(fx.droplets, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - up,
        r: rand(2.2, big ? 7.5 : 5.5), life: rand(0.55, 1.05),
        c0: P.drop[0], c1: P.drop[1], c2: P.drop[2]
      }, 90);
    }
    // 双层冲击环（外环快、内环慢）
    PUSH(fx.shockwaves, { x, y, r: 10, life: 1, speed: big ? 560 : 420, w: big ? 7 : 5, color: P.ring1 }, 12);
    PUSH(fx.shockwaves, { x, y, r: 6, life: 1, speed: big ? 330 : 250, w: big ? 4.5 : 3.5, color: P.ring2 }, 12);
    // 命中点爆闪（半径快速外扩的实心光斑）
    PUSH(fx.shockwaves, { x, y, r: 4, life: 1, speed: 240, w: 22, color: P.glow, glow: true }, 12);
    fx.flash = Math.max(fx.flash, big ? 0.26 : 0.16);       // 全屏闪白（短暂，峰值压低护眼）
    // 大光波
    PUSH(fx.ripples, { x, y, r: 8, life: 1, miss: false, color: P.rip, big: true }, 30);
    PUSH(fx.ripples, { x, y, r: 20, life: 0.85, miss: false, color: "rgba(255,255,255,.8)", big: true }, 30);
    G.sparkBurst(x, y, P.spark, big ? 12 : 8);
  };
  /* ============ 青蛙被拍中：一拍炸成草屑 ============
     刻意和捕鱼的水花区分：不做大气泡球，而是"啪"地炸成一圈细环 + 四散草屑 + 上飘萤火。
     空中截击（+2）整体放大一档并多一圈金环，让加分时机看得出区别 */
  G.frogPop = (x, y, aerial) => {
    const LEAF = ["#d9ff9a", "#b9f07a", "#8fdd66", "#5fbf55", "#e9ffd0"];
    const n = aerial ? 16 : 11;
    // 1) 草屑/碎叶：细短线条向外飞散
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(150, aerial ? 450 : 330);
      PUSH(fx.confetti, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(40, aerial ? 190 : 140),
        rot: rand(0, 6.28), vr: rand(-12, 12),
        len: rand(5, 11), w: rand(2, 3.2), life: rand(0.42, 0.8), c: LEAF[i % LEAF.length]
      }, 60);
    }
    // 2) 光点（小半径，别糊成一团）
    for (let i = 0; i < (aerial ? 12 : 8); i++) {
      const a = rand(0, Math.PI * 2), sp = rand(120, aerial ? 380 : 280);
      PUSH(fx.droplets, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(30, 140),
        r: rand(1.6, aerial ? 4.2 : 3.4), life: rand(0.32, 0.62),
        c0: "#f6ffe0", c1: "#c8f58e", c2: "rgba(120,220,120,0)"
      }, 90);
    }
    // 3) 冲击波：落水面上是压扁的椭圆（正圆会像肥皂泡），空中截击则是正圆爆开
    if (aerial) {
      PUSH(fx.shockwaves, { x, y, r: 8, life: 0.55, speed: 420, w: 2.4, color: "rgba(200,255,160,.95)" }, 12);
      PUSH(fx.shockwaves, { x, y, r: 6, life: 0.7, speed: 210, w: 1.8, color: "rgba(255,214,102,.85)" }, 12);
      // 落点处仍补一圈水面波纹
      PUSH(fx.shockwaves, { x, y: y + 46, r: 8, life: 0.55, speed: 300, w: 2, color: "rgba(198,255,198,.7)", flat: true }, 12);
    } else {
      PUSH(fx.shockwaves, { x, y, r: 8, life: 0.55, speed: 330, w: 2.4, color: "rgba(200,255,160,.95)", flat: true }, 12);
    }
    // 4) 中心小爆闪（短促，不是大光球）
    PUSH(fx.shockwaves, { x, y, r: 3, life: 0.34, speed: 120, w: 9, color: "rgba(244,255,206,.95)", glow: true }, 12);
    // 5) 上飘萤火
    for (let i = 0; i < (aerial ? 5 : 3); i++) {
      PUSH(fx.pollen, {
        x: x + rand(-16, 16), y: y + rand(-8, 8),
        vx: rand(-16, 16), vy: rand(-46, -20),
        r: rand(1.3, 2.4), life: rand(0.55, 1.0), glow: "#d6ff8a"
      }, 80);
    }
    // 6) 荷叶上的涟漪
    PUSH(fx.ripples, { x, y, r: 8, life: 0.8, color: "rgba(198,255,198,.7)", big: true }, 30);
    fx.flash = Math.max(fx.flash, aerial ? 0.15 : 0.07);
    G.sparkBurst(x, y, "#d9ff9a", aerial ? 9 : 6);
  };

  G.ripple = (x, y, miss) => {
    const typ = G.scene.type;
    if (typ !== "fish" && typ !== "frog") return;
    const th = G.seaThemeNow();
    const col = typ === "frog"
      ? (miss ? null : "rgba(190,250,232,.85)")
      : (miss ? null : (th && th.ripple));
    // 荷塘是俯视水面：波纹压成扁椭圆更贴合透视
    PUSH(fx.ripples, { x, y, r: 6, life: 1, miss: !!miss, color: col, flat: typ === "frog" }, 30);
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
    /* 换关火花：几乎原地明灭，只轻微飘动 */
    step(fx.shower, (p, d) => {
      p.x += p.vx * d; p.y += p.vy * d;
      p.vy *= 0.985;
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
    /* 彩纸屑：抛物线飘落 + 自旋（鱼群命中） */
    step(fx.confetti, (p, d) => {
      p.x += p.vx * d; p.y += p.vy * d;
      p.vx *= 0.985; p.vy = p.vy * 0.985 + 260 * d;
      p.rot += p.vr * d;
    });
    step(fx.trails, () => {});
    step(fx.scorches, () => {});
    step(fx.petals, (p, d) => { p.x += p.vx * d; p.y += p.vy * d; p.vy += 60 * d; p.rot += 3 * d; });
    step(fx.paws, () => {});
    /* 飘字：上浮稍快 + 加速淡出（额外 -0.7*dt），缩短猫咪可追逐窗口 */
    step(fx.floats, (p, d) => { p.y -= 40 * d; p.life -= d * 0.7; });
  };

  fx.draw = (ctx) => {
    const nowT = performance.now() / 1000;            // 渲染层没有 t 参数，自己取时间做闪烁相位
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
    ctx.globalAlpha = 1;
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
      ctx.beginPath();
      // flat=贴水面的水波：俯视透视下压成扁椭圆（池塘/泳池用）
      if (p.flat) ctx.ellipse(p.x, p.y, p.r, p.r * 0.42, 0, 0, Math.PI * 2);
      else ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    });
    /* 换关火花：满屏小金点，各自按自己的相位闪，最后随 life 淡出 */
    fx.shower.forEach(p => {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(nowT * p.tw + p.ph));
      ctx.globalAlpha = Math.min(1, p.life * 1.4) * tw;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.75 + 0.35 * tw), 0, Math.PI * 2); ctx.fill();
      if (p.r > 2.0 && tw > 0.70) {
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.4);
        gr.addColorStop(0, "rgba(255,208,120,.34)");
        gr.addColorStop(0.4, "rgba(255,170,70,.14)");
        gr.addColorStop(1, "rgba(255,140,40,0)");
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.4, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
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
      ctx.beginPath();
      // flat=贴水面的水波：俯视透视下压成扁椭圆（池塘/泳池用）
      if (p.flat) ctx.ellipse(p.x, p.y, p.r, p.r * 0.42, 0, 0, Math.PI * 2);
      else ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    });
    /* 光爆碎点：发光小球（黄绿=暗夜萤光默认，泳池金橙水花走逐粒自带色） */
    fx.droplets.forEach(p => {
      const a = Math.min(p.life * 1.5, 0.95);
      ctx.globalAlpha = a;
      if (p.star) {
        // 彩色五角星（兔子模式命中特效），带一圈深色描边 + 自转
        const rot = (p.rot || 0) + (1 - p.life) * (p.spin || 0);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const ang = rot + i * Math.PI / 5 - Math.PI / 2;
          const rr = (i % 2 ? 0.44 : 1) * p.r;
          const px = p.x + Math.cos(ang) * rr, py = p.y + Math.sin(ang) * rr;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = p.c1 || "#ffd75a"; ctx.fill();
        if (p.edge) { ctx.strokeStyle = p.edge; ctx.lineWidth = Math.max(1, p.r * 0.12); ctx.stroke(); }
      } else {
        const rg = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 0, p.x, p.y, p.r);
        rg.addColorStop(0, p.c0 || "#ffffff");
        rg.addColorStop(0.5, p.c1 || "#f2ff9c");
        rg.addColorStop(1, p.c2 || "rgba(150,240,130,.5)");
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
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
        ctx.beginPath();
        // flat=贴水面的冲击波：压成椭圆（俯视有透视的水面，正圆会像肥皂泡）
        if (p.flat) ctx.ellipse(p.x, p.y, p.r, p.r * 0.46, 0, 0, Math.PI * 2);
        else ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
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
    /* 彩纸屑：多彩小纸条自旋飘落（鱼群命中） */
    fx.confetti.forEach(p => {
      ctx.globalAlpha = Math.min(p.life * 1.6, 0.95);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.strokeStyle = p.c; ctx.lineWidth = p.w; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-p.len / 2, 0); ctx.lineTo(p.len / 2, 0); ctx.stroke();
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
