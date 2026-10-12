/* ---------- 도감 코어: 한 판의 기록(facts)과 업적 판정. DOM을 쓰지 않아 node 시뮬레이션에서도 돈다 ---------- */
const DEX_RANKS=['이병','일병','상병','병장','하사','중사','상사','원사','준위','소위','중위','대위','소령','중령','대령','준장','소장','중장','대장'];
const dexNorm=t=>String(t||'').replace(/[0-9][0-9,.]*/g,'#').trim();
const dexHash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);};
const SVC_IDS=['army','navy','air','marine'];

function runFacts(G){
  const ctx=G.ctx,life=G.life,sw=life.switched||null;
  const isEnl=ctx.rk==='enl'&&!sw;const CL=G.clife;const L=isEnl?life:CL;
  const evs=G.events.slice(0,G.i);
  let cur=ctx.sv.id;const ranks=new Set(),evKeys=[],evText={};
  let bad=0,promo=0,leaveN=0;
  for(const e of evs){
    if(e.svc)cur=e.svc;
    if(e.rk&&DEX_RANKS.includes(e.rk))ranks.add(cur+':'+e.rk);
    const n=dexNorm(e.text);if(n){const h=dexHash(n);if(!evText[h]){evText[h]=e.text;evKeys.push(h);}}
    if(e.kind==='bad')bad++;if(e.kind==='promo')promo++;if(e.kind==='leave')leaveN++;
  }
  const fr=(L&&L.finalRank)||(isEnl?'병장':null);
  if(fr)ranks.add((G.svNow||cur)+':'+fr);
  const money=evs.map(e=>e.money).filter(Boolean).pop()||null;
  const ending=(life.ending&&life.ending.label)||(life.early&&life.early.label)||(L&&L.endLabel)||(isEnl?'만기 전역':'전역');
  const dec=Object.entries(G.decided||{});
  const choices=dec.length===G.choices.length?dec.map(([id,k],i)=>[id+'='+k,G.choices[i]]):dec.map(([id,k])=>[id+'='+k,'']);
  const S=G.stats||{};const es=isEnl?(life.stats||{}):{};const cs=(CL&&CL.stats)||{};
  const liquid=isEnl&&life.savings?life.savings+(money&&(money.k==='stock'||money.k==='coin')?money.v:0):0;
  const roles=[ctx.sv.id+':'+ctx.role.name];if(G.cctx&&G.cctx!==ctx)roles.push(G.cctx.sv.id+':'+G.cctx.role.name);
  if(G.prevCad&&G.prevCad.ctx)roles.push(G.prevCad.ctx.sv.id+':'+G.prevCad.ctx.role.name);
  const units=[ctx.place&&ctx.place.name];if(G.cctx&&G.cctx.place)units.push(G.cctx.place.name);if(G.prevCad&&G.prevCad.ctx&&G.prevCad.ctx.place)units.push(G.prevCad.ctx.place.name);
  const svcs=new Set([ctx.sv.id]);if(G.cctx)svcs.add(G.cctx.sv.id);if(G.prevCad&&G.prevCad.ctx)svcs.add(G.prevCad.ctx.sv.id);
  return{
    svc:ctx.sv.id,rk:ctx.rk,wo:!!(ctx.source&&ctx.source.wo),isEnl,sw:sw&&sw.kind,offToNco:!!G.prevCad,svcs:[...svcs],
    roles:[...new Set(roles.filter(Boolean))],units:[...new Set(units.filter(Boolean))],ranks:[...ranks],
    fr,fri:DEX_RANKS.indexOf(fr),stamp:(L&&L.stampTxt)||'전역',ending,endK:life.ending?life.ending.k:null,early:!!life.early,
    st:{fit:S.fit|0,aim:S.aim|0,iq:S.iq|0,mind:S.mind|0},bestFit:G.best?G.best.fit:9,bestAim:G.best?G.best.aim:9,
    leaves:es.leaves|0,reward:es.reward|0,delays:es.delays|0,liquid,money:money?money.k:null,moneyM:money&&money.m||0,
    years:L&&L.years||0,moves:cs.moves|0,deploy:cs.deploy|0,married:!!cs.married,kids:cs.kids|0,divorced:!!cs.divorced,isLong:!!(CL&&CL.isLong),
    special:!!(ctx.role.special&&CL&&!CL.dropped),specMid:!!(CL&&CL.specMid&&CL.specMid.passed),dropped:!!(CL&&CL.dropped),
    p:ctx.p,bad,promo,leaveN,nChoices:G.choices.length,evKeys,evText,choices
  };
}

/* 업적. tier: 1 일반 · 2 도전 · 3 난관 · 4 전설. hidden: 달성 전엔 이름과 조건을 가린다.
   run: 한 판 기록으로 판정 → 시뮬레이션으로 확률을 낸다. cum: 누적 도감으로 판정. ui: 플레이 방식으로 판정 */
const STAR4=/^(준장|소장|중장|대장)$/;
const ACH=[
  // 일반
  {id:'first',tier:1,ic:'boot',t:'첫 입대',d:'한 번 입대한다',cum:d=>d.runs>=1},
  {id:'fullterm',tier:1,ic:'medal',t:'만기 전역',d:'병사로 중간 전역 없이 만기를 채운다',run:f=>f.isEnl&&f.ending==='만기 전역'},
  {id:'leave10',tier:2,ic:'leave',t:'휴가 10번',d:'병사로 휴가를 10번 이상 나간다',run:f=>f.isEnl&&f.leaves>=10},
  {id:'long',tier:1,ic:'ladder',t:'장기복무 선발',d:'간부로 장기복무에 선발된다',run:f=>f.isLong},
  {id:'family',tier:1,ic:'heart',t:'가정을 꾸리다',d:'복무 중 결혼한다',run:f=>f.married||f.divorced},
  {id:'moves5',tier:1,ic:'arrow',t:'이삿짐 전문가',d:'간부로 이사를 5번 이상 한다',run:f=>f.moves>=5},
  {id:'coin2x',tier:1,ic:'coin',t:'떡상',d:'코인이 두 배가 된다',run:f=>f.money==='coin'&&f.moneyM>=2},
  {id:'svc4',tier:1,ic:'globe',t:'4군 순례',d:'육·해·공·해병 모두 복무한다',cum:d=>d.svc.length>=4},
  {id:'rk3',tier:1,ic:'ladder',t:'병·부·장',d:'병사·부사관·장교로 모두 시작한다',cum:d=>['enl','nco','off'].every(k=>d.rk.includes(k))},
  {id:'ten',tier:1,ic:'clock',t:'열 번째 군번',d:'10번 입대한다',cum:d=>d.runs>=10},
  {id:'handmade',tier:1,ic:'v',t:'손수 고른 군생활',d:'자동·스킵 없이 모든 선택을 직접 하고 전역한다',ui:u=>!u.auto&&!u.skip&&u.manual>=3},
  // 도전
  {id:'reward',tier:2,ic:'leave',t:'포상휴가 부자',d:'병사로 포상휴가 5번 이상',run:f=>f.isEnl&&f.reward>=5},
  {id:'elite',tier:2,ic:'target',t:'특급 + 특등',d:'체력검정 특급과 특등사수를 둘 다 받는다',run:f=>f.bestFit===0&&f.bestAim===0},
  {id:'money',tier:2,ic:'coin',t:'전역 자금 2,500',d:'전역 자금 2,500만 원 이상',run:f=>f.liquid>=2500},
  {id:'top',tier:2,ic:'v',t:'부사관의 끝',d:'원사나 준위로 전역한다',run:f=>f.fr==='원사'||f.fr==='준위'},
  {id:'field',tier:2,ic:'star',t:'영관 장교',d:'소령 이상으로 전역한다',run:f=>f.fri>=12},
  {id:'sf',tier:2,ic:'knife',t:'특수부대',d:'특수부대 교육을 수료한다',run:f=>f.special||f.specMid},
  {id:'deploy',tier:2,ic:'globe',t:'해외 파병',d:'파병을 다녀온다',run:f=>f.deploy>0},
  {id:'honor',tier:2,ic:'medal',t:'명예 전역',d:'명예 전역한다',run:f=>f.ending==='명예 전역'},
  {id:'limit',tier:2,ic:'clock',t:'정년까지',d:'정년 전역한다',run:f=>f.ending==='정년 전역'},
  {id:'kids2',tier:2,ic:'heart',t:'다둥이',d:'자녀 2명',run:f=>f.kids>=2},
  {id:'stat100',tier:2,ic:'target',t:'만렙',d:'능력치 하나를 100까지 올린다',run:f=>Object.values(f.st).some(v=>v>=100)},
  {id:'switch',tier:2,ic:'arrow',t:'진로 변경',d:'병사에서 간부로 다시 들어간다',run:f=>!!f.sw},
  {id:'fifty',tier:2,ic:'clock',t:'오십 번째 군번',d:'50번 입대한다',cum:d=>d.runs>=50},
  {id:'roles100',tier:2,ic:'boot',t:'특기 수집가',d:'특기 100개를 만난다',cum:d=>d.roles.length>=100},
  {id:'units50',tier:2,ic:'globe',t:'전국 일주',d:'부대 50곳을 거친다',cum:d=>d.units.length>=50},
  {id:'ev500',tier:2,ic:'x',t:'사건 500',d:'서로 다른 사건 500개를 겪는다',cum:d=>d.ev.length>=500},
  // 난관
  {id:'star',tier:3,ic:'star',t:'별을 달다',d:'장군으로 전역한다',run:f=>STAR4.test(f.fr||'')},
  {id:'allHigh',tier:3,ic:'target',t:'만능 군인',d:'네 능력치를 모두 70 이상으로 전역한다',run:f=>Object.values(f.st).every(v=>v>=70)},
  {id:'reward7',tier:3,ic:'leave',t:'포상휴가 제조기',d:'병사로 포상휴가 7번 이상',run:f=>f.isEnl&&f.reward>=7},
  {id:'enl2off',tier:3,ic:'arrow',t:'병장에서 소위로',d:'병사로 입대해 장교가 된다',run:f=>f.sw==='off'||f.sw==='xoff'},
  {id:'xsvc',tier:3,ic:'globe',t:'군 갈아타기',d:'다른 군 간부로 다시 입대한다',run:f=>f.sw==='xnco'||f.sw==='xoff'},
  {id:'off2nco',tier:3,ic:'ladder',t:'다시 하사로',d:'장교로 전역했다가 부사관으로 다시 들어간다',run:f=>f.offToNco},
  {id:'perfectEnl',tier:3,ic:'medal',t:'모범 병사',d:'진급 누락 없이 포상휴가 5번, 체력 특급으로 만기',run:f=>f.isEnl&&f.ending==='만기 전역'&&f.delays===0&&f.reward>=5&&f.bestFit===0},
  {id:'rare1',tier:2,ic:'x',t:'만분의 일',d:'확률 1만분의 1 미만인 조합으로 입대한다',run:f=>f.p<1e-4},
  {id:'p100k',tier:3,ic:'x',t:'십만분의 일',d:'확률 10만분의 1 미만인 조합으로 입대한다',run:f=>f.p<1e-5},
  {id:'money3k',tier:3,ic:'coin',t:'전역 자금 3천',d:'전역 자금 3,000만 원 이상',run:f=>f.liquid>=3000},
  {id:'roles300',tier:3,ic:'boot',t:'특기 박사',d:'특기 300개를 만난다',cum:d=>d.roles.length>=300},
  {id:'units100',tier:3,ic:'globe',t:'전군 순회',d:'부대 100곳을 거친다',cum:d=>d.units.length>=100},
  {id:'ev1500',tier:3,ic:'x',t:'사건 1500',d:'서로 다른 사건 1,500개를 겪는다',cum:d=>d.ev.length>=1500},
  {id:'legend10',tier:3,ic:'star',t:'전설 수집가',d:'전설 사건 10개를 겪는다',cum:(d,C)=>d.ev.filter(h=>C.tierOf(h)===4).length>=10},
  {id:'hundred',tier:3,ic:'clock',t:'백 번째 군번',d:'100번 입대한다',cum:d=>d.runs>=100},
  // 전설
  {id:'major2',tier:4,ic:'star',t:'투 스타 이상',d:'소장 이상으로 전역한다',run:f=>/^(소장|중장|대장)$/.test(f.fr||'')},
  {id:'allMax',tier:4,ic:'target',t:'완전체',d:'네 능력치를 모두 80 이상으로 전역한다',run:f=>Object.values(f.st).every(v=>v>=80)},
  {id:'reward8',tier:4,ic:'leave',t:'포상휴가의 신',d:'병사로 포상휴가 8번 이상',run:f=>f.isEnl&&f.reward>=8},
  {id:'p1m',tier:4,ic:'x',t:'백만분의 일',d:'확률 100만분의 1 미만인 조합으로 입대한다',run:f=>f.p<1e-6},
  {id:'enlStar',tier:4,ic:'star',t:'이등병의 별',d:'병사로 입대해 장군이 된다',run:f=>!!f.sw&&STAR4.test(f.fr||'')},
  {id:'rolesAll',tier:4,ic:'boot',t:'특기 완전정복',d:'모든 특기를 만난다',cum:(d,C)=>d.roles.length>=C.roles},
  {id:'unitsAll',tier:4,ic:'globe',t:'부대 완전정복',d:'모든 부대를 거친다',cum:(d,C)=>d.units.length>=C.units},
  {id:'endAll',tier:4,ic:'medal',t:'모든 결말',d:'도감의 결말을 모두 본다',cum:(d,C)=>C.endings.every(e=>d.end.includes(e))},
  {id:'ranksAll',tier:4,ic:'v',t:'계급장 완전정복',d:'도감의 계급장을 모두 단다',cum:(d,C)=>d.ranks.length>=C.ranks.length},
  {id:'legendAll',tier:4,ic:'star',t:'살아있는 전설',d:'전설 사건 50개를 겪는다',cum:(d,C)=>d.ev.filter(h=>C.tierOf(h)===4).length>=50},
  {id:'thousand',tier:4,ic:'clock',t:'천 번째 군번',d:'1,000번 입대한다',cum:d=>d.runs>=1000},
  // 히든
  {id:'prison',tier:4,hidden:1,ic:'x',t:'국군교도소',d:'도박 빚으로 수감된다',run:f=>f.endK==='prison'},
  {id:'sanggeun',tier:3,hidden:1,ic:'heart',t:'아빠는 상근',d:'아이가 생겨 상근예비역으로 편입된다',run:f=>f.endK==='sanggeun'},
  {id:'sick',tier:2,hidden:1,ic:'x',t:'의병 전역',d:'다치거나 아파서 중간 전역한다',run:f=>f.ending==='의병 전역'},
  {id:'unfit',tier:2,hidden:1,ic:'x',t:'부적합',d:'현역복무 부적합으로 전역한다',run:f=>f.ending==='현역복무 부적합 전역'},
  {id:'family2',tier:3,hidden:1,ic:'heart',t:'가사 전역',d:'집안 사정으로 중간 전역한다',run:f=>f.ending==='가사 전역'},
  {id:'divorce',tier:2,hidden:1,ic:'heart',t:'돌싱',d:'복무 중 이혼한다',run:f=>f.divorced},
  {id:'crash',tier:1,hidden:1,ic:'coin',t:'한강 물 온도',d:'코인이 반토막 난다',run:f=>f.money==='coin'&&f.moneyM<=0.5},
  {id:'gamble',tier:1,hidden:1,ic:'coin',t:'손대지 말 것',d:'불법 도박 사이트에 들어간다',run:f=>f.money==='gamble'},
  {id:'lowAll',tier:3,hidden:1,ic:'x',t:'바닥',d:'능력치 하나가 10 이하인 채로 전역한다',run:f=>Object.values(f.st).some(v=>v<=10)},
  {id:'zeroMind',tier:3,hidden:1,ic:'x',t:'멘탈 0',d:'멘탈이 0인 채로 전역한다',run:f=>f.st.mind<=0},
  {id:'bad10',tier:2,hidden:1,ic:'x',t:'사고뭉치',d:'한 판에 사고 10번 이상',run:f=>f.bad>=10},
  {id:'dropout',tier:2,hidden:1,ic:'knife',t:'탈락',d:'특수부대 교육에서 탈락한다',run:f=>f.dropped},
  {id:'nightOwl',tier:2,hidden:1,ic:'clock',t:'불침번',d:'새벽 2시~5시에 전역한다',ui:u=>u.hour>=2&&u.hour<5},
  {id:'slow',tier:3,hidden:1,ic:'clock',t:'국방부 시계는 느리다',d:'간부로 0.5배속, 자동·스킵 없이 끝까지 본다',ui:(u,f)=>!f.isEnl&&u.maxSpeed<=0.5&&!u.auto&&!u.skip},
  {id:'skipper',tier:1,hidden:1,ic:'arrow',t:'빨리 감기',d:'스킵을 30번 누른다',cum:d=>d.skips>=30},
  {id:'mates4',tier:2,hidden:1,ic:'globe',t:'뿔뿔이',d:'같은 날 들어온 동기 4명이 모두 다른 군이다',ui:u=>u.matesSvc>=4},
  {id:'samerole',tier:1,hidden:1,ic:'boot',t:'데자뷔',d:'같은 특기로 두 판 연속 입대한다',ui:u=>u.sameRole},
  {id:'newEvent',tier:4,hidden:1,ic:'star',t:'미기록 사건',d:'도감에 없는 사건을 겪는다',cum:d=>d.unknown>0},
  {id:'achAll',tier:4,hidden:1,ic:'medal',t:'국방부 시계',d:'다른 업적을 모두 달성한다',cum:d=>ACH.every(a=>a.id==='achAll'||d.ach.includes(a.id))}
];
if(typeof module!=='undefined')module.exports={runFacts,ACH,DEX_RANKS,dexNorm,dexHash};
