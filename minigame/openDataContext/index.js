/* 开放数据域 game.js — 好友关系链排行榜渲染
   主域通过 postMessage 控制：
     { type:"show", x, y, w, h }   在主屏 (x,y,w,h) 区域画排行榜卡片
     { type:"hide" }               清空画布
     { type:"refresh" }            清缓存重新拉取

   数据说明：仅读取「同玩本游戏的微信好友」的 bestHits（单局最高捕获数），
   无通讯录权限、无陌生人数据、无聊天能力，数据只在本域内展示。

   三种状态（主域只能看到"授权结果"，榜单有没有人得由本域判断）：
     loading  拉取中
     denied   getFriendCloudStorage 失败（授权没给 / 基础库不支持）→ 提示回主域重新授权
     empty    拉到了但好友都没成绩 → 至少显示「我的最好成绩」，否则用户无从判断是不是坏了 */
const canvas = wx.getSharedCanvas();
const ctx = canvas.getContext("2d");

let rect = null;            // 当前卡片区域（逻辑像素）
let cache = null;           // 好友数据缓存
let state = "idle";         // idle | loading | ok | empty | denied
let selfOpenid = null;
let selfBest = 0;           // 我的最好成绩（空榜时兜底显示）
const avatarImgs = {};      // avatarUrl -> Image（异步加载后重绘）

/* ---------- 画布尺寸 ---------- */
function sizeCanvas() {
  let W = 0, H = 0, dpr = 2;
  try {
    const info = wx.getSystemInfoSync();
    W = info.windowWidth; H = info.windowHeight;
    dpr = Math.min(info.pixelRatio || 2, 2);
  } catch (e) {}
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { W, H };
}

/* ---------- 关系链数据 ---------- */
function kvBest(list) {
  let v = 0;
  (list || []).forEach(kv => { if (kv.key === "bestHits") v = Number(kv.value) || 0; });
  return v;
}

function loadFriends() {
  state = "loading";
  render();
  try {
    wx.getFriendCloudStorage({
      keyList: ["bestHits"],
      success: res => {
        const list = (res && res.data || []).filter(u => kvBest(u.KVDataList) > 0);
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
      keyList: ["bestHits"],
      success: r => {
        const d = r && r.data && r.data[0];
        if (d) {
          selfOpenid = d.openid || selfOpenid;
          selfBest = kvBest(d.KVDataList) || selfBest;
          render();
        }
      },
      fail: () => {}
    });
  } catch (e) {}
}

function bestOf(u) {
  return u.best != null ? u.best : kvBest(u.KVDataList);
}

/* 展示列表：排序 + 保证「我」一定在（好友榜里没有自己时补一行） */
function displayList() {
  const list = (cache || []).map(u => ({
    openid: u.openid, nickName: u.nickName, avatarUrl: u.avatarUrl, best: kvBest(u.KVDataList)
  }));
  if (selfBest > 0 && !(selfOpenid && list.some(u => u.openid === selfOpenid))) {
    list.push({ openid: selfOpenid, nickName: "我", avatarUrl: "", best: selfBest, selfOnly: true });
  }
  return list.sort((a, b) => b.best - a.best).slice(0, 20);
}

function avatar(url, x, y, r, name) {
  const d = r * 2;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  const img = url ? avatarImgs[url] : null;
  if (img && img.complete && img.naturalWidth) {
    ctx.drawImage(img, x - r, y - r, d, d);
  } else {
    ctx.fillStyle = "#8ed2c6";
    ctx.fillRect(x - r, y - r, d, d);
    if (url && !avatarImgs[url]) {
      const im = wx.createImage ? wx.createImage() : new Image();
      avatarImgs[url] = im;
      im.onload = () => render();
      im.src = url;
    }
    if (name) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold " + Math.round(r) + "px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(name.slice(0, 1), x, y + 1);
    }
  }
  ctx.restore();
}

/* ---------- 渲染 ---------- */
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    ctx.font = "bold 16px sans-serif";
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
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("好友里还没有成绩", cx, cy - 22);
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
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(String(i + 1), nxc, cy2 + 1);
    // 头像 + 昵称
    const avX = nxc + 15 + 14;
    avatar(u.avatarUrl, avX, cy2, 13, u.nickName || "?");
    ctx.fillStyle = "#31443f";
    ctx.textAlign = "left";
    let nm = u.nickName || "微信用户";
    ctx.font = "13px sans-serif";
    const maxNm = w * 0.42;
    while (nm.length > 1 && ctx.measureText(nm).width > maxNm) nm = nm.slice(0, -1);
    // selfOnly 行的名字本来就是"我"，别再拼一次"（我）"变成"我（我）"
    ctx.fillText(nm + (me && !u.selfOnly ? "（我）" : ""), avX + 20, cy2 + 1);
    // 分数
    ctx.textAlign = "right";
    ctx.fillStyle = me ? "#0c7d72" : "#e8890c";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(bestOf(u) + " 只", x + w - 18, cy2 + 1);
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
    if (state === "idle" || state === "denied") loadFriends();
    else render();
  } else if (msg.type === "hide") {
    rect = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  } else if (msg.type === "refresh") {
    cache = null; state = "idle";
    loadFriends();
  }
});
