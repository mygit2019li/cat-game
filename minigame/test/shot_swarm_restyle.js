/* 群鼠场景重设计验证（角色造型 + 废弃粮仓地板）：
   - 强制阶段③（6 只）→ 6 变体去重分配，看 6 只花色/体型/配饰是否各不相同
   - 废弃粮仓地板：L1 暖棕黑底 / L2 木地板 / L3 粮袋木箱碎粮 / L4 顶光暗角
   跑法：node test/shot_swarm_restyle.js */
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
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } }); // 横屏
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  const mods = {};
  for (const n of ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
    "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
    "./js/ad.js", "./js/feeder.js", "./game.js"]) {
    mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  }
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const G = window.G;
    G.config.targetType = "mouse"; G.config.bg_mouse = "swarm";
    G.config.infinite = true;
    G.layout = null; G.startGame();
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    if (await page.evaluate(() => window.G.screen === "playing")) break;
    await page.waitForTimeout(50);
  }
  // 强制阶段③：stageTargetCount=6 → buildPreys 已按 4 只建，topUpPreys 补到 6 并去重分配变体
  const info = await page.evaluate(() => {
    const G = window.G;
    G.session.stage = 3;
    G.topUpPreys();
    return {
      n: G.preys.length,
      variants: G.preys.map(p => p.mouseVar ? p.mouseVar.key : "?"),
      names: G.preys.map(p => p.mouseVar ? p.mouseVar.name : "?"),
      sizes: G.preys.map(p => +(p.mouseVar ? p.mouseVar.size : 1).toFixed(2)),
      speeds: G.preys.map(p => +(p.mouseVar ? p.mouseVar.speed : 1).toFixed(2)),
      gaits: G.preys.map(p => p.mouseVar ? p.mouseVar.gait : "?"),
      floorProps: G.scene.swarmProps ? G.scene.swarmProps.length : 0,
      floorGrains: G.scene.swarmGrains ? G.scene.swarmGrains.length : 0,
      mouseBg: G.scene.mouseBg
    };
  });
  console.log("变体分配:", JSON.stringify(info));
  // 跑 3s 让地板缓存建好、光斑稳定
  await page.waitForTimeout(3000);
  // ① 自然态截图（看地板 + 局部光 + 鼠在跑）
  await page.screenshot({ path: path.join(OUT, "ref-restyle-1-natural.png") });

  // ② 6 只分散到网格（2 行 3 列），每只都露出来看花色/配饰差异
  await page.evaluate(() => {
    const G = window.G;
    const b = G.bounds();
    const cols = 3, rows = 2;
    G.preys.forEach((p, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      p.x = b.x + (0.2 + 0.3 * c) * b.w;
      p.y = b.y + (0.32 + 0.34 * r) * b.h;
      p.fade = 1; p.vanishT = 0; p.sc = 1;
      p.state = "pause"; p.stateT = 9;           // 停驻，不移动，方便看造型
    });
    G.session.running = false;
  });
  // 诊断：每只鼠实际 mouseVar 的颜色原始值（确认 6 只是否真不同）
  const diag2 = await page.evaluate(() => {
    const G = window.G;
    return G.preys.map(p => p.mouseVar ? { k: p.mouseVar.key, back: p.mouseVar.back, mid: p.mouseVar.mid, belly: p.mouseVar.belly } : "null");
  });
  console.log("诊断 mouseVar:", JSON.stringify(diag2));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, "ref-restyle-2-grid6.png") });
  // 采样每只鼠身体中心点的实际渲染 RGB（在 Node 侧解码 PNG，规避 canvas taint）
  const pngjs = (function () {
    for (const p of ["/tmp/ffshot/node_modules/pngjs", "/Users/lipeng/node_modules/pngjs"]) {
      try { return require(p); } catch (e) { /* next */ }
    }
    return null;
  })();
  const decodePNG = (buf) => pngjs ? pngjs.PNG.sync.read(buf) : null;
  const pos = await page.evaluate(() => {
    const G = window.G;
    return G.preys.map(p => ({ k: p.mouseVar && p.mouseVar.key, x: p.x, y: p.y }));
  });
  if (decodePNG) {
    const png = decodePNG(fs.readFileSync(path.join(OUT, "ref-restyle-2-grid6.png")));
    // 截图是 844x390，但 dpr 可能 2x —— 用 png 尺寸比例换算
    const scale = png.width / 844;
    const sample = (x, y) => {
      const px = Math.round(x * scale), py = Math.round(y * scale);
      const idx = (py * png.width + px) * 4;
      return [png.data[idx], png.data[idx + 1], png.data[idx + 2]];
    };
    // 每只鼠取身体中心附近 3 点（偏移 0, ±6）取平均
    const samples = pos.map(p => {
      const pts = [[p.x, p.y + 4], [p.x - 6, p.y], [p.x + 6, p.y]];
      const avg = [0, 0, 0];
      pts.forEach(([x, y]) => { const c = sample(x, y); avg[0] += c[0]; avg[1] += c[1]; avg[2] += c[2]; });
      return { k: p.k, rgb: avg.map(v => Math.round(v / 3)) };
    });
    console.log("采样 RGB:", JSON.stringify(samples));
  } else {
    console.log("(pngjs 未装，跳过采样)");
  }
  console.log("横屏重设计截图完成 | errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
