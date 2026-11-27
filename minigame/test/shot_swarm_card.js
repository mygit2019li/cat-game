/* 群鼠乱窜卡片封面截图：复现 ui.js drawBgPreview 的 swarm 分支，
   检查 3 只 miniMouse 的朝向是否有倒置。跑法：node test/shot_swarm_card.js */
const fs = require("fs");
const path = require("path");
const pc = (function () {
  for (const p of ["/Users/lipeng/node_modules/playwright-core", "/tmp/ffshot/node_modules/playwright-core"]) {
    try { return require(p); } catch (e) { /* 试下一个 */ }
  }
  throw new Error("找不到 playwright-core（可先跑：mkdir -p /tmp/ffshot && cd /tmp/ffshot && npm i playwright-core）");
})();
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js","./js/rank.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of MODS) mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));

  // 等视频帧（第一花色）加载完成，确认卡片实际走哪条渲染路径
  await page.waitForFunction(() => {
    const D = window.G && window.G.draw;
    const v = D && D.MICEHD && D.MICEHD.video;
    return v && v.house && v.house.length === 16 && v.house[0] && v.house[0].ok;
  }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(300);

  const info = await page.evaluate(() => {
    const G = window.G;
    const HD = G.draw.MICEHD;
    const v0 = (G.MOUSE_VARIANTS && G.MOUSE_VARIANTS[0]) || null;
    const rep = { firstVariant: v0 && v0.key };
    if (v0) {
      rep.video_ok = !!(HD.video[v0.key] && HD.video[v0.key][0] && HD.video[v0.key][0].ok);
      rep.real90_ok = !!(HD.real[90] && HD.real[90][v0.key] && HD.real[90][v0.key].ok);
      rep.back_ok = !!(HD.back[v0.key] && HD.back[v0.key].ok);
      rep.top_ok = !!(HD.top[v0.key] && HD.top[v0.key].ok);
    }
    // 渲染：3x 卡片（w:h ≈ 1.78）+ 右侧一个 rot=0 的参照鼠（默认朝向）
    const cv = document.createElement("canvas");
    cv.width = 1280; cv.height = 560;
    cv.style.cssText = "position:fixed;left:0;top:0;z-index:9999;background:#fff";
    document.body.appendChild(cv);
    const c = cv.getContext("2d");
    const x = 0, y = 0, w = 980, h = 550;
    const sg = c.createLinearGradient(0, y, 0, y + h);
    sg.addColorStop(0, "#28312a"); sg.addColorStop(1, "#141a15");
    c.fillStyle = sg; c.fillRect(x, y, w, h);
    c.fillStyle = "rgba(0,0,0,.15)";
    [[0.25, 0.3, 0.2], [0.7, 0.55, 0.16], [0.45, 0.82, 0.13]].forEach(sp => {
      c.beginPath(); c.ellipse(x + w * sp[0], y + h * sp[1], w * sp[2], h * sp[2] * 0.7, 0.5, 0, Math.PI * 2); c.fill();
    });
    const miniMouse = (mx, my, ms, rot) => {
      c.save(); c.translate(mx, my); c.rotate(rot || 0); c.scale(ms, ms);
      c.translate(-60, -50);
      G.draw.mouseTop(c, { phase: mx * 0.01 }, 1.2);
      c.restore();
    };
    // 卡片上现有的 3 只（角度与 ui.js 完全一致）
    miniMouse(x + w * 0.30, y + h * 0.42, 1.5, Math.PI / 2);
    miniMouse(x + w * 0.60, y + h * 0.68, 1.35, -Math.PI / 2 + 0.3);
    miniMouse(x + w * 0.78, y + h * 0.26, 1.2, 0.2);
    // 参照：rot=0 默认朝向（大一号）
    c.fillStyle = "#fff"; c.fillRect(x + w + 10, 0, 290, 560);
    c.save();
    c.translate(x + w + 155, 280); c.scale(1.8, 1.8); c.translate(-60, -50);
    G.draw.mouseTop(c, { phase: 0 }, 1.2);
    c.restore();
    c.fillStyle = "#333"; c.font = "20px sans-serif";
    c.fillText("rot=0 默认朝向", x + w + 40, 540);
    return rep;
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(OUT, "card-swarm-check.png"), clip: { x: 0, y: 0, width: 1280, height: 560 } });
  console.log("渲染路径:", JSON.stringify(info), "| errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
