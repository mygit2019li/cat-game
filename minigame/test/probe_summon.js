/* probe_summon.js — 召唤猫咪页体检：
   ① 「猫粮开饭」卡排在内置列表第一，音频是真实出粮录音
   ② 左上角「自定义」按钮 → 标题/图片/音频录入 → 存本机 → 排在卡牌列表第一（重启依然在）
   ③ 图片三渠道（相册/微信聊天/拍照）、音频三渠道（录音/微信聊天/文件）各自调到对的 API
   ④ 现场录音的开录/停止/收尾，麦克风不漏
   用法：NODE_PATH=<npm 模块目录> node test/probe_summon.js */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/summon";
fs.mkdirSync(OUT, { recursive: true });
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

function findChrome() {
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", process.env.CHROME_PATH || ""])
    if (p && fs.existsSync(p)) return p;
  throw new Error("no chrome found");
}

const results = [];
let failed = 0;
function ok(cond, name, info) {
  if (!cond) failed++;
  results.push((cond ? "✅ " : "❌ ") + name + (info === undefined ? "" : "  → " + info));
}

async function boot(page, sysInfo) {
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, sysInfo);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(250);
}
/* 按 key 命中一个按钮（不依赖坐标算式），返回是否命中 + 命中区。
   注意：ui.buttons 每帧重建，连续两次 evaluate 之间不保证渲染过——
   改变面板开关状态的点击后必须等一下再取新按钮 */
const hitKey = (page, key) => page.evaluate(k => {
  const G = window.G;
  const b = G.ui.buttons.filter(x => x.key === k).pop();
  if (!b) return { found: false };
  const hit = G.hitButton(b.x + b.w / 2, b.y + b.h / 2);
  return { found: true, hit, x: b.x, y: b.y, w: b.w, h: b.h };
}, key);
const tapKey = async (page, key, wait) => {
  const r = await hitKey(page, key);
  await page.waitForTimeout(wait == null ? 120 : wait);
  return r;
};
/* 面板里当前有哪些命中区（渠道抽屉的 key 是动态拼出来的，按前缀取） */
const srcKeys = (page, prefix) => page.evaluate((p) =>
  window.G.ui.buttons.filter(b => b.key && b.key.indexOf(p) === 0).map(b => b.key), prefix);
/* 上一次被调到的是哪个选素材 API（path 可能是大 dataURL，只留前 26 字） */
const lastPick = (page) => page.evaluate(() => {
  const L = window.__lastPick || {};
  return { api: L.api || "", source: L.source || "", type: L.type || "", ext: L.ext || "", path: String(L.path || "").slice(0, 26) };
});
const state = (page) => page.evaluate(() => {
  const G = window.G;
  const kinds = G.summonKinds();
  return {
    n: kinds.length, first: kinds[0] && kinds[0].key, idx: G.summonPick && G.summonPick.idx,
    edit: !!G.ui.summonEdit,
    custom: G.customSummon ? { name: G.customSummon.name, img: String(G.customSummon.img).slice(0, 30), audio: String(G.customSummon.audio).slice(0, 30) } : null,
    raw: window.wx.getStorageSync("catCustomSummon") || "",
    playing: !!G.summonPlaying, fsStore: Object.keys(window.__fsStore || {})
  };
});

const port = { windowWidth: 390, windowHeight: 844, pixelRatio: 2,
  safeArea: { left: 0, top: 47, right: 390, bottom: 844 } };
const land = { windowWidth: 844, windowHeight: 390, pixelRatio: 2,
  safeArea: { left: 0, top: 0, right: 844, bottom: 390 } };

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });

  /* ============ 竖屏：主链路 ============ */
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => {
    const s = m.text();
    // ERR_FILE_NOT_FOUND：逗包内图床路径；ERR_UNKNOWN_URL_SCHEME：垫片刻出来的 wxfile:// 假路径
    if (m.type() === "error" && !/ERR_FILE_NOT_FOUND|ERR_UNKNOWN_URL_SCHEME/.test(s)) errs.push("console: " + s);
  });
  await boot(page, port);

  // ① 猫粮开饭卡
  const food = await page.evaluate(() => {
    const k = (window.G.CAT_KINDS || [])[0] || {};
    return { key: k.key, name: k.name, audioPath: k.audioPath, icon: k.icon, n: window.G.CAT_KINDS.length };
  });
  ok(food.key === "food" && food.n === 5, "猫粮开饭排在内置卡牌第一位", JSON.stringify(food));
  ok(food.audioPath && fs.existsSync(path.join(ROOT, food.audioPath)), "开饭音频素材已打进包内", food.audioPath);
  ok(!food.img && food.icon === "food", "开饭卡无照片、走矢量粮盆插画", food.icon);

  await page.evaluate(() => { window.G.summonPick = null; window.G.switchScreen("summon"); });
  await page.waitForTimeout(600);
  let s = await state(page);
  ok(s.n === 5 && s.first === "food", "未自定义时列表 5 张、第一张是猫粮开饭", s.n + " 张 / " + s.first);
  await page.screenshot({ path: path.join(OUT, "01-food-first.png") });

  // 开饭卡能播
  const play = await page.evaluate(() => {
    const G = window.G;
    G.startSummonKind(0);
    const r = { playing: !!G.summonPlaying, idx: G.summonKindIdx };
    G.stopSummonMusic();
    return r;
  });
  ok(play.playing && play.idx === 0, "点开饭卡可以播放召唤声", JSON.stringify(play));

  // ② 左上角自定义按钮
  const openBtn = await tapKey(page, "edit-open");
  ok(openBtn.found, "左上角自定义按钮存在");
  ok(openBtn.hit && (await state(page)).edit, "点一下弹出录入面板");
  const geo = await page.evaluate(() => {
    const G = window.G, bs = G.ui.buttons;
    const find = k => bs.filter(b => b.key === k).pop();
    const back = { x: G.platform.safe.left + 16, y: G.platform.safe.top + 14 };
    const op = find("edit-open");
    // 标题居中占位（22px × 4 字）
    const titleW = 92, titleL = G.platform.W / 2 - titleW / 2;
    return { op, back, titleL, titleR: titleL + titleW };
  });
  ok(geo.op.x > geo.back.x + 42, "自定义按钮不压返回键", geo.op.x + " vs " + (geo.back.x + 42));
  ok(geo.op.x + geo.op.w <= geo.titleL, "自定义按钮不压居中标题", (geo.op.x + geo.op.w) + " vs " + geo.titleL);
  await page.screenshot({ path: path.join(OUT, "02-edit-empty.png") });

  // 标题：走系统键盘链路（垫片里用 __kbDone 收尾）
  await tapKey(page, "edit-name");
  const kb = await page.evaluate(() => {
    if (typeof window.__kbDone !== "function") return { reg: false };
    window.__kbDone({ value: "花花回来吃饭" });
    return { reg: true, name: window.G.ui.summonEdit.name };
  });
  ok(kb.reg && kb.name === "花花回来吃饭", "标题经键盘录入并回填", JSON.stringify(kb));

  // 图片：点一下先弹渠道抽屉，三个渠道各自走对的 API
  await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 200; c.height = 150;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 200, 150);
    g.addColorStop(0, "#ffb26b"); g.addColorStop(1, "#4fc3a1");
    x.fillStyle = g; x.fillRect(0, 0, 200, 150);
    x.fillStyle = "#fff"; x.font = "bold 30px sans-serif"; x.textAlign = "center";
    x.fillText("我家花花", 100, 84);
    window.__pickStub = { image: c.toDataURL("image/png"), audio: "wxfile://tmp/summon_meow.mp3" };
    return true;
  });
  await tapKey(page, "edit-img");
  const imgSrc = await srcKeys(page, "edit-src-");
  ok(imgSrc.indexOf("edit-src-album") >= 0 && imgSrc.indexOf("edit-src-chat") >= 0 && imgSrc.indexOf("edit-src-camera") >= 0,
    "图片行先弹渠道抽屉：相册 / 微信聊天 / 拍照", imgSrc.join(","));
  await page.screenshot({ path: path.join(OUT, "07-src-image.png") });
  await tapKey(page, "edit-src-album");
  let last = await lastPick(page);
  ok(last.api === "chooseMedia" && last.source === "album", "从相册选走 chooseMedia(sourceType=album)", JSON.stringify(last));
  await tapKey(page, "edit-img"); await tapKey(page, "edit-src-chat");
  last = await lastPick(page);
  ok(last.api === "chooseMessageFile" && last.type === "image", "从聊天选图走 chooseMessageFile(type=image)", JSON.stringify(last));
  await tapKey(page, "edit-img"); await tapKey(page, "edit-src-camera");
  last = await lastPick(page);
  ok(last.api === "chooseMedia" && last.source === "camera", "拍照走 chooseMedia(sourceType=camera)", JSON.stringify(last));
  let picked = await page.evaluate(() => String(window.G.ui.summonEdit.img).slice(0, 12));
  ok(picked === "data:image/p", "三个渠道都能把图写进面板", picked);

  // 音频：抽屉里三个入口，聊天/文件走 chooseMessageFile 的不同 type，录音走 RecorderManager
  await tapKey(page, "edit-audio");
  const audSrc = await srcKeys(page, "edit-src-");
  ok(audSrc.indexOf("edit-src-record") >= 0 && audSrc.indexOf("edit-src-chat") >= 0 && audSrc.indexOf("edit-src-file") >= 0,
    "音频行先弹渠道抽屉：现场录音 / 微信聊天 / 文件", audSrc.join(","));
  await page.screenshot({ path: path.join(OUT, "08-src-audio.png") });
  await tapKey(page, "edit-src-chat");
  last = await lastPick(page);
  ok(last.api === "chooseMessageFile" && last.type === "file" && last.ext.indexOf("mp3") >= 0,
    "从聊天选音频：type=file + 后缀过滤", JSON.stringify(last));
  await tapKey(page, "edit-audio"); await tapKey(page, "edit-src-file");
  last = await lastPick(page);
  ok(last.api === "chooseMessageFile" && last.type === "all",
    "从文件选：type=all（电脑端微信就是系统文件框）", JSON.stringify(last));
  ok(await page.evaluate(() => window.G.ui.summonEdit.audio === "wxfile://tmp/summon_meow.mp3"),
    "聊天/文件渠道把音频写进了面板");
  // 选个非音频文件会被拒（type=all 不做系统过滤，得自己验后缀）
  await page.evaluate(() => {
    window.__pickStub = { image: window.__pickStub.image, audio: { chat: "wxfile://tmp/summon_meow.mp3", file: "wxfile://tmp/notes.pdf" } };
  });
  await tapKey(page, "edit-audio"); await tapKey(page, "edit-src-file");
  const badType = await page.evaluate(() => ({ audio: window.G.ui.summonEdit.audio, msg: window.G.ui.summonEdit.msg }));
  ok(badType.audio === "wxfile://tmp/summon_meow.mp3" && /不是音频/.test(badType.msg),
    "从文件选到非音频会被挡下来", JSON.stringify(badType));
  await page.evaluate(() => { window.__pickStub.audio = "wxfile://tmp/summon_meow.mp3"; });

  // 现场录音：选完渠道就开录，音频行当场变成停止键
  await page.evaluate(() => { window.__recStub = { path: "wxfile://tmp/rec-meow.mp3" }; });
  await tapKey(page, "edit-audio");
  await tapKey(page, "edit-src-record", 200);
  const recOn = await page.evaluate(() => {
    const E = window.G.ui.summonEdit;
    return { active: !!window.__recActive, opts: window.__recOpts, rec: !!E.rec, audio: E.audio };
  });
  ok(recOn.active && recOn.rec && recOn.opts && recOn.opts.format === "mp3" && recOn.opts.duration === 15000,
    "选「现场录音」真的开录了（mp3、15 秒上限）", JSON.stringify(recOn.opts));
  await page.screenshot({ path: path.join(OUT, "09-recording.png") });
  await tapKey(page, "edit-audio", 200);   // 录音中再点音频行 = 停
  const recDone = await page.evaluate(() => ({
    audio: window.G.ui.summonEdit.audio, rec: !!window.G.ui.summonEdit.rec, active: !!window.__recActive
  }));
  ok(recDone.audio === "wxfile://tmp/rec-meow.mp3" && !recDone.rec && !recDone.active,
    "点音频行停止录音，把录音文件填进面板并释放麦克风", JSON.stringify(recDone));
  await page.screenshot({ path: path.join(OUT, "03-edit-filled.png") });

  // 试听（浏览器回落 new Audio，只要能拿到句柄就算通）
  const prev = await tapKey(page, "edit-preview");
  const prevOn = await page.evaluate(() => !!window.G.ui.summonEdit.previewOn);
  ok(prev.found && prevOn, "选好音频后能试听", "previewOn=" + prevOn);

  // 保存
  await tapKey(page, "edit-save", 400);
  await page.waitForTimeout(500);
  s = await state(page);
  ok(!s.edit, "保存后面板自动收起");
  ok(s.custom && s.custom.name === "花花回来吃饭", "自定义卡已写入内存", JSON.stringify(s.custom));
  ok(!!s.raw && JSON.parse(s.raw).audio === "wxfile://tmp/rec-meow.mp3", "整条记录（含录音）已存进本地存储", s.raw.slice(0, 60));
  ok(s.first === "custom" && s.n === 6, "自定义卡排在卡牌列表第一", s.n + " 张 / " + s.first);
  ok(s.idx === 0, "保存后回到第一张，立刻能看到自己的卡", s.idx);
  await page.screenshot({ path: path.join(OUT, "04-custom-first.png") });

  // 重启依然在
  const reboot = await page.evaluate(() => {
    const G = window.G;
    G.customSummon = null;
    G.loadCustomSummon();
    const k = G.summonKinds();
    return { first: k[0] && k[0].key, name: k[0] && k[0].name, n: k.length };
  });
  ok(reboot.first === "custom" && reboot.name === "花花回来吃饭" && reboot.n === 6,
    "模拟重启后自定义卡仍排第一", JSON.stringify(reboot));

  // 自定义卡能播（无 createInnerAudioContext → 合成喵声兜底，仍算播放中）
  const cplay = await page.evaluate(() => {
    const G = window.G;
    G.startSummonKind(0);
    const r = { playing: !!G.summonPlaying, idx: G.summonKindIdx };
    G.stopSummonMusic();
    return r;
  });
  ok(cplay.playing, "点自定义卡会发声（没音频时回落合成喵声）", JSON.stringify(cplay));

  // 弹窗开着时不跟手翻页
  await tapKey(page, "edit-open");
  const drag = await page.evaluate(() => {
    const G = window.G;
    const before = G.summonPick.idx;
    G.summonPickTouchStart(300); G.summonPickTouchMove(60); G.summonPickTouchEnd(60);
    return { before, after: G.summonPick.idx, edit: !!G.ui.summonEdit };
  });
  ok(drag.before === drag.after && drag.edit, "面板开着时拖动背面卡牌不翻页", JSON.stringify(drag));
  await tapKey(page, "edit-close");

  // 换一张图 + 打开落盘分支（真机选回来的是 wxfile:// 临时路径，USER_DATA_PATH 非空时走 copyFileSync；
  // 浏览器里选回来的是 dataURL，本身就是自包含的，saveAsset 故意不再落盘）
  const saved = await page.evaluate(() => {
    window.__pickStub = { image: "wxfile://tmp/summon_pick_2.jpg", audio: "wxfile://tmp/summon_food2.mp3" };
    window.wx.env.USER_DATA_PATH = "wxfile://usr";
    return true;
  });
  await tapKey(page, "edit-open");
  const t2 = await tapKey(page, "edit-img");
  const sheet2 = await page.evaluate(() => (window.G.ui.summonEdit || {}).sheet);
  ok(t2.found && sheet2 === "image", "图片行弹渠道抽屉，选“相册”拿回临时路径", sheet2);
  await tapKey(page, "edit-src-album");     // 图：从相册，拿回来的是临时路径
  const t2a = await tapKey(page, "edit-audio");
  ok(t2a.found, "选完图收起抽屉，音频行又能点了");
  await tapKey(page, "edit-src-chat");      // 音频：从聊天
  await tapKey(page, "edit-save", 400);
  s = await state(page);
  // （state 里 img/audio 只取了前 30 字，这里按前缀判，后缀已在 fsStore 那行完整断言）
  ok(/^wxfile:\/\/usr\/summon-img-\d+/.test(s.custom.img), "图片已复制进 USER_DATA_PATH 长期保存", s.custom.img);
  ok(/^wxfile:\/\/usr\/summon-audio-\d+/.test(s.custom.audio), "音频已复制进 USER_DATA_PATH 长期保存", s.custom.audio);
  ok(s.fsStore.length === 2, "用户目录里只有这两份素材（旧的临时路径不会被误删）", JSON.stringify(s.fsStore));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "05-custom-savedpath.png") });

  // 删除自定义卡
  await tapKey(page, "edit-open");
  const del = await tapKey(page, "edit-del", 300);
  ok(del.found && del.hit, "面板里有删除本卡按钮");
  s = await state(page);
  ok(!s.custom && s.raw === "" && s.n === 5 && s.first === "food",
    "删除后回到 5 张内置卡、存储与本地文件都清掉", s.n + " 张 / 残留文件 " + JSON.stringify(s.fsStore));
  ok(s.fsStore.length === 0, "用户目录里的素材文件已删除", JSON.stringify(s.fsStore));

  // 录音中按“保存”：先收尾，不把还在录的引用存进本地
  await tapKey(page, "edit-open");
  await tapKey(page, "edit-audio");
  await tapKey(page, "edit-src-record", 200);
  await tapKey(page, "edit-save", 250);
  const guard = await page.evaluate(() => ({
    edit: !!window.G.ui.summonEdit, active: !!window.__recActive, saved: !!window.G.customSummon
  }));
  ok(guard.edit && !guard.active && !guard.saved,
    "录音中按保存会先收麦克风、不会当场存盘", JSON.stringify(guard));
  // 录音中直接关面板：这次录音作废，麦克风也要交出去
  await tapKey(page, "edit-save", 300);
  await tapKey(page, "edit-open");
  await tapKey(page, "edit-audio");
  await tapKey(page, "edit-src-record", 200);
  await tapKey(page, "edit-close", 200);
  const leaked = await page.evaluate(() => ({ edit: !!window.G.ui.summonEdit, active: !!window.__recActive }));
  ok(!leaked.edit && !leaked.active, "录音中关面板会把麦克风收掉（不漏录音会话）", JSON.stringify(leaked));

  /* ============ 横屏：面板与按钮不越界 ============ */
  const p2 = await browser.newPage({ viewport: { width: 844, height: 390 } });
  p2.on("pageerror", e => errs.push("land pageerror: " + e.message));
  await boot(p2, land);
  await p2.evaluate(() => { window.G.switchScreen("summon"); });
  await p2.waitForTimeout(400);
  await p2.evaluate(() => {
    const G = window.G;
    G.saveCustomSummon({ name: "花花回来吃饭", img: "", audio: "wxfile://usr/summon-audio.mp3" });
    G.hitButton(G.platform.safe.left + 68 + 21, G.platform.safe.top + 14 + 21);
  });
  await p2.waitForTimeout(400);
  const landGeo = await p2.evaluate(() => {
    const G = window.G, W = G.platform.W, H = G.platform.H;
    return G.ui.buttons.filter(b => b.key && b.key.indexOf("edit") === 0)
      .map(b => ({ k: b.key, x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.x + b.w), b: Math.round(b.y + b.h), W, H }));
  });
  ok(landGeo.length >= 6, "横屏面板按钮齐全", landGeo.map(b => b.k).join(","));
  const out = landGeo.filter(b => b.k !== "edit-scrim" && (b.x < 0 || b.y < 0 || b.r > b.W || b.b > b.H));
  ok(out.length === 0, "横屏面板按钮全部在屏内", JSON.stringify(out));
  await p2.screenshot({ path: path.join(OUT, "06-land-edit.png") });
  // 横屏的渠道抽屉：四个命中区（三个渠道 + 取消）不能越屏
  await p2.evaluate(() => { window.G.ui.summonEdit.sheet = "audio"; });
  await p2.waitForTimeout(120);
  const landSrc = await p2.evaluate(() => {
    const G = window.G, W = G.platform.W, H = G.platform.H;
    return G.ui.buttons.filter(b => b.key && b.key.indexOf("edit-src-") === 0)
      .map(b => ({ k: b.key, x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.x + b.w), b: Math.round(b.y + b.h), W, H }));
  });
  ok(["edit-src-scrim", "edit-src-record", "edit-src-chat", "edit-src-file", "edit-src-cancel"]
    .every(k => landSrc.some(b => b.k === k)), "横屏音频抽屉三个渠道齐全", landSrc.map(b => b.k).join(","));
  ok(landSrc.filter(b => b.k !== "edit-src-scrim" && (b.x < 0 || b.y < 0 || b.r > b.W || b.b > b.H)).length === 0,
    "横屏抽屉全部在屏内", JSON.stringify(landSrc.map(b => [b.k, b.y, b.b])));
  await p2.screenshot({ path: path.join(OUT, "10-land-src.png") });
  // 横屏卡牌：自定义 + 开饭 + 4 张性格 = 6 张
  const landKinds = await p2.evaluate(() => window.G.summonKinds().map(k => k.key).join(">"));
  ok(landKinds === "custom>food>lazy>lively>gentle>cool", "卡牌顺序：自定义 > 猫粮 > 四种性格", landKinds);

  console.log(results.join("\n"));
  console.log("\n截图：" + OUT);
  if (errs.length) { console.log("❌ 运行时错误：\n" + errs.join("\n")); failed++; }
  else console.log("✅ 无运行时错误");
  await browser.close();
  if (failed) { console.log("\n❌ " + failed + " 项未通过"); process.exit(1); }
  console.log("\n✅ 全部通过");
})();
