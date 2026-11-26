/* room 场景开局"有些老鼠特别大"修复验证：
   1) 确认 3 张 vseq 基准 sheet 加载成功（base.ok）
   2) 侧视三态鼠身宽应一致（≈97.7）：dart(fast) / peek(look) / hole(run帧)
   3) 关键：开局 LUT 未就绪（节流窗口内）时，peek 应回退 base 灰鼠 sheet（同尺寸≈97.7），
      而非回退 HD side 贴图（104 宽，画风不同）——即不再出现"特别大的老鼠"
   4) 俯视 sit（pause）能正常渲染、宽度≈94（脚线对齐已用 node 数值验证）
   5) 无渲染报错
   跑法：node test/shot_room_fix.js */
const fs = require("fs");
const path = require("path");
const pc = require("/tmp/ffshot/node_modules/playwright-core");
const ROOT = "/Users/lipeng/www/myproject/cat-game/minigame";
const OUT = path.join(ROOT, "screenshots");
const MODS = ["./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/ad.js", "./js/feeder.js", "./game.js"];

/* 注入页面的测量函数：渲染一个假鼠并量其 alpha 包围盒（sc=1，设计单位=画布像素）。
   side: G.draw.mouse，锚点(60,39)置于画布 (ax,ay)。
   top : G.draw.mouseTop，锚点(60,50)，套用 prey.js 外层 rotate(π/2) 使鼠转正。
   返回 {w,h,x0,x1,y0,y1}（y1=底边）。 */
const measureSrc = `
  (kind, p, t, ax, ay, W, H) => {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    c.save();
    if (kind === "side") { c.translate(ax, ay); c.translate(-60, -39); window.G.draw.mouse(c, p, t); }
    else { c.translate(ax, ay); c.rotate(Math.PI / 2); c.translate(-60, -50); window.G.draw.mouseTop(c, p, t); }
    c.restore();
    const d = c.getImageData(0, 0, W, H).data;
    let x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return { empty: true };
    return { w: x1 - x0 + 1, h: y1 - y0 + 1, x0, x1, y0, y1 };
  }`;

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
  await page.evaluate(src => { window.__measure = eval("(" + src + ")"); }, measureSrc);

  // 等 3 张 vseq 基准 sheet 加载
  await page.waitForFunction(() => {
    const D = window.G && window.G.draw;
    const v = D && D.MICEHD && D.MICEHD.vseq;
    return v && v.fast && v.look && v.sit &&
      v.fast.base && v.fast.base.ok &&
      v.look.base && v.look.base.ok &&
      v.sit.base && v.sit.base.ok;
  }, { timeout: 20000 }).catch(() => {});

  const result = await page.evaluate(async () => {
    const G = window.G, HD = G.draw.MICEHD;
    const keys = ["house", "charcoal", "albino", "deer", "pup", "smoky"];
    const segs = ["fast", "look", "sit"];
    const mkP = (state, key) => ({
      state, vanishT: 0, phase: 0.3, _moveSp: 300, faceDir: 1, _visAng: 0,
      mouseVar: G.MOUSE_VARIANTS.find(v => v.key === key) || { key }
    });
    const SIDE = [75, 45, 150, 110], TOP = [100, 100, 200, 200];
    const out = { base: {}, side: {}, topSit: {}, fallback: {}, errors: [] };
    try {
      for (const seg of segs) out.base[seg] = !!(HD.vseq[seg] && HD.vseq[seg].base && HD.vseq[seg].base.ok);

      /* 先让 6 花色 look 的着色画布全部就绪（t 递增 0.1s 绕开 30ms 节流） */
      let t = 100;
      for (const k of keys) {
        window.__measure("side", mkP("peek", k), t, 75, 45, 150, 110);
        t += 0.1;
      }

      /* 侧视三态（LUT 已就绪） */
      const tSide = 300;
      out.side.dart = window.__measure("side", mkP("dart", "house"), tSide, ...SIDE);
      out.side.peek = window.__measure("side", mkP("peek", "house"), tSide + 0.05, ...SIDE);
      out.side.hole = window.__measure("side", mkP("hole", "house"), tSide + 0.1, ...SIDE);

      /* 俯视 sit（pause） */
      out.topSit.pause = window.__measure("top", mkP("pause", "house"), tSide + 0.2, ...TOP);

      /* 关键：强制"开局 LUT 未就绪"。清空所有 vseq 着色画布，
         先渲染 house（t 大、必不节流）触发一次构建，紧接着 pup 在 16ms 内 → 节流 → 走 base 灰表回退 */
      for (const seg of segs) HD.vseq[seg].canv = {};
      const tB = 500;
      window.__measure("side", mkP("peek", "house"), tB, ...SIDE);                 // 构建 house（设 _vseqLastBuild）
      out.fallback.peekThrottled = window.__measure("side", mkP("peek", "pup"), tB + 0.016, ...SIDE); // 节流→base 灰表
      out.fallback.peekBuilt = window.__measure("side", mkP("peek", "pup"), tB + 1.0, ...SIDE);         // 稍后不节流→构建成功
    } catch (e) { out.errors.push(String(e)); }
    return out;
  });

  // 展示画：侧视 dart/peek/hole + 回退对比（横向并排，脚线参考 y=68）
  const grid = await page.evaluate(() => {
    const G = window.G;
    const V = G.MOUSE_VARIANTS;
    const items = [
      ["dart(fast) w≈97.7", { state: "dart", vanishT: 0, phase: .3, _moveSp: 300, faceDir: 1, _visAng: 0, mouseVar: V[0] }],
      ["peek(look) w≈97.7", { state: "peek", vanishT: 0, phase: .3, _moveSp: 300, faceDir: 1, _visAng: 0, mouseVar: V[1] }],
      ["hole(run) w≈97.7", { state: "hole", vanishT: 0, phase: .3, _moveSp: 300, faceDir: 1, _visAng: 0, mouseVar: V[2] }],
    ];
    const cw = 150, ch = 110, gap = 8;
    const W = items.length * (cw + gap) + 16, H = ch + 36;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    cv.style.cssText = "position:fixed;left:0;top:0;z-index:9999";
    document.body.appendChild(cv);
    const c = cv.getContext("2d");
    c.fillStyle = "#1c2027"; c.fillRect(0, 0, W, H);
    items.forEach((it, i) => {
      const x = 8 + i * (cw + gap), y = 8;
      c.fillStyle = "#232830"; c.fillRect(x, y, cw, ch);
      c.strokeStyle = "rgba(120,200,255,.5)"; c.setLineDash([4, 3]);
      c.beginPath(); c.moveTo(x, y + 68); c.lineTo(x + cw, y + 68); c.stroke(); c.setLineDash([]);
      c.fillStyle = "#ffd77a"; c.font = "13px sans-serif"; c.fillText(it[0], x + 6, y + 16);
      c.save(); c.translate(x + 75, y + 45); c.translate(-60, -39);
      G.draw.mouse(c, it[1], 0.6); c.restore();
    });
    return { W, H };
  });

  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, "room-fix-check.png"), clip: { x: 0, y: 0, width: grid.W, height: grid.H } });

  const f = (o) => o && !o.empty ? `w=${o.w} foot(y1)=${o.y1} top(y0)=${o.y0}` : "EMPTY";
  console.log("== room 开局尺寸修复验证 ==");
  console.log("基准 sheet 加载:", JSON.stringify(result.base));
  console.log("侧视 dart :", f(result.side.dart));
  console.log("侧视 peek :", f(result.side.peek));
  console.log("侧视 hole :", f(result.side.hole));
  console.log("俯视 sit  :", f(result.topSit.pause));
  console.log("回退 peek(节流, 应 base 灰表≈97.7):", f(result.fallback.peekThrottled));
  console.log("回退 peek(构建后, ≈97.7)          :", f(result.fallback.peekBuilt));
  console.log("渲染错误:", (errors.length ? errors.slice(0, 5).join(" | ") : "none") +
    (result.errors.length ? " | eval: " + result.errors.join(";") : ""));
  await browser.close();
})().catch(e => { console.error("TEST FAILED:", e); process.exit(1); });
