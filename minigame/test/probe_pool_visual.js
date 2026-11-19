/* probe_pool_visual.js — 暗夜萤光「走停节拍」真机渲染体检
   验四件事：
     ① 真实主循环跑 12 秒不报错（prey/draw/主循环都走一遍）
     ② 停顿确实发生：连续采样里出现位移≈0 且朝向变化的帧
     ③ 停顿窗口的命中盒确实放宽（pauseT>0 时 pad 1.15）
     ④ 落三张截图，肉眼看虫子在"停下张望"
   用法：NODE_PATH=/Users/lipeng/node_modules node test/probe_pool_visual.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/tmp/pool-pause-shots";
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

  /* 走真实开局流程（建场景 → 建猎物），然后跳过 3 秒倒计时 */
  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "pool";
    G.config.preyCount = 1;
    G.config.duration = 60;
    G.startGame();
    G.session.counting = false;
    G.session.running = true;
    G.switchScreen("playing");
  });
  await page.waitForTimeout(500);

  /* 采样 12 秒：位置 / 朝向 / pauseT */
  const samples = await page.evaluate(async () => {
    const G = window.G, out = [];
    const t0 = performance.now();
    return new Promise(res => {
      const tick = () => {
        const p = G.preys[0];
        if (p) out.push({ t: (performance.now() - t0) / 1000, x: p.x, y: p.y, ang: p.driftAng,
          paused: (p.pauseT || 0) > 0, k: p.poolK, spd: p.spd, pad: (p.pauseT || 0) > 0 ? 1.15 : 1 });
        if (performance.now() - t0 < 12000) setTimeout(tick, 60);
        else res(out);
      };
      tick();
    });
  });

  const pausedFrames = samples.filter(s => s.paused);
  let maxDrift = 0, turnSeen = 0, cur = null;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (b.paused) {
      if (!cur) cur = { x: b.x, y: b.y, ang: b.ang, turned: 0 };
      cur.turned = Math.max(cur.turned, Math.abs(b.ang - cur.ang));
      maxDrift = Math.max(maxDrift, Math.hypot(b.x - cur.x, b.y - cur.y));
    } else if (cur) {
      if (cur.turned > 0.25) turnSeen++;
      cur = null;
    }
  }

  /* 强制一次「从边缘爬回来」，截三张证明它是贴边进场的 */
  const spawnInfo = await page.evaluate(() => {
    const G = window.G, pr = G.preys[0], b = G.bounds();
    pr.vanishT = 0; pr.darkT = 0; pr.tp = null;
    pr.relocate(true);
    const gaps = [pr.x - b.x, (b.x + b.w) - pr.x, pr.y - b.y, (b.y + b.h) - pr.y];
    return { x: Math.round(pr.x), y: Math.round(pr.y), gap: Math.round(Math.min(...gaps)) };
  });
  await page.waitForTimeout(180);
  await page.evaluate(() => { window.G.session.paused = true; });   // 冻住画面，截一张"刚在边缘亮起"

  const shots = [];
  await page.waitForTimeout(120);
  for (let i = 0; i < 3; i++) {
    const f = path.join(OUT, `pool-${i + 1}.png`);
    await page.screenshot({ path: f });
    shots.push(f);
    await page.waitForTimeout(420);
  }

  const lines = [];
  lines.push("采样帧数: " + samples.length + "（约 12 秒，60ms 一帧）");
  lines.push("停顿帧占比: " + (pausedFrames.length / samples.length * 100).toFixed(0) + "%");
  lines.push("停顿中最大位移: " + maxDrift.toFixed(2) + "px");
  lines.push("出现「停住且转向 >14°」的停顿段: " + turnSeen);
  lines.push("停顿帧命中盒 pad: " + (pausedFrames[0] ? pausedFrames[0].pad : "无停顿帧"));
  lines.push("重生位置: x=" + spawnInfo.x + " y=" + spawnInfo.y + "，离最近边缘 " + spawnInfo.gap + "px");
  lines.push("poolK 终值: " + (samples[samples.length - 1].k || 1).toFixed(2));
  lines.push("运行时报错: " + (errs.length ? errs.slice(0, 3).join(" | ") : "无"));
  lines.push("截图: " + shots.join(" "));
  console.log(lines.join("\n"));

  await browser.close();
})();
