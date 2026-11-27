/* probe_creek_regress.js — 三个海域回归：小河戏鱼 / 水草森林 / 鱼群巡游 都能正常开局、无报错
   用法：NODE_PATH=... node test/probe_creek_regress.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(__dirname, "..");
const OUT = "/tmp/creek-shots";
fs.mkdirSync(OUT, { recursive: true });
const MODS = ["./js/platform.js", "./js/config.js","./js/rank.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./js/ad.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
const WX_MOCK = `(function(){ const wx=window.wx;
  wx.shareAppMessage=()=>{}; wx.onShareAppMessage=()=>{}; wx.showShareMenu=()=>{};
  wx.showToast=()=>{}; wx.showModal=()=>{}; wx.reportAnalytics=()=>{}; wx.reportEvent=()=>{};
  HTMLCanvasElement.prototype.toTempFilePathSync=function(){return this.toDataURL("image/jpeg",0.9);};})();`;
const land = { windowWidth: 844, windowHeight: 390, pixelRatio: 2,
  safeArea: { left: 47, top: 0, right: 797, bottom: 369 } };

(async () => {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/ERR_FILE|ERR_UNKNOWN/.test(m.text())) errs.push("console: " + m.text()); });
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, land);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(WX_MOCK);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(300);

  const out = [];
  for (const bg of ["pool", "kelp", "school"]) {
    const before = errs.length;
    const info = await page.evaluate(async (bgKey) => {
      const G = window.G;
      if (G.screen === "playing") { G.switchScreen("home"); await new Promise(r => setTimeout(r, 300)); }
      G.config.targetType = "fish"; G.config.bg_fish = bgKey;
      G.config.preyCount = 3; G.config.duration = 60;
      G.startGame();
      G.session.counting = false; G.session.running = true;
      G.switchScreen("playing");
      await new Promise(r => setTimeout(r, 900));
      return { sea: G.session.sea && G.session.sea.name, fish: G.preys.length,
        sp: G.preys[0] && G.preys[0].species && G.preys[0].species.name };
    }, bg);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `regress-${bg}.png`) });
    out.push(`${bg}: 海域=${info.sea} 鱼=${info.fish} 品种=${info.sp} 新报错=${errs.length - before}`);
  }
  console.log(out.join("\n") + "\n总报错: " + (errs.length ? errs.slice(0, 3).join(" | ") : "无"));
  await browser.close();
})();
