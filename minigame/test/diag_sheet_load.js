/* 最小复现：harness(file://) 页内加载 vseq sheet 是否污染画布 */
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
  const page = await browser.newPage();
  page.on("console", m => console.log("[page]", m.type(), m.text()));
  await page.goto("file://" + path.join(ROOT, "test/harness.html"));
  const r = await page.evaluate(async (sheetRel) => {
    const img = new Image();
    const t = new Promise(res => { img.onload = () => res("load"); img.onerror = () => res("error"); });
    img.src = sheetRel;
    const how = await t;
    if (how !== "load") return { how, w: img.naturalWidth, h: img.naturalHeight };
    const cv = document.createElement("canvas");
    cv.width = img.naturalWidth * 0.5; cv.height = img.naturalHeight * 0.5;
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    try {
      const id = ctx.getImageData(0, 0, cv.width, cv.height);
      let nz = 0; for (let i = 3; i < id.data.length; i += 4) if (id.data[i]) nz++;
      return { how, w: img.naturalWidth, h: img.naturalHeight, ok: true, nonZeroAlpha: nz };
    } catch (e) {
      return { how, w: img.naturalWidth, h: img.naturalHeight, ok: false, err: String(e) };
    }
  }, "../assets/mice/video/sit_sheet.png");
  console.log(JSON.stringify(r, null, 2));
  await browser.close();
})();
