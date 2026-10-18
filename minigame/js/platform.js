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
    },
    /* 主动拉起转发面板（好友/群聊） */
    shareApp(opts) {
      try {
        if (typeof wx.shareAppMessage === "function") wx.shareAppMessage(opts || {});
      } catch (e) {}
    },
    /* 初始化被动转发：右上角菜单"转发"使用 defaultShare() 返回的内容 */
    initShare(defaultShare) {
      try {
        if (typeof wx.showShareMenu === "function") wx.showShareMenu({ withShareTicket: false });
        if (typeof wx.onShareAppMessage === "function") {
          wx.onShareAppMessage(() => {
            try { return typeof defaultShare === "function" ? defaultShare() : (defaultShare || {}); }
            catch (e) { return {}; }
          });
        }
      } catch (e) {}
    },
    /* 跳转客服会话：小游戏标准接口 wx.openCustomerServiceConversation
       （需在 mp.weixin.qq.com 后台「客服消息」接入并绑定客服人员，无需 corpId）。
       低版本基础库降级为企业微信「微信客服」（需 G.SUPPORT.corpId），最后回退指引弹窗。
       注意：官方要求用户发生过至少一次 touch 事件后才可调用，按钮点击场景天然满足。 */
    openSupport() {
      const fallback = () => {
        try {
          if (typeof wx.showModal === "function") {
            wx.showModal({
              title: "联系客服",
              content: "当前微信版本较低，暂无法打开客服会话。可点击右上角「···」→「反馈」提交问题，感谢理解。",
              showCancel: false
            });
          }
        } catch (e) {}
      };
      try {
        if (typeof wx.openCustomerServiceConversation === "function") {
          wx.openCustomerServiceConversation({
            sessionFrom: "settings",
            fail: fallback
          });
          return;
        }
        const corpId = G.SUPPORT && G.SUPPORT.corpId;
        if (corpId && typeof wx.openCustomerServiceChat === "function") {
          wx.openCustomerServiceChat({
            extInfo: { url: (G.SUPPORT && G.SUPPORT.url) || "" },
            corpId: corpId,
            fail: fallback
          });
          return;
        }
      } catch (e) {}
      fallback();
    }
  };

  function applySize() {
    canvas.width = P.W * dpr;
    canvas.height = P.H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  /* 大屏适配：以典型手机(390×844)为基准，按屏幕面积等比推算 UI 缩放因子 S，封顶 2.0。
     手机 S≈1 不变；iPad 横屏(1024×768)≈1.55，iPad Pro 12.9≈2.0。UI 在「虚拟手机尺寸」布局后被 ctx.scale(S) 放大。 */
  function computeScale() {
    const base = 390 * 844;
    let s = Math.sqrt((P.W * P.H) / base);
    P.S = Math.max(1, Math.min(2.0, s));
  }
  applySize();
  computeScale();

  wx.onWindowResize && wx.onWindowResize(() => {
    try {
      const s = wx.getSystemInfoSync();
      P.W = s.windowWidth; P.H = s.windowHeight;
      P.safe = computeSafe(s);
      P.menu = getMenu();
      applySize();
      computeScale();
      P.resizeCb.forEach(f => f());
    } catch (e) {}
  });
  wx.onTouchStart && wx.onTouchStart(e => { if (P.onTouchStart) P.onTouchStart(e); });
  wx.onTouchEnd && wx.onTouchEnd(e => { if (P.onTouchEnd) P.onTouchEnd(e); });

  G.platform = P;
};
