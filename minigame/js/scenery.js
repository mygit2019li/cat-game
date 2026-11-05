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
      /* 深夜枯草地（对照参考视频：俯拍干草 + 碎石 + 四周压暗，写实底纹衬托发光猎物）。
         草秆/碎石只是"数据"，真正上色在离屏 canvas 里做一次并缓存（见 drawGrassField），
         否则每帧几百条曲线会拖慢低端机。 */
      S.grass = [];
      S.pebbles = [];
      S._grassSeed = Math.floor(rand(0, 1e9));
      const nStraw = Math.round(W * H / 175);          // 参考截图里干草较稀，不是密草垫
      const PAL = ["#8a7048", "#9c8055", "#755f3d", "#a89168", "#614c30", "#866c44"];
      for (let i = 0; i < nStraw; i++) {
        // 往画面中间堆成一堆（径向分布，边缘自然变稀，不会出现一条生硬的边界）
        let x = rand(-8, W + 8), y = rand(-8, H + 8);
        if (Math.random() < 0.76) {
          const a = rand(0, Math.PI * 2);
          const rr = Math.pow(Math.random(), 0.62) * Math.min(W * 0.42, H * 0.30);
          x = W * 0.5 + Math.cos(a) * rr;
          y = H * 0.46 + Math.sin(a) * rr * 1.25;
        }
        S.grass.push({
          x, y,
          len: rand(7, 24), ang: -0.34 + rand(-0.5, 0.5),      // 整体顺一个风向，像被压平的枯草
          bend: rand(-2.6, 2.6), w: rand(0.6, 1.5),
          c: PAL[Math.floor(rand(0, PAL.length))],
          a: rand(0.14, 0.42), hi: rand(0, 1) < 0.14
        });
      }
      // 碎草屑 / 草籽：极小的点，补足"草垫"的细颗粒感（视频里地面满是这种碎屑）
      S.chaff = [];
      const nChaff = Math.round(W * H / 1200);
      for (let i = 0; i < nChaff; i++) {
        S.chaff.push({ x: rand(0, W), y: rand(0, H), r: rand(0.8, 2.0), a: rand(0.18, 0.5) });
      }
      const nPeb = Math.round(G.clamp(Math.min(W, H) / 52, 8, 16));
      for (let i = 0; i < nPeb; i++) {
        S.pebbles.push({
          x: rand(0.03, 0.97) * W, y: rand(0.05, 0.95) * H,
          r: rand(3, 9), rot: rand(0, Math.PI),
          c: rand(0, 1) < 0.5 ? "#5a4c3c" : "#6b5b47"
        });
      }
      /* 参考视频有两套地面，中途整屏切换：
         theme 0 = 暗紫褐地面 + 一堆干草（0–15.3s）
         theme 1 = 暗紫褐地面 + 龟裂焦土多边形（15.3–24s） */
      S.poolTheme = 0;
      S.poolShift = null;
      S._shiftDone = false;
      // 龟裂土：抖动网格生成不规则多边形（只算一次，绘制在离屏 canvas 缓存）
      S.cracks = [];
      {
        const cols = 7, rows = Math.max(8, Math.round(cols * H / W));
        const cw = W / cols, ch = H / rows;
        const jit = (v) => rand(0.12, 0.88) * v;
        const pts = [];
        for (let r = 0; r <= rows; r++) {
          const row = [];
          for (let c = 0; c <= cols; c++) {
            row.push({
              x: c * cw + (c === 0 || c === cols ? 0 : rand(-0.30, 0.30) * cw),
              y: r * ch + (r === 0 || r === rows ? 0 : rand(-0.30, 0.30) * ch)
            });
          }
          pts.push(row);
        }
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            S.cracks.push({
              poly: [pts[r][c], pts[r][c + 1], pts[r + 1][c + 1], pts[r + 1][c]],
              tone: rand(0, 1), sub: rand(0, 1) < 0.35 ? jit(0.5) : 0
            });
          }
        }
      }
      // 地面余烬：视频里两套地面都撒着几十颗小金点，各自独立明灭
      S.embers = [];
      for (let i = 0; i < 46; i++) {
        S.embers.push({
          x: rand(0, W), y: rand(0, H),
          r: rand(0.8, 2.0), ph: rand(0, Math.PI * 2), sp: rand(2.5, 6.5)
        });
      }
      // 缓慢上漂的暖色浮尘（环境层，亮度压得很低，不抢猎物）
      S.poolDust = [];
      const nd = Math.round(Math.min(W, H) / 34);
      for (let i = 0; i < nd; i++) {
        S.poolDust.push({
          x: rand(0, W), y: rand(0, H),
          r: rand(1.2, 2.4), ph: rand(0, Math.PI * 2),
          sp: rand(3, 8), amp: rand(5, 14),
          hue: rand(0, 1) < 0.82 ? "255,196,120" : "150,235,225"
        });
      }
    }
    if (type === "frog") {
      /* 夏夜荷塘：6 片荷叶按 3×2 散布（上排远、下排近），青蛙在荷叶之间跳跃。
         荷叶坐标存进 S.pads，猎物（Frog）直接引用——场景只负责画，不做逻辑。 */
      const b = G.bounds();
      // 荷叶半径下限按青蛙体型定：叶面必须比青蛙宽出一圈，否则青蛙会把整片叶子盖住（像浮在空中）
      const R0 = G.clamp(Math.min(W, H) * 0.13, 44, 84);
      S.pads = [];
      const cols = [0.17, 0.50, 0.83], rows = [0.22, 0.66];
      rows.forEach((ry, ri) => {
        cols.forEach(cx => {
          const near = ri === 1;                       // 下排更近：略大、略暖
          const bx = b.x + (cx + rand(-0.012, 0.012)) * b.w;
          const by = b.y + (ry + rand(-0.022, 0.022)) * b.h;
          S.pads.push({
            x: bx, y: by, bx, by,                      // x/y 为当前漂浮位置，bx/by 为漂浮中心
            r: R0 * (near ? rand(1.0, 1.07) : rand(0.92, 1.0)),
            rot: rand(-0.16, 0.16),
            notch: rand(0, Math.PI * 2),               // 叶缘缺口方向
            tone: near ? 1 : 0,                        // 0 暗绿（远） / 1 亮绿（近）
            ph: rand(0, Math.PI * 2),
            hint: 0, swayT: 0, swayAmt: 0,
            // 缓慢漂流：两个不同周期的正弦叠加（水面环流），振幅只有几像素
            drift: {
              ax: rand(0.16, 0.30), ay: rand(0.11, 0.22),
              px: rand(0, Math.PI * 2), py: rand(0, Math.PI * 2),
              ampX: rand(7, 16), ampY: rand(4, 9)
            },
            sink: 0, sinkState: "float", sinkT: 0    // 三只青蛙压沉荷叶：0 浮 / 1 全沉
          });
        });
      });
      // 睡莲：随机挑 2 片荷叶各开一朵（纯装饰）
      // 睡莲浮在荷叶之间的水面上（不放在荷叶上：青蛙蹲在叶心会正好挡住花，像叼着一朵）
      S.lilies = [];
      for (let i = 0; i < 2; i++) {
        for (let attempt = 0; attempt < 30; attempt++) {
          const lx = rand(b.x + b.w * 0.12, b.x + b.w * 0.88);
          const ly = rand(b.y + b.h * 0.34, b.y + b.h * 0.92);
          const clear = S.pads.every(p => Math.hypot(lx - p.x, (ly - p.y) / 0.45) > p.r * 1.25);
          const apart = S.lilies.every(l => Math.hypot(lx - l.x, ly - l.y) > 90);
          if (!clear || !apart) continue;
          S.lilies.push({
            x: lx, y: ly, r: rand(15, 22), ph: rand(0, Math.PI * 2),
            c: i === 0 ? "#f7c9dc" : "#f6e7f0"
          });
          break;
        }
      }
      // 芦苇剪影：贴左右两侧，弱对比不抢戏
      S.reeds = [];
      for (let i = 0; i < 7; i++) {
        const left = i % 2 === 0;
        S.reeds.push({
          x: left ? rand(2, W * 0.06) : rand(W * 0.94, W - 2),
          y: H * rand(0.42, 0.98), h: rand(70, 150), ph: rand(0, Math.PI * 2)
        });
      }
      // 水面萤火：暖黄小光点慢漂（复用 poolDust 的绘制方式）
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
    else if (S.type === "butterfly") drawGarden(ctx, t);
    else if (S.type === "pool") drawPool(ctx, t);
    else if (S.type === "frog") drawPond(ctx, t);
    else if (S.type === "mouse" && S.mouseBg === "swarm") { drawSwarmFloor(ctx, t); }
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

  /* ============ 暗夜萤光（Peppy Cat 石板墙） ============
     对齐官方游玩背景：深棕灰不规则石块 + 深缝 + 微弱受光边，整体压暗，
     最大程度衬托发光猎物（黄绿 glow 在暗底上跳出来） */
  /* ---------- 深夜枯草地：离屏缓存 ----------
     几百根草秆每帧重画会拖慢低端机，所以只画一次到离屏 canvas，之后每帧 drawImage。
     缓存 key 里带尺寸和 seed：换机/转屏/重建场景都会自动重画。 */
  /* 两套地面各缓存一张离屏 canvas（key 带 W/H/seed/theme） */
  const groundCache = {};
  function paintGrass(c2, W, H, S) {
    // 底：暖褐到近黑的纵向渐变（夜里的土地，不是纯黑，保留一点土色）
    let g = c2.createLinearGradient(0, 0, W * 0.35, H);
    g.addColorStop(0, "#2c2022"); g.addColorStop(0.5, "#241a1c"); g.addColorStop(1, "#1a1316");
    c2.fillStyle = g; c2.fillRect(0, 0, W, H);
    // 大块土色斑驳：让地面有起伏，不是一块平色
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = (0.12 + Math.random() * 0.3) * Math.max(W, H);
      const rg = c2.createRadialGradient(x, y, 0, x, y, r);
      const dark = Math.random() < 0.5;
      rg.addColorStop(0, dark ? "rgba(22,15,8,.34)" : "rgba(126,100,64,.18)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      c2.fillStyle = rg;
      c2.beginPath(); c2.arc(x, y, r, 0, Math.PI * 2); c2.fill();
    }
    // 草堆受光：中间一块暖光，草才有"被照亮"的层次
    {
      const rg = c2.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, Math.max(W, H) * 0.55);
      rg.addColorStop(0, "rgba(150,110,70,.12)");
      rg.addColorStop(0.6, "rgba(120,88,54,.06)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      c2.fillStyle = rg; c2.fillRect(0, 0, W, H);
    }
    // 碎石
    (S.pebbles || []).forEach(p => {
      c2.save();
      c2.translate(p.x, p.y); c2.rotate(p.rot);
      c2.fillStyle = "rgba(0,0,0,.42)";
      c2.beginPath(); c2.ellipse(1.5, 2.5, p.r, p.r * 0.72, 0, 0, Math.PI * 2); c2.fill();   // 影子
      c2.fillStyle = p.c;
      c2.beginPath(); c2.ellipse(0, 0, p.r, p.r * 0.7, 0, 0, Math.PI * 2); c2.fill();
      c2.fillStyle = "rgba(255,240,210,.16)";
      c2.beginPath(); c2.ellipse(-p.r * 0.25, -p.r * 0.25, p.r * 0.45, p.r * 0.3, 0, 0, Math.PI * 2); c2.fill();
      c2.restore();
    });
    // 碎屑 / 草籽
    (S.chaff || []).forEach(c => {
      c2.fillStyle = "rgba(190,166,120," + c.a.toFixed(2) + ")";
      c2.beginPath(); c2.arc(c.x, c.y, c.r, 0, Math.PI * 2); c2.fill();
    });
    // 干草秆：先铺一层暗影，再叠亮面，才有"铺在地上的厚度"
    c2.lineCap = "round";
    (S.grass || []).forEach(st => {
      const dx = Math.cos(st.ang) * st.len, dy = Math.sin(st.ang) * st.len;
      const mx = st.x + dx * 0.5 + Math.cos(st.ang + Math.PI / 2) * st.bend;
      const my = st.y + dy * 0.5 + Math.sin(st.ang + Math.PI / 2) * st.bend;
      c2.strokeStyle = "rgba(0,0,0,.20)";
      c2.lineWidth = st.w + 1.2;
      c2.beginPath(); c2.moveTo(st.x + 1.2, st.y + 1.6);
      c2.quadraticCurveTo(mx + 1.2, my + 1.6, st.x + dx + 1.2, st.y + dy + 1.6); c2.stroke();
      // 柔边：先画一道更宽更淡的（模拟失焦的边缘），再画实体
      c2.globalAlpha = st.a * 0.34;
      c2.strokeStyle = st.c;
      c2.lineWidth = st.w + 2.0;
      c2.beginPath(); c2.moveTo(st.x, st.y);
      c2.quadraticCurveTo(mx, my, st.x + dx, st.y + dy); c2.stroke();
      c2.globalAlpha = st.a;
      c2.strokeStyle = st.hi ? "#c8a878" : st.c;
      c2.lineWidth = st.w;
      c2.beginPath(); c2.moveTo(st.x, st.y);
      c2.quadraticCurveTo(mx, my, st.x + dx, st.y + dy); c2.stroke();
      c2.globalAlpha = 1;
    });
  }
  /* ---------- 主题 1：深蓝龟裂地面（按截图 3 复原） ----------
     截图里是深蓝底 + 亮蓝细裂纹组成的多边形板块，不是暗红焦土。 */
  function paintCracks(c2, W, H, S) {
    let g = c2.createLinearGradient(0, 0, W * 0.35, H);
    g.addColorStop(0, "#16224c"); g.addColorStop(0.52, "#101a3d"); g.addColorStop(1, "#0a1230");
    c2.fillStyle = g; c2.fillRect(0, 0, W, H);
    // 底层斑驳
    for (let i = 0; i < 28; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = (0.12 + Math.random() * 0.3) * Math.max(W, H);
      const rg = c2.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, Math.random() < 0.5 ? "rgba(6,10,30,.40)" : "rgba(78,110,210,.15)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      c2.fillStyle = rg;
      c2.beginPath(); c2.arc(x, y, r, 0, Math.PI * 2); c2.fill();
    }
    // 裂纹只集中在中间一块（视频里中间是亮的裂土，四周是暗紫地面）
    const cx = W * 0.5, cy = H * 0.47;
    const rr = Math.min(W * 0.46, H * 0.34);
    (S.cracks || []).forEach(cell => {
      let mx = 0, my = 0;
      cell.poly.forEach(q => { mx += q.x; my += q.y; });
      mx /= 4; my /= 4;
      const d = Math.hypot((mx - cx) / rr, (my - cy) / (rr * 1.15));
      if (d > 1.12) return;
      const k = Math.max(0, 1 - d);
      // 板块填色：亮一点的赭红
      c2.fillStyle = cell.tone > 0.5
        ? "rgba(48,86,168," + (0.20 * k).toFixed(3) + ")"
        : "rgba(26,44,104," + (0.24 * k).toFixed(3) + ")";
      c2.beginPath();
      cell.poly.forEach((q, i) => i ? c2.lineTo(q.x, q.y) : c2.moveTo(q.x, q.y));
      c2.closePath(); c2.fill();
      // 裂纹边缘：暗影 + 亮线（视频里裂纹是发白的细线）
      c2.strokeStyle = "rgba(4,8,26," + (0.46 * k).toFixed(3) + ")";
      c2.lineWidth = 3.2; c2.stroke();
      c2.strokeStyle = "rgba(122,178,255," + (0.58 * k).toFixed(3) + ")";
      c2.lineWidth = 1.2; c2.stroke();
      // 少量次级细裂
      if (cell.sub > 0.25) {
        const a = cell.poly[0], b = cell.poly[2];
        c2.strokeStyle = "rgba(110,160,235," + (0.20 * k).toFixed(3) + ")";
        c2.lineWidth = 0.9;
        c2.beginPath(); c2.moveTo(a.x, a.y); c2.lineTo((a.x + b.x) / 2 + 8, (a.y + b.y) / 2); c2.lineTo(b.x, b.y); c2.stroke();
      }
    });
    // 裂纹区的暖光
    const glow = c2.createRadialGradient(cx, cy, 0, cx, cy, rr * 1.3);
    glow.addColorStop(0, "rgba(90,134,240,.18)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    c2.fillStyle = glow; c2.fillRect(0, 0, W, H);
  }

  function drawGroundLayer(ctx, theme) {
    const S = G.scene, W = S.W, H = S.H;
    const dpr = Math.min(G.platform.dpr || 2, 2);
    const key = W + "x" + H + ":" + (S._grassSeed || 0) + ":" + theme;
    let cache = groundCache[theme];
    if (!cache || cache.key !== key) {
      const mk = (typeof wx !== "undefined" && wx.createCanvas) ? () => wx.createCanvas() : () => document.createElement("canvas");
      const cv = (cache && cache.cv) || mk();
      const c2 = cv.getContext("2d");
      if (!c2) return;
      cv.width = Math.ceil(W * dpr); cv.height = Math.ceil(H * dpr);
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2.clearRect(0, 0, W, H);
      if (theme === 1) paintCracks(c2, W, H, S); else paintGrass(c2, W, H, S);
      cache = groundCache[theme] = { cv, ctx: c2, key };
    }
    ctx.drawImage(cache.cv, 0, 0, W, H);
  }

  function drawPool(ctx, t) {
    const S = G.scene, W = S.W, H = S.H;

    /* ---------- 换关：视频 15.3s 那次是"全屏金色火花 → 整屏换成龟裂焦土" ---------- */
    let shiftK = 1;
    if (S.poolShift) {
      const elapsed = performance.now() - S.poolShift.t0;
      shiftK = Math.max(0, Math.min(1, elapsed / S.poolShift.dur));
      drawGroundLayer(ctx, S.poolShift.from);
      if (shiftK > 0) {
        ctx.save();
        ctx.globalAlpha = shiftK;
        drawGroundLayer(ctx, S.poolShift.to);
        ctx.restore();
      }
      // 火花爆开的一瞬间整屏蒙一层暖光，然后 0.5s 内退掉
      if (shiftK < 0.5) {
        ctx.fillStyle = "rgba(255,178,86," + ((0.5 - shiftK) * 0.30).toFixed(3) + ")";
        ctx.fillRect(0, 0, W, H);
      }
      if (shiftK >= 1) {
        S.poolTheme = S.poolShift.to;
        S.poolShift = null;
      }
    } else {
      drawGroundLayer(ctx, S.poolTheme || 0);
    }

    /* ---------- 地面余烬：视频里两套地面都撒着几十颗独立明灭的小金点 ---------- */
    (S.embers || []).forEach(e => {
      const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * e.sp + e.ph));
      if (tw < 0.3) return;
      ctx.globalAlpha = tw * 0.9;
      ctx.fillStyle = "#ffd27a";
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      if (tw > 0.8) {
        ctx.globalAlpha = (tw - 0.8) * 1.1;
        ctx.fillStyle = "#ffb44a";
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2.6, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    /* ---------- 上漂浮尘（暖色为主、青色点缀） ---------- */
    (S.poolDust || []).forEach(d => {
      let y = (d.y - t * d.sp) % (H + 40);
      if (y < 0) y += H + 40;
      const x = d.x + Math.sin(t * 0.5 + d.ph) * d.amp;
      const a = 0.14 + 0.13 * Math.sin(t * 1.5 + d.ph);
      if (a <= 0.02) return;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, d.r * 4.5);
      rg.addColorStop(0, "rgba(" + d.hue + "," + (a * 0.9).toFixed(3) + ")");
      rg.addColorStop(1, "rgba(" + d.hue + ",0)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y, d.r * 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(" + d.hue + "," + a.toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, Math.PI * 2); ctx.fill();
    });

    // 暗角：四周压到近黑，中间留一点亮
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.46, Math.min(W, H) * 0.16, W * 0.5, H * 0.5, Math.max(W, H) * 0.74);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.46)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
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
        if (p.sink >= 1) { p.sinkState = "sunk"; p.sinkT = 0; }
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

  G.bubbleBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.bubbles, { x: x + rand(-14, 14), y: y + rand(-10, 10), r: rand(3, 8), vy: rand(-70, -30), vx: rand(-20, 20), life: rand(0.5, 1) }, 60); };
  G.dustBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.dust, { x, y, vx: rand(-55, 55), vy: rand(-60, -8), r: rand(3, 7), life: rand(0.4, 0.8) }, 60); };
  G.pollenBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.pollen, { x: x + rand(-12, 12), y: y + rand(-12, 12), vx: rand(-24, 24), vy: rand(-34, -6), r: rand(1.5, 3.4), life: rand(0.7, 1.4) }, 80); };
  G.scalesBurst = (x, y, n) => { for (let i = 0; i < n; i++) PUSH(fx.scales, { x, y, vx: rand(-20, 20), vy: rand(4, 26), r: rand(1, 2.4), life: rand(0.6, 1.3) }, 60); };
  /* 萤火尾迹：一颗暖色余烬，偶尔换一颗青色火星（对应参考视频里那串拖尾与冷色点缀） */
  /* 三张截图里，猎物身后拖的都是一串**金色五角星**（不是圆形火星） */
  G.emberTrail = (x, y) => {
    PUSH(fx.droplets, {
      x: x + rand(-4, 4), y: y + rand(-4, 4),
      vx: rand(-10, 10), vy: rand(-18, -4),
      r: rand(2.2, 4.2), life: rand(0.6, 1.15),
      star: true, rot: rand(0, 6.28),
      c0: "#FFF6C8", c1: "#FFD75A", c2: "rgba(255,170,40,0)"
    }, 90);
  };
  /* 命中光爆：暖橙碎光 + 冷色（青白）小点，冷色是整个画面里唯一的冷调，最跳 */
  /* 萤火虫被拍中：视频里它是一下散成几颗小圆点（白/金），没有夸张的环，也没有水花。
     所以这里刻意"轻"：一把小碎光 + 两三点冷色 + 一圈很细的暖环，短促干净。 */
  /* 命中碎光的配色随猎物种类走（视频里炸开的都是该虫自己的颜色） */
  /* 三种发光玩具动物的爆散配色（主色取自动物本体，冷色取自它们身上那几点蓝） */
  const FF_POP_COLORS = {
    dog:     { main: ["#fff3cf", "#ffab3a"], cyan: "#8ff0e6", ring: "rgba(255,196,120,.78)" },
    mouse:   { main: ["#fdf7c0", "#ffd23e"], cyan: "#7fd8ff", ring: "rgba(255,236,150,.75)" },
    ladybug: { main: ["#ffe6c0", "#ff9100"], cyan: "#9ef0e0", ring: "rgba(255,180,110,.78)" }
  };
  G.lightPop = (x, y, big, species) => {
    const C = FF_POP_COLORS[species] || FF_POP_COLORS.dog;
    const n = big ? 18 : 13;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(90, big ? 300 : 240);
      PUSH(fx.droplets, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(10, 70),
        r: rand(2.0, big ? 4.2 : 3.6), life: rand(0.3, 0.58),
        c0: C.main[0], c1: C.main[1], c2: "rgba(255,140,30,0)"
      }, 90);
    }
    // 冷色：虫体上那些发光点的颜色，散出去最"跳"
    for (let i = 0; i < (big ? 7 : 4); i++) {
      const a = rand(0, Math.PI * 2), sp = rand(70, 220);
      PUSH(fx.droplets, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(0, 40),
        r: rand(1.5, 2.6), life: rand(0.34, 0.6),
        c0: "#f4fffe", c1: C.cyan, c2: "rgba(120,240,230,0)"
      }, 90);
    }
    // 几颗金色小星星（三张截图里散落的都是星星）
    for (let i = 0; i < (big ? 5 : 3); i++) {
      const a = rand(0, Math.PI * 2), sp = rand(60, 180);
      PUSH(fx.droplets, {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(10, 60),
        r: rand(2.2, 4.0), life: rand(0.4, 0.8),
        star: true, rot: rand(0, 6.28),
        c0: "#fff6c8", c1: "#ffd75a", c2: "rgba(255,170,40,0)"
      }, 90);
    }
    // 一圈很细的暖环（视频里几乎看不出环，但完全不给会显得"没打到"）
    PUSH(fx.shockwaves, { x, y, r: 6, life: 0.34, speed: big ? 300 : 240, w: 1.8, color: C.ring, flat: true }, 12);
    fx.flash = Math.max(fx.flash, big ? 0.10 : 0.06);
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
  /* 换关：火花 + 1.1s 整屏交叉淡入到另一套地面 */
  G.poolShiftTheme = () => {
    const S = G.scene;
    if (!S || S.type !== "pool" || S.poolShift || S._shiftDone) return false;
    S._shiftDone = true;
    S.poolShift = {
      t0: performance.now(), dur: 1100,
      from: S.poolTheme || 0, to: (S.poolTheme || 0) === 0 ? 1 : 0
    };
    G.goldShower();
    /* 视频里火花不是均匀撒的：拍击点还有一团集中的亮橙爆闪 */
    const W = G.platform.W / (G.platform.S || 1), H = G.platform.H / (G.platform.S || 1);
    const cx = W * 0.5, cy = H * 0.20;
    if (G.lightPop) G.lightPop(cx, cy, true, "dog");
    for (let i = 0; i < 16; i++) {
      const a = rand(0, Math.PI * 2), r = rand(4, 34);
      PUSH(fx.droplets, {
        x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.6,
        vx: Math.cos(a) * rand(60, 240), vy: Math.sin(a) * rand(50, 190),
        r: rand(2.4, 5.6), life: rand(0.35, 0.85),
        c0: "#fff8dc", c1: "#ff9a32", c2: "rgba(255,110,20,0)"
      }, 90);
    }
    if (G.playFireflyShift) G.playFireflyShift();
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

  /* 夸张光爆/水花（暗夜萤光默认黄绿盘；泳池传 "gold" 金橙水花盘）：
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
    if (typ !== "fish" && typ !== "pool" && typ !== "frog") return;
    const th = G.seaThemeNow();
    const col = typ === "pool"
      ? (miss ? null : "rgba(226,255,150,.9)")
      : typ === "frog"
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
        // 五角星：截图里的金色小星星
        ctx.fillStyle = p.c1 || "#ffd75a";
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const ang = (p.rot || 0) + i * Math.PI / 5 - Math.PI / 2;
          const rr = (i % 2 ? 0.44 : 1) * p.r;
          const px = p.x + Math.cos(ang) * rr, py = p.y + Math.sin(ang) * rr;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.fill();
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
