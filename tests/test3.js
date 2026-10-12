const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
for(const [name,vp,scheme] of [['phone',{width:400,height:900},'dark'],['desk',{width:1100,height:900},'light']]){
  const p=await b.newPage({viewport:vp,colorScheme:scheme});
  p.on('pageerror',e=>errs.push(name+': '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/net::|Failed to load/.test(m.text()))errs.push(m.text())});
  await p.goto('file://'+process.cwd()+'/app/www/index.html');await p.waitForTimeout(400);
  if(name==='desk'){await p.click('#rankChips label[for="rank-off"]');}
  await p.click('#goBtn');await p.click('#spd button[data-s="4"]');
  for(let i=0;i<300;i++){const opt=await p.$('.opt:not([disabled])');if(opt)await opt.click();if(await p.isVisible('#end'))break;await p.waitForTimeout(150);}
  await p.waitForTimeout(1500);
  await p.locator('#end').screenshot({path:`shots/end-${name}.png`});
  console.log(name,'picks',await p.$$eval('#picksList li',e=>e.length),'| title',await p.textContent('#epicTitle'),'| ach',await p.$$eval('#runAchList li',e=>e.map(x=>x.innerText.split('\n')[0])));
  console.log((await p.inputValue('#shareTxt')).slice(0,500));
  console.log('overflow',await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
}
console.log('errors',errs);await b.close();})();
