/* check_bfly_tap.js — 蝴蝶模式点击命中实测：模拟触控 → 校验 hits / 状态机 / 视觉截图 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "检查截图");
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
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

  const modNames = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js", "./js/scenery.js", "./js/prey.js", "./js/sharecard.js", "./js/ui.js", "./js/feeder.js", "./game.js"];
  const modules = {};
  for (const n of modNames) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");

  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(400);

  const report = await page.evaluate(async () => {
    const G = window.G;
    const log = [];
    // 进入蝴蝶模式
    G.config.targetType = "butterfly";
    G.startGame();
    // 跳过倒计时，直接进游玩界面
    G.session.counting = false; G.session.running = true; G.screen = "playing";
    await new Promise(r => setTimeout(r, 600));

    const prey = G.preys[0];
    log.push("prey count=" + G.preys.length + " state=" + prey.state +
             " sc=" + prey.sc + " baseW=" + prey.baseW + " fade=" + prey.fade.toFixed(2) +
             " pos=" + prey.x.toFixed(0) + "," + prey.y.toFixed(0));

    // 1) hittable 直测（ prey 当前位置）
    const ht = prey.hittable(prey.x, prey.y);
    log.push("hittable(center)=" + ht);

    // 2) 模拟点击 prey 中心（走真实触摸路由）
    const t0 = G.session.touches, h0 = G.session.hits;
    G.platform.onTouchStart({ touches: [{ clientX: prey.x, clientY: prey.y }] });
    await new Promise(r => setTimeout(r, 80));
    log.push("tap@center: touches " + t0 + "->" + G.session.touches + "  hits " + h0 + "->" + G.session.hits +
             "  state=" + prey.state + " vanishT=" + (prey.vanishT || 0).toFixed(2));

    // 3) 等蝴蝶 respawn，测 10 次边缘点击（先等进入可命中状态，单独验证外扩命中盒）
    let ok = 0;
    const varCount = {};
    for (let i = 0; i < 10; i++) {
      // 等到蝴蝶处于可命中状态（最多 2s）
      let p = G.preys[0], waits = 0;
      while (p && (p.state === "STARTLED" || p.state === "TAKEOFF" || p.fade < 0.25) && waits < 20) {
        await new Promise(r => setTimeout(r, 100)); waits++;
        p = G.preys[0];
      }
      if (!p) continue;
      varCount[p.bflyVar ? p.bflyVar.name : "?"] = (varCount[p.bflyVar ? p.bflyVar.name : "?"] || 0) + 1;
      const hw = p.baseW * p.sc / 2, hh = p.baseH * p.sc / 2;
      const tx = p.x + hw * 0.9, ty = p.y + hh * 0.9;   // 点在旧命中盒边缘外、新命中盒内
      const before = G.session.hits;
      G.platform.onTouchStart({ touches: [{ clientX: tx, clientY: ty }] });
      await new Promise(r => setTimeout(r, 60));
      if (G.session.hits > before) ok++;
    }
    log.push("edge-tap hits: " + ok + "/10  variants: " + JSON.stringify(varCount));

    // 4) 截一张游戏实况供目检
    return { log, canvasW: G.platform.W, canvasH: G.platform.H };
  });

  console.log(report.log.join("\n"));
  console.log("canvas:", report.canvasW, "x", report.canvasH);
  console.log("pageerrors:", errors.length ? errors : "none");
  await page.screenshot({ path: path.join(OUT, "bfly-tap-test.png") });
  await browser.close();
})();
