/* check_frog_voice.js — 蛙鸣接线验收
   1) 三段音频预取（两段单声 + 一段落地"呱呱"）
   2) 起跳不再有任何音效（playFrogJump 已移除）
   3) 落地走 frog-land.wav，300ms 内只叫一次
   4) 静坐偶发走单声，1.1s 限流
   5) 四个 wav 能被浏览器真正解码（duration > 0，不是空壳文件）
   5) 关闭音效时完全不调用
*/
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOD_NAMES = [
  "./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/feeder.js", "./game.js"
];

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/ERR_FILE_NOT_FOUND/.test(m.text())) errors.push(m.text()); });

  const modules = {};
  for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(400);

  const r = await page.evaluate(async () => {
    const G = window.G;
    const calls = [];
    const orig = G.platform.sfx.bind(G.platform);
    G.platform.sfx = (src, vol) => {
      const ok = orig(src, vol);
      calls.push({ src: src.split("/").pop(), vol, ok });
      return ok;
    };

    G.preloadFrogVoices();
    const pooled = Object.keys(G.platform.sfxPool).map(s => s.split("/").pop()).sort();

    // 起跳音已移除
    const noJumpApi = typeof G.playFrogJump === "undefined" && typeof G.playFrogSplash === "undefined";

    // 拍中：走 onHit 路径应触发 frog-hit.mp3，并炸出专属特效（草屑 confetti）
    G.config.targetType = "frog";
    if (!G.scene || !G.scene.type) G.buildScene("frog");
    G.fx.clear();
    const fake = { type: "frog", fState: "crouch", x: 180, y: 420, jumpH: 0, def: { sparkColor: "#bdf58a" }, vanish() {} };
    const beforeHit = calls.length;
    G.onHit(fake.x, fake.y, fake);
    const hitSfx = calls.slice(beforeHit).map(c => c.src);
    const fxAfterHit = { confetti: G.fx.confetti.length, shockwaves: G.fx.shockwaves.length, pollen: G.fx.pollen.length };
    // 140ms 内再打一次：不应再响（连击不叠成机关枪）
    const beforeRapid = calls.length;
    G.onHit(fake.x, fake.y, fake);
    const rapidBlocked = calls.length === beforeRapid;

    // 落地"呱呱"：连两声只放行一次
    G.playFrogLandCroak();
    G.playFrogLandCroak();
    const afterLand = calls.slice();

    await new Promise(r => setTimeout(r, 1200));

    // 静坐单声：连续两次也应只放行一次
    const beforeIdle = calls.length;
    G.playFrogCroak();
    G.playFrogCroak();
    const idleCalls = calls.slice(beforeIdle);

    // 静音开关
    await new Promise(r => setTimeout(r, 1200));
    G.config.sound = false;
    const beforeMute = calls.length;
    G.playFrogLandCroak();
    G.playFrogCroak();
    const mutedBlocked = calls.length === beforeMute;
    G.config.sound = true;

    const bad = pooled.filter(k => G.platform.sfxPool["assets/sfx/" + k] && G.platform.sfxPool["assets/sfx/" + k]._bad);
    // 文件真实性：真的能被解码出时长（防止"文件存在但内容坏/为空"）
    const decoded = [];
    for (const f of ["frog-croak-1.wav", "frog-croak-2.wav", "frog-land.wav", "frog-hit.wav"]) {
      const a = new Audio("../assets/sfx/" + f);
      const dur = await new Promise(res => {
        const done = (v) => res(v);
        a.addEventListener("loadedmetadata", () => done(a.duration));
        a.addEventListener("error", () => done(-1));
        setTimeout(() => done(-2), 1500);
        a.load();
      });
      decoded.push({ f, dur: Math.round(dur * 100) / 100 });
    }

    return { pooled, noJumpApi, hitSfx, fxAfterHit, rapidBlocked, afterLand, idleCalls, mutedBlocked, bad, decoded };
  });

  console.log(JSON.stringify(r, null, 1));
  console.log("errors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})().catch(e => { console.error("FAIL", e); process.exit(1); });
