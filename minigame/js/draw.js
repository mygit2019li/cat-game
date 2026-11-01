/* draw.js — 矢量精灵绘制（Canvas 路径版，替代原型 SVG/CSS） */
module.exports = function (G) {
  const D = {};

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
    if (sp.shape === "poolGold") return D.poolGold(ctx, p, c, t);
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

  /* ---------- 泳池金鱼（贴近真实观赏金鱼的侧视造型，设计空间 120×72，头朝右） ----------
     蛋形圆身 + 背部深橙到腹部浅金的纵向渐变 + 半透明大扇尾（双叶分叉带鳍条）+
     飘逸背鳍 / 胸鳍 / 腹鳍 + 鳃盖弧线 + 鳞片纹 + 黑亮圆眼带高光 */
  D.poolGold = (ctx, p, c, t) => {
    const wag = Math.sin(t * Math.PI * 2 / Math.max(p.wagDur || 0.5, 0.08) + p.phase) * 0.3;
    const finW = Math.sin(t * 4.2 + p.phase) * 0.18;
    const top = (c.bodyGrad && c.bodyGrad[0]) || "#ff7a1c";
    const belly = (c.bodyGrad && c.bodyGrad[1]) || "#ffe0b0";

    // ---- 尾鳍（大扇尾：上下双叶 + 半透明渐变 + 鳍条）----
    ctx.save();
    ctx.translate(28, 36); ctx.rotate(wag * 0.55);
    const tg = ctx.createLinearGradient(0, 0, -40, 0);
    tg.addColorStop(0, "rgba(255,145,65,.95)");
    tg.addColorStop(0.45, "rgba(255,172,95,.62)");
    tg.addColorStop(1, "rgba(255,214,160,.10)");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(4, -3);
    ctx.bezierCurveTo(-8, -22, -28, -36, -40, -30);      // 上叶外缘（更长更飘）
    ctx.bezierCurveTo(-32, -18, -22, -7, -14, -1);       // 上叶内缘
    ctx.bezierCurveTo(-24, 7, -33, 20, -38, 29);         // 下叶内缘
    ctx.bezierCurveTo(-26, 28, -10, 16, 4, 3);           // 下叶外缘
    ctx.closePath(); ctx.fill();
    // 鳍条（从尾柄散开的细纹）
    ctx.strokeStyle = "rgba(255,238,212,.6)"; ctx.lineWidth = 1.1;
    [[-5, -14], [-10, -24], [-8, 12], [-15, 22]].forEach(k => {
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(k[0] * 1.6, k[1] * 0.7, k[0] * 3.4, k[1] * 1.3);
      ctx.stroke();
    });
    ctx.restore();

    // ---- 背鳍（背部飘逸长鳍，后缘随游微颤）----
    const dg = ctx.createLinearGradient(0, 6, 0, 26);
    dg.addColorStop(0, "rgba(255,178,105,.92)");
    dg.addColorStop(1, "rgba(255,214,160,.28)");
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.moveTo(36, 22);
    ctx.bezierCurveTo(46, 6 + finW * 7, 68, 2, 80, 15);  // 前缘上扬到背峰
    ctx.quadraticCurveTo(66, 18, 58, 23);                // 后缘回落
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,236,205,.45)"; ctx.lineWidth = 1;
    [46, 56, 66].forEach(px => {
      ctx.beginPath(); ctx.moveTo(px, 22); ctx.quadraticCurveTo(px + 2, 14, px + 5, 9); ctx.stroke();
    });

    // ---- 身体（蛋形但更瘦长：背深橙 → 腹浅金，金鱼体态轻盈）----
    const bg = ctx.createLinearGradient(0, 15, 0, 58);
    bg.addColorStop(0, top);
    bg.addColorStop(0.40, c.body);
    bg.addColorStop(1, belly);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(102, 35);
    ctx.bezierCurveTo(100, 23, 86, 16, 66, 17.5);
    ctx.bezierCurveTo(42, 19, 25, 27, 23, 36);
    ctx.bezierCurveTo(25, 47, 45, 56, 66, 54.5);
    ctx.bezierCurveTo(87, 53, 101, 46, 102, 35);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(178,64,16,.30)"; ctx.lineWidth = 1.2; ctx.stroke();   // 体缘薄描边，增强体积

    // ---- 背部受光（柔和sheen，增加圆润体积；压低强度避免整体发灰）----
    const sheen = ctx.createRadialGradient(66, 24, 2, 66, 25, 30);
    sheen.addColorStop(0, "rgba(255,252,232,.18)");
    sheen.addColorStop(1, "rgba(255,252,232,0)");
    ctx.fillStyle = sheen;
    ctx.beginPath(); ctx.ellipse(62, 25, 26, 8.5, -0.08, 0, Math.PI * 2); ctx.fill();

    // ---- 鳞片纹（两排错位的浅弧，朝向尾部，低调不抢主体）----
    ctx.strokeStyle = "rgba(255,246,225,.16)"; ctx.lineWidth = 1;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const sx = 42 + col * 14 + (row % 2) * 7, sy = 30 + row * 10;
        ctx.beginPath(); ctx.arc(sx, sy, 7, Math.PI * 0.62, Math.PI * 1.38); ctx.stroke();
      }
    }

    // ---- 鳃盖弧线 ----
    ctx.strokeStyle = "rgba(190,80,25,.38)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(86, 22); ctx.quadraticCurveTo(81, 33, 87, 44); ctx.stroke();

    // ---- 腹鳍 / 臀鳍（腹下小半透明鳍）----
    ctx.fillStyle = "rgba(255,182,115,.8)";
    ctx.beginPath();
    ctx.moveTo(52, 51);
    ctx.quadraticCurveTo(47, 61 + finW * 3, 38, 63);
    ctx.quadraticCurveTo(46, 53, 48, 49);
    ctx.closePath(); ctx.fill();

    // ---- 胸鳍（体侧扇形，轻扑扇）----
    ctx.save();
    ctx.translate(82, 41); ctx.rotate(0.4 + finW);
    const pg2 = ctx.createLinearGradient(0, 0, -10, 18);
    pg2.addColorStop(0, "rgba(255,198,138,.95)");
    pg2.addColorStop(1, "rgba(255,226,182,.22)");
    ctx.fillStyle = pg2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-18, 4, -23, 17);
    ctx.quadraticCurveTo(-7, 14, 3, 5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,240,214,.4)"; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-2, 1); ctx.quadraticCurveTo(-12, 7, -18, 15); ctx.stroke();
    ctx.restore();

    // ---- 眼睛（黑亮圆眼 + 浅色眼环 + 白高光）----
    ctx.fillStyle = "rgba(255,240,215,.9)";
    ctx.beginPath(); ctx.arc(95, 28, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.accent || "#241a14";
    ctx.beginPath(); ctx.arc(95, 28, 2.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.beginPath(); ctx.arc(96.1, 26.9, 1.05, 0, Math.PI * 2); ctx.fill();

    // ---- 嘴（吻端短弧）----
    ctx.strokeStyle = "rgba(160,60,15,.45)"; ctx.lineWidth = 1.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(102.5, 32); ctx.quadraticCurveTo(105.5, 35, 102.5, 38); ctx.stroke();
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

  /* ---------- 老鼠（设计空间 120×78，面向右；花色 variants 参数化） ---------- */
  D.mouse = (ctx, p, t) => {
    const v = p.mouseVar || G.MOUSE_VARIANTS[0];
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
  };

  /* ---------- 暗夜萤光：发光小虫（俯视爬行：六足步态 + 鞘翅背线 + 萤火尾灯，头朝爬行方向） ---------- */
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
    const gait = t * (moving ? 18 : 1.8) + ph * 4;
    const gaitAmp = moving ? 1 : 0.18;
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
    // 4) 膜翅（半透明小翅收拢在背上，持续快频煽动——萤火虫爬行时也会颤翅）
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
    // 5) 腹尾亮灯（呼吸脉动的"萤火"）：亮核 + 柔光
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

  /* ---------- 俯视群鼠（群鼠乱窜模式：高度还原参考图的 3D 玩具鼠，设计空间 120×100 中心 60,50） ----------
     胶囊形一体身（头顶圆 → 微收颈 → 圆臀）+ 超大粉圆耳（内耳亮粉、外圈浅描边）+
     胸前粉色小手（三指）+ 体侧小脚掌 + 细粉长尾 + 细白胡须 + 小黑亮眼 + 粉鼻；
     三层光照：左上大面积高光 + 底部环境光遮蔽 + 冷色轮廓光 */
  D.mouseTop = (ctx, p, t) => {
    const wag = Math.sin(t * 2.4 + (p.phase || 0)) * 10;
    const gaitT = t * 8.6 + (p.phase || 0);           // 爬行步态相位（对角步）
    const bob = Math.sin(gaitT * 2) * 0.9;            // 身体随步频轻颠

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
    ctx.strokeStyle = "#e79ab0"; ctx.lineWidth = 4.6; tailPath(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,222,232,.9)"; ctx.lineWidth = 1.7; tailPath(); ctx.stroke();

    // 腿脚全部收进身体投影里：只画干净的背部剪影（不再露出四肢/爪掌）

    ctx.save();
    ctx.translate(0, bob);                             // 极轻微的呼吸/步频起伏

    // ---- 粉色圆耳（外耳暗粉 + 内耳径向亮粉 + 浅色外圈描边；收小更贴合鼠身比例）----
    const ear = (ex, ey, sgn) => {
      ctx.save();
      ctx.translate(ex, ey); ctx.rotate(sgn * 0.18); ctx.scale(1, 0.86);   // 俯视：耳朵略压扁
      const og = ctx.createRadialGradient(-2, -3, 2, 0, 0, 15);
      og.addColorStop(0, "#f7b6c7");
      og.addColorStop(0.7, "#e894ab");
      og.addColorStop(1, "#d9829b");
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,240,246,.30)"; ctx.lineWidth = 1.1; ctx.stroke();
      const ig = ctx.createRadialGradient(-2, -2, 1, 0, 0, 10);
      ig.addColorStop(0, "rgba(255,246,249,.98)");
      ig.addColorStop(0.7, "rgba(250,206,219,.96)");
      ig.addColorStop(1, "rgba(240,172,192,.95)");
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 8.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    // 俯视：耳朵长在头两侧偏后，露出耳廓背面 + 一点内耳
    ear(44, 22, -1); ear(76, 22, 1);

    // ---- 身体（俯视轮廓：细长鼠形——鼻尖收窄 → 头部渐宽 → 腰略收 → 圆臀；驼色背 + 白色腹侧）----
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(60, 3);                               // 鼻尖
      ctx.bezierCurveTo(66.5, 3, 70, 10, 70.5, 20);    // 右吻→右头侧
      ctx.bezierCurveTo(71, 29, 75.5, 34, 77, 44);     // 头→肩
      ctx.bezierCurveTo(79, 57, 78, 74, 75, 84);       // 右身（细长）
      ctx.bezierCurveTo(72.5, 92, 67.5, 96, 60, 96);   // 右臀→尾根
      ctx.bezierCurveTo(52.5, 96, 47.5, 92, 45, 84);   // 左臀
      ctx.bezierCurveTo(42, 74, 41, 57, 43, 44);       // 左身
      ctx.bezierCurveTo(44.5, 34, 49, 29, 49.5, 20);   // 肩→左头侧
      ctx.bezierCurveTo(50, 10, 53.5, 3, 60, 3);       // 左吻→鼻尖
      ctx.closePath();
    };
    const bg = ctx.createRadialGradient(52, 26, 4, 62, 60, 74);
    bg.addColorStop(0, "#f6c98c");                     // 背部受光（浅驼）
    bg.addColorStop(0.4, "#dfa970");                   // 驼橙
    bg.addColorStop(0.75, "#c9925c");                  // 侧背
    bg.addColorStop(1, "#a97747");                     // 边缘暗部
    ctx.fillStyle = bg;
    bodyPath(); ctx.fill();

    // ---- 底部环境光遮蔽（暖棕暗部）+ 腹侧白毛（俯视时两侧露出的白色胸腹）+ 吻部白毛 ----
    ctx.save();
    bodyPath(); ctx.clip();
    const ao = ctx.createRadialGradient(64, 84, 8, 62, 84, 50);
    ao.addColorStop(0, "rgba(126,84,52,.40)");
    ao.addColorStop(1, "rgba(126,84,52,0)");
    ctx.fillStyle = ao;
    ctx.fillRect(20, 46, 84, 60);
    // 左右腹侧白毛（沿体侧边缘的一带白，模拟参考图的白色胸腹）
    const bl = ctx.createLinearGradient(41, 0, 62, 0);
    bl.addColorStop(0, "rgba(255,252,246,.62)");
    bl.addColorStop(1, "rgba(255,252,246,0)");
    ctx.fillStyle = bl;
    ctx.beginPath(); ctx.ellipse(46, 66, 9, 30, 0.05, 0, Math.PI * 2); ctx.fill();
    const br = ctx.createLinearGradient(79, 0, 58, 0);
    br.addColorStop(0, "rgba(255,252,246,.62)");
    br.addColorStop(1, "rgba(255,252,246,0)");
    ctx.fillStyle = br;
    ctx.beginPath(); ctx.ellipse(74, 66, 9, 30, -0.05, 0, Math.PI * 2); ctx.fill();
    // 吻部/下巴白毛
    const mw = ctx.createRadialGradient(60, 16, 1, 60, 16, 15);
    mw.addColorStop(0, "rgba(255,252,248,.98)");
    mw.addColorStop(0.6, "rgba(255,248,240,.6)");
    mw.addColorStop(1, "rgba(255,248,240,0)");
    ctx.fillStyle = mw;
    ctx.beginPath(); ctx.ellipse(60, 16, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
    // 右侧暗部（球面转折）
    const side = ctx.createLinearGradient(42, 0, 80, 0);
    side.addColorStop(0, "rgba(120,82,48,0)");
    side.addColorStop(0.62, "rgba(120,82,48,.05)");
    side.addColorStop(1, "rgba(120,82,48,.28)");
    ctx.fillStyle = side;
    ctx.fillRect(20, 0, 84, 100);
    // ---- 左上大面积柔光高光 ----
    const hl = ctx.createRadialGradient(50, 30, 2, 52, 32, 38);
    hl.addColorStop(0, "rgba(255,255,255,.95)");
    hl.addColorStop(0.5, "rgba(255,255,255,.35)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.beginPath(); ctx.ellipse(50, 31, 20, 21, -0.16, 0, Math.PI * 2); ctx.fill();
    // ---- 头部小高光（湿润感）----
    const hl2 = ctx.createRadialGradient(55, 10, 1, 56, 11, 12);
    hl2.addColorStop(0, "rgba(255,255,255,.85)");
    hl2.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl2;
    ctx.beginPath(); ctx.ellipse(56, 11, 8, 6, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ---- 冷色轮廓光（暗底上勾出形体，左侧更亮）----
    bodyPath();
    ctx.strokeStyle = "rgba(226,234,243,.5)"; ctx.lineWidth = 1.3; ctx.stroke();

    // ---- 背脊高光（背面视角的纵向亮带，强调"看到的是鼠背"）----
    const spine = ctx.createLinearGradient(0, 10, 0, 94);
    spine.addColorStop(0, "rgba(255,255,255,0)");
    spine.addColorStop(0.32, "rgba(255,255,255,.42)");
    spine.addColorStop(0.72, "rgba(255,255,255,.14)");
    spine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spine;
    ctx.beginPath(); ctx.ellipse(60, 52, 8, 34, 0, 0, Math.PI * 2); ctx.fill();

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

    // ---- 小黑亮眼（俯视：位于头部两侧偏前，珠子更小 + 一点高光）----
    const eye = (ex, ey) => {
      ctx.fillStyle = "#20242c";
      ctx.beginPath(); ctx.arc(ex, ey, 2.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.beginPath(); ctx.arc(ex + 1, ey - 1.1, 1.1, 0, Math.PI * 2); ctx.fill();
    };
    eye(50, 21); eye(70, 21);

    // ---- 粉鼻（俯视：吻尖最前端的小圆点）----
    ctx.fillStyle = "#e98da4";
    ctx.beginPath(); ctx.ellipse(60, 5.2, 2.4, 1.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,214,224,.9)";
    ctx.beginPath(); ctx.ellipse(59.3, 4.6, 0.85, 0.55, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(168,80,102,.38)";
    ctx.beginPath(); ctx.arc(59.2, 5.8, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(60.8, 5.8, 0.5, 0, Math.PI * 2); ctx.fill();
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

  D.icon = (ctx, type, x, y, s) => {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    if (type === "fish") {
      ctx.translate(-60, -36); ctx.globalAlpha = 1;
      const goldSp = G.FISH_SPECIES.find(s => s.key === "gold") || G.FISH_SPECIES[0];
      const fake = { species: goldSp, wagDur: 0.5, phase: 0, state: "FLAP" };
      D.fish(ctx, fake, 1.2);
    } else if (type === "butterfly") {
      // HD 贴图落点 y 56..168，内容中心 (60,112)；矢量回退内容中心 (60,53)。分别补偿使图标居中
      const mslot = BFHD.map && BFHD.map.monarch;
      ctx.translate(-60, mslot && mslot.nOk && mslot.dOk ? -112 : -53);
      const fake = { state: "GLIDE", flapDur: 0.28, phase: 0 };
      D.butterfly(ctx, fake, 0.3);
    } else if (type === "mouse") {
      ctx.translate(-60, -44);
      const fake = { state: "peek", phase: 0 };
      D.mouse(ctx, fake, 0);
    } else if (type === "laser") {
      const fake = { state: "hold", sc: 1 };
      D.laser(ctx, fake, 0.6);
    } else if (type === "pool") {
      const fake = { state: "hold", sc: 1 };
      D.poolLight(ctx, fake, 0.6);
    } else if (type === "frog") {
      ctx.translate(-48, -39);
      const fake = { fState: "settle", phase: 0 };
      D.frog(ctx, fake, 0.4);
    }
    ctx.restore();
  };

  G.draw = D;
};
