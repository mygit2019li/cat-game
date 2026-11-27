/* probe_friend_rank.js —— 好友榜猎手分算法单测（纯 Node）
   验四件事：
     ① 时长归一化：同命中数，短局分高于长局（HPM 起作用）
     ② 玩法/难度系数：激光高于小鱼、hard 高于 easy、中途结束打折
     ③ 防刷：低于 30s 不计、HPM 封顶 60
     ④ 本地最高分只在更高时覆盖，超过 30 天窗口视作过期；reportRank 写入 4 个 KV
   用法：node test/probe_friend_rank.js */
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const G = {
  platform: {
    storage: {
      _d: {},
      get(k) { return this._d[k] == null ? null : this._d[k]; },
      set(k, v) { this._d[k] = v; }
    },
    reportRankCalls: [],
    reportRank(r) { this.reportRankCalls.push(JSON.parse(JSON.stringify(r))); }
  },
  track() {}
};
require(path.join(ROOT, "js/rank.js"))(G);

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log("✅ " + name + (extra != null ? "  → " + extra : "")); }
  else { fail++; console.log("❌ " + name + (extra != null ? "  → " + extra : "")); }
}
const score = (o) => G.computeRankScore(Object.assign({ hits: 30, playSec: 60, type: "fish", difficulty: "easy", done: true }, o));

// ① 时长归一化
const shortRun = score({ hits: 30, playSec: 60 });
const longRun = score({ hits: 30, playSec: 180 });
ok(shortRun.score > longRun.score, "同命中数：1 分钟局分数高于 3 分钟局", shortRun.score + " > " + longRun.score);
ok(shortRun.score === 27, "30 命中/60s/simple fish = 27 分", shortRun.score);

// ② 玩法 / 难度 / 完赛
const laser = score({ type: "laser" });
const butterfly = score({ type: "butterfly" });
ok(laser.score > butterfly.score, "激光分高于蝴蝶（猎物更难命中）", laser.score + " > " + butterfly.score);
const hard = score({ difficulty: "hard" });
ok(hard.score > shortRun.score, "困难难度分高于简单", hard.score + " > " + shortRun.score);
const quit = score({ done: false });
ok(quit.score < shortRun.score, "中途结束打折", quit.score + " < " + shortRun.score);

// ③ 防刷
ok(score({ playSec: 20 }).valid === false, "不足 30 秒不计入");
const capped = score({ hits: 300, playSec: 60 });
ok(capped.capped === true && capped.hpm === 60, "HPM 封顶 60", JSON.stringify(capped));

// ④ 本地最高分与云端写入
G.platform.storage._d = {};
const first = G.updateRankBest(score({ hits: 30, playSec: 60 }));
ok(first && first.score === 27, "首次写入本地最高分", JSON.stringify(first));
ok(G.platform.reportRankCalls.length === 1, "reportRank 调用 1 次");
const kv = G.platform.reportRankCalls[0];
ok(kv.score === 27 && kv.ts > 0 && kv.mode === "fish" && kv.diff === "easy", "KV 含 score/ts/mode/diff", JSON.stringify(kv));

const lower = G.updateRankBest(score({ hits: 10, playSec: 60 }));
ok(lower.score === 27 && G.platform.reportRankCalls.length === 1, "低分不覆盖、不重复上报");

// 过期：手动把 ts 改到 31 天前
const expired = JSON.parse(G.platform.storage.get("catToyRankBest"));
expired.ts = Date.now() - 31 * 24 * 3600 * 1000;
G.platform.storage.set("catToyRankBest", JSON.stringify(expired));
ok(G.readRankBest() === null, "超过 30 天视作过期");
const fresh = G.updateRankBest(score({ hits: 12, playSec: 60 }));
ok(fresh.score === 11 && G.platform.reportRankCalls.length === 2, "过期后低分也能重新上榜", JSON.stringify(fresh));

console.log("\n===== 猎手分算法体检 =====");
console.log(pass + " 通过 / " + fail + " 失败");
if (fail) process.exit(1);
