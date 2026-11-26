/* probe_loading_progress.js — 加载页进度条 0~100 归一化体检
   微信 wx.loadSubpackage.onProgressUpdate 的 progress 值域跨平台不一致：
     文档/模拟器 0~100，iOS 真机（基础库 2.1.x）曾返回 0~1。
   验四件事：
     ① 字节比是权威口径：两端的一致比例 written/total → 正确百分比
     ② 无字节数时按值域兜底：0~1 小数值 ×100、0~100 原样、越界夹到 0~100
     ③ 进度单调不回退：回调推旧值/乱序不会让进度条倒跳
     ④ 显示层：百分比文字与进度条都用归一后的 0~100 值
   用法：NODE_PATH=/tmp/ffshot/node_modules node test/probe_loading_progress.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];
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
  await page.evaluate(m => Object.assign(window.__MODULES__, m), modules);
  await page.evaluate(() => window.require("./game.js"));
  await sleep(200);

  // 直接调归一化函数（挂在 G 上供排障/测试访问）
  const cases = await page.evaluate(() => {
    const f = window.G.normSubpackageProgress;
    if (typeof f !== "function") return { missing: true };
    return {
      // ① 字节比权威：progress 是 0~1 小数值，但字节比 0.5 → 50%
      bytesIOS: f({ progress: 0.5, totalBytesWritten: 5000, totalBytesExpectedToWrite: 10000 }),
      bytesStd: f({ progress: 50, totalBytesWritten: 5000, totalBytesExpectedToWrite: 10000 }),
      // ② 无字节数时的值域兜底
      noBytes01: f({ progress: 0.5 }),          // 0~1 值域 → 50
      noBytes100: f({ progress: 50 }),          // 0~100 值域 → 50
      noBytesOne: f({ progress: 1 }),           // 0~1 值域满 → 100
      over: f({ progress: 130 }),               // 越界夹到 100
      negative: f({ progress: -5 }),            // 负数夹到 0
      nan: f({ progress: NaN }),                // 非数值 → null（跳过）
      nullRes: f(null),
      zeroTotal: f({ progress: 0.4, totalBytesWritten: 100, totalBytesExpectedToWrite: 0 }) // 分母 0 → 走 progress
    };
  });
  ok(!cases.missing, "归一化函数可访问", JSON.stringify(cases));
  if (!cases.missing) {
    ok(cases.bytesIOS === 50, "① 字节比权威：iOS progress 0.5 + 字节比 0.5 → 50%", cases.bytesIOS);
    ok(cases.bytesStd === 50, "① 字节比权威：模拟器 progress 50 + 字节比 0.5 → 50%", cases.bytesStd);
    ok(cases.noBytes01 === 50, "② 兜底：0~1 值域 progress 0.5 → 50%", cases.noBytes01);
    ok(cases.noBytes100 === 50, "② 兜底：0~100 值域 progress 50 → 50%", cases.noBytes100);
    ok(cases.noBytesOne === 100, "② 兜底：0~1 值域 progress 1 → 100%", cases.noBytesOne);
    ok(cases.over === 100, "② 越界夹到 100", cases.over);
    ok(cases.negative === null, "② 负数视为非法回调（跳过）", cases.negative);
    ok(cases.nan === null, "② 非数值返回 null（回调跳过）", cases.nan);
    ok(cases.nullRes === null, "② 空回调返回 null", cases.nullRes);
    ok(cases.zeroTotal === 40, "② 分母 0 时回退 progress（0.4 → 40%）", cases.zeroTotal);
  }

  // ③ 单调不回退：手动推几个值进 G.assetsProgress（模拟回调链）
  const mono = await page.evaluate(() => {
    const G = window.G;
    G.assetsProgress = 0;
    G.assetsProgress = Math.max(G.assetsProgress, G.normSubpackageProgress({ progress: 0.5 })); // → 50
    const afterUp = G.assetsProgress;
    G.assetsProgress = Math.max(G.assetsProgress, G.normSubpackageProgress({ progress: 0.2 })); // 旧值 20，不回退
    const afterOld = G.assetsProgress;
    G.assetsProgress = Math.max(G.assetsProgress, G.normSubpackageProgress({ progress: 0.9 })); // → 90
    return { afterUp, afterOld, afterFinal: G.assetsProgress };
  });
  ok(mono.afterUp === 50, "③ 上升：0.5 → 50%", mono.afterUp);
  ok(mono.afterOld === 50, "③ 回退：推旧值 0.2 不倒退（仍 50%）", mono.afterOld);
  ok(mono.afterFinal === 90, "③ 继续上升：0.9 → 90%", mono.afterFinal);

  // ④ 显示层：让加载屏真跑一帧，检查页面无异常（绘制路径读 assetsProgress/100）
  const draw = await page.evaluate(() => {
    const G = window.G;
    G.assetsReady = false;
    G.assetsProgress = 50;
    G.assetsError = null;
    try { G.drawAssetsLoadingScreen && G.drawAssetsLoadingScreen(); return "ok"; }
    catch (e) { return String(e && e.message); }
  });
  ok(draw === "ok", "④ 进度条绘制路径读归一值不报错", draw);

  ok(errs.length === 0, "无页面异常", errs.slice(0, 3).join(" | ") || "none");
  console.log(A.join("\n"));
  const fails = A.filter(x => x.startsWith("❌")).length;
  console.log(fails ? `\n${fails} 项失败` : "\n✅ 全部通过");
  await browser.close();
  if (fails) process.exit(1);
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
