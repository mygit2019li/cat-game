/* probe_nick_auth.js —— 微信昵称进榜链路：授权状态判断 → 原生按钮 → 昵称写 KV → ODC 刷新
   用法：NODE_PATH=<node_modules> node test/probe_nick_auth.js */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const { chromium } = require("playwright-core");

const MODS = ["./js/platform.js", "./js/config.js", "./js/rank.js", "./js/audio.js",
  "./js/draw.js", "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

let fail = 0;
const ok = (cond, name, extra) => {
  console.log((cond ? "  ✓ " : "  ✗ ") + name + (extra ? "  " + extra : ""));
  if (!cond) fail++;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true
  });
  try {
    // 场景1：未授权 → needButton，进入排行榜创建原生按钮，点击后微信昵称写 KV + ODC refresh
    let p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await p.goto("file://" + path.join(ROOT, "test/harness.html"));
    await p.evaluate(m => Object.assign(window.__MODULES__, m), modules);
    await p.evaluate(() => {
      window.__authSetting = { "scope.WxFriendInteraction": true };   // 好友权限已给
      // scope.userInfo 不设置 → needButton
    });
    await p.evaluate(() => window.require("./game.js"));
    await sleep(200);
    let s = await p.evaluate(() => ({ st: G.nickAuthState, created: window.__nickBtnCreated || 0 }));
    ok(s.st === "needButton", "冷启动识别为需要原生授权按钮", JSON.stringify(s));

    await p.evaluate(() => { G.openModal("lb"); G.enableLbFeatures(); });
    await sleep(600);
    s = await p.evaluate(() => ({ created: window.__nickBtnCreated || 0, style: window.__nickBtnStyle }));
    ok(s.created >= 1, "排行榜展开后创建原生按钮", JSON.stringify(s.created));
    ok(s.style && s.style.width > 0 && s.style.height > 0, "原生按钮用逻辑像素定位", JSON.stringify(s.style));

    await p.evaluate(() => window.__tapNickBtn && window.__tapNickBtn());
    await sleep(100);
    s = await p.evaluate(() => ({
      st: G.nickAuthState,
      writes: window.__cloudWrites || [],
      msgs: window.__odcMsgs || [],
      destroyed: window.__nickBtnDestroyed || 0
    }));
    const profile = s.writes.flat().find(k => k.key === "rankName");
    ok(s.st === "ok", "授权后状态变 ok", s.st);
    ok(!!profile && profile.value === "真名猫主", "微信昵称写入关系链 KV", JSON.stringify(profile));
    ok(s.writes.flat().some(k => k.key === "rankAvatar"), "头像写入关系链 KV");
    ok(s.msgs.some(m => m.type === "refresh"), "授权后通知 ODC 重新拉数据", JSON.stringify(s.msgs.map(m => m.type)));
    const showMsg = s.msgs.slice().reverse().find(m => m.type === "show");
    ok(showMsg && showMsg.self && showMsg.self.name === "真名猫主",
      "授权后 show 消息带真昵称（自己那行不用'我'）", JSON.stringify(showMsg && showMsg.self));
    ok(showMsg && showMsg.self && /qlogo/.test(showMsg.self.avatar || ""),
      "授权后 show 消息带真头像", JSON.stringify(showMsg && showMsg.self));
    ok(s.destroyed >= 1, "授权完成后销毁原生按钮", String(s.destroyed));
    await p.close();

    // 场景2：已授权用户不再创建按钮
    p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await p.goto("file://" + path.join(ROOT, "test/harness.html"));
    await p.evaluate(m => Object.assign(window.__MODULES__, m), modules);
    await p.evaluate(() => {
      window.__authSetting = { "scope.WxFriendInteraction": true, "scope.userInfo": true };
    });
    await p.evaluate(() => window.require("./game.js"));
    await sleep(150);
    await p.evaluate(() => G.openModal("lb"));
    await sleep(600);
    s = await p.evaluate(() => ({ st: G.nickAuthState, created: window.__nickBtnCreated || 0 }));
    ok(s.st === "ok", "已授权用户状态 ok", s.st);
    ok(s.created === 0, "已授权用户不再创建授权按钮", String(s.created));
    await p.close();

    // 场景3：关弹窗时销毁按钮
    p = await b.newPage({ viewport: { width: 844, height: 390 } });
    await p.goto("file://" + path.join(ROOT, "test/harness.html"));
    await p.evaluate(m => Object.assign(window.__MODULES__, m), modules);
    await p.evaluate(() => { window.__authSetting = { "scope.WxFriendInteraction": true }; });
    await p.evaluate(() => window.require("./game.js"));
    await sleep(150);
    await p.evaluate(() => { G.openModal("lb"); G.enableLbFeatures(); });
    await sleep(600);
    const before = await p.evaluate(() => window.__nickBtnDestroyed || 0);
    await p.evaluate(() => G.closeModal());
    await sleep(100);
    const after = await p.evaluate(() => window.__nickBtnDestroyed || 0);
    ok(after > before, "关闭弹窗立即销毁原生按钮", `${before}->${after}`);
    await p.close();
  } finally { await b.close(); }

  console.log("\n" + (fail ? `FAILED ${fail} 项` : "ALL_NICK_AUTH_OK"));
  if (fail) process.exit(1);
})();
