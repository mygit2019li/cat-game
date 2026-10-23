/* 存成图片链路探针：验证「授权弹窗 + 同意后保持」行为
   覆盖：
   T1 首次点 → 弹我们的「允许」确认框 → 同意 → 保存成功 + 记 OK 标志
   T2 再次点（已同意）→ 不再弹确认框，直接保存
   T3 系统授权被拒（auth deny）→ 记 DENY 标志 + 引导去设置
   T4 再次点（已拒过）→ 直接引导设置，不再弹「允许」框
   T5 用户取消我们的确认框 → 本次不保存、不记标志，下次再点仍会问
   运行：node test/probe_savecard.js                                                  */
const path = require("path");
const ROOT = path.join(__dirname, "..");

function stubCtx() {
  const noop = () => {};
  const o = { canvas: { width: 750, height: 600 }, measureText: () => ({ width: 40 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) };
  return new Proxy(o, { get(t, k) { return k in t ? t[k] : noop; }, set(t, k, v) { t[k] = v; return true; } });
}

function boot(opts) {
  const store = {};
  const log = { modals: [], toasts: [], loading: 0, saves: 0, files: [], openSetting: 0 };
  const canvas = { width: 0, height: 0, getContext: () => stubCtx() };
  if (!opts.noSyncExport) canvas.toTempFilePathSync = () => "wxfile://tmp/catToy.jpg";
  if (!opts.noDataURL) canvas.toDataURL = () => "data:image/jpeg;base64," + "A".repeat(512);
  const cur = { saveFail: opts.saveFail || "" };
  global.wx = {
    env: { USER_DATA_PATH: "/usr" },
    createCanvas: () => canvas,
    getStorageSync: (k) => (k in store ? store[k] : ""),
    setStorageSync: (k, v) => { store[k] = v; },
    showToast: (o) => log.toasts.push(o && o.title),
    showModal: (o) => {
      log.modals.push((o && o.title || "") + " | " + (o && o.content || ""));
      // 「去设置」这类引导框强制确认（触发 openSetting）；其余尊重 modalAllow
      const confirm = (o && o.confirmText === "去设置") ? true : !!opts.modalAllow;
      if (o && o.success) o.success({ confirm });
      if (confirm && o && o.confirmText === "去设置") { log.openSetting++; }
    },
    showLoading: () => log.loading++, hideLoading: () => log.loading--,
    openSetting: () => { log.openSetting++; },
    getFileSystemManager: () => ({ writeFileSync: (fp, d, enc) => log.files.push({ fp, len: String(d).length, enc }) }),
    saveImageToPhotosAlbum: (o) => {
      if (cur.saveFail) o.fail && o.fail({ errMsg: cur.saveFail });
      else { log.saves++; o.success && o.success({}); }
    }
  };
  global.__curSaveFail = cur;

  const G = {
    platform: { storage: {
      get: (k) => (k in store ? store[k] : ""),
      set: (k, v) => { store[k] = v; }
    } },
    config: { targetType: "fish", duration: 180 },
    result: { hits: 29, maxCombo: 6, acc: 82, title: "捕猎高手", desc: "反应不错" },
    getLogs: () => [],
    archiveSummary: () => ({ games: 5, hits: 120, days: 3, favType: "fish", hpmRecent: 9.6, trend: 0.2, touches: 300 }),
    rr: () => {}
  };
  require(path.join(ROOT, "js/sharecard.js"))(G);
  return { G, log, store };
}

let bad = 0;
function check(name, cond, extra) { console.log((cond ? "✅ " : "❌ ") + name + (extra ? " → " + extra : "")); if (!cond) bad++; }

/* ---- T1 + T2：首弹确认框→同意→保存；再点不再弹框直接保存 ---- */
{
  const r = boot({ modalAllow: true });
  r.G.saveShareCard();                       // T1 首次
  const sawConfirm = r.log.modals.some(t => t.indexOf("保存测评图") >= 0);
  const okSet = r.store["catToyAlbumOk"] === "1";
  check("T1 首次弹出「保存测评图」确认框", sawConfirm, "modals=" + JSON.stringify(r.log.modals));
  check("T1 同意后保存成功并记 OK 标志", r.log.saves === 1 && okSet);

  const m0 = r.log.modals.length;            // T1 之后取基准，T2 只看增量
  r.G.saveShareCard();                       // T2 已同意
  const confirmAgain = r.log.modals.slice(m0).some(t => t.indexOf("保存测评图") >= 0);
  check("T2 已同意后不再弹确认框", !confirmAgain);
  check("T2 直接保存成功", r.log.saves === 2);
}

/* ---- T3 + T4：系统拒授权→记 DENY + 引导设置；再点直接引导 ---- */
{
  const r = boot({ modalAllow: true });
  global.__curSaveFail.saveFail = "saveImageToPhotosAlbum:fail auth deny";
  r.G.saveShareCard();                       // T3 系统拒绝
  const deniedSet = r.store["catToyAlbumDenied"] === "1";
  const guided = r.log.modals.some(t => t.indexOf("需要相册权限") >= 0);
  check("T3 系统拒授权后记 DENY 标志并引导设置", deniedSet && guided, "openSetting=" + r.log.openSetting);

  const m0 = r.log.modals.length;
  r.G.saveShareCard();                       // T4 已拒过
  const confirmAgain = r.log.modals.slice(m0).some(t => t.indexOf("保存测评图") >= 0);
  const guidedAgain = r.log.modals.slice(m0).some(t => t.indexOf("需要相册权限") >= 0);
  check("T4 已拒过后不再弹「允许」框，直接引导设置", !confirmAgain && guidedAgain);
  check("T4 未触发保存", r.log.saves === 0);
}

/* ---- T5：用户取消我们的确认框 ---- */
{
  const r = boot({ modalAllow: false });
  r.G.saveShareCard();
  check("T5 取消确认框→本次不保存", r.log.saves === 0);
  check("T5 取消后未记任何标志（下次仍会问）", !r.store["catToyAlbumOk"] && !r.store["catToyAlbumDenied"]);
}

console.log(bad ? "\n有 " + bad + " 项未通过" : "\n全部通过：授权弹窗 + 同意后保持 行为正确");
