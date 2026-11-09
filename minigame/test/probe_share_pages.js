/* probe_share_pages.js — 召唤猫咪 / 电子猫粮 两页的分享键体检
   验的四件事：
     ① 两页各有一颗分享键（summon-share / feeder-share），命中区内、不越界、不压其他键
     ② 点下去真的拉起转发：文案跟页面内容对得上、query 带 from=summon|feeder、带测评图
     ③ 分享图是这两页专属的「页面卡」，不是本局成绩卡（格子里的字能认出来）
     ④ 电子猫粮页顶部三颗圆键（返回/设置/分享）等距等高，标题排在最后
   用法：NODE_PATH=<npm 模块目录> node test/probe_share_pages.js
   截图：/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/share-pages
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = "/Users/lipeng/Documents/ChatGPT/小猫游戏/_排查截图存档/share-pages";
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

/* 分享 / 相册相关的 API 垫片：toTempFilePathSync 直接给 dataURL，
   这样转发参数里的 imageUrl 是真实画出来的分享卡，可以直接落盘看图 */
const WX_MOCK = `
  (function(){
    const wx = window.wx;
    wx.shareAppMessage=(o)=>{(window.__shares=window.__shares||[]).push(o);};
    wx.onShareAppMessage=(fn)=>{window.__shareFactory=fn;};
    wx.showShareMenu=()=>{};
    wx.showToast=(o)=>{(window.__toasts=window.__toasts||[]).push(o);};
    wx.showModal=(o)=>{(window.__modals=window.__modals||[]).push(o);};
    wx.reportAnalytics=(n,d)=>{(window.__track=window.__track||[]).push([n,d]);};
    wx.reportEvent=(n,d)=>{(window.__track=window.__track||[]).push([n,d]);};
    HTMLCanvasElement.prototype.toTempFilePathSync=function(){return this.toDataURL("image/jpeg",0.9);};
    HTMLCanvasElement.prototype.toTempFilePath=function(o){ o&&o.success&&o.success({tempFilePath:this.toDataURL("image/jpeg",0.9)}); };
  })();
`;

const A = [];
const ok = (cond, msg, extra) => { A.push((cond ? "✅ " : "❌ ") + msg + (extra != null ? "  → " + extra : "")); return cond; };

async function boot(page, sysInfo) {
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(s => { window.__sysInfo = s; }, sysInfo);
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(WX_MOCK);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(320);
}

/* 在页面里按 key 点按钮（走真实 hitButton 路由） */
const CLICK = (k) => {
  const G = window.G;
  const b = G.ui.buttons.slice().reverse().find(b => b.key === k);
  if (!b) return false;
  return G.hitButton(b.x + b.w / 2, b.y + b.h / 2);
};
const rectOf = (k) => {
  const G = window.G;
  const b = G.ui.buttons.slice().reverse().find(b => b.key === k);
  if (!b) return null;
  return { x: Math.round(b.x), y: Math.round(b.y), w: b.w, h: b.h, r: Math.round(b.x + b.w), b: Math.round(b.y + b.h) };
};
const lastShare = () => {
  const s = (window.__shares || []).slice(-1)[0] || null;
  if (!s) return null;
  return { title: s.title || "", query: s.query || "", hasImg: !!s.imageUrl, img: String(s.imageUrl || "") };
};

const port = { windowWidth: 390, windowHeight: 844, pixelRatio: 2,
  safeArea: { left: 0, top: 47, right: 390, bottom: 810 } };
const land = { windowWidth: 844, windowHeight: 390, pixelRatio: 2,
  safeArea: { left: 47, top: 0, right: 797, bottom: 369 } };

/* 把 dataURL 落成 png，方便肉眼看分享卡 */
function dumpImg(dataUrl, name) {
  const m = /^data:image\/\w+;base64,(.+)$/.exec(String(dataUrl || ""));
  if (!m) return "";
  const p = path.join(OUT, name);
  fs.writeFileSync(p, Buffer.from(m[1], "base64"));
  return p;
}

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];

  /* ============ 竖屏 ============ */
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => {
    const s = m.text();
    if (m.type() === "error" && !/ERR_FILE_NOT_FOUND|ERR_UNKNOWN_URL_SCHEME/.test(s)) errs.push("console: " + s);
  });
  await boot(page, port);

  /* ---------- ① 召唤猫咪页 ---------- */
  await page.evaluate(() => { window.G.summonPick = null; window.G.switchScreen("summon"); });
  await page.waitForTimeout(500);
  let r = await page.evaluate(rectOf, "summon-share");
  ok(!!r, "召唤猫咪页有分享键（summon-share）", JSON.stringify(r));
  const geo1 = await page.evaluate(() => {
    const G = window.G, P = G.platform;
    const W = P.W / (P.S || 1), H = P.H / (P.S || 1);
    const sf = P.safe || {};
    const find = k => G.ui.buttons.slice().reverse().find(b => b.key === k);
    const sh = find("summon-share"), op = find("edit-open");
    // 主按钮（开始召唤）没有 key：按 176×46 这个尺寸找；返回键也没 key，按 (safe.left+16, safe.top+14) 推算
    const play = G.ui.buttons.find(b => Math.round(b.w) === 176 && Math.round(b.h) === 46);
    const backR = Math.round((sf.left || 0) / (P.S || 1)) + 16 + 42;
    return {
      W: Math.round(W), H: Math.round(H), backR,
      sh: sh && { x: Math.round(sh.x), y: Math.round(sh.y), r: Math.round(sh.x + sh.w), b: Math.round(sh.y + sh.h) },
      play: play && { x: Math.round(play.x), y: Math.round(play.y), r: Math.round(play.x + play.w), b: Math.round(play.y + play.h) },
      op: op && { x: Math.round(op.x), r: Math.round(op.x + op.w) },
      safeBottom: Math.round((sf.bottom || 0) / (P.S || 1))
    };
  });
  ok(geo1.sh.r <= geo1.W && geo1.sh.b <= geo1.H - geo1.safeBottom + 1 && geo1.sh.x >= 0 && geo1.sh.y >= 0,
    "分享键在安全区内", JSON.stringify(geo1.sh) + " / 屏 " + geo1.W + "×" + geo1.H);
  ok(geo1.sh.x >= geo1.play.r + 4, "分享键不压「开始召唤」", geo1.sh.x + " vs 主键右沿 " + geo1.play.r);
  ok(geo1.sh.y === geo1.play.y && geo1.sh.b === geo1.play.b, "分享键与主键等高等底", geo1.sh.y + ".." + geo1.sh.b);
  ok(geo1.op.x >= geo1.backR, "顶部两颗键互不重叠（没被改动）", geo1.backR + " → " + geo1.op.x);
  await page.screenshot({ path: path.join(OUT, "01-summon-portrait.png") });

  await page.evaluate(CLICK, "summon-share");
  await page.waitForTimeout(300);
  let sh = await page.evaluate(lastShare);
  ok(!!sh, "点分享键拉起了转发", sh && sh.title);
  ok(sh && /召唤|叫得动/.test(sh.title), "文案跟「召唤」对得上", sh && sh.title);
  ok(sh && sh.query === "from=summon", "落地来源 from=summon", sh && sh.query);
  ok(sh && sh.hasImg, "带上了分享图", sh && sh.img.slice(0, 26));
  const summonImg = dumpImg(sh && sh.img, "card-summon.png");
  const track1 = await page.evaluate(() => (window.__track || []).filter(t => t[0] === "share_tap").map(t => t[1]));
  ok(track1.length > 0 && track1[track1.length - 1].src === "summon", "埋点 share_tap src=summon", JSON.stringify(track1));

  /* ---------- ② 电子猫粮页 ---------- */
  await page.evaluate(() => { window.G.switchScreen("home"); });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.G.feederEnter());
  await page.waitForTimeout(500);
  r = await page.evaluate(rectOf, "feeder-share");
  ok(!!r, "电子猫粮页有分享键（feeder-share）", JSON.stringify(r));
  const geo2 = await page.evaluate(() => {
    const G = window.G, P = G.platform, S = P.S || 1;
    const W = P.W / S, H = P.H / S;
    const keys = G.ui.buttons.filter(b => b.w === 34 && b.h === 34)
      .map(b => ({ k: b.key || "?", x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.x + b.w) }))
      .sort((a, b) => a.x - b.x);
    const sf = P.safe || {};
    return { W: Math.round(W), H: Math.round(H), keys, safeBottom: Math.round((sf.bottom || 0) / S),
      safeLeft: Math.round((sf.left || 0) / S) };
  });
  const names = geo2.keys.map(k => k.k).join(">");
  ok(names === "back>settings>feeder-share", "顶部三颗圆键顺序：返回 > 设置 > 分享", names);
  ok(geo2.keys.every(k => k.y === geo2.keys[0].y), "三颗圆键同高", JSON.stringify(geo2.keys.map(k => k.y)));
  ok(geo2.keys[1].x - geo2.keys[0].r === 8 && geo2.keys[2].x - geo2.keys[1].r === 8,
    "三颗圆键间距都是 8px", [geo2.keys[1].x - geo2.keys[0].r, geo2.keys[2].x - geo2.keys[1].r].join(" / "));
  ok(geo2.keys[0].x === geo2.safeLeft + 12, "左边距 12（与首页齿轮对齐）", geo2.keys[0].x + " / safeLeft " + geo2.safeLeft);
  ok(geo2.keys[2].r < geo2.W * 0.5, "分享键没顶到中场，标题有位置", geo2.keys[2].r + " vs " + Math.round(geo2.W / 2));
  await page.screenshot({ path: path.join(OUT, "02-feeder-portrait.png") });

  await page.evaluate(CLICK, "feeder-share");
  await page.waitForTimeout(300);
  sh = await page.evaluate(lastShare);
  ok(sh && /猫粮|出粮|喂/.test(sh.title), "文案跟「电子猫粮」对得上", sh && sh.title);
  ok(sh && sh.query === "from=feeder", "落地来源 from=feeder", sh && sh.query);
  ok(sh && sh.hasImg, "带上了分享图", sh && sh.img.slice(0, 26));
  const feederImg = dumpImg(sh && sh.img, "card-feeder.png");
  const track2 = await page.evaluate(() => (window.__track || []).filter(t => t[0] === "share_tap").map(t => t[1]));
  ok(track2.length > 0 && track2[track2.length - 1].src === "feeder", "埋点 share_tap src=feeder", JSON.stringify(track2));

  // 分享键不能盖住设置键的功能：点设置仍能开弹窗
  await page.evaluate(CLICK, "settings");
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => window.G.feeder.mode === "modal"), "分享键加进来后设置键照常开弹窗");
  await page.evaluate(CLICK, "modal-close");
  await page.waitForTimeout(160);
  await page.screenshot({ path: path.join(OUT, "03-feeder-after-share.png") });

  // 出粮演出时分享键必须一起隐藏（不然会在舞台上层飘一颗键）
  await page.evaluate(CLICK, "feed");
  await page.waitForTimeout(500);
  const during = await page.evaluate(() => ({ e: window.G.feeder.e, keys: window.G.ui.buttons.map(b => b.key).filter(Boolean) }));
  ok(during.e > 0.9 && during.keys.indexOf("feeder-share") < 0, "出粮演出中分享键随常态 UI 一起隐藏", during.keys.join(","));
  await page.waitForTimeout(5200);

  /* ---------- ③ 横屏兜底 ---------- */
  const p2 = await browser.newPage({ viewport: { width: 844, height: 390 } });
  p2.on("pageerror", e => errs.push("land pageerror: " + e.message));
  await boot(p2, land);
  await p2.evaluate(() => window.G.switchScreen("summon"));
  await p2.waitForTimeout(420);
  const l1 = await p2.evaluate(rectOf, "summon-share");
  ok(!!l1 && l1.x >= 0 && l1.r <= 844 && l1.b <= 390, "横屏召唤页分享键在屏内", JSON.stringify(l1));
  await p2.screenshot({ path: path.join(OUT, "04-summon-land.png") });
  await p2.evaluate(() => { window.G.switchScreen("home"); });
  await p2.waitForTimeout(200);
  await p2.evaluate(() => window.G.feederEnter());
  await p2.waitForTimeout(420);
  const l2 = await p2.evaluate(() => {
    const G = window.G, P = G.platform, S = P.S || 1;
    const W = P.W / S, H = P.H / S, sf = P.safe || {};
    const x0 = (sf.left || 0) / S, y0 = (sf.top || 0) / S, x1 = W - (sf.right || 0) / S, y1 = H - (sf.bottom || 0) / S;
    const bad = G.ui.buttons.filter(b => b.x < x0 - 1 || b.y < y0 - 1 || b.x + b.w > x1 + 1 || b.y + b.h > y1 + 1)
      .map(b => b.key || "?");
    return { bad, n: G.ui.buttons.length };
  });
  ok(l2.bad.length === 0, "横屏猫粮页按钮全部在安全区内", l2.bad.join(",") || l2.n + " 个按钮");
  await p2.screenshot({ path: path.join(OUT, "05-feeder-land.png") });

  await browser.close();

  console.log("\n===== 页面分享键 体检 =====");
  A.forEach(s => console.log(s));
  console.log("\n分享卡：\n  " + (summonImg || "(未生成)") + "\n  " + (feederImg || "(未生成)"));
  console.log("截图：" + OUT);
  if (errs.length) { console.log("\n运行时错误："); errs.forEach(e => console.log("  ❌ " + e)); }
  else console.log("✅ 无运行时错误");
  const bad = A.filter(s => s.startsWith("❌")).length;
  console.log(bad ? "\n❌ 失败 " + bad + " 项" : "\n✅ 全部通过");
  if (bad) process.exit(1);
})();
