/* 群鼠乱窜 端到端启动测试：模拟完整用户流程（首页→选群鼠→开始→跑10s）
   跑法：node test/probe_swarm_start.js */
const fs = require("fs");
const path = require("path");
const pc = (function () {
  for (const p of ["/Users/lipeng/node_modules/playwright-core", "/tmp/ffshot/node_modules/playwright-core"]) {
    try { return require(p); } catch (e) {}
  }
  throw new Error("找不到 playwright-core");
})();
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";

(async () => {
  const browser = await pc.chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", msg => { if (msg.type() === "error") errors.push("console: " + msg.text()); });

  const mods = {};
  for (const n of ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
    "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
    "./js/ad.js", "./js/feeder.js", "./game.js"]) {
    mods[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  }
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, mods);
  await page.evaluate(() => window.require("./game.js"));
  await page.waitForTimeout(500);

  // 模拟用户操作：首页 → 选小鼠迷宫 → 选群鼠乱窜 → 开始
  const result = await page.evaluate(() => {
    const G = window.G;
    try {
      // 1. 选小鼠迷宫
      G.config.targetType = "mouse";
      // 2. 打开背景选择
      G.openBgPick();
      // 3. 选择群鼠乱窜
      const arr = G.bgsFor("mouse");
      const swarmIdx = arr.findIndex(b => b.key === "swarm");
      if (swarmIdx < 0) return { error: "swarm not found in bgsFor(mouse)" };
      G.bgPick.idx = swarmIdx;
      G.confirmBgPick();
      // 此时应已进入 counting 或 playing
      const screen = G.screen;
      // 等倒计时结束
      return { ok: true, screen, preys: G.preys.length, scene: G.scene.type, mouseBg: G.scene.mouseBg };
    } catch (e) {
      return { error: e.message + " | " + e.stack };
    }
  });
  console.log("启动结果:", JSON.stringify(result, null, 2));

  // 等倒计时结束进入 playing
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) {
    const s = await page.evaluate(() => window.G.screen);
    if (s === "playing") break;
    await page.waitForTimeout(50);
  }
  const screenNow = await page.evaluate(() => window.G.screen);
  console.log("当前屏幕:", screenNow);

  // 跑 8 秒，捕获所有运行时错误
  await page.waitForTimeout(8000);
  const finalState = await page.evaluate(() => {
    const G = window.G;
    return {
      screen: G.screen,
      preys: G.preys.length,
      preysInfo: G.preys.map(p => ({ type: p.type, x: p.x?.toFixed(0), y: p.y?.toFixed(0), state: p.state, mouseVar: p.mouseVar?.key })),
      session: { stage: G.session.stage, hits: G.session.hits, running: G.session.running }
    };
  });
  console.log("运行 8s 后状态:", JSON.stringify(finalState, null, 2));

  // 尝试模拟点击（命中鼠）
  if (screenNow === "playing" && finalState.preys.length > 0) {
    const hitResult = await page.evaluate(() => {
      const G = window.G;
      try {
        const p = G.preys[0];
        G.hit(p.x, p.y);
        return { hit: true, preys: G.preys.length, hits: G.session.hits };
      } catch (e) {
        return { error: e.message + " | " + e.stack };
      }
    });
    console.log("命中测试:", JSON.stringify(hitResult, null, 2));
    await page.waitForTimeout(2000);
  }

  console.log("\n=== 错误汇总 ===");
  if (errors.length) {
    errors.forEach(e => console.log("❌", e));
  } else {
    console.log("✅ 无错误");
  }
  await browser.close();
})();
