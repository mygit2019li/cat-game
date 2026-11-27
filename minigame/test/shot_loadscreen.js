/* 加载屏视觉验证 + 压缩资源加载完整性检查
   1) 统计 MICEHD 各组图（run 帧/vseq sheet/real/body/parts）加载成功数
   2) 强制 G.assetsReady=false，截三种加载屏状态：37% / 78% / 错误态 */
const fs = require("fs");
const path = require("path");
const pc = require("/tmp/ffshot/node_modules/playwright-core");
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js","./js/rank.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--allow-file-access-from-files"]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(4000);

  // 1) 资源加载完整性
  const res = await page.evaluate(() => {
    const G = window.G, HD = G.draw.MICEHD;
    const keys = ["house", "charcoal", "albino", "deer", "pup", "smoky"];
    const out = { video: {}, vseq: {}, real: 0, realTotal: 0, body: 0, bodyTotal: 0, parts: 0, partsTotal: 0 };
    for (const k of keys) {
      const arr = HD.video[k] || [];
      out.video[k] = arr.filter(im => im && im.ok).length + "/" + arr.length;
    }
    for (const seg of Object.keys(HD.vseq || {})) {
      const b = HD.vseq[seg] && HD.vseq[seg].base;
      out.vseq[seg] = b && b.ok ? "ok" : "MISS";
    }
    const DIRS = [0, 45, 90, 135, 180, 225, 270, 315];
    keys.forEach(k => DIRS.forEach(d => {
      const im = HD.real[d] && HD.real[d][k];
      out.realTotal++; if (im && im.ok) out.real++;
    }));
    keys.forEach(k => ["top", "side"].forEach(v => {
      out.bodyTotal++; if (HD[v][k] && HD[v][k].ok) out.body++;
    }));
    ["earL", "earR", "legL", "legR", "tail"].forEach(p => keys.forEach(k => {
      out.partsTotal++;
      const im = HD.parts[p] && HD.parts[p][k];
      if (im && im.ok) out.parts++;
    }));
    return out;
  });
  console.log("== 压缩资源加载检查 ==");
  console.log("run帧:", JSON.stringify(res.video));
  console.log("vseq sheet:", JSON.stringify(res.vseq));
  console.log(`real: ${res.real}/${res.realTotal}  body: ${res.body}/${res.bodyTotal}  parts: ${res.parts}/${res.partsTotal}`);

  // 2) 加载屏截图：等提示文案处于满 alpha 窗口（t%2.6 在 0.6~2.0 之间）
  const waitTipWindow = async (ms) => {
    await page.waitForFunction(() => {
      const f = (performance.now() / 1000) % 2.6;
      return f > 0.6 && f < 2.0;
    }, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(ms || 50);
  };

  await page.evaluate(() => { window.G.assetsReady = false; window.G.assetsProgress = 37; });
  await waitTipWindow(400);
  await page.screenshot({ path: path.join(OUT, "loadscreen-37.png") });

  await page.evaluate(() => { window.G.assetsProgress = 78; });
  await waitTipWindow(900);   // 多等让缓动跟上 + 流光移动
  await page.screenshot({ path: path.join(OUT, "loadscreen-78.png") });

  await page.evaluate(() => { window.G.assetsError = "test-err"; window.G.assetsProgress = 0; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "loadscreen-error.png") });

  console.log("错误:", errors.length ? errors.slice(0, 3).join(" | ") : "none");
  await browser.close();
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
