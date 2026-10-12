const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app/www/index.html');await p.waitForTimeout(300);
await p.click('#goBtn');await p.click('#spd button[data-s="4"]');
// 선택지가 나올 때까지 기다림
for(let i=0;i<80;i++){if(await p.$('.opt:not([disabled])'))break;await p.waitForTimeout(150);}
const lis=await p.$$('#log li.replayable');await lis[1].click();await p.waitForTimeout(300);
const before={rp:await p.isVisible('#replayBar'),paused:await p.evaluate(()=>paused)};
const n0=await p.$$eval('#log li',e=>e.length);
await p.click('.opt:not([disabled])');await p.waitForTimeout(2500);
const n1=await p.$$eval('#log li',e=>e.length);
// 진행 속도가 두 배로 꼬이지 않았는지: 4배속 기준 1.5초 동안 늘어난 줄 수 비교
const a1=await p.$$eval('#log li',e=>e.length);await p.waitForTimeout(1500);const a2=await p.$$eval('#log li',e=>e.length);
console.log('replaying',JSON.stringify(before),'| after pick: bar',await p.isVisible('#replayBar'),'paused',await p.evaluate(()=>paused),'progressed',n1>n0,'| rows per 1.5s',a2-a1);
const box=await p.locator('#replayBar').boundingBox();console.log('bar hidden ok',box===null);
await lis[0].click();await p.waitForTimeout(200);await p.locator('.hud .scene').screenshot({path:'shots/replay-bar2.png'});
console.log('errors',errs);await b.close();})();
