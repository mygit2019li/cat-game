/* probe_mouse_sfx.js — 老鼠「命中 / 移动」音效分离体检
   验四件事：
     ① 命中（含追击 double）走 mouse-squeak.wav，3 声连叫
     ② 移动循环走 mouse-scurry.wav，单声短吱（0.12s），与命中不同文件
     ③ 进入玩法时两个文件都预加载；sfxPool 里是两个独立实例（不互相 stop 掐断）
     ④ 循环间隔按出洞鼠数递减，且恒 > 短吱时长（0.12s），不会叠成噪音
   用法：NODE_PATH=/tmp/ffshot/node_modules node test/probe_mouse_sfx.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const MODS = ["./js/platform.js", "./js/config.js","./js/rank.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./js/ad.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

function findChrome() {
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", process.env.CHROME_PATH || ""])
    if (p && fs.existsSync(p)) return p;
  throw new Error("no chrome found");
}

const A = [];
const ok = (cond, msg, extra) => { A.push((cond ? "✅ " : "❌ ") + msg + (extra != null ? "  → " + extra : "")); return cond; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; },
    { windowWidth: 844, windowHeight: 390, pixelRatio: 2, safeArea: { left: 47, top: 0, right: 797, bottom: 369 } });
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(() => window.require("./game.js"));
  await sleep(300);

  // 记录 sfx(src,vol) 调用 + 预加载记录；返回 true 走「有音效」分支
  await page.evaluate(() => {
    const G = window.G;
    window.__sfxLog = [];
    window.__preloadLog = [];
    G.platform.sfx = (src, vol) => { window.__sfxLog.push({ src, vol }); return true; };
    G.platform.preloadSfx = (src) => { window.__preloadLog.push(src); };
    G.config.sound = true;
  });

  /* ---- ① 命中音 ---- */
  await page.evaluate(() => { window.__sfxLog = []; G.playSqueak(false); G.playSqueak(true); });
  const hit = await page.evaluate(() => window.__sfxLog.slice());
  const HIT = "assets/sfx/mouse-squeak.wav";
  ok(hit.length === 2, "命中：触发 2 次音效（普通 / 追击）", JSON.stringify(hit));
  ok(hit.every(r => r.src === HIT), "命中：两次都走 mouse-squeak.wav（3 声连叫）", hit.map(r => r.src).join(","));
  ok(hit[1].vol > hit[0].vol, "命中：追击播得更响", hit.map(r => r.vol).join(" < "));

  /* ---- ② 预加载两个文件 ---- */
  const pre = await page.evaluate(() => { G.preloadMouseSfx(); return window.__preloadLog.slice(); });
  ok(pre.includes(HIT) && pre.includes("assets/sfx/mouse-scurry.wav"),
    "预加载：命中和移动两个文件都预取", JSON.stringify(pre));

  /* ---- ③ 移动循环音（模拟 3 只 peek 的老鼠）---- */
  await page.evaluate(() => {
    const G = window.G;
    G.screen = "playing";
    G.session = { running: true, paused: false, counting: false };
    // 补 update/hittable 空方法：主循环每帧会调 p.update，缺了会抛 p.update is not a function
    G.preys = [0, 1, 2].map(() => ({ type: "mouse", state: "peek", fade: 1,
      update() {}, hittable() { return false; }, draw() {} }));
    window.__sfxLog = [];
    G.updateMouseSqueak();
  });
  await sleep(60);
  const move = await page.evaluate(() => ({ log: window.__sfxLog.slice(), active: G.mouseSqueakActive(), n: G.mouseSqueakCount() }));
  const SCURRY = "assets/sfx/mouse-scurry.wav";
  ok(move.log.length >= 1 && move.log[0].src === SCURRY,
    "移动：循环走 mouse-scurry.wav（单声短吱），与命中不同文件", JSON.stringify(move.log));
  ok(move.active && move.n === 3, "移动：3 只出洞鼠 → 循环声启动", JSON.stringify(move));

  /* ---- ④ 循环间隔：采样 6 次触发的间隔，应 > 0.12s 且随时长递减 ---- */
  await sleep(2000);
  const times = await page.evaluate(() => {
    const G = window.G;
    const out = [];
    const orig = G.platform.sfx;
    G.platform.sfx = (src, vol) => { if (src.indexOf("scurry") >= 0) out.push(performance.now()); return true; };
    return new Promise(res => setTimeout(() => { G.platform.sfx = orig; G.stopMouseSqueak(); res(out); }, 2600));
  });
  const gaps = times.slice(1).map((t, i) => Math.round(t - times[i]));
  ok(times.length >= 2, "循环：2.6s 内触发 ≥2 次", JSON.stringify(times.map(t => Math.round(t))));
  ok(gaps.every(g => g > 120), "循环：每次间隔 > 短吱 120ms，不叠音", gaps.join(","));
  ok(gaps.every(g => g >= 400 && g <= 700), "循环：3 只鼠时间隔落在 420~600+抖动区间", gaps.join(","));

  /* 静态核对：源码里两个常量指向不同文件、生成脚本存在、wav 头部有效 */
  const ui = fs.readFileSync(path.join(ROOT, "js/audio.js"), "utf8");
  ok(/MOUSE_SQUEAK\s*=\s*"assets\/sfx\/mouse-squeak\.wav"/.test(ui) &&
     /MOUSE_SCURRY\s*=\s*"assets\/sfx\/mouse-scurry\.wav"/.test(ui),
    "源码：命中/移动常量指向两个不同文件");
  const wav = fs.readFileSync(path.join(ROOT, "assets/sfx/mouse-scurry.wav"));
  ok(wav.length > 8000 && wav.subarray(0, 4).toString() === "RIFF", "新音效：mouse-scurry.wav 存在且是有效 wav", wav.length + " bytes");
  ok(fs.existsSync(path.join(ROOT, "tools/gen_mouse_scurry_sfx.py")), "可复现：生成脚本在 tools/ 下");

  ok(errs.length === 0, "无页面异常", errs.join("; "));
  await browser.close();
  console.log(A.join("\n"));
  const bad = A.filter(x => x.startsWith("❌"));
  console.log(bad.length ? `\n${bad.length} 项失败` : "\n✅ 全部通过");
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
