// 자동 스크롤: 맨 아래를 보고 있으면 매 사건마다 따라가고, 위로 올려 읽는 중이면 끌어내리지 않는다
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:760}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app/www/index.html');await p.waitForTimeout(300);
await p.click('#goBtn');await p.click('#spd button[data-s="1"]');await p.check('#autoTg');
const lastVisible=()=>p.evaluate(()=>{const l=document.getElementById('log').lastElementChild;if(!l)return null;const r=l.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;});
let ok=0,n=0;for(let i=0;i<20;i++){await p.waitForTimeout(300);const v=await lastVisible();if(v!==null){n++;if(v)ok++;}}
console.log('following: last row visible',ok,'/',n);
await p.evaluate(()=>scrollBy(0,-600));await p.waitForTimeout(1500);
const y1=await p.evaluate(()=>scrollY);await p.waitForTimeout(1500);const y2=await p.evaluate(()=>scrollY);
console.log('after scrolling up: stayed put',Math.abs(y2-y1)<5,'| button shown',await p.isVisible('#toLatest'));
await p.click('#toLatest');await p.waitForTimeout(800);console.log('after button: following again',await lastVisible(),'| button hidden',await p.isHidden('#toLatest'));
const hud=await p.evaluate(()=>Math.round(document.querySelector('.hud').getBoundingClientRect().height));console.log('hud height',hud,'of',760);
console.log('errors',errs);await b.close();})();
