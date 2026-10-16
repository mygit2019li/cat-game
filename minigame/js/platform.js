/* platform.js — 平台层：屏蔽小游戏与浏览器测试垫片的差异
   （画布 / 系统信息 / 触控 / 存储 / 震动 / 屏幕常亮 / 音频上下文） */
module.exports = function (G) {
  // 微信小游戏运行时不一定自带 performance，这里做一个极简 polyfill
  if (typeof performance === "undefined" || !performance.now) {
    const start = Date.now();
    const perf = { now: () => Date.now() - start };
    try { (typeof globalThis !== "undefined" ? globalThis : GameGlobal).performance = perf; } catch (e) {}
  }
  const sys = wx.getSystemInfoSync();
  const dpr = Math.min(sys.pixelRatio || 2, 2);
  const canvas = wx.createCanvas();          // 首次调用返回上屏画布
  const ctx = canvas.getContext("2d");

  function computeSafe(s) {
    const area = s.safeArea || { left: 0, top: 0, right: s.windowWidth, bottom: s.windowHeight };
    const left = Math.max(0, area.left);
    const top = Math.max(0, area.top);
    const right = Math.max(0, s.windowWidth - area.right);
    const bottom = Math.max(0, s.windowHeight - area.bottom);
    return { left, top, right, bottom };
  }
  const safe = computeSafe(sys);

  // 右上角胶囊按钮（退出/更多）矩形：悬浮于画布之上，游戏内 UI 必须避开
  function getMenu() {
    try {
      if (typeof wx.getMenuButtonBoundingClientRect === "function") {
        const r = wx.getMenuButtonBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) return r;
      }
    } catch (e) {}
    return null;
  }

  const P = {
    canvas, ctx, dpr,
    W: sys.windowWidth, H: sys.windowHeight,
    safe,
    menu: getMenu(),
    resizeCb: [],
    onTouchStart: null, onTouchEnd: null,
    storage: {
      get(key) {
        try { return wx.getStorageSync(key); } catch (e) { return ""; }
      },
      set(key, val) {
        try { wx.setStorageSync(key, val); } catch (e) {}
      }
    },
    vibrate() {
      if (!G.config || G.config.vibrate) { try { wx.vibrateShort({ type: "light" }); } catch (e) {} }
    },
    vibrateHeavy() {
      if (!G.config || G.config.vibrate) { try { wx.vibrateShort({ type: "heavy" }); } catch (e) {} }
    },
    keepScreen(on) { try { wx.setKeepScreenOn({ keepScreenOn: !!on }); } catch (e) {} },
    /* 好友排行榜：把单局最高捕获写入关系链 KV（仅开放数据域可读） */
    reportBest(v) {
      try {
        wx.setUserCloudStorage({ KVDataList: [{ key: "bestHits", value: String(Math.max(0, Math.floor(Number(v) || 0))) }] });
      } catch (e) {}
    },
    /* 向开放数据域发消息（show/hide/refresh） */
    odcPost(msg) {
      try {
        if (typeof wx.getOpenDataContext === "function") wx.getOpenDataContext().postMessage(msg);
      } catch (e) {}
    },
    audioCtx() {
      try { return wx.createWebAudioContext(); } catch (e) { return null; }   // 基础库 <2.19 时静默降级
    }
  };

  function applySize() {
    canvas.width = P.W * dpr;
    canvas.height = P.H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  applySize();

  wx.onWindowResize && wx.onWindowResize(() => {
    try {
      const s = wx.getSystemInfoSync();
      P.W = s.windowWidth; P.H = s.windowHeight;
      P.safe = computeSafe(s);
      P.menu = getMenu();
      applySize();
      P.resizeCb.forEach(f => f());
    } catch (e) {}
  });
  wx.onTouchStart && wx.onTouchStart(e => { if (P.onTouchStart) P.onTouchStart(e); });
  wx.onTouchEnd && wx.onTouchEnd(e => { if (P.onTouchEnd) P.onTouchEnd(e); });

  G.platform = P;
};
