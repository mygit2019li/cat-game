/* probe_feeder.js — 电子猫粮机（三态：常态 / 设置弹窗 / 竖版演出）
   用法：NODE_PATH=<npm> node test/probe_feeder.js
   截图：/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/feeder
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/feeder";
fs.mkdirSync(OUT, { recursive: true });

function findChrome() {
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", process.env.CHROME_PATH || ""])
    if (p && fs.existsSync(p)) return p;
  throw new Error("no chrome found");
}
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

const WX_MOCK = `
  (function(){
    const wx = window.wx;
    wx.shareAppMessage=(o)=>{(window.__shares=window.__shares||[]).push(o);};
    wx.onShareAppMessage=(fn)=>{window.__shareFactory=fn;};
    wx.showShareMenu=()=>{}; wx.showToast=(o)=>{(window.__toasts=window.__toasts||[]).push(o);};
    wx.showModal=(o)=>{(window.__modals=window.__modals||[]).push(o);};
    wx.reportAnalytics=(n,d)=>{(window.__track=window.__track||[]).push([n,d]);};
    wx.createImage=()=>new Image();
    /* InnerAudio 模拟：记录播放次数；__feederAudioFail=true 时触发 onError（验证合成兜底） */
    wx.createInnerAudioContext=()=>{
      const a={src:'',loop:false,volume:1,_err:false,
        play(){ if(window.__feederAudioFail){ setTimeout(()=>{ if(a._errCb) a._errCb({errMsg:'mock fail'}); },0); return; } window.__audioPlays=(window.__audioPlays||0)+1; (window.__audioSrcs=window.__audioSrcs||[]).push(a.src); },
        stop(){}, destroy(){},
        onPlay(cb){a._play=cb;}, onEnded(cb){a._ended=cb;}, onError(cb){a._errCb=cb;}};
      return a;
    };
    HTMLCanvasElement.prototype.toTempFilePathSync=function(){return this.toDataURL("image/jpeg",0.92);};
  })();
`;
async function boot(page, sysInfo) {
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, sysInfo);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(WX_MOCK);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(280);
}
const land14 = { windowWidth: 844, windowHeight: 390, pixelRatio: 3,
  safeArea: { left: 0, top: 0, right: 844, bottom: 390 } };
const port14 = { windowWidth: 390, windowHeight: 844, pixelRatio: 3,
  safeArea: { left: 0, top: 47, right: 390, bottom: 810 } };

const A = [];
const ok = (cond, msg, extra) => { A.push((cond ? "✅ " : "❌ ") + msg + (extra != null ? "  → " + extra : "")); return cond; };

/* 在页面里按 key 点按钮（走真实 hitButton 路由） */
const CLICK = k => {
  const G = window.G;
  const b = G.ui.buttons.slice().reverse().find(b => b.key === k);
  if (!b) return false;
  return G.hitButton(b.x + b.w / 2, b.y + b.h / 2);
};

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && m.text().indexOf("ERR_FILE_NOT_FOUND") < 0) errs.push("console: " + m.text()); });
  await boot(page, land14);

  // 1) 首页入口
  const home = await page.evaluate(() => ({ btns: window.G.ui.buttons.length, hasEnter: typeof window.G.feederEnter === "function" }));
  ok(home.hasEnter, "G.feederEnter 已挂载");
  ok(home.btns >= 11, "首页按钮数量含电子猫粮入口", "buttons=" + home.btns);

  // 2) 常态：机器 + 机身键 + 设置键
  await page.evaluate(() => { window.G.feederEnter(); });
  await page.waitForTimeout(420);
  const idle = await page.evaluate(() => {
    const G = window.G;
    return {
      screen: G.screen, mode: G.feeder.mode, e: G.feeder.e,
      keys: G.ui.buttons.map(b => b.key).filter(Boolean),
      cam: G.feeder.cam
    };
  });
  ok(idle.screen === "feeder", "切到 feeder 界面", idle.screen);
  ok(idle.mode === "home" && idle.e < 0.02, "常态：无舞台、无遮罩", "mode=" + idle.mode + " e=" + idle.e.toFixed(2));
  ok(idle.keys.indexOf("feed") >= 0, "机身出粮键已注册", idle.keys.join(","));
  ok(idle.keys.indexOf("settings") >= 0, "右上角设置键已注册");
  ok(idle.keys.indexOf("mode-timer") < 0, "常态不再有操作面板（份数/间隔藏进弹窗）");
  ok(idle.cam.s > 0.5, "设备镜头已建立", "s=" + idle.cam.s.toFixed(2));
  await page.screenshot({ path: path.join(OUT, "01-feeder-idle.png") });

  // 3) 设置弹窗
  await page.evaluate(CLICK, "settings");
  await page.waitForTimeout(200);
  const modal = await page.evaluate(() => ({
    mode: window.G.feeder.mode,
    keys: window.G.ui.buttons.map(b => b.key).filter(Boolean)
  }));
  ok(modal.mode === "modal", "点设置键弹出设置层");
  ok(modal.keys.indexOf("mode-timer") >= 0 && modal.keys.indexOf("iv-0.5") >= 0 && modal.keys.indexOf("refill") >= 0,
    "弹窗内含方式/间隔/补粮/清空", modal.keys.join(","));
  await page.screenshot({ path: path.join(OUT, "02-feeder-modal.png") });

  // 4) 关掉弹窗，点机身键出粮 → 进竖版舞台
  await page.evaluate(CLICK, "modal-close");
  await page.waitForTimeout(160);
  const fire = await page.evaluate(() => {
    const G = window.G;
    window.__motor = 0; window.__drops = 0; window.__audioPlays = 0; window.__audioSrcs = [];
    const m0 = G.playFeederMotor, d0 = G.playKibbleDrop;
    G.playFeederMotor = (d) => { window.__motor++; return m0 && m0(d); };
    G.playKibbleDrop = (w) => { window.__drops++; return d0 && d0(w); };
    const before = G.config.feedBowl;
    const b = G.ui.buttons.slice().reverse().find(b => b.key === "feed");
    const h = G.hitButton(b.x + b.w / 2, b.y + b.h / 2);
    return { h, before, portion: G.config.feedPortion, per: G.FEED.piecesPerPortion, mode: G.feeder.mode };
  });
  ok(fire.h === true, "机身出粮键点击命中");
  ok(fire.mode === "feed", "出粮即进入演出态（竖版舞台）");

  // 舞台成型后截图（含粮粒在半空）
  await page.waitForTimeout(420);
  const stage = await page.evaluate(() => {
    const G = window.G, P = G.platform;
    return { e: G.feeder.e, mode: G.feeder.mode, keys: G.ui.buttons.map(b => b.key).filter(Boolean), W: P.W, H: P.H };
  });
  ok(stage.e > 0.9, "舞台过渡完成（e≈1）", "e=" + stage.e.toFixed(2));
  ok(stage.keys.indexOf("feed") < 0 && stage.keys.indexOf("settings") < 0 && stage.keys.indexOf("back") < 0,
    "演出中按钮全部隐藏", stage.keys.join(","));
  ok(stage.keys.indexOf("skip") >= 0, "演出中整屏可点跳过");
  await page.screenshot({ path: path.join(OUT, "03-feeder-stage.png") });
  // 舞台特写（只截竖版区域，便于看粮粒与粮堆）
  await page.screenshot({ path: path.join(OUT, "04-feeder-stage-closeup.png"),
    clip: { x: 844 / 2 - 130, y: 0, width: 260, height: 390 } });

  await page.waitForTimeout(5600);
  const afterFeed = await page.evaluate(() => ({
    bowl: window.G.config.feedBowl, motor: window.__motor, drops: window.__drops,
    plays: window.__audioPlays,
    src: (window.__audioSrcs || [])[0] || "",
    hop: Math.round(window.G.config.feedHopper),
    flying: window.G.feeder.pellets.length + window.G.feeder.spawnLeft,
    mode: window.G.feeder.mode
  }));
  const expect = Math.min(fire.portion * fire.per, 86 - fire.before);
  ok(afterFeed.bowl === fire.before + expect, "出粮颗数 = 份量 × 8", afterFeed.bowl + " / 期望 " + (fire.before + expect));
  ok(afterFeed.plays === 1, "出粮播放真实录音一次（InnerAudio）", afterFeed.plays);
  ok(/feeder_real\.mp3$/.test(afterFeed.src), "首选播放用户实拍出粮录音 feeder_real.mp3", afterFeed.src);
  ok(afterFeed.motor === 0, "录音正常时不再播合成电机声", afterFeed.motor);
  ok(afterFeed.drops === expect, "每颗粮触发一次落盆声", afterFeed.drops + " / 期望 " + expect);
  ok(afterFeed.hop < 100, "储粮桶随出粮减少", afterFeed.hop + "%");
  ok(afterFeed.flying === 0, "粮粒全部落盆（无卡住的空中颗粒）", afterFeed.flying);
  ok(afterFeed.mode === "home", "演出结束自动回常态", afterFeed.mode);
  await page.screenshot({ path: path.join(OUT, "05-feeder-pile.png") });

  // 4.5) 点食盆吃粮：每点一次吃掉一份（16 颗）
  const eat1 = await page.evaluate(() => {
    const G = window.G;
    const before = G.config.feedBowl;
    const b = G.ui.buttons.slice().reverse().find(b => b.key === "bowl");
    if (!b) return { has: false, before };
    window.__crunch = 0;
    const c0 = G.playEatCrunch;
    G.playEatCrunch = () => { window.__crunch++; return c0 && c0(); };
    const hit = G.hitButton(b.x + b.w / 2, b.y + b.h / 2);
    return { has: true, hit, before, after: G.config.feedBowl, crunch: window.__crunch,
      bites: G.feeder.bites.length, pulse: G.feeder.eatPulse };
  });
  ok(eat1.has, "常态下食盆可点（bowl 命中区已注册）");
  ok(eat1.hit === true, "点食盆命中");
  ok(eat1.after === Math.max(0, eat1.before - 16), "点一下吃掉一份 16 颗", eat1.before + " → " + eat1.after);
  ok(eat1.crunch === 1, "吃粮打断噪音效一次", eat1.crunch);
  ok(eat1.bites > 0 && eat1.pulse > 0, "吃掉那几颗有上扬动画 + 粮堆回弹", "bites=" + eat1.bites);
  await page.waitForTimeout(130);
  await page.screenshot({ path: path.join(OUT, "05b-feeder-eat.png") });   // 吃掉瞬间：粮粒上扬 + 粮堆回弹
  await page.waitForTimeout(420);

  // 连续点到吃完，再点应该只提示不报错
  const eat2 = await page.evaluate(async () => {
    const G = window.G;
    const tap = () => G.feederEat();
    let guard = 0;
    while (G.config.feedBowl > 0 && guard++ < 12) { tap(); await new Promise(r => setTimeout(r, 60)); }
    const empty = G.config.feedBowl;
    const again = tap();
    return { empty, again, hint: G.feeder.hint, bites: G.feeder.bites.length };
  });
  ok(eat2.empty === 0, "连点到吃完，盆内归零", eat2.empty + " 颗");
  ok(eat2.again === false, "空盆再点不扣粮（只提示）", "hint=" + eat2.hint);

  // 5) 定时：弹窗里切定时 + 30 秒档 → 把饭点拨近
  await page.evaluate(CLICK, "settings");
  await page.waitForTimeout(150);
  await page.evaluate(CLICK, "mode-timer");
  await page.waitForTimeout(120);
  const timer = await page.evaluate(() => {
    const G = window.G;
    const b = G.ui.buttons.slice().reverse().find(b => b.key === "iv-0.5");
    const clicked = G.hitButton(b.x + b.w / 2, b.y + b.h / 2);
    const before = G.config.feedBowl;
    G.config.feedNextAt = Date.now() + 380;
    return { mode: G.config.feedMode, clicked, iv: G.config.feedIntervalMin, before };
  });
  ok(timer.mode === "timer", "弹窗里切到定时模式");
  ok(timer.clicked && Math.abs(timer.iv - 0.5) < 1e-6, "间隔切到 30 秒档", timer.iv + " 分");
  await page.evaluate(CLICK, "modal-close");
  await page.waitForTimeout(5200);
  const afterTimer = await page.evaluate(() => ({
    bowl: window.G.config.feedBowl, mode: window.G.config.feedMode,
    next: window.G.config.feedNextAt - Date.now(), fmode: window.G.feeder.mode
  }));
  ok(afterTimer.bowl > timer.before, "定时自动出了一顿", afterTimer.bowl + " / 之前 " + timer.before);
  ok(afterTimer.next > 0, "下一顿已重新排期", Math.round(afterTimer.next / 1000) + "s 后");
  ok(afterTimer.fmode === "home", "定时出粮同样走完演出并回到常态", afterTimer.fmode);
  await page.screenshot({ path: path.join(OUT, "06-feeder-timer.png") });

  // 6) 补粮 / 清空盆
  await page.evaluate(CLICK, "settings");
  await page.waitForTimeout(150);
  const cl = await page.evaluate(() => {
    const G = window.G;
    const find = k => G.ui.buttons.slice().reverse().find(b => b.key === k);
    const c = find("clear"); if (c) G.hitButton(c.x + c.w / 2, c.y + c.h / 2);
    const cleared = G.config.feedBowl;
    const r = find("refill"); if (r) G.hitButton(r.x + r.w / 2, r.y + r.h / 2);
    return { cleared, hop: G.config.feedHopper };
  });
  ok(cl.cleared === 0, "「清空食盆」把盆内粮清空", cl.cleared);
  ok(cl.hop === 100, "「补粮到满」把储粮补满", cl.hop + "%");
  await page.evaluate(CLICK, "modal-close");
  await page.waitForTimeout(200);

  // 6.5) 录音加载失败 → 合成电机声兜底
  const fb = await page.evaluate(async () => {
    const G = window.G;
    window.__feederAudioFail = true;
    window.__motor = 0; window.__audioPlays = 0;
    G.feederDispense();
    await new Promise(r => setTimeout(r, 300));
    const m = window.__motor, p = window.__audioPlays;
    G.feeder.pellets.length = 0; G.feeder.spawnLeft = 0; G.feeder.dispensing = 0; G.feeder.mode = "home";
    window.__feederAudioFail = false;
    return { m, p };
  });
  ok(fb.p === 0 && fb.m === 1, "录音失败时回落合成电机声兜底", "plays=" + fb.p + " motor=" + fb.m);
  await page.waitForTimeout(200);

  // 7) 布局体检（常态下，弹窗关闭）
  const geo = await page.evaluate(() => {
    const G = window.G, P = G.platform, S = P.S || 1;
    const W = P.W / S, H = P.H / S;
    const x0 = P.safe.left / S, y0 = P.safe.top / S, x1 = W - P.safe.right / S, y1 = H - P.safe.bottom / S;
    const bs = G.ui.buttons.map(b => ({ k: b.key || "?", x: b.x, y: b.y, w: b.w, h: b.h }));
    const issues = [];
    const ov = (a, b) => !(a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5 || a.y + a.h <= b.y + 0.5 || b.y + b.h <= a.y + 0.5);
    bs.forEach(b => {
      if (b.w <= 0 || b.h <= 0) issues.push("负尺寸 " + b.k);
      if (b.x < x0 - 1 || b.y < y0 - 1 || b.x + b.w > x1 + 1 || b.y + b.h > y1 + 1) issues.push("越界 " + b.k);
    });
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (ov(bs[i], bs[j])) issues.push("重叠 " + bs[i].k + "/" + bs[j].k);
    return { issues, n: bs.length, W: Math.round(W), H: Math.round(H) };
  });
  ok(geo.issues.length === 0, "横屏按钮无越界/重叠", geo.issues.join(" | ") || geo.n + " 个按钮");

  // 8) 竖屏兜底
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  p2.on("pageerror", e => errs.push("portrait pageerror: " + e.message));
  p2.on("console", m => { if (m.type() === "error" && m.text().indexOf("ERR_FILE_NOT_FOUND") < 0) errs.push("portrait console: " + m.text()); });
  await boot(p2, port14);
  await p2.evaluate(() => { window.G.feederEnter(); });
  await p2.waitForTimeout(420);
  await p2.screenshot({ path: path.join(OUT, "07-portrait-idle.png") });
  await p2.evaluate(() => {
    const G = window.G;
    const b = G.ui.buttons.slice().reverse().find(b => b.key === "feed");
    G.hitButton(b.x + b.w / 2, b.y + b.h / 2);
  });
  await p2.waitForTimeout(700);
  await p2.screenshot({ path: path.join(OUT, "08-portrait-stage.png") });
  await p2.waitForTimeout(4600);
  const pgeo = await p2.evaluate(() => {
    const G = window.G, P = G.platform, S = P.S || 1;
    const W = P.W / S, H = P.H / S;
    const x0 = P.safe.left / S, y0 = P.safe.top / S, x1 = W - P.safe.right / S, y1 = H - P.safe.bottom / S;
    const issues = [];
    G.ui.buttons.forEach(b => {
      if (b.w <= 0 || b.h <= 0) issues.push("负尺寸 " + (b.key || "?"));
      if (b.x < x0 - 1 || b.y < y0 - 1 || b.x + b.w > x1 + 1 || b.y + b.h > y1 + 1) issues.push("越界 " + (b.key || "?"));
    });
    return { issues, bowl: G.config.feedBowl, W: Math.round(W), H: Math.round(H), mode: G.feeder.mode };
  });
  ok(pgeo.issues.length === 0, "竖屏按钮无越界", pgeo.issues.join(" | ") || pgeo.W + "×" + pgeo.H);
  ok(pgeo.bowl > 0, "竖屏出粮同样落盆", pgeo.bowl + " 颗");

  await browser.close();

  console.log("\n===== 电子猫粮机 体检 =====");
  A.forEach(s => console.log(s));
  console.log("\n截图：" + OUT);
  if (errs.length) { console.log("\n运行时错误："); errs.forEach(e => console.log("  ❌ " + e)); }
  else console.log("✅ 无运行时错误");
  const bad = A.filter(s => s.startsWith("❌")).length;
  console.log(bad ? "\n❌ 失败 " + bad + " 项" : "\n✅ 全部通过");
})();
