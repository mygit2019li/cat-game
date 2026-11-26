/* ad.js — 微信原生模板广告（wx.createCustomAd）接入层
   ─────────────────────────────────────────────────────────────────────────────
   【浮卡原则】广告一律是浮层：只遮挡，绝不参与页面排版。
   任何页面都不许为广告改版式（不推面板、不缩卡片、不留空白带）；放不下就不出。
   位置统一由 ad.fit() 决定（夹安全区 / 避微信胶囊 / 避页面声明的禁区 / 判最小宽），
   页面只报「想把卡放在哪」。要挪位置只改该页的 xxxAdRect()，绘制层一行都不用动。

   按页面 key 区分广告位（七个页面，均只取页面自己的空白/装饰区）：
     feeder  电子猫粮机（G.screen === "feeder"）——机器人/按钮外侧空白带；横屏为右侧竖条
     home    首页（G.screen === "home"）——竖屏猫图区右上角浮一张窄卡，靠右不压猫脸；
             横屏品牌行右侧↔胶囊左侧的顶部横带（浮在面板上沿之上），不碰胶囊与底部按钮。
             冷启动加载屏期间 G.screen 仍是 home，这张横带就是「加载页广告」——
             尺寸纠正（横屏未生效的安卓机）后由 resizeCb 里的 ad.realign 统一拉回贴顶靠右
     result  结算页（G.screen === "result"）——竖屏标题下方窄带；
             横屏左上角「返回键下方 ↔ 数据卡上方」留白，居中标题左侧
     bgpick  选场景页（G.screen === "bgpick"）——仅横屏「贴顶靠右」窄卡；
             上缘贴安全区顶部、右缘止于微信胶囊左侧（与首页横屏同一条基线）；竖屏主卡占满宽度、不出
     sound   猫咪状态 / 动物情绪页（G.screen === "sound"）——仅横屏「标题右侧」空白带
             （tab 行右缘 ↔ 微信胶囊之间，下缘贴网格上沿）；竖屏网格顶到 tab 行，不出
     summon  召唤猫咪（G.screen === "summon"）——仅横屏「卡牌左侧」那半屏留白；
             竖屏卡片已占 68% 屏宽、两侧无留白，不出
     counting 开局倒计时（G.screen === "counting"）——仅横屏「顶部右侧」胶囊下方留白；
             竖屏不出。倒计时是短暂全屏蒙版，广告浮在顶部不干扰中央数字。
   其余对局页（playing / paused）与设置、记录、声音页
   一律不创建实例，避免打断操作。

   生命周期（与页面严格对齐）：
     进入页面   → enter()  立即 createCustomAd（页面生命周期早期），只建一次
     页面首帧后 → pageFrame() 累计两帧（布局已稳定、入场动画已起）再 show()
     离开页面   → leave()  hide + destroy，清空引用；再进入时重新创建
     切后台     → suspend() hide / resume() show，不销毁（避免重复建实例）

   所有调用都包 try/catch，任何异常只打日志、不影响游戏；没有 wx.createCustomAd
   （浏览器测试垫片 / 低版本基础库）时静默跳过。
   ───────────────────────────────────────────────────────────────────────────── */
module.exports = function (G) {
  const TAG = "[ad]";
  /* 首帧之后还需要等几帧才 show：2 帧足够让 0.24s 的入场动效把主内容铺开，
     同时给原生层一个"布局已定"的信号，避免广告盖在还没就位的卡片上。 */
  const REVEAL_FRAMES = 2;
  /* 兜底计时：万一页面没有回调 pageFrame（例如被别的逻辑提前切走），到点也尝试一次 */
  const REVEAL_TIMEOUT_MS = 900;
  /* 广告位最小可用宽度：小于这个值就不展示，宁可空着也不塞一条挤在缝里的广告 */
  const MIN_WIDTH = 120;

  let inst = null;        // 当前 CustomAd 实例（同一时刻最多一个）
  let page = null;        // 实例所属页面 key
  let style = null;       // 实际下发的 { left, top, width }（物理像素）
  let shown = false;
  /* 用户点了广告自带的关闭键：本次挂载到此为止。
     浮卡必须跟着一起消失——不能被后续的 pageFrame / 900ms 兜底再 show 回来。 */
  let closed = false;
  let frames = 0;         // 建实例后已渲染帧数
  let timer = null;
  let createdCount = 0;
  let destroyedCount = 0;
  let interstitial = null;       // 插屏广告实例（提前创建，打开本周记录时 show）
  let interstitialShown = 0;     // 插屏 show 次数（排障用）
  const errors = { last: null };   // 最近一次 onError 的结构化快照（排障用）

  const hasConsole = typeof console !== "undefined" && console.warn;
  const log = (fn, msg, extra) => {
    if (!hasConsole) return;
    try { console[fn](TAG + " " + msg, extra === undefined ? "" : extra); } catch (e) {}
  };
  const info = (msg, extra) => log("log", msg, extra);
  const warn = (msg, extra) => log("warn", msg, extra);

  /* 常见 errCode 的定位提示：日志里直接给出"该去后台查什么"，不用再翻文档 */
  const ERR_HINT = {
    1000: "后端接口调用失败，稍后重试",
    1001: "参数错误：检查 adUnitId 与 style",
    1004: "无合适的广告，属正常情况（当前无填充）",
    1005: "广告组件审核中，先隐藏等待审核通过",
    1008: "广告单元已关闭，检查流量主后台状态",
    1009: "广告单元不存在或未开通，核对广告位 ID",
    1011: "广告单元已被封禁"
  };
  /* 这几个码代表「这次没有内容可播」：位置要让回去，别让首页白留一条带 */
  const NO_CONTENT_CODES = [1004, 1005, 1008, 1009, 1011];

  const hasApi = () => (typeof wx !== "undefined" && typeof wx.createCustomAd === "function");

  /* 广告位 ID 从 config 读；没填时只在开发期提示一次，不阻断游戏 */
  function adUnitId() {
    const id = String(G.AD_UNIT_ID || "").trim();
    if (!id || /^(请填写|adunit-x+)/i.test(id)) return "";
    return id;
  }

  /* 页面 key → 广告位尺寸提供者：位置一律由页面自己的布局算出，绝不硬编码屏幕比例。
     七个页面都只报「想把浮卡放在哪」，再由下面的 fit 统一夹进安全区、避胶囊、判最小宽：
     feeder   → G.feederAdRect()   （feeder.js，机器/按钮外侧空白带）
     home     → G.homeAdRect()     （ui.js，竖屏猫图右上；横屏顶部横带）
     result   → G.resultAdRect()   （ui.js，竖屏标题下方；横屏左上留白）
     bgpick   → G.bgpickAdRect()   （ui.js，横屏贴顶靠右窄卡；竖屏 → 返回 null 不出）
     sound    → G.soundAdRect()    （ui.js，横屏标题右侧空白带；竖屏网格顶到 tab 行 → 不出）
     summon   → G.summonAdRect()   （ui.js，横屏卡牌左侧留白；竖屏两侧无留白 → 返回 null 不出）
     counting → G.countdownAdRect()（ui.js，横屏顶部右侧留白；竖屏 → 返回 null 不出）
     任何页面算不出干净落位时返回 null，ad.enter 会静默跳过，宁缺毋滥。 */
  function rectFor(key) {
    const fn = {
      feeder: G.feederAdRect, home: G.homeAdRect, result: G.resultAdRect,
      bgpick: G.bgpickAdRect, sound: G.soundAdRect, summon: G.summonAdRect,
      counting: G.countdownAdRect
    }[key];
    return (typeof fn === "function") ? fn() : null;
  }

  /* ── 通用浮卡定位器 ───────────────────────────────────────────────────────
     广告一律是浮层：只遮挡，绝不参与页面排版（不推面板、不缩卡片、不预留空白）。
     页面只负责报「想把卡放在哪」，这里统一做四件事：
       ① 夹进安全区（刘海/圆角/底部指示条之内）
       ② 避开微信右上角胶囊
       ③ 避开页面明确声明"不能盖"的区域（按钮、卡片、导航条）
       ④ 宽度不够 MIN_WIDTH 就不出
     候选按顺序尝试，第一个通过的胜出；全都不通过就返回 null（宁缺毋滥）。
     cand: { left, top, width, height }（height 只用于判定能否放下，真实高度由模板决定）
     opts: { pad=8, avoid=[{left,top,width,height}|{left,top,right,bottom}] } */
  const FLOAT_H = 96;      // 页面没给 height 时的估算高度
  function hitRect(a, b) {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  }
  /* 矩形两种写法都认：{left,top,width,height} / {left,top,right,bottom}，
     也接受页面里常见的 {x,y,w,h}（feeder 的 stageRect 就是这种），省掉调用方转换。 */
  function asBox(r) {
    if (!r) return null;
    const left = Number(r.left != null ? r.left : r.x);
    const top = Number(r.top != null ? r.top : r.y);
    const w = r.width != null ? r.width : r.w;
    const h = r.height != null ? r.height : r.h;
    const right = r.right != null ? Number(r.right) : left + Number(w);
    const bottom = r.bottom != null ? Number(r.bottom) : top + (h != null ? Number(h) : FLOAT_H);
    if (![left, top, right, bottom].every(isFinite)) return null;
    if (right <= left || bottom <= top) return null;
    return { left: left, top: top, right: right, bottom: bottom };
  }
  /* 页面坐标（虚拟手机空间）→ 安全区内的可用矩形 */
  function viewportBox() {
    const S = G.platform.S || 1;
    const sr = G.platform.safe || {};
    const mr = G.platform.menu;
    return {
      W: G.platform.W / S, H: G.platform.H / S,
      safe: { left: (sr.left || 0) / S, top: (sr.top || 0) / S, right: (sr.right || 0) / S, bottom: (sr.bottom || 0) / S },
      menu: mr ? { left: mr.left / S, top: mr.top / S, right: (mr.left + mr.width) / S, bottom: (mr.top + mr.height) / S } : null
    };
  }

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  /* ============ 对外接口 ============ */
  const ad = {
    /* 通用浮卡定位器（所有页面共用，见上方说明）。返回 { left, top, width } 或 null */
    fit(cands, opts) {
      const o = opts || {};
      const vp = viewportBox();
      const pad = o.pad == null ? 8 : o.pad;
      const minL = vp.safe.left + pad, maxR = vp.W - vp.safe.right - pad;
      const minT = vp.safe.top + pad, maxB = vp.H - vp.safe.bottom - pad;
      const availW = maxR - minL, availH = maxB - minT;
      if (availW < MIN_WIDTH || availH <= 0) return null;
      const avoid = [].concat(o.avoid || []).map(asBox).filter(Boolean);
      const list = [].concat(cands || []);
      for (let i = 0; i < list.length; i++) {
        const box = asBox(list[i]);
        if (!box) continue;
        const h = box.bottom - box.top;
        /* 比安全区还高的模板放哪都装不下：这一页就不出，宁可空着也不压半屏 */
        if (h > availH) continue;
        /* 宽度是广告素材决定的：只缩到可用宽度，不做等比缩放（否则素材变形） */
        const w = Math.min(box.right - box.left, availW);
        if (w < MIN_WIDTH) continue;
        let left = box.left, top = box.top;
        if (left < minL) left = minL;
        if (left + w > maxR) left = maxR - w;
        if (top < minT) top = minT;
        if (top + h > maxB) top = maxB - h;
        left = Math.round(left); top = Math.round(top);
        let R = { left: left, top: top, right: left + Math.floor(w), bottom: top + h };
        /* 胶囊是唯一"可以让一等"的障碍：先试着把卡挪到它下方（再不行挪到上方），
           挪不动才放弃——右侧竖条类落点（猫粮机横屏）就靠这一步活下来。 */
        if (vp.menu && hitRect(R, vp.menu)) {
          const below = Math.round(vp.menu.bottom + pad);
          const above = Math.round(vp.menu.top - pad - h);
          if (below + h <= maxB) { top = below; }
          else if (above >= minT) { top = above; }
          else continue;
          R = { left: left, top: top, right: R.right, bottom: top + h };
        }
        let blocked = false;
        for (let k = 0; k < avoid.length; k++) if (hitRect(R, avoid[k])) { blocked = true; break; }
        if (blocked) continue;
        return { left: R.left, top: R.top, width: R.right - R.left };
      }
      return null;
    },

    /* 当前可用区域（排障/调试用）：虚拟坐标下的安全区与胶囊 */
    viewport() { return viewportBox(); },

    /* 进入页面：尽早建实例（只建一次，重复调用直接忽略） */
    enter(key, rect) {
      if (page === key && inst) {
        info("enter 忽略：该页面实例已存在", { page: key });
        return inst;
      }
      if (inst) ad.leave("enter-other-page");
      shown = false;
      closed = false;       // 新的一次进页：允许重新加载（用户关掉的只是上一次）
      frames = 0;
      clearTimer();

      /* 先校验再看能否落位：任何一条不满足都直接返回，且不留下 page 标记
         （否则 state() 会误报"该页有实例"，排障时反而被误导） */
      const unit = adUnitId();
      if (!unit) { warn("未配置广告位 ID（G.AD_UNIT_ID），本次不展示", { page: key }); return null; }
      if (!hasApi()) { info("当前环境无 wx.createCustomAd，跳过", { page: key }); return null; }

      const r = rect || rectFor(key);
      if (!r) { warn("缺少广告位矩形，跳过", { page: key }); return null; }
      if (!(r.width >= MIN_WIDTH)) {
        warn("可用宽度不足（<" + MIN_WIDTH + "px），本次不展示", { page: key, rect: r });
        return null;
      }
      page = key;
      /* G.adPage：仅作「当前哪一页挂着广告」的调试标记，绘制层不再依赖它做任何让位
         （旧的首页挤压逻辑已废弃——广告只遮挡，不改版式）。 */
      G.adPage = key;
      const S = G.platform.S || 1;          // 虚拟坐标 → 物理像素（广告 API 用物理像素）
      style = {
        left: Math.round(r.left * S),
        top: Math.round(r.top * S),
        width: Math.round(r.width * S)
      };

      try {
        inst = wx.createCustomAd({ adUnitId: unit, adIntervals: 30, style });
        createdCount++;
        info("createCustomAd", { page: key, adUnitId: unit, style });
        if (inst && inst.onLoad) inst.onLoad(() => info("onLoad：素材已就绪", { page: key }));
        /* 部分模板会在 show 前后回传真实宽高：记下来喂给页面重新算落点。
           浮卡模式没有"预留带"可让步，所以高度若放不进候选区，realign 会因为
           rectFor 返回 null 直接 leave（见 realign）——宁可这条不出，也不压内容。 */
        if (inst && inst.onResize) {
          inst.onResize(size => {
            if (!inst || page !== key) return;
            const w = size && size.width, h = size && size.height;
            if (!(h > 0)) return;
            info("onResize", { page: key, width: w, height: h });
            if (key === "home") G.homeAdMeasuredH = h;
            /* 声音页的高度只用来判断"这条带子放不放得下"，页面里按虚拟坐标算，
               所以这里把物理像素折算回去（onResize 回传的是物理尺寸） */
            if (key === "sound") G.soundAdMeasuredH = Math.round(h / (G.platform.S || 1));
            if (key === "bgpick") G.bgpickAdMeasuredH = Math.round(h / (G.platform.S || 1));
            if (key === "result") G.resultAdMeasuredH = Math.round(h / (G.platform.S || 1));
            ad.realign();
          });
        }
        if (inst && inst.onError) {
          inst.onError(err => {
            errors.last = {
              errCode: err && err.errCode, errMsg: err && err.errMsg,
              page: page, adUnitId: unit, style: style,
              hint: (err && ERR_HINT[err.errCode]) || "未知错误码，请对照流量主后台的广告位状态"
            };
            warn("onError", lastErrorPlain(err));
            /* 无填充 / 审核中 / 单元不可用：这次不会出现内容，把让出去的位置收回来，
               首页不能为一条不存在的广告永久少掉 96px */
            if (err && NO_CONTENT_CODES.indexOf(err.errCode) >= 0) G.adPage = null;
          });
        }
        if (inst && inst.onClose) inst.onClose(() => {
          shown = false;
          closed = true;
          info("onClose：用户关闭广告，浮卡随实例一起销毁", { page: key });
          /* 关键：立刻 hide + destroy。只把 shown 置 false 是不够的——
             页面每帧仍在 pageFrame，下一帧就会把这条广告 show 回来。 */
          ad.leave("closed-by-user");
        });

        /* 兜底：即使后面没有任何帧回调，也会在 900ms 后尝试一次 show */
        timer = setTimeout(() => { timer = null; ad.reveal("timeout"); }, REVEAL_TIMEOUT_MS);
      } catch (e) {
        inst = null;
        G.adPage = null;
        warn("createCustomAd 抛错", { page: key, message: e && e.message });
      }
      return inst;
    },

    /* 版式重新对齐：onResize 回报真实尺寸后回到页面自己的版式重算落点。
       只挪位置不改尺寸（高度由模板决定，left/top 是唯一能调的两个属性）。 */
    realign() {
      if (!inst || !page) return;
      const r = rectFor(page);
      if (!r) { ad.leave("realign:no-rect"); return; }
      const S = G.platform.S || 1;
      style = { left: Math.round(r.left * S), top: Math.round(r.top * S), width: Math.round(r.width * S) };
      try {
        if (inst.style) {
          if (typeof inst.style.left !== "undefined") inst.style.left = style.left;
          if (typeof inst.style.top !== "undefined") inst.style.top = style.top;
        }
      } catch (e) { warn("realign 设置 style 抛错", { page: page, message: e && e.message }); }
    },

    /* 页面每帧渲染完调用一次：累计到 REVEAL_FRAMES 帧即视为"主要内容已完成布局" */
    pageFrame(key) {
      if (!inst || shown || closed || (key && page !== key)) return;
      frames++;
      if (frames >= REVEAL_FRAMES) ad.reveal("frames=" + frames);
    },

    /* 显示：只在实例就绪、页面未切走、且尚未显示时执行一次 */
    reveal(reason) {
      if (!inst) return false;
      /* 用户已经点过关闭：这张浮卡到此为止，兜底 timer / 后台回前台都不许再 show */
      if (closed) { info("show 跳过：用户已关闭", { page }); return false; }
      if (shown) { info("show 跳过：已在展示中", { page }); return true; }
      if (G.screen !== page) {
        warn("show 跳过：页面已切走", { page: page, now: G.screen });
        ad.leave("page-changed");
        return false;
      }
      clearTimer();
      try {
        const ret = inst.show();
        if (ret && typeof ret.catch === "function") {
          ret.catch(e => warn("show 失败", { page: page, errMsg: e && (e.errMsg || e.message), style: style }));
        }
        shown = true;
        info("show", { page: page, reason: reason || "manual", style: style });
        return true;
      } catch (e) {
        warn("show 抛错", { page: page, message: e && e.message });
        return false;
      }
    },

    /* 离开页面：hide + destroy + 清引用，防止实例与原生层资源残留 */
    leave(reason) {
      clearTimer();
      frames = 0;
      const had = inst, from = page, wasShown = shown;
      inst = null; page = null; style = null; shown = false;
      if (G.adPage) G.adPage = null;            // 清掉调试标记
      G.homeAdMeasuredH = 0;                    // 实测高度只在本次挂载内有效
      G.soundAdMeasuredH = 0;
      G.bgpickAdMeasuredH = 0;
      G.resultAdMeasuredH = 0;
      if (!had) { if (from) info("leave：无实例", { page: from, reason: reason }); return; }
      /* 用户点关闭时组件已被系统收起，不必再 hide 一次（只销毁） */
      const userClosed = /closed-by-user/.test(String(reason || ""));
      if (!userClosed) {
        try { if (had.hide) had.hide(); } catch (e) { warn("hide 抛错", { page: from, message: e && e.message }); }
      }
      try { if (had.destroy) had.destroy(); destroyedCount++; } catch (e) { warn("destroy 抛错", { page: from, message: e && e.message }); }
      info("destroy", { page: from, reason: reason || "leave" });
    },

    /* 切后台：只隐藏不销毁，回前台再显示，避免来回重建 */
    suspend() {
      if (!inst || !shown) return;
      try { if (inst.hide) inst.hide(); } catch (e) { warn("suspend hide 抛错", { message: e && e.message }); }
      shown = false;
      info("suspend：切后台隐藏", { page: page });
    },
    resume() {
      if (!inst || closed) return;
      ad.reveal("app-show");
    },

    /* 兜底巡检：主循环每次换代时调一次。任何绕过 switchScreen 的直接 G.screen 赋值
       （历史代码里存在）也能在下一帧把实例销毁，不会残留。 */
    watchdog(screenKey) {
      /* 过渡中点之前 G.screen 还是旧页面，此时 G.nextScreen 已经是新页面——
         不能在这几帧里把刚建好的实例判死，否则每次进页都会"建完立刻销毁"。 */
      if (!page || page === screenKey) return;
      if (typeof G.nextScreen === "string" && G.nextScreen === page) return;
      ad.leave("watchdog:" + screenKey);
    },

    /* 排障用快照（自动化脚本/真机日志都能读） */
    state() {
      return {
        page: page, shown: shown, closed: closed,
        created: createdCount, destroyed: destroyedCount,
        frames: frames, style: style, hasApi: hasApi(), adPage: G.adPage || null,
        measuredH: G.homeAdMeasuredH || 0,
        lastError: errors.last
      };
    },
    /* 插屏广告：提前创建好的实例在这里 show（打开「本周记录」弹窗时调用）。
       与浮卡广告互不干扰：插屏是全屏原生层，不需要 style/定位。
       show() 一次即完，失败（无填充 / 环境不支持）只记日志，绝不影响弹窗打开。 */
    showInterstitial() {
      if (!interstitial) { info("插屏广告：实例未就绪，跳过", {}); return false; }
      try {
        const ret = interstitial.show();
        interstitialShown++;
        if (ret && typeof ret.catch === "function") {
          ret.catch(e => warn("插屏广告显示失败", { errMsg: e && (e.errMsg || e.message) }));
        }
        info("插屏广告 show", { count: interstitialShown });
        return true;
      } catch (e) { warn("插屏广告 show 抛错", { message: e && e.message }); return false; }
    },
    interstitialState() {
      return { ready: !!interstitial, shown: interstitialShown };
    }
  };
  function lastErrorPlain(err) {
    return errors.last ? Object.assign({ raw: err && err.errMsg }, errors.last) : { raw: err && err.errMsg };
  }

  G.ad = ad;
  /* 插屏广告：模块装配时提前创建实例（真机 wx 有 API 才建），等打开「本周记录」再 show。
     创建的时机要早——首次 show 前给原生层留出加载时间。 */
  try {
    const iid = String(G.INTERSTITIAL_AD_UNIT_ID || "").trim();
    if (iid && !/^(请填写|adunit-x+)/i.test(iid) && typeof wx !== "undefined" && wx.createInterstitialAd) {
      interstitial = wx.createInterstitialAd({ adUnitId: iid });
      info("插屏广告实例已创建", { adUnitId: iid });
    }
  } catch (e) { warn("插屏广告实例创建失败", { message: e && e.message }); }
  /* 首页版式用的两个共享量：adPage 表示「该页此刻有可用广告位」（绘制层据此让位），
     homeAdMeasuredH 是 onResize 回来的实测高度（0 表示还没回报，用占位带高） */
  G.adPage = null;
  G.homeAdMeasuredH = 0;
  G.soundAdMeasuredH = 0;
  G.bgpickAdMeasuredH = 0;
  G.resultAdMeasuredH = 0;

  /* 切后台/回前台：小游戏没有页面卸载回调，用 wx.onHide / onShow 兜住 */
  try {
    if (typeof wx !== "undefined" && wx.onHide) wx.onHide(() => ad.suspend());
    if (typeof wx !== "undefined" && wx.onShow) wx.onShow(() => ad.resume());
  } catch (e) { warn("注册 onHide/onShow 失败", { message: e && e.message }); }
};
