/* sharecard.js — 分享卡片 / 猫咪反应测评图
   ────────────────────────────────────────────────────────────────
   用途：
     ① 转发卡片的 imageUrl（微信推荐 5:4 比例，750×600）
     ② 保存到相册，铲屎官自己发朋友圈
   为什么单独做一张图：
     默认分享会截当前画面，结算页是四格数字 + 三个按钮，转发出去毫无吸引力。
     真正有传播力的是「我家猫的测评结果」——炫耀对象是猫，不是游戏。
   设计约束：
     drawCard(ctx, W, H, data) 是纯绘制，不碰 wx，便于在浏览器端用 playwright 预览。
     只有 buildShareCard / saveShareCard 依赖 wx。
   ──────────────────────────────────────────────────────────────── */
module.exports = function (G) {
  /* 与小游戏名称保持一致：不在卡片里另存一份硬编码名字，避免改名后仍印旧名 */
  const APP_NAME = G.GAME_NAME || "逗猫触屏玩具";

  const CW = 750, CH = 600;          // 5:4，微信转发卡片推荐比例
  const TYPE_NAME = {
    fish: "深海捕鱼", butterfly: "蝴蝶花园", mouse: "捕鼠行动", laser: "激光暗室", pool: "暗夜萤光"
  };
  // 「最常玩」格里的短名要能独立看懂：写「花园」「萤光」读者不知道指的是什么玩法
  const TYPE_SHORT = { fish: "捕鱼", butterfly: "蝴蝶", mouse: "捕鼠", laser: "激光", pool: "萤光虫" };

  /* ---------- 绘制小工具（不依赖 G.rr，避免和主 UI 坐标耦合） ---------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* 按像素宽度折行（中文按字断行即可，无需处理单词） */
  function wrap(ctx, str, maxW, maxLines) {
    const out = [];
    let line = "";
    for (const ch of String(str || "")) {
      if (ctx.measureText(line + ch).width > maxW && line) {
        out.push(line); line = ch;
        if (maxLines && out.length >= maxLines) { line = ""; break; }
      } else line += ch;
    }
    if (line) out.push(line);
    return maxLines ? out.slice(0, maxLines) : out;
  }

  /* 椭圆填充：用 arc + scale 实现，避免依赖 ellipse()（部分低版本基础库不支持） */
  function oval(ctx, x, y, rx, ry) {
    ctx.save();
    ctx.beginPath();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
  }

  /* 爪印：一个大肉垫 + 四个脚趾 */
  function paw(ctx, cx, cy, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    oval(ctx, cx, cy + s * 0.20, s * 0.34, s * 0.28);
    const toes = [[-0.40, -0.16, 0.15], [-0.15, -0.36, 0.16], [0.15, -0.36, 0.16], [0.40, -0.16, 0.15]];
    toes.forEach(t => {
      oval(ctx, cx + s * t[0], cy + s * t[1], s * t[2], s * t[2] * 0.92);
    });
    ctx.restore();
  }

  /* ---------- 卡片主体（纯绘制） ---------- */
  function drawCard(ctx, W, H, d) {
    d = d || {};
    const PAD = 56;
    const W1 = "#f4fbf8";                 // 主文字
    const W2 = "rgba(244,251,248,.70)";   // 次文字
    const W3 = "rgba(244,251,248,.46)";   // 弱文字
    const AMBER = "#ffb02e";

    // 背景：深海渐变（深色卡片在聊天/朋友圈里更抓眼）
    const bg = ctx.createLinearGradient(0, 0, W * 0.6, H);
    bg.addColorStop(0, "#0a4f5e");
    bg.addColorStop(0.55, "#0d6b7d");
    bg.addColorStop(1, "#083c4a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 右上角光晕
    const glow = ctx.createRadialGradient(W * 0.86, -H * 0.08, 0, W * 0.86, -H * 0.08, W * 0.62);
    glow.addColorStop(0, "rgba(120,225,205,.22)");
    glow.addColorStop(1, "rgba(120,225,205,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // 装饰爪印：右上角大一枚（评级行右侧的留白），右下角小一枚（避开底部文案行）
    paw(ctx, W - 108, 118, 74, "rgba(255,255,255,.085)");
    paw(ctx, W - 58, 566, 34, "rgba(255,255,255,.06)");

    ctx.textBaseline = "middle";

    // 顶部：类目 + 日期
    ctx.textAlign = "left";
    ctx.font = "20px sans-serif";
    ctx.fillStyle = W3;
    ctx.fillText("猫咪反应测评", PAD, 56);
    ctx.textAlign = "right";
    ctx.fillText(d.dateText || "", W - PAD, 56);

    // 评级大字
    ctx.textAlign = "left";
    ctx.font = "bold 46px sans-serif";
    ctx.fillStyle = AMBER;
    ctx.fillText(d.title || "本局结束", PAD, 132);

    // 一句点评（最多两行）
    ctx.font = "20px sans-serif";
    ctx.fillStyle = W2;
    const descLines = wrap(ctx, d.desc || "", W - PAD * 2, 2);
    descLines.forEach((ln, i) => ctx.fillText(ln, PAD, 180 + i * 30));

    // 四格数据：单局档 = 三格本局 + 一格累计；档案档全是累计维度
    const statTop = 232, statH = 130;
    const gap = 14;
    const cellW = (W - PAD * 2 - gap * 3) / 4;
    (d.cells || []).forEach((c, i) => {
      const x = PAD + i * (cellW + gap);
      ctx.fillStyle = "rgba(255,255,255,.075)";
      ctx.strokeStyle = "rgba(255,255,255,.13)";
      ctx.lineWidth = 1.2;
      rr(ctx, x, statTop, cellW, statH, 16);
      ctx.fill(); ctx.stroke();
      ctx.textAlign = "center";
      // 数值可能是 "12.4"、也可能是两字模式名：按格宽自动缩字号，避免溢出格子
      let fs = c[2] || 34;
      const maxW = cellW - 24;
      ctx.font = "bold " + fs + "px sans-serif";
      while (fs > 16 && ctx.measureText(String(c[0])).width > maxW) {
        fs -= 2; ctx.font = "bold " + fs + "px sans-serif";
      }
      ctx.fillStyle = W1;
      ctx.fillText(String(c[0]), x + cellW / 2, statTop + 60);
      ctx.font = "17px sans-serif";
      ctx.fillStyle = W3;
      ctx.fillText(String(c[1]), x + cellW / 2, statTop + 103);
    });

    // 对比句 / 累计概览（真实数据，不编百分比）
    ctx.textAlign = "left";
    ctx.font = "20px sans-serif";
    ctx.fillStyle = W2;
    ctx.fillText(d.rankText || "", PAD, 404);

    // 分隔线
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, 442); ctx.lineTo(W - PAD, 442);
    ctx.stroke();

    // 底部：游戏名 + 玩法（+ 单局时长）
    ctx.font = "bold 23px sans-serif";
    ctx.fillStyle = W1;
    const head = (d.appName || "") + " · " + (d.typeName || "") + (d.durText ? " · " + d.durText : "");
    // 长文案（带海域名时）按可用宽度自动降字号，避免压到右边缘
    let hfs = 23;
    while (hfs > 16 && ctx.measureText(head).width > W - PAD * 2) {
      hfs -= 1; ctx.font = "bold " + hfs + "px sans-serif";
    }
    ctx.fillText(head, PAD, 484);

    // 底部：搜索引导（抖音/小红书引流的落点，名字必须可搜）
    ctx.font = "19px sans-serif";
    ctx.fillStyle = W3;
    ctx.fillText("微信搜「" + (d.appName || "") + "」，测测你家猫", PAD, 520);
  }

  /* ---------- 组装数据 ----------
     mode = "single"（默认，本局成绩）| "archive"（累计档案）
     没有本局结果时（比如在排行榜页直接邀好友）自动回落到档案档，保证卡片永远有内容。 */
  const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
  function collect(mode) {
    const R = G.result || null;
    const type = (G.config && G.config.targetType) || "fish";
    const durMin = Math.max(1, Math.round((Number(G.config && G.config.duration) || 180) / 60));
    const arch = G.archiveSummary ? G.archiveSummary() : {
      games: 0, hits: 0, touches: 0, days: 0, favType: type, favGames: 0,
      hpmBase: 0, hpmRecent: 0, trend: 0
    };
    const d = new Date();
    const dateText = d.getFullYear() + "." + pad2(d.getMonth() + 1) + "." + pad2(d.getDate());

    if (mode === "archive" || !R) {
      let desc;
      if (arch.games < 3) desc = "刚开始记录，多玩几次就能看出它的变化";
      else if (arch.trend >= 0.15) desc = "越来越熟练，反应比刚开始明显更快";
      else if (arch.trend >= 0.05) desc = "状态在变好，比刚开始抓得更顺";
      else if (arch.trend <= -0.15) desc = "最近提不起兴趣？换个猎物再试试";
      else if (arch.trend <= -0.05) desc = "最近状态比刚开始慢一些，也正常";
      else desc = "反应一直很稳，节奏没怎么变";
      return {
        kind: "archive",
        title: "我家猫的狩猎档案",
        desc,
        cells: [
          [String(arch.hits), "累计捕获", 34],
          [String(arch.days), "累计天数", 34],
          [TYPE_SHORT[arch.favType] || "捕鱼", "最常玩", 28],
          [arch.hpmRecent > 0 ? arch.hpmRecent.toFixed(1) : "0", "每分钟抓", 34]
        ],
        rankText: arch.games >= 1
          ? "累计 " + arch.games + " 局 · 共触碰 " + arch.touches + " 次"
          : "还没有记录，先陪你玩一局吧",
        typeName: "狩猎档案",
        appName: APP_NAME,
        dateText
      };
    }

    // ---- 单局档 ----
    const hits = Number(R.hits) || 0;
    const pct = Math.round(Math.abs(arch.trend) * 100);
    // 趋势句要求至少 4 局（前 3 局做基线 + 至少 1 局近期），否则百分比只是噪音。
    // 超过 60% 就不再报具体数字——涨幅太大时精确百分比反而像编的。
    const trendText = (arch.games >= 4 && pct >= 6)
      ? (arch.trend > 0
          ? (pct > 60 ? "反应速度比刚开始快了不少" : "反应速度比刚开始快 " + pct + "%")
          : (pct > 60 ? "最近比刚开始慢了不少，换个猎物试试" : "最近比刚开始慢 " + pct + "%，换个猎物试试"))
      : "";

    // 历史局数对比：以本地记录为准（logs[0] 是刚写入的本局）；用 G.getLogs() 防脏数据
    const logs = G.getLogs ? G.getLogs() : [];
    const prev = logs.slice(1).filter(l => l && Number(l.hits) > 0);
    let rankText;
    if (trendText) rankText = trendText;
    else if (!prev.length) rankText = arch.games <= 1 ? "第一次测评，之后能看到它的状态变化" : "累计第 " + arch.games + " 局，正在积累数据";
    else {
      const beat = prev.filter(l => hits > Number(l.hits)).length;
      rankText = beat === prev.length
        ? "超过此前全部 " + prev.length + " 局"
        : "超过了此前 " + prev.length + " 局中的 " + beat + " 局";
    }

    // 玩法名：捕鱼再带上海域名，和自己刚玩的画面能对上（结算页也是这个写法）
    let typeName = TYPE_NAME[type] || "深海捕鱼";
    if (type === "fish" && G.SEA_THEMES && G.currentBg) {
      const sea = G.SEA_THEMES.find(t => t.key === G.currentBg());
      if (sea) typeName += " · " + sea.name;
    }

    return {
      kind: "single",
      title: R.title || "",
      desc: R.desc || "",
      cells: [
        [String(hits), "本局捕获", 34],
        [String(Number(R.maxCombo) || 0), "最高连击", 34],
        [(Number(R.acc) || 0) + "%", "命中率", 34],
        [String(arch.hits), "累计捕获", 34]
      ],
      rankText,
      typeName,
      appName: APP_NAME,
      durMin,
      durText: (G.config && G.config.infinite) ? "不限时" : durMin + " 分钟",
      dateText
    };
  }

  /* ---------- 离屏画布：只创建一次，复用 ---------- */
  let offCanvas = null, offCtx = null;
  function ensureCanvas() {
    if (offCanvas) return true;
    try {
      if (typeof wx === "undefined" || typeof wx.createCanvas !== "function") return false;
      offCanvas = wx.createCanvas();          // 第二次调用返回离屏画布
      offCanvas.width = CW;
      offCanvas.height = CH;
      offCtx = offCanvas.getContext("2d");
      return !!(offCtx && offCtx.fillRect);
    } catch (e) { return false; }
  }

  /* 在指定 ctx 上绘制（浏览器测试时可直接传入任意 canvas 的 ctx） */
  G.drawShareCard = (ctx2, W, H, dataOverride) => {
    drawCard(ctx2, W || CW, H || CH, dataOverride || collect("single"));
  };
  G.drawArchiveCard = (ctx2, W, H, dataOverride) => {
    drawCard(ctx2, W || CW, H || CH, dataOverride || collect("archive"));
  };
  G.SHARE_CARD_SIZE = { w: CW, h: CH };

  /* 导出链路（存相册比转发更重要，所以做了三层兜底）：
     ① Canvas.toTempFilePathSync   同步，最快，但开发者工具/部分机型不实现
     ② Canvas.toTempFilePath       官方异步接口，兼容性最好
     ③ toDataURL + writeFileSync   前两者都不可用时的最后兜底
     任一层拿到路径即返回，全失败才给 ""，由调用方弹提示 —— 绝不出现"点了没反应"。 */
  const EXPORT_OPTS = { x: 0, y: 0, width: CW, height: CH, destWidth: CW, destHeight: CH, fileType: "jpg", quality: 0.92 };

  function dataUrlPath() {
    try {
      if (offCanvas && typeof offCanvas.toDataURL === "function"
        && typeof wx !== "undefined" && typeof wx.getFileSystemManager === "function"
        && wx.env && wx.env.USER_DATA_PATH) {
        const url = offCanvas.toDataURL("image/jpeg", 0.92);
        const b64 = String(url || "").replace(/^data:image\/\w+;base64,/, "");
        if (b64.length > 256) {
          const fp = wx.env.USER_DATA_PATH + "/catToyShare.jpg";
          wx.getFileSystemManager().writeFileSync(fp, b64, "base64");
          return fp;
        }
      }
    } catch (e) {
      console.log("[catToy] toDataURL fallback failed", e && e.message);
    }
    return "";
  }

  /* 同步导出：wx.shareAppMessage 的 imageUrl 必须在调用时就有路径，只能用这条 */
  function exportPath() {
    try {
      if (offCanvas && typeof offCanvas.toTempFilePathSync === "function") {
        const p = offCanvas.toTempFilePathSync(EXPORT_OPTS);
        if (p) return p;
      }
    } catch (e) {
      console.log("[catToy] toTempFilePathSync failed", e && e.message);
    }
    return dataUrlPath();
  }

  /* 异步导出：存相册走这条。同步接口不可用时（工具/新机型）还能靠它拿到文件 */
  function exportPathAsync(cb) {
    try {
      if (offCanvas && typeof offCanvas.toTempFilePath === "function") {
        offCanvas.toTempFilePath(Object.assign({}, EXPORT_OPTS, {
          success: (r) => {
            const p = (r && r.tempFilePath) || "";
            cb(p || exportPath());
          },
          fail: (err) => {
            console.log("[catToy] toTempFilePath fail:", (err && (err.errMsg || err)) || "");
            cb(exportPath());
          }
        }));
        return;
      }
    } catch (e) {
      console.log("[catToy] toTempFilePath threw", e && e.message);
    }
    cb(exportPath());
  }

  /* 生成临时图片路径；失败返回 ""。mode: "single" | "archive" */
  G.buildShareCard = (mode) => {
    if (!ensureCanvas()) return "";
    try {
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.clearRect(0, 0, CW, CH);
      drawCard(offCtx, CW, CH, collect(mode));
    } catch (e) {
      console.log("[catToy] draw card failed", e && e.message);
      return "";
    }
    const p = exportPath();
    if (!p) console.log("[catToy] export image failed, path empty");
    return p;
  };

  /* 异步版：存相册用。先画好再走异步导出链，拿到路径回调（可能同步回调，也可能异步） */
  G.buildShareCardAsync = (mode, cb) => {
    if (!ensureCanvas()) { cb(""); return; }
    try {
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.clearRect(0, 0, CW, CH);
      drawCard(offCtx, CW, CH, collect(mode));
    } catch (e) {
      console.log("[catToy] draw card failed", e && e.message);
      cb("");
      return;
    }
    exportPathAsync((p) => {
      if (!p) console.log("[catToy] async export failed, path empty");
      cb(p || "");
    });
  };

  /* 保存到相册。
     ⚠️ 这里不再先调 wx.authorize —— 正式版/隐私指引未过审时它 100% 走 fail，
     而原来的 fail 是空回调，导致点了"存成图片"毫无反应。
     流程：首次弹我们的「允许保存」确认框（只问一次，同意后记到本地存储，以后不再问）；
     之后直接在用户手势里调 saveImageToPhotosAlbum，系统授权框微信自己会弹、且 OS 级会记住。
     只有 errMsg 表明"用户此前拒绝过"时，才引导去设置页。 */
  G.saveShareCard = () => {
    const st = (G.platform && G.platform.storage) || null;
    const OK_KEY = "catToyAlbumOk", DENY_KEY = "catToyAlbumDenied";

    // 提示：优先弹窗，弹窗不可用时退回 toast，再不行至少打日志，保证可感知
    const tip = (content, title) => {
      console.log("[catToy] save tip:", content);
      try {
        if (typeof wx !== "undefined" && typeof wx.showModal === "function") {
          wx.showModal({ title: title || "保存图片", content: content, showCancel: false });
        } else if (typeof wx !== "undefined" && typeof wx.showToast === "function") {
          wx.showToast({ title: content, icon: "none", duration: 2500 });
        }
      } catch (e) {}
    };
    const busy = (on) => {
      try {
        if (typeof wx === "undefined") return;
        if (on) { if (typeof wx.showLoading === "function") wx.showLoading({ title: "正在生成图片", mask: true }); }
        else { if (typeof wx.hideLoading === "function") wx.hideLoading(); }
      } catch (e) {}
    };
    // 友好授权确认框：确认→onConfirm（在用户手势内），取消→静默。无 showModal 时直接走 onConfirm。
    const confirmPopup = (title, content, confirmText, onConfirm, onCancel) => {
      try {
        if (typeof wx !== "undefined" && typeof wx.showModal === "function") {
          wx.showModal({
            title, content, confirmText,
            success: (r) => { if (r && r.confirm) onConfirm(); else if (onCancel) onCancel(); }
          });
        } else {
          onConfirm();
        }
      } catch (e) { onConfirm(); }
    };

    const rememberOk = () => { try { st && st.set(OK_KEY, "1"); } catch (e) {} };

    /* 去系统设置页：开启「保存到相册」后清掉 DENY 标记，用户回来再点一次即可保存。
       openSetting 必须是用户点击直接触发，所以这里放在「去设置」确认框的回调里。 */
    const openSettingPage = () => {
      try {
        if (typeof wx.openSetting !== "function") {
          tip("请在右上角「···」→「设置」里打开「保存到相册」后再试。");
          return;
        }
        wx.openSetting({
          success: (r) => {
            const on = !!(r && r.authSetting && r.authSetting["scope.writePhotosAlbum"]);
            if (on) {
              try { st && st.set(DENY_KEY, "0"); } catch (e) {}
              tip("相册权限已开启，再点一次「存成图片」就能保存。", "已开启");
            }
          },
          fail: () => tip("请在右上角「···」→「设置」里打开「保存到相册」后再试。")
        });
      } catch (e) { tip("请在右上角「···」→「设置」里打开「保存到相册」后再试。"); }
    };
    const guideSetting = () => {
      try {
        if (typeof wx.openSetting === "function" && typeof wx.showModal === "function") {
          wx.showModal({
            title: "需要相册权限",
            content: "开启「保存到相册」后，就能把测评图存进相册发朋友圈。",
            confirmText: "去设置",
            success: (r) => { if (r && r.confirm) openSettingPage(); }
          });
        } else {
          openSettingPage();
        }
      } catch (e) { openSettingPage(); }
    };

    /* 失败提示只保留「原因」部分：errMsg 往往很长，原来截尾会把真正的原因截掉 */
    const brief = (msg) => {
      const m = String(msg || "").replace(/^saveImageToPhotosAlbum:fail\s*/i, "").trim();
      return m.length > 70 ? m.slice(0, 70) + "…" : (m || "未知原因");
    };

    const doSave = (path) => {
      try {
        wx.saveImageToPhotosAlbum({
          filePath: path,
          success: () => {
            busy(false);
            rememberOk();   // 同意（且系统也授权成功）后记住，下次不再弹我们的确认框
            try { wx.showToast({ title: "已存到相册", icon: "success" }); } catch (e) {}
          },
          fail: (err) => {
            const msg = String((err && err.errMsg) || err || "");
            busy(false);
            console.log("[catToy] saveAlbum fail:", msg);
            // 用户主动取消授权弹窗：不打扰
            if (msg.indexOf("cancel") >= 0) return;
            // errno 104 / "privacy permission is not authorized"：
            //   后台《用户隐私保护指引》里「相册（仅写入）」没填/未过审，或用户拒绝过隐私授权
            if (msg.indexOf("privacy") >= 0 || msg.indexOf("104") >= 0) {
              tip("相册权限还没开通：请在微信「设置 → 隐私」里允许本游戏访问相册；若刚提交《隐私保护指引》，等审核通过后再试。", "暂时无法保存");
              return;
            }
            // 拒绝过（auth deny / auth denied）：记住，下次直接引导去设置页，不再弹我们的"允许"框
            if (msg.indexOf("deny") >= 0 || msg.indexOf("refuse") >= 0 || msg.indexOf("unauthor") >= 0) {
              try { st && st.set(DENY_KEY, "1"); } catch (e) {}
              guideSetting();
              return;
            }
            tip("保存失败：" + brief(msg));
          }
        });
      } catch (e) {
        busy(false);
        tip("保存失败，请稍后再试。");
      }
    };

    /* 生成图片 → 保存。用异步导出链，同步接口在工具/部分机型上不可用时也能拿到文件 */
    const prepareAndSave = () => {
      busy(true);
      G.buildShareCardAsync(null, (path) => {
        if (!path) {
          busy(false);
          tip("图片生成失败，请更新微信到最新版后重试。", "无法保存");
          return;
        }
        busy(false);
        doSave(path);
      });
    };

    /* 新增版基础库把「保存到相册」纳入隐私接口：未同意《隐私保护指引》时调用会直接 104 失败。
       先查是否需要授权，需要就走官方授权流程，再继续保存（拒绝则让 save 的真实报错兜底提示）。 */
    const withPrivacy = (fn) => {
      try {
        if (typeof wx.getPrivacySetting === "function" && typeof wx.requirePrivacyAuthorize === "function") {
          wx.getPrivacySetting({
            success: (r) => {
              if (!r || r.needAuthorization === false) { fn(); return; }
              wx.requirePrivacyAuthorize({
                success: () => fn(),
                fail: (err) => {
                  console.log("[catToy] privacy authorize fail:", (err && err.errMsg) || "");
                  fn();
                }
              });
            },
            fail: () => fn()
          });
          return;
        }
      } catch (e) {}
      fn();
    };

    // 已同意过 → 直接保存，不再弹确认框；曾拒绝过系统授权 → 直接引导设置，也不重复问
    let agreed = false, denied = false;
    try { agreed = st && st.get(OK_KEY) === "1"; denied = st && st.get(DENY_KEY) === "1"; } catch (e) {}
    if (agreed) { withPrivacy(prepareAndSave); return; }
    if (denied) { guideSetting(); return; }

    // 首次：先弹我们的友好确认框（不占用 loading），同意后再生成图片
    confirmPopup(
      "保存测评图",
      "把「猫咪反应测评图」存进相册，方便你发朋友圈炫耀～",
      "允许",
      () => withPrivacy(prepareAndSave),
      () => {}   // 暂不允许：本次不保存，下次再点仍会问（没同意就不记）
    );
  };

  /* 轻量埋点。两条链路互不相通，事件必须在对应后台各自建一次：
       · We分析「数据管理 → 上报管理 → 元事件」  → wx.reportEvent(name, data)
       · 老版「统计 → 基础数据 → 自定义分析」    → wx.reportAnalytics(name, data)
     优先 reportEvent（We分析是官方在推的那套，元事件/漏斗/留存都在里面）。
     未建事件时两者都是静默丢弃，不抛错。 */
  G.track = (name, data) => {
    try {
      if (typeof wx === "undefined") return;
      const d = data || {};
      if (typeof wx.reportEvent === "function") { wx.reportEvent(name, d); return; }
      if (typeof wx.reportAnalytics === "function") wx.reportAnalytics(name, d);
    } catch (e) {}
  };
};
