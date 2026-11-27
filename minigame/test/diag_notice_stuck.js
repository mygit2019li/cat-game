/* diag_notice_stuck.js —— 诊断「点开启超越提醒没反应」
   逐个模拟订阅状态，检查：按钮文案 / 点击后是否真的调 API / 状态能否恢复。
   用法：NODE_PATH=<node_modules> node test/diag_notice_stuck.js */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const { chromium } = require("playwright-core");
const MODS = ["./js/platform.js", "./js/config.js", "./js/rank.js", "./js/audio.js",
  "./js/draw.js", "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function boot(page, subState) {
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(st => {
    window.localStorage.removeItem("catToyRankBest");
    window.__authSetting = { "scope.WxFriendInteraction": true, "scope.userInfo": true };
    window.__rankSubState = st || "";
    window.__rankSubCalls = [];
  }, subState);
  await page.evaluate(() => window.require("./game.js"));
  await sleep(250);
}

// 读取当前主按钮文案（从 ui.buttons 里找到宽按钮的 cb 对应 label 拿不到，直接读 state 反推）
async function snap(p) {
  return p.evaluate(() => ({
    state: G.rankNoticeState,
    nick: G.nickAuthState,
    btnCount: G.ui.buttons.filter(b => b.cb === G.enableLbFeatures).length,
    calls: (window.__rankSubCalls || []).length
  }));
}

(async () => {
  const b = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true
  });
  try {
    // 场景 A：未订阅，正常同意 → 应从 need → checking → ok
    let p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await boot(p, "");
    await p.evaluate(() => { G.openModal("lb"); });
    await sleep(650);
    let s = await snap(p);
    console.log("A 打开榜单（未订阅）", JSON.stringify(s));
    await p.evaluate(() => { const btn = G.ui.buttons.filter(x => x.cb === G.enableLbFeatures)[0]; if (btn) btn.cb(); });
    await sleep(150);
    s = await snap(p);
    console.log("A 点一次后（同意）", JSON.stringify(s), s.state === "ok" ? "✓" : "✗ 状态没变 ok");
    await p.close();

    // 场景 B：checking 卡死（回调永不回来）→ 第二次点击会不会被吞
    p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await boot(p, "");
    await p.evaluate(() => {
      // 覆盖订阅 API：只记调用，永不回调 → 模拟真机面板挂起/回调丢失
      window.wx.requestSubscribeSystemMessage = (o) => {
        (window.__rankSubCalls = window.__rankSubCalls || []).push(["STUCK"]);
      };
    });
    await p.evaluate(() => { G.openModal("lb"); });
    await sleep(650);
    await p.evaluate(() => { const btn = G.ui.buttons.filter(x => x.cb === G.enableLbFeatures)[0]; if (btn) btn.cb(); });
    await sleep(150);
    s = await snap(p);
    console.log("B 第一次点（回调丢失）", JSON.stringify(s));
    await p.evaluate(() => { const btn = G.ui.buttons.filter(x => x.cb === G.enableLbFeatures)[0]; if (btn) btn.cb(); });
    await sleep(150);
    const s2 = await snap(p);
    console.log("B 第二次点（8s 超时前）", JSON.stringify(s2),
      s2.calls <= s.calls ? "→ 防抖吞掉（8s 内重复点属预期）" : "✓ 重新发起");
    await sleep(8300);
    const s3 = await snap(p);
    console.log("B 8 秒后", JSON.stringify(s3), s3.state === "need" ? "✓ 超时退回 need" : "✗ 仍卡 " + s3.state);
    await p.evaluate(() => { const btn = G.ui.buttons.filter(x => x.cb === G.enableLbFeatures)[0]; if (btn) btn.cb(); });
    await sleep(100);
    const s4 = await snap(p);
    console.log("B 超时后再点", JSON.stringify(s4), s4.calls >= 2 ? "✓ API 重新调用" : "✗ 仍被吞");
    await p.close();

    // 场景 C：用户已拒绝（denied）→ 按钮文案与点击行为
    p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await boot(p, "");
    await p.evaluate(() => {
      window.wx.requestSubscribeSystemMessage = (o) => {
        (window.__rankSubCalls = window.__rankSubCalls || []).push(["reject"]);
        o && o.success && o.success({ SYS_MSG_TYPE_RANK: "reject" });
      };
    });
    await p.evaluate(() => { G.openModal("lb"); });
    await sleep(650);
    await p.evaluate(() => { const btn = G.ui.buttons.filter(x => x.cb === G.enableLbFeatures)[0]; if (btn) btn.cb(); });
    await sleep(150);
    s = await snap(p);
    console.log("C 拒绝订阅后", JSON.stringify(s),
      s.state === "denied" ? "→ denied" : "→ " + s.state);
    await p.evaluate(() => { const btn = G.ui.buttons.filter(x => x.cb === G.enableLbFeatures)[0]; if (btn) btn.cb(); });
    await sleep(150);
    s = await snap(p);
    console.log("C 再点一次", JSON.stringify(s), "（微信对拒绝过的订阅通常不再弹面板）");
    await p.close();

    // 场景 D：基础库不支持 requestSubscribeSystemMessage → unsupported
    p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await boot(p, "");
    await p.evaluate(() => { delete window.wx.requestSubscribeSystemMessage; });
    await p.evaluate(() => { G.openModal("lb"); });
    await sleep(650);
    await p.evaluate(() => { const btn = G.ui.buttons.filter(x => x.cb === G.enableLbFeatures)[0]; if (btn) btn.cb(); });
    await sleep(150);
    s = await snap(p);
    console.log("D 基础库不支持", JSON.stringify(s),
      s.state === "unsupported" && s.btnCount > 0 ? "✗ 仍显示订阅按钮但点了没反应" : "→ " + s.state);
    await p.close();
  } finally {
    await b.close();
  }
})();
