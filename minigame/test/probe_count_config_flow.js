/* probe_count_config_flow.js — 设置项数量配置 → 实际猎物生成数据链路探针
   目的：检查 preyCount / ffCount 是否真正从设置存储驱动到 buildPreys / stageTargetCount / topUpPreys，
        并标出哪些模式实际被其他来源（阶段、动态 tadCount、场景孔洞/荷叶/鱼群）覆盖或限制。
   用法：node test/probe_count_config_flow.js */
const path = require("path");
const ROOT = path.join(__dirname, "..");

let __seed = 20261120;
Math.random = () => { __seed = (__seed * 1664525 + 1013904223) >>> 0; return __seed / 4294967296; };

const G = {};
G.platform = {
  S: 1.5, W: 1200, H: 800,
  safe: { top: 40, bottom: 40, left: 0, right: 0 },
  storage: {
    _d: {},
    get(k) { return this._d[k] == null ? null : this._d[k]; },
    set(k, v) { this._d[k] = v; }
  }
};
G.bounds = () => ({ x: 20, y: 96, w: 1160, h: 660 });
G.draw = new Proxy({}, { get: () => () => {} });
G.tadpoleEscape = () => {};

require(path.join(ROOT, "js/config.js"))(G);
G.fx = { clear: () => {} };
G.SEA_THEMES = [{ key: "kelp" }, { key: "pool" }, { key: "school" }];
require(path.join(ROOT, "js/scenery.js"))(G);
require(path.join(ROOT, "js/prey.js"))(G);

const A = [];
let pass = 0, fail = 0;
function ok(cond, msg, detail) {
  A.push((cond ? "✅ " : "❌ ") + msg + (detail != null ? "  → " + detail : ""));
  cond ? pass++ : fail++;
}

function setConfig(patch) {
  G.config = Object.assign({}, G.config, patch);
}
function resetSession(stage, extra) {
  G.session = Object.assign({
    time: 0, stage: stage || 1, running: false, paused: false, counting: true,
    hits: 0, tadCount: 1, tadEval: 0, tadMark: 0, tadDown: 0, adaptiveTier: 0, combo: 0, sea: null
  }, extra || {});
}
function setFrogScene(stage) {
  G.buildScene("frog");
  const pads = [];
  for (let i = 0; i < 6; i++) {
    pads.push({
      x: 100 + i * 100,
      y: 150 + (i % 2) * 120,
      r: 60,
      sink: 0,
      sinkState: i < 5 ? "float" : "sunk",
      small: false,
      gone: false
    });
  }
  G.scene.pads = pads;
  resetSession(stage);
}
function resetScene(extra) {
  G.scene = Object.assign({ holes: [], pads: [], mouseBg: "room", sea: null, holeOwners: [], holeHeat: [] }, extra || {});
}
function build(type) {
  G.buildPreys();
  return G.preys.length;
}
function countAfterTopUp(type) {
  G.buildPreys();
  G.topUpPreys();
  return G.preys.length;
}

/* 1. 默认加载：storage 为空时，preyCount/ffCount 使用冷启动默认。 */
ok(G.config.preyCount === 1, "空存档默认 preyCount=1（单只）", String(G.config.preyCount));
ok(G.config.ffCount === 1, "空存档默认 ffCount=1", String(G.config.ffCount));

/* 2. 保存设置 → 重新 loadConfig：确认设置写入 catToyConfig 会被加载链读回。 */
G.platform.storage.set("catToyConfig", JSON.stringify(Object.assign({}, G.config, { preyCount: 3, ffCount: 6, pcV1: 1 })));
require(path.join(ROOT, "js/config.js"))(G);
ok(G.config.preyCount === 3, "保存 preyCount=3 后重加载仍为 3", String(G.config.preyCount));
ok(G.config.ffCount === 6, "保存 ffCount=6 后重加载仍为 6", String(G.config.ffCount));

/* 3. buildPreys：通用模式实际生成数量读取 G.config.preyCount。 */
resetScene(); resetSession(1);
setConfig({ targetType: "butterfly", preyCount: 1 });
ok(build("butterfly") === 1, "蝴蝶：preyCount=1 → buildPreys 生成 1 只", String(G.preys.length));
setConfig({ targetType: "butterfly", preyCount: 3 });
ok(build("butterfly") === 3, "蝴蝶：preyCount=3 → buildPreys 生成 3 只", String(G.preys.length));

setConfig({ targetType: "laser", preyCount: 1 });
ok(build("laser") === 1, "激光：preyCount=1 → buildPreys 生成 1 只", String(G.preys.length));
setConfig({ targetType: "laser", preyCount: 3 });
ok(build("laser") === 3, "激光：preyCount=3 → buildPreys 生成 3 只", String(G.preys.length));

/* 4. pool：读取 ffCount，不是 preyCount。 */
resetScene(); resetSession(1);
setConfig({ targetType: "pool", preyCount: 1, ffCount: 6 });
ok(build("pool") === 6, "暗夜荧光：ffCount=6 → buildPreys 生成 6 只（与 preyCount=1 无关）", String(G.preys.length));
setConfig({ targetType: "pool", preyCount: 3, ffCount: 2 });
ok(build("pool") === 2, "暗夜荧光：ffCount=2 → buildPreys 生成 2 只（与 preyCount=3 无关）", String(G.preys.length));

/* 5. 通用模式的 topUpPreys 会按 stageTargetCount 把数量推到阶段基线，preyCount=3 时不再只是 3。 */
resetScene(); resetSession(1);
setConfig({ targetType: "butterfly", preyCount: 3 });
const bflyTop = countAfterTopUp("butterfly");
ok(bflyTop === 3, "蝴蝶 stage1：preyCount=3 → topUp 后 3 只", String(bflyTop));
resetSession(2);
setConfig({ targetType: "butterfly", preyCount: 3 });
const bflyTop2 = countAfterTopUp("butterfly");
ok(bflyTop2 === 5, "蝴蝶 stage2：preyCount=3 → 被阶段基线覆盖为 5 只", String(bflyTop2));
resetSession(3);
setConfig({ targetType: "butterfly", preyCount: 3 });
const bflyTop3 = countAfterTopUp("butterfly");
ok(bflyTop3 === 7, "蝴蝶 stage3：preyCount=3 → 被阶段基线覆盖为 7 只", String(bflyTop3));
resetSession(1);
setConfig({ targetType: "butterfly", preyCount: 1 });
const bflySingle = countAfterTopUp("butterfly");
ok(bflySingle === 1, "蝴蝶 stage1：preyCount=1 → topUp 后保持 1 只", String(bflySingle));

/* 6. fish：buildPreys 读 preyCount，但鱼群 stageTargetCount 会进一步覆盖为更大规模。 */
resetScene(); resetSession(1);
setConfig({ targetType: "fish", preyCount: 1 });
ok(build("fish") === 1, "捕鱼：preyCount=1 → buildPreys 生成 1 条", String(G.preys.length));
setConfig({ targetType: "fish", preyCount: 3 });
ok(build("fish") === 3, "捕鱼：preyCount=3 → buildPreys 生成 3 条", String(G.preys.length));
resetScene(); resetSession(1);
setConfig({ targetType: "fish", bg_fish: "school", preyCount: 1 });
G.session.sea = G.SEA_THEMES.find(t => t.key === "school");
ok(G.stageTargetCount() === 3, "鱼群巡游 stage1：preyCount=1 → stageTargetCount 按鱼群档为 3 条", String(G.stageTargetCount()));
resetScene(); resetSession(2);
setConfig({ targetType: "fish", bg_fish: "school", preyCount: 1 });
G.session.sea = G.SEA_THEMES.find(t => t.key === "school");
ok(G.stageTargetCount() === 4, "鱼群巡游 stage2：preyCount=1 → stageTargetCount 按鱼群档为 4 条", String(G.stageTargetCount()));
resetScene(); resetSession(3);
setConfig({ targetType: "fish", bg_fish: "school", preyCount: 3 });
G.session.sea = G.SEA_THEMES.find(t => t.key === "school");
ok(G.stageTargetCount() === 12, "鱼群巡游 stage3：preyCount=3 → stageTargetCount 按鱼群档为 12 条", String(G.stageTargetCount()));

/* 7. mouse：群鼠完全由硬编码档位覆盖 preyCount。 */
resetScene({ mouseBg: "swarm" }); resetSession(1);
setConfig({ targetType: "mouse", preyCount: 1 });
ok(G.stageTargetCount() === 4, "群鼠乱窜 stage1：preyCount=1 → stageTargetCount 固定 4 只", String(G.stageTargetCount()));
resetSession(2);
setConfig({ targetType: "mouse", preyCount: 3 });
ok(G.stageTargetCount() === 5, "群鼠乱窜 stage2：preyCount=3 → stageTargetCount 固定 5 只", String(G.stageTargetCount()));
resetSession(3);
setConfig({ targetType: "mouse", preyCount: 3 });
ok(G.stageTargetCount() === 6, "群鼠乱窜 stage3：preyCount=3 → stageTargetCount 固定 6 只", String(G.stageTargetCount()));

/* 8. mouse room：preyCount 只是两档开关，topUp 后由阶段基线与洞口数限制。 */
resetScene({ mouseBg: "room", holes: [0, 1, 2, 3, 4] }); resetSession(1);
setConfig({ targetType: "mouse", preyCount: 1 });
const mouseRoomSingle = countAfterTopUp("mouse");
ok(mouseRoomSingle === 1, "室内房间 stage1：preyCount=1 → topUp 后 1 只", String(mouseRoomSingle));
resetSession(2);
setConfig({ targetType: "mouse", preyCount: 3 });
const mouseRoomMulti = countAfterTopUp("mouse");
ok(mouseRoomMulti === 4, "室内房间 stage2：preyCount=3 → topUp 后被阶段/洞口数限制为 4 只", String(mouseRoomMulti));

/* 9. frog：数量跟「猎物数量」设置走（单只 1 / 多只 3），不再随阶段递增；仍受荷叶数封顶。 */
setFrogScene(1);
setConfig({ targetType: "frog", preyCount: 1 });
ok(G.stageTargetCount() === 1, "青蛙 stage1：preyCount=1 → 同屏 1 只", String(G.stageTargetCount()));
setFrogScene(2);
setConfig({ targetType: "frog", preyCount: 3 });
ok(G.stageTargetCount() === 3, "青蛙 stage2：preyCount=3 → 仍是 3 只（不随阶段加量）", String(G.stageTargetCount()));
setFrogScene(3);
setConfig({ targetType: "frog", preyCount: 3 });
ok(G.stageTargetCount() === 3, "青蛙 stage3：preyCount=3 → 仍是 3 只", String(G.stageTargetCount()));
/* 该桩只有 5 片浮叶 → 封顶 4；preyCount=5 在这里应被荷叶数压到 4（真实场景 6 片浮叶时是 5） */
const frogFloatN = G.scene.pads.filter(p => (p.sinkState || "float") === "float").length;
setConfig({ targetType: "frog", preyCount: 5 });
ok(G.stageTargetCount() === Math.min(5, Math.max(1, frogFloatN - 1)),
  "青蛙：preyCount=5 → 受荷叶数封顶（浮叶 " + frogFloatN + " 片）", String(G.stageTargetCount()));
setConfig({ targetType: "frog", preyCount: 7 });
ok(G.stageTargetCount() === Math.min(7, Math.max(1, G.scene.pads.filter(p => (p.sinkState || "float") === "float").length - 1)),
  "青蛙：preyCount=7 → 被荷叶数封顶（不超 pads-1）", String(G.stageTargetCount()));

/* 10. tadpole：buildPreys 当前按 preyCount 生成；topUp 后被 session.tadCount/stage 覆盖。 */
resetScene(); resetSession(1, { tadCount: 1 });
setConfig({ targetType: "tadpole", preyCount: 1 });
ok(build("tadpole") === 1, "蝌蚪：preyCount=1 → buildPreys 生成 1 只", String(G.preys.length));
setConfig({ targetType: "tadpole", preyCount: 3 });
ok(build("tadpole") === 3, "蝌蚪：preyCount=3 → buildPreys 生成 3 只（潜在问题：开局即多只）", String(G.preys.length));
resetScene(); resetSession(1, { tadCount: 1 });
setConfig({ targetType: "tadpole", preyCount: 3 });
const tadTop1 = countAfterTopUp("tadpole");
ok(tadTop1 === 3, "蝌蚪 stage1/tadCount=1：preyCount=3 → buildPreys 已生成 3 只，topUp 不会减少（潜在问题）", String(tadTop1));
resetScene(); resetSession(3, { tadCount: 3 });
setConfig({ targetType: "tadpole", preyCount: 1 });
const tadTop3 = countAfterTopUp("tadpole");
ok(tadTop3 === 3, "蝌蚪 stage3/tadCount=3：preyCount=1 → topUp 后被动态 tadCount 覆盖为 3 只", String(tadTop3));

/* 11. pool 的 topUp 保持 ffCount，不被阶段覆盖。 */
resetScene(); resetSession(2);
setConfig({ targetType: "pool", ffCount: 6, preyCount: 1 });
const poolTop = countAfterTopUp("pool");
ok(poolTop === 6, "暗夜荧光 stage2：ffCount=6 → topUp 后保持 6 只", String(poolTop));

console.log(A.join("\n"));
console.log(fail === 0 ? `\nALL PASS (${pass}/${pass + fail})` : `\nFAILED (${fail} 项)`);
process.exit(fail === 0 ? 0 : 1);
