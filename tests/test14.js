// 1배속 사건 간격 측정: 1.5초 근처여야 한다
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});
await p.goto('file://'+process.cwd()+'/app/www/index.html');await p.waitForTimeout(300);
await p.evaluate(()=>{window.__t=[];const o=addEvent;addEvent=function(e){window.__t.push(performance.now());return o.apply(this,arguments);};});
await p.click('#goBtn');await p.click('#spd button[data-s="1"]');await p.waitForTimeout(9000);
const t=await p.evaluate(()=>window.__t);const d=t.slice(1).map((x,i)=>x-t[i]).filter(x=>x<3000);
console.log('events',t.length,'gaps(ms)',d.map(Math.round).join(' '));await b.close();})();
