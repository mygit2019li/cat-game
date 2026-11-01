/* shot_lb_auth.js — 好友排行的授权三态
   背景：wx.getFriendCloudStorage 需要 scope.WxFriendInteraction，没授权时过去会静默变空榜
   （显示"好友里还没有成绩"，把"没权限"说成"没人玩"）。本脚本验：
   1) 已授权 → 直接出榜（ODC 收到 refresh + show）
   2) 从没问过 → 弹一次授权，同意后出榜
   3) 首次拒绝 → denied 态（引导按钮"去设置开启"），点它会 openSetting 并在成功后排榜
   4) 以前拒绝过 → 不再弹授权（authCalls 不增加），直接给引导
   5) 老基础库 invalid scope → 当作可用（unsupported → ok），不能误判成用户拒绝
   截图：denied 态 / 请求中 / 已授权
*/
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "screenshots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOD_NAMES = [
  "./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/feeder.js", "./game.js"
];

async function open(browser, w, h, authSetting, authStub, openGrant) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/ERR_FILE_NOT_FOUND/.test(m.text())) errors.push(m.text()); });
  const modules = {};
  for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(({ authSetting, authStub, openGrant }) => {
    window.__authSetting = authSetting || {};
    window.__authStub = authStub || "grant";
    window.__openSettingGrant = openGrant;
    window.__authCalls = 0;
    window.__openSettingCalls = 0;
    window.__odcMsgs = [];
  }, { authSetting, authStub, openGrant });
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(450);
  return { page, errors };
}

/* 点首页「好友排行」（竖屏底部最右边那个按钮） */
const tapLbEntry = (page) => page.evaluate(async () => {
  const G = window.G, S = G.platform.S || 1;
  const b = G.ui.buttons.find(x => x.y > 540 && x.h >= 30 && x.x > 140) || G.ui.buttons[G.ui.buttons.length - 1];
  if (b) G.platform.onTouchStart({ touches: [{ clientX: (b.x + b.w / 2) * S, clientY: (b.y + b.h / 2) * S }] });
  await new Promise(r => setTimeout(r, 30));
  return { screen: G.screen, state: G.friendAuthState, btn: b && { x: Math.round(b.x), y: Math.round(b.y) } };
});

const snap = (page) => page.evaluate(() => {
  const G = window.G;
  const msgs = (window.__odcMsgs || []).map(m => m.type);
  return {
    screen: G.screen,
    state: G.friendAuthState,
    authCalls: window.__authCalls || 0,
    openSettingCalls: window.__openSettingCalls || 0,
    odc: msgs.slice(-4),
    btns: G.ui.buttons.length
  };
});

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });

  // ---------- 1. 已授权 ----------
  {
    const { page, errors } = await open(browser, 390, 844, { "scope.WxFriendInteraction": true });
    const enter = await tapLbEntry(page);
    await page.waitForTimeout(500);
    const s = await snap(page);
    await page.screenshot({ path: path.join(OUT, "lb-1-authed.png") });
    console.log("已授权: 进入 " + enter.screen + " | state=" + s.state + " | authCalls=" + s.authCalls +
      " | ODC=" + s.odc.join(","));
    console.log("  errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 2. 从没问过 → 同意 ----------
  {
    const { page, errors } = await open(browser, 390, 844, {}, "grant");
    await tapLbEntry(page);
    await page.waitForTimeout(700);
    const s = await snap(page);
    await page.screenshot({ path: path.join(OUT, "lb-2-after-grant.png") });
    console.log("首次同意: state=" + s.state + " | authCalls=" + s.authCalls + " | ODC=" + s.odc.join(","));
    console.log("  errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 3. 首次拒绝 → 引导 → 去设置开启 ----------
  {
    const { page, errors } = await open(browser, 390, 844, {}, "deny");
    await tapLbEntry(page);
    await page.waitForTimeout(700);
    const denied = await snap(page);
    await page.screenshot({ path: path.join(OUT, "lb-3-denied.png") });

    // 点底部主按钮（去设置开启）
    const afterOpen = await page.evaluate(async () => {
      const G = window.G, S = G.platform.S || 1;
      const b = G.ui.buttons.filter(x => x.w > 200 && x.h >= 36).pop();   // 通栏主按钮
      if (b) G.platform.onTouchStart({ touches: [{ clientX: (b.x + b.w / 2) * S, clientY: (b.y + b.h / 2) * S }] });
      await new Promise(r => setTimeout(r, 60));
      const mid = { state: G.friendAuthState, calls: window.__openSettingCalls };
      await new Promise(r => setTimeout(r, 500));
      return { mid, end: G.friendAuthState, odc: (window.__odcMsgs || []).map(m => m.type).slice(-3) };
    });
    await page.screenshot({ path: path.join(OUT, "lb-4-after-setting.png") });
    console.log("拒绝: state=" + denied.state + " authCalls=" + denied.authCalls + " ODC=" + denied.odc.join(","));
    console.log("  去设置: openSetting=" + afterOpen.mid.calls + " → state=" + afterOpen.end + " ODC=" + afterOpen.odc.join(","));
    console.log("  errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 4. 以前拒绝过（authSetting=false）→ 不该再弹 ----------
  {
    const { page, errors } = await open(browser, 390, 844, { "scope.WxFriendInteraction": false });
    await tapLbEntry(page);
    await page.waitForTimeout(600);
    const s = await snap(page);
    console.log("曾拒绝: state=" + s.state + " | authCalls=" + s.authCalls + "（应为 0）| ODC=" + s.odc.join(","));
    console.log("  errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 5. 旧基础库：invalid scope → 视为可用 ----------
  {
    const { page, errors } = await open(browser, 390, 844, {}, "invalid");
    await tapLbEntry(page);
    await page.waitForTimeout(700);
    const s = await snap(page);
    console.log("旧基础库: state=" + s.state + "（应为 ok）| ODC=" + s.odc.join(","));
    console.log("  errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 6. 请求中（授权回调未返回）截图 ----------
  {
    const { page } = await open(browser, 390, 844, {}, "pending");
    await page.evaluate(() => {
      // 让 authorize 永远不回调：停在 asking 态
      window.wx.authorize = () => { window.__authCalls++; };
    });
    await tapLbEntry(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "lb-5-asking.png") });
    const s = await snap(page);
    console.log("请求中: state=" + s.state + "（asking=等待回调）");
    await page.close();
  }

  await browser.close();
  console.log("DONE ->", OUT);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
