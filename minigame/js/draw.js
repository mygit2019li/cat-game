/* draw.js — 矢量精灵绘制（Canvas 路径版，替代原型 SVG/CSS） */
module.exports = function (G) {
  const D = {};

  /* ---------- 颜色小工具（群鼠 6 变体配色派生用） ---------- */
  const _hex2rgb = (h) => {
    const s = h.replace("#", "");
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  };
  /* hex → rgba 字符串（带 alpha） */
  const _hexA = (h, a) => {
    const c = _hex2rgb(h);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")";
  };
  /* 向 (r,g,b) 方向混合 amt（0–1）：amt=0 返回原色，amt=1 返回目标 */
  const _mix = (h, tgt, amt) => {
    const a = _hex2rgb(h), b = tgt;
    const c = a.map((x, i) => Math.round(x + (b[i] - x) * amt));
    return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
  };
  /* 变体配色派生：身体 4 段（受光浅→中→侧→边暗）、耳 3 段、尾/鼻/腹侧带。
     受光白推只 0.14、侧背直接用 back 压深——保住炭胆/烟尾等深色鼠的花色差异。 */
  const _mousePalette = (v) => {
    const back = v.back, mid = v.mid, belly = v.belly;
    const LIGHT = [255, 248, 235];      // 仓顶灯暖白（弱推，保持底色）
    const DARK = [42, 32, 22];          // 边缘暗部暖棕黑
    const backLumP = (c => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]))(_hex2rgb(back)) / 255;
    const isDark = backLumP <= 0.38;    // 深毛色鼠（炭胆 lum≈.32 / 烟尾 lum≈.36）
    return {
      body: [
        isDark ? mid : _mix(mid, LIGHT, 0.14),   // 深鼠受光面不推白，直接用 mid；亮鼠轻提亮
        back,                                    // 中（用 back 压深，侧背主体色）
        _mix(back, [0, 0, 0], isDark ? 0.3 : 0.20), // 深鼠侧背再加深
        _mix(back, DARK, 0.5)                    // 边缘暗
      ],
      ear: [
        _mix(v.ear, LIGHT, 0.22),
        v.ear,
        _mix(v.ear, DARK, 0.4)
      ],
      earIn: v.earIn || "rgba(232,180,169,.72)",
      tail: v.tail || "#c99f85",
      tailLight: "rgba(255,236,240,.9)",
      nose: v.nose || "#d98a7d",
      bellyBand: belly   // 腹侧/吻部白带底色
    };
  };

  /* ---------- 鱼（设计空间 120×72，中心 60,36） ----------
     体型由品种命中盒宽高比推出：k = (h/w) / 0.6（0.6 = 设计空间 72/120）
       k < 0.85  瘦长：鱼雷体 + 尖吻 + 叉形燕尾（沙丁鱼、小丑鱼）
       k ≈ 1     常规：椭圆体（锦鲤）
       k > 1.15  高身：圆背 + 高背鳍（金鱼、神仙鱼） */
  D.fish = (ctx, p, t) => {
    const sp = p.species || {};
    const c = p.speciesColors || sp.variants && sp.variants[0] || sp;
    if (sp.shape === "shark")  return D.shark(ctx, p, c, t);
    if (sp.shape === "ray")    return D.ray(ctx, p, c, t);
    if (sp.shape === "puffer") return D.puffer(ctx, p, c, t);
    if (sp.shape === "whale")  return D.whale(ctx, p, c, t);
    if (sp.shape === "turtle") return D.turtle(ctx, p, c, t);
    if (sp.shape === "creekFish") return D.creekFish(ctx, p, c, t);
    if (sp.shape === "minnow") return D.minnow(ctx, p, c, t);

    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    // 体型纵向系数：优先用品种显式 build，否则由命中盒宽高比推出
    const k = cl(sp.build || (((sp.h || 72) / (sp.w || 120)) / 0.62), 0.5, 1.4);
    const H = 23 * k;                       // 身体半高
    const CY = 36, NOSE = 114, TAIL = 24;   // 吻尖 / 尾柄（身体占满设计宽度）
    const tailK = Math.max(k, 0.86);        // 尾鳍不跟着身体一起压扁
    const slim = k < 0.88;
    const wag = Math.sin(t * Math.PI * 2 / Math.max(p.wagDur || 0.5, 0.08) + p.phase) * (slim ? 0.32 : 0.28);
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(NOSE, CY);
      ctx.quadraticCurveTo(101, CY - H * 0.7, 64, CY - H);
      ctx.quadraticCurveTo(40, CY - H * 0.9, TAIL, CY - H * 0.24);    // 背 → 细尾柄
      ctx.quadraticCurveTo(TAIL - 4, CY, TAIL, CY + H * 0.24);
      ctx.quadraticCurveTo(40, CY + H * 0.94, 64, CY + H);
      ctx.quadraticCurveTo(101, CY + H * 0.74, NOSE, CY);
      ctx.closePath();
    };

    // 尾鳍：瘦长鱼走叉形燕尾，其余走扇形尾
    ctx.save();
    ctx.translate(TAIL, CY); ctx.rotate(wag); ctx.scale(1, tailK);
    ctx.fillStyle = c.fin;
    ctx.beginPath();
    if (slim) {
      ctx.moveTo(4, 0);
      ctx.lineTo(-23, -20); ctx.quadraticCurveTo(-11, -6, -12, 0);
      ctx.quadraticCurveTo(-11, 6, -23, 20);
    } else {
      ctx.moveTo(3, 0); ctx.lineTo(-22, -20); ctx.lineTo(-15, 0); ctx.lineTo(-22, 20);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // 身体（品种可给 bodyGrad:[吻色,尾色] → 吻→尾线性渐变，金鱼族的金属光泽）
    if (c.bodyGrad) {
      const bg = ctx.createLinearGradient(NOSE, 0, TAIL, 0);
      bg.addColorStop(0, c.bodyGrad[0]); bg.addColorStop(1, c.bodyGrad[1]);
      ctx.fillStyle = bg;
    } else ctx.fillStyle = c.body;
    bodyPath(); ctx.fill();
    // 腹部受光
    ctx.fillStyle = c.belly; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.ellipse(70, CY + H * 0.34, 36, H * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // 斑纹（裁剪到身体）
    if (c.pattern === "spots") {
      ctx.save(); bodyPath(); ctx.clip();
      ctx.fillStyle = c.accent; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(58, CY - H * 0.24, 10 * k, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(96, CY + H * 0.28, 9 * k, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(44, CY + H * 0.4, 7 * k, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (c.pattern === "stripes") {
      ctx.save(); bodyPath(); ctx.clip();
      ctx.fillStyle = c.accent; ctx.globalAlpha = 0.72;
      const deep = k > 1.1;                            // 高身鱼：多一道更细的竖纹
      const bw = (deep ? 6 : 8) * Math.min(1, 1 / k);
      for (let i = 0; i < (deep ? 3 : 2); i++) {
        ctx.fillRect(46 + i * (deep ? 17 : 22), CY - H - 8, bw, H * 2 + 16);
      }
      ctx.restore();
    }
    // 渐变鱼专属：背部高光弧（模拟水面落光，参考图金鱼的背脊亮线）
    if (c.bodyGrad) {
      ctx.strokeStyle = "rgba(255,255,255,.34)";
      ctx.lineWidth = 2.6; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(103, CY - H * 0.36);
      ctx.quadraticCurveTo(72, CY - H * 1.06, 44, CY - H * 0.5);
      ctx.stroke();
    }
    // 背鳍 / 臀鳍 / 胸鳍（高身鱼鳍更高）
    const dh = H * (0.5 + 0.28 * k);
    ctx.fillStyle = c.fin;
    ctx.beginPath();
    ctx.moveTo(56, CY - H * 0.85);
    ctx.quadraticCurveTo(72, CY - H - dh, 92, CY - H * 0.72);
    ctx.quadraticCurveTo(72, CY - H * 0.9, 56, CY - H * 0.85);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(62, CY + H * 0.85);
    ctx.quadraticCurveTo(76, CY + H + dh * 0.72, 92, CY + H * 0.74);
    ctx.quadraticCurveTo(76, CY + H * 0.9, 62, CY + H * 0.85);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(80, CY + H * 0.5);
    ctx.quadraticCurveTo(70, CY + H + dh * 0.8, 54, CY + H + dh * 0.5);
    ctx.quadraticCurveTo(68, CY + H * 0.72, 72, CY + H * 0.45);
    ctx.closePath(); ctx.fill();
    // 鳃线
    ctx.strokeStyle = c.accent; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(80, CY - H * 0.52);
    ctx.quadraticCurveTo(89, CY, 80, CY + H * 0.52);
    ctx.stroke();
    // 眼
    const er = cl(5 + 1.5 * k, H * 0.3, H * 0.5);
    const ey = CY - H * 0.34;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(99, ey, er, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#17323b"; ctx.beginPath(); ctx.arc(100.6, ey, er * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(101.5, ey - er * 0.22, er * 0.18, 0, Math.PI * 2); ctx.fill();
    // 嘴
    ctx.strokeStyle = c.accent; ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(106, CY + H * 0.16);
    ctx.quadraticCurveTo(110.5, CY + H * 0.34, 113.5, CY + H * 0.16);
    ctx.stroke();
  };

  /* ---------- 小银鱼（鱼群巡游：参考图的"彗星"小鱼——亮头 + 长拖尾光迹，设计空间 120×72） ----------
     头部小亮核 + 向后拖长的渐隐尾迹（带轻微摆动曲线），纯扁平、无鳍无眼细节（远看就是光点彗星） */
  D.minnow = (ctx, p, c, t) => {
    const tint = c.body || "#aebfc9";
    // 长拖尾：从头部向后渐隐的彗尾（带正弦弯），透明度沿程衰减
    const wag = Math.sin(t * Math.PI * 2 / Math.max(p.wagDur || 0.5, 0.08) + p.phase) * 6;
    const tg = ctx.createLinearGradient(78, 0, 4, 0);
    tg.addColorStop(0, "rgba(255,255,255,.92)");
    tg.addColorStop(0.35, "rgba(230,245,255,.55)");
    tg.addColorStop(1, "rgba(215,238,255,.05)");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(74, 31);
    ctx.quadraticCurveTo(40, 30 + wag * 0.4, 4, 33 + wag);
    ctx.quadraticCurveTo(40, 42 + wag * 0.4, 74, 41);
    ctx.closePath(); ctx.fill();
    // 头部亮核（小杏仁身，微亮）
    const bg = ctx.createLinearGradient(0, 24, 0, 48);
    bg.addColorStop(0, "#f4fbff");
    bg.addColorStop(1, tint);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(88, 36);
    ctx.quadraticCurveTo(80, 26, 68, 27);
    ctx.quadraticCurveTo(60, 29, 58, 36);
    ctx.quadraticCurveTo(60, 43, 68, 45);
    ctx.quadraticCurveTo(80, 46, 88, 36);
    ctx.closePath(); ctx.fill();
    // 头前亮点 + 小黑眼
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.beginPath(); ctx.arc(80, 33, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#25344d";
    ctx.beginPath(); ctx.arc(82, 32.5, 1.5, 0, Math.PI * 2); ctx.fill();
  };

  /* ---------- 小河观赏鱼（俯视偏斜视角，设计空间 120×72，头朝右） ----------
     对齐参考图的视角与体态：从水面斜看下去，看到的是卵形侧扁的鱼背 + 收细的尾柄 +
     半透明大扇尾（越靠尾尖越透，边缘一道白） + 两侧胸鳍 + 脊背一道水光高光；
     俯视能看到头的两侧各一只眼睛（黑瞳 + 一圈很淡的眼白）。
     游动：沿岸线做正弦摆动（尾部摆幅最大、相位滞后），尾鳍再补一点相位差，
     读起来是"整条鱼在扭"，不是只有尾巴在扇。
     配色/斑块全由 speciesColors 决定：bodyGrad[0]=背（深）→[1]=腹（浅），
     fin=鳍色，tip=尾尖色，pattern:"koi" 时按 patches 画黑斑（乌白云锦鲤）。 */
  D.creekFish = (ctx, p, c, t) => {
    const CY = 36;
    const ph = p.phase || 0;
    // 摆动相位：wagDur 越小摆得越快（不同鱼种节奏不同）
    const swim = t * Math.PI * 2 / Math.max(p.wagDur || 0.62, 0.12) + ph;
    const finW = 0.5 + 0.5 * Math.sin(swim * 1.35 + 0.6);   // 0..1 胸鳍扑扇
    const AMP = 5.0;
    // 尾柄处的摆幅最大，越靠吻端越小
    const spine = (u) => Math.sin(swim - u * 2.6) * AMP * Math.pow(1 - u, 1.9);
    /* 身体半宽剖面（u=0 尾柄 → u=1 吻端）：中段最饱满、尾柄急收、吻端圆钝 */
    const PR = [[0, 3.4], [0.05, 5.2], [0.13, 8.0], [0.23, 11.6], [0.34, 14.8],
                [0.46, 17.4], [0.58, 18.8], [0.68, 18.4], [0.78, 16.2], [0.87, 12.8], [0.94, 9.0], [1, 1.2]];
    const halfW = (u) => {
      for (let i = 1; i < PR.length; i++) {
        if (u <= PR[i][0]) {
          const a = PR[i - 1], b = PR[i], k = (u - a[0]) / (b[0] - a[0] || 1);
          return a[1] + (b[1] - a[1]) * k;
        }
      }
      return PR[PR.length - 1][1];
    };
    const X0 = 20, XL = 94;                                // 尾柄 x / 身长
    const bx = (u) => X0 + u * XL;
    const bodyPath = () => {
      const N = 18;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {                       // 上缘：吻 → 尾
        const u = 1 - i / N, x = bx(u), y = CY + spine(u) - halfW(u);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      for (let i = 0; i <= N; i++) {                       // 下缘：尾 → 吻
        const u = i / N;
        ctx.lineTo(bx(u), CY + spine(u) + halfW(u));
      }
      ctx.closePath();
    };
    const top = (c.bodyGrad && c.bodyGrad[0]) || c.body || "#e8452a";
    const belly = (c.bodyGrad && c.bodyGrad[1]) || "#ff9a70";
    const finC = c.fin || "#ff9a70";
    const tipC = c.tip || "#fff4e8";
    const koi = c.pattern === "koi";

    // ---- 尾鳍：绕尾柄旋转（跟随脊柱斜率 + 一点相位差），双叶大扇尾 ----
    // 颜色沿尾轴从"鳍色"渐变到"尾尖色 + 高透"，只有边缘留一道白 —— 不能整片发白，否则像帆
    const tailAng = (spine(0.06) - spine(0)) / (0.06 * XL) * 0.9 + Math.sin(swim + 1.2) * 0.07;
    ctx.save();
    ctx.translate(X0 - 1, CY + spine(0)); ctx.rotate(tailAng);
    const tailK = c.tailK || 1;
    ctx.scale(1, tailK);
    const tg = ctx.createLinearGradient(3, 0, -32, 0);
    tg.addColorStop(0, finC);
    tg.addColorStop(0.40, finC);
    tg.addColorStop(0.74, c.tip ? tipC : finC);
    tg.addColorStop(1, c.tip ? tipC : finC);
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(4, -3);
    ctx.bezierCurveTo(-7, -15, -20, -32, -34, -30);        // 上叶外缘（后掠弧，先扬后收）
    ctx.bezierCurveTo(-30, -18, -23, -7, -11, -1.5);       // 上叶内缘 → 缺口
    ctx.bezierCurveTo(-23, 7, -30, 18, -34, 30);           // 下叶内缘
    ctx.bezierCurveTo(-20, 32, -7, 15, 4, 3);              // 下叶外缘
    ctx.closePath(); ctx.fill();
    // 尾尖透明度衰减：外缘压一层"水色"，尾鳍才不会像一块白帆
    const fade = ctx.createLinearGradient(-8, 0, -34, 0);
    fade.addColorStop(0, "rgba(255,255,255,0)");
    fade.addColorStop(1, "rgba(40,96,72,.34)");
    ctx.fillStyle = fade; ctx.fill();
    // 外缘一道白（参考图里尾鳍最外圈那圈亮边）
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = tipC; ctx.lineWidth = 1.6; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-11, -1.5);
    ctx.bezierCurveTo(-23, -7, -30, -18, -34, -30);
    ctx.moveTo(-11, 1.5);
    ctx.bezierCurveTo(-23, 7, -30, 18, -34, 30);
    ctx.stroke();
    // 鳍条：从尾柄散开的细纹
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 0.85; ctx.lineCap = "round";
    [[-0.62], [-0.34], [0.02], [0.34], [0.62]].forEach(k => {
      ctx.beginPath(); ctx.moveTo(1, 0);
      ctx.quadraticCurveTo(k[0] * 12, k[0] * 16, k[0] * 30, k[0] * 27);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    // ---- 背鳍：贴着脊背的一条窄鳍（俯视只看得到中间一线，露在背线外 3px）----
    ctx.save();
    ctx.globalAlpha = 0.5;
    const dg = ctx.createLinearGradient(0, CY - 26, 0, CY - 4);
    dg.addColorStop(0, finC);
    dg.addColorStop(1, "rgba(255,255,255,.05)");
    ctx.fillStyle = dg;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {                          // 前缘（背脊上侧）
      const u = 0.30 + i / 6 * 0.38, x = bx(u), y = CY + spine(u) - halfW(u) * 0.98 - 3.2;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    for (let i = 6; i >= 0; i--) {                          // 后缘回到背脊
      const u = 0.30 + i / 6 * 0.38;
      ctx.lineTo(bx(u), CY + spine(u) - halfW(u) * 0.72);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // ---- 臀鳍（尾柄下侧的一小片）----
    ctx.save();
    ctx.globalAlpha = 0.5; ctx.fillStyle = finC;
    ctx.beginPath();
    ctx.moveTo(31, CY + spine(0.12) + 8);
    ctx.quadraticCurveTo(25, CY + spine(0.12) + 18, 16, CY + spine(0.12) + 16);
    ctx.quadraticCurveTo(23, CY + spine(0.12) + 9, 27, CY + spine(0.12) + 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // ---- 身体：背深腹浅的横向渐变 ----
    const bg = ctx.createLinearGradient(0, CY - 21, 0, CY + 21);
    bg.addColorStop(0, top);
    bg.addColorStop(0.30, top);
    bg.addColorStop(0.58, c.body || belly);
    bg.addColorStop(1, belly);
    ctx.fillStyle = bg;
    bodyPath(); ctx.fill();

    // 以下全部裁进鱼身：斑块 / 鳞片 / 脊背高光 / 内缘暗边
    ctx.save();
    bodyPath(); ctx.clip();

    // 乌白云锦鲤：黑斑（每块由两个错位椭圆叠成，破掉"标准圆斑"感）
    if (koi && c.patches) {
      c.patches.forEach(pt => {
        const px = bx(pt.x), py = CY + spine(pt.x) + (pt.y - 0.5) * 2 * halfW(pt.x) * 0.9;
        const rx = pt.rx * XL, ry = Math.max(5, pt.ry * halfW(pt.x) * 1.5);
        ctx.save();
        ctx.translate(px, py); ctx.rotate(pt.rot || 0);
        const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
        pg.addColorStop(0, "#191a20");
        pg.addColorStop(0.72, "#22242c");
        pg.addColorStop(1, "rgba(34,36,44,0)");
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.ellipse(rx * 0.34, -ry * 0.30, rx * 0.62, ry * 0.56, (pt.rot || 0) + 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    /* 体表受光：浅水里鱼背是"湿亮的"——上缘一道强反光、往下快速衰减，
       再沿脊柱叠一道细高光。这两层是鱼从平涂变成立体的关键。 */
    const hl = ctx.createLinearGradient(0, CY - 20, 0, CY + 20);
    hl.addColorStop(0, "rgba(24,12,6,.20)");        // 上缘（背侧）压暗
    hl.addColorStop(0.26, "rgba(255,255,255,.16)"); // 背脊偏上受光
    hl.addColorStop(0.46, "rgba(255,255,255,.07)");
    hl.addColorStop(0.74, "rgba(255,255,255,.03)"); // 腹侧开始转暗
    hl.addColorStop(1, "rgba(24,12,6,.16)");
    ctx.fillStyle = hl;
    ctx.fillRect(0, CY - 24, 120, 48);
    // 脊柱细高光（一道沿身体的亮线，游动时跟着弯）
    ctx.strokeStyle = "rgba(255,255,255,.20)"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const u = 0.14 + i / 12 * 0.78, x = bx(u), y = CY + spine(u) - halfW(u) * 0.34;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();

    // 鳞片：三排错位的浅弧（低对比，只铺中段，不抢斑块）
    if (!koi) {
      ctx.strokeStyle = "rgba(255,246,232,.22)"; ctx.lineWidth = 0.9;
      for (let r = -1; r <= 1; r++) {
        for (let i = 0; i < 5; i++) {
          const u = 0.22 + i * 0.12 + (r === 0 ? 0.06 : 0);
          const x = bx(u), y = CY + spine(u) + r * halfW(u) * 0.46;
          ctx.beginPath(); ctx.arc(x, y, 5.2, Math.PI * 0.52, Math.PI * 1.48); ctx.stroke();
        }
      }
    }
    // 内缘暗边：贴着轮廓往里压一道深色，鱼身立刻有圆柱感
    bodyPath();
    ctx.strokeStyle = "rgba(46,26,12,.16)"; ctx.lineWidth = 3.2; ctx.stroke();
    ctx.restore();

    // 上缘水光（背线外侧一道很细的亮边，像刚出水）
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= 18; i++) {
      const u = 1 - i / 18, x = bx(u), y = CY + spine(u) - halfW(u);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = "rgba(255,255,255,.30)"; ctx.lineWidth = 1.1; ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();

    // ---- 鳃盖：头部一条前凸的弧线（俯视是横跨背脊的一道弧）----
    const gx = 95;
    ctx.strokeStyle = "rgba(80,36,16,.30)"; ctx.lineWidth = 1.2; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(gx, CY + spine(0.80) - 11);
    ctx.quadraticCurveTo(gx + 5.5, CY + spine(0.80), gx, CY + spine(0.80) + 11);
    ctx.stroke();

    // ---- 胸鳍：体侧两片半透明小扇鳍（俯视两侧各一，轻扑扇）----
    [-1, 1].forEach(sd => {
      const u = 0.79, ax = bx(u), ay = CY + spine(u) + sd * halfW(u) * 0.74;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(sd * (0.80 + finW * 0.28));
      const pg = ctx.createLinearGradient(0, 0, -16, sd * 18);
      pg.addColorStop(0, finC);
      pg.addColorStop(0.6, c.tip ? tipC : finC);
      pg.addColorStop(1, "rgba(255,255,255,.05)");
      ctx.fillStyle = pg;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.quadraticCurveTo(-9, sd * 8, -17, sd * 17);
      ctx.quadraticCurveTo(-4, sd * 13, 4, sd * 3);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-2, sd * 1); ctx.quadraticCurveTo(-9, sd * 8, -13, sd * 14); ctx.stroke();
      ctx.restore();
    });

    // ---- 眼睛：俯视能看到头的两侧各一只（很小的黑瞳 + 一圈很淡的眼白）----
    const eu = 0.90, ex = bx(eu), er = 2.4;
    [-1, 1].forEach(sd => {
      const ey = CY + spine(eu) + sd * halfW(eu) * 0.62;
      ctx.fillStyle = "rgba(255,252,244,.55)";
      ctx.beginPath(); ctx.arc(ex, ey, er * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.accent || "#1b1210";
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.beginPath(); ctx.arc(ex - 0.6, ey - 0.8, er * 0.30, 0, Math.PI * 2); ctx.fill();
    });

    // ---- 吻端：一道小弧当嘴（俯视只看得到吻的收口）----
    ctx.strokeStyle = "rgba(60,28,14,.34)"; ctx.lineWidth = 1.0; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx(0.98), CY + spine(1) - 3.2);
    ctx.quadraticCurveTo(bx(1) + 2.4, CY + spine(1), bx(0.98), CY + spine(1) + 3.2);
    ctx.stroke();
  };


  /* ---------- 鲨鱼（瘦长鱼雷体 + 尖吻 + 新月尾 + 高背鳍 + 5 道鳃裂） ---------- */
  D.shark = (ctx, p, c, t) => {
    const CY = 36, H = 14;                 // 半高 14 → 体高 28（长 ≈ 90，细长比 3.2:1）
    const wag = Math.sin(t * Math.PI * 2 / Math.max(p.wagDur || 0.5, 0.08) + p.phase) * 0.24;
    // 新月形尾鳍（上叶长、下叶短）
    ctx.save();
    ctx.translate(26, CY); ctx.rotate(wag);
    ctx.fillStyle = c.fin;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-25, -28); ctx.quadraticCurveTo(-11, -8, -12, 0);
    ctx.lineTo(-22, 22); ctx.closePath(); ctx.fill();
    ctx.restore();
    // 身体：尖吻 + 细尾柄的鱼雷形
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.moveTo(114, CY);
    ctx.quadraticCurveTo(99, CY - H * 0.78, 68, CY - H);        // 上吻线 → 背
    ctx.quadraticCurveTo(42, CY - H * 0.92, 27, CY - H * 0.26); // 背 → 细尾柄
    ctx.quadraticCurveTo(23, CY, 27, CY + H * 0.26);
    ctx.quadraticCurveTo(42, CY + H * 0.94, 68, CY + H);
    ctx.quadraticCurveTo(99, CY + H * 0.86, 114, CY);           // 下吻线（吻端略尖）
    ctx.closePath(); ctx.fill();
    // 腹部受光（反荫蔽）
    ctx.fillStyle = c.belly; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(68, CY + H * 0.62, 34, H * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // 大背鳍（三角）+ 小第二背鳍
    ctx.fillStyle = c.fin;
    ctx.beginPath(); ctx.moveTo(48, CY - H * 0.86); ctx.quadraticCurveTo(58, CY - H - 26, 84, CY - H * 0.7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(31, CY - H * 0.76); ctx.quadraticCurveTo(35, CY - H - 10, 45, CY - H * 0.72); ctx.closePath(); ctx.fill();
    // 后掠胸鳍 + 小臀鳍
    ctx.beginPath(); ctx.moveTo(70, CY + H * 0.7); ctx.quadraticCurveTo(58, CY + H + 20, 40, CY + H + 12); ctx.quadraticCurveTo(58, CY + H * 0.9, 62, CY + H * 0.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(34, CY + H * 0.82); ctx.quadraticCurveTo(38, CY + H + 8, 48, CY + H * 0.8); ctx.closePath(); ctx.fill();
    // 鳃裂 5 道
    ctx.strokeStyle = c.accent; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(78 + i * 6, CY - H * 0.5); ctx.quadraticCurveTo(81 + i * 6, CY, 78 + i * 6, CY + H * 0.5); ctx.stroke();
    }
    // 眼（小而凶）
    ctx.fillStyle = "#17323b"; ctx.beginPath(); ctx.arc(101, CY - H * 0.24, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(102.2, CY - H * 0.36, 1.1, 0, Math.PI * 2); ctx.fill();
    // 微张的嘴 + 一排小白牙
    ctx.strokeStyle = c.accent; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(112, CY + H * 0.32); ctx.quadraticCurveTo(104, CY + H * 0.9, 94, CY + H * 0.72); ctx.stroke();
    ctx.fillStyle = "#fff";
    [[108, CY + H * 0.44], [104.5, CY + H * 0.6], [101, CY + H * 0.7], [97.5, CY + H * 0.74]].forEach(([tx, ty]) => {
      ctx.beginPath(); ctx.moveTo(tx - 1.8, ty - 1.2); ctx.lineTo(tx, ty + 3); ctx.lineTo(tx + 1.8, ty - 1.2); ctx.closePath(); ctx.fill();
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
    // 河豚原绘制只占设计空间 69/120（其他鱼都在 110 以上），屏幕上明显小一圈，
    // 命中盒相对视觉宽出 1.73 倍。这里整体放大到与其他鱼同一填充度，中心保持 (60,36)。
    ctx.save();
    ctx.translate(60, 36); ctx.scale(1.55, 1.55); ctx.translate(-60, -36);
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
    ctx.restore();
  };

  /* HD 贴图侧视鼠：素材内容框 x[8,221] y[9,257]（231×267），头朝右、尾朝左。
     映射到设计空间 120×78（面向右，中心 60,39），程序叠加奔跑起伏、嗅探、发光眼。 */
  const _mouseSideHD = (ctx, p, t, v, tex) => {
    const sniff = Math.sin(t * 9 + (p.phase || 0)) * 1.2;
    const running = p.state === "dart";
    // 腿部/身体起伏：冲刺时更高频但更克制（20→13→9），慢速游移时用 t*1.8 的轻微起伏
    // 让腿部动作与移动协调，消除"腿停死"的违和感，整体节奏放慢一档
    const bob = running ? Math.abs(Math.sin(t * 4.5)) * 1.5 : Math.sin(t * 0.9 + (p.phase || 0)) * 0.7;
    const sx0 = 8, sy0 = 9, sw = 213, shh = 248;
    const dw = 104, dh = 78;
    ctx.save();
    ctx.translate(60, 39 + bob * 0.5);
    ctx.drawImage(tex, sx0, sy0, sw, shh, -dw / 2 + 2, -dh / 2, dw, dh);
    ctx.restore();
    // 眼高光（贴图珠眼上叠一点暖光，暗夜可辨）
    const isRedEye = v.key === "albino";
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const g = ctx.createRadialGradient(99, 36, 0, 99, 36, 7);
    const c0 = isRedEye ? "rgba(255,110,100," : "rgba(255,214,140,";
    g.addColorStop(0, c0 + "0.5)"); g.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(99, 36, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- 老鼠（设计空间 120×78，面向右；花色 variants 参数化） ---------- */
  D.mouse = (ctx, p, t) => {
    const v = p.mouseVar || G.MOUSE_VARIANTS[0];
    D.initMiceHD();
    if (_mouseVideo(ctx, p, t, v)) return;        // 视频关键帧奔跑动画（侧视，最高优先）
    const tex = MICEHD.side[v.key];
    if (tex && tex.ok) return _mouseSideHD(ctx, p, t, v, tex);
    // 体型比例：以躯干中心 (60,44) 为轴横向拉长、纵向压扁 → 更瘦长的鼠形（耳/眼轻微椭圆化，观感更灵巧）
    ctx.save(); ctx.translate(60, 44); ctx.scale(1.08, 0.80); ctx.translate(-60, -44);
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
    ctx.restore();
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
          // 浏览器垫片页面在 test/ 下：拼一层 ../ 才能找到 assets（真机不受影响）
          const sub = (typeof location !== "undefined" && location.protocol === "file:" &&
                       /\/test\/[^/]*$/.test(decodeURIComponent(location.pathname))) ? "../" : "";
          img.src = sub + url;
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
    if (p.state === "RESTING") {                                   // 落花：翅膀微微张开 + 缓慢呼吸
      const rb = 0.4 + 0.045 * Math.sin(t * 2.2 + (p.phase || 0));
      ws = rb; lower = rb - 0.05;
    }
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

  /* ---------- 激光光点（皮肤表驱动，大小屏统一色系：经典红/翠绿） ---------- */
  const LASER_SKIN = {
    red:   { glow0: "rgba(255,70,70,.8)",  glowMid: "rgba(255,30,30,.28)",  glowEnd: "rgba(255,0,0,0)",
             coreMid: "#ff7a7a", coreMidPanic: "#ff9a7a", core72: "rgba(255,50,50,.8)", coreEnd: "rgba(255,0,0,0)",
             hold: "rgba(255,130,130,.7)" },
    green: { glow0: "rgba(61,220,132,.8)", glowMid: "rgba(35,200,110,.28)", glowEnd: "rgba(30,180,90,0)",
             coreMid: "#7dffb0", coreMidPanic: "#baffd2", core72: "rgba(61,220,132,.8)", coreEnd: "rgba(30,180,90,0)",
             hold: "rgba(120,255,170,.7)" }
  };
  D.laser = (ctx, p, t) => {
    ctx.save();   // 本函数会用 *= 改 globalAlpha（preTele 闪烁），save/restore 防止泄漏给调用方
    const panic = G.session.combo >= 5;
    // 瞬移预警：原地高频闪烁（0.3s 内明暗交替），给猫"要消失"的预判信号
    if (p.state === "preTele") ctx.globalAlpha *= 0.35 + 0.65 * Math.abs(Math.sin(t * 26));
    const hold = p.state === "hold";
    const pulse = 0.85 + 0.33 * (0.5 + 0.5 * Math.sin(t * (hold ? 7 : 13)));
    let r = (p.sc || 1) * 13 * pulse;
    if (panic) r *= 0.9 + 0.2 * Math.sin(t * 40);
    const skin = (p.laserVar && LASER_SKIN[p.laserVar.key]) || LASER_SKIN.red;
    // 柔光晕（原版 .5 → 提亮至 .8，半径 2.4 → 3）
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3);
    glow.addColorStop(0, skin.glow0);
    glow.addColorStop(0.5, skin.glowMid);
    glow.addColorStop(1, skin.glowEnd);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, r * 3, 0, Math.PI * 2); ctx.fill();
    // 核心光点（白热区扩大：0.32 → 0.5，中段提亮至 .8）
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.5, panic ? skin.coreMidPanic : skin.coreMid);
    core.addColorStop(0.72, skin.core72);
    core.addColorStop(0.88, skin.coreEnd);
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // 停留外圈：主要命中窗口的视觉暗示（原版 .4 → .7）
    if (hold) {
      ctx.strokeStyle = skin.hold;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.7 + Math.sin(t * 7) * 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------- 暗夜荧光：发光小虫（俯视爬行：六足步态 + 鞘翅背线 + 荧光尾灯，头朝爬行方向） ---------- */
  D.poolLight = (ctx, p, t) => {
    const panic = G.session && G.session.combo >= 5;
    const moving = p.state === "crawl";
    const sc = p.sc || 1;
    const ph = p.ph || 0;
    const R = 33 * sc;                                  // 视觉半径（命中盒 66）
    // 朝向：平滑跟随爬行方向（停驻换向也柔和过渡）
    if (p.crawlAng != null) {
      if (p._headAng == null) p._headAng = p.crawlAng;
      else {
        let d = p.crawlAng - p._headAng;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        p._headAng += d * 0.18;
      }
    }
    const head = p._headAng == null ? 0 : p._headAng;
    // 步足摆动相位：爬行时快、停驻时慢颤
    const gait = t * (moving ? 9 : 0.9) + ph * 4;
    const gaitAmp = moving ? 0.6 : 0.15;
    const jitter = panic ? 1.2 * Math.sin(t * 40) : 0;
    ctx.save();
    ctx.translate(jitter, jitter * 0.6);
    ctx.rotate(head + Math.sin(t * 2.1 + ph) * 0.04);   // 轻微起伏
    // 1) 外发光（黄绿，大范围柔和）——暗底上的"发光"感来源；连击时光晕增大增亮（只加光效不加速度）
    const comboK = 1 + Math.min(G.session.combo || 0, 10) * 0.06;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.35 * comboK);
    glow.addColorStop(0, moving ? "rgba(220,255,120,.56)" : "rgba(236,255,150,.68)");
    glow.addColorStop(0.42, "rgba(178,240,92,.24)");
    glow.addColorStop(1, "rgba(150,230,70,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, R * 2.35 * comboK, 0, Math.PI * 2); ctx.fill();
    // 2) 六足（俯视步足：三对 tripod 交替摆动，足尖小点；停驻时只微颤）
    const legPairs = [
      { x: R * 0.42, sweep: R * 0.30 },    // 前足（朝前张）
      { x: R * 0.16, sweep: 0 },           // 中足（横张）
      { x: -R * 0.10, sweep: -R * 0.26 }   // 后足（朝后张）
    ];
    ctx.strokeStyle = "#8a5a18";
    ctx.fillStyle = "#8a5a18";
    ctx.lineWidth = Math.max(1.2, R * 0.075); ctx.lineCap = "round";
    for (let s = 1; s >= -1; s -= 2) {
      legPairs.forEach((lp, i) => {
        const swing = Math.sin(gait + ((i + (s > 0 ? 0 : 1)) % 2) * Math.PI) * R * 0.24 * gaitAmp;
        const sx0 = lp.x, sy0 = s * R * 0.22;
        const fx0 = sx0 + lp.sweep + swing, fy0 = s * (R * 0.24 + R * 0.72);
        const kx = (sx0 + fx0) / 2 + s * R * 0.10, ky = (sy0 + fy0) / 2;
        ctx.beginPath(); ctx.moveTo(sx0, sy0);
        ctx.quadraticCurveTo(kx, ky, fx0, fy0);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(fx0, fy0, R * 0.045, 0, Math.PI * 2); ctx.fill();
      });
    }
    // 3) 腹部鞘翅（俯视：两片壳合拢 + 背中线 + 两道横纹）
    const bg = ctx.createLinearGradient(-R * 0.9, 0, R * 0.6, 0);
    bg.addColorStop(0, "#ffe97a");
    bg.addColorStop(0.45, "#ffb81c");
    bg.addColorStop(1, "#f79e12");
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(-R * 0.16, 0, R * 0.74, R * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(150,80,10,.42)"; ctx.lineWidth = Math.max(1, R * 0.05); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(R * 0.50, 0); ctx.lineTo(-R * 0.78, 0); ctx.stroke();   // 背中线（鞘翅合缝）
    [-R * 0.42, -R * 0.08].forEach(sx0 => {                                             // 横纹
      ctx.beginPath(); ctx.moveTo(sx0, -R * 0.28);
      ctx.quadraticCurveTo(sx0 - R * 0.07, 0, sx0, R * 0.28);
      ctx.stroke();
    });
    // 4) 膜翅（半透明小翅收拢在背上，持续快频煽动——暗夜荧光爬行时也会颤翅）
    const wingPath = (L, Wd) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(Wd, L * 0.22, Wd * 0.8, L * 0.8, 0, L);
      ctx.bezierCurveTo(-Wd * 0.8, L * 0.8, -Wd, L * 0.22, 0, 0);
      ctx.closePath();
    };
    const flutter = Math.sin(t * 24 + ph * 6) * 0.38;
    for (let s = 1; s >= -1; s -= 2) {
      ctx.save();
      ctx.translate(R * 0.30, s * R * 0.14);
      ctx.rotate(s * (0.96 + flutter));
      ctx.scale(1, s);                      // 沿身体轴镜像：两片翅膀分列身体两侧、都朝后掠
      const wg = ctx.createLinearGradient(0, 0, 0, R * 0.9);
      wg.addColorStop(0, "rgba(215,250,255,.48)");
      wg.addColorStop(1, "rgba(130,232,246,.08)");
      ctx.fillStyle = wg;
      wingPath(R * 0.88, R * 0.32); ctx.fill();
      ctx.strokeStyle = "rgba(235,255,255,.38)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    // 5) 腹尾亮灯（呼吸脉动的"荧光"）：亮核 + 柔光
    const lampP = 0.72 + 0.28 * Math.sin(t * 5 + ph * 3);
    const lamp = ctx.createRadialGradient(-R * 0.86, 0, 0, -R * 0.86, 0, R * 0.5);
    lamp.addColorStop(0, "rgba(255,255,235," + (0.35 + 0.6 * lampP).toFixed(2) + ")");
    lamp.addColorStop(0.4, "rgba(240,255,150," + (0.5 * lampP).toFixed(2) + ")");
    lamp.addColorStop(1, "rgba(230,255,120,0)");
    ctx.fillStyle = lamp;
    ctx.beginPath(); ctx.arc(-R * 0.86, 0, R * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fffbe0";
    ctx.beginPath(); ctx.arc(-R * 0.86, 0, R * 0.16, 0, Math.PI * 2); ctx.fill();
    // 6) 前胸盾板 + 头（俯视：盾板带中线，头在前进方向）
    ctx.fillStyle = "#f7a41b";
    ctx.beginPath(); ctx.ellipse(R * 0.38, 0, R * 0.34, R * 0.30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(150,80,10,.28)"; ctx.lineWidth = Math.max(1, R * 0.045);
    ctx.beginPath(); ctx.moveTo(R * 0.12, 0); ctx.lineTo(R * 0.64, 0); ctx.stroke();
    ctx.fillStyle = "#ffd45e";
    ctx.beginPath(); ctx.arc(R * 0.72, 0, R * 0.23, 0, Math.PI * 2); ctx.fill();
    // 7) 大眼睛（俯视：头两侧鼓出的萌系大眼 + 白高光）
    ctx.fillStyle = "#22335f";
    ctx.beginPath(); ctx.arc(R * 0.74, -R * 0.17, R * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.74, R * 0.17, R * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.beginPath(); ctx.arc(R * 0.78, -R * 0.21, R * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.78, R * 0.13, R * 0.045, 0, Math.PI * 2); ctx.fill();
    // 8) 触角：向前外弯的两根细须 + 顶端小圆点（停驻时轻轻摆动探头）
    const aw = Math.sin(t * 3.2 + ph * 2) * (moving ? 0.06 : 0.16);
    ctx.strokeStyle = "rgba(96,74,22,.75)";
    ctx.lineWidth = Math.max(1, R * 0.045); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(R * 0.84, -R * 0.06);
    ctx.quadraticCurveTo(R * (1.12 + aw), -R * 0.26, R * (1.26 + aw), -R * 0.10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R * 0.84, R * 0.06);
    ctx.quadraticCurveTo(R * (1.12 - aw), R * 0.26, R * (1.26 - aw), R * 0.10); ctx.stroke();
    ctx.fillStyle = "rgba(96,74,22,.75)";
    ctx.beginPath(); ctx.arc(R * (1.26 + aw), -R * 0.10, R * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(R * (1.26 - aw), R * 0.10, R * 0.05, 0, Math.PI * 2); ctx.fill();
    // 9) 高光点（胸部受光）
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.beginPath(); ctx.ellipse(R * 0.34, -R * 0.10, R * 0.10, R * 0.16, -0.3, 0, Math.PI * 2); ctx.fill();
    // 10) 停驻外圈：主要命中窗口的视觉暗示
    if (p.state === "pause") {
      ctx.strokeStyle = "rgba(232,255,160,.85)";
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.55 + Math.sin(t * 8) * 3.5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------- vseq：视频提取的 3 段新动画（快跑 fast / 东张西望 look / 坐下 sit） ----------
     只存"基准灰鼠" sprite sheet，运行时按花色亮度 LUT 着色成离屏画布（懒加载+节流缓存）。
     6 花色离线表会超包体预算（~5.9MB），故采用"1 张基准表 × 运行时 LUT 着色"，
     新表仅 1.1MB；着色画布取 base 的 0.5× 分辨率、按需生成，单张构建 ~5-20ms。
     统一物理尺寸：各段按 run 帧单独校准 viewScale（见 _vseqScaleFor），脚线对齐 VSEQ_FEET_Y，
     保证 dart(快跑)/scurry(慢跑)/peek(东张西望)/pause(坐下) 切换时鼠身不跳变。 */
  const VSEQ_META = {
    // mouseW = 实测帧内鼠身宽（px）：fast 320 / look 220 / sit 220。
    // look/sit 帧内鼠身 ≈0.49× 原视频尺度（非 fast 的 0.7×），故三段比例必须分开校准。
    fast: { frames: 10, cellW: 338.8, cellH: 127, ground: 0.9449, file: "fast_sheet.png", mouseW: 320 },
    look: { frames: 14, cellW: 234.5, cellH: 144, ground: 0.9514, file: "look_sheet.png", mouseW: 220 },
    sit:  { frames: 10, cellW: 235.2, cellH: 144, ground: 0.9514, file: "sit_sheet.png",  mouseW: 220 },
  };
  const VSEQ_KEYS = ["house", "charcoal", "albino", "deer", "pup", "smoky"];
  const VSEQ_BASE = 495;          // 源 run 帧宽（原视频尺度 1.0×）
  const VSEQ_RUN_W = 448;         // 实测 495px run 帧内鼠身宽（原视频尺度）
  const VSEQ_CANVAS_SCALE = 0.5;  // 着色离屏画布相对 base sheet 的分辨率（省内存、提速）
  const VSEQ_FEET_Y = 62;         // 设计空间脚线（对齐 run 帧脚线）
  const VSEQ_BUILD_MS = 30;       // 着色构建节流：每 ~30ms 最多建 1 张 (段,花色) 画布，摊平启动开销
  /* 分段 viewScale 校准：各 sheet 帧内鼠身尺度不同（实测 mouseW：fast 320 / look 220 / sit 220，
     look/sit 帧 ≈0.49× 原视频尺度、非 fast 的 0.7×）。若全段共用一个比例，
     peek/pause 鼠会比 dart/hole 鼠物理小 ~30%；故各段单独按 run 帧校准，
     使屏上鼠身宽 = (448/495)×dw，与 run 帧完全一致。
     这样 dart(快跑)/scurry(慢跑)/peek(东张西望)/pause(坐下) 切换时鼠身不跳变。 */
  const _vseqScaleFor = (seg, dw) => ((VSEQ_RUN_W / VSEQ_BASE) * dw) / VSEQ_META[seg].mouseW;
  // 侧视快跑 ≈0.3054×1.30≈0.397：fast sheet 的奔跑姿态矮平（实测鼠身 320×105，
  // 渲染后 ≈97.7×32.1），与 look sheet 探头鼠（≈97.7×55.5）比视觉体量仅 ~58%。
  // 放大 1.30 后 dart 鼠 ≈127×41.7，与 peek 鼠（97.7×55.5）等体量（面积 ≈98%），
  // 满足"漏出的老鼠和移动的老鼠一样大"。加宽后的裁剪窗（def.w 132）可完整容纳。
  const VSEQ_DRAW_SCALE_FAST = _vseqScaleFor("fast", 108) * 1.30;
  const VSEQ_DRAW_SCALE_LOOK = _vseqScaleFor("look", 108);   // 侧视东张西望 ≈0.4443
  const VSEQ_DRAW_SCALE_TOP = _vseqScaleFor("sit", 104);     // 俯视坐下 ≈0.4289
  // 6 花色 × 3 通道 × 256 亮度 LUT（base64 打包，4608 字节）；中点(120)与现有 run 花色逐一对应
  const VSEQ_LUT_B64 =
  "AAIEBQYICAoKCwwODhAREhITFRYWFxkaGxwdHiAgIyIkJiclKCkqKy4sLjAyMTQ2Nzg7QERDSktLS0tLS0xNTk9QUVNUVldYWVpbXV5gYWFjZGZmaGlqa21u" +
  "b3Fyc3V2d3l6e3x9fn+AgoSFhoeIiYuMjY6QkZKUlpeYmZucnZ+goKGhoqSlp6enqaqsrK6urq+xs7O1s7S2tbW3ury9wb/CwcPDxMTFxsfHx8zRys/T0NHR" +
  "0dfR3NHS0tbY3drY4Nfh3+Hh39zf4uDm4efp6+3v8fPw7ern8fPh7vz/7OHu+/z8/f7+///////////8+fbz8O3q5+Th4eHh4eHh4QABAQIDBAUGBwgJCgsM" +
  "DQ4PEBESExUWFhcYGRobHRweHyAhIyQkJykpKSssLi8wMTQ1ODs+PkFCQkJCQkJDQ0RFRkdJSktNTU5PUFJSVFVVV1hZWltcXV5gYWJjZGVmZ2lqa2xtbm9w" +
  "cXJ0dXZ2eHl6e3x8fn6AgoSFhoeIiYqLjIyMi42PkJGRkJOTlpWXlpWWmZyanJiXl5WUl5ufn6alpaenpqinqqmpq6uxt7C1uba2t7i8tr6zubm9t72/u7y+" +
  "xsTGxsTCwcHDv8bAwcLCw8PExcbIycfNxsrNzMzGzdTW19jZ2tzd3uDh4uTl4t/c2dbSz8zJxsbGxsbGxsYAAQEBAgMEBQUGBwkKCgsMDQ4PDxESERIUFRUV" +
  "FxcZGxwcHR0gISIkJCUmJyopLC4uMTAzNTY4ODg4ODg4OTk6Ozw8Pj9AQUFCQ0RFRkdISEpLTExNTk9QUlJTVFVWV1hZWltbXF1eX2BhYmNkZWZmaGlpa2tt" +
  "bm9wcXJzdHR1d3d4eXp7fH19f4CBgoKEhIaGiIiJiouLjYyMi46RkpSUlZaXmJmam5ydoJ+ioaKlpaSoqKmpqq2qr66wr7KurrSwtKirqKivtri5tsCoyMnL" +
  "zM3P0MvHwr7F1qjA2djBqMPe3+Dg4ePm6Orr7O7t7Obf2NHKw722r6ioqKioqKioAAIEBQYICAoKCwwODhAREhITFRYWFxkaGxwdHiAgIyIkJiclJykpKSsr" +
  "LC0tLjAwLzAvLSssKCcnJycnJycoKCkpKisrLC0tLi4vMDAxMjIzNDU1NjY3Nzk5Ojo7PDw9Pj8/QEBBQUNCRERFRkhHSElLS09NUVJPT09RUVJSUlNTWl5i" +
  "YmFhYWduaWxmbmxzeXtzcXl4iY6SnaagmI6PgIeHiY2Uk5qWnZ+go5SGopWLmJyhoJWtkL2rrqC4n5u0qrN1g3V1jqautqrRdefp6+3v8fPi0sKxzfN1uPz/" +
  "tnW4+/z8/f7+///////////x49bIuqyekYN1dXV1dXV1dQABAQIDBAUGBwgJCgsMDQ4PEBESExUWFhcYGRobHRweHyAhIyMkJScnKSoqKywsLS4uLiwqKyYl" +
  "JSUlJSUlJiYnJygpKSorKyssLS4uLy8wMDEyMjMzNDU2Njc3ODg5Ojo7PDw9PT4/P0BBQUJDQ0RFRkdKSEtMSktLTExNTU1OT1NWWFlZWVldYl9hXWJhZmts" +
  "aGZra3Z4e4KIhH96e3F3dnl8gYGFhImJi46Ee4+Gf4qMkJCHmYKjmpyRnYuNnpChb3pvb4OWmp6Yrm/AwcLCw8PEurGnnqrNb57NzKBvotTW19jZ2tzd3uDh" +
  "4uTl2c3Ctqqekod7b29vb29vb28AAQEBAgMEBQUGBwkKCgsMDQ4PDxESERIUFRUVFxcZGxwcHR0fISIiIyQlJicnKisqLCkoJikkIyMjIyMjIyQkJCUmJico" +
  "KCkpKiorKywtLS4uLy8wMTEyMzM0NDU1Njc3ODg5OTo7PDw9PT4/QD9AQUNDRkVISEdHR0hJSUlKSktPUlVWVVVVWV5bXllfXWRnamRiZ2hydnd+g4B9eHlu" +
  "dHR2eX5+goCGiIiNgXaNg3qIiIyMhJh+pJebkJ+KiZ+Rn2l1aWmAl5ugl7RpyMnLzM3P0MS3qp6w1mmh2diiaaTe3+Dg4ePm6Orr7O7t7N/SxbirnpCDdmlp" +
  "aWlpaWlpAAIEBQYICAoKCwwODhAREhITFRYWFxkaGxwdHiAhIyIkJiclKSosLjEtMDM2NTg8P0FJVWFecXR0dHR0dXZ3eHp8foCChYeIiYuNkJGUlZaZm56e" +
  "oaKkpqqrrK+xsrS2uLu8vsDCw8THyMzNz9DT1NbX2Nbb2dvk5unp7O7w8/X28e7p6u7w8erh6efw5+rj3Nrl6eLj09HQxr/H0NnZ6OHk4eDb3Nnb2NjY1uLt" +
  "2OPs4uLf4Orb8dbd3OXh7uvi7+H/+f//9ezt7u7s/+fp6+3v8fP09PX2+/P//vz/+//9+/z8/f7+/////////////////////////////////wABAQIDBAUG" +
  "BwgJCgsMDQ4PEBESExUWFhcYGRobHRweHyAhIyUlKCwtKi4wNDM1OT4/SFRfXG5xcXFxcXJzdHV3eXp9f4GDhIaHioyNkJKSlZeZmp2eoKGlpqiqrK6wsbO2" +
  "t7m7vb6+wcLHyMnJzs7Q0NHO1NHU3eDj4uXn6u3v7+jk3uDm6ezk2OPf69/k2dHO3eLY2sK9uqyhrLnHx97V1tTSyszHzMXFxsPV5sjX5NbV0dPfyea9zszZ" +
  "yN7hztjR//X//+/e29jgy//AwcLCw8PEzNXd5trN/+bNzOj/6tTW19jZ2tzd3uDh4uTl6Ort7/L19/r8//////////8AAQEBAgMEBQUGBwkKCgsMDQ4PDxES" +
  "ERIUFRUVFxgZGxwcHR0hIiUnKSUpKzAuMzc5PUJPWllqbW1tbW1ub29xc3V2eHp9foCBg4WIiIuNjZCSlJSXmJqcn6CipKanqautsLGytLa4t7q8wMHCwsbH" +
  "ycnKx83KzNbY29rd3+Lk5ufg3djZ3+Lk3tTg3ere49rRz9zi2NnBvbmqnam5x8je1dfU0srNxsvFxsXE1ebI1+PX1NHS4Mrnv87N2szf4dHc0f/2///w4t/c" +
  "4tL/yMnLzM3P0Nbc4+ni1v/s2djs/+7e3+Dg4ePm6Orr7O7t7O7w8vT2+Pn7/f//////////AAIEBQYICAoKCwwODhAREhITFRYWFxkaGxwdHiAgIyIkJicl" +
  "KCkqKy8sLjAyMjU3ODo+REpJUVNTU1NTU1RVVldZWlxdX2BhYmNlZ2hqa2ttb3Fxc3R1dnl6e31+f4GChIaGiImKjI2OkJKTlJWXmJqbnJyen6Ckpqeoqqus" +
  "rrCwsLCvsLO1trW0t7i8ur27urq+wsDCvL2+uri8wcbHz8zPzs/Nzs3Qz9DQz9jh09zj3N3c3ObZ7NXb2uLf6ujg7N/59Pn58ejq6+zr+efp6+3v8fPz8/Pz" +
  "+fP5+vz/+Pn6+/z8/f7+///////////+/v39/Pv7+vr5+fn5+fn5+QABAQIDBAUGBwgJCgsMDQ4PEBESExUWFhcYGRobHRweHyAhIyQkJykpKSstLy8wMjQ1" +
  "OT1AP0RFRUVFRUVGR0dISkpMTU9QUVFSVFZWWFlZW1xeXl9gYmJlZWZoaWprbG1vcHFyc3R1dnd5ent7fX6AgIGBg4SFiIqLjI2Oj5CSkpKSkZKUlZeWlZiY" +
  "nJqcm5qanqGfoZubmpeVmZ2io6uqqqusqqyrrq2trq62vbO6v7u7u7zCucW0vbzBusLFvsDBz8zPz8vGxcTIwc/AwcLCw8PExsnLzsrNz87NzNDP0tTW19jZ" +
  "2tzd3uDh4uTl4+He3NrY1tPRz8/Pz8/Pz88AAQEBAgMEBQUGBwkKCgsMDQ4PDxESERIUFRUVFxcZGxwcHR0fISIjJCUmJykpLC4uMC8xMjQ0NDQ0NDQ0NTU2" +
  "Nzc4OTo7PD09Pj9AQUJDQ0RFRkZISElKTExNTk9QUVFSVFRVVlZXWFlaW1xdXl5fYWFiZGRmZ2hoaWprbGxtbm9xcnN0dXZ2eHl6e3t9fX+AgoGCg4SGiYiJ" +
  "iouNjY+Mj4+RkpSVlpeZm5uem5qgnpyioqOko6mhraqsqa6np7CqsJyhnJymsLK0sL6cyMnLzM3P0MrEvrjB1py62di7nL3e3+Dg4ePm6Orr7O7t7OTc1MzE" +
  "vLSspJycnJycnJycAAIEBQYICAoKCwwODhAREhITFRYWFxkaGxwdHiAhIyIkJiclKCkrLDAsLzE0MzY5OjxBSlJQXF5eXl5eXmBgYWNkZmhpa21ub3FydXZ4" +
  "eXp8foCAgoOFhomKjI6PkJKTlZeYmpudnp+hoqWmqKmrrK6vsK+zsrS5u72+v8HDxcfIxcTDxMfJzMnFy8vRzdHNysrR1tLVycnJwbzDzNTU493h39/a3Nnb" +
  "2NjY1uLt2OPs4uLf4Orb8dbd3OXh7uvi7+H/+f//9ezt7u7s/+fp6+3v8fP09PX2+/P//vz/+//9+/z8/f7+/////////////////////////////////wAB" +
  "AQIDBAUGBwgJCgsMDQ4PEBESExUWFhcYGRobHRweHyAhIyQlKCorKS0uMTEzNTk6QEhQTllbW1tbW1xdXV5gYmNlZmhqa2xtb3FydHV2eHp7e35/gYKFhoeJ" +
  "i4yNj5GTlJWWmJmZnJ2goaKipaaoqKmnrKqss7W3t7m7vb/Awb27uLm9v8K9t8C+x8DFv7q5xMnDxrWysKaep7K+v9PMzs7NxsnEy8XFxcPV5sjX5NbV0dPf" +
  "yea9zszZyN7hztjR//X//+/e29jgy//AwcLCw8PEzNXd5trN/+bNzOj/6tTW19jZ2tzd3uDh4uTl6Ort7/L19/r8//////////8AAQEBAgMEBQUGBwkKCgsM" +
  "DQ4PDxESERIUFRUVFxgZGxwcHR0gISQmJyUoKi0sMDM1ODtDS0pVV1dXV1dXWFlaXF1eYGJkZWZnaGpsbW9wcXN0dnZ4eXt8f4CBg4SFh4iKjI2OkJGSk5WW" +
  "mZqbnJ6foaGioaWjpautr6+xsrW2uLm1s7Gytri6t7G5t7+5vbm0tL3CvL+vrquhmKGuubvMxsjHx8HEv8XAwsLB0ePH1uLX1NHS4Mrnv87N2szf4dHc0f/2" +
  "///w4t/c4tL/yMnLzM3P0Nbc4+ni1v/s2djs/+7e3+Dg4ePm6Orr7O7t7O7w8vT2+Pn7/f//////////AAIEBQYICAoKCwwODhAREhITFRYWFxkaGxwdHiAg" +
  "IyIkJiclKCkpKi0sLS4vMDEyMjM0NTY2NjY2NjY2Njc3ODk6Ojs8Pj4/QEBCQ0NFRUZHSElJS0tMTU9PUFFSU1RVVVdYWFlaW1xcXl9fYWNiY2RmZ2lpbG1s" +
  "bW1vb3BxcXNzd3p8fX1+foGFhIaDiIeMj5GNjZGSm56hp6yqpqGim5+goKOop6uqrq+wsqulsq2psLK1tLG8sMW7vrfFubXDwMKiqaKisL3DyMDaoufp6+3v" +
  "8fPo3dLI3POiz/z/zKLO+/z8/f7+///////////27OPa0Me+tauioqKioqKiogABAQIDBAUGBwgJCgsMDQ4PEBESExUWFhcYGRobHRweHyAhIyQkJigoKSor" +
  "LS4uLzExMzQ0NDQ0NDQ0NDQ1NTY3Nzg5Ojs8PT0+P0BBQkNDREVGRkhISUpMTE1OT1BRUVJUVFVWVldYWVpbXF1eXl9gYWJkZGZnZ2hpamtsbG1ub3Fyc3R0" +
  "dXZ4eXp7enx9f4GCgYKDhIiIioyOjo2NjoyPj5GSlJWXmJqanJ2cmqCenaGipKWiqKGrqquoq6WnraewnKCcnKStrrCut5zAwcLCw8PEwLy4tLnNnLTNzLec" +
  "uNTW19jZ2tzd3uDh4uTl3tbPyMC5squjnJycnJycnJwAAQEBAgMEBQUGBwkKCgsMDQ4PDxESERIUFRUVFxcZGxwcHR0gISMkJSUmKCoqLS8wMjI2OTo+Pj4+" +
  "Pj4+Pz9AQUJDREVHSEhJSktNTU9QUFFTVFRWVlhYWltcXV5fYGFiZGRlZmdoaWprbW1vcHFxc3R0dXZ3eHt8fX5/gIGCg4SEhYWGh4iJiomMjI6Oj5CPkJKU" +
  "k5WSk5KQjpGWmpuen5+goaGioqSkpqaoq6+rrrCxsLGytbO2s7W2uLe4uLq5urq7urq9wMDAwMS6yMnLzM3P0M7LycbL1rrK2djKusze3+Dg4ePm6Orr7O7t" +
  "7Ofi3djTzsnEv7q6urq6urq6";
  const _b64Decode = (s) => {
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const M = {}; for (let i = 0; i < 64; i++) M[A.charAt(i)] = i;
    const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
    const out = new Uint8Array((clean.length * 3) >> 2);
    let j = 0;
    for (let i = 0; i + 3 < clean.length; i += 4) {
      const n = (M[clean.charAt(i)] << 18) | (M[clean.charAt(i + 1)] << 12) | (M[clean.charAt(i + 2)] << 6) | M[clean.charAt(i + 3)];
      out[j++] = (n >> 16) & 255; out[j++] = (n >> 8) & 255; out[j++] = n & 255;
    }
    return out;
  };
  let _VSEQ_LUT = null;
  const _vseqLut = () => (_VSEQ_LUT || (_VSEQ_LUT = _b64Decode(VSEQ_LUT_B64)));

  /* ---------- 小鼠 HD 贴图（AI 素材 6 花色着色版：俯视 / 侧视） ----------
     素材提供逼真外形、毛发纹理与表情；程序化叠加发光眼、柔光与状态驱动形变。
     贴图未加载时自动回退原有矢量绘制，保证零闪烁降级。 */
  const MICEHD = { tried: false, top: {}, side: {}, back: {}, parts: {}, real: {}, video: {}, vseq: {} };
  D.initMiceHD = () => {
    if (MICEHD.tried) return;
    MICEHD.tried = true;
    const keys = ["house", "charcoal", "albino", "deer", "pup", "smoky"];
    const sub = (typeof location !== "undefined" && location.protocol === "file:" &&
                 /\/test\/[^/]*$/.test(decodeURIComponent(location.pathname))) ? "../" : "";
    const load = (name, k, slot) => {
      try {
        const img = (typeof wx !== "undefined" && wx.createImage) ? wx.createImage() : new Image();
        img.ok = false;
        img.onload = () => { img.ok = true; };
        img.onerror = () => { img.ok = false; };
        img.src = sub + "assets/mice/" + name + "-" + k + ".png";
        slot[k] = img;
      } catch (e) { slot[k] = null; }
    };
    const PART_KEYS = ["earL", "earR", "legL", "legR", "tail"];
    const DIRS = [0, 45, 90, 135, 180, 225, 270, 315];
    keys.forEach(k => {
      ["top", "side"].forEach(view => load(view, k, MICEHD[view]));
      load("back-body", k, MICEHD.back);   // 抹除静态耳爪的干净背面身体
      // 独立可动部件（6 花色着色，绕 pivot 旋转）
      PART_KEYS.forEach(part => {
        if (!MICEHD.parts[part]) MICEHD.parts[part] = {};
        load("top-" + part, k, MICEHD.parts[part]);
      });
      // 写实 8 朝向贴图（真实光影+毛发，按朝向角选择）
      DIRS.forEach(d => {
        if (!MICEHD.real[d]) MICEHD.real[d] = {};
        load("real/dir" + d, k, MICEHD.real[d]);
      });
      // 视频提取的卡通鼠奔跑序列（16 帧 × 6 花色）
      MICEHD.video[k] = [];
      for (let i = 0; i < 16; i++) {
        try {
          const img = (typeof wx !== "undefined" && wx.createImage) ? wx.createImage() : new Image();
          img.ok = false;
          img.onload = () => { img.ok = true; };
          img.onerror = () => { img.ok = false; };
          img.src = sub + "assets/mice/video/run-" + k + "_" + (i < 10 ? "0" : "") + i + ".png";
          MICEHD.video[k].push(img);
        } catch (e) { MICEHD.video[k].push(null); }
      }
    });
    // vseq 3 段新动画的"基准灰鼠" sheet（运行时按花色 LUT 着色成离屏画布）
    Object.keys(VSEQ_META).forEach(seg => {
      MICEHD.vseq[seg] = { base: null, canv: {} };
      try {
        const img = (typeof wx !== "undefined" && wx.createImage) ? wx.createImage() : new Image();
        img.ok = false;
        img.onload = () => { img.ok = true; };
        img.onerror = () => { img.ok = false; };
        img.src = sub + "assets/mice/video/" + VSEQ_META[seg].file;
        MICEHD.vseq[seg].base = img;
      } catch (e) { MICEHD.vseq[seg].base = null; }
    });
  };
  D.MICEHD = MICEHD;   // 测试钩子

  /* ===== vseq 运行时着色：base 灰鼠 sheet → 按花色亮度 LUT 着色成 0.5× 离屏画布（缓存） =====
     _vseqEnsure(seg, color, t)：返回该 (段,花色) 的彩色画布；未就绪时（节流窗口内）返回 null，
     调用方据此回退到既有 run 帧/矢量渲染，避免构建期卡顿。每帧最多构建 1 张，摊平启动开销。 */
  let _vseqLastBuild = -1e9;
  const _mkOffCanvas = (w, h) => {
    // 与代码库一致：wx.createCanvas()（首调已取上屏画布，后续返回离屏画布）
    if (typeof wx !== "undefined" && wx.createCanvas) {
      try { const cv = wx.createCanvas(); cv.width = w; cv.height = h; return cv; } catch (e) {}
    }
    const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
  };
  const _vseqRecolor = (baseImg, color) => {
    const s = VSEQ_CANVAS_SCALE;
    const w = Math.max(1, Math.round(baseImg.width * s));
    const h = Math.max(1, Math.round(baseImg.height * s));
    const cv = _mkOffCanvas(w, h);
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(baseImg, 0, 0, w, h);
    let id;
    try {
      id = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      /* Chromium 的 file:// 页（本地开发者工具预览）会把本地图片一律 taint 画布，
         getImageData 直接抛 SecurityError——沿渲染主循环上抛会杀死 RAF 循环（表现为
         「点开始游戏后页面卡死」）。此处吞掉：返回未着色的灰鼠画布，视觉与
         onBase 回退一致，游戏照常运行。真机 wx.createImage 不受此限。 */
      return cv;
    }
    const d = id.data;
    const ci = VSEQ_KEYS.indexOf(color);
    if (ci >= 0) {
      const lut = _vseqLut();
      const base = ci * 3 * 256;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0) {
          const lm = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
          d[i]     = lut[base + lm];
          d[i + 1] = lut[base + 256 + lm];
          d[i + 2] = lut[base + 512 + lm];
        }
      }
      ctx.putImageData(id, 0, 0);
    }
    return cv;
  };
  const _vseqEnsure = (seg, color, t) => {
    const vq = MICEHD.vseq[seg];
    if (!vq || !vq.base || !vq.base.ok) return null;
    if (vq.canv[color]) return vq.canv[color];
    if (vq.tainted) return null;   // 该段已被 taint 熔断：恒走 onBase 灰鼠回退，不再每帧重试 getImageData
    if (t * 1000 - _vseqLastBuild < VSEQ_BUILD_MS) return null;   // 节流：调用方本帧先画 base 灰表（见 _vseqFrame）
    _vseqLastBuild = t * 1000;
    try {
      const cv = _vseqRecolor(vq.base, color);
      vq.canv[color] = cv;
      return cv;
    } catch (e) {
      vq.tainted = true;   // 熔断（防 30ms 节流窗口内反复抛错 + 构建抖动）
      return null;
    }
  };
  /* ===== vseq 预热队列：根治"探头彩色→冲刺中途变灰鼠" =====
     花色着色画布原先完全懒加载：某 (段,花色) 首次被绘制时才构建，叠加 30ms 节流，
     首现的那一两只鼠会走 onBase 灰鼠回退——同一只鼠探头时彩色、一冲刺变灰，
     即"移动中途换颜色"。
     做法：base sheet 加载完成后，借每次绘制调用为时钟，按同一 30ms 节流把
     6 花色 × (fast, look, sit) 共 18 张画布逐张预热建好；队列每次清空后重建，
     全部建完自动停（每帧仅剩 ~18 次属性检查，开销可忽略）。
     内存 ≈ 18 张 0.5× 画布 ≈ 8MB。sit 是群鼠 pause 停驻用的段——必须预热，
     否则群鼠首只停驻鼠要等懒加载，灰鼠回退 + 30ms 节流窗口更容易撞上。 */
  let _vseqPreWarmQ = null;
  const _vseqPreWarmTick = (t) => {
    if (!_vseqPreWarmQ) {
      const q = [];
      const segs = ["fast", "look", "sit"];
      for (let si = 0; si < segs.length; si++) {
        const vq = MICEHD.vseq[segs[si]];
        if (vq && vq.base && vq.base.ok && !vq.tainted)
          for (let i = 0; i < VSEQ_KEYS.length; i++) if (!vq.canv[VSEQ_KEYS[i]]) q.push([segs[si], VSEQ_KEYS[i]]);
      }
      if (!q.length) return;
      _vseqPreWarmQ = q;
    }
    if (t * 1000 - _vseqLastBuild < VSEQ_BUILD_MS) return;
    const item = _vseqPreWarmQ.shift();
    const vq = MICEHD.vseq[item[0]];
    if (vq && vq.base && vq.base.ok && !vq.canv[item[1]]) {
      _vseqLastBuild = t * 1000;
      try {
        vq.canv[item[1]] = _vseqRecolor(vq.base, item[1]);
      } catch (e) {
        vq.tainted = true;   // taint 熔断：停止该段后续构建，其余段不受影响
      }
    }
    if (!_vseqPreWarmQ.length) _vseqPreWarmQ = null;
  };
  /* 取 (seg, 花色) 第 fi 帧的绘制参数；脚线对齐 VSEQ_FEET_Y、水平居中 x=60、按 viewScale 定尺寸。 */
  const _vseqFrame = (seg, color, fi, t, viewScale) => {
    _vseqPreWarmTick(t);   // 先走预热一拍（每 30ms 至多建 1 张），再取本帧 (seg,color)
    const vq = MICEHD.vseq[seg];
    if (!vq) return null;
    let cv = vq.canv[color], onBase = false;
    if (!cv) {
      cv = _vseqEnsure(seg, color, t);
      if (!cv) {
        /* 未就绪（节流窗口 / 着色中）：直接绘制基准灰鼠 sheet——
           同尺寸、同姿态，只是尚未按花色着色；避免回退 HD 贴图/矢量鼠
           导致开局尺寸+画风双跳变（"有些老鼠特别大"现象的根源）。
           仅当基准 sheet 本身尚未加载完成才返回 null 走旧回退。 */
        if (!vq.base || !vq.base.ok) return null;
        cv = vq.base; onBase = true;
      }
    }
    const meta = VSEQ_META[seg];
    const s = onBase ? 1 : VSEQ_CANVAS_SCALE;
    const n = meta.frames;
    const fi2 = ((fi % n) + n) % n;
    const sx = fi2 * meta.cellW * s;
    const srcW = meta.cellW * s, srcH = meta.cellH * s;
    const dstW = meta.cellW * viewScale, dstH = meta.cellH * viewScale;
    const groundYd = meta.ground * meta.cellH * viewScale;
    const topY = VSEQ_FEET_Y - groundYd;
    return { cv, sx, srcW, srcH, dstW, dstH, topY };
  };

  /* ===== 视频关键帧鼠·俯视群鼠版：侧视序列帧始终以侧面朝向玩家（不随朝向旋转，
       避免侧视图旋转成仰躺），仅按行进方向的水平分量决定左右镜像，配合轻微上下起伏。
       抵消外层 rotate(_visAng+π/2) 后绘制。 ===== */
  const _mouseVideoTop = (ctx, p, t, v) => {
    const vk = v.key;
    const vanish = p.vanishT > 0;
    // pause（停驻嗅探 = 命中窗口）→ sit vseq 坐下序列（替代原"冻结帧0死站"）；scurry → 既有奔跑序列
    if (p.state === "pause" && !vanish) {
      const fi = Math.floor((t * 5 + (p.phase || 0) * 0.5) % VSEQ_META.sit.frames);
      const info = _vseqFrame("sit", vk, fi, t, VSEQ_DRAW_SCALE_TOP);
      if (!info) return false;
      // 柔影（停驻更柔、更小）
      const sh0 = ctx.createRadialGradient(60, 66, 4, 60, 66, 38);
      sh0.addColorStop(0, "rgba(6,10,9,.34)");
      sh0.addColorStop(0.55, "rgba(6,10,9,.13)");
      sh0.addColorStop(1, "rgba(6,10,9,0)");
      ctx.fillStyle = sh0;
      ctx.beginPath(); ctx.ellipse(60, 66, 30, 22, 0, 0, Math.PI * 2); ctx.fill();
      // 抵消外层旋转，鼠始终侧面朝向玩家；最后朝向朝左则镜像（坐定不动，沿用末次航向）
      const outerRot0 = (p._visAng || 0) + Math.PI / 2;
      const faceLeft0 = Math.cos(p._visAng || 0) < 0;
      ctx.save();
      ctx.translate(60, 48);
      ctx.rotate(-outerRot0);
      if (!faceLeft0) ctx.scale(-1, 1);
      // sit 帧头朝左（同 run）。坐姿直立、帧比 run 高，不能整格居中于原点，
      // 改为脚线对齐俯视 run 脚线（≈63）：原点在 translate(60,48)，
      // 偏移 = 63 − 48 − groundYd = topY + 63 − 48 − 62 = topY − 47。
      ctx.drawImage(info.cv, info.sx, 0, info.srcW, info.srcH, -info.dstW / 2, info.topY - 47, info.dstW, info.dstH);
      ctx.restore();
      return true;
    }
    const frames = MICEHD.video[vk];
    if (!frames || !frames.length || !frames[0] || !frames[0].ok) return false;
    const running = p.state !== "pause" && !vanish;
    // 腿部步频由真实移动速度驱动（px/s，prey.js 每帧暴露 _moveSp）：鼠移得越快腿越频。
    // 注意 p.def.speed=125 是绝对 px/s 不是倍率——旧式 4.5+spd 会算出 ≈130fps（≈8 圈/秒频闪）。
    // 16 帧循环目标 ≈5-16fps：100px/s→6（圈 1.6s 悠闲）、250→10.5、400+→16（圈 1s 急促）。
    const realSp = p._moveSp || ((p.def && p.def.speed || 125) * (p.mSpeed || 1));
    const fps = running ? Math.min(16, Math.max(5, 3 + realSp * 0.03)) : 0;
    // 相位用 dt 积分累计（帧数）：速度/停驻切换时步频平滑过渡不跳帧；首现用 phase 播种错开群鼠同步。
    if (p._mvPhTop == null) p._mvPhTop = (p.phase || 0) * 0.5;
    if (p._mvLastTTop == null) p._mvLastTTop = t;
    const dt = Math.min(0.1, Math.max(0, t - p._mvLastTTop));
    p._mvLastTTop = t;
    p._mvPhTop += dt * fps;
    let fi = running ? Math.floor(p._mvPhTop) % frames.length : 0;
    const img = frames[fi];
    if (!img || !img.ok) return false;

    // 起伏与步频同相：|sin(0.4·帧相位)| 周期 ≈15.7 帧 ≈ 一个完整 16 帧循环，腿快起伏快
    const bob = running ? Math.abs(Math.sin(p._mvPhTop * 0.4)) * 1.4 : 0;
    // 柔影（在世界坐标下，抵消旋转前画更简单：仍在外层坐标系画椭圆即可）
    const sh = ctx.createRadialGradient(60, 66, 4, 60, 66, 38);
    sh.addColorStop(0, "rgba(6,10,9,.38)");
    sh.addColorStop(0.55, "rgba(6,10,9,.15)");
    sh.addColorStop(1, "rgba(6,10,9,0)");
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.ellipse(60, 66 + bob * 0.3, 30, 22, 0, 0, Math.PI * 2); ctx.fill();

    // 抵消外层旋转，让鼠始终侧面对着玩家
    const outerRot = (p._visAng || 0) + Math.PI / 2;
    const faceLeft = Math.cos(p._visAng || 0) < 0;   // 朝左跑则镜像
    const dw = 104, dh = dw * 195 / 495;
    ctx.save();
    ctx.translate(60, 48 + bob * 0.3);
    ctx.rotate(-outerRot);
    if (!faceLeft) ctx.scale(-1, 1);                  // 视频帧头朝左：朝右跑需镜像为头朝右
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return true;
  };

  /* ===== 视频关键帧鼠：16 帧奔跑序列（绿幕视频提取），按步态相位循环播放。
       侧视专用（室内模式）：序列帧头朝左，镜像为头朝右，外层 scale(faceDir) 处理朝向。 ===== */
  const _mouseVideo = (ctx, p, t, v) => {
    const vk = v.key;
    const vanish = p.vanishT > 0;

    // dart（快跑冲刺）→ fast vseq（视频提取的快跑序列）。步频由真实冲刺速度驱动，
    // 0.3s 缓入；相位用 dt 积分累计帧数，速度/状态变化不跳帧。
    if (p.state === "dart" && !vanish) {
      const realSp = p._moveSp || 0;
      const targetFps = Math.min(60, Math.max(10, realSp * 0.16));
      if (p._mvState !== "dart") { p._mvState = "dart"; p._mvStateT = t; p._mvPh = 0; }
      if (p._mvLastT == null) p._mvLastT = t;
      const dt = Math.min(0.1, Math.max(0, t - p._mvLastT)); p._mvLastT = t;
      const ramp = Math.min(1, (t - (p._mvStateT || t)) / 0.3);
      p._mvPh = (p._mvPh || 0) + dt * targetFps * ramp;
      const fi = Math.floor(p._mvPh) % VSEQ_META.fast.frames;
      const info = _vseqFrame("fast", vk, fi, t, VSEQ_DRAW_SCALE_FAST);
      if (!info) return false;
      const bob = Math.abs(Math.sin(p._mvPh * 0.4)) * 1.0 * ramp;
      const sh = ctx.createRadialGradient(60, 68, 4, 60, 68, 50);
      sh.addColorStop(0, "rgba(6,10,9,.36)");
      sh.addColorStop(0.55, "rgba(6,10,9,.14)");
      sh.addColorStop(1, "rgba(6,10,9,0)");
      ctx.fillStyle = sh;
      // 阴影随放大后的鼠身加大（×1.30 后 dart 鼠身 ≈127 宽，比 peek 的 ~97.7 更宽）
      ctx.beginPath(); ctx.ellipse(60, 68 + bob * 0.3, 42, 31, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(60, 0);
      ctx.scale(-1, 1);                            // vseq 鼠头朝左 → 镜像为头朝右（匹配 D.mouse 约定）
      ctx.drawImage(info.cv, info.sx, 0, info.srcW, info.srcH, -info.dstW / 2, info.topY + bob * 0.3, info.dstW, info.dstH);
      ctx.restore();
      return true;
    }

    // peek（洞口探头，东张西望）→ look vseq（视频提取的探头张望序列）。
    // 外层 scale(faceDir) 左右交替翻转 → 头朝左/右交替 = "东张西望"；帧内 head-bob 补充活感。
    if (p.state === "peek") {
      const fi = Math.floor((t * 8 + (p.phase || 0) * 0.6) % VSEQ_META.look.frames);
      const info = _vseqFrame("look", vk, fi, t, VSEQ_DRAW_SCALE_LOOK);
      if (!info) return false;
      const bob = Math.sin(t * 2.2 + (p.phase || 0)) * 0.4;
      const sh = ctx.createRadialGradient(60, 68, 4, 60, 68, 38);
      sh.addColorStop(0, "rgba(6,10,9,.30)");
      sh.addColorStop(0.55, "rgba(6,10,9,.12)");
      sh.addColorStop(1, "rgba(6,10,9,0)");
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.ellipse(60, 68, 32, 24, 0, 0, Math.PI * 2); ctx.fill();   // peek 鼠身 ~97.7 宽 → 阴影比 dart（127 宽，42×31）略小
      ctx.save();
      ctx.translate(60, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(info.cv, info.sx, 0, info.srcW, info.srcH, -info.dstW / 2, info.topY + bob, info.dstW, info.dstH);
      ctx.restore();
      return true;
    }

    // hole（缩回洞内）/ 其余：冻结 run 帧 0。0.15s 后 fade→0，render 层不再绘制。
    const frames = MICEHD.video[vk];
    if (!frames || !frames.length || !frames[0] || !frames[0].ok) return false;
    const img = frames[0];
    const dw = 108, dh = 108 * 195 / 495;
    const bob = Math.sin(t * 0.8 + (p.phase || 0)) * 0.12;
    const sh = ctx.createRadialGradient(60, 70, 4, 60, 70, 40);
    sh.addColorStop(0, "rgba(6,10,9,.32)");
    sh.addColorStop(0.55, "rgba(6,10,9,.13)");
    sh.addColorStop(1, "rgba(6,10,9,0)");
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.ellipse(60, 70 + bob * 0.3, 30, 23, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(60, 44 + bob * 0.3);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return true;
  };

  /* ===== 写实 8 朝向鼠：按行进方向选对应朝向贴图（贴图已含真实毛发/光影/尾/耳/腿），
       叠加程序化跑动起伏、步频挤压、呼吸缩放。贴图自带朝向，不再额外旋转。
       朝向映射：局部"头朝上"=dir0；外层 rotate(_visAng+π/2) 后，
       世界朝向 visAng 对应的贴图方向 dir = visAng + 90°（弧度转角度）。
       降级：任一朝向贴图未加载时回退到矢量版。 ===== */
  const _mouseReal = (ctx, p, t, v) => {
    // 世界朝向角（度）。visAng=0(右) → dir90；visAng=π/2(下) → dir180
    const angDeg = ((p._visAng || 0) * 180 / Math.PI + 90 + 360) % 360;
    const dir = ((Math.round(angDeg / 45) * 45) % 360 + 360) % 360;
    const tex = (MICEHD.real[dir] || {})[v.key];
    if (!tex || !tex.ok) return false;

    const running = p.state !== "pause" && !(p.vanishT > 0);
    // 起伏步频随真实移动速度（px/s）线性变化：125→≈3.2Hz、250→≈4.9、400+→≈6.9（封顶 7.5）
    const realSp = p._moveSp || ((p.def && p.def.speed || 125) * (p.mSpeed || 1));
    const freq = running ? Math.min(7.5, Math.max(2.5, 1.5 + realSp * 0.0135)) : 1.1;
    const phase = t * freq + (p.phase || 0);
    const amp = running ? Math.min(1.2, 0.55 + realSp * 0.003) : 0.3;
    const bob = running ? Math.abs(Math.sin(phase)) * 1.6 : Math.sin(t * 2) * 0.4;
    const squash = 1 + (running ? Math.sin(phase * 2) * 0.035 * amp : 0);  // 步频挤压
    const crouch = p.vanishT > 0 ? 0.9 : 1;

    // 触地柔影
    const sh = ctx.createRadialGradient(60, 72, 4, 60, 72, 42);
    sh.addColorStop(0, "rgba(6,10,9,.40)");
    sh.addColorStop(0.55, "rgba(6,10,9,.16)");
    sh.addColorStop(1, "rgba(6,10,9,0)");
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.ellipse(60, 72 + bob * 0.3, 34 * crouch, 27 * crouch, 0, 0, Math.PI * 2); ctx.fill();

    // 抵消外层 rotate(_visAng+π/2)：贴图自带世界朝向，需把坐标系转回世界坐标
    const outerRot = (p._visAng || 0) + Math.PI / 2;
    // 贴图居中绘制在 (60,50)，尺寸适配设计空间
    const SIZE = 118;
    ctx.save();
    ctx.translate(60, 50);
    ctx.rotate(-outerRot);                      // 撤销外层旋转
    ctx.translate(0, bob * 0.35);
    ctx.scale(crouch * squash, crouch / squash);
    ctx.drawImage(tex, -SIZE / 2, -SIZE / 2, SIZE, SIZE);
    ctx.restore();
    return true;
  };

  /* ===== 骨骼驱动版俯视鼠：干净身体贴图 + 程序化可动部件（耳/腿/尾/眼）=====
     设计空间 120×100，头朝上（y 小）、尾朝下（y 大），身体中心 (60,50)。
     共享步态相位 phase 驱动全部部件；转向角速度 turn 驱动侧倾与耳外展；
     状态 scurry/pause/dart 决定频率与幅度。各部件绕自身 pivot 旋转。 */
  const _mouseTopRig = (ctx, p, t, v, bodyTex) => {
    const isRed = v.key === "albino";
    const earCol = v.ear || v.mid;
    const earIn = "rgba(244,168,162,.92)";   // 素材粉内耳
    const tailCol = v.tail || "#eaa99f";

    // ---- 运动信号 ----
    // 四腿摆动步频随真实移动速度（px/s）线性变化：125→≈3.2Hz、250→≈4.9、400+→≈6.9（封顶 7.5）
    const realSp = p._moveSp || ((p.def && p.def.speed || 125) * (p.mSpeed || 1));
    const running = p.state !== "pause" && !(p.vanishT > 0);
    const freq = running ? Math.min(7.5, Math.max(2.5, 1.5 + realSp * 0.0135)) : 1;
    const amp = running ? Math.min(1.2, 0.55 + realSp * 0.003) : 0.35;
    const phase = t * freq + (p.phase || 0);
    // 转向角速度：用可见角的变化率，驱动侧倾/耳外展
    let turn = 0;
    if (p._lastVisAng != null) {
      let da = (p._visAng || 0) - p._lastVisAng;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      turn = Math.max(-1, Math.min(1, da * 14));
    }
    p._lastVisAng = p._visAng || 0;
    const crouch = p.vanishT > 0 ? 0.9 : (p.state === "pause" ? 0.98 : 1);
    const bob = running ? Math.abs(Math.sin(phase)) * 1.8 : Math.sin(t * 2) * 0.5;
    const lean = turn * 0.14 + (running ? Math.sin(phase * 0.5) * 0.03 : 0);

    // ---- 触地柔影 ----
    const sh = ctx.createRadialGradient(60, 74, 4, 60, 74, 44);
    sh.addColorStop(0, "rgba(6,10,9,.42)");
    sh.addColorStop(0.55, "rgba(6,10,9,.17)");
    sh.addColorStop(1, "rgba(6,10,9,0)");
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.ellipse(60, 74 + bob * 0.3, 36 * crouch, 29 * crouch, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(60, 50 + bob * 0.4);
    ctx.rotate(lean);
    ctx.scale(crouch, crouch);

    // ---- 尾巴：多节相位延迟鞭状波（相对中心，粉色系取自素材）----
    const wagBase = Math.sin(phase * 0.7) * (running ? 8 : 4) + turn * 6;
    const seg = (k) => Math.sin(phase * 0.7 - k * 0.55) * (running ? 4.2 : 2) * amp;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const tp = () => {
      ctx.beginPath();
      ctx.moveTo(0, 28);
      ctx.bezierCurveTo(seg(0), 38, seg(1) * 1.4, 46, seg(2) * 1.9 + wagBase * 0.3, 53);
    };
    ctx.strokeStyle = tailCol; ctx.lineWidth = 5;
    tp(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,236,240,.85)"; ctx.lineWidth = 1.6;
    tp(); ctx.stroke();
    if (v.accessory === "whiteTip") {
      ctx.strokeStyle = "rgba(250,248,244,.95)"; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(seg(2) * 1.5, 50); ctx.lineTo(seg(2) * 1.9 + wagBase * 0.3, 53); ctx.stroke();
    }

    // ---- 腿 ×4（矢量，绕腿根 pivot 旋转；对角步态）----
    // 素材爪是粉色 → 用暖粉色系，不随毛色变深
    const pawC = v.key === "albino" ? "#f6d5cf" : "#eaa99f";
    const legC = v.key === "albino" ? "#f0e2d8" : _mix(v.mid, [255,210,200], 0.35);
    const leg = (px, py, ph) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.sin(ph) * 0.24 * amp + turn * 0.08);   // 腿旋转幅 0.36→0.32→0.24，摆动更收敛
      ctx.fillStyle = legC;
      ctx.beginPath(); ctx.ellipse(0, 6, 5.2, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pawC;
      ctx.beginPath(); ctx.ellipse(-1.6, 12, 3.1, 2.5, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1.8, 12, 3.1, 2.5, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    leg(-13, 16, phase);          // 左后
    leg(13, 16, phase + Math.PI); // 右后

    // ---- 干净身体贴图（含后脑 + 脸/眼，旋转 180° 转正）----
    const sx0 = 9, sy0 = 9, sw = 149, shh = 138, dw = 84, dh = 84;
    ctx.save(); ctx.rotate(Math.PI);
    ctx.drawImage(bodyTex, sx0, sy0, sw, shh, -dw / 2, -dh / 2 - 4, dw, dh);
    ctx.restore();

    // 前爪（对角交叉相位）
    leg(-14, -16, phase + Math.PI);   // 左前
    leg(14, -16, phase);              // 右前

    // ---- 耳朵 ×2（矢量，素材粉色；绕耳根反相摆动 + 转向外展）----
    const earShell = v.key === "albino" ? "#eadfd6" : _mix(v.ear, [255,220,210], 0.3);
    const ear = (px, py, sgn, ph) => {
      ctx.save(); ctx.translate(px, py);
      const sw = Math.sin(ph) * 0.18 * amp + turn * sgn * 0.25 + Math.sin(t * 2.4 + (p.phase || 0)) * 0.05;
      ctx.rotate(sw);
      ctx.fillStyle = earShell;
      ctx.beginPath(); ctx.ellipse(sgn * 5, -2, 10, 11.5, sgn * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = earIn;
      ctx.beginPath(); ctx.ellipse(sgn * 5, -2, 6.6, 8.2, sgn * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,240,246,.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(sgn * 5, -2, 10, 11.5, sgn * 0.18, 0, Math.PI * 2); ctx.stroke();
      if (v.accessory === "scar" && sgn < 0) {
        ctx.strokeStyle = "rgba(222,208,178,.95)"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(sgn * 5 - 3, -6); ctx.lineTo(sgn * 5, -1); ctx.lineTo(sgn * 5 - 3, 4); ctx.stroke();
      }
      ctx.restore();
    };
    ear(-20, -34, -1, phase);
    ear(20, -34, 1, phase + 0.6);

    // ---- 眼睛：贴图眼上叠发光脉动 + 随机眨眼（相对中心偏移）----
    const isRedEye = isRed;
    const eyes = [[-11, -38], [11, -38]];
    const pulse = 0.7 + 0.3 * Math.sin(t * 3.2 + (p.phase || 0));
    const h0 = isRedEye ? "rgba(255,120,110," : "rgba(255,214,140,";
    const h1 = isRedEye ? "rgba(240,90,80," : "rgba(255,196,110,";
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    eyes.forEach(([ex, ey]) => {
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 7);
      g.addColorStop(0, h0 + (0.38 * pulse).toFixed(3) + ")");
      g.addColorStop(0.45, h1 + (0.16 * pulse).toFixed(3) + ")");
      g.addColorStop(1, "rgba(255,180,90,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
    ctx.restore();   // 结束身体形变

    // 颈圈配饰
    if (v.accessory === "collar") {
      ctx.strokeStyle = "rgba(82,56,34,.9)"; ctx.lineWidth = 2.8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(46, 33); ctx.quadraticCurveTo(60, 39, 74, 33); ctx.stroke();
      ctx.fillStyle = "rgba(112,78,46,.95)";
      ctx.beginPath(); ctx.arc(60, 37, 2.1, 0, Math.PI * 2); ctx.fill();
    }
  };

  /* HD 贴图俯视鼠（真·背面素材 T19：看到脊背+后脑+双耳，头朝下需转正 180°）。
     贴图内容框 x[9,157] y[9,146]（149×138）；旋转 180° 后眼位于头部两侧、尾从臀下伸出。
     程序化补：粉色摆尾（素材背面图无尾）、发光眼微光、状态形变（奔跑起伏/扭腰/缩身/嗅探）。 */
  const _mouseTopHD = (ctx, p, t, v, tex) => {
    const isRedEye = v.key === "albino";
    const tailCol = v.tail || "#c99f85";
    const running = p.state !== "pause" && !(p.vanishT > 0);
    // speedK 按真实移动速度（px/s）归一：100→0.6 下限 … 242+→1.45 上限；起伏/扭腰/摆尾随之随速快慢
    const realSp = p._moveSp || ((p.def && p.def.speed || 125) * (p.mSpeed || 1));
    const speedK = Math.min(1.45, Math.max(0.6, realSp / 150));
    const gait = t * 3.1 * speedK + (p.phase || 0);
    const stride = running ? Math.sin(gait) : Math.sin(t * 0.9 + (p.phase || 0)) * 0.25;
    const bob = running ? Math.abs(Math.sin(gait)) * 2 : Math.sin(t * 0.8 + (p.phase || 0)) * 0.6;
    const lean = running ? Math.sin(gait * 0.5) * 0.045 * speedK : 0;
    const crouch = p.vanishT > 0 ? 0.9 : (p.state === "pause" ? 0.98 : 1);
    const wag = Math.sin(t * 3.1 + (p.phase || 0)) * (running ? 9 : 5);   // 尾巴摆动

    // 触地柔影
    const sh = ctx.createRadialGradient(60, 74, 4, 60, 74, 44);
    sh.addColorStop(0, "rgba(6,10,9,.42)");
    sh.addColorStop(0.55, "rgba(6,10,9,.17)");
    sh.addColorStop(1, "rgba(6,10,9,0)");
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.ellipse(60, 72 + bob * 0.3, 36 * crouch, 29 * crouch, 0, 0, Math.PI * 2); ctx.fill();

    // 程序化粉色尾巴（臀下 y≈78 伸出，向后拖、末端摆动渐细；素材背面图无尾）
    const tailPath = () => {
      ctx.beginPath();
      ctx.moveTo(60, 80);
      ctx.bezierCurveTo(60 + wag * 0.3, 90, 57 + wag * 0.7, 97, 50 + wag, 103);
    };
    ctx.lineCap = "round";
    ctx.strokeStyle = tailCol; ctx.lineWidth = 4.2; tailPath(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,236,240,.85)"; ctx.lineWidth = 1.5; tailPath(); ctx.stroke();
    if (v.accessory === "whiteTip") {
      ctx.strokeStyle = "rgba(250,248,244,.95)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(53 + wag * 0.6, 99); ctx.lineTo(50 + wag, 103); ctx.stroke();
    }

    // 贴图主体：旋转 180° 转正（背脊朝上、头朝行进方向）
    const sx0 = 9, sy0 = 9, sw = 149, shh = 138;
    const dw = 84, dh = 84;                            // 俯视圆润身，略收以匹配场景比例
    ctx.save();
    ctx.translate(60, 46 + bob * 0.4);
    ctx.rotate(lean);
    ctx.scale(crouch * (1 + Math.abs(stride) * 0.02), crouch * (1 - Math.abs(stride) * 0.015));
    ctx.rotate(Math.PI);                               // 转正：头朝上
    ctx.drawImage(tex, sx0, sy0, sw, shh, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    // 发光眼微光（贴图眼在转正后头部两侧偏前 ≈ (50,17)/(70,17)，极轻叠加保持卡通眼主体）
    const h0 = isRedEye ? "rgba(255,120,110," : "rgba(255,214,140,";
    const h1 = isRedEye ? "rgba(240,90,80," : "rgba(255,196,110,";
    const h2 = isRedEye ? "rgba(220,70,60,0)" : "rgba(255,180,90,0)";
    const eyes = [[51, 20], [69, 20]];
    const pulse = 0.72 + 0.28 * Math.sin(t * 3.2 + (p.phase || 0));
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    eyes.forEach(([ex, ey]) => {
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 7.5);
      g.addColorStop(0, h0 + (0.4 * pulse).toFixed(3) + ")");
      g.addColorStop(0.45, h1 + (0.18 * pulse).toFixed(3) + ")");
      g.addColorStop(1, h2);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ex, ey, 7.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    // 配饰 collar：颈圈旧皮绳
    if (v.accessory === "collar") {
      ctx.strokeStyle = "rgba(82,56,34,.9)"; ctx.lineWidth = 2.8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(46, 33); ctx.quadraticCurveTo(60, 39, 74, 33); ctx.stroke();
      ctx.fillStyle = "rgba(112,78,46,.95)";
      ctx.beginPath(); ctx.arc(60, 37, 2.1, 0, Math.PI * 2); ctx.fill();
    }
  };

  D.mouseTop = (ctx, p, t) => {
    const v = p.mouseVar || G.MOUSE_VARIANTS[0];        // 花色变体（群鼠 6 只差异化）
    const pal = _mousePalette(v);
    D.initMiceHD();
    if (_mouseVideoTop(ctx, p, t, v)) return;                                // 视频关键帧鼠（俯视群鼠）
    if (_mouseReal(ctx, p, t, v)) return;                                    // 写实 8 朝向版（俯视群鼠）
    const backTex = MICEHD.back[v.key];
    if (backTex && backTex.ok) return _mouseTopRig(ctx, p, t, v, backTex);  // 骨骼驱动版（部件跟随运动）
    const tex = MICEHD.top[v.key];
    if (tex && tex.ok) return _mouseTopHD(ctx, p, t, v, tex);
    const isRedEye = (v.key === "albino");              // 霜尖红眼：眼珠用 v.eye
    const wag = Math.sin(t * 2.4 + (p.phase || 0)) * 10;
    const gaitT = t * 4.3 + (p.phase || 0);           // 爬行步态相位（对角步）再慢 50%
    const bob = Math.sin(gaitT * 2) * 0.55;           // 身体随步频轻颠，幅度同步收敛

    // ---- 触地柔影（鼠身下方椭圆暗影，越靠中心越深）----
    const sh = ctx.createRadialGradient(60, 72, 4, 60, 72, 54);
    sh.addColorStop(0, "rgba(6,10,9,.40)");
    sh.addColorStop(0.55, "rgba(6,10,9,.18)");
    sh.addColorStop(1, "rgba(6,10,9,0)");
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.ellipse(60, 72, 40, 32, 0, 0, Math.PI * 2); ctx.fill();

    // ---- 粉色长尾（臀下伸出，更长更飘，末端轻摆，尾尖渐细 + 中间浅粉高光）----
    const tailPath = () => {
      ctx.beginPath();
      ctx.moveTo(61, 91);
      ctx.bezierCurveTo(60 + wag * 0.35, 101, 56 + wag * 0.6, 108, 48 + wag, 114);
    };
    ctx.lineCap = "round";
    ctx.strokeStyle = pal.tail; ctx.lineWidth = 4.6; tailPath(); ctx.stroke();
    ctx.strokeStyle = pal.tailLight; ctx.lineWidth = 1.7; tailPath(); ctx.stroke();
    // 配饰 · whiteTip：尾尖一撮白毛（烟尾）
    if (v.accessory === "whiteTip") {
      ctx.strokeStyle = "rgba(250,248,244,.95)"; ctx.lineWidth = 3.2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(51 + wag * 0.6, 110); ctx.lineTo(48 + wag, 114); ctx.stroke();
    }

    // 腿脚全部收进身体投影里：只画干净的背部剪影（不再露出四肢/爪掌）

    ctx.save();
    ctx.translate(0, bob);                             // 极轻微的呼吸/步频起伏

    // ---- 粉色圆耳（外耳暗粉 + 内耳径向亮粉 + 浅色外圈描边；收小更贴合鼠身比例）----
    const ear = (ex, ey, sgn) => {
      ctx.save();
      ctx.translate(ex, ey); ctx.rotate(sgn * 0.18); ctx.scale(1, 0.86);   // 俯视：耳朵略压扁
      const og = ctx.createRadialGradient(-2, -3, 2, 0, 0, 15);
      og.addColorStop(0, pal.ear[0]);
      og.addColorStop(0.7, pal.ear[1]);
      og.addColorStop(1, pal.ear[2]);
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,240,246,.30)"; ctx.lineWidth = 1.1; ctx.stroke();
      const ig = ctx.createRadialGradient(-2, -2, 1, 0, 0, 10);
      ig.addColorStop(0, "rgba(255,246,249,.98)");
      ig.addColorStop(0.7, pal.earIn);
      ig.addColorStop(1, pal.ear[2]);
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 8.8, 0, 0, Math.PI * 2); ctx.fill();
      // 配饰 · scar：左耳（sgn=-1，即 ex=44）一道浅米色 V 形刻痕（炭胆）
      if (v.accessory === "scar" && sgn === -1) {
        ctx.strokeStyle = "rgba(222,208,178,.95)"; ctx.lineWidth = 1.8; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-4, -6); ctx.lineTo(0, -1); ctx.lineTo(-4, 3);
        ctx.stroke();
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(1.5, -4.5); ctx.lineTo(3.5, -0.5);
        ctx.stroke();
      }
      ctx.restore();
    };
    // 俯视：耳朵长在头两侧偏后，露出耳廓背面 + 一点内耳
    ear(44, 22, -1); ear(76, 22, 1);

    // ---- 身体（俯视轮廓：细长鼠形——鼻尖收窄 → 头宽 → 肩 → 腰急剧收细（腰仅肩宽 50%）→ 圆臀膨大；
    //      设计稿"细长鼠形"，修复上一版"水滴/香肠"观感）----
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(60, 3);                               // 鼻尖
      ctx.bezierCurveTo(65.5, 3, 69, 9, 69.5, 17);     // 右吻→右头侧
      ctx.bezierCurveTo(70, 26, 73.5, 32, 74.5, 40);   // 头→肩（肩为最宽点，半宽 14.5）
      ctx.bezierCurveTo(75.5, 51, 69, 60, 67.5, 68);   // 右身（急剧收腰，腰部半宽 7.5）
      ctx.bezierCurveTo(73, 75, 74.5, 84, 70, 90.5);   // 右臀（重新膨大，半宽 13）
      ctx.bezierCurveTo(67, 95.5, 63, 97.5, 60, 97.5); // 右臀底→尾根
      ctx.bezierCurveTo(57, 97.5, 53, 95.5, 50, 90.5); // 左臀底
      ctx.bezierCurveTo(45.5, 84, 47, 75, 52.5, 68);   // 左臀→左腰（与右对称）
      ctx.bezierCurveTo(51, 60, 44.5, 51, 45.5, 40);   // 左腰→左肩
      ctx.bezierCurveTo(46.5, 32, 50, 26, 50.5, 17);   // 左肩→左头侧
      ctx.bezierCurveTo(51, 9, 54.5, 3, 60, 3);        // 左吻→鼻尖
      ctx.closePath();
    };
    const bg = ctx.createRadialGradient(53, 27, 4, 62, 58, 76);
    bg.addColorStop(0, pal.body[0]);                    // 背部受光（浅）
    bg.addColorStop(0.4, pal.body[1]);                  // 中
    bg.addColorStop(0.75, pal.body[2]);                 // 侧背
    bg.addColorStop(1, pal.body[3]);                    // 边缘暗部
    ctx.fillStyle = bg;
    bodyPath(); ctx.fill();

    // ---- 底部环境光遮蔽（暖棕暗部）+ 腹侧白毛（俯视时两侧露出的白色胸腹）+ 吻部白毛 ----
    ctx.save();
    bodyPath(); ctx.clip();
    // 深色鼠（炭胆/烟尾）back 亮度低 → 白带少画、AO 减弱，让深灰占主导（保花色差异）
    const backLum = (c => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]))(_hex2rgb(v.back)) / 255;
    const bellyA = backLum > 0.55 ? 0.62 : backLum > 0.38 ? 0.38 : 0.16;   // 亮鼠白带明显，深鼠弱化（阈值上调：炭胆 .32/烟尾 .36 归深色档，暖棕鼠 老仓 .42/花栗 .47 归亮档）
    const aoA = backLum > 0.45 ? 0.4 : 0.22;                              // 深鼠 AO 减弱
    const ao = ctx.createRadialGradient(64, 84, 8, 62, 84, 50);
    ao.addColorStop(0, "rgba(126,84,52," + aoA.toFixed(2) + ")");
    ao.addColorStop(1, "rgba(126,84,52,0)");
    ctx.fillStyle = ao;
    ctx.fillRect(20, 46, 84, 60);
    // 左右腹侧白带（沿体侧边缘，模拟白色胸腹；底色取变体 belly，霜尖=纯白；宽度随收窄后的体型）
    const bl = ctx.createLinearGradient(46, 0, 58, 0);
    bl.addColorStop(0, _hexA(pal.bellyBand, bellyA));
    bl.addColorStop(1, _hexA(pal.bellyBand, 0));
    ctx.fillStyle = bl;
    ctx.beginPath(); ctx.ellipse(50, 64, 6, 26, 0.06, 0, Math.PI * 2); ctx.fill();
    const br = ctx.createLinearGradient(74, 0, 62, 0);
    br.addColorStop(0, _hexA(pal.bellyBand, bellyA));
    br.addColorStop(1, _hexA(pal.bellyBand, 0));
    ctx.fillStyle = br;
    ctx.beginPath(); ctx.ellipse(70, 64, 6, 26, -0.06, 0, Math.PI * 2); ctx.fill();
    // 吻部/下巴白带（深毛色鼠弱化，避免整体偏浅）
    const mw = ctx.createRadialGradient(60, 16, 1, 60, 16, 15);
    mw.addColorStop(0, _hexA(pal.bellyBand, Math.min(1, bellyA * 1.35)));
    mw.addColorStop(0.6, _hexA(pal.bellyBand, bellyA * 0.85));
    mw.addColorStop(1, _hexA(pal.bellyBand, 0));
    ctx.fillStyle = mw;
    ctx.beginPath(); ctx.ellipse(60, 16, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
    // 右侧暗部（球面转折）
    const side = ctx.createLinearGradient(42, 0, 80, 0);
    side.addColorStop(0, "rgba(120,82,48,0)");
    side.addColorStop(0.62, "rgba(120,82,48,.05)");
    side.addColorStop(1, "rgba(120,82,48,.28)");
    ctx.fillStyle = side;
    ctx.fillRect(20, 0, 84, 100);
    // ---- 左上大面积柔光高光（暖色、低强度：原白色 .95 会把炭胆/烟尾等深色鼠打白，抹掉花色）----
    // 深毛色鼠进一步削弱高光（backLum 低 → 高光弱），保留深色花色
    const hlI = backLum > 0.55 ? 1 : backLum > 0.38 ? 0.55 : 0.28;
    const hl = ctx.createRadialGradient(50, 30, 2, 52, 32, 38);
    hl.addColorStop(0, "rgba(255,244,224," + (0.42 * hlI).toFixed(3) + ")");
    hl.addColorStop(0.5, "rgba(255,244,224," + (0.12 * hlI).toFixed(3) + ")");
    hl.addColorStop(1, "rgba(255,244,224,0)");
    ctx.fillStyle = hl;
    ctx.beginPath(); ctx.ellipse(50, 31, 20, 21, -0.16, 0, Math.PI * 2); ctx.fill();
    // ---- 头部小高光（湿润感，同样暖色弱化，深鼠更弱）----
    const hl2 = ctx.createRadialGradient(55, 10, 1, 56, 11, 12);
    hl2.addColorStop(0, "rgba(255,244,224," + (0.5 * hlI).toFixed(3) + ")");
    hl2.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl2;
    ctx.beginPath(); ctx.ellipse(56, 11, 8, 6, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ---- 冷色轮廓光（暗底上勾出形体，左侧更亮）----
    bodyPath();
    ctx.strokeStyle = "rgba(226,234,243,.5)"; ctx.lineWidth = 1.3; ctx.stroke();

    // ---- 背脊高光（背面视角的纵向亮带，强调"看到的是鼠背"）----
    // 配饰 · spine：花栗的脊纹用更浅更明显的米色带（其余鼠保持柔光高光）
    // 深毛色鼠削弱背脊高光，避免把深色背打白
    const spineI = v.accessory === "spine" ? 1 : (backLum > 0.55 ? 1 : backLum > 0.38 ? 0.5 : 0.25);
    const spineCol = v.accessory === "spine" ? "rgba(248,242,226,.85)" : "rgba(255,255,255," + (0.42 * spineI).toFixed(3) + ")";
    const spineMid = v.accessory === "spine" ? "rgba(248,242,226,.5)" : "rgba(255,255,255," + (0.14 * spineI).toFixed(3) + ")";
    const spine = ctx.createLinearGradient(0, 10, 0, 94);
    spine.addColorStop(0, "rgba(255,255,255,0)");
    spine.addColorStop(0.32, spineCol);
    spine.addColorStop(0.72, spineMid);
    spine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spine;
    ctx.beginPath(); ctx.ellipse(60, 54, 6, 31, 0, 0, Math.PI * 2); ctx.fill();

    // ---- 细白胡须（俯视：从吻端向前（屏幕上方）散开，不再左右平伸）----
    ctx.strokeStyle = "rgba(255,255,255,.58)"; ctx.lineWidth = 0.9; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(57, 8); ctx.quadraticCurveTo(52, 2, 47, -3);
    ctx.moveTo(57.5, 10); ctx.quadraticCurveTo(49, 6, 41, 2);
    ctx.moveTo(58, 12); ctx.quadraticCurveTo(50, 11, 42, 10);
    ctx.moveTo(63, 8); ctx.quadraticCurveTo(68, 2, 73, -3);
    ctx.moveTo(62.5, 10); ctx.quadraticCurveTo(71, 6, 79, 2);
    ctx.moveTo(62, 12); ctx.quadraticCurveTo(70, 11, 78, 10);
    ctx.stroke();

    // ---- 发光眼（俯视：头部两侧偏前。暖琥珀色 + screen 光晕，暗底上持续发亮、清晰可见）----
    // 霜尖红眼：眼珠用变体红 eye，光晕改暖红；其余保持暖琥珀
    const eyeBall = isRedEye ? v.eye : "#ffc27a";
    const eyeHalo = isRedEye
      ? ["rgba(255,120,110,", "rgba(240,90,80,", "rgba(220,70,60,0)"]
      : ["rgba(255,214,140,", "rgba(255,196,110,", "rgba(255,180,90,0)"];
    const eye = (ex, ey) => {
      // 光晕（screen 叠加，随呼吸极轻起伏，暗处也能"亮起来"）
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const pulse = 0.78 + 0.22 * Math.sin(t * 3.2 + (p.phase || 0));
      const halo = ctx.createRadialGradient(ex, ey, 0, ex, ey, 9.5);
      halo.addColorStop(0, eyeHalo[0] + (0.85 * pulse).toFixed(3) + ")");
      halo.addColorStop(0.4, eyeHalo[1] + (0.4 * pulse).toFixed(3) + ")");
      halo.addColorStop(1, eyeHalo[2]);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(ex, ey, 9.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // 眼珠 + 白色高光
      ctx.fillStyle = eyeBall;
      ctx.beginPath(); ctx.arc(ex, ey, 3.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.98)";
      ctx.beginPath(); ctx.arc(ex + 0.9, ey - 1, 1.2, 0, Math.PI * 2); ctx.fill();
    };
    eye(50, 21); eye(70, 21);

    // ---- 鼻子（俯视：吻尖最前端的小圆点，色取变体 nose）----
    ctx.fillStyle = pal.nose;
    ctx.beginPath(); ctx.ellipse(60, 5.2, 2.4, 1.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,236,240,.85)";
    ctx.beginPath(); ctx.ellipse(59.3, 4.6, 0.85, 0.55, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(90,50,60,.32)";
    ctx.beginPath(); ctx.arc(59.2, 5.8, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(60.8, 5.8, 0.5, 0, Math.PI * 2); ctx.fill();

    // ---- 配饰 · topknot：头顶一小撮翘毛（老仓）+ collar：颈圈旧皮绳（设计稿：群头记忆点）----
    if (v.accessory === "topknot" || v.accessory === "collar") {
      if (v.accessory === "collar") {
        // 旧皮绳：头颈交界处一道深褐环带 + 结扣
        ctx.strokeStyle = "rgba(82,56,34,.95)"; ctx.lineWidth = 3.4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(47.5, 32); ctx.quadraticCurveTo(60, 38.5, 72.5, 32); ctx.stroke();
        ctx.strokeStyle = "rgba(122,86,52,.8)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(48.5, 30.6); ctx.quadraticCurveTo(60, 36.6, 71.5, 30.6); ctx.stroke();
        ctx.fillStyle = "rgba(112,78,46,.95)";
        ctx.beginPath(); ctx.arc(60, 36.2, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      if (v.accessory === "topknot") {
        ctx.strokeStyle = _hexA(v.back, 0.92); ctx.lineWidth = 2.2; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(57, 9); ctx.quadraticCurveTo(55, 4, 52, 1);
        ctx.moveTo(60, 8); ctx.quadraticCurveTo(60, 3, 60, -1);
        ctx.moveTo(63, 9); ctx.quadraticCurveTo(65, 4, 68, 1);
        ctx.stroke();
        // 一小撮毛根部的浅色
        ctx.fillStyle = _hexA(v.mid, 0.85);
        ctx.beginPath(); ctx.ellipse(60, 8, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();                                     // 结束 bob 位移
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
  /* 青蛙（青蛙跳玩法）：96×78 盒内绘制，中心 (48,39)，默认朝右。
     状态驱动：leap 后腿伸展、不鼓鸣囊；land 由外层压扁；其余鼓鸣囊呼吸。
     配色刻意偏黄绿——荷塘是深墨绿，青蛙必须比背景亮一档才看得清 */
  D.frog = (ctx, p, t) => {
    const leap = p.fState === "leap";
    const breathe = 1 + Math.sin(t * 2.6 + (p.phase || 0)) * 0.02;
    // 后腿：跳跃时向后下方伸展，蹲坐时收成椭圆
    ctx.fillStyle = "#4b8b3a";
    if (leap) {
      ctx.save(); ctx.translate(28, 50); ctx.rotate(-0.5);
      ctx.beginPath(); ctx.ellipse(0, 0, 21, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(24, 58); ctx.rotate(-0.28);
      ctx.beginPath(); ctx.ellipse(0, 0, 19, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else {
      ctx.beginPath(); ctx.ellipse(26, 52, 16, 12, -0.25, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(22, 60, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 身体
    ctx.fillStyle = "#7cc45f";
    ctx.beginPath(); ctx.ellipse(50, 44, 30, 20 * breathe, 0, 0, Math.PI * 2); ctx.fill();
    // 背部亮面
    ctx.fillStyle = "#a8dd7d";
    ctx.beginPath(); ctx.ellipse(50, 36, 24, 12, 0, 0, Math.PI * 2); ctx.fill();
    // 腹部
    ctx.fillStyle = "#eef7c8";
    ctx.beginPath(); ctx.ellipse(53, 52, 20, 10, 0, 0, Math.PI * 2); ctx.fill();
    // 背部斑点
    ctx.fillStyle = "rgba(64,120,50,.42)";
    [[36, 33, 3.2], [56, 31, 2.6], [70, 37, 2.2]].forEach(d => {
      ctx.beginPath(); ctx.arc(d[0], d[1], d[2], 0, Math.PI * 2); ctx.fill();
    });
    // 前脚
    ctx.fillStyle = "#6ab84f";
    ctx.beginPath(); ctx.ellipse(66, 58, 9, 6, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(54, 62, 9, 5.5, 0.1, 0, Math.PI * 2); ctx.fill();
    // 鸣囊：只有非腾空时才鼓（"呱"的视觉来源）
    if (!leap) {
      const puff = 1 + Math.sin(t * 5 + (p.phase || 0)) * 0.12;
      ctx.fillStyle = "rgba(238,247,200,.86)";
      ctx.beginPath(); ctx.ellipse(61, 54, 9 * puff, 7 * puff, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 眼睛（3/4 视角两只，突出头顶）
    const ex1 = 44, ex2 = 64, ey = 26;
    ctx.fillStyle = "#7cc45f";
    ctx.beginPath(); ctx.arc(ex1, ey, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2, ey, 10, 0, Math.PI * 2); ctx.fill();
    [[ex1, ey, 0.8], [ex2, ey, 1.6]].forEach(([x, y, ox]) => {
      ctx.fillStyle = "#f8ffe8"; ctx.beginPath(); ctx.arc(x, y - 1, 7.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#17240f"; ctx.beginPath(); ctx.arc(x + ox, y, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.beginPath(); ctx.arc(x + ox + 1.4, y - 2.2, 1.3, 0, Math.PI * 2); ctx.fill();
    });
    // 嘴 + 鼻孔
    ctx.strokeStyle = "#2f5b25"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(38, 42); ctx.quadraticCurveTo(48, 50, 63, 43); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = "#3f7a30";
    ctx.beginPath(); ctx.arc(52, 38, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(57, 37, 1.2, 0, Math.PI * 2); ctx.fill();
  };

  /* ============ 蝌蚪快跑 · 两种黑白造型 ============
     几何只算一次（D.tadGeom），两种画法共用同一套头/尾坐标（tailPoints），
     所以切换造型不会改变命中判定。两种都只用黑/灰，保证纯白底上的对比层级一致：
       墨影 ink   圆头大眼 · 细尾（按手绘参考图重制，默认，远距离最稳）
       线条 line  空心勾边 + 黑点眼（简笔画） */
  D.tadGeom = (p, t) => {
    const T = G.TADPOLE || {};
    const inK = (p.tadIn || 0) > 0 ? 1 - p.tadIn / (T.entryT || 0.26) : 1;
    /* 离场时 fade 由 prey.js 按游出距离算（前 62% 全速不淡，后 38% 线性淡出），
       直接取 p.fade 即可；被拍命中仍走时间归一化 0.26 短窗口。 */
    const vanishK = p.vanishT > 0 ? (p.tadOut ? Math.max(0, p.fade || 0) : Math.max(0, p.vanishT / 0.26)) : 1;
    /* 眨眼：自然、慢速、平滑——绝不允许「闪烁」。
       · 睁眼保持为主（每次只闭一次，占整周期的极小一段），闭眼窗口 0.22s，
         用余弦缓动（cos）收-放，开合都柔，没有硬切角，读起来是「眨一下」而非「闪」。
       · 间隔 3.4–5.6s（每只按种子错开，同屏几只节奏不同步），停顿期（探头/悬停）
         稍微勤一点（2.6–4.6s）但不加速到发闪——睁-闭-睁对猫是高信号，
         猫最容易在目标静止的窗口里盯住脸，所以停顿期多眨但仍从容。 */
    const seed = p.tadBlinkSeed == null ? 0 : p.tadBlinkSeed;
    const paused = (p.tState === "peek") || ((p.tadHoverK || 1) < 0.5);
    const cyc = (paused ? 2.6 : 3.4) + (seed % 2.2);   // 3.4–5.6s / 2.6–4.6s
    const bd = 0.22;                                    // 闭眼 0.22s，余弦缓动
    const bt = ((t || 0) + seed) % cyc;
    /* 挣扎时眼睛瞪圆不眨（blink 恒 1） */
    const struggling = (p.tadStruggle || 0) > 0;
    let blink = 1;
    if (!struggling && bt > cyc - bd) {
      const u = (bt - (cyc - bd)) / bd;                 // 0→1
      blink = 0.5 + 0.5 * Math.cos(u * 2 * Math.PI);    // 1→0→1：余弦下凹，窗口中点全闭，两端斜率为 0（开-闭-睁全程无跳变）
    }
    return {
      x: p.x, y: p.y,
      ang: p.tadAng == null ? (p.driftAng || 0) : p.tadAng,
      sc: (p.sc || 1) * (0.72 + 0.28 * Math.min(1, inK)) * (0.88 + 0.12 * vanishK) * 1.18,
      tail: p.tailPoints ? p.tailPoints(t) : [],
      turnGlow: p.tadTurnGlow || 0,
      vanishK: vanishK,
      blink: blink,
      /* 长按挣扎：头部扭动角（wob），位置不动 */
      struggle: struggling ? 1 : 0,
      wob: struggling ? (p.tadStruggleW || 0) : 0,
      /* 探头张望：头部缓慢左右转，像在扫一眼屏幕里有没有动静（仅露头停驻期） */
      look: p.tState === "peek" ? Math.sin((t || 0) * 1.6 + seed) * 0.2 : 0
    };
  };

  /* 尾带路径：按节距取上下两沿围成多边形；wFn 返回该节的半宽（局部单位） */
  function tadBandPath(ctx, g, wFn) {
    const pts = g.tail;
    if (!pts.length) return false;
    const top = [], bot = [];
    let px = g.x, py = g.y;
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      let dx = q.x - px, dy = q.y - py;
      const dl = Math.hypot(dx, dy) || 1;
      const nx = -dy / dl, ny = dx / dl;
      const w = Math.max(0.35, wFn(i, pts.length)) * g.sc;
      top.push({ x: q.x + nx * w, y: q.y + ny * w });
      bot.push({ x: q.x - nx * w, y: q.y - ny * w });
      px = q.x; py = q.y;
    }
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y);
    for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y);
    ctx.closePath();
    return true;
  }

  /* 头部坐标系：平移到头心、旋转到行进方向、缩放到 g.sc；局部 -y 为前进方向。
     g.look：探头张望角（±0.2rad），仅露头停驻期非零。
     g.wob：长按挣扎时的头部扭动角（位置不动，只有头在扭）。 */
  function tadHead(ctx, g, fn) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.ang + Math.PI / 2 + (g.look || 0) + (g.wob || 0));
    ctx.scale(g.sc, g.sc);
    fn(ctx);
    ctx.restore();
  }

  /* 残影：只有实心造型才画，线稿叠影子会显脏 */
  function tadGhost(ctx, g) {
    if (g.tail.length < 4 || g.vanishK <= 0.25) return;
    ctx.save();
    for (let i = 1; i <= 2; i++) {
      const q = g.tail[Math.min(g.tail.length - 1, i * 2)];
      ctx.globalAlpha = (0.055 - i * 0.018) * g.vanishK;
      ctx.fillStyle = "#0b0c0e";
      ctx.beginPath(); ctx.ellipse(q.x, q.y, 6.5 * g.sc, 2.8 * g.sc, g.ang, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function tadFoldHint(ctx, g) {
    if ((g.turnGlow || 0) <= 0.02) return;
    ctx.save();
    ctx.globalAlpha = 0.28 * g.turnGlow;
    ctx.strokeStyle = "#101216"; ctx.lineWidth = Math.max(1, 1.5 * g.sc);
    ctx.beginPath(); ctx.arc(g.x, g.y, 22 * g.sc, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.13 * g.turnGlow;
    ctx.beginPath(); ctx.arc(g.x, g.y, 30 * g.sc, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  /* ---- 墨影：圆头大眼 · 细尾（按手绘参考图重制） ----
     局部坐标：-y 为行进方向，+x 为朝屏幕下（朝右游时）。参考图实测比例（头半径≈15 时）：
     头近正圆、略朝行进方向拉长，光照在头上方（亮）→ 下方（暗）；
     两只大白眼沿横向（游动时的上/下侧）叠放，各自略朝行进方向拉长、黑瞳居中；
     尾是细而几乎等宽的弧线，梢部轻微收细。 */
  function tadInk(ctx, g) {
    tadGhost(ctx, g);
    if (tadBandPath(ctx, g, (i, n) => 0.55 + 0.8 * Math.pow(1 - i / n, 1.1))) {
      const end = g.tail[g.tail.length - 1] || { x: g.x, y: g.y };
      const tg = ctx.createLinearGradient(g.x, g.y, end.x, end.y);
      tg.addColorStop(0, "rgba(16,17,19,.96)");
      tg.addColorStop(1, "rgba(16,17,19,.7)");
      ctx.fillStyle = tg; ctx.fill();
    }
    tadHead(ctx, g, c => {
      /* 头：上方（局部 -x）亮、下方暗——径向渐变中心偏上后，还原参考图的明暗 */
      const bg = c.createRadialGradient(-5, -4, 2, 1, 1, 24);
      bg.addColorStop(0, "#454a4f");
      bg.addColorStop(0.55, "#26292d");
      bg.addColorStop(1, "#121417");
      c.fillStyle = bg;
      c.beginPath(); c.ellipse(0, 0, 14.4, 15.5, 0, 0, Math.PI * 2); c.fill();
      /* 眨眼：压横向（x）眼宽——闭眼成一条横向细缝，猫对「睁-闭-睁」变化最敏感 */
      const b = g.blink == null ? 1 : Math.max(0, Math.min(1, g.blink));
      const k = 0.08 + 0.92 * b;
      /* [x, y, 横向半宽]；行进方向半高 ≈ 1.36×横向（参考图眼 46×34px） */
      const eyes = [[-5.3, 2.0, 3.7], [5.7, -0.9, 3.9]];
      c.fillStyle = "#ffffff";
      c.beginPath();
      eyes.forEach(e => { c.moveTo(e[0] + Math.max(0.25, e[2] * k), e[1]); c.ellipse(e[0], e[1], Math.max(0.25, e[2] * k), e[2] * 1.36, 0, 0, Math.PI * 2); });
      c.fill();
      c.fillStyle = "#15181c";
      c.beginPath();
      eyes.forEach(e => { c.moveTo(e[0] + Math.max(0.18, 1.25 * k), e[1]); c.ellipse(e[0], e[1], Math.max(0.18, 1.25 * k), 1.25, 0, 0, Math.PI * 2); });
      c.fill();
    });
  }

  /* ---- 线条：空心勾边 + 黑点眼（简笔画） ---- */
  function tadLine(ctx, g) {
    const pts = g.tail;
    if (pts.length) {
      ctx.save();
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = "#111214";
      let prev = { x: g.x, y: g.y };
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i];
        /* 每段单独设线宽，才能从根部收到尾梢 —— 单一 stroke 做不出笔锋（细尾版：梢收得更细） */
        ctx.lineWidth = Math.max(0.8, 3.1 * Math.pow(1 - i / pts.length, 1.5) + 0.38) * g.sc;
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        prev = q;
      }
      ctx.restore();
    }
    tadHead(ctx, g, c => {
      c.fillStyle = "#ffffff";
      c.beginPath(); c.ellipse(0, 0, 16.2, 12.0, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#111214"; c.lineWidth = 2.6;
      c.stroke();
      /* 黑点眼随眨眼压扁（多弧共路径前必须 moveTo，否则出现连接线） */
      const b = g.blink == null ? 1 : Math.max(0, Math.min(1, g.blink));
      const ey = 0.08 + 0.92 * b;
      c.fillStyle = "#111214";
      c.beginPath();
      c.moveTo(-4.8 + 2.05, -3.6); c.ellipse(-4.8, -3.6, 2.05, Math.max(0.25, 2.05 * ey), 0, 0, Math.PI * 2);
      c.moveTo(4.8 + 2.05, -3.6); c.ellipse(4.8, -3.6, 2.05, Math.max(0.25, 2.05 * ey), 0, 0, Math.PI * 2);
      c.fill();
      // 一条很短的嘴弧：线稿没有实心块，这点细节能让"脸"成立
      c.strokeStyle = "rgba(17,18,20,.55)"; c.lineWidth = 1.2; c.lineCap = "round";
      c.beginPath(); c.arc(0, 1.6, 3.6, 0.22 * Math.PI, 0.78 * Math.PI); c.stroke();
    });
  }

  D.tadDraw = (ctx, g, style) => {
    if (style === "line") return tadLine(ctx, g);
    return tadInk(ctx, g);
  };

  D.tadpole = (ctx, p, t) => {
    const style = (G.config && G.config.tadStyle) || "ink";
    const g = D.tadGeom(p, t);
    /* 离场淡出：vanishK 同步驱动整体透明度（游出边框的同时轻轻淡掉，柔和的"穿走"收尾）。
       被拍命中仍是 0.26 短窗口，fade 手感不变；露头/巡游期 vanishK=1 完全不受影响。 */
    ctx.save();
    ctx.globalAlpha = g.vanishK;
    /* 裁剪到活动区：蝌蚪游出边框时身体被"画框"遮住，像从纸面后面穿走，
       而不是在边界外继续可见。入场/巡游期头尾都在界内，裁剪不影响正常绘制。 */
    const bb = G.bounds();
    ctx.beginPath();
    ctx.rect(bb.x, bb.y, bb.w, bb.h);
    ctx.clip();
    D.tadDraw(ctx, g, style);
    tadFoldHint(ctx, g);
    ctx.restore();
  };

  /* 造型预览：二级卡、首页图标、样式条共用。len = 全身长度（含头），朝右、轻微 S 形尾。 */
  D.tadpolePreview = (ctx, style, cx, cy, len, t) => {
    const sc = len / 104;
    const headX = cx + 31 * sc;
    const tail = [];
    for (let i = 0; i < 7; i++) {
      const d = (i + 1) * 11 * sc;
      tail.push({ x: headX - d, y: cy + Math.sin(i * 0.5 + (t || 0) * 1.4) * 2.1 * sc, r: 3 * sc });
    }
    D.tadDraw(ctx, { x: headX, y: cy, ang: 0, sc: sc, tail: tail, turnGlow: 0, vanishK: 1 }, style || "ink");
  };

  /* noHD=true 强制矢量（加载屏用：assets 子包尚未就绪，HD 贴图不可用） */
  D.icon = (ctx, type, x, y, s, noHD) => {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    if (type === "tadpole") {
      /* 图标直接复用当前造型的预览：首页卡、场景卡、样式条三处天然一致，
         换造型时不用再维护第三套比例。 */
      D.tadpolePreview(ctx, (G.config && G.config.tadStyle) || "ink", 60, 62, 104, 0);
    } else if (type === "fish") {
      ctx.translate(-60, -36); ctx.globalAlpha = 1;
      const goldSp = G.FISH_SPECIES.find(s => s.key === "gold") || G.FISH_SPECIES[0];
      const fake = { species: goldSp, wagDur: 0.5, phase: 0, state: "FLAP" };
      D.fish(ctx, fake, 1.2);
    } else if (type === "butterfly") {
      // HD 贴图落点 y 56..168，内容中心 (60,112)；矢量回退内容中心 (60,53)。分别补偿使图标居中
      const mslot = noHD ? null : (BFHD.map && BFHD.map.monarch);
      ctx.translate(-60, mslot && mslot.nOk && mslot.dOk ? -112 : -53);
      const fake = { state: "GLIDE", flapDur: 0.28, phase: 0 };
      if (noHD) {
        // 强制矢量：直接画矢量蝶（D.butterfly 内部会按 BFHD 状态选贴图，这里绕开）
        const vd = BFHD.map && BFHD.map.monarch;
        const savedN = vd && vd.nOk, savedD = vd && vd.dOk;
        if (vd) { vd.nOk = false; vd.dOk = false; }
        D.butterfly(ctx, fake, 0.3);
        if (vd) { vd.nOk = savedN; vd.dOk = savedD; }
      } else {
        D.butterfly(ctx, fake, 0.3);
      }
    } else if (type === "mouse") {
      ctx.translate(-60, -44);
      const fake = { state: "peek", phase: 0 };
      D.mouse(ctx, fake, 0);
    } else if (type === "laser") {
      const fake = { state: "hold", sc: 1 };
      D.laser(ctx, fake, 0.6);
    } else if (type === "pool") {
      // 首页「暗夜荧光」卡：浅底 + 与游戏内完全相同的那只发光暗夜荧光（参考图为黄绿发光小虫）
      // 图标设计框约 115×115，整体收在 ±47 内
      const glow = ctx.createRadialGradient(0, 6, 0, 0, 6, 48);
      glow.addColorStop(0, "rgba(238,246,176,.55)");
      glow.addColorStop(.6, "rgba(238,246,176,.18)");
      glow.addColorStop(1, "rgba(238,246,176,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 6, 48, 0, Math.PI * 2); ctx.fill();
      const fake = { state: "crawl", sc: 0.92, crawlAng: -Math.PI / 2, ph: 0.4 };
      D.poolLight(ctx, fake, 0.6);
    } else if (type === "ladybug") {
      // 首页「昆虫乐园」卡：红底黑点小瓢虫（参考图第 6 张卡）
      ctx.save();
      ctx.fillStyle = "rgba(60,50,40,.12)";
      ctx.beginPath(); ctx.ellipse(0, 30, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
      // 六足 + 触角
      ctx.strokeStyle = "#3a2a20"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
      for (const s2 of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.moveTo(s2 * 20, -2 + i * 9);
          ctx.quadraticCurveTo(s2 * 33, 2 + i * 10, s2 * 36, 12 + i * 9); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(s2 * 7, -25); ctx.quadraticCurveTo(s2 * 16, -40, s2 * 22, -41); ctx.stroke();
        ctx.fillStyle = "#3a2a20"; ctx.beginPath(); ctx.arc(s2 * 22, -41, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      // 头
      ctx.fillStyle = "#2f2520";
      ctx.beginPath(); ctx.ellipse(0, -23, 16, 11, 0, 0, Math.PI * 2); ctx.fill();
      // 鞘翅：红色半球 + 中线 + 黑点
      const bg = ctx.createLinearGradient(-24, -18, 22, 26);
      bg.addColorStop(0, "#ff6b52"); bg.addColorStop(.55, "#e8392b"); bg.addColorStop(1, "#b81d18");
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(0, 3, 27, 26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#2f2520"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 28); ctx.stroke();
      ctx.fillStyle = "#2f2520";
      for (const s2 of [-1, 1]) {
        for (const [px, py, pr] of [[13, -9, 5], [19, 5, 4], [10, 14, 4.5]]) {
          ctx.beginPath(); ctx.arc(s2 * px, py, pr, 0, Math.PI * 2); ctx.fill();
        }
      }
      // 高光
      ctx.fillStyle = "rgba(255,255,255,.42)";
      ctx.beginPath(); ctx.ellipse(-11, -12, 7, 4.5, -.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (type === "frog") {
      ctx.translate(-48, -39);
      const fake = { fState: "settle", phase: 0 };
      D.frog(ctx, fake, 0.4);
    } else if (type === "cat") {
      /* 召唤猫咪：橘猫头（加载屏 assets 子包未就绪，纯矢量，不依赖召唤页大猫贴图） */
      ctx.save();
      const fur = ctx.createLinearGradient(0, -46, 0, 36);
      fur.addColorStop(0, "#f7c27d"); fur.addColorStop(1, "#e89a4e");
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.moveTo(-40, -14); ctx.lineTo(-34, -48); ctx.lineTo(-8, -30); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(40, -14); ctx.lineTo(34, -48); ctx.lineTo(8, -30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f7b3ae";
      ctx.beginPath(); ctx.moveTo(-34, -20); ctx.lineTo(-31, -41); ctx.lineTo(-14, -29); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(34, -20); ctx.lineTo(31, -41); ctx.lineTo(14, -29); ctx.closePath(); ctx.fill();
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(0, 2, 38, 33, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(170,96,42,.42)"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-8, -25); ctx.lineTo(-11, -14); ctx.moveTo(0, -28); ctx.lineTo(0, -15);
      ctx.moveTo(8, -25); ctx.lineTo(11, -14); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(-15, -2, 9, 11, 0, 0, Math.PI * 2); ctx.ellipse(15, -2, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#24302c";
      ctx.beginPath(); ctx.ellipse(-14, 0, 4.2, 6.5, 0, 0, Math.PI * 2); ctx.ellipse(14, 0, 4.2, 6.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.beginPath(); ctx.arc(-15.5, -3, 1.8, 0, Math.PI * 2); ctx.arc(12.5, -3, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f28f9a";
      ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(-5, 6); ctx.lineTo(5, 6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#8a5a3a"; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, 12); ctx.quadraticCurveTo(-5, 19, -11, 14);
      ctx.moveTo(0, 12); ctx.quadraticCurveTo(5, 19, 11, 14); ctx.stroke();
      ctx.strokeStyle = "rgba(100,70,50,.55)"; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-20, 10); ctx.lineTo(-44, 6); ctx.moveTo(-20, 15); ctx.lineTo(-45, 17);
      ctx.moveTo(20, 10); ctx.lineTo(44, 6); ctx.moveTo(20, 15); ctx.lineTo(45, 17); ctx.stroke();
      ctx.restore();
    } else if (type === "bowl") {
      /* 电子猫粮：上方落下的干粮 + 不锈钢猫粮盆（矢量，配色与饭盆页一致） */
      ctx.save();
      ctx.fillStyle = "#9a6238";
      [[-13, -42, 3.6], [10, -36, 3.2], [0, -25, 4.2]].forEach(([dx, dy, r]) => {
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = "rgba(154,98,56,.35)";
      ctx.beginPath(); ctx.arc(-13, -50, 1.6, 0, Math.PI * 2); ctx.arc(10, -44, 1.4, 0, Math.PI * 2); ctx.fill();
      const metal = ctx.createLinearGradient(0, -8, 0, 42);
      metal.addColorStop(0, "#e9d4b6"); metal.addColorStop(.5, "#cdb08a"); metal.addColorStop(1, "#a88762");
      ctx.fillStyle = metal;
      ctx.beginPath(); ctx.moveTo(-42, -4); ctx.quadraticCurveTo(-36, 38, 0, 38);
      ctx.quadraticCurveTo(36, 38, 42, -4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#8a562f";
      ctx.beginPath(); ctx.ellipse(0, -7, 38, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#9c7b57"; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-46, -6); ctx.lineTo(46, -6); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-26, 6); ctx.quadraticCurveTo(-20, 26, -4, 30); ctx.stroke();
      ctx.restore();
    } else if (type === "heart") {
      /* 猫咪心情：粉心 + 双音符（呼噜/叫声 → 引导「猫咪状态」页） */
      ctx.save();
      const hgd = ctx.createLinearGradient(0, -40, 0, 40);
      hgd.addColorStop(0, "#ffa8b4"); hgd.addColorStop(1, "#ef6d84");
      ctx.fillStyle = hgd;
      ctx.beginPath();
      ctx.moveTo(0, 38);
      ctx.bezierCurveTo(-58, -2, -32, -46, 0, -18);
      ctx.bezierCurveTo(32, -46, 58, -2, 0, 38);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.beginPath(); ctx.ellipse(-17, -18, 8, 4.5, -.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(-5, 12, 7, 5, -.35, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(2, 11); ctx.lineTo(2, -16); ctx.quadraticCurveTo(14, -12, 17, -3); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(14, 12, 6, 4.5, -.35, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(20, 11); ctx.lineTo(20, -9); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };

  G.draw = D;
};
