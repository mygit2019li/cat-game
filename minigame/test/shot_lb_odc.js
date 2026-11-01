/* shot_lb_odc.js — 开放数据域渲染验收（不依赖小游戏环境，用最小 wx 垫片直接跑）
   验三件事：
   1) 好友榜为空但自己有成绩 → 仍显示「我」这一行（不再是一句"好友里还没有成绩"）
   2) 好友有成绩 → 排序正确，自己那一行高亮标「（我）」
   3) getFriendCloudStorage 失败（没授权）→ 显示"没能读取好友成绩"，不伪装成空榜
   产物：screenshots/lb-odc-*.png（直接把 sharedCanvas 导出成图）
*/
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "screenshots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ODC_SRC = fs.readFileSync(path.join(ROOT, "openDataContext/index.js"), "utf8");

/* 在页面里造一个最小 wx 垫片 + 共享画布，然后执行开放数据域脚本 */
async function bootOdc(browser, friends, selfBest, fail) {
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.setContent("<html><body style='margin:0;background:#9aa9a4'></body></html>");
  await page.evaluate(({ friends, selfBest, fail }) => {
    const c = document.createElement("canvas");
    c.style.display = "block";
    document.body.appendChild(c);
    window.__shared = c;
    const msgCbs = [];
    window.__odc = { msgCbs };
    window.wx = {
      getSharedCanvas: () => c,
      getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 1 }),
      createImage: () => new Image(),
      onMessage: (cb) => msgCbs.push(cb),
      getFriendCloudStorage: (o) => {
        if (fail) { o.fail({ errMsg: "getFriendCloudStorage:fail scope unauthorized" }); return; }
        o.success({ data: friends });
      },
      getUserCloudStorage: (o) => {
        o.success({ data: [{ openid: "me_openid", KVDataList: [{ key: "bestHits", value: String(selfBest) }] }] });
      }
    };
  }, { friends, selfBest, fail });
  await page.evaluate((src) => { new Function("wx", src)(window.wx); }, ODC_SRC);
  return { page, errors };
}

const show = (page) => page.evaluate(() => {
  window.__odc.msgCbs.forEach(f => f({ type: "show", x: 36, y: 200, w: 318, h: 420 }));
});

async function dump(page, name) {
  await page.waitForTimeout(350);
  const dataUrl = await page.evaluate(() => {
    // 只导出卡片区域，便于对比
    const src = window.__shared;
    const out = document.createElement("canvas");
    out.width = 360; out.height = 470;
    const cx = out.getContext("2d");
    cx.fillStyle = "#9aa9a4"; cx.fillRect(0, 0, out.width, out.height);
    cx.drawImage(src, 20, 190, 360, 470, 0, 0, 360, 470);
    return out.toDataURL("image/png");
  });
  fs.writeFileSync(path.join(OUT, "lb-odc-" + name + ".png"), Buffer.from(dataUrl.split(",")[1], "base64"));
}

const friend = (name, best, openid) => ({
  openid: openid || ("open_" + name), nickName: name, avatarUrl: "",
  KVDataList: [{ key: "bestHits", value: String(best) }]
});

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });

  // 1. 好友全没成绩，自己有 12
  {
    const { page, errors } = await bootOdc(browser, [], 12, false);
    await show(page);
    await dump(page, "1-self-only");
    console.log("空榜+我有成绩:", errors.length ? "ERR " + errors.join(" | ") : "ok（应只显示「我」一行）");
    await page.close();
  }

  // 2. 好友有成绩（含自己）
  {
    const friends = [friend("阿橘", 31, "me_openid"), friend("小花", 47), friend("布丁", 9)];
    const { page, errors } = await bootOdc(browser, friends, 31, false);
    await show(page);
    await dump(page, "2-with-friends");
    console.log("好友有成绩:", errors.length ? "ERR " + errors.join(" | ") : "ok（排序 47/31(我)/9）");
    await page.close();
  }

  // 3. 自己没成绩、好友也没成绩 → 真空榜文案
  {
    const { page, errors } = await bootOdc(browser, [], 0, false);
    await show(page);
    await dump(page, "3-empty");
    console.log("真空榜:", errors.length ? "ERR " + errors.join(" | ") : "ok（显示邀请文案）");
    await page.close();
  }

  // 4. 读取失败（未授权）→ denied 文案
  {
    const { page, errors } = await bootOdc(browser, [], 0, true);
    await show(page);
    await dump(page, "4-denied");
    console.log("读取失败:", errors.length ? "ERR " + errors.join(" | ") : "ok（显示没能读取）");
    await page.close();
  }

  await browser.close();
  console.log("DONE ->", OUT);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
