/* 诊断 run 帧为何 ok=0：直接读 MICEHD.video[k][i] 的状态 */
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
  await page.waitForTimeout(4000);  // 给 96 张帧足够加载时间

  const result = await page.evaluate(() => {
    const G = window.G, HD = G.draw.MICEHD;
    const out = { location: location.protocol + "//" + location.pathname, videoDetail: {}, vseqDetail: {} };
    // run 帧详细状态（每花色前 2 张 + 第 16 张）
    const keys = ["house", "charcoal", "albino", "deer", "pup", "smoky"];
    for (const k of keys) {
      const arr = HD.video[k] || [];
      out.videoDetail[k] = {
        total: arr.length,
        okCount: arr.filter(im => im && im.ok).length,
        samples: [0, 1, 15].map(i => {
          const im = arr[i];
          if (!im) return { i, null: true };
          return { i, ok: im.ok, src: String(im.src).slice(-40), nw: im.naturalWidth, nh: im.naturalHeight,
            complete: im.complete };
        })
      };
    }
    // vseq sheet 对照
    for (const seg of ["fast", "look", "sit"]) {
      const b = HD.vseq[seg] && HD.vseq[seg].base;
      out.vseqDetail[seg] = b ? { ok: b.ok, src: String(b.src).slice(-30), nw: b.naturalWidth, complete: b.complete } : null;
    }
    return out;
  });

  console.log("location:", result.location);
  console.log("vseq sheet（对照）:", JSON.stringify(result.vseqDetail, null, 1));
  console.log("video run 帧:");
  for (const k of Object.keys(result.videoDetail)) {
    const d = result.videoDetail[k];
    console.log("  " + k + ":", d.okCount + "/" + d.total);
    for (const s of d.samples) {
      if (s.null) { console.log("    [" + s.i + "] null"); continue; }
      console.log("    [" + s.i + "] ok=" + s.ok + " nw=" + s.nw + " complete=" + s.complete + " src=" + s.src);
    }
  }
  console.log("渲染错误:", errors.length ? errors.slice(0, 3).join(" | ") : "none");
  await browser.close();
})().catch(e => { console.error("FAILED:", e); process.exit(1); });
