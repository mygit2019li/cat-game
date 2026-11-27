/* shot_creek.js — 出图：小河戏鱼（三条鱼摆到指定位置，连拍三张）
   用法：NODE_PATH=... node test/shot_creek.js
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
const WX_MOCK = `
  (function(){ const wx = window.wx;
    wx.shareAppMessage=()=>{}; wx.onShareAppMessage=()=>{}; wx.showShareMenu=()=>{};
    wx.showToast=()=>{}; wx.showModal=()=>{}; wx.reportAnalytics=()=>{}; wx.reportEvent=()=>{};
    HTMLCanvasElement.prototype.toTempFilePathSync=function(){return this.toDataURL("image/jpeg",0.9);};
  })();`;
const land = { windowWidth: 844, windowHeight: 390, pixelRatio: 2,
  safeArea: { left: 47, top: 0, right: 797, bottom: 369 } };

(async () => {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  page.on("pageerror", e => console.log("ERR " + e.message));
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, land);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(WX_MOCK);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "fish"; G.config.bg_fish = "pool";
    G.config.preyCount = 3; G.config.duration = 60;
    G.startGame(); G.session.counting = false; G.session.running = true;
    G.switchScreen("playing");
  });
  await page.waitForTimeout(1200);

  const place = () => page.evaluate(() => {
    const G = window.G, b = G.bounds();
    const lay = [
      { i: 0, x: 0.30, y: 0.40, a: 0.36 },
      { i: 1, x: 0.56, y: 0.66, a: -2.55 },
      { i: 2, x: 0.76, y: 0.30, a: 2.9 }
    ];
    G.preys.forEach((p, k) => {
      const L = lay[k % 3];
      p.x = b.x + L.x * b.w; p.y = b.y + L.y * b.h;
      p.swimAng = L.a; p._visAng = L.a; p.introT = 0; p.fade = 1;
    });
  });

  for (let i = 0; i < 3; i++) {
    await place();
    await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(OUT, `shot-creek-${i + 1}.png`) });
    await page.waitForTimeout(500);
  }
  console.log("done");
  await browser.close();
})();
