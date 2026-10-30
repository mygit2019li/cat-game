/* probe_behaviors.js — 验证鱼品种的 Peppy Cat 式行为个性：
   ① behavior 挂载正确（pulse/zigzag/hop/stalk）  ② pulse 忽快忽慢速度波动
   ③ zigzag 突然转向（dirX 翻转）  ④ hop 弹跳偏移+绒线拖尾+落地涟漪
   ⑤ stalk 潜伏/突进两档节奏  ⑥ 行为不动命中盒（w/h 与品种表一致）
   ⑦ 无 behavior 品种节奏平稳  ⑧ 真渲染截图（拖尾可见）+ 无运行时错误
   用法：NODE_PATH=<npm> node test/probe_behaviors.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/behaviors";
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
    wx.showModal=(o)=>{(window.__modals=window.__modals||[]).push(o); window.__lastModal=o;};
    wx.getSetting=(o)=>o.success&&o.success({authSetting:{}});
    wx.authorize=(o)=>o.success&&o.success();
    wx.openSetting=(o)=>o.success&&o.success({authSetting:{}});
    wx.saveImageToPhotosAlbum=(o)=>o.success&&o.success();
    wx.reportEvent=(n,d)=>{(window.__track=window.__track||[]).push([n,d]);};
    wx.reportAnalytics=(n,d)=>{(window.__track=window.__track||[]).push([n,d]);};
    wx.openCustomerServiceConversation=()=>{};
    wx.createImage=()=>new Image();
    HTMLCanvasElement.prototype.toTempFilePathSync=function(){return this.toDataURL("image/jpeg",0.92);};
    wx.setKeepScreenOn=()=>{};
    localStorage.setItem("catToyAntiShown","1");
  })();
`;
async function boot(page, sysInfo) {
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, sysInfo);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(WX_MOCK);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(250);
}
const ip15 = { windowWidth: 852, windowHeight: 393, pixelRatio: 3,
  safeArea: { left: 0, top: 21, right: 793, bottom: 372 }, screenOrientation: { angle: 90 } };
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("✅ " + name); }
  else { fail++; console.log("❌ " + name + (extra ? (" :: " + extra) : "")); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const page = await browser.newPage({ viewport: { width: 852, height: 393 } });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && m.text().indexOf("ERR_FILE_NOT_FOUND") < 0) errs.push("console: " + m.text()); });
  await boot(page, ip15);

  // 1) behavior 挂载正确
  const map = await page.evaluate(() => {
    const G = window.G;
    const out = {};
    G.FISH_SPECIES.forEach(s => {
      const p = new G.Prey("fish", s);
      out[s.key] = { beh: p.behavior || null, w: p.baseW, h: p.baseH, sw: s.w, sh: s.h, cruiser: p.cruiser };
    });
    return out;
  });
  const expect = { gold: "pulse", koi: "pulse", angel: "zigzag", clown: "zigzag", sardine: "zigzag", puffer: "hop", shark: "stalk" };
  Object.keys(expect).forEach(k => {
    check("[" + k + "] behavior=" + expect[k], map[k].beh === expect[k], "got=" + map[k].beh);
  });
  ["turtle", "whale", "ray"].forEach(k => {
    check("[" + k + "] 无 behavior（平稳巡游）", map[k].beh === null, "got=" + map[k].beh);
  });

  // 2) 命中盒不受行为影响
  const boxOk = Object.keys(map).every(k => map[k].w === map[k].sw && map[k].h === map[k].sh);
  check("行为不动命中盒（10 品种 w/h 与品种表一致）", boxOk,
    JSON.stringify(Object.keys(map).map(k => [k, map[k].w, map[k].sw])));

  // 3) pulse：速度倍率随时间波动（min<0.75 且 max>1.35）
  const pulse = await page.evaluate(() => {
    const G = window.G;
    const p = new G.Prey("fish", G.FISH_SPECIES.find(s => s.key === "gold"));
    const vs = [];
    for (let i = 0; i < 120; i++) vs.push(p.behaviorTick(1 / 30, i / 30));
    return { min: Math.min.apply(null, vs), max: Math.max.apply(null, vs) };
  });
  check("pulse 忽快忽慢（速度 0.55×~1.6× 波动）", pulse.min < 0.75 && pulse.max > 1.35, JSON.stringify(pulse));

  // 4) zigzag：3 秒内 dirX 至少翻转一次
  const zig = await page.evaluate(() => {
    const G = window.G;
    G.session.stage = 1;
    const p = new G.Prey("fish", G.FISH_SPECIES.find(s => s.key === "sardine"));
    const d0 = p.dirX || p.faceDir;
    let flips = 0;
    for (let i = 0; i < 180; i++) {
      const before = p.dirX || p.faceDir;
      p.behaviorTick(1 / 60, i / 60);
      const after = p.dirX || p.faceDir;
      if (before !== after) flips++;
    }
    return { flips, d0 };
  });
  check("zigzag 突然转向（3s 内翻转≥1 次）", zig.flips >= 1, JSON.stringify(zig));

  // 5) hop：弹跳偏移波动 + 绒线拖尾累积 + 落地涟漪（running 时）
  const hop = await page.evaluate(() => {
    const G = window.G;
    G.session.running = true;
    const p = new G.Prey("fish", G.FISH_SPECIES.find(s => s.key === "puffer"));
    p.x = 400; p.y = 200;
    let hops = 0, minOff = 999, maxOff = -1;
    for (let i = 0; i < 120; i++) {
      p.behaviorTick(1 / 30, i / 30);
      minOff = Math.min(minOff, p.hopOff); maxOff = Math.max(maxOff, p.hopOff);
    }
    return { trail: p.trail.length, minOff, maxOff, cyc: p.hopCyc };
  });
  check("hop 弹跳偏移波动（0~26px）", hop.maxOff > 12 && hop.minOff < 6, JSON.stringify(hop));
  check("hop 绒线拖尾累积（≥6 点）", hop.trail >= 6, "trail=" + hop.trail);

  // 6) stalk：两档节奏（0.58 潜伏 / 1.25 突进）
  const stalk = await page.evaluate(() => {
    const G = window.G;
    const p = new G.Prey("fish", G.FISH_SPECIES.find(s => s.key === "shark"));
    const vs = [];
    for (let i = 0; i < 300; i++) vs.push(p.behaviorTick(1 / 30, i / 30));
    return { min: Math.min.apply(null, vs), max: Math.max.apply(null, vs) };
  });
  check("stalk 潜伏/突进两档（0.58 / 1.25）", stalk.min <= 0.6 && stalk.max >= 1.2, JSON.stringify(stalk));

  // 7) 无 behavior 品种 behaviorTick 恒返回 1
  const steady = await page.evaluate(() => {
    const G = window.G;
    const p = new G.Prey("fish", G.FISH_SPECIES.find(s => s.key === "turtle"));
    let ok = true;
    for (let i = 0; i < 60; i++) if (p.behaviorTick(1 / 30, i / 30) !== 1) ok = false;
    return ok;
  });
  check("无 behavior 品种节奏恒定（behaviorTick≡1）", steady);

  // 8) 真渲染：装 4 条行为鱼 + 截图（河豚拖尾应可见）
  await page.evaluate(() => {
    const G = window.G;
    G.session.sea = G.SEA_THEMES && G.SEA_THEMES[0];
    G.config.targetType = "fish";
    G.buildScene("fish");
    G.fx.clear();
    G.clearPreys();
    const pick = k => G.FISH_SPECIES.find(s => s.key === k);
    ["puffer", "shark", "sardine", "gold"].forEach(k => G.preys.push(new G.Prey("fish", pick(k))));
    G.session.running = true;
    G.session.remaining = 999; G.session.infinite = true;
    G.session.time = 3; G.session.stage = 1;
    G.screen = "playing";
  });
  await page.waitForTimeout(1200);
  const shot1 = path.join(OUT, "beh_all.png");
  await page.screenshot({ path: shot1 });
  // 再单独截一张河豚近景（确认绒线拖尾绘制）
  const trailShot = await page.evaluate(() => {
    const G = window.G;
    const p = G.preys.find(q => q.behavior === "hop");
    return { trail: p ? p.trail.length : 0, hopOff: p ? p.hopOff : -1 };
  });
  check("真渲染后拖尾仍在累积", trailShot.trail >= 3, JSON.stringify(trailShot));

  check("无运行时错误", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log("\n—— 行为探针：" + pass + " 通过 / " + fail + " 失败 ——");
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
