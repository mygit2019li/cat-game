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
    const W = s.windowWidth || 0, H = s.windowHeight || 0;
    const area = s.safeArea || { left: 0, top: 0, right: W, bottom: H };
    let left = area.left, top = area.top, right = W - area.right, bottom = H - area.bottom;

    /* 坐标系一致性归一：部分机型（尤其 iOS 横屏锁定 + 从后台切回 onShow）回传的是【竖屏坐标系】的
       safeArea —— top≈状态栏高(47)、right≈竖屏屏宽，但 windowWidth/Height 已是横屏。
       直接用会导致「重新进入小程序后首页整体被靠下」（所有界面的顶部基准都是 safe.top），
       且左右 inset 也不对。
       判据：横屏(W≥H)下可见区宽度 saW 应接近屏宽 W；若 saW 更接近屏高 H（说明 safeArea 是
       竖屏坐标套在横屏屏上），按右转 90° 旋转到横屏：
         竖屏 top(刘海) → 横屏 right(灵动岛)，竖屏 bottom(底条) → 横屏 left，
         竖屏 left/right → 横屏 bottom/top。 */
    const saW = area.right - area.left;
    if (W >= H && saW > 0 && Math.abs(saW - W) > W * 0.3 && Math.abs(saW - H) <= H * 0.5) {
      const vL = area.left, vT = area.top;
      const vR = Math.max(0, H - area.right), vB = Math.max(0, W - area.bottom);
      left = Math.max(0, vB); top = Math.max(0, vR);
      right = Math.max(0, vT); bottom = Math.max(0, vL);
    }

    /* 阈值兜底：任何边超过屏宽/高 25% 视为脏值清零（防极端机型；横屏下刘海/圆角物理不可能超此值） */
    if (left > W * 0.25) left = 0;
    if (right > W * 0.25) right = 0;
    if (top > H * 0.25) top = 0;
    if (bottom > H * 0.25) bottom = 0;
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

  /* 胶囊矩形归一：部分机型（iOS 横竖屏切换后 / 安卓冷启动瞬间）回传的是【竖屏坐标系】的
     胶囊位置（与上面 safeArea 同款问题）——横屏下 menu.left 只有 300 左右（贴在"左侧"），
     drawHud 按它计算暂停按钮位置会误触发"极窄屏降级"，把暂停甩到胶囊下方、与倒计时不同行。
     校验：胶囊必须贴在右上角区域（横屏 right≥0.7W 且纵向不超过 0.45H；竖屏 bottom≤0.3H），
     不合规矩按标准边距重建（宽 87 高 32、右距 7；横屏顶距 4，竖屏顶距状态栏+4）。 */
  function normalizeMenu(r, W, H, safe) {
    if (!r || !(r.width > 0) || !(r.height > 0)) return null;
    const land = W >= H;
    const okLand = land && r.right >= W * 0.7 && r.top >= 0 && r.top <= H * 0.3 && r.bottom <= H * 0.45;
    const okPort = !land && r.right >= W * 0.7 && r.top >= 0 && r.top <= H * 0.2 && r.bottom <= H * 0.3;
    if (okLand || okPort) return r;
    const top = land ? 4 : Math.max(4, (safe ? safe.top : 0) + 4);
    return { left: W - 94, right: W - 7, top, bottom: top + 32, width: 87, height: 32 };
  }

  const P = {
    canvas, ctx, dpr,
    W: sys.windowWidth, H: sys.windowHeight,
    safe,
    menu: normalizeMenu(getMenu(), sys.windowWidth, sys.windowHeight, safe),
    resizeCb: [],
    onTouchStart: null, onTouchEnd: null, onTouchMove: null,
    storage: {
      get(key) {
        try { return wx.getStorageSync(key); } catch (e) { return ""; }
      },
      set(key, val) {
        try { wx.setStorageSync(key, val); } catch (e) {}
      }
    },
    /* 冷启动参数：scene 是微信的场景值（1001 发现栏 / 1005 搜索 / 1007 会话 /
       1008 群聊 / 1011 扫码 / 1044 分享卡片 …），query 是我们自己拼的 from 参数。
       埋点靠这两个判断"用户从哪来"。 */
    launch: (() => {
      try {
        const o = (typeof wx.getLaunchOptionsSync === "function") ? wx.getLaunchOptionsSync() : null;
        return { scene: Number(o && o.scene) || 0, query: (o && o.query) || {} };
      } catch (e) { return { scene: 0, query: {} }; }
    })(),
    showCb: [], hideCb: [],
    vibrate() {
      if (!G.config || G.config.vibrate) { try { wx.vibrateShort({ type: "light" }); } catch (e) {} }
    },
    vibrateHeavy() {
      if (!G.config || G.config.vibrate) { try { wx.vibrateShort({ type: "heavy" }); } catch (e) {} }
    },
    keepScreen(on) { try { wx.setKeepScreenOn({ keepScreenOn: !!on }); } catch (e) {} },
    /* 防误触引导：首次进入游戏弹一次，教用户开启系统级防误触（微信内无法拦截系统手势，
       只能靠 iOS 引导式访问 / 安卓防误触模式）。done 回调里继续开始游戏（弹窗期间不倒计时）。 */
    antiGuide(done) {
      const run = () => { try { done && done(); } catch (e) {} };
      try {
        if (typeof wx.showModal !== "function") { run(); return; }
        const lines = [
          "猫玩时容易误拍到屏幕边缘，把游戏退出来。建议先开启手机防误触：",
          "· iPhone：设置 → 辅助功能 → 引导式访问，开启后进入游戏连按三次侧边/Home 键即可锁定当前界面，猫怎么拍都不会退出。",
          "· 安卓：设置 → 辅助功能 → 防误触 / 手套模式（或「数字健康」→ 专注模式）。"
        ];
        if (this.keepScreen) lines.push("已为你开启屏幕常亮，猫玩多久都不会自动锁屏。");
        wx.showModal({
          title: "开启防误触，猫玩更尽兴",
          content: lines.join("\n"),
          showCancel: false, confirmText: "知道了",
          success: run, fail: run
        });
      } catch (e) { run(); }
    },
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
    /* 资源图缓存：loadImage(src) 异步加载并存入 assets[src]（onload 后可直接 drawImage） */
    assets: {},
    loadImage(src) {
      if (!src) return null;
      if (P.assets[src]) return P.assets[src];
      try {
        // 真机 wx 环境用相对包内路径；浏览器垫片（harness 页面在 test/ 下）回退 ../ 前缀
        const inWx = typeof wx !== "undefined" && wx.createImage;
        const img = inWx ? wx.createImage() : new Image();
        img.ok = false;
        img.onload = () => { img.ok = true; };
        img.onerror = () => { img.ok = false; };
        img.src = inWx ? src : "../" + src;
        P.assets[src] = img;
        return img;
      } catch (e) { return null; }
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
      P.menu = normalizeMenu(getMenu(), P.W, P.H, P.safe);
      applySize();
      computeScale();
      P.resizeCb.forEach(f => f());
    } catch (e) {}
  });
  wx.onTouchStart && wx.onTouchStart(e => { if (P.onTouchStart) P.onTouchStart(e); });
  wx.onTouchMove && wx.onTouchMove(e => { if (P.onTouchMove) P.onTouchMove(e); });
  wx.onTouchEnd && wx.onTouchEnd(e => { if (P.onTouchEnd) P.onTouchEnd(e); });
  /* 前后台切换钩子：业务侧用来自动暂停、补埋点 */
  wx.onHide && wx.onHide(() => { P.hideCb.forEach(f => { try { f(); } catch (e) {} }); });
  wx.onShow && wx.onShow(res => {
    /* 回前台时重读系统信息：部分安卓机冷启动瞬间横屏尚未生效，safeArea/窗口尺寸是按
       竖屏算的，等切横屏稳定后才会给对。这里对比变化后再应用，避免每次 onShow 都清屏。 */
    try {
      const s = wx.getSystemInfoSync();
      const ns = computeSafe(s);
      const changed = s.windowWidth !== P.W || s.windowHeight !== P.H ||
        ["left", "top", "right", "bottom"].some(k => ns[k] !== P.safe[k]);
      if (changed) {
        P.W = s.windowWidth; P.H = s.windowHeight;
        P.safe = ns; P.menu = normalizeMenu(getMenu(), P.W, P.H, ns);
        applySize(); computeScale();
        P.resizeCb.forEach(f => { try { f(); } catch (e) {} });
      }
    } catch (e) {}
    P.showCb.forEach(f => { try { f(res); } catch (e) {} });
  });

  G.platform = P;
};
