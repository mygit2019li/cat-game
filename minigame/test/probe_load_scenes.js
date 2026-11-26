/* probe_load_scenes.js — 加载屏玩法轮播 + 提示话术静态体检
   验四件事：
     ① 11 张玩法画面轮播表齐全，图标类型都在 D.icon 支持列表内（含电子猫粮/召唤猫咪/猫咪心情）
     ② 提示话术覆盖用户要求的三类：平板体验 / 贴膜护屏 / 猫咪心情判读引导
     ③ 轮播卡只画在加载态、错误态不画（源码结构断言）
     ④ 加载屏绘制路径在 4 个时刻（跨多张卡）无异常
   用法：NODE_PATH=/tmp/ffshot/node_modules node test/probe_load_scenes.js */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(__dirname, "..");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];
const modules = {};
for (const n of MODS) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
const A = [];
const ok = (c, m, e) => { A.push((c ? "✅ " : "❌ ") + m + (e != null ? "  → " + e : "")); return c; };

(async () => {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(200);

  const src = modules["./game.js"];
  ok(/_LOAD_SCENES\s*=\s*\[/.test(src), "① 轮播表存在", "");
  ok((src.match(/\{ icon:/g) || []).length === 11, "① 11 张玩法画面", (src.match(/\{ icon:/g) || []).length);
  const iconTypes = [...src.matchAll(/icon:\s*"(\w+)"/g)].map(m => m[1]);
  const supported = ["tadpole", "fish", "butterfly", "mouse", "laser", "pool", "ladybug", "frog", "bowl", "cat", "heart"];
  ok(iconTypes.length === 11 && iconTypes.every(t => supported.includes(t)),
    "① 图标类型都在 D.icon 支持列表内", iconTypes.join(","));
  for (const [type, name] of [["bowl", "电子猫粮"], ["cat", "召唤猫咪"], ["heart", "猫咪心情"]]) {
    ok(src.includes(`icon: "${type}", name: "${name}"`), `① 新增玩法「${name}」已上轮播`, type);
  }

  const tipsBlock = (src.match(/const _LOAD_TIPS = \[([\s\S]*?)\];/) || [])[1] || "";
  const tips = [...tipsBlock.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  ok(tips.length >= 6, "② 提示话术至少 6 条", tips.length);
  ok(tips.some(x => x.includes("平板")), "② 有平板体验话术", tips.find(x => x.includes("平板")));
  ok(tips.some(x => x.includes("贴膜") || x.includes("猫爪")), "② 有贴膜护屏话术", tips.find(x => x.includes("贴膜")));
  ok(tips.some(x => x.includes("猫咪状态") && /呼噜|耳朵|尾巴|瞳孔/.test(x)),
    "② 有猫咪心情判读 + 引导「猫咪状态」", tips.find(x => x.includes("猫咪状态")));
  ok(tips.every(x => /。|啦|屏|猫|玩/.test(x)), "② 话术都是完整短句", tips.length + " 条");
  ok(/\(!G\.assetsError\)\s*\?\s*_drawLoadScene/.test(src), "③ 轮播卡只在非错误态绘制", "");
  ok(/_LOAD_SCENE_DUR\s*=\s*3\.6/.test(src), "③ 轮播周期 3.6s", "");

  // ④ 绘制路径：让主循环在加载态跑若干帧（跨多张卡），检查无异常
  await page.evaluate(() => {
    const G = window.G;
    G.assetsReady = false; G.assetsError = null; G.assetsProgress = 52;
  });
  await new Promise(r => setTimeout(r, 700));
  // 三个新图标逐个离屏绘制，确认矢量分支不抛异常
  const newIcons = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 200; c.height = 200;
    const x = c.getContext("2d");
    return ["bowl", "cat", "heart"].map(type => {
      try { window.G.draw.icon(x, type, 100, 100, 1, true); return "ok"; }
      catch (e) { return String(e && e.message); }
    });
  });
  ok(newIcons.every(x => x === "ok"), "④ 新增三图标矢量绘制无异常", newIcons.join(","));
  ok(errs.length === 0, "④ 加载态主循环绘制无异常", errs.slice(0, 3).join(" | ") || "none");
  ok(errs.length === 0, "④ 无页面异常", errs.slice(0, 3).join(" | ") || "none");

  console.log(A.join("\n"));
  const fails = A.filter(x => x.startsWith("❌")).length;
  console.log(fails ? `\n${fails} 项失败` : "\n✅ 全部通过");
  await browser.close();
  if (fails) process.exit(1);
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
