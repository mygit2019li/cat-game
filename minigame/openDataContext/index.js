/* 开放数据域 game.js — 好友关系链排行榜渲染
   主域通过 postMessage 控制：
     { type:"show", x, y, w, h }   在主屏 (x,y,w,h) 区域画排行榜卡片
     { type:"hide" }               清空画布
   数据说明：仅读取「同玩本游戏的微信好友」的 bestHits（单局最高捕获数），
   无通讯录权限、无陌生人数据、无聊天能力，数据只在本域内展示。 */
const canvas = wx.getSharedCanvas();
const ctx = canvas.getContext("2d");

let rect = null;            // 当前卡片区域（逻辑像素）
let cache = null;           // 好友数据缓存
let loading = false;
let selfOpenid = null;
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
function loadFriends() {
  loading = true;
  try {
    wx.getFriendCloudStorage({
      keyList: ["bestHits"],
      success: res => {
        const list = (res && res.data || []).filter(u =>
          (u.KVDataList || []).some(kv => kv.key === "bestHits" && Number(kv.value) > 0));
        cache = list;
        loading = false;
        render();
      },
      fail: () => { cache = []; loading = false; render(); }
    });
  } catch (e) { cache = []; loading = false; }
  // 自己的成绩（用于在列表中标出"我"）
  try {
    wx.getUserCloudStorage({
      keyList: ["bestHits"],
      success: r => {
        if (r && r.data && r.data[0]) { selfOpenid = r.data[0].openid; render(); }
      },
      fail: () => {}
    });
  } catch (e) {}
}

function bestOf(u) {
  let v = 0;
  (u.KVDataList || []).forEach(kv => { if (kv.key === "bestHits") v = Number(kv.value) || 0; });
  return v;
}

function avatar(url, x, y, r, name) {
  const d = r * 2;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  const img = avatarImgs[url];
  if (img && img.complete && img.naturalWidth) {
    ctx.drawImage(img, x - r, y - r, d, d);
  } else {
    ctx.fillStyle = "#8ed2c6";
    ctx.fillRect(x - r, y - r, d, d);
    if (!avatarImgs[url] && url) {
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
  const { W } = sizeInfo();
  const pad = 14;
  const rowH = Math.min(52, Math.max(40, Math.floor((h - 56) / 8)));

  // 卡片底
  ctx.fillStyle = "rgba(255,255,255,.94)";
  ctx.strokeStyle = "rgba(31,64,58,.10)";
  ctx.lineWidth = 1.2;
  rr(x, y, w, h, 18); ctx.fill(); ctx.stroke();

  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (loading) {
    ctx.fillStyle = "#7a918b";
    ctx.font = "15px sans-serif";
    ctx.fillText("正在加载好友成绩…", x + w / 2, y + h / 2);
    return;
  }
  const list = (cache || []).slice().sort((a, b) => bestOf(b) - bestOf(a)).slice(0, 20);
  if (!list.length) {
    ctx.fillStyle = "#7a918b";
    ctx.font = "15px sans-serif";
    ctx.fillText("好友里还没人玩过，来抢占第一名吧！", x + w / 2, y + h / 2);
    return;
  }
  const top = y + 16;
  const maxRows = Math.max(1, Math.floor((h - 32) / rowH));
  list.slice(0, maxRows).forEach((u, i) => {
    const ry = top + i * rowH;
    const me = selfOpenid && u.openid === selfOpenid;
    if (me) { ctx.fillStyle = "rgba(20,160,147,.10)"; rr(x + 8, ry + 2, w - 16, rowH - 6, 12); ctx.fill(); }
    const cy = ry + rowH / 2 + 1;
    // 名次徽标
    const medal = ["#ffb02e", "#9fb3bd", "#d9925a"][i];
    const nxc = x + 20 + 15;
    ctx.beginPath(); ctx.arc(nxc, cy, 13, 0, Math.PI * 2);
    ctx.fillStyle = medal || "#e8eef0"; ctx.fill();
    ctx.fillStyle = medal ? "#fff" : "#5c7a73";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(String(i + 1), nxc, cy + 1);
    // 头像 + 昵称
    const avX = nxc + 15 + 14;
    avatar(u.avatarUrl, avX, cy, 13, u.nickName || "?");
    ctx.fillStyle = "#31443f";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    let nm = u.nickName || "微信用户";
    ctx.font = "13px sans-serif";
    const maxNm = w * 0.42;
    while (nm.length > 1 && ctx.measureText(nm).width > maxNm) nm = nm.slice(0, -1);
    ctx.fillText(nm + (me ? "（我）" : ""), avX + 20, cy + 1);
    // 分数
    ctx.textAlign = "right";
    ctx.fillStyle = me ? "#0c7d72" : "#e8890c";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(bestOf(u) + " 只", x + w - 18, cy + 1);
    ctx.textAlign = "center";
  });
  void W; void pad;
}

function sizeInfo() {
  try { const info = wx.getSystemInfoSync(); return { W: info.windowWidth, H: info.windowHeight }; }
  catch (e) { return { W: 0, H: 0 }; }
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
    if (!cache && !loading) loadFriends();
    render();
  } else if (msg.type === "hide") {
    rect = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  } else if (msg.type === "refresh") {
    cache = null; loading = false;
    loadFriends();
  }
});
