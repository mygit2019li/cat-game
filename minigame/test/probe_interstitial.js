/* 插屏广告探针：验证提前创建、只在本周记录弹窗 show、其他入口不触发、无 API 静默跳过 */
const fs=require("fs"),path=require("path");
const {chromium}=require("playwright-core");
const ROOT="/Users/lipeng/www/myproject/cat-game/minigame";
const MODS=["./js/platform.js","./js/config.js","./js/rank.js","./js/audio.js","./js/draw.js","./js/scenery.js","./js/prey.js","./js/ui.js","./js/sharecard.js","./js/ad.js","./js/feeder.js","./game.js"];
const modules={}; for(const n of MODS) modules[n]=fs.readFileSync(path.join(ROOT,n),"utf8");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const A=[];
const ok=(c,m,e)=>{A.push((c?"✅ ":"❌ ")+m+(e!=null?"  → "+e:""));return c;};

// 注入 wx.createInterstitialAd 垫片（记录调用），在 require 之前
const STUB=`
(function(){
  window.__interLog=[];
  window.wx.createInterstitialAd=(opt)=>{
    window.__interLog.push({evt:'create',adUnitId:opt&&opt.adUnitId});
    return {
      show:()=>{window.__interLog.push({evt:'show'});return Promise.resolve();}
    };
  };
})();`;

async function boot(page, withApi){
  await page.goto("file://"+path.join(ROOT,"test/harness.html"));
  await page.evaluate(m=>Object.assign(window.__MODULES__,m),modules);
  if(withApi) await page.evaluate(STUB);
  await page.evaluate(()=>window.require("./game.js"));
  await sleep(200);
}

(async()=>{
  const b=await chromium.launch({executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",headless:true});
  const errs=[];

  // ---- 场景1：有 createInterstitialAd ----
  const p=await b.newPage({viewport:{width:844,height:390}});
  p.on("pageerror",e=>errs.push("pageerror: "+e.message));
  await boot(p,true);
  let s=await p.evaluate(()=>({log:window.__interLog.slice(),state:G.ad.interstitialState()}));
  ok(s.log.length===1 && s.log[0].evt==="create", "提前创建：模块装配时调一次 createInterstitialAd", JSON.stringify(s.log));
  ok(s.log[0].adUnitId==="adunit-347047dcdea0cdfa", "广告位 ID 正确", s.log[0].adUnitId);
  ok(s.state.ready===true && s.state.shown===0, "实例就绪、尚未 show", JSON.stringify(s.state));

  // 打开普通弹窗：好友排行 lb —— 不应触发插屏
  await p.evaluate(()=>G.openModal("lb"));
  await sleep(100);
  s=await p.evaluate(()=>({log:window.__interLog.slice(),state:G.ad.interstitialState()}));
  ok(s.state.shown===0, "打开好友排行(lb)不触发插屏", JSON.stringify(s.state));

  // 打开电子猫粮 / 召唤 / 设置等 —— 不应触发
  await p.evaluate(()=>{G.closeModal();G.openSettings();});
  await sleep(100);
  await p.evaluate(()=>{G.closeSettings();G.feederEnter();});
  await sleep(100);
  s=await p.evaluate(()=>({state:G.ad.interstitialState()}));
  ok(s.state.shown===0, "设置抽屉/电子猫粮不触发插屏", JSON.stringify(s.state));

  // 打开本周记录 —— 触发一次
  await p.evaluate(()=>{G.switchScreen("home");G.openModal("records");});
  await sleep(100);
  s=await p.evaluate(()=>({log:window.__interLog.slice(),state:G.ad.interstitialState()}));
  const shows=s.log.filter(x=>x.evt==='show').length;
  ok(shows===1, "打开本周记录(records)：show 恰好 1 次", "show="+shows);
  ok(s.state.shown===1, "interstitialState.shown=1", JSON.stringify(s.state));
  ok(s.log.filter(x=>x.evt==='create').length===1, "实例只创建 1 次（不在每次 show 时重建）", JSON.stringify(s.log.filter(x=>x.evt==='create')));

  // 再开一次记录 —— 再 show 一次（每次打开弹窗都触发）
  await p.evaluate(()=>{G.closeModal();G.openModal("records");});
  await sleep(100);
  s=await p.evaluate(()=>({log:window.__interLog.slice(),state:G.ad.interstitialState()}));
  ok(s.state.shown===2, "再次打开本周记录：再 show 一次（累计 2）", JSON.stringify(s.state));
  await p.close();

  // ---- 场景2：无 createInterstitialAd（浏览器/低版本）静默跳过 ----
  const p2=await b.newPage({viewport:{width:844,height:390}});
  p2.on("pageerror",e=>errs.push("pageerror(noApi): "+e.message));
  await boot(p2,false);
  await p2.evaluate(()=>G.openModal("records"));
  await sleep(100);
  s=await p2.evaluate(()=>({state:G.ad.interstitialState(),screen:G.screen,modal:!!G.modal}));
  ok(s.state.ready===false && s.state.shown===0, "无 wx.createInterstitialAd：静默跳过、不报错", JSON.stringify(s.state));
  ok(s.screen==="records" && s.modal===true, "无 API 时本周记录弹窗仍正常打开", JSON.stringify({screen:s.screen,modal:s.modal}));
  await p2.close();

  await b.close();
  console.log("\n===== 插屏广告 体检 =====");
  A.forEach(x=>console.log(x));
  if(errs.length){console.log("\n运行时错误：");errs.forEach(e=>console.log("  ❌ "+e));}
  else console.log("✅ 无运行时错误");
  const bad=A.filter(x=>x.startsWith("❌")).length;
  console.log(bad?"\n❌ 失败 "+bad+" 项":"\n✅ 全部通过");
  if(bad||errs.length)process.exit(1);
})();
