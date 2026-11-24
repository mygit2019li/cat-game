/* frames.js — 序列帧动画播放器（接入 Cocos Creator 导出的 PNG 序列帧 / sprite sheet）
 *
 * 用途：Cocos Creator 里用「动画编辑器关键帧」做的角色动画，无法在原生微信小游戏里直接播放
 *       （.anim 依赖 Cocos 运行时）。正路是：Cocos 把动画逐帧烘焙/批量导出成 PNG 序列帧，
 *       拼成 sprite sheet，再交给本模块加载并按时间切帧绘制。现有 draw.js 程序化绘制保留作降级兜底。
 *
 * 资源约定（放在 assets/frames/ 下）：
 *   - 每段动画一张 sheet：mouse_run.png、mouse_peek.png、mouse_pause.png
 *   - 一段 manifest：frames.json，描述每段的帧数 / 帧率 / 原点对齐锚点 / 朝向。
 *     示例结构：
 *     {
 *       "mouse": {
 *         "design": { "w": 120, "h": 78 },            // 与 draw.mouse 设计空间一致（中心对齐）
 *         "clips": {
 *           "run":   { "file": "frames/mouse_run.png",   "frames": 8,  "fps": 12, "loop": true  },
 *           "peek":  { "file": "frames/mouse_peek.png",  "frames": 6,  "fps": 8,  "loop": false },
 *           "pause": { "file": "frames/mouse_pause.png", "frames": 4,  "fps": 6,  "loop": true  }
 *         }
 *       }
 *     }
 *   - sheet 为「横向单行 N 帧」拼接（Cocos 批量导出 PNG 后，用 ImageMagick 或工具拼成一行即可）：
 *       magick mouse_run_0001.png mouse_run_0002.png ... +append mouse_run.png
 *     每帧尺寸 = design.w × design.h，锚点取帧中心（与现有 translate(-60,-39) 对齐）。
 *
 * 平台：微信小游戏用 wx.createImage + wx.getFileSystemManager 读本地文件；浏览器测试垫片用
 *       document.createElement('canvas')/new Image。本模块只依赖 G.platform 暴露的 createImage、
 *       以及 G 上挂的 framesBasePath（可选）。
 */
module.exports = function (G) {
  // 帧动画注册表：roleKey → { design, clips:{ name → { frames, fps, loop, sheetImg, frameW, frameH, ready } } }
  G.frames = {
    _reg: {},
    _loading: {},

    /* 读取 manifest 并初始化所有段的元数据（不立刻下载图，懒加载）。
       支持多视角注册表：json 下每个 key（如 side / top）是一个 roleKey 注册表。
       只登记「尚未就绪」的 clip 的默认态，不覆盖已加载好的 _img/ready（便于测试注入与热更新）。 */
    loadManifest(json) {
      if (!json) return;
      for (const roleKey in json) {
        const m = json[roleKey];
        if (!m || !m.clips) continue;
        // 已有同名注册表时合并（保留已加载的 _img/ready），否则新建
        if (!this._reg[roleKey]) this._reg[roleKey] = { design: m.design || { w: 120, h: 78 }, clips: {} };
        this._reg[roleKey].design = m.design || this._reg[roleKey].design;
        for (const name in m.clips) {
          if (!this._reg[roleKey].clips[name]) this._reg[roleKey].clips[name] = m.clips[name];
          else Object.assign(this._reg[roleKey].clips[name], m.clips[name]);
          const c = this._reg[roleKey].clips[name];
          if (!c.ready) { c.ready = false; c._img = null; }
        }
      }
    },

    /* 确保某段 clip 的 sheet 已加载并切好帧。resolve(clip) 回调。 */
    ensure(roleKey, clipName, cb) {
      const reg = this._reg[roleKey];
      if (!reg) return cb && cb(null);
      const clip = reg.clips[clipName];
      if (!clip) return cb && cb(null);
      if (clip.ready) return cb && cb(clip);

      const self = this;
      if (self._loading[roleKey + ":" + clipName]) {
        // 已在加载，等它完成
        const wait = setInterval(function () {
          if (self._reg[roleKey] && self._reg[roleKey].clips[clipName].ready) {
            clearInterval(wait); cb && cb(self._reg[roleKey].clips[clipName]);
          }
        }, 50);
        return;
      }
      self._loading[roleKey + ":" + clipName] = true;

      const img = G.platform.loadImage(clip.file);   // 复用平台层（已处理 wx/浏览器路径差异）
      if (!img) { self._loading[roleKey + ":" + clipName] = false; clip.ready = false; return cb && cb(null); }
      const finish = function () {
        if (self._loading[roleKey + ":" + clipName] === false) return;
        const ok = img.ok === true;
        if (ok) {
          try {
            const dw = reg.design.w, dh = reg.design.h;
            clip._img = img;
            clip.frameW = dw; clip.frameH = dh;
            clip.frameCount = clip.frames || 1;
            clip.ready = true;
          } catch (e) { clip.ready = false; }
        } else {
          clip.ready = false;   // 加载失败 → 上层回退程序化绘制
        }
        self._loading[roleKey + ":" + clipName] = false;
        cb && cb(clip && clip.ready ? clip : null);
      };
      if (img.ok === true) return finish();          // 已缓存且加载完
      // 注意：G.platform.loadImage 已给 img 绑定 onload（置 img.ok=true）/ onerror（置 img.ok=false）。
      // 这里必须「包装」而非覆盖，否则会丢掉 img.ok 的置位 → 导致 ready 永远 false（回退程序化绘制）。
      const prevLoad = img.onload, prevErr = img.onerror;
      img.onload = function () { if (typeof prevLoad === "function") prevLoad.apply(this, arguments); finish(); };
      img.onerror = function () { if (typeof prevErr === "function") prevErr.apply(this, arguments); finish(); };
      // 兜底：某些垫片 onload 不触发，轮询 img.ok
      const poll = setInterval(function () {
        if (img.ok === true || img.ok === false) { clearInterval(poll); finish(); }
      }, 60);
    },

    /* 某段是否可用 */
    isReady(roleKey, clipName) {
      const reg = this._reg[roleKey];
      return !!(reg && reg.clips[clipName] && reg.clips[clipName].ready);
    },

    /* 把 prey 状态映射到 clip 名。
       侧视鼠：peek(探头/停驻) / run(疾跑/窜逃) ；俯视群鼠：run(scurry) / pause(停驻) */
    clipFor(p, top) {
      const st = p.state || "peek";
      if (top) return st === "scurry" ? "run" : "pause";
      return (st === "dart" || st === "scurry") ? "run" : "peek";
    },

    /* 绘制一帧。在 prey.render 已建立好 translate/scale/朝向 的坐标系内调用，
       本函数只负责「选帧 + drawImage 到中心对齐的设计框」。
       返回 true 表示成功画了帧；false 表示不可用（上层回退）。
       t: 秒（动画时间），designW/designH: 设计框尺寸（中心对齐锚点 = 框中心） */
    draw(ctx, roleKey, clipName, t, designW, designH) {
      const reg = this._reg[roleKey];
      const clip = reg && reg.clips[clipName];
      if (!clip || !clip.ready || !clip._img) return false;

      const n = clip.frameCount || 1;
      const fps = clip.fps || 12;
      let idx = Math.floor(t * fps) % n;
      if (!clip.loop) idx = Math.min(idx, n - 1);   // 非循环：停在最后一帧
      const fw = clip.frameW, fh = clip.frameH;

      ctx.drawImage(
        clip._img,
        idx * fw, 0, fw, fh,            // 源：sheet 第 idx 帧
        -designW / 2, -designH / 2, designW, designH   // 目标：中心对齐到当前原点
      );
      return true;
    }
  };

  /* 启动时从 config 的 G.MOUSE_ANIM 建 manifest（side / top 两套注册表）。
     帧图本身懒加载：只有真正渲染到对应 clip 时才 loadImage，缺图时静默回退程序化绘制。 */
  (function init() {
    if (G.MOUSE_ANIM) {
      // MOUSE_ANIM 形如 { side:{design,clips}, top:{design,clips} }，每个 key 即一个 roleKey 注册表
      G.frames.loadManifest(G.MOUSE_ANIM);
    }
  })();
};
