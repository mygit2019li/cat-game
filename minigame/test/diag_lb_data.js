/* diag_lb_data.js —— 诊断好友榜"没数据"：直接在 Node 里加载开放数据域，
   注入可控的 wx API 假数据，看渲染出的文本到底是什么。
   用法：node test/diag_lb_data.js */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "openDataContext/index.js"), "utf8");

const NOW = Date.now();
function makeWx(opt) {
  const texts = [];
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k === "fillText" || k === "strokeText") return (s) => texts.push(String(s));
      if (k === "measureText") return (s) => ({ width: String(s || "").length * 7 });
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  let msgCb = null;
  const imgLoads = [];
  const kvs = (o) => Object.keys(o || {}).map(k => ({ key: k, value: String(o[k]) }));
  const wx = {
    getSharedCanvas: () => canvas,
    getSystemInfoSync: () => ({ windowWidth: 844, windowHeight: 390, pixelRatio: 2 }),
    // 模拟微信 Image：没有 DOM 的 complete / naturalWidth，只有 onload/onerror
    createImage: () => {
      const im = { _src: "", onload: null, onerror: null,
        set src(v) { this._src = v; imgLoads.push(v); }, get src() { return this._src; } };
      if (opt.imgFail) { /* 不触发 onload，模拟头像下载失败 */ }
      else setTimeout(() => im.onload && im.onload(), 0);
      return im;
    },
    getUserInfo: (o) => {
      if (opt.noGetUserInfo) return o.fail && o.fail({ errMsg: "getUserInfo:fail" });
      o.success && o.success({ userInfo: { nickName: opt.myNick || "真名猫主", avatarUrl: opt.myAvatar || "http://thirdwx.qlogo.cn/me" } });
    },
    onMessage: cb => { msgCb = cb; },
    getFriendCloudStorage: (o) => {
      if (opt.friendFail) return o.fail && o.fail({ errMsg: "denied" });
      o.success && o.success({ data: (opt.friends || []).map(f => ({
        openid: f.openid, nickName: f.nick, avatarUrl: f.avatar || "",
        KVDataList: kvs(f.kv)
      })) });
    },
    getUserCloudStorage: (o) => {
      if (opt.selfFail) return o.fail && o.fail({ errMsg: "denied" });
      o.success && o.success({ data: (opt.self ? [{
        openid: opt.self.openid, nickName: opt.self.nick || "真名猫主",
        avatarUrl: opt.self.avatar || "http://thirdwx.qlogo.cn/me",
        KVDataList: kvs(opt.self.kv)
      }] : []) });
    }
  };
  return { wx, texts, imgLoads, send: m => msgCb && msgCb(m), canvas };
}

function run(name, opt) {
  const env = makeWx(opt);
  const sandbox = { wx: env.wx, Date, Math, Number, String, Array, Object, JSON, Image: function () {}, console, setTimeout };
  require("vm").runInNewContext(SRC, sandbox, { filename: "openDataContext/index.js" });
  env.send({ type: "show", x: 0, y: 0, w: 552, h: 156 });
  // getUserInfo / Image.onload 是异步的，刷一轮宏任务让回调落地再重绘
  require("vm").runInNewContext("setTimeout(()=>{},0)", sandbox);
  const lines = env.texts.slice(-14);
  console.log("\n=== " + name + " ===");
  console.log(lines.join(" | ") || "(无任何文本绘制)");
  console.log("头像请求:", env.imgLoads.join(", ") || "(无)");
  return { texts: lines, imgs: env.imgLoads };
}
function tick() { return new Promise(r => setTimeout(r, 5)); }
function asyncRun(name, opt) {
  const env = makeWx(opt);
  const sandbox = { wx: env.wx, Date, Math, Number, String, Array, Object, JSON, Image: function () {}, console, setTimeout };
  require("vm").runInNewContext(SRC, sandbox, { filename: "openDataContext/index.js" });
  env.send({ type: "show", x: 0, y: 0, w: 552, h: 156, self: opt.mainSelf || null });
  return tick().then(() => {
    const lines = env.texts.slice(-20);
    console.log("\n=== " + name + " ===");
    console.log(lines.join(" | ") || "(无任何文本绘制)");
    console.log("头像请求:", env.imgLoads.join(", ") || "(无)");
    return { texts: lines, imgs: env.imgLoads };
  });
}

const fresh = { rankScore: 42, rankTs: NOW, rankMode: "laser", rankDiff: "hard" };
let failures = 0;
function expect(cond, msg) {
  console.log((cond ? "  ✓ " : "  ✗ ") + msg);
  if (!cond) failures++;
}

(async () => {
  // 场景 1：好友有分+昵称头像、我也有分 → 两行都要有昵称，且都发起头像加载
  let r = await asyncRun("① 好友昵称头像 + 我有分", {
    friends: [{ openid: "f1", nick: "猫友甲", avatar: "http://thirdwx.qlogo.cn/f1", kv: fresh }],
    self: { openid: "me", nick: "真名猫主", avatar: "http://thirdwx.qlogo.cn/me",
            kv: { rankScore: 30, rankTs: NOW, rankMode: "fish", rankDiff: "easy" } }
  });
  expect(r.texts.some(t => /猫友甲/.test(String(t))), "好友昵称已绘制");
  expect(r.texts.some(t => /真名猫主/.test(String(t))), "我的微信昵称已绘制");
  expect(r.imgs.some(u => /f1/.test(u)) && r.imgs.some(u => /me/.test(u)), "两个头像 URL 都发起加载");

  // 场景 2：只有我有分 → 兜底行用微信昵称和头像，不再是硬编码"我"+空头像
  r = await asyncRun("② 好友空 + 我有分", {
    friends: [], self: { openid: "me", kv: fresh }
  });
  expect(r.texts.some(t => /真名猫主/.test(String(t))), "兜底行使用真实昵称（非硬编码'我'）");
  expect(r.imgs.some(u => /thirdwx\.qlogo/.test(u)), "兜底行发起头像加载");

  // 场景 3：没打过局 → 空榜提示
  r = await asyncRun("③ 所有人都没有 rankScore", {
    friends: [{ openid: "f1", nick: "猫友甲", kv: { bestHits: 88 } }],
    self: { openid: "me", kv: { bestHits: 20 } }, noGetUserInfo: true
  });
  expect(r.texts.some(t => /还没有猎手分/.test(String(t))), "空榜提示出现");

  // 场景 4：只有旧 bestHits、无时间戳 → 不计入
  r = await asyncRun("④ 只有旧 bestHits（无 rankTs）", {
    friends: [{ openid: "f1", nick: "猫友甲", kv: { rankScore: 55 } }],
    self: null, noGetUserInfo: true
  });
  expect(r.texts.some(t => /还没有猎手分/.test(String(t))), "无时间戳旧数据不计入");

  // 场景 5：授权失败 → denied 提示
  r = await asyncRun("⑤ getFriendCloudStorage 失败", {
    friendFail: true, self: { openid: "me", kv: fresh }, noGetUserInfo: true
  });
  expect(r.texts.some(t => /没能读取好友成绩/.test(String(t))), "授权失败提示出现");

  // 场景 7：关系链 nickName 是匿名"微信用户"，但好友自己授权过 → KV rankName 是微信昵称
  r = await asyncRun("⑦ 匿名昵称 + KV 微信昵称", {
    friends: [{ openid: "f1", nick: "微信用户", avatar: "http://thirdwx.qlogo.cn/f1",
                kv: { ...fresh, rankName: "猫友真名", rankAvatar: "http://thirdwx.qlogo.cn/real" } }],
    self: null, noGetUserInfo: true
  });
  expect(r.texts.some(t => /猫友真名/.test(String(t))), "KV rankName 覆盖匿名昵称");
  expect(!r.texts.some(t => t === "微信用户"), "不再显示匿名昵称");
  expect(r.imgs.some(u => /real/.test(u)), "KV rankAvatar 覆盖关系链头像");

  // 场景 6：头像下载失败 → 只请求一次，不重复刷（onerror 记账生效）
  r = await asyncRun("⑥ 头像下载失败", {
    friends: [{ openid: "f1", nick: "猫友甲", avatar: "http://x/bad", kv: fresh }],
    self: null, noGetUserInfo: true, imgFail: true
  });
  expect(r.imgs.filter(u => /bad/.test(u)).length === 1, "失败头像只请求一次");
  expect(r.texts.some(t => /猫友甲/.test(String(t))), "头像失败时昵称仍显示");

  // 场景 8：关系链读不到自己（真机常见），但主域把本地存档随 show 带进来 → 自己仍出榜
  r = await asyncRun("⑧ 关系链读不到我 + 主域带 self", {
    friends: [{ openid: "f1", nick: "猫友甲", avatar: "http://thirdwx.qlogo.cn/f1", kv: fresh }],
    self: null,                       // getUserCloudStorage 返回空
    mainSelf: { score: 77, ts: NOW, mode: "tadpole", diff: "hard" }
  });
  expect(r.texts.some(t => /真名猫主/.test(String(t))), "主域带 self 时自己那行仍显示（微信昵称）");
  expect(r.texts.some(t => /77 分/.test(String(t))), "自己那行显示主域带来的分数 77");

  // 场景 9：主域分(90) > 关系链分(42) → 取大值，不被旧分覆盖
  r = await asyncRun("⑨ 主域分 > 关系链分 → 取大值", {
    friends: [], self: { openid: "me", kv: fresh },
    mainSelf: { score: 90, ts: NOW, mode: "laser", diff: "hard" }
  });
  expect(r.texts.some(t => /90 分/.test(String(t))), "取较大值，显示主域的 90 而非关系链的 42");
  expect(!r.texts.some(t => /42 分/.test(String(t))), "旧的关系链分未覆盖新分");

  // 场景 10：主域带的是过期分（>30 天）→ 忽略，不让它污染榜单
  r = await asyncRun("⑩ 主域带过期 self → 忽略", {
    friends: [{ openid: "f1", nick: "猫友甲", kv: fresh }], self: null,
    mainSelf: { score: 999, ts: NOW - 31 * 24 * 3600 * 1000, mode: "laser", diff: "hard" }
  });
  expect(!r.texts.some(t => /999 分/.test(String(t))), "过期 self 分被忽略");

  // 场景 11：关系链/ODC 都匿名，主域把授权拿到的真昵称头像带进来 → 自己那行不能是"我"
  r = await asyncRun("⑪ 主域带真昵称头像（ODC 匿名）", {
    friends: [], self: null, noGetUserInfo: true,
    mainSelf: { name: "主域真名", avatar: "http://thirdwx.qlogo.cn/main",
                score: 66, ts: NOW, mode: "laser", diff: "hard" }
  });
  expect(r.texts.some(t => /主域真名/.test(String(t))), "自己那行显示主域带来的真昵称");
  expect(!r.texts.some(t => /^我$/.test(String(t))), "不再用'我'代替昵称");
  expect(r.imgs.some(u => /main/.test(u)), "自己那行加载主域带来的真头像");

  // 场景 12：好友列表里已有自己（openid 命中），主域真资料覆盖关系链匿名值
  r = await asyncRun("⑫ 好友榜含自己 + 主域真资料", {
    friends: [{ openid: "me", nick: "微信用户", avatar: "http://thirdwx.qlogo.cn/chain", kv: fresh }],
    self: { openid: "me", kv: fresh }, noGetUserInfo: true,
    mainSelf: { name: "主域真名", avatar: "http://thirdwx.qlogo.cn/main" }
  });
  expect(r.texts.some(t => /主域真名/.test(String(t))), "榜内自己那行也用真昵称");
  expect(r.imgs.some(u => /main/.test(u)), "榜内自己那行也用真头像");
  expect(!r.texts.some(t => /^我$/.test(String(t))), "榜内自己那行没有硬编码'我'");

  console.log("\n" + (failures ? "FAIL " + failures : "ALL_DIAG_OK"));
  if (failures) process.exit(1);
})();
