/* probe_friend_rank_entry.js —— 好友排行首页入口 + 授权 + ODC 消息链
   验四件事：
     ① 首页底栏有 5 个入口，第 5 个回调打开 lb 弹窗
     ② 打开 lb 时在同一手势里申请好友授权（而不是延后到绘制帧）
     ③ 已授权 → 向开放数据域发 refresh + show；拒绝态 → 不发 show、引导去设置
     ④ 结算写入猎手分：setUserCloudStorage 收到 rankScore/rankTs/rankMode/rankDiff
   用法：NODE_PATH=... node test/probe_friend_rank_entry.js */
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(__dirname, "..");
const MODS = ["./js/platform.js", "./js/config.js", "./js/rank.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js", "./js/ad.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const A = [];
const ok = (c, m, e) => { A.push((c ? "✅ " : "❌ ") + m + (e != null ? "  → " + e : "")); return c; };

const STUB = `
(function(){
  window.__cloudWrites = [];
  window.wx.setUserCloudStorage = (o) => { window.__cloudWrites.push(JSON.parse(JSON.stringify(o.KVDataList||[]))); };
  window.__authSetting = {}; window.__authStub = 'grant';
})();`;

async function boot(page) {
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(STUB);
  await page.evaluate(() => window.require("./game.js"));
  await sleep(250);
}

(async () => {
  const b = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const errs = [];
  const p = await b.newPage({ viewport: { width: 844, height: 390 } });
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  await boot(p);

  // 记录主域是否把 ODC 离屏画布贴到上屏（不贴 = 榜单永远空白）
  await p.evaluate(() => {
    window.__blits = [];
    const c = G.platform.ctx.drawImage.bind(G.platform.ctx);
    G.platform.ctx.drawImage = function (img) {
      if (img === G.platform.odcCanvas) window.__blits.push([img.width, img.height]);
      return c.apply(this, arguments);
    };
  });

  // G.assetsReady=false 时触摸不响应；探针直接断言 ui.buttons 注册与回调
  let s = await p.evaluate(() => {
    const btns = G.ui.buttons.slice();
    const bottom = btns.filter(b => b.h === 60);
    return { count: bottom.length, screen: G.screen, labels: bottom.map(b => b.key || "") };
  });
  ok(s.count === 5, "首页底栏注册 5 个入口", JSON.stringify(s));

  // 逐个执行底栏回调，找到打开 lb 的那个
  const lbIdx = await p.evaluate(() => {
    const btns = G.ui.buttons.slice().filter(b => b.h === 60);
    for (let i = 0; i < btns.length; i++) {
      G.screen = "home";
      try { btns[i].cb(); } catch (e) {}
      if (G.screen === "leaderboard") return i;
    }
    return -1;
  });
  ok(lbIdx === 4, "第 5 个底栏入口打开好友排行", "idx=" + lbIdx);

  s = await p.evaluate(() => ({ authCalls: window.__authCalls || 0, auth: G.friendAuthState }));
  ok(s.authCalls === 0 && s.auth !== "ok", "进入榜单不再自动弹授权", JSON.stringify(s));

  // 点榜单底部合并入口，才在同一次手势里申请好友授权
  await p.evaluate(() => G.enableLbFeatures());
  await sleep(250);
  s = await p.evaluate(() => ({ authCalls: window.__authCalls || 0, auth: G.friendAuthState }));
  ok(s.authCalls >= 1 && s.auth === "ok", "点合并入口后拿到好友授权", JSON.stringify(s));

  // 上面逐个执行按钮回调会顺带触发开始游戏，重新干净地打开一次 lb 再验 ODC 消息
  await p.evaluate(() => { G.switchScreen("home"); G.openModal("lb"); });
  await sleep(700);
  s = await p.evaluate(() => ({
    msgs: (window.__odcMsgs || []).slice(-4),
    hasRefresh: (window.__odcMsgs || []).some(m => m.type === "refresh"),
    hasShow: (window.__odcMsgs || []).some(m => m.type === "show")
  }));
  ok(s.hasRefresh && s.hasShow, "已授权 → ODC 收到 refresh + show", JSON.stringify(s.msgs));

  s = await p.evaluate(() => ({
    hasCanvas: !!G.platform.odcCanvas,
    cw: G.platform.odcCanvas && G.platform.odcCanvas.width,
    ch: G.platform.odcCanvas && G.platform.odcCanvas.height,
    blits: (window.__blits || []).length,
    lastBlit: (window.__blits || []).slice(-1)[0]
  }));
  ok(s.hasCanvas && s.cw === 844 * 2 && s.ch === 390 * 2,
    "sharedCanvas 由主域按 W*dpr 设尺寸", JSON.stringify({ cw: s.cw, ch: s.ch }));
  ok(s.blits > 0, "主域每帧 drawImage 离屏画布到上屏（榜单可见的关键）", "frames=" + s.blits);

  // 结算写入：直接调 endGame 需要 session，构造最小 session
  s = await p.evaluate(() => {
    G.config.targetType = "laser"; G.config.difficulty = "hard"; G.config.duration = 60;
    G.session = { hits: 30, bonusHits: 0, touches: 30, time: 60, maxCombo: 5, running: true,
      dartHits: 0, escapes: 0, _keepOn: true };
    G.endGame(false);
    const w = window.__cloudWrites.slice();
    const rank = w.filter(kv => kv.some(x => x.key === "rankScore")).pop() || [];
    const map = {}; rank.forEach(x => map[x.key] = x.value);
    return { map, local: localStorage.getItem("catToyRankBest") };
  });
  ok(s.map.rankScore === "62" && s.map.rankMode === "laser" && s.map.rankDiff === "hard",
    "结算写入归一化猎手分 KV（激光 hard 30/60s = 62）", JSON.stringify(s.map));
  ok(!!s.local && JSON.parse(s.local).score === 62, "本地最高分同步写入", s.local);

  // 结算后重新开榜：show 消息必须把本地存档的自己成绩带进 ODC（关系链读不到自己时的兜底）
  await p.evaluate(() => {
    window.__odcMsgs.length = 0;
    G.switchScreen("home"); G.openModal("lb");
  });
  await sleep(700);
  s = await p.evaluate(() => {
    const sh = (window.__odcMsgs || []).filter(m => m.type === "show").pop() || {};
    return { hasSelf: !!sh.self, score: sh.self && sh.self.score, mode: sh.self && sh.self.mode };
  });
  ok(s.hasSelf && s.score === 62 && s.mode === "laser",
    "show 消息带 self={score:62,mode:laser}，自己那行有可靠兜底", JSON.stringify(s));

  // 已授权玩家静默进榜：不弹 authorize，状态直接是 ok
  const p3 = await b.newPage({ viewport: { width: 844, height: 390 } });
  p3.on("pageerror", e => errs.push("pageerror(granted): " + e.message));
  await boot(p3);
  await p3.evaluate(() => {
    window.__authSetting = { "scope.WxFriendInteraction": true };
    G.openModal("lb");
  });
  await sleep(250);
  s = await p3.evaluate(() => ({ authCalls: window.__authCalls || 0, auth: G.friendAuthState }));
  ok(s.authCalls === 0 && s.auth === "ok", "已授权玩家静默进榜、不重复弹窗", JSON.stringify(s));
  await p3.close();

  // 拒绝授权场景
  const p2 = await b.newPage({ viewport: { width: 844, height: 390 } });
  p2.on("pageerror", e => errs.push("pageerror(deny): " + e.message));
  await boot(p2);
  await p2.evaluate(() => {
    window.__authStub = "deny"; G.friendAuthState = "unknown"; G.openModal("lb"); G.enableLbFeatures();
  });
  await sleep(250);
  s = await p2.evaluate(() => ({
    auth: G.friendAuthState,
    msgs: (window.__odcMsgs || []).slice(),
    textLog: (window.__textLog || [])
  }));
  ok(s.auth === "denied", "拒绝授权后状态为 denied", s.auth);
  ok(!s.msgs.some(m => m.type === "show"), "拒绝态不向 ODC 发 show", JSON.stringify(s.msgs));
  await p2.close();

  await b.close();
  console.log("\n===== 好友排行入口体检 =====");
  A.forEach(x => console.log(x));
  if (errs.length) { console.log("\n运行时错误："); errs.forEach(e => console.log("  ❌ " + e)); }
  else console.log("✅ 无运行时错误");
  const bad = A.filter(x => x.startsWith("❌")).length;
  console.log(bad || errs.length ? "\n❌ 失败 " + (bad + errs.length) + " 项" : "\n✅ 全部通过");
  if (bad || errs.length) process.exit(1);
})();
