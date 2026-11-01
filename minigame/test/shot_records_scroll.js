/* shot_records_scroll.js — 本周记录：7 天 / 200 条上限 + 上下滚动
   1) 写入 250 条近期 + 6 条过期记录 → getLogs 只返回 200 条且不含过期
   2) pruneLogs 写入前裁剪：存储里也只留 200 条
   3) 打开弹窗：内容超一屏 → maxScroll > 0、出现滚动条
   4) 手指上拖 → 列表位移、松手有惯性；拖到顶不会越界
   5) 拖动不会误关弹窗；截图（顶部 / 滚动后 / 到底 / 横屏）
*/
const fs = require("fs");
const path = require("path");
const pc = require("/Users/lipeng/node_modules/playwright-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "screenshots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOD_NAMES = [
  "./js/platform.js", "./js/config.js", "./js/audio.js", "./js/draw.js",
  "./js/scenery.js", "./js/prey.js", "./js/ui.js", "./js/sharecard.js",
  "./js/feeder.js", "./game.js"
];

async function open(browser, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/ERR_FILE_NOT_FOUND/.test(m.text())) errors.push(m.text()); });
  const modules = {};
  for (const n of MOD_NAMES) modules[n] = fs.readFileSync(path.join(ROOT, n), "utf8");
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  await page.evaluate(m => { Object.assign(window.__MODULES__, m); }, modules);
  await page.evaluate(() => { window.require("./game.js"); });
  await page.waitForTimeout(450);
  return { page, errors };
}

/* 造 250 条近期记录（最近 3 天里轮转）+ 6 条 10 天前的过期记录 */
const seed = () => {
  const G = window.G;
  const now = Date.now(), DAY = 86400000;
  const types = ["fish", "butterfly", "mouse", "laser", "pool", "frog"];
  const rows = [];
  for (let i = 0; i < 250; i++) {
    const t = now - (i % 3) * DAY - (i % 7) * 3600000;
    const d = new Date(t);
    rows.push({
      ts: t, date: (d.getMonth() + 1) + "/" + d.getDate(),
      type: types[i % types.length], dur: 180,
      hits: 60 - (i % 55), touches: 80 - (i % 60),
      accuracy: 40 + (i % 50), combo: 20 - (i % 18),
      dart: 0, bonus: i % 5
    });
  }
  for (let i = 0; i < 6; i++) {
    const t = now - (10 + i) * DAY;
    const d = new Date(t);
    rows.push({ ts: t, date: (d.getMonth() + 1) + "/" + d.getDate(), type: "fish", dur: 180, hits: 99, touches: 100, accuracy: 99, combo: 9, dart: 0, bonus: 0 });
  }
  G.platform.storage.set("catToyLogs", JSON.stringify(rows));
};

const drag = async (page, fromY, toY, steps, x) => {
  return page.evaluate(async ({ fromY, toY, steps, x }) => {
    const G = window.G, S = G.platform.S || 1;
    G.platform.onTouchStart({ touches: [{ clientX: x * S, clientY: fromY * S }] });
    for (let i = 1; i <= steps; i++) {
      const y = fromY + (toY - fromY) * (i / steps);
      G.platform.onTouchMove({ touches: [{ clientX: x * S, clientY: y * S }] });
      await new Promise(r => requestAnimationFrame(r));
    }
    const dragging = G.modal && G.modal.rec ? G.modal.rec.y : -1;
    G.platform.onTouchEnd({ changedTouches: [{ clientX: x * S, clientY: toY * S }] });
    return { dragging, screen: G.screen };
  }, { fromY, toY, steps, x });
};

(async () => {
  const browser = await pc.chromium.launch({ executablePath: CHROME, headless: true });

  // ---------- 1. 存储上限 ----------
  {
    const { page, errors } = await open(browser, 390, 844);
    await page.evaluate(seed);
    const r = await page.evaluate(() => {
      const G = window.G;
      const logs = G.getLogs();
      const raw = JSON.parse(G.platform.storage.get("catToyLogs") || "[]");
      const pruned = G.pruneLogs(raw);
      const now = Date.now(), DAY = 86400000;
      return {
        rawCount: raw.length,
        kept: logs.length,
        prunedKept: pruned.length,
        oldestDays: +((now - Math.min.apply(null, logs.map(l => l.ts))) / DAY).toFixed(1),
        overLimit: logs.some(l => l.hits === 99)          // 过期记录标记值：不该出现
      };
    });
    console.log("存储: 原始 " + r.rawCount + " 条 → getLogs " + r.kept + " 条 / pruneLogs " + r.prunedKept + " 条");
    console.log("存储: 最早记录 " + r.oldestDays + " 天前 | 7 天外记录是否混入: " + (r.overLimit ? "是（BUG）" : "否"));
    console.log("存储 errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 2. 滚动（竖屏） ----------
  {
    const { page, errors } = await open(browser, 390, 844);
    await page.evaluate(seed);
    await page.evaluate(() => window.G.openModal("records"));
    await page.waitForTimeout(420);

    const geo = await page.evaluate(() => {
      const G = window.G;
      return { panel: G.modal.geo, list: G.modal.rec.geo, total: G.getLogs().length };
    });
    await page.screenshot({ path: path.join(OUT, "records-1-top.png") });

    const midX = geo.list.x + geo.list.w / 2;
    // 手指从列表中部往上拖 260px
    const up = await drag(page, geo.list.y + geo.list.h * 0.7, geo.list.y + geo.list.h * 0.7 - 260, 10, midX);
    const afterUp = await page.evaluate(() => {
      const st = window.G.modal.rec;
      return { y: +st.y.toFixed(1), v: +st.v.toFixed(0), max: +st.geo.maxScroll.toFixed(1), screen: window.G.screen };
    });
    await page.waitForTimeout(600);                      // 惯性停下
    const settled = await page.evaluate(() => +window.G.modal.rec.y.toFixed(1));
    await page.screenshot({ path: path.join(OUT, "records-2-scrolled.png") });

    // 甩到底：连续上拖，直到 y 到达 maxScroll（最多 30 次，够 200 条走完）
    let tries = 0;
    while (tries++ < 30) {
      await drag(page, geo.list.y + geo.list.h * 0.9, geo.list.y + 20, 12, midX);
      await page.waitForTimeout(500);
      const atEnd = await page.evaluate(() => {
        const st = window.G.modal.rec;
        return Math.abs(st.y - st.geo.maxScroll) < 1.5;
      });
      if (atEnd) break;
    }
    const bottom = await page.evaluate(() => {
      const st = window.G.modal.rec;
      return { y: +st.y.toFixed(1), max: +st.geo.maxScroll.toFixed(1), atBottom: Math.abs(st.y - st.geo.maxScroll) < 1.5, drags: 0 };
    });
    bottom.drags = tries;
    await page.screenshot({ path: path.join(OUT, "records-3-bottom.png") });

    // 拖到顶：y 置 0 后再往下拖 200px → 必须仍停在 0（不出现空白回弹）
    await page.evaluate(() => { window.G.modal.rec.y = 0; window.G.modal.rec.v = 0; });
    await page.waitForTimeout(100);
    await drag(page, geo.list.y + 30, geo.list.y + 30 + 220, 8, midX);
    await page.waitForTimeout(500);
    const top = await page.evaluate(() => {
      const st = window.G.modal.rec;
      return { y: +st.y.toFixed(1), atTop: st.y === 0, screen: window.G.screen };
    });
    await page.screenshot({ path: path.join(OUT, "records-4-back-top.png") });

    console.log("滚动: 列表 " + Math.round(geo.list.w) + "×" + Math.round(geo.list.h) +
      " 可视 | 内容 " + geo.total + " 条 | maxScroll " + geo.list.maxScroll.toFixed(0));
    console.log("滚动: 上拖后 y=" + up.dragging.toFixed(0) + " → 松手 y=" + afterUp.y +
      " v=" + afterUp.v + " | 惯性停下 y=" + settled);
    console.log("滚动: 到底 y=" + bottom.y + "/" + bottom.max + " atBottom=" + bottom.atBottom +
      "（第 " + bottom.drags + " 次上拖后） | 顶部再下拖 y=" + top.y + " atTop=" + top.atTop);
    console.log("滚动: 拖动过程中是否误关弹窗: " + (up.screen === "records" ? "否" : "是（BUG）") +
      " | 最终 screen=" + top.screen);
    console.log("竖屏 errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  // ---------- 3. 横屏 ----------
  {
    const { page, errors } = await open(browser, 852, 393);
    await page.evaluate(seed);
    await page.evaluate(() => window.G.openModal("records"));
    await page.waitForTimeout(420);
    await page.screenshot({ path: path.join(OUT, "records-5-land.png") });
    const geo = await page.evaluate(() => window.G.modal.rec.geo);
    console.log("横屏: 列表高 " + Math.round(geo.h) + " maxScroll " + geo.maxScroll.toFixed(0));
    console.log("横屏 errors:", errors.length ? errors.join(" | ") : "none");
    await page.close();
  }

  await browser.close();
  console.log("DONE ->", OUT);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
