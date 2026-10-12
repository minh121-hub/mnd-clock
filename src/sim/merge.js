const fs=require('fs');const {ACH}=require('../dex-core.js');
const M={N:0,ev:{},evt:{},ach:{},end:{},ranks:{},choices:{},ctag:{},maxReward:0,minP:1};
for(const f of ['part1','part2','part3','part4']){const R=JSON.parse(fs.readFileSync(__dirname+'/'+f+'.json'));M.N+=R.N;
 for(const k of ['ev','ach','end','ranks','choices'])for(const [a,b] of Object.entries(R[k]))M[k][a]=(M[k][a]||0)+b;
 Object.assign(M.evt,R.evt);Object.assign(M.ctag,R.ctag);M.maxReward=Math.max(M.maxReward,R.maxReward);M.minP=Math.min(M.minP,R.minP);}
const N=M.N;const tierOf=c=>{const p=c/N;return p>=0.05?1:p>=0.005?2:p>=0.0005?3:4;};
const tc={1:0,2:0,3:0,4:0};for(const c of Object.values(M.ev))tc[tierOf(c)]++;
console.log('N',N,'events',Object.keys(M.ev).length,tc,'maxReward',M.maxReward,'minP',M.minP);
console.log('ends',M.end);console.log('ranks',Object.keys(M.ranks).length,'choices',Object.keys(M.choices).length,'tags',Object.keys(M.ctag).length);
for(const a of ACH)if(a.run)console.log(a.id.padEnd(10),a.tier,((M.ach[a.id]||0)/N*100).toFixed(3)+'%');
fs.writeFileSync(__dirname+'/merged.json',JSON.stringify(M));
