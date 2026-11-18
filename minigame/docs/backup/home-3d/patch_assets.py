# -*- coding: utf-8 -*-
# 首页接入参考图裁切素材：3D 猫咪插画 + 6 个猎物图标（矢量绘制作为兜底）
from pathlib import Path
R = Path('/Users/lipeng/www/weixin/cat-game/minigame')

def rep(rel, old, new, must=1):
    p = R / rel
    s = p.read_text()
    n = s.count(old)
    assert n == must, f'{rel}: {n} matches (want {must}) for {old[:80]!r}'
    p.write_text(s.replace(old, new))
    print(f'ok {rel}: {old[:46]!r}...')

# ---------- 1. 打包忽略参考大图（1.8MB，进包没意义） ----------
rep('project.config.json', '''      {
        "value": ".DS_Store",
        "type": "file"
      }''',
'''      {
        "value": ".DS_Store",
        "type": "file"
      },
      {
        "value": "assets/home-reference.png",
        "type": "file"
      }''')

# ---------- 2. 图片加载器 ----------
rep('js/ui.js', '''  /* ================= 首页 =================''',
'''  /* ================= 首页图片素材 =================
     3D 猫咪插画与 6 个猎物图标都从设计稿（assets/home-reference.png）裁切而来。
     加载失败时首页自动回退到矢量绘制，不影响可玩性。 */
  const HOME_IMG = { tried: false, cat: null, icons: {} };
  const HOME_ICON_SRC = {
    fish: "assets/home/icon-fish.png", frog: "assets/home/icon-frog.png",
    mouse: "assets/home/icon-mouse.png", firefly: "assets/home/icon-firefly.png",
    butterfly: "assets/home/icon-butterfly.png", ladybug: "assets/home/icon-ladybug.png"
  };
  /* 首页卡片 key → 素材 key（暗夜萤光用「萤火虫」，激光暗室用「瓢虫/昆虫乐园」） */
  const HOME_ICON_KEY = { pool: "firefly", laser: "ladybug" };
  ui.initHomeImages = () => {
    if (HOME_IMG.tried) return;
    HOME_IMG.tried = true;
    // 浏览器垫片页面在 test/ 下：拼一层 ../ 才能找到 assets（真机不受影响）
    const sub = (typeof location !== "undefined" && location.protocol === "file:" &&
                 /\\/test\\/[^/]*$/.test(decodeURIComponent(location.pathname))) ? "../" : "";
    const load = (src, cb) => {
      try {
        const img = (typeof wx !== "undefined" && wx.createImage) ? wx.createImage() : new Image();
        img.onload = () => cb(img);
        img.src = sub + src;
      } catch (e) {}
    };
    load("assets/home/cat-hero.png", img => { HOME_IMG.cat = img; });
    Object.keys(HOME_ICON_SRC).forEach(k => load(HOME_ICON_SRC[k], img => { HOME_IMG.icons[k] = img; }));
  };
  const homeImg = (key) => (key === "cat" ? HOME_IMG.cat : HOME_IMG.icons[key]) || null;
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

  /* ================= 首页 =================''')

# ---------- 3. drawHome：触发素材加载 ----------
rep('js/ui.js', '''  ui.drawHome = () => {
    const { W, H, land, m, gap, safe, menu } = layout();''',
'''  ui.drawHome = () => {
    ui.initHomeImages();
    const { W, H, land, m, gap, safe, menu } = layout();''')

# ---------- 4. 猫咪：优先用参考图素材 ----------
rep('js/ui.js', '''    // Hero cat perched on the soft rug, reaching toward a small floating butterfly.
    const catScale = land ? Math.min(1, Math.max(.68, availH / 550)) : Math.min(.67, availW / 420);
    const catX = heroCenterX, catY = land ? safe.top + availH * .44 : modesBottom + 111 * catScale + 8;
    const headR = 72 * catScale;
    ctx.save(); ctx.translate(catX, catY);''',
'''    // Hero cat perched on the soft rug, reaching toward a small floating butterfly.
    const catScale = land ? Math.min(1, Math.max(.68, availH / 550)) : Math.min(.67, availW / 420);
    const catX = heroCenterX, catY = land ? safe.top + availH * .44 : modesBottom + 111 * catScale + 8;
    const headR = 72 * catScale;
    // 参考图裁出的 3D 猫咪插画：等宽放进左侧区域、底部贴着「开始玩耍」按钮上沿。
    // 图片自带蝴蝶，命中该分支时跳过下面的矢量蝴蝶。
    const catPic = homeImg("cat");
    const heroBottom = catY + 118 * catScale;
    if (catPic) {
      const boxL = edgeL - 6, boxR = Math.min(panelX - 24, edgeL + availW * .58);
      const boxW = Math.max(80, boxR - boxL);
      const boxT = brandY + (land ? 58 : 46);
      const boxH = Math.max(60, heroBottom - boxT);
      const k = Math.min(boxW / catPic.width, boxH / catPic.height);
      const dw = catPic.width * k, dh = catPic.height * k;
      ctx.drawImage(catPic, boxL + (boxW - dw) / 2, heroBottom - dh, dw, dh);
    } else {
    ctx.save(); ctx.translate(catX, catY);''')

# 猫段结束：矢量猫的 ctx.restore() 后接蝴蝶注释 → 关闭 else 分支
rep('js/ui.js', '''    ctx.beginPath(); ctx.ellipse(-52 * catScale, 76 * catScale, 32 * catScale, 17 * catScale, -.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Small butterfly accent above the cat.
    ctx.save(); ctx.translate(land ? heroCenterX + 156 * catScale : heroCenterX + 58, land ? catY - 105 * catScale : catY - 85);''',
'''    ctx.beginPath(); ctx.ellipse(-52 * catScale, 76 * catScale, 32 * catScale, 17 * catScale, -.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    }

    // Small butterfly accent above the cat.（素材里的猫已带蝴蝶，仅在矢量兜底时补画）
    if (!catPic) {
    ctx.save(); ctx.translate(land ? heroCenterX + 156 * catScale : heroCenterX + 58, land ? catY - 105 * catScale : catY - 85);''')

rep('js/ui.js', '''    ctx.strokeStyle = "#54402c"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1, -11); ctx.quadraticCurveTo(-8, -23, -12, -23); ctx.moveTo(1, -11); ctx.quadraticCurveTo(8, -23, 12, -23); ctx.stroke(); ctx.restore();

    // Mode selector panel and six responsive tiles.''',
'''    ctx.strokeStyle = "#54402c"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1, -11); ctx.quadraticCurveTo(-8, -23, -12, -23); ctx.moveTo(1, -11); ctx.quadraticCurveTo(8, -23, 12, -23); ctx.stroke(); ctx.restore();
    }

    // Mode selector panel and six responsive tiles.''')

# ---------- 5. 卡片图标：优先用素材图 ----------
rep('js/ui.js', '''      ctx.save(); ctx.translate(x + cw / 2, y + ch * .40 + (item.key === "butterfly" ? -6 : 0));
      ctx.shadowColor = "rgba(150,120,70,.16)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      G.draw.icon(ctx, item.key === "laser" ? "ladybug" : item.key, 0, Math.sin(t * 1.4 + i) * 1.5, iconS);
      ctx.restore();''',
'''      const iconPic = homeImg(HOME_ICON_KEY[item.key] || item.key);
      const bobY = Math.sin(t * 1.4 + i) * 1.5;
      if (iconPic) {
        // 素材图（3D 猎物）：按卡片高度等比绘制，偏离卡片圆角的部分裁掉
        const ih2 = ch * .70, iw2 = ih2 * iconPic.width / iconPic.height;
        ctx.save();
        rrPath(x + 2, y + 2, cw - 4, ch - 4, 15);
        ctx.clip();
        ctx.drawImage(iconPic, x + (cw - iw2) / 2, y + ch * .40 - ih2 / 2 + bobY, iw2, ih2);
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(x + cw / 2, y + ch * .40 + (item.key === "butterfly" ? -6 : 0));
        ctx.shadowColor = "rgba(150,120,70,.16)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
        G.draw.icon(ctx, item.key === "laser" ? "ladybug" : item.key, 0, bobY, iconS);
        ctx.restore();
      }''')

# ---------- 6. 启动时预加载（首帧不闪） ----------
rep('game.js', '''  G.topUpPreys();''', '''  G.topUpPreys();''', must=0) if False else None
print('ALL PATCHES APPLIED')
