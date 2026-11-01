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
    /* 好友关系链授权（scope.WxFriendInteraction）——读好友成绩的前提。
       返回四种状态：
         "ok"          已授权 / 该基础库不需要授权，可以直接 getFriendCloudStorage
         "denied"      用户拒绝过（wx.authorize 不会再弹窗，只能引导去设置）
         "asking"      正在弹窗（本函数同步返回、异步回调，最终只回 ok / denied / unsupported）
         "unsupported" 环境不支持（浏览器垫片、旧基础库）→ 调用方按 ok 处理，直接尝试读取
       注意：曾经拒绝过的 scope，wx.authorize 会直接 fail 不弹窗，所以先用 getSetting 分流。 */
    friendAuth(cb) {
      const done = (s) => { try { cb && cb(s); } catch (e) {} };
      try {
        if (typeof wx === "undefined") return done("unsupported");
        if (typeof wx.getSetting !== "function" || typeof wx.authorize !== "function") return done("unsupported");
        const SCOPE = "scope.WxFriendInteraction";
        wx.getSetting({
          success: (res) => {
            const st = (res && res.authSetting) || {};
            if (st[SCOPE] === true) return done("ok");
            if (st[SCOPE] === false) return done("denied");     // 已拒绝：再 authorize 也没弹窗
            // 从没问过 → 弹一次；拒绝就记为 denied，绝不反复弹
            try {
              wx.authorize({
                scope: SCOPE,
                success: () => done("ok"),
                fail: (err) => {
                  const msg = String((err && err.errMsg) || "");
                  // 老基础库不认识这个 scope：不是用户拒绝，别把锅甩给用户
                  done(/invalid scope|not support|scope/i.test(msg) ? "unsupported" : "denied");
                }
              });
            } catch (e) { done("unsupported"); }
          },
          fail: () => done("unsupported")
        });
      } catch (e) { done("unsupported"); }
    },
    /* 引导去设置页开权限（必须在用户点击的同一手势里调用）。complete 后回读一次授权状态 */
    openFriendSetting(cb) {
      let called = false;
      const run = () => { if (called) return; called = true; if (cb) cb(); };
      try {
        if (typeof wx.openSetting !== "function") { run(); return; }
        wx.openSetting({ success: run, fail: run, complete: run });
      } catch (e) { run(); }
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
        // dataURL / 绝对路径（自定义召唤图存到 USER_DATA_PATH）不能再拼 ../
        const abs = /^(?:data:|blob:|https?:|\/|wxfile:\/\/)/i.test(src);
        img.src = inWx || abs ? src : "../" + src;
        P.assets[src] = img;
        return img;
      } catch (e) { return null; }
    },
    audioCtx() {
      try { return wx.createWebAudioContext(); } catch (e) { return null; }   // 基础库 <2.19 时静默降级
    },
    /* 短音效文件（真实录音 mp3）：wx 用 InnerAudioContext，浏览器垫片用 <audio>。
       同一路径复用实例——微信同时存在的 InnerAudioContext 上限约 10 个，反复 create 会泄漏；
       触发时先 stop/seek(0) 再 play，保证连点时能从头重放。
       返回 true 表示环境支持并已发起播放；false 表示不可用（调用方回退合成音）。 */
    sfxPool: {},
    _sfxCreate(src) {
      const inWx = typeof wx !== "undefined" && typeof wx.createInnerAudioContext === "function";
      if (inWx) {
        const a = wx.createInnerAudioContext();
        a.src = src;
        if (typeof a.onError === "function") a.onError(() => { a._bad = true; });
        return a;
      }
      if (typeof Audio !== "undefined") {
        // 浏览器垫片页面在 test/ 下，包内相对路径要补 ../
        const abs = /^(?:data:|blob:|https?:|\/|wxfile:\/\/)/i.test(src);
        const a = new Audio(abs || typeof location === "undefined" ? src : "../" + src);
        if (typeof a.addEventListener === "function") a.addEventListener("error", () => { a._bad = true; });
        return a;
      }
      return null;
    },
    sfx(src, vol) {
      if (!src) return false;
      try {
        let a = P.sfxPool[src];
        if (!a) {
          a = P._sfxCreate(src);
          if (!a) return false;
          P.sfxPool[src] = a;
        }
        if (a._bad) return false;
        a.volume = vol == null ? 0.55 : vol;
        try { if (typeof a.stop === "function") a.stop(); } catch (e) {}
        try { if (typeof a.seek === "function") a.seek(0); } catch (e) {}
        try { a.currentTime = 0; } catch (e) {}
        const r = a.play();
        if (r && typeof r.catch === "function") r.catch(() => {});
        return true;
      } catch (e) { return false; }
    },
    /* 预取：进入玩法时先把音频实例建好，首次触发就不用等下载 */
    preloadSfx(src) {
      if (!src) return;
      try { if (!P.sfxPool[src]) P.sfxPool[src] = P._sfxCreate(src); } catch (e) {}
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
    },

    /* ================= 自定义召唤素材：文本 / 图片 / 音频 =================
       真机：小游戏没有输入框组件，文本靠 wx.showKeyboard 弹系统键盘，把 onKeyboardInput
       的实时值回填到自绘的行里；图片按渠道走 chooseMedia(sourceType) 或
       chooseMessageFile(type=image)，音频按渠道走录音 / chooseMessageFile；选回来的都是
       临时路径，重启就没了，所以统一由 saveAsset 复制进 USER_DATA_PATH 才算“保存在本地”。
       浏览器垫片没这些 API：文本回落到 prompt，文件类渠道回落到 <input type=file> +
       FileReader（拿到 dataURL，给 Image / Audio 都能直接用，不必再落盘），录音回落到
       getUserMedia + MediaRecorder。 */
    promptText(title, def, cb) {
      let done = false;
      const finish = (v) => { if (done) return; done = true; try { cb(v); } catch ( e) {} };
      try {
        if (typeof wx !== "undefined" && typeof wx.showKeyboard === "function") {
          let val = def || "";
          const onInput = (r) => { if (r && r.value != null) val = r.value; };
          const onComplete = (r) => {
            if (r && r.value != null) val = r.value;
            try { wx.offKeyboardComplete && wx.offKeyboardComplete(onComplete); } catch (e) {}
            try { wx.offKeyboardInput && wx.offKeyboardInput(onInput); } catch (e) {}
            try { wx.hideKeyboard({}); } catch (e) {}
            finish(val);
          };
          try { wx.onKeyboardInput && wx.onKeyboardInput(onInput); } catch (e) {}
          try { wx.onKeyboardComplete && wx.onKeyboardComplete(onComplete); } catch (e) {}
          wx.showKeyboard({ defaultValue: val, maxLength: 12, multiple: false, confirmHold: false, confirmType: "done" });
          return;
        }
      } catch (e) {}
      try {
        if (typeof window !== "undefined" && typeof window.prompt === "function") {
          finish(window.prompt(title, def || ""));
          return;
        }
      } catch (e) {}
      finish("");
    },
    /* 素材来源渠道（录入面板里先选渠道，再调对应的 API，跟用户点“照片 App”的习惯一致）：
         image: album(相册) / chat(微信聊天) / camera(拍照)
         audio: record(现场录音) / chat(微信聊天) / file(文件，电脑端微信会直接开系统文件框)
       cb(path, why)：拿到时 why 为空；拿不到时 why =
         cancel(用户取消) | unsupported(基础库太低) | badtype(选的东西类型不对) | denied(麦克风权限)
       source 省略时按各类型的默认渠道走（老调用方不用改）。 */
    pickAsset(kind, source, cb) {
      if (typeof source === "function") { cb = source; source = ""; }
      const isAudio = kind === "audio";
      const src = source || (isAudio ? "chat" : "album");
      const AUDIO_EXT = ["mp3", "m4a", "aac", "wav", "ogg", "amr"];
      let done = false;
      const finish = (v, why) => { if (done) return; done = true; try { cb(v || "", v ? "" : (why || "cancel")); } catch ( e) {} };
      const isAudioFile = (p) => !p || new RegExp("\\.(" + AUDIO_EXT.join("|") + ")$", "i").test(p);
      try {
        /* 现场录音不是“选一下”就能拿到路径的，得有个 start/stop 过程，
           所以真正的入口在 recordAsset；这里只是给直接调 pickAsset 的写法兜个底 */
        if (isAudio && src === "record") {
          const h = P.recordAsset({
            onDone: (p) => finish(p),
            onFail: (why) => finish("", why)
          });
          if (h) return;
          finish("", "unsupported");
          return;
        }
      } catch (e) {}
      try {
        /* 聊天/文件都走 chooseMessageFile（小游戏里这是唯一能拿到任意文件的口子，要 2.23.0+）：
           “从聊天选音频”用 type=file + 后缀过滤，系统直接挡掉非音频；
           “从文件选”用 type=all（电脑端这才是真正的系统文件选择器），拿到路径后自己验后缀 */
        if (isAudio && (src === "chat" || src === "file") && typeof wx.chooseMessageFile === "function") {
          const opt = { count: 1, type: src === "chat" ? "file" : "all" };
          if (src === "chat") opt.extension = AUDIO_EXT;
          opt.success = r => {
            const p = ((r.tempFiles || [])[0] || {}).path || "";
            if (src === "file" && !isAudioFile(p)) { finish("", "badtype"); return; }
            finish(p);
          };
          opt.fail = () => finish("", "cancel");
          wx.chooseMessageFile(opt);
          return;
        }
        if (!isAudio && src === "chat" && typeof wx.chooseMessageFile === "function") {
          wx.chooseMessageFile({
            count: 1, type: "image",
            success: r => finish(((r.tempFiles || [])[0] || {}).path),
            fail: () => finish("", "cancel")
          });
          return;
        }
        const st = [src === "camera" ? "camera" : "album"];
        if (!isAudio && typeof wx.chooseMedia === "function") {
          wx.chooseMedia({
            count: 1, mediaType: ["image"], sourceType: st, sizeType: ["compressed"],
            success: r => finish(((r.tempFiles || [])[0] || {}).tempFilePath),
            fail: () => finish("", "cancel")
          });
          return;
        }
        if (!isAudio && typeof wx.chooseImage === "function") {
          wx.chooseImage({
            count: 1, sizeType: ["compressed"], sourceType: st,
            success: r => finish((r.tempFilePaths || [])[0]),
            fail: () => finish("", "cancel")
          });
          return;
        }
      } catch (e) { /* 落到下面的网页回落 */ }
      try {
        /* 浏览器测试环境：拍照补个 capture 属性，其余一律文件框（拿到 dataURL 自包含，不必落盘） */
        if (typeof document !== "undefined" && document.createElement) {
          const el = document.createElement("input");
          el.type = "file";
          el.accept = isAudio ? "audio/*" : "image/*";
          if (!isAudio && src === "camera") el.capture = "environment";
          el.onchange = () => {
            const f = el.files && el.files[0];
            if (!f) { finish("", "cancel"); return; }
            const fr = new FileReader();
            fr.onload = () => finish(String(fr.result || ""));
            fr.onerror = () => finish("", "cancel");
            fr.readAsDataURL(f);
          };
          el.click();
          return;
        }
      } catch (e) {}
      finish("", "unsupported");
    },
    /* 现场录音（自定义召唤音：录猫叫 / 录摇粮桶的声音）。
       真机走 RecorderManager（format=mp3，16k 单声道，到 duration 自动停），浏览器走
       getUserMedia + MediaRecorder。录音产物是临时路径 / blob，靠 saveAsset 落盘才能抗重启。
       hooks: { onStart(), onDone(path), onFail(why, msg) }；why = cancel | denied | interrupted
       返回句柄 { stop(), cancel() }；当前环境根本没录音能力时返回 null（调用方据此提示）。
       注意：录音会抢麦克风，小游戏里内层音频会被干掉，调用前先把召唤 BGM 停下。 */
    recordAsset(hooks, maxMs) {
      hooks = hooks || {};
      const limit = Math.max(2000, Math.min(60000, maxMs || 15000));
      let fin = false, timer = 0, rec = null, stream = null, mr = null, chunks = [];
      const release = () => {
        try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
        stream = null;
      };
      const bail = (why, msg) => {
        if (fin) return;
        fin = true; clearTimeout(timer); release();
        try { hooks.onFail(why, msg || ""); } catch (e) {}
      };
      const take = (p) => {
        if (fin) return;
        fin = true; clearTimeout(timer); release();
        try { p ? hooks.onDone(p) : hooks.onFail("cancel", ""); } catch (e) {}
      };
      try {
        if (typeof wx !== "undefined" && typeof wx.getRecorderManager === "function") {
          rec = wx.getRecorderManager();
          if (rec.onStart) rec.onStart(() => { try { hooks.onStart && hooks.onStart(); } catch (e) {} });
          if (rec.onStop) rec.onStop((r) => take((r && r.tempFilePath) || ""));
          if (rec.onError) rec.onError((r) => bail(/deny|auth|permission/i.test((r && r.errMsg) || "") ? "denied" : "interrupted", (r && r.errMsg) || ""));
          rec.start({ duration: limit, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 96000, format: "mp3" });
          /* duration 到点微信自己会停并回调 onStop，这里只是万一它没回调时兜个底 */
          timer = setTimeout(() => take(""), limit + 1500);
          return {
            stop() { if (fin) return; try { rec.stop(); } catch (e) { bail("cancel", ""); } },
            /* 作废也要先把机器停下来，不然只是不再接结果、麦克风还开着 */
            cancel() { if (!fin) { try { rec.stop(); } catch (e) {} } take(""); }
          };
        }
      } catch (e) {}
      try {
        const md = typeof navigator !== "undefined" && navigator.mediaDevices;
        if (md && md.getUserMedia && typeof window !== "undefined" && window.MediaRecorder) {
          md.getUserMedia({ audio: true }).then((s) => {
            stream = s;
            mr = new window.MediaRecorder(s);
            mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
            mr.onstop = () => {
              const type = (mr.mimeType || "audio/webm").split(";")[0];
              take(URL.createObjectURL(new window.Blob(chunks, { type: type })));
              chunks = [];
            };
            mr.start();
            try { hooks.onStart && hooks.onStart(); } catch (e) {}
            timer = setTimeout(() => { try { mr.stop(); } catch (e) { take(""); } }, limit);
          }).catch((err) => bail(err && err.name === "NotAllowedError" ? "denied" : "interrupted", (err && err.name) || ""));
          return {
            /* start 是异步的：麦克风还没拿到就点停，直接作废这一次 */
            stop() { if (fin) return; if (!mr) { take(""); return; } try { mr.stop(); } catch (e) { take(""); } },
            cancel() {
              if (!fin && mr) { try { mr.stop(); } catch (e) {} }
              take("");
            }
          };
        }
      } catch (e) {}
      return null;
    },
    /* 把选中的临时文件复制进 USER_DATA_PATH，返回可长期用的路径；
       浏览器垫片刻不出 USER_DATA_PATH（dataURL 本身就能直接当 src）时原样返回 */
    saveAsset(src, name) {
      if (!src) return "";
      try {
        const dir = (wx.env && wx.env.USER_DATA_PATH) || "";
        const fs = typeof wx.getFileSystemManager === "function" ? wx.getFileSystemManager() : null;
        if (!fs || !dir || /^(?:data:|blob:|https?:)/i.test(src)) return src;
        const to = dir + "/" + name;
        if (src === to) return to;
        fs.copyFileSync(src, to);
        return to;
      } catch (e) { return src; }
    },
    /* 只能删自己存进去的素材（按文件名），防止误删包内资源 */
    removeAsset(path) {
      try {
        const dir = (wx.env && wx.env.USER_DATA_PATH) || "";
        const fs = typeof wx.getFileSystemManager === "function" ? wx.getFileSystemManager() : null;
        if (!fs || !dir || !path || path.indexOf(dir + "/") !== 0) return false;
        fs.unlinkSync(path);
        return true;
      } catch (e) { return false; }
    },
    /* 试听一段本地音频（自定义卡保存前先听一下）；返回一个 stop() */
    previewAsset(path) {
      if (!path) return null;
      try {
        if (typeof wx !== "undefined" && wx.createInnerAudioContext) {
          const a = wx.createInnerAudioContext();
          a.src = path; a.volume = 1;
          a.onError = () => { try { a.destroy(); } catch (e) {} };
          a.play();
          return { stop() { try { a.stop(); a.destroy(); } catch (e) {} } };
        }
        if (typeof window !== "undefined" && window.Audio) {
          const a = new window.Audio(path);
          a.play().catch(() => {});
          return { stop() { try { a.pause(); a.currentTime = 0; } catch (e) {} } };
        }
      } catch (e) {}
      return null;
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
