/* check_fish_hit_shake.js — 诊断：命中鱼前后逐帧截图画布，量化是否存在整屏位移 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "检查截图", "shake-frames");
fs.mkdirSync(OUT, { recursive: true });

function findChrome() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    process.env.CHROME_PATH || ""
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error("no chrome found");
}

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));

  const modNames = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js", "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./game.js"];
  const modules = {};
  for (const n of modNames) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(400);

  const report = await page.evaluate(async () => {
    const G = window.G;
    const ctx = G.platform.ctx;
    const log = [];

    // 包装关键绘制入口：记录进入时的变换矩阵（整屏抖动会在这里体现）
    const entries = { scene: [], fx: [], preys: [] };
    const origScene = G.drawScene, origFxDraw = G.fx.draw;
    G.drawScene = (c, t) => { const m = c.getTransform(); entries.scene.push([+m.e.toFixed(2), +m.f.toFixed(2), +m.a.toFixed(3)]); return origScene(c, t); };
    G.fx.draw = (c) => { const m = c.getTransform(); entries.fx.push([+m.e.toFixed(2), +m.f.toFixed(2), +m.a.toFixed(3)]); return origFxDraw(c); };

    G.config.targetType = "fish";
    G.startGame();
    G.session.counting = false; G.session.running = true; G.screen = "playing";
    await new Promise(r => setTimeout(r, 800));

    const shots = [];
    const grab = () => G.platform.canvas.toDataURL("image/png");
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // 命中前 3 帧
    for (let i = 0; i < 3; i++) { shots.push({ tag: "pre" + i, data: grab() }); await sleep(70); }

    const p = G.preys[0];
    log.push("prey pos=" + p.x.toFixed(0) + "," + p.y.toFixed(0) + " hittable=" + p.hittable(p.x, p.y));
    G.platform.onTouchStart({ touches: [{ clientX: p.x, clientY: p.y }] });

    // 命中后 8 帧
    for (let i = 0; i < 8; i++) { await sleep(70); shots.push({ tag: "post" + i, data: grab() }); }

    log.push("scene entry transforms: " + JSON.stringify(entries.scene));
    log.push("fx entry transforms: " + JSON.stringify(entries.fx));
    return { log, shots };
  });

  console.log(report.log.join("\n"));
  report.shots.forEach((s, i) => {
    const b64 = s.data.split(",")[1];
    fs.writeFileSync(path.join(OUT, String(i).padStart(2, "0") + "-" + s.tag + ".png"), Buffer.from(b64, "base64"));
  });
  console.log("frames:", report.shots.length);
  console.log("pageerrors:", errors.length ? errors : "none");
  await browser.close();
})();
