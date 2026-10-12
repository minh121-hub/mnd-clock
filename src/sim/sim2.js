const fs=require('fs');const N=+process.argv[2],out=process.argv[3];
eval(fs.readFileSync(__dirname+'/../logic.js','utf8')+fs.readFileSync(__dirname+'/../dex-core.js','utf8').replace(/if\(typeof module[^\n]*/,'')+`
const RES={N,ev:{},evt:{},ach:{},end:{},ranks:{},choices:{},ctag:{},maxReward:0,minP:1};
for(let k=0;k<N;k++){
  const ctx=drawCtx('','',Math.random);const G=autoplay(ctx,Math.random);const f=runFacts(G);
  for(const h of f.evKeys){RES.ev[h]=(RES.ev[h]||0)+1;if(!RES.evt[h])RES.evt[h]=f.evText[h];}
  for(const a of ACH)if(a.run&&a.run(f))RES.ach[a.id]=(RES.ach[a.id]||0)+1;
  RES.end[f.ending]=(RES.end[f.ending]||0)+1;
  for(const r of f.ranks)RES.ranks[r]=(RES.ranks[r]||0)+1;
  for(const [c,t] of f.choices){RES.choices[c]=(RES.choices[c]||0)+1;if(t&&!RES.ctag[c])RES.ctag[c]=t;}
  RES.maxReward=Math.max(RES.maxReward,f.reward);RES.minP=Math.min(RES.minP,f.p);
}
fs.writeFileSync(out,JSON.stringify(RES));`);
