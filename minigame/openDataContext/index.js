/* 开放数据域 game.js —— 好友关系链排行榜渲染（猎手分）

   主域通过 postMessage 控制：
     { type:"show", x, y, w, h }   在主屏 (x,y,w,h) 区域画排行榜卡片
     { type:"hide" }               清空画布
     { type:"refresh" }            清缓存重新拉取

   数据说明：只读「同玩本游戏的微信好友」的近 30 天最高猎手分，
   无通讯录权限、无陌生人数据、无聊天能力，数据只在本域内展示。

   计分口径（与 js/rank.js 一致）：
     猎手分 = round( min(HPM,60) × 玩法系数 × 难度系数 × 完赛系数 )
     榜单取近 30 天最高单局分。旧的 bestHits 是裸捕获数、量纲不同，
     本域不再显示它——历史数据混进来会让榜单失真。

   三种状态（主域只能看到"授权结果"，榜单有没有人得由本域判断）：
     loading  拉取中
     denied   getFriendCloudStorage 失败（授权没给 / 基础库不支持）→ 提示回主域重新授权
     empty    拉到了但好友都没成绩 → 至少显示「我的最好成绩」，否则用户无从判断是不是坏了 */
const canvas = wx.getSharedCanvas();
const ctx = canvas.getContext("2d");

const WINDOW_MS = 30 * 24 * 3600 * 1000;
/* rankName/rankAvatar 是玩家授权 userInfo 后自己写进关系链 KV 的微信昵称和头像。
   微信关系链字段 nickName 一律匿名化成"微信用户"，所以必须优先读 KV。 */
const KEYS = ["rankScore", "rankTs", "rankMode", "rankDiff", "rankName", "rankAvatar"];
const MODE_NAME = {
  fish: "小河戏鱼", butterfly: "蝴蝶花园", mouse: "捕鼠", laser: "激光",
  pool: "彩星", frog: "青蛙跳", tadpole: "蝌蚪快跑"
};

let rect = null;            // 当前卡片区域（逻辑像素）
let cache = null;           // 好友数据缓存
let state = "idle";         // idle | loading | ok | empty | denied
let selfOpenid = null;
let selfBest = 0;           // 我的最好猎手分（空榜时兜底显示）
let selfMode = "";
let selfName = "";          // 我的昵称（优先主域授权后带来的真资料）
let selfAvatar = "";        // 我的头像 URL
/* 主域带来的微信昵称/头像优先：关系链和 ODC getUserInfo 在真机都可能匿名化。
   打上标记后异步回来的是"微信用户"也不能覆盖真资料。 */
let selfNamePinned = false, selfAvatarPinned = false;
const avatarImgs = {};      // avatarUrl -> Image（异步加载后重绘）
/* wx.createImage() 返回的是微信 Image 对象，没有 DOM 的 complete / naturalWidth，
   靠它判断会永远 false → 头像永远走占位分支。用 onload/onerror 显式记账。 */
const avatarLoaded = {};    // avatarUrl -> true/false

/* ---------- 画布尺寸 ----------
   官方硬规则：sharedCanvas 的宽高只能在【主域】设置，开放数据域设置无效且会清空画布。
   主域 platform.applySize() 设好宽高并发 {type:"resize"}，这里只重算变换并重绘。 */
let logicalW = 0, logicalH = 0, odcDpr = 2;
function sizeCanvas() {
  try {
    const info = wx.getSystemInfoSync();
    logicalW = info.windowWidth || 0; logicalH = info.windowHeight || 0;
    odcDpr = Math.min(info.pixelRatio || 2, 2);
  } catch (e) {}
  // 主域已按 W*dpr 设好画布；用实际宽高反推 dpr，兼容主域封顶到 2 的情况
  if (logicalW > 0 && canvas.width > 0) {
    const real = canvas.width / logicalW;
    if (real > 0.5 && real <= 4) odcDpr = real;
  }
  ctx.setTransform(odcDpr, 0, 0, odcDpr, 0, 0);
  return { W: logicalW, H: logicalH };
}

/* ---------- 关系链数据 ---------- */
function kvOf(list, key) {
  let v = null;
  (list || []).forEach(kv => { if (kv && kv.key === key) v = kv.value; });
  return v;
}

/* 成绩有效性：rankScore + 30 天内的 rankTs 才算数。
   没有时间戳（旧版裸 bestHits）一律不计入——量纲不同，混排只会让榜单失真。 */
function scoreOf(list) {
  const score = Math.floor(Number(kvOf(list, "rankScore")) || 0);
  const ts = Number(kvOf(list, "rankTs")) || 0;
  if (!score || !ts || Date.now() - ts >= WINDOW_MS || ts > Date.now() + 60000) return 0;
  return score;
}

function modeOf(list) {
  return String(kvOf(list, "rankMode") || "");
}
/* 微信昵称优先取自己授权后写进 KV 的 rankName；没授权过的玩家只能拿到匿名昵称"微信用户"。
   注意：微信开发者工具里 kvOf 可能返回空串，要过滤掉不能当名字用的值。 */
function nameOf(list, fallback) {
  const n = String(kvOf(list, "rankName") || "").trim();
  return n && n !== "微信用户" ? n : (fallback || "");
}
function avatarOf(list, fallback) {
  return String(kvOf(list, "rankAvatar") || "").trim() || (fallback || "");
}

function loadFriends() {
  state = "loading";
  render();
  try {
    wx.getFriendCloudStorage({
      keyList: KEYS,
      success: res => {
        const list = (res && res.data || []).map(u => ({
          openid: u.openid,
          nickName: nameOf(u.KVDataList, u.nickName),
          avatarUrl: avatarOf(u.KVDataList, u.avatarUrl),
          best: scoreOf(u.KVDataList), mode: modeOf(u.KVDataList)
        })).filter(u => u.best > 0);
        cache = list;
        state = list.length ? "ok" : "empty";
        render();
      },
      // 失败最常见的原因就是没给 scope.WxFriendInteraction：这里不能装作"没人玩"
      fail: () => { cache = []; state = "denied"; render(); }
    });
  } catch (e) { cache = []; state = "denied"; render(); }

  // 自己的成绩 + openid（用于标"我"、以及在空榜时兜底展示）
  try {
    wx.getUserCloudStorage({
      keyList: KEYS,
      success: r => {
        const d = r && r.data && r.data[0];
        if (d) {
          selfOpenid = d.openid || selfOpenid;
          // 自己的微信昵称优先读 KV 里的 rankName/rankAvatar（授权后写入）；
          // 主域已带来真资料时不被关系链里的旧值/匿名值覆盖
          if (!selfNamePinned) selfName = nameOf(d.KVDataList, d.nickName) || selfName;
          if (!selfAvatarPinned) selfAvatar = avatarOf(d.KVDataList, d.avatarUrl) || selfAvatar;
          // 取较大值合并：关系链是主来源，但主域带进来的本地分可能更新（真机关系链有延迟）
          const chainScore = scoreOf(d.KVDataList);
          if (chainScore > selfBest) { selfBest = chainScore; selfMode = modeOf(d.KVDataList) || selfMode; }
          render();
        }
      },
      fail: () => {}
    });
  } catch (e) {}

  loadSelfProfile();
}

/* 主域把自己的本地存档随 show 消息带进来（score/ts/mode/diff）。
   关系链 getUserCloudStorage 在真机/开发者工具常返回空，这是"我"这一行的可靠兜底。
   取较大值合并：关系链是真来源，但当它读不到/过期时，至少本地分能让"我"稳定出榜。 */
function applySelfFromMain(s) {
  if (!s) return;
  /* 昵称头像与分数分开处理：即使主域没带分数（还没打过局），
     真资料也要落地，后续拿到分数时自己那行直接是微信昵称头像。 */
  const name = String(s.name || s.nick || "").trim();
  const avatar = String(s.avatar || s.avatarUrl || "").trim();
  if (name && name !== "微信用户") { selfName = name; selfNamePinned = true; }
  if (avatar) { selfAvatar = avatar; selfAvatarPinned = true; }
  const score = Math.floor(Number(s.score) || 0);
  const ts = Number(s.ts) || 0;
  if (!score || !ts || Date.now() - ts >= WINDOW_MS || ts > Date.now() + 60000) { render(); return; }
  if (score > selfBest) { selfBest = score; selfMode = String(s.mode || selfMode); }
  render();
}

/* 开放数据域专用 wx.getUserInfo：仅用于展示，无需用户授权即可拿到自己的昵称头像。
   好友的 nickName/avatarUrl 走关系链；关系链被匿名化时，至少保证"我"这一行是真昵称真头像。
   基础库不支持时静默跳过，不算失败。 */
function loadSelfProfile() {
  if (typeof wx.getUserInfo !== "function") return;
  try {
    wx.getUserInfo({
      success: res => {
        const u = res && res.userInfo;
        if (!u) return;
        // 匿名"微信用户"不能覆盖主域授权拿到的真昵称
        if (!selfNamePinned && u.nickName && u.nickName !== "微信用户") selfName = u.nickName;
        if (!selfAvatarPinned && u.avatarUrl) selfAvatar = u.avatarUrl;
        render();
      },
      fail: () => {}
    });
  } catch (e) {}
}

/* 展示列表：排序 + 保证「我」一定在（好友榜里没有自己时补一行） */
function displayList() {
  const list = (cache || []).slice();
  if (selfBest > 0 && !(selfOpenid && list.some(u => u.openid === selfOpenid))) {
    list.push({ openid: selfOpenid, nickName: selfName, avatarUrl: selfAvatar,
                best: selfBest, mode: selfMode, selfOnly: true });
  }
  return list.sort((a, b) => b.best - a.best).slice(0, 20);
}

function avatar(url, x, y, r, name) {
  const d = r * 2;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  const img = url ? avatarImgs[url] : null;
  if (img && avatarLoaded[url] === true) {
    ctx.drawImage(img, x - r, y - r, d, d);
  } else {
    ctx.fillStyle = "#8ed2c6";
    ctx.fillRect(x - r, y - r, d, d);
    if (url && !img && avatarLoaded[url] !== false) {
      try {
        const im = wx.createImage ? wx.createImage() : new Image();
        avatarImgs[url] = im;
        im.onload = () => { avatarLoaded[url] = true; render(); };
        im.onerror = () => { avatarLoaded[url] = false; };  // 失败不再反复重试
        im.src = url;
      } catch (e) { avatarLoaded[url] = false; }
    }
    if (name) {
      ctx.fillStyle = "#fff";
      ctx.font = Math.round(r) + "px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(name.slice(0, 1), x, y + 1);
    }
  }
  ctx.restore();
}

/* ---------- 渲染 ---------- */
function render() {
  /* clearRect 走的是 setTransform 后的逻辑坐标，必须除 dpr，
     否则清屏范围比画布大 dpr 倍（浏览器无害，真机部分机型会裁剪异常）。 */
  ctx.clearRect(0, 0, canvas.width / odcDpr, canvas.height / odcDpr);
  if (!rect) return;
  const { x, y, w, h } = rect;
  const rowH = Math.min(52, Math.max(40, Math.floor((h - 56) / 8)));

  // 卡片底
  ctx.fillStyle = "rgba(255,255,255,.94)";
  ctx.strokeStyle = "rgba(31,64,58,.10)";
  ctx.lineWidth = 1.2;
  rr(x, y, w, h, 18); ctx.fill(); ctx.stroke();

  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const cx = x + w / 2, cy = y + h / 2;

  if (state === "loading" || state === "idle") {
    ctx.fillStyle = "#7a918b";
    ctx.font = "15px sans-serif";
    ctx.fillText("正在加载好友成绩…", cx, cy);
    return;
  }
  if (state === "denied") {
    ctx.fillStyle = "#31443f";
    ctx.font = "16px sans-serif";
    ctx.fillText("没能读取好友成绩", cx, cy - 20);
    ctx.fillStyle = "#7a918b";
    ctx.font = "13px sans-serif";
    ctx.fillText("请回到游戏里重新打开「好友排行」", cx, cy + 6);
    ctx.fillText("并在微信弹窗中选择允许", cx, cy + 26);
    return;
  }

  const list = displayList();
  if (!list.length) {
    // 没有权限问题、也真的没有任何成绩（含自己）
    ctx.fillStyle = "#31443f";
    ctx.font = "16px sans-serif";
    ctx.fillText("好友里还没有猎手分", cx, cy - 22);
    ctx.fillStyle = "#7a918b";
    ctx.font = "13px sans-serif";
    ctx.fillText("点下方「邀猫友比一比」，", cx, cy + 6);
    ctx.fillText("把测评图发到猫友群，看谁家猫更凶", cx, cy + 26);
    return;
  }

  const top = y + 16;
  const maxRows = Math.max(1, Math.floor((h - 32) / rowH));
  list.slice(0, maxRows).forEach((u, i) => {
    const ry = top + i * rowH;
    const me = (selfOpenid && u.openid === selfOpenid) || u.selfOnly;
    if (me) { ctx.fillStyle = "rgba(20,160,147,.10)"; rr(x + 8, ry + 2, w - 16, rowH - 6, 12); ctx.fill(); }
    const cy2 = ry + rowH / 2 + 1;
    // 名次徽标
    const medal = ["#ffb02e", "#9fb3bd", "#d9925a"][i];
    const nxc = x + 20 + 15;
    ctx.beginPath(); ctx.arc(nxc, cy2, 13, 0, Math.PI * 2);
    ctx.fillStyle = medal || "#e8eef0"; ctx.fill();
    ctx.fillStyle = medal ? "#fff" : "#5c7a73";
    ctx.font = "13px sans-serif";
    ctx.fillText(String(i + 1), nxc, cy2 + 1);
    // 头像 + 昵称：自己那行一律用主域授权拿到的真昵称/头像（关系链匿名也不退化成"我"）
    const avX = nxc + 15 + 14;
    const rowName = me && selfName ? selfName : u.nickName;
    const rowAvatar = me && selfAvatar ? selfAvatar : u.avatarUrl;
    avatar(rowAvatar, avX, cy2, 13, rowName || "?");
    ctx.fillStyle = "#31443f";
    ctx.textAlign = "left";
    let nm = rowName || "微信用户";
    ctx.font = "13px sans-serif";
    const maxNm = w * 0.40;
    while (nm.length > 1 && ctx.measureText(nm).width > maxNm) nm = nm.slice(0, -1);
    ctx.fillText(nm + (me ? "（我）" : ""), avX + 20, cy2 + 1);
    // 玩法小字：rowH 够高才画，短卡片不挤
    if (u.mode && rowH >= 46) {
      ctx.fillStyle = "#9aaca6";
      ctx.font = "10px sans-serif";
      ctx.fillText(MODE_NAME[u.mode] || u.mode, avX + 20, cy2 + 13);
    }
    // 分数
    ctx.textAlign = "right";
    ctx.fillStyle = me ? "#0c7d72" : "#e8890c";
    ctx.font = "14px sans-serif";
    ctx.fillText(u.best + " 分", x + w - 18, cy2 + 1);
    ctx.textAlign = "center";
  });

  // 榜上只有自己：说明"好友还没成绩"，别让用户以为自己看漏了
  if (list.length === 1 && list[0].selfOnly) {
    ctx.fillStyle = "#8ba39c";
    ctx.font = "12px sans-serif";
    ctx.fillText("好友还没有成绩，点下方按钮邀他们来比", cx, top + rowH + 18);
  }
}

function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- 主域消息 ---------- */
wx.onMessage(msg => {
  if (!msg) return;
  if (msg.type === "show") {
    rect = { x: msg.x, y: msg.y, w: msg.w, h: msg.h };
    sizeCanvas();
    // refresh 先把 selfBest 清零了，这里用主域本地存档把"我"补回来（关系链异步回来再取大合并）
    applySelfFromMain(msg.self);
    if (state === "idle" || state === "denied") loadFriends();
    else render();
  } else if (msg.type === "hide") {
    rect = null;
    ctx.clearRect(0, 0, canvas.width / odcDpr, canvas.height / odcDpr);
  } else if (msg.type === "resize") {
    sizeCanvas();   // 主域改了 sharedCanvas 宽高（内容已清空）→ 重设变换，等下次 show/refresh 重绘
  } else if (msg.type === "refresh") {
    cache = null; state = "idle";
    selfBest = 0; selfMode = "";
    loadFriends();
  }
});
