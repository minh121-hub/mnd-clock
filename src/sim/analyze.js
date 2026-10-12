// 재미·밸런스 점검: 한 판 안 반복, 선택이 결과를 바꾸는 정도, 판 길이, 사건 감정 비율
const fs=require('fs');eval(fs.readFileSync(__dirname+'/../logic.js','utf8')+fs.readFileSync(__dirname+'/../dex-core.js','utf8').replace(/if\(typeof module[^\n]*/,'')+`
const N=+process.argv[2]||4000;const rep={},repRuns={enl:0,cad:0},cnt={enl:0,cad:0};const kinds={enl:{},cad:{}};
const byDec={};const len={enl:[],cad:[]};const quiet={enl:[],cad:[]};
for(let k=0;k<N;k++){const ctx=drawCtx('','',Math.random);const G=autoplay(ctx,Math.random);const f=runFacts(G);const g=f.isEnl?'enl':'cad';cnt[g]++;
 const evs=G.events.slice(0,G.i);len[g].push(evs.length);const seen={};let dup=false;
 for(const e of evs){const n=dexNorm(e.text);seen[n]=(seen[n]||0)+1;if(seen[n]===2){dup=true;rep[n]=(rep[n]||0)+1;}kinds[g][e.kind||'-']=(kinds[g][e.kind||'-']||0)+1;}
 if(dup)repRuns[g]++;
 // 사건 없이 지나가는 긴 공백 (간부: 1년 넘게 아무 일 없음)
 if(!f.isEnl){let gaps=0;for(let i=1;i<evs.length;i++)if(evs[i].d-evs[i-1].d>365*864e5)gaps++;quiet.cad.push(gaps);}
 const score=f.isEnl?f.reward*2-f.bad+(f.ending==='만기 전역'?3:0):f.fri;
 for(const [id,k2] of Object.entries(G.decided)){const key=id.replace(/\\d+$/,'#');(byDec[key]=byDec[key]||{})[k2]=(byDec[key][k2]||[]);byDec[key][k2].push(score);}
}
const avg=a=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);
console.log('runs',cnt);console.log('runs with a repeated line: enl',(repRuns.enl/cnt.enl*100).toFixed(0)+'%','cad',(repRuns.cad/cnt.cad*100).toFixed(0)+'%');
console.log('top repeated lines:');Object.entries(rep).sort((a,b)=>b[1]-a[1]).slice(0,12).forEach(([t,c])=>console.log('  '+(c/N*100).toFixed(1)+'%  '+t));
for(const g of ['enl','cad']){const tot=Object.values(kinds[g]).reduce((a,b)=>a+b,0);console.log(g,'event mix',Object.entries(kinds[g]).map(([k,v])=>k+' '+(v/tot*100).toFixed(0)+'%').join(' · '),'| len avg',avg(len[g]).toFixed(0));}
const q=(a,p)=>a.slice().sort((x,y)=>x-y)[Math.floor(p*a.length)];
console.log('cadre: runs with ≤15 lines',(len.cad.filter(x=>x<=15).length/cnt.cad*100).toFixed(0)+'%','| avg 1yr+ silent gaps',avg(quiet.cad).toFixed(1));
console.log('choice impact (score: enl=reward*2-bad+만기3, cad=final rank index). spread = best option avg - worst option avg');
const rows=[];for(const [id,o] of Object.entries(byDec)){const opts=Object.entries(o).filter(([k,v])=>v.length>=40);if(opts.length<2)continue;const av=opts.map(([k,v])=>[k,avg(v),v.length]);av.sort((a,b)=>b[1]-a[1]);rows.push([id,(av[0][1]-av[av.length-1][1]),av.map(x=>x[0]+':'+x[1].toFixed(2)).join(' ')]);}
rows.sort((a,b)=>b[1]-a[1]);rows.forEach(r=>console.log('  '+r[0].padEnd(12),'spread',r[1].toFixed(2),'|',r[2]));
`);
