/* ad.js — 微信原生模板广告（wx.createCustomAd）接入层
   ─────────────────────────────────────────────────────────────────────────────
   只服务一个非游戏页面：电子猫粮机（G.screen === "feeder"）。
   对局相关页面（counting / playing / paused / result）与首页、设置、记录、召唤、声音页
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
  let frames = 0;         // 建实例后已渲染帧数
  let timer = null;
  let createdCount = 0;
  let destroyedCount = 0;
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

  const hasApi = () => (typeof wx !== "undefined" && typeof wx.createCustomAd === "function");

  /* 广告位 ID 从 config 读；没填时只在开发期提示一次，不阻断游戏 */
  function adUnitId() {
    const id = String(G.AD_UNIT_ID || "").trim();
    if (!id || /^(请填写|adunit-x+)/i.test(id)) return "";
    return id;
  }

  /* 页面 key → 广告位尺寸提供者：目前只有猫粮机，位置由页面自己的布局算出（见 feeder.js） */
  function rectFor(key) {
    if (key === "feeder" && typeof G.feederAdRect === "function") return G.feederAdRect();
    return null;
  }

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  /* ============ 对外接口 ============ */
  const ad = {
    /* 进入页面：尽早建实例（只建一次，重复调用直接忽略） */
    enter(key, rect) {
      if (page === key && inst) {
        info("enter 忽略：该页面实例已存在", { page: key });
        return inst;
      }
      if (inst) ad.leave("enter-other-page");
      shown = false;
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
      const S = G.platform.S || 1;          // 虚拟坐标 → 物理像素（广告 API 用物理像素）
      style = {
        left: Math.round(r.left * S),
        top: Math.round(r.top * S),
        width: Math.round(r.width * S)
      };

      try {
        inst = wx.createCustomAd({ adUnitId: unit, style });
        createdCount++;
        info("createCustomAd", { page: key, adUnitId: unit, style });
        if (inst && inst.onLoad) inst.onLoad(() => info("onLoad：素材已就绪", { page: key }));
        if (inst && inst.onError) {
          inst.onError(err => {
            errors.last = {
              errCode: err && err.errCode, errMsg: err && err.errMsg,
              page: page, adUnitId: unit, style: style,
              hint: (err && ERR_HINT[err.errCode]) || "未知错误码，请对照流量主后台的广告位状态"
            };
            warn("onError", lastErrorPlain(err));
          });
        }
        if (inst && inst.onClose) inst.onClose(() => { shown = false; info("onClose：用户关闭广告", { page: key }); });

        /* 兜底：即使后面没有任何帧回调，也会在 900ms 后尝试一次 show */
        timer = setTimeout(() => { timer = null; ad.reveal("timeout"); }, REVEAL_TIMEOUT_MS);
      } catch (e) {
        inst = null;
        warn("createCustomAd 抛错", { page: key, message: e && e.message });
      }
      return inst;
    },

    /* 页面每帧渲染完调用一次：累计到 REVEAL_FRAMES 帧即视为"主要内容已完成布局" */
    pageFrame(key) {
      if (!inst || shown || (key && page !== key)) return;
      frames++;
      if (frames >= REVEAL_FRAMES) ad.reveal("frames=" + frames);
    },

    /* 显示：只在实例就绪、页面未切走、且尚未显示时执行一次 */
    reveal(reason) {
      if (!inst) return false;
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
      if (!had) { if (from) info("leave：无实例", { page: from, reason: reason }); return; }
      try { if (had.hide) had.hide(); } catch (e) { warn("hide 抛错", { page: from, message: e && e.message }); }
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
      if (!inst) return;
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
        page: page, shown: shown, created: createdCount, destroyed: destroyedCount,
        frames: frames, style: style, hasApi: hasApi(),
        lastError: errors.last
      };
    }
  };
  function lastErrorPlain(err) {
    return errors.last ? Object.assign({ raw: err && err.errMsg }, errors.last) : { raw: err && err.errMsg };
  }

  G.ad = ad;

  /* 切后台/回前台：小游戏没有页面卸载回调，用 wx.onHide / onShow 兜住 */
  try {
    if (typeof wx !== "undefined" && wx.onHide) wx.onHide(() => ad.suspend());
    if (typeof wx !== "undefined" && wx.onShow) wx.onShow(() => ad.resume());
  } catch (e) { warn("注册 onHide/onShow 失败", { message: e && e.message }); }
};
