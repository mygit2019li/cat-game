/* probe_rank_notice.js —— 好友超越提醒（关系链系统订阅消息）链路
   验五件事：
     ① 冷启动用 withSubscriptions 读订阅状态（未订阅 / 已订阅）
     ② 刷新最高分时按微信标准格式上报 doumao（wxgame.score + 秒级 update_time）
     ③ 排行榜底部只有合并入口，点击在手势内调 requestSubscribeSystemMessage
     ④ 同意后状态变 ok、按钮消失；拒绝后变 denied，不重复弹
     ⑤ 基础库不支持时静默降级，不阻塞游戏
   用法：NODE_PATH=<node_modules> node test/probe_rank_notice.js */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const { chromium } = require("playwright-core");
const MODS = ["./js/platform.js", "./js/config.js", "./js/rank.js", "./js/audio.js",
  "./js/draw.js", "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

let fail = 0;
const ok = (c, m, e) => {
  console.log((c ? "  ✓ " : "  ✗ ") + m + (e != null ? "  → " + e : ""));
  if (!c) fail++;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STUB = `
(function(){
  window.localStorage.removeItem("catToyRankBest");
  window.__cloudWrites = [];
  window.wx.setUserCloudStorage = (o) => { window.__cloudWrites.push(JSON.parse(JSON.stringify(o.KVDataList||[]))); };
  window.__authSetting = { "scope.WxFriendInteraction": true };
  window.__getSettingCalls = [];
  const orig = window.wx.getSetting;
  window.wx.getSetting = (o) => { window.__getSettingCalls.push(!!(o && o.withSubscriptions)); return orig(o); };
})();`;

async function boot(page, extra) {
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(STUB);
  if (extra) await page.evaluate(extra);
  await page.evaluate(() => window.require("./game.js"));
  await sleep(250);
}

(async () => {
  const b = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true
  });
  try {
    let p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await boot(p);
    let s = await p.evaluate(() => ({
      state: G.rankNoticeState, withSub: window.__getSettingCalls.some(Boolean)
    }));
    ok(s.state === "need", "冷启动未订阅 → need", JSON.stringify(s));
    ok(s.withSub, "getSetting 带 withSubscriptions:true", JSON.stringify(s));

    // 刷新最高分 → 官方榜单标准 KV
    s = await p.evaluate(() => {
      const r = G.computeRankScore({ hits: 40, playSec: 60, type: "laser", difficulty: "hard", done: true });
      G.updateRankBest(r);
      const all = [].concat.apply([], window.__cloudWrites);
      const w = all.find(x => x && x.key === "doumao");
      let parsed = null;
      try { parsed = JSON.parse(w && w.value); } catch (e) {}
      return { score: r.score, found: !!w, value: w && w.value, parsed: parsed };
    });
    const sec = s.parsed && s.parsed.wxgame && s.parsed.wxgame.update_time;
    ok(s.found && s.parsed && s.parsed.wxgame && s.parsed.wxgame.score === s.score,
      "上报 doumao，wxgame.score = 猎手分", JSON.stringify(s.parsed));
    ok(sec > 1e9 && sec < 2e9, "update_time 为秒级 Unix 时间戳", String(sec));

    // 打开榜单 → 只有一个合并入口，不再有独立订阅按钮
    await p.evaluate(() => G.openModal("lb"));
    await sleep(650);
    s = await p.evaluate(() => ({
      merged: G.ui.buttons.filter(x => x.cb === G.enableLbFeatures).length,
      separate: G.ui.buttons.filter(x => x.cb === G.subscribeRankNotice).length,
      screen: G.screen
    }));
    ok(s.merged === 1 && s.separate === 0, "榜单底部只有合并入口", JSON.stringify(s));

    // 点合并入口 → 手势内订阅 + 放出微信昵称按钮
    s = await p.evaluate(() => {
      const btn = G.ui.buttons.filter(x => x.cb === G.enableLbFeatures)[0];
      btn.cb();
      return {
        calls: window.__rankSubCalls, state: G.rankNoticeState,
        subState: window.__rankSubState, nickStep: G.nickStepReady
      };
    });
    ok(JSON.stringify(s.calls) === JSON.stringify([["SYS_MSG_TYPE_RANK"]]),
      "点击后请求 SYS_MSG_TYPE_RANK", JSON.stringify(s.calls));
    ok(s.state === "ok" && s.subState === "accept", "同意订阅 → 状态 ok", JSON.stringify(s));
    ok(s.nickStep === true, "点过合并入口后放出微信昵称按钮", "nickStep=" + s.nickStep);

    await sleep(120);
    s = await p.evaluate(() => {
      const merged = G.ui.buttons.filter(x => x.cb === G.enableLbFeatures)[0];
      if (merged) merged.cb();
      return {
        calls: (window.__rankSubCalls || []).length,
        separate: G.ui.buttons.filter(x => x.cb === G.subscribeRankNotice).length
      };
    });
    ok(s.calls === 1 && s.separate === 0, "重复点合并入口不会重复订阅", JSON.stringify(s));
    await p.close();

    // 拒绝订阅：不崩、状态 denied、只请求一次
    p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await boot(p, () => { window.__rankSubTap = "reject"; });
    await p.evaluate(() => G.openModal("lb"));
    await sleep(650);
    s = await p.evaluate(() => {
      const btn = G.ui.buttons.filter(x => x.cb === G.enableLbFeatures)[0];
      if (btn) btn.cb();
      return { state: G.rankNoticeState, calls: (window.__rankSubCalls || []).length };
    });
    ok(s.state === "denied" && s.calls === 1, "拒绝订阅 → denied，只请求一次", JSON.stringify(s));
    await p.close();

    // 基础库不支持：降级为 ok（不卡按钮空转）
    p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await boot(p);
    s = await p.evaluate(() => {
      window.wx.requestSubscribeSystemMessage = undefined;
      G.rankNoticeState = "need";
      G.subscribeRankNotice();
      return G.rankNoticeState;
    });
    ok(s === "ok", "接口缺失 → 降级 ok，不留空转按钮", s);
    await p.close();

    // checking 超时兜底：回调丢失 8 秒后退回 need，避免按钮永久卡死
    p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await boot(p, () => {
      window.wx.requestSubscribeSystemMessage = () => {};   // 永不回调
    });
    s = await p.evaluate(() => { G.rankNoticeState = "need"; G.subscribeRankNotice(); return G.rankNoticeState; });
    ok(s === "checking", "订阅面板挂起 → checking", s);
    await sleep(8300);
    s = await p.evaluate(() => G.rankNoticeState);
    ok(s === "need", "8 秒超时退回 need，可再次点击", s);
    await p.close();

    // 已订阅玩家冷启动直接是 ok
    p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await boot(p, () => { window.__rankSubState = "accept"; });
    s = await p.evaluate(() => G.rankNoticeState);
    ok(s === "ok", "老玩家冷启动识别为已订阅", s);
    await p.close();

  } catch (e) {
    ok(false, "探针异常", e && e.stack ? e.stack : String(e));
  } finally {
    await b.close();
  }
  console.log("\n" + (fail ? "FAIL " + fail : "ALL_RANK_NOTICE_OK"));
  process.exit(fail ? 1 : 0);
})();
