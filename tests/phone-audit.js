// 폰 점검: 작은 터치 영역, 가로 넘침, 겹침, 고정 영역 높이
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for(const [w,h] of [[360,740],[390,844]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+process.cwd()+'/app/www/index.html');await p.waitForTimeout(400);
  await p.screenshot({path:`shots/m${w}-landing.png`});
  const go=await p.evaluate(()=>Math.round(document.getElementById('goBtn').getBoundingClientRect().bottom));
  await p.tap('#goBtn');await p.waitForTimeout(400);await p.tap('#spd button[data-s="4"]');
  for(let i=0;i<60;i++){const o=await p.$('.opt:not([disabled])');if(o){await p.waitForTimeout(150);await p.screenshot({path:`shots/m${w}-play.png`});break;}await p.waitForTimeout(150);}
  const small=await p.evaluate(()=>[...document.querySelectorAll('button,label,input,summary,[tabindex="0"]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<32||r.width<32)&&getComputedStyle(e).visibility!=='hidden';}).map(e=>(e.id||e.className||e.tagName)+':'+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height)).slice(0,25));
  const hud=await p.evaluate(()=>Math.round(document.querySelector('.hud').getBoundingClientRect().height));
  const ov=await p.evaluate(()=>{const W=document.documentElement.clientWidth;return [...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>W+1&&r.width>0;}).map(e=>e.className||e.tagName).slice(0,8);});
  const hudText=await p.evaluate(()=>{const a=document.getElementById('sceneDate').getBoundingClientRect(),b=document.getElementById('sceneLoc').getBoundingClientRect();return {overlap:a.right>b.left,aR:Math.round(a.right),bL:Math.round(b.left)};});
  console.log(`== ${w}x${h} go-button bottom ${go} (fold ${h}) | hud ${hud} (${Math.round(hud/h*100)}%)`);
  console.log('small targets',JSON.stringify(small));console.log('overflow',JSON.stringify(ov),'| scene hud overlap',JSON.stringify(hudText),'| errors',errs.length);
  await p.click('#pauseBtn');for(let k=0;k<3;k++){}
  await p.evaluate(()=>FX._scene({st:{prop:'chef',spouse:1,weekend:1,kids:2,cat:1,car:1,rank:'상사',fit:50,iq:50,mind:20}}));
  await ctx.close();}
await b.close();})();
