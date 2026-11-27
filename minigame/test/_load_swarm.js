(async () => {
  const mods = ["./js/platform.js","./js/config.js","./js/rank.js","./js/audio.js","./js/draw.js",
    "./js/scenery.js","./js/prey.js","./js/ui.js","./js/sharecard.js",
    "./js/ad.js","./js/feeder.js","./game.js"];
  const G = {};
  // 把各模块源码拉进垫片
  for (const n of mods) {
    const url = "file://" + location.origin.replace(/^file:\/\//,"").replace(/\/test\/harness\.html$/,"") + n;
    const r = await fetch(url);
    if (!r.ok) throw new Error("fetch fail " + n + " " + r.status);
    window.__MODULES__[n] = await r.text();
  }
  window.require("./game.js");
  return "loaded";
})()
