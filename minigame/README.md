# 逗猫触屏玩具 · 微信小游戏版

从 H5 原型（`../prototype.html`）完整移植的微信小游戏：Canvas 2d 渲染，无 DOM 依赖。

## 导入运行

1. 打开**微信开发者工具** → 导入项目 → 选择本目录（`minigame/`）
2. AppID：测试可用「测试号」（`touristappid` 已预填）；正式开发替换为自己的小游戏 AppID
3. `game.json` 已锁定 `deviceOrientation: landscape`，开发者工具/真机均会以横屏启动
4. 编译即可运行（基础库建议 ≥ 2.19.0，音效依赖 `wx.createWebAudioContext`）

## 真机调试 / vConsole

手机扫码预览/体验版时，游戏会自动调用 `wx.setEnableDebug({ enableDebug: true })` 打开 vConsole：

- 仅对 **开发版（develop）** 和 **体验版（trial）** 生效，正式版不会自动开启
- 打开后屏幕右下角会出现绿色 `vConsole` 按钮，点击即可查看 `console.log` / 网络 / 存储等
- 如果没有自动出现，可手动：点击右上角胶囊 `···` → `开发调试` → `打开调试`，重新进入游戏
- 发布前无需删除代码，因为 `envVersion === "release"` 时不会调用

## 玩法（与原型一致）

- **深海捕鱼**：三只鱼三阶段游动（直线逃跑 → 上下潜游 → 自由航点），品种/巡游者个体差异
- **蝴蝶花园**：七态飞行（扇翅/滑翔/悬停/降落/停花/起飞/惊飞），阶段②起会停在花上（拍中 +2 精准扑击）
- **捕鼠行动**：打地鼠式两排交错洞口（6~8 个），peek → dart → hole 状态机，追击逃窜中的老鼠 +2
- **激光暗室**：甩动 ↔ 停留双态，停留是主要命中窗口（+2 光点落网），阶段②起有拖尾/瞬移
- 连击提难度（≥5 提速 / ≥10 提速+缩身 / ≥15 极限）、连续拍偏自适应辅助（放大+减速，与连击互斥）、
  宽容 miss（拍在猎物附近连击减半不清零）、受惊老鼠快速再冒头、每 3 次追击成就节奏点
- 时长 1/3/5 分钟，阶段按固定时长推进（①20s ②最多 50s ③至结束）

## 目录结构

```
minigame/
├── game.js            # 入口：流程编排 / 主循环 / 触摸路由 / 命中与拍偏
├── game.json
├── project.config.json
├── assets/            # 蝴蝶 3D 烘焙皮肤（6 花色 × 正常/压暗，共 12 张 PNG）
└── js/
    ├── platform.js    # 平台层（画布/触摸/存储/震动/屏幕常亮/音频）
    ├── config.js      # 全部玩法参数表（与原型 1:1）
    ├── audio.js       # WebAudio 合成音效 + 本地真实录音（喵声/出粮声）
    ├── draw.js        # 矢量精灵（鱼/鼠/蝶/光点/洞）+ 蝴蝶 HD 皮肤
    ├── scenery.js     # 四套布景 + 粒子特效系统
    ├── prey.js        # 四套猎物状态机
    └── ui.js          # 首页/设置/记录/HUD/倒计时/暂停/结算（全 Canvas）
test/harness.html     # 浏览器验证垫片（wx shim，不参与打包）
```

## 蝴蝶 3D 烘焙皮肤

蝴蝶默认使用 3D 烘焙皮肤：text-to-3D 生成帝王蝶模型 → three.js 正俯视渲染烘焙 →
按花色色相旋转生成 6 变体（`assets/bfly-hd*.png`）。运行时按身体中线切左右半，
用与矢量版相同的开合度状态机做绕体轴压缩翻翅（收翅自动压暗）；贴图加载失败自动回退矢量绘制。
烘焙管线与踩坑见 `小程序项目档案.md`。

## 音频素材来源与署名

- 出粮音效首选：`assets/audio/feeder_real.mp3` —— 用户实拍出粮视频（`猫粮.mp4`）提取音轨，截取连续出粮段，无授权限制。
- 出粮备选（仅在首选加载失败时逐条尝试），来自 [Freesound](https://freesound.org)，许可 CC BY 4.0：
  - 《Kibbles》by Bloomboi1 — https://freesound.org/s/762162/
  - 《Cat Food Dispenser, Dispensing Dry Cat Food》by designerschoice (TDC) — https://freesound.org/s/808834/
  - 《Cat_feeder》by Fred-o-saurus — https://freesound.org/s/766521/
- 喵声音效（`assets/audio/cat_*.mp3`）：从实拍视频提取音轨自制，素材来自 Mixkit 免费音效。
- 以上录音均经过去首尾静音、-16 LUFS 响度归一、96kbps 单声道处理。

## 与 H5 原型的差异

| 项 | 原型 | 小游戏版 |
|----|------|----------|
| 渲染 | DOM + SVG + CSS 动画 | 全 Canvas 2d 矢量绘制 |
| 音效 | Web Audio 合成 | `wx.createWebAudioContext` 合成（同参数；基础库不足时静默） |
| 震动 | `navigator.vibrate` 节奏模式 | `wx.vibrateShort`（light/heavy 两档近似） |
| 存储 | localStorage | `wx.setStorageSync`（配置 + 最近 50 局记录） |
| 屏幕 | 无 | 自动 `wx.setKeepScreenOn` 防息屏；锁屏仍需系统引导式访问/屏幕固定 |
| 蹲守热点 | 洞口 8s 窗口 | 已移植（pickHoleIdx 绕行 + 命中清热度半径 60px） |
| 屏幕方向 | 竖屏 H5 | 横屏小游戏；UI 已做横屏/竖屏双布局适配 |
| 安全区适配 | 无 | 已接入 `wx.getSystemInfoSync().safeArea`，首页/HUD/设置/记录/结算/暂停全部避开刘海/圆角/手势条 |

## 上线须知

小游戏类目发布需要《计算机软件著作权》+ 游戏版号（广电），**个人主体无法申请版号**——
如后续要正式发布而主体为个人，需评估改走小程序工具类目（引擎为纯 Canvas 2d，可平移）。
