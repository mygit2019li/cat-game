/* probe_creek_visual.js — 「小河戏鱼」布景/鱼造型渲染体检
   验四件事：
     ① 真实主循环跑起来不报错（prey/draw/scenery/主循环全走一遍）
     ② 落几张截图，肉眼看布景与鱼是否与参考图一致
     ③ 多鱼同屏（9 条）帧率是否还够 55fps
     ④ 命中后从岸边入场（introT）与「全部消失→边缘出现」的落位
   用法：NODE_PATH=/Users/lipeng/.workbuddy/binaries/node/workspace/node_modules \
         /Users/lipeng/.workbuddy/binaries/node/versions/22.22.2/bin/node test/probe_creek_visual.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/tmp/creek-shots";
fs.mkdirSync(OUT, { recursive: true });

const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./js/ad.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

function findChrome() {
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", process.env.CHROME_PATH || ""])
    if (p && fs.existsSync(p)) return p;
  throw new Error("no chrome found");
}

const WX_MOCK = `
  (function(){
    const wx = window.wx;
    wx.shareAppMessage=()=>{}; wx.onShareAppMessage=()=>{}; wx.showShareMenu=()=>{};
    wx.showToast=()=>{}; wx.showModal=()=>{}; wx.reportAnalytics=()=>{}; wx.reportEvent=()=>{};
    HTMLCanvasElement.prototype.toTempFilePathSync=function(){return this.toDataURL("image/jpeg",0.9);};
  })();
`;

const land = { windowWidth: 844, windowHeight: 390, pixelRatio: 2,
  safeArea: { left: 47, top: 0, right: 797, bottom: 369 } };

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => {
    const s = m.text();
    if (m.type() === "error" && !/ERR_FILE_NOT_FOUND|ERR_UNKNOWN_URL_SCHEME/.test(s)) errs.push("console: " + s);
  });

  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, land);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(WX_MOCK);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(320);

  /* 走真实开局流程：捕鱼 + 小河戏鱼（bg_fish=pool），三只鱼 */
  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "fish";
    G.config.bg_fish = "pool";
    G.config.preyCount = 3;
    G.config.duration = 60;
    G.startGame();
    G.session.counting = false;
    G.session.running = true;
    G.switchScreen("playing");
  });
  await page.waitForTimeout(900);

  const shots = [];
  for (let i = 0; i < 3; i++) {
    const f = path.join(OUT, `creek-3fish-${i + 1}.png`);
    await page.screenshot({ path: f });
    shots.push(f);
    await page.waitForTimeout(700);
  }

  /* 入场落位：把三条鱼全部"打掉"，看重生的鱼是不是落在边缘 */
  const entry = await page.evaluate(() => {
    const G = window.G, b = G.bounds(), out = [];
    G.preys.forEach(p => { p.vanishT = 0.01; });
    return new Promise(res => setTimeout(() => {
      G.preys.forEach(p => {
        const gaps = [p.x - b.x, (b.x + b.w) - p.x, p.y - b.y, (b.y + b.h) - p.y];
        out.push({ gap: Math.round(Math.min(...gaps)), intro: +(p.introT || 0).toFixed(2), fade: +p.fade.toFixed(2) });
      });
      res(out);
    }, 400));
  });
  await page.waitForTimeout(120);
  const fEntry = path.join(OUT, "creek-entry.png");
  await page.screenshot({ path: fEntry });
  shots.push(fEntry);

  /* 多鱼同屏压测：加到 9 条，量 3 秒真实帧率 */
  const perf = await page.evaluate(async () => {
    const G = window.G;
    while (G.preys.length < 9) { const p = new G.Prey("fish"); G.preys.push(p); p.warpIn(); }
    await new Promise(r => setTimeout(r, 400));
    return new Promise(res => {
      let n = 0; const t0 = performance.now();
      const tick = () => {
        n++;
        if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
        else res({ fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1), fish: G.preys.length });
      };
      requestAnimationFrame(tick);
    });
  });
  await page.waitForTimeout(200);
  const fMany = path.join(OUT, "creek-9fish.png");
  await page.screenshot({ path: fMany });
  shots.push(fMany);

  /* 场景选择卡里的缩略图（小河戏鱼卡） */
  const cardInfo = await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "fish";
    G.config.bg_fish = "pool"; G.requestStart();
    return { screen: G.screen, bgs: G.bgPickList().map(b => b.name) };
  });
  await page.waitForTimeout(600);
  const fCard = path.join(OUT, "creek-card.png");
  await page.screenshot({ path: fCard });
  shots.push(fCard);

  console.log([
    "截图: " + shots.join(" "),
    "入场落位(离最近边缘 px): " + entry.map(e => e.gap).join(", ") + "  introT=" + entry.map(e => e.intro).join(","),
    "9 鱼同屏帧率: " + perf.fps + "fps / " + perf.fish + " 条",
    "场景卡: " + JSON.stringify(cardInfo),
    "运行时报错: " + (errs.length ? errs.slice(0, 4).join(" | ") : "无")
  ].join("\n"));

  await browser.close();
})();
