/* ---------- 추가 레이어: 픽셀 씬, 사운드, 진동, 도감 ----------
   원본 게임 로직은 건드리지 않고, 화면 함수 몇 곳에서 FX.on* 훅만 부른다. */
const FX=(()=>{
  const RM=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W=240,H=60,GY=48;
  const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};

  /* ---------- 팔레트 (씬은 자체 세계라 테마와 무관한 고정색) ---------- */
  const P={
    skin:'#E9B98F',boot:'#2A2620',belt:'#3B3424',
    sky:{day:['#7FB7E0','#CFE5F0'],dusk:['#5E4F86','#F0A35E'],night:['#0B1230','#26305C']},
    ground:{army:'#5D6B35',navy:'#6C7480',air:'#7C8072',marine:'#D9C38E'},
    snow:'#EEF2F4',dirt:'#9C8358',road:'#4C4F55'
  };
  const UNI={
    army:{h:'#4E5A2A',u:'#5D6B35',p:'#4E5A2A',c:'#3C4520'},
    navy:{h:'#F2F2EE',u:'#24406E',p:'#1C3156',c:'#F2F2EE'},
    air:{h:'#3E5F86',u:'#58799E',p:'#435F80',c:'#2C4766'},
    marine:{h:'#5A5432',u:'#6E6A42',p:'#5A5432',c:'#A3271C'}
  };
  /* 12줄짜리 병사 스프라이트. h 모자, s 피부, u 상의, c 명찰·포인트, b 허리띠, p 하의, k 군화 */
  const SOL=[
    '..hhh..',
    '.hhhhh.',
    '..sss..',
    '..sss..',
    '.uuuuu.',
    'uuuuucu',
    'suuuuus',
    '.uuuuu.',
    '.bbbbb.',
    '.pp.pp.',
    '.pp.pp.',
    '.kk.kk.'];
  const SOL2=SOL.slice(0,9).concat(['.pp..pp','pp...pp','kk...kk']);

  /* 상태 레이어 스프라이트: 글자 하나가 픽셀 하나, 팔레트는 그리는 쪽에서 준다 */
  const CATSP=['.a..a.','.aaaa.','.ayay.','.aaaa.','aaaaa.'];
  const DOG=['.....dd.','.....ddn','dddddddd','dddddd..','d.d..d.d'];
  const CIV=['..hhh..','.hhhhh.','.hsssh.','.hsssh.','.ccccc.','ccccccc','scccccs','.ccccc.','.ddddd.','.ddddd.','.s...s.','.kk.kk.'];
  const KID=['.hhh.','.sss.','.sss.','ccccc','.ccc.','.ddd.','.d.d.','.k.k.'];
  const DESERT={h:'#B79A62',u:'#C8AE78',p:'#A88E5A',c:'#3E7CC4'};
  const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};

  /* ---------- 사건 문장 → 장면 ---------- */
  const RULES=[
    ['final',null],
    ['boot',/입영|입소|신병교육|훈련소|기본군사|입교|교육대|수료식|후반기 교육/],
    ['guard',/근무|GOP|GP|경계|초소|당직|불침번|해안 감시|상황실/],
    ['range',/사격|사수|영점|탄약/],
    ['snow',/눈을|제설|넉가래|혹한|폭설/],
    ['leave',/휴가|외출|외박|여행|면회|소개팅|가족|집에|명절|추석|설 연휴/],
    ['field',/훈련|기동|유격|KCTC|연습|비상|전차|장갑차|진지|방열|상륙|출항|항해|비행|작전|파병/],
    ['money',/적금|코인|주식|월급|봉급|만 원|돈|성과상여금|연금/],
    ['love',/연애|여자친구|결혼|아빠|엄마|자녀|육아|헤어|편지|배우자/],
    ['study',/공부|강좌|자격증|학위|학점|책|인강|사지방|교육을|이수|교관/]
  ];
  const LABEL={boot:'교육대',guard:'경계 근무',range:'사격장',snow:'제설',leave:'휴가 중',field:'야외 훈련',money:'월급날',love:'연락 중',study:'자기계발',barracks:'생활관',final:'전역',promo:'진급',bad:'사고',idle:'입영 대기'};
  const BASE_LABEL={navy:'함정',air:'비행단',marine:'해병대 부대',army:'생활관'};
  function sceneOf(e){
    if(e.kind==='final')return 'final';
    const t=e.text||'';
    for(const [k,re] of RULES)if(re&&re.test(t))return k;
    return 'barracks';
  }
  function todOf(t,k){
    if(k==='guard'||/밤|야간|새벽|자정|한밤/.test(t))return 'night';
    if(/저녁|퇴근|해질|노을|해돋이/.test(t))return 'dusk';
    if(k==='leave'||k==='final'||k==='boot')return 'day';
    const h=hash(t)%10;return h===0?'dusk':'day';
  }
  const seasonOf=d=>{const m=d?d.getMonth()+1:6;return m<=2||m===12?'winter':m<=5?'spring':m<=8?'summer':'autumn';};

  /* ---------- 장면 엔진 ---------- */
  function Scene(cv){
    const c=cv.getContext('2d');cv.width=W;cv.height=H;
    let S={svc:'army',kind:'idle',fx:null,tod:'day',season:'spring',t:0,parts:[],jump:0,walk:0,x:96,st:{},meX:96},timer=null,visible=true;
    const r=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x|0,y|0,w|0,h|0);};
    function sprite(map,x,y,pal,flip){
      for(let j=0;j<map.length;j++){const row=map[j];for(let i=0;i<row.length;i++){const k=row[flip?row.length-1-i:i];if(k==='.')continue;
        const col=k==='s'?P.skin:k==='k'?P.boot:k==='b'?P.belt:pal[k];r(x+i,y+j,1,1,col);}}
    }
    function pix(map,x,y,pal,flip){for(let j=0;j<map.length;j++){const row=map[j];for(let i=0;i<row.length;i++){const k=row[flip?row.length-1-i:i];if(k!=='.'&&pal[k])r(x+i,y+j,1,1,pal[k]);}}}
    function cat(x,y){pix(CATSP,x,y,{a:'#E0A050',y:'#2A2620'});r(x+(S.t%16<8?-1:-2),y+3-(S.t%16<8?1:0),1,2,'#E0A050');}
    function dog(x,y){pix(DOG,x,y-(S.t%10<2?1:0),{d:'#C9A26B',n:'#2A2620'});}
    function civ(x,y,o={}){const legs=o.walk&&(Math.floor(S.t/3)%2);const m=legs?CIV.slice(0,10).concat(['.s..s..','kk...kk']):CIV;
      pix(m,x,y,{h:o.hair||'#3A2A20',s:P.skin,c:o.top||'#D9677A',d:o.bot||'#3E4A6B',k:'#2A2620'},o.flip);if(o.wave&&S.t%10<5)r(x+7,y+3,1,3,P.skin);}
    function kid(x,y,o={}){pix(KID,x,y-((o.hop&&S.t%8<4)?1:0),{h:'#3A2A20',s:P.skin,c:o.top||'#F2C230',d:'#4A6FA5',k:'#2A2620'});}
    function car(x,y){r(x+3,y,10,3,'#3E6FA8');r(x,y+3,18,4,'#3E6FA8');r(x+4,y+1,3,2,'#BFE3F2');r(x+8,y+1,4,2,'#BFE3F2');r(x+2,y+7,4,2,'#222');r(x+12,y+7,4,2,'#222');r(x+17,y+4,1,1,'#FFE07A');}
    const RANK_COL=rk=>!rk?null:/^(준장|소장|중장|대장)$/.test(rk)?'#F2C230':/^(소령|중령|대령)$/.test(rk)?'#E8ECF1':/^(소위|중위|대위)$/.test(rk)?'#C9CED4':/^(하사|중사|상사|원사|준위)$/.test(rk)?'#EFC75E':'#9AA38E';
    function me(x,y,o={}){S.meX=x;S.meY=y;soldier(x,y,{...o,me:true});}
    /* 동반자·반려동물·차: 지금 장면과 상태에 맞춰 주인공 곁에 */
    function truck(x,y){r(x,y+2,20,8,'#4E5A2A');r(x+20,y+4,8,6,'#4E5A2A');r(x+22,y+5,4,2,'#BFE3F2');r(x+1,y,18,2,'#3C4520');r(x+3,y+10,4,2,'#222');r(x+20,y+10,4,2,'#222');}
    function heli(x,y){r(x,y+2,14,4,'#55606E');r(x+14,y+3,10,1,'#55606E');r(x+23,y+1,1,4,'#55606E');r(x+2,y+3,4,2,'#BFE3F2');r(x+4,y+6,8,1,'#333');
      const b=S.t%2;r(x-4+(b?2:0),y,22-(b?4:0),1,'#222');}
    function howitzer(x,y){r(x,y+6,16,4,'#4E5A2A');r(x+3,y+10,4,2,'#222');r(x+10,y+10,4,2,'#222');r(x+12,y+2,14,2,'#3C4520');r(x+10,y+3,4,4,'#4E5A2A');}
    function mast(x,y){r(x,y-20,1,20,'#9AA0A6');r(x-3,y-14,7,1,'#9AA0A6');r(x-2,y-8,5,1,'#9AA0A6');if(S.t%12<6)r(x,y-21,1,1,'#FF4040');}
    function gulls(){for(let i=0;i<3;i++){const gx=((S.t*(0.7+i*0.2)+i*80)%(W+20))-10,gy=10+i*6+Math.round(Math.sin((S.t+i*9)/5)*2),f=Math.floor((S.t+i*3)/4)%2;
      r(gx,gy,2,1,'#F4F4F4');r(gx+3,gy,2,1,'#F4F4F4');r(gx+2,gy+(f?1:-1),1,1,'#F4F4F4');}}
    function roleScene(){
      const st=S.st||{},k=S.kind,x=S.meX,y=GY-12,pr=st.prop;
      if(S.svc==='navy'&&k!=='leave'&&k!=='final')gulls();
      if(k==='leave'||k==='final'||k==='boot'||k==='guard'||k==='range')return;
      if(pr==='k9')pix(DOG,x+10,y+7,{d:'#6B4A2A',n:'#1A1712'});
      if(pr==='chef'&&k!=='field'){r(x+11,y+7,7,5,'#8A8F98');r(x+10,y+7,9,1,'#6E747C');if(S.t%8<6){r(x+13,y+4-(S.t%8)/3,1,2,'#E8ECF0');r(x+16,y+3-(S.t%8)/3,1,2,'#E8ECF0');}}
      if(pr==='medic'){r(x+10,y+8,6,4,'#F4F4F4');r(x+12,y+9,2,2,'#C8102E');r(x+11,y+9,4,1,'#C8102E');r(x+12,y+8,2,4,'#C8102E');r(x+11,y+10,4,1,'#C8102E');}
      if(pr==='truck'&&!(S.st&&S.st.car))truck(10,GY-12);
      if(pr==='heli')heli(((S.t*1.6)%(W+60))-40,14);
      if(pr==='jetmx'){r(x+10,y+9,6,3,'#C8102E');r(x+12,y+8,2,1,'#222');if(S.svc!=='air')jet(24,GY-9,false);}
      if(pr==='comms'){mast(x+16,GY);}
      if(pr==='artillery')howitzer(18,GY-12);
      if(pr==='band'&&S.t%10===0)S.parts.push({x:x+10,y:y+2,vx:0.3,vy:-0.4,col:'#2A2620',s:2,h:1,life:30,note:true});
    }
    function company(){
      roleScene();
      const st=S.st||{},k=S.kind,x=S.meX,y=GY-12;const partner=st.spouse||st.gf;
      const top=st.spouse?'#7A5BA8':'#D9677A';
      if(k==='leave'||k==='love'){
        if(partner)civ(x-9,y,{walk:k==='leave',top});
        for(let i=0;i<st.kids;i++)kid(x-15-i*7,y+4,{hop:true,top:i?'#6BAF5C':'#F2C230'});
        return;}
      if(k==='final'){
        let gx=118;if(partner){civ(gx,y,{wave:true,top});gx-=9;}
        for(let i=0;i<st.kids;i++){kid(gx,y+4,{hop:true,top:i?'#6BAF5C':'#F2C230'});gx-=7;}
        if(st.dog)dog(gx-8,y+7);return;}
      if(k==='guard'||k==='boot'||k==='range'||k==='field')return;
      if(st.cat)cat(x+10,y+7);
      if(st.dog&&!st.cat)dog(x+10,y+7);else if(st.dog)dog(x-11,y+7);
      if(st.car&&S.svc!=='navy'&&!st.deploy)car(14,GY-9);
      if(st.weekend&&S.tod==='night'&&S.t%24<16){r(x+8,y-5,3,5,'#222');r(x+9,y-4,1,3,'#9FD4FF');}
    }
    function soldier(x,y,opt={}){
      const pal=opt.me&&S.st&&S.st.deploy==='desert'?DESERT:UNI[opt.svc||S.svc];const legs=opt.walk&&(Math.floor(S.t/3)%2)?SOL2:SOL;
      sprite(legs,x,y,pal,opt.flip);
      if(opt.bag)r(x+(opt.flip?6:-2),y+4,2,4,'#6B5A3A');
      if(opt.rifle)r(x+6,y+3,1,6,'#222');
      if(!opt.me)return;
      const st=S.st||{};
      if(st.fit>=75){r(x-1,y+4,1,4,pal.u);r(x+7,y+4,1,4,pal.u);}
      if(st.iq>=75){r(x+2,y+2,1,1,'#111');r(x+4,y+2,1,1,'#111');r(x+3,y+2,1,1,'#555');}
      const rc=RANK_COL(st.rank);if(rc)r(x+(opt.flip?5:1),y+5,1,1,rc);
      if(st.rank&&/^(준장|소장|중장|대장)$/.test(st.rank))r(x+3,y,1,1,'#F2C230');
      if(st.hurt>0){r(x+1,y+1,5,1,'#F4F4F4');r(x+(opt.flip?-2:8),y+5,1,7,'#8A6A40');r(x+(opt.flip?-3:7),y+5,3,1,'#8A6A40');}
      const pr=st.prop;
      if(pr==='chef'){r(x+1,y-5,5,4,'#F4F4F4');r(x,y-6,7,2,'#F4F4F4');r(x+1,y-1,5,1,'#C9CED4');}
      if(pr==='mp'){r(x+1,y+1,5,1,'#F4F4F4');r(x,y+5,1,2,'#111');}
      if(pr==='medic'){r(x,y+5,1,2,'#F4F4F4');r(x,y+5,1,1,'#C8102E');}
      if(pr==='honor'){r(x+3,y-3,1,3,'#F4F4F4');r(x-1,y+6,1,1,'#FFFFFF');r(x+7,y+6,1,1,'#FFFFFF');r(x+7,y+1,1,8,'#3A3A3A');if(S.t%14<2)r(x+7,y+1,1,1,'#FFFFFF');}
      if(pr==='band'){r(x+6,y+4,3,1,'#E8C35A');r(x+9,y+3,1,3,'#E8C35A');}
      if(st.mind!=null&&st.mind<30){r(x,y-7,8,2,'#8A8F98');r(x+1,y-8,5,1,'#8A8F98');if(S.t%6<3){r(x+2,y-4,1,1,'#8FB2CF');r(x+5,y-3,1,1,'#8FB2CF');}}
    }
    function sky(){
      const [a,b]=P.sky[S.tod];const g=c.createLinearGradient(0,0,0,GY);g.addColorStop(0,a);g.addColorStop(1,b);c.fillStyle=g;c.fillRect(0,0,W,GY);
      if(S.tod==='night'){for(let i=0;i<34;i++){const x=(i*53+7)%W,y=(i*29+3)%38;if((S.t+i*7)%40<36)r(x,y,1,1,'#E8ECFF');}r(64,7,6,6,'#F4F0D8');r(66,7,4,4,P.sky.night[0]);}
      else if(S.tod==='day'){r(62,6,8,8,'#FFF3B8');for(let i=0;i<3;i++){const x=((S.t*0.2+i*90)%(W+40))-30;r(x,5+i*5,18,3,'#F4F8FA');r(x+4,3+i*5,10,2,'#F4F8FA');}}
      else{r(30,30,10,10,'#F6C27A');}
    }
    const hill=(x,base,amp,freq,ph)=>base-amp*(0.6*Math.sin(x*freq+ph)+0.4*Math.sin(x*freq*2.3+ph*1.7));
    function backdrop(){
      const sv=S.svc,win=S.season==='winter';
      if(S.st&&S.st.deploy==='desert'){
        for(let x=0;x<W;x++){const h=hill(x,36,5,0.03,1.3);r(x,h,1,GY-h,'#D9B77A');}
        for(let x=0;x<W;x++){const h=hill(x,42,3,0.05,0.2);r(x,h,1,GY-h,'#E3C68E');}
        r(150,GY-16,30,16,'#E8DCC0');r(184,GY-12,22,12,'#E8DCC0');r(160,GY-11,4,3,'#6B5A3A');r(190,GY-8,3,3,'#6B5A3A');
        r(214,GY-30,1,30,'#D0D0D0');r(215,GY-30,9,6,'#4B92DB');r(218,GY-28,3,2,'#F4F4F4');
        return;}
      if(sv==='navy'||sv==='marine'){
        // 바다
        r(0,36,W,GY-36,S.tod==='night'?'#122244':'#2F6B9A');
        for(let i=0;i<14;i++){const x=(i*37+S.t*0.6)%W;r(x,38+(i%4)*2,6,1,S.tod==='night'?'#28406A':'#6FA6CF');}
        if(sv==='navy'){ // 먼 함정 실루엣
          const sx=150;r(sx,30,62,6,'#55606E');r(sx+4,36,54,2,'#47505C');r(sx+20,22,16,8,'#55606E');r(sx+26,14,3,8,'#55606E');r(sx+38,26,10,4,'#55606E');
        }else{ // 먼 섬
          for(let x=120;x<240;x++){const h=hill(x,36,6,0.05,1);r(x,h,1,36-h,win?'#9FB0A8':'#4D6B44');}
        }
      }else{
        for(let x=0;x<W;x++){const h=hill(x,30,8,0.035,0.4);r(x,h,1,GY-h,S.tod==='night'?'#24304A':'#7C93A6');if(win&&h<26)r(x,h,1,2,P.snow);}
        for(let x=0;x<W;x++){const h=hill(x,38,6,0.06,2.1);r(x,h,1,GY-h,S.tod==='night'?'#1A2A20':win?'#B9C4BC':'#4E6B3A');}
        if(sv==='air'){ // 격납고와 관제탑
          r(170,34,40,14,'#8A8F96');r(172,30,36,4,'#8A8F96');r(176,28,28,2,'#8A8F96');r(184,38,12,10,'#3B4048');
          r(150,26,4,22,'#A0A5AC');r(146,22,12,5,'#A0A5AC');r(147,23,10,2,S.tod==='night'?'#F6D36B':'#5B7EA0');
        }
      }
      // 계절 나무
      if(sv!=='navy'){for(const tx of [16,58,226]){if(sv==='marine'&&tx<100)continue;const leaf=win?'#D8DEDA':S.season==='autumn'?'#C7782E':S.season==='spring'?'#E9A9BE':'#3E6A32';
        r(tx+3,GY-8,2,8,'#5A4128');r(tx,GY-16,8,8,leaf);r(tx+1,GY-18,6,2,leaf);}}
    }
    function ground(){
      const sv=S.svc,win=S.season==='winter';
      let gc=P.ground[sv];if(win&&sv!=='navy')gc=P.snow;if(S.st&&S.st.deploy==='desert')gc='#D8C08A';
      if(S.kind==='boot')gc=win?P.snow:P.dirt;
      if(S.kind==='leave')gc=P.road;
      r(0,GY,W,H-GY,gc);
      r(0,GY,W,1,'rgba(0,0,0,.18)');
      if(sv==='navy'&&S.kind!=='leave'){r(0,GY,W,H-GY,'#7A828C');for(let x=0;x<W;x+=12)r(x,GY+1,1,H-GY,'#6A717A');r(0,GY-3,W,1,'#C9CED4');for(let x=0;x<W;x+=8)r(x,GY-3,1,3,'#C9CED4');}
      if(sv==='air'&&S.kind!=='leave'&&S.kind!=='boot'){r(0,GY+5,W,6,'#55585E');for(let x=(-S.t*1.5)%16;x<W;x+=16)r(x,GY+7,7,1,'#E8E2C8');}
      if(S.kind==='leave'){for(let x=(-S.t*2)%20;x<W;x+=20)r(x,GY+6,10,1,'#E8E2C8');}
    }
    function building(x,w,h,col){
      const night=S.tod==='night';r(x,GY-h,w,h,col);r(x-2,GY-h-3,w+4,3,'#6E4A3A');
      for(let yy=GY-h+4;yy<GY-6;yy+=6)for(let xx=x+3;xx<x+w-4;xx+=7){const lit=night&&((xx*7+yy*3)%5!==0);r(xx,yy,4,3,lit?'#F6D36B':'#3B4A5A');}
      r(x+w/2-3,GY-7,6,7,'#4A3A2A');
    }
    function flag(x,top){r(x,top,1,GY-top,'#D0D0D0');const wv=Math.floor(S.t/4)%2;r(x+1,top,9,6,'#F4F4F4');r(x+4+wv,top+2,3,2,'#C8102E');r(x+4+wv,top+3,3,1,'#003478');}
    function props(){
      const k=S.kind,t=S.t;
      if(k==='barracks'||k==='money'||k==='love'||k==='study'||k==='promo'||k==='bad'||k==='snow'){
        if(S.svc==='navy'){ // 함정 갑판 구조물
          r(120,GY-22,60,22,'#8E969F');r(130,GY-32,30,10,'#8E969F');r(142,GY-42,3,10,'#6E7680');for(let x=124;x<176;x+=8)r(x,GY-16,4,3,S.tod==='night'?'#F6D36B':'#33404E');
        }else if(S.svc==='air'&&k==='barracks'){ // 계류장 전투기
          jet(118,GY-9,false);building(30,46,18,'#C7C2AE');
        }else{building(120,64,24,'#C9C2A8');flag(196,GY-30);}
      }
      if(k==='boot'){flag(40,GY-34);building(170,56,20,'#BDB49A');for(let i=0;i<5;i++)soldier(70+i*12,GY-12,{walk:true});soldier(140,GY-12,{flip:true});}
      if(k==='range'){r(120,GY-4,40,4,'#8B7B55');for(let i=0;i<3;i++){const x=180+i*18;r(x+3,GY-14,1,14,'#5A4128');r(x,GY-22,8,8,'#F2EDE0');r(x+2,GY-20,4,4,'#C8102E');r(x+3,GY-19,2,2,'#F2EDE0');}
        if(t%12<2){r(108,GY-9,4,2,'#FFE07A');r(111,GY-10,2,4,'#FFB347');}}
      if(k==='field'){r(150,GY-12,30,12,'#4E5A2A');r(158,GY-17,14,5,'#4E5A2A');r(172,GY-16,22,2,'#3C4520');r(150,GY-3,30,3,'#2A2E1E');for(let i=0;i<6;i++)r(152+i*5,GY-2,3,2,'#555');
        // 텐트
        for(let i=0;i<10;i++)r(40-i,GY-10+i,i*2+1,1,'#6B7340');}
      if(k==='guard'){ // 초소와 철책
        r(176,GY-26,20,26,'#5A5F55');r(172,GY-30,28,4,'#3E423A');r(181,GY-20,10,5,'#F6D36B');
        for(let x=0;x<W;x+=10){r(x,GY-14,1,14,'#9AA0A6');}r(0,GY-13,W,1,'#9AA0A6');r(0,GY-8,W,1,'#9AA0A6');
        c.fillStyle='rgba(255,240,170,.16)';c.beginPath();const a=Math.sin(t/14)*0.6;c.moveTo(186,GY-22);c.lineTo(186-90*Math.cos(a)-20,8+40*Math.sin(a));c.lineTo(186-90*Math.cos(a)+20,0+40*Math.sin(a));c.closePath();c.fill();}
      if(k==='leave'){ // 도시
        for(let i=0;i<9;i++){const x=i*28+4,h=18+(i*13)%20;r(x,GY-h,22,h,'#5E6878');for(let yy=GY-h+3;yy<GY-3;yy+=5)for(let xx=x+3;xx<x+20;xx+=5)r(xx,yy,2,2,(xx+yy+i)%3?'#F6D36B':'#3B4A5A');}
        const bx=((t*2.2)%(W+70))-60;r(bx,GY-12,44,10,'#2F7A5A');r(bx+2,GY-10,40,4,'#BFE3F2');r(bx+6,GY-2,5,3,'#222');r(bx+32,GY-2,5,3,'#222');}
      if(k==='final'){ // 위병소 정문
        r(150,GY-30,8,30,'#B9B2A0');r(196,GY-30,8,30,'#B9B2A0');r(148,GY-34,58,4,'#7A5A3A');r(158,GY-16,38,2,(Math.floor(t/6)%2)?'#C8102E':'#F4F4F4');}
      if(k==='idle'){ // 입영 대기: 버스와 정문
        r(160,GY-30,6,30,'#B9B2A0');r(206,GY-30,6,30,'#B9B2A0');r(158,GY-34,56,4,'#7A5A3A');flag(120,GY-34);
        r(20,GY-14,56,12,'#E7E2D2');r(22,GY-12,52,4,'#7FA6C0');r(26,GY-2,6,3,'#222');r(62,GY-2,6,3,'#222');}
    }
    function jet(x,y,fly){r(x,y+3,26,3,'#9AA3AD');r(x+18,y,6,3,'#9AA3AD');r(x+6,y+1,8,2,'#7F8892');r(x+8,y+6,10,2,'#7F8892');r(x+22,y+3,4,2,'#3E5F86');if(fly&&S.t%4<2)r(x-4,y+4,4,1,'#FFB347');}
    function actor(){
      const k=S.kind,t=S.t;let x=S.x,y=GY-12,o={};
      if(k==='boot'||k==='field'&&S.svc==='navy')if(k==='boot')return;me(100,y,{});company();return;
      if(k==='range'){me(100,y,{rifle:true});company();return;}
      if(k==='guard'){me(160,y,{rifle:true,flip:Math.floor(t/30)%2===1});company();return;}
      if(k==='leave'){const px=((t*1.1)%(W+40))+10;me(px,y,{walk:true,bag:true});company();return;}
      if(k==='final'){const px=150+((t*0.9)%110);me(px,y,{walk:true,bag:true});if(t%20<10)r(px+2,y-4-((t%10)/2),3,2,UNI[S.svc].h);company();return;}
      if(k==='snow'){me(90,y-(t%8<4?1:0),{});r(97,y+4,1,8,'#7A5A3A');r(96,y+11,6,1,'#7A5A3A');return;}
      if(k==='idle'){me(100+((t*0.5)%40),y,{walk:true,bag:true});return;}
      if(S.jump>0){y-=Math.round(Math.sin(S.jump/8*Math.PI)*6);S.jump--;}
      o.walk=k==='field';if(k==='field'){x=60+((t*0.8)%70);}
      me(x,y,o);company();
      if(S.svc==='air'&&(k==='field'||t%160<60)){const jx=W-((t*3)%(W+60));jet(jx,10,true);}
    }
    /* 입자: 눈, 비, 동전, 하트, 불꽃, 색종이, 책장 */
    function emit(){
      const k=S.kind,fx=S.fx;const p=S.parts;
      if(S.season==='winter'||k==='snow')if(p.length<70)p.push({x:Math.random()*W,y:-2,vx:-0.2+Math.random()*0.3,vy:0.35+Math.random()*0.3,col:'#F4F6F8',s:1,life:200});
      if(fx==='bad'&&p.length<90)for(let i=0;i<2;i++)p.push({x:Math.random()*W,y:-2,vx:-0.6,vy:2.2,col:'#8FB2CF',s:1,h:3,life:40});
      if(k==='money'&&S.t%3===0)p.push({x:96+Math.random()*12,y:GY-12,vx:(Math.random()-.5)*0.6,vy:-0.7,col:'#F2C230',s:2,life:40});
      if(k==='love'&&S.t%5===0)p.push({x:98+Math.random()*8,y:GY-14,vx:(Math.random()-.5)*0.4,vy:-0.45,heart:true,life:60});
      if(k==='study'&&S.t%6===0)p.push({x:98+Math.random()*8,y:GY-14,vx:(Math.random()-.5)*0.3,vy:-0.4,col:'#F4F1E4',s:2,life:50});
      if((fx==='promo'||k==='final')&&S.t%2===0)for(let i=0;i<3;i++)p.push({x:Math.random()*W,y:-2,vx:(Math.random()-.5)*0.8,vy:0.7+Math.random()*0.6,col:['#F2C230','#C8102E','#3E7CC4','#F4F4F4','#6BAF5C'][i+(S.t%3)],s:2,life:90});
      if(fx==='promo'&&S.t%3===0)p.push({x:92+Math.random()*24,y:GY-20+Math.random()*10,vx:0,vy:-0.2,col:'#FFF3B8',s:1,life:12,spark:true});
    }
    function particles(){
      const p=S.parts;
      for(let i=p.length-1;i>=0;i--){const q=p[i];q.x+=q.vx;q.y+=q.vy;q.life--;
        if(q.life<=0||q.y>H||q.x<-4||q.x>W+4){p.splice(i,1);continue;}
        if(q.heart){r(q.x,q.y,2,1,'#E25A7A');r(q.x+3,q.y,2,1,'#E25A7A');r(q.x,q.y+1,5,1,'#E25A7A');r(q.x+1,q.y+2,3,1,'#E25A7A');r(q.x+2,q.y+3,1,1,'#E25A7A');}
        else if(q.note){r(q.x,q.y,2,2,'#2A2620');r(q.x+1,q.y-3,1,3,'#2A2620');}
        else if(q.spark){r(q.x,q.y-1,1,3,q.col);r(q.x-1,q.y,3,1,q.col);}
        else r(q.x,q.y,q.s,q.h||q.s,q.col);}
    }
    function frame(){
      S.t++;sky();backdrop();ground();props();actor();emit();particles();
      if(S.fx==='bad'){c.fillStyle='rgba(30,10,10,.22)';c.fillRect(0,0,W,H);}
      if(S.tod==='night'){c.fillStyle='rgba(10,16,40,.22)';c.fillRect(0,GY,W,H-GY);}
    }
    function tick(){frame();}
    function run(){if(timer||RM||!visible)return;timer=setInterval(tick,1000/12);}
    function stop(){clearInterval(timer);timer=null;}
    if('IntersectionObserver' in window){new IntersectionObserver(es=>{visible=es[0].isIntersecting;visible?run():stop();}).observe(cv);}
    document.addEventListener('visibilitychange',()=>{document.hidden?stop():run();});
    return{
      set(o){Object.assign(S,o);if(o.kind){S.parts=S.parts.filter(q=>q.col==='#F4F6F8');}if(o.fx==='promo')S.jump=16;
        if(RM){for(let i=0;i<30;i++){S.t++;emit();}frame();}},
      start(){frame();run();},stop
    };
  }

  /* ---------- 사운드 (WebAudio로 합성, 기본은 꺼짐) ---------- */
  let ac=null,sound=store.get('mc-sound','0')==='1';
  function tone(f,d,type='square',v=.05,at=0,slide=0){
    if(!sound)return;try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();
      const t=ac.currentTime+at,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);
      g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+d+.02);}catch(e){}
  }
  function noise(d,v=.12){if(!sound)return;try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();const n=ac.sampleRate*d,b=ac.createBuffer(1,n,ac.sampleRate),ch=b.getChannelData(0);for(let i=0;i<n;i++)ch[i]=(Math.random()*2-1)*(1-i/n);
    const s=ac.createBufferSource(),g=ac.createGain();g.gain.value=v;s.buffer=b;s.connect(g).connect(ac.destination);s.start();}catch(e){}}
  const SFX={
    tick:()=>tone(660,.04,'square',.018),
    leave:()=>{tone(784,.09,'triangle',.05);tone(1047,.14,'triangle',.05,.09);},
    good:()=>{tone(880,.08,'triangle',.05);tone(1175,.12,'triangle',.05,.08);},
    promo:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.16,'triangle',.06,i*.1)),
    bad:()=>tone(330,.35,'sawtooth',.04,0,140),
    dec:()=>{tone(587,.06,'square',.03);tone(880,.08,'square',.03,.07);},
    pick:()=>tone(988,.05,'square',.03),
    stamp:()=>{noise(.12,.18);tone(90,.25,'sine',.25);},
    ach:()=>[784,988,1175,1568].forEach((f,i)=>tone(f,.12,'square',.035,i*.07))
  };
  const buzz=p=>{try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}};

  /* ---------- 배너 ---------- */
  let banTimer=null;
  function banner(html,cls,ms=1600){
    const b=document.getElementById('banner');if(!b)return;b.className='banner '+(cls||'');b.innerHTML=html;void b.offsetWidth;b.classList.add('show');
    clearTimeout(banTimer);banTimer=setTimeout(()=>b.classList.remove('show'),RM?ms*1.5:ms);
  }

  /* ---------- 도감 (v2). 판정은 dex-core.js, 등급·확률은 catalog.js ---------- */
  const DEX_KEY='mc-dex-v2',OLD_KEY='mc-dex-v1';
  const TIER_NAME={1:'흔함',2:'보통',3:'희귀',4:'전설'},ACH_TIER={1:'일반',2:'도전',3:'난관',4:'전설'};
  const LIST_KEYS=['svc','rk','roles','units','ranks','end','ch','ev','ach','cuts'];
  const blank=()=>({v:2,runs:0,skips:0,unknown:0,best:-1,bestSvc:'army',lastRole:'',evt:{},cht:{},svc:[],rk:[],roles:[],units:[],ranks:[],end:[],ch:[],ev:[],ach:[],cuts:[]});
  const okStr=(x,n=120)=>typeof x==='string'&&x.length>0&&x.length<=n;
  const strArr=(a,cap=5000)=>Array.isArray(a)?[...new Set(a.filter(x=>okStr(x)))].slice(0,cap):[];
  const strMap=(o,cap=5000)=>{const r={};if(o&&typeof o==='object'&&!Array.isArray(o)){let n=0;for(const [k,v] of Object.entries(o)){if(n++>=cap)break;if(okStr(k,16)&&okStr(v,200))r[k]=v;}}return r;};
  const okInt=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max?v:0;
  function loadDex(){
    const d=blank();
    try{
      let raw=JSON.parse(store.get(DEX_KEY,'null'));
      if(!raw){const o=JSON.parse(store.get(OLD_KEY,'null'));if(o&&typeof o==='object'){ // v1 이관: 옛 업적 id를 새 id로
        const map={four:'svc4',three:'rk3'};raw={runs:o.runs,svc:o.svc,rk:o.rk,roles:o.roles,units:o.units,best:o.best,bestSvc:o.bestSvc,
          ach:strArr(o.ach).map(x=>map[x]||x).filter(x=>ACH.some(a=>a.id===x))};}}
      if(raw&&typeof raw==='object'){
        for(const k of LIST_KEYS)d[k]=strArr(raw[k]);
        d.runs=okInt(raw.runs,1e7);d.skips=okInt(raw.skips,1e7);d.unknown=okInt(raw.unknown,1e5);
        d.best=Number.isInteger(raw.best)&&raw.best>=-1&&raw.best<DEX_RANKS.length?raw.best:-1;
        d.bestSvc=SVC_IDS.includes(raw.bestSvc)?raw.bestSvc:'army';d.lastRole=okStr(raw.lastRole)?raw.lastRole:'';
        d.evt=strMap(raw.evt);d.cht=strMap(raw.cht,1000);
      }
    }catch(e){}
    return d;
  }
  let dex=loadDex();
  const saveDex=()=>store.set(DEX_KEY,JSON.stringify(dex));
  const addU=(arr,v)=>{if(v&&!arr.includes(v)){arr.push(v);return true;}return false;};

  /* 카탈로그 */
  const CAT={};
  function buildCat(){
    const tier={},sheet=[],cnt={1:0,2:0,3:0,4:0};
    for(const t of [1,2,3,4]){const hs=(DEX_CAT.ev[t]||'').split(',').filter(Boolean);cnt[t]=hs.length;for(const h of hs){tier[h]=t;sheet.push(h);}}
    let roles=0;const roleList=[];for(const sv of SV){for(const rk of ['enl','nco','off'])for(const r of sv.roles[rk]){roleList.push([sv.id,rk,r.title||r.name,sv.id+':'+r.name]);roles++;}
      for(const r of (WO[sv.id]||[])){roleList.push([sv.id,'wo',r.name,sv.id+':'+r.name]);roles++;}}
    const unitList=[],seen=new Set();for(const sv of SV)for(const u of sv.units)for(const e of (PLACES[sv.id+'.'+u.id]||[])){if(seen.has(e[0]))continue;seen.add(e[0]);unitList.push([sv.id,u.name,e[0],(UNIT_INFO[e[0]]||{}).nick||'']);}
    return{tier,sheet,cnt,tierOf:h=>tier[h]||0,roles,roleList,units:unitList.length,unitList,ranks:DEX_CAT.ranks,endings:DEX_CAT.ends.map(x=>x[0]),ends:DEX_CAT.ends,choices:DEX_CAT.choices,rate:DEX_CAT.ach,N:DEX_CAT.N};
  }

  /* 업적 아이콘: 8x8 픽셀 */
  const ICONS={
    boot:['..####..','.#....#.','.#.##.#.','.#....#.','..####..','.##..##.','##....##','........'],
    clock:['..####..','.#..#.#.','#...#..#','#...###.','#......#','.#....#.','..####..','........'],
    globe:['..####..','.#.##.#.','#.####.#','########','#.####.#','.#.##.#.','..####..','........'],
    ladder:['#......#','########','#......#','########','#......#','########','#......#','........'],
    star:['...##...','...##...','########','.######.','..####..','.##..##.','##....##','........'],
    v:['#......#','.#....#.','..#..#..','#..##..#','.#....#.','..#..#..','...##...','........'],
    knife:['......##','.....##.','....##..','...##...','.###....','.##.....','#.#.....','........'],
    leave:['...##...','..####..','.######.','...##...','...##...','.#.##.#.','..####..','........'],
    target:['.######.','#......#','#.####.#','#.#..#.#','#.####.#','#......#','.######.','........'],
    coin:['..####..','.#....#.','#..##..#','#.#....#','#..##..#','.#....#.','..####..','........'],
    heart:['.##..##.','########','########','.######.','..####..','...##...','........','........'],
    arrow:['....#...','....##..','#######.','########','#######.','....##..','....#...','........'],
    medal:['#.#..#.#','.#.##.#.','..####..','.######.','.##..##.','.######.','..####..','........'],
    x:['##....##','.##..##.','..####..','...##...','..####..','.##..##.','##....##','........'],
    q:['..####..','.#....#.','......#.','....##..','...#....','........','...#....','........']
  };
  const tok=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function iconTo(cv,name,on,color){
    const c=cv.getContext('2d'),m=ICONS[name]||ICONS.q;cv.width=10;cv.height=10;c.clearRect(0,0,10,10);
    c.fillStyle=color||(on?tok('--gold')||'#B8860B':tok('--lock')||'#999');
    m.forEach((row,j)=>[...row].forEach((ch,i)=>{if(ch==='#')c.fillRect(i+1,j+1,1,1);}));
  }
  const pctTxt=r=>r==null?'':r===0?`${(CAT.N/1e4).toFixed(0)}만 판 중 0회`:r>=0.01?`${(r*100).toFixed(1)}%`:r>=0.0001?`${(r*100).toFixed(2)}%`:`${(r*100).toFixed(3)}%`;

  /* ---------- 도감 렌더링 ---------- */
  let tab=store.get('mc-dex-tab','ach'),evTier=0,evMore=false;
  const bar=(n,t)=>`<div class="sbar"><i style="width:${t?Math.min(100,n/t*100).toFixed(1):0}%"></i></div>`;
  const evFound=t=>dex.ev.filter(h=>CAT.tierOf(h)===t).length;
  function overall(){
    const parts=[[dex.ach.length,ACH.length],[dex.ev.filter(h=>CAT.tier[h]).length,CAT.sheet.length],[dex.roles.length,CAT.roles],[dex.units.length,CAT.units],[dex.ranks.filter(r=>CAT.ranks.includes(r)).length,CAT.ranks.length],[dex.end.filter(e=>CAT.endings.includes(e)).length,CAT.endings.length],[dex.ch.length,CAT.choices.length]];
    return parts.reduce((a,[n,t])=>a+Math.min(1,n/t),0)/parts.length;
  }
  const TABS=[['ach','업적',()=>[dex.ach.length,ACH.length]],['ev','사건',()=>[dex.ev.filter(h=>CAT.tier[h]).length,CAT.sheet.length]],['roles','특기',()=>[dex.roles.length,CAT.roles]],
    ['units','부대',()=>[dex.units.length,CAT.units]],['ranks','계급장',()=>[dex.ranks.filter(r=>CAT.ranks.includes(r)).length,CAT.ranks.length]],['end','결말',()=>[dex.end.filter(e=>CAT.endings.includes(e)).length,CAT.endings.length]],['ch','선택',()=>[dex.ch.length,CAT.choices.length]]];
  function renderDex(){
    const root=document.getElementById('dexMeter');if(!root)return;
    const ov=overall();const bestRk=dex.best>=0?DEX_RANKS[dex.best]:null;
    root.innerHTML=[
      ['전체 완성도',`${(ov*100).toFixed(1)}% ${bar(ov,1)}`],
      ['입대 횟수',`${dex.runs.toLocaleString('ko-KR')}번`],
      ['복무한 군',`${dex.svc.length}/4 ${bar(dex.svc.length,4)}`],
      ['최고 계급',bestRk?`<span class="dex-best">${patchSvg(bestRk,dex.bestSvc,1)}${esc(bestRk)}</span>`:'—']
    ].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    document.getElementById('achCount').textContent=`업적 ${dex.ach.length}/${ACH.length}`;
    document.getElementById('dexTabs').innerHTML=TABS.map(([id,name,f])=>{const [n,t]=f();return `<button type="button" role="tab" data-t="${id}" aria-selected="${tab===id}"><b>${name}</b><span>${n}/${t}</span></button>`;}).join('');
    renderPanel();
  }
  const lock='<span class="lock">???</span>';
  function renderPanel(){
    const P=document.getElementById('dexPanel');if(!P)return;let h='';
    if(tab==='ach'){
      for(const t of [1,2,3,4]){
        const list=ACH.filter(a=>a.tier===t);const got=list.filter(a=>dex.ach.includes(a.id)).length;
        h+=`<div class="tier-h t${t}"><b>${ACH_TIER[t]}</b><span>${got}/${list.length}</span></div><ul class="badges">`;
        h+=list.map(a=>{const on=dex.ach.includes(a.id),hid=a.hidden&&!on,r=CAT.rate[a.id];
          const how=a.run?`무작위 플레이 ${pctTxt(r)}`:a.cum?'누적':'플레이 방식';
          return `<li class="t${t} ${on?'on':''}"><canvas data-ic="${hid?'q':a.ic}" data-on="${on?1:0}" aria-hidden="true"></canvas><div><b>${hid?'???':esc(a.t)}</b><span>${hid?'히든 업적':esc(a.d)}</span><em>${hid&&a.run?'':how}</em></div></li>`;}).join('');
        h+='</ul>';
      }
    }else if(tab==='ev'){
      const unk=dex.ev.filter(x=>!CAT.tier[x]).length;
      h+=`<div class="ev-meter">${[4,3,2,1].map(t=>`<div class="t${t}"><dt>${TIER_NAME[t]}</dt><dd>${evFound(t)}/${CAT.cnt[t]} ${bar(evFound(t),CAT.cnt[t])}</dd></div>`).join('')}<div class="t5"><dt>미기록</dt><dd>${unk}개 <small>시뮬레이션 ${(CAT.N/1e4).toFixed(0)}만 판에 한 번도 안 나온 사건</small></dd></div></div>`;
      const cutFound=CUTS.map(ct=>{const hx=dex.ev.find(x=>ct.re.test(dex.evt[x]||''));return [ct,hx];});
      h+=`<div class="cut-row"><b>컷 ${cutFound.filter(x=>x[1]).length}/${CUTS.length}</b>${cutFound.map(([ct,hx])=>hx?`<button type="button" class="cbtn" data-cut="${ct.id}" data-h="${hx}">${esc(ct.title)}</button>`:'<span class="cbtn lockc">???</span>').join('')}</div>`;
      h+=`<canvas class="sheet" id="evSheet" role="img" aria-label="사건 도감 판. 칸 하나가 사건 하나"></canvas><p class="sheet-cap">칸 하나가 사건 하나입니다. 왼쪽 위부터 흔한 순서, 색이 칠해진 칸이 겪은 사건입니다.</p>`;
      h+=`<div class="chips sm" role="group" aria-label="등급 거르기">${[[0,'전체'],[4,'전설'],[3,'희귀'],[2,'보통'],[1,'흔함'],[5,'미기록']].map(([t,n])=>`<button type="button" data-evt="${t}" aria-pressed="${evTier===t}">${n}</button>`).join('')}</div>`;
      let list=dex.ev.slice().reverse().filter(x=>evTier===0||(evTier===5?!CAT.tier[x]:CAT.tierOf(x)===evTier));
      const total=list.length;if(!evMore)list=list.slice(0,80);
      h+=list.length?`<ul class="evlist">${list.map(x=>{const t=CAT.tier[x]||5;return `<li class="t${t}"><i>${t===5?'미기록':TIER_NAME[t]}</i>${esc(dex.evt[x]||'(기록 없음)')}</li>`;}).join('')}</ul>`:'<p class="empty">아직 이 등급의 사건이 없습니다.</p>';
      if(total>list.length)h+=`<button type="button" class="cbtn" id="evMore">${total-list.length}개 더 보기</button>`;
    }else if(tab==='roles'){
      const lab={enl:'병',nco:'부사관',off:'장교',wo:'민간 준사관'};
      for(const sv of SV){const rs=CAT.roleList.filter(r=>r[0]===sv.id);const got=rs.filter(r=>dex.roles.includes(r[3])).length;
        h+=`<details class="dgrp"${got?' open':''}><summary><b>${esc(sv.name)}</b><span>${got}/${rs.length}</span></summary>`;
        for(const rk of ['enl','nco','off','wo']){const g=rs.filter(r=>r[1]===rk);if(!g.length)continue;
          h+=`<div class="utype"><b>${lab[rk]}</b><span class="tags">${g.map(r=>dex.roles.includes(r[3])?`<i class="on">${esc(r[2])}</i>`:'<i>???</i>').join('')}</span></div>`;}
        h+='</details>';}
    }else if(tab==='units'){
      for(const sv of SV){const us=CAT.unitList.filter(u=>u[0]===sv.id);const got=us.filter(u=>dex.units.includes(u[2])).length;
        h+=`<details class="dgrp"${got?' open':''}><summary><b>${esc(sv.name)}</b><span>${got}/${us.length}</span></summary><span class="tags">${us.map(u=>dex.units.includes(u[2])?`<i class="on">${esc(u[2])}${u[3]?` <small>${esc(u[3])}</small>`:''}</i>`:'<i>???</i>').join('')}</span></details>`;}
    }else if(tab==='ranks'){
      for(const sv of SV){const rs=CAT.ranks.filter(r=>r.startsWith(sv.id+':'));
        h+=`<div class="rank-row"><b>${esc(sv.name)}</b><div>${rs.map(r=>{const rk=r.split(':')[1],on=dex.ranks.includes(r);return `<span class="rk ${on?'on':''}" title="${on?esc(rk):'???'}">${patchSvg(rk,sv.id,1)}<small>${on?esc(rk):'???'}</small></span>`;}).join('')}</div></div>`;}
    }else if(tab==='end'){
      h+=`<ul class="endlist">${CAT.ends.map(([e,r])=>{const on=dex.end.includes(e),hid=!on&&r<0.01;return `<li class="${on?'on':''}"><b>${hid?'???':esc(e)}</b><span>${on||!hid?`무작위 플레이 ${pctTxt(r)}`:'히든 결말'}</span></li>`;}).join('')}</ul>`;
    }else if(tab==='ch'){
      const groups={};for(const [k,tag,r] of CAT.choices){const id=k.split('=')[0];(groups[id]=groups[id]||[]).push([k,tag,r]);}
      h+=`<p class="sheet-cap">갈림길마다 고른 답이 쌓입니다. 한 판에 모든 답을 볼 수는 없습니다.</p><div class="tags ch">${Object.values(groups).map(g=>g.map(([k,tag,r])=>dex.ch.includes(k)?`<i class="on" title="무작위 플레이 ${pctTxt(r)}">${esc(dex.cht[k]||tag)}</i>`:`<i title="무작위 플레이 ${pctTxt(r)}">???</i>`).join('')).join('<i class="sep"></i>')}</div>`;
    }
    P.innerHTML=h;
    P.querySelectorAll('canvas[data-ic]').forEach(cv=>{const li=cv.closest('li');const t=li&&[...li.classList].find(c=>/^t\d$/.test(c));iconTo(cv,cv.dataset.ic,cv.dataset.on==='1',cv.dataset.on==='1'?tok('--'+t):null);});
    if(tab==='ev')drawSheet();
  }
  function drawSheet(){
    const cv=document.getElementById('evSheet');if(!cv)return;
    const n=CAT.sheet.length,cols=Math.min(80,Math.max(40,Math.floor((cv.parentElement.clientWidth||600)/7))),rows=Math.ceil(n/cols),S=6;
    cv.width=cols*S;cv.height=rows*S;const c=cv.getContext('2d');const have=new Set(dex.ev);
    const col={1:tok('--t1'),2:tok('--t2'),3:tok('--t3'),4:tok('--t4')},off=tok('--rule');
    CAT.sheet.forEach((h,i)=>{const x=(i%cols)*S,y=Math.floor(i/cols)*S;c.fillStyle=have.has(h)?col[CAT.tier[h]]:off;c.fillRect(x,y,S-1,S-1);});
  }
  function bindDex(){
    const T=document.getElementById('dexTabs'),P=document.getElementById('dexPanel');if(!T)return;
    T.addEventListener('click',e=>{const b=e.target.closest('button[data-t]');if(!b)return;tab=b.dataset.t;store.set('mc-dex-tab',tab);evMore=false;
      T.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected',String(x===b)));renderPanel();});
    P.addEventListener('click',e=>{const cb=e.target.closest('button[data-cut]');if(cb){const ct=CUTS.find(x=>x.id===cb.dataset.cut);if(ct)openCut(ct,dex.evt[cb.dataset.h]||'',dex.bestSvc,false);return;}
      const b=e.target.closest('button[data-evt]');if(b){evTier=+b.dataset.evt;evMore=false;renderPanel();return;}
      if(e.target.id==='evMore'){evMore=true;renderPanel();}});
  }
  function unlock(id){if(dex.ach.includes(id))return null;dex.ach.push(id);return ACH.find(a=>a.id===id);}
  function checkAch(f,u){
    const got=[];const ctx2={...CAT};
    for(let pass=0;pass<2;pass++)for(const a of ACH){if(dex.ach.includes(a.id))continue;
      let ok=false;try{ok=a.run?(f&&a.run(f)):a.cum?a.cum(dex,ctx2):a.ui?(f&&u&&a.ui(u,f)):false;}catch(e){ok=false;}
      if(ok){const x=unlock(a.id);if(x)got.push(x);}}
    return got;
  }
  /* 판이 끝날 때 */
  function record(G,u){
    const f=runFacts(G);
    const before={roles:dex.roles.length,units:dex.units.length,ranks:dex.ranks.length,end:dex.end.length,ch:dex.ch.length};
    dex.runs++;for(const s of f.svcs)addU(dex.svc,s);addU(dex.rk,f.rk);
    for(const r of f.roles)addU(dex.roles,r);for(const x of f.units)addU(dex.units,x);for(const r of f.ranks)addU(dex.ranks,r);
    addU(dex.end,f.ending);
    for(const [k,t] of f.choices){if(addU(dex.ch,k)&&t)dex.cht[k]=t;}
    const fresh=[];for(const h of f.evKeys){if(addU(dex.ev,h)){dex.evt[h]=f.evText[h].slice(0,200);if(!CAT.tier[h])dex.unknown++;fresh.push(h);}}
    if(f.fri>dex.best){dex.best=f.fri;dex.bestSvc=G.svNow||f.svc;}
    u.sameRole=!!dex.lastRole&&dex.lastRole===f.roles[0];dex.lastRole=f.roles[0];
    const got=checkAch(f,u);
    saveDex();renderDex();
    const delta={ev:fresh.length,roles:dex.roles.length-before.roles,units:dex.units.length-before.units,ranks:dex.ranks.length-before.ranks,end:dex.end.length-before.end,ch:dex.ch.length-before.ch};
    return{got,fresh,f,delta};
  }
  /* ---------- 전역 화면 ---------- */
  const STAR=/^(준장|소장|중장|대장)$/;
  const ro2=w=>{const c=w.charCodeAt(w.length-1)-0xAC00;return c>=0&&c%28&&c%28!==8?'으로':'로';};
  function headline(f,days){
    const y=Math.max(1,Math.round(f.years)),fr=f.fr||'병장';
    if(f.endK==='prison')return'국군교도소의 문이 닫혔다';
    if(f.endK==='sanggeun')return'아버지가 되어 집으로';
    if(f.ending==='의병 전역')return'다친 몸으로 군문을 나서다';
    if(f.ending==='가사 전역')return'가족 곁으로 돌아가다';
    if(f.ending==='현역복무 부적합 전역')return'끝내 맞지 않던 군복';
    if(STAR.test(fr))return`${y}년, 별을 달고 떠나다`;
    if(f.sw)return`이등병에서 ${fr}까지`;
    if(f.ending==='정년 전역')return`${y}년, 정년의 끝까지`;
    if(f.ending==='명예 전역')return`${y}년, 명예롭게 군복을 벗다`;
    if(f.ending==='희망 전역')return`${y}년, 스스로 문을 열고 나서다`;
    if(f.isEnl)return`${days.toLocaleString('ko-KR')}일, 마침내 민간인`;
    return`${y}년, ${fr}${ro2(fr)} 전역`;
  }
  const RANK_RE=new RegExp('('+DEX_RANKS.join('|')+')','g');
  const glow=t=>esc(t).replace(/(\d[\d,.]*\s*(?:년|개월|번|일|만 원|명))/g,'<b>$1</b>').replace(RANK_RE,'<b>$1</b>');
  function renderEpic(G,f,got){
    const L=f.isEnl?G.life:G.clife;const start=G.life.start,end=(L&&L.end)||G.life.end;
    const days=Math.max(1,dayDiff(start,end));
    const top=got.slice().sort((a,b)=>b.tier-a.tier)[0];
    const sumEl=document.getElementById('summary');const sentence=sumEl.textContent;
    document.getElementById('epicEye').textContent=`${document.getElementById('rNo').textContent} · ${document.getElementById('rName').textContent}`;
    document.getElementById('epicIns').innerHTML=f.fr&&rankSym(f.fr)?patchSvg(f.fr,G.svNow||f.svc,2.2):'';
    document.getElementById('epicTitle').textContent=headline(f,days);
    sumEl.innerHTML=glow(sentence);
    document.getElementById('epicMeta').innerHTML=[`<span>${fmtD(start)} 입대</span>`,`<span>${fmtD(end)} ${esc(f.stamp)}</span>`,`<span>복무 ${days.toLocaleString('ko-KR')}일</span>`,top?`<span class="t${top.tier}">칭호 「${esc(top.t)}」</span>`:''].filter(Boolean).join('');
    const ep=document.getElementById('epic');ep.classList.remove('show');void ep.offsetWidth;ep.classList.add('show');
    return{days,title:top?top.t:'',head:headline(f,days),sentence};
  }
  function renderPicks(list){
    const w=document.getElementById('picksWrap'),ol=document.getElementById('picksList');const old=document.getElementById('picks');if(old)old.hidden=true;
    if(!w)return;w.hidden=!list.length;
    const SHOW=6;
    ol.innerHTML=list.map((p,i)=>`<li class="${p.auto?'auto':''}${i>=SHOW?' more':''}"><time>${fmtYM(p.d)}</time><div><p>${esc(p.q)}</p><b>${esc(p.a)}</b>${p.auto?'<small>자동</small>':''}</div></li>`).join('');
    const btn=document.getElementById('picksMore');ol.classList.remove('open');
    if(btn){btn.hidden=list.length<=SHOW;btn.textContent=`나머지 ${list.length-SHOW}개 펼치기`;btn.onclick=()=>{const o=ol.classList.toggle('open');btn.textContent=o?'접기':`나머지 ${list.length-SHOW}개 펼치기`;};}
  }
  function renderRunAch(got,delta,finds){
    const w=document.getElementById('runAch');if(!w)return;
    const ul=document.getElementById('runAchList');
    ul.innerHTML=got.length?got.sort((a,b)=>b.tier-a.tier).map(a=>`<li class="t${a.tier} on"><canvas data-ic="${a.ic}" aria-hidden="true"></canvas><div><b>${esc(a.t)}</b><span>${esc(a.d)}</span><em>${ACH_TIER[a.tier]}${a.hidden?' · 히든':''}</em></div></li>`).join(''):'<li class="none">이번 복무에서 새로 딴 업적이 없습니다.</li>';
    ul.querySelectorAll('canvas').forEach(cv=>{const t=[...cv.closest('li').classList].find(c=>/^t\d$/.test(c));iconTo(cv,cv.dataset.ic,true,tok('--'+t));});
    const parts=[[delta.ev,'사건'],[delta.roles,'특기'],[delta.units,'부대'],[delta.ranks,'계급장'],[delta.end,'결말'],[delta.ch,'선택']].filter(x=>x[0]>0).map(([n,k])=>`<span><b>+${n}</b> ${k}</span>`);
    document.getElementById('runDex').innerHTML=(parts.length?parts.join(''):'<span>새로 채운 도감 칸이 없습니다</span>')+(finds?`<span class="hl">${esc(finds)} 발견</span>`:'');
    w.hidden=false;
  }
  function renderShare(G,f,ep,got,picks){
    const ta=document.getElementById('shareTxt');const st=G.stats;
    const statTxt=SKEYS.map(k=>`${SNAME[k]} ${st[k]}`).join(' · ');
    const mates=(G.mates||[]).map(m=>{const x=mateLine(m.ctx,m.life);return `${x.who} (${x.res})`;});
    const cmp=document.getElementById('compare').textContent.trim();
    const man=picks.filter(p=>!p.auto).length;
    const rows=[['능력치',statTxt],f.liquid?['전역 자금',`약 ${f.liquid.toLocaleString('ko-KR')}만 원`]:null,picks.length?['갈림길',`${picks.length}번${man<picks.length?` (직접 ${man} · 자동 ${picks.length-man})`:' 모두 직접 선택'}`]:null,got.length?['업적',got.map(a=>a.t).join(', ')]:null,cmp?['비교',cmp]:null].filter(Boolean);
    const head=`${document.getElementById('rName').textContent} · ${f.fr||''} ${f.stamp}`.replace(/\s+/g,' ');
    const lines=[`[국방부 시계] ${head}`,`「${ep.head}」`,ep.sentence,'',...rows.map(([k,v])=>`▸ ${k}: ${v}`)];
    if(mates.length)lines.push('',`▸ 같은 날 입대한 4명`,...mates.map(m=>`  - ${m}`));
    lines.push('','너는 45만 명 중 누구로 입대할까? #국방부시계');
    ta.value=lines.join('\n');ta.rows=Math.min(18,lines.length+1);
    document.getElementById('shareCard').innerHTML=`<div class="sc-head">국방부 시계 · ${esc(head)}</div><div class="sc-title">${esc(ep.head)}</div><p class="sc-sum">${glow(ep.sentence)}</p><dl>${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><div class="sc-tag">#국방부시계</div>`;
  }
  /* ---------- 컷: 특별한 사건을 처음 겪을 때 뜨는 240×240 픽셀 그림 ---------- */
  const CUTS=[
    {id:'star1',re:/^준장으로 진급했다/,title:'첫 번째 별',n:1},
    {id:'star2',re:/^소장으로 진급했다/,title:'두 번째 별',n:2},
    {id:'star3',re:/^중장으로 진급했다/,title:'세 번째 별',n:3},
    {id:'star4',re:/^대장으로 진급했다/,title:'네 개의 별',n:4},
    {id:'hell',re:/지옥주를 버텨냈다|지옥주를 버티고|혹독한 지옥주/,title:'지옥주'},
    {id:'halo',re:/고공강하 교육을 수료/,title:'고공강하'},
    {id:'jsa',re:/판문점 경계 근무|판문점을 찾은 탐방객|판문점 견학 안내|판문점 방문 의전|JSA경비대대에 자대/,title:'판문점'},
    {id:'remains',re:/유해 발굴 현장|수습한 유품|발굴된 유품|유해발굴감식단에 자대/,title:'돌아오지 못한 이름'},
    {id:'uxo',re:/불발탄 신고|대민 불발탄|불발탄 처리 출동/,title:'불발탄 출동'},
    {id:'prison',re:/국군교도소에 수감/,title:'국군교도소'},
    {id:'sanggeun',re:/상근예비역으로 편입/,title:'아빠는 상근'}
  ];
  const cutFor=t=>CUTS.find(c=>c.re.test(t||''));
  const SVC_COL={army:'#56632F',navy:'#1E3F73',air:'#2B6CB0',marine:'#B42318'};
  function CutPlayer(cv){
    const c=cv.getContext('2d');cv.width=240;cv.height=240;let T=0,timer=null,cut=null,svc='army',parts=[];
    const r=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x|0,y|0,Math.max(1,w|0),Math.max(1,h|0));};
    const grad=(a,b,y0=0,y1=240)=>{const g=c.createLinearGradient(0,y0,0,y1);g.addColorStop(0,a);g.addColorStop(1,b);c.fillStyle=g;c.fillRect(0,y0,240,y1-y0);};
    const star=(cx,cy,R,col)=>{c.fillStyle=col;c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?R*0.42:R;c.lineTo(cx+rr*Math.cos(a),cy+rr*Math.sin(a));}c.closePath();c.fill();};
    function stars(n){
      grad('#070B1E','#1E2A55');
      c.save();c.translate(120,112);c.rotate(T/90);for(let i=0;i<16;i++){c.rotate(Math.PI/8);c.fillStyle=i%2?'rgba(242,194,48,.10)':'rgba(242,194,48,.04)';c.beginPath();c.moveTo(0,0);c.lineTo(160,-14);c.lineTo(160,14);c.closePath();c.fill();}c.restore();
      if(n===4){c.globalAlpha=.55;c.fillStyle='#C8102E';c.beginPath();c.arc(120,112,62,Math.PI,0);c.fill();c.fillStyle='#003478';c.beginPath();c.arc(120,112,62,0,Math.PI);c.fill();c.globalAlpha=1;}
      const col=SVC_COL[svc]||SVC_COL.army;
      r(36,92,168,44,'#141414');r(38,94,164,40,col);r(38,94,164,4,'rgba(255,255,255,.12)');c.fillStyle='#C9A227';c.beginPath();c.arc(194,114,6,0,Math.PI*2);c.fill();
      const xs=Array.from({length:n},(_,i)=>110-(n-1)*17+i*34);
      xs.forEach((x,i)=>{const t0=14+i*14,k=Math.max(0,Math.min(1,(T-t0)/6));if(k<=0)return;
        star(x,114,14*k+(k<1?4*(1-k):0),'#EEF1F5');star(x,114,7*k,'#FFFFFF');
        if(T===t0+1)for(let j=0;j<18;j++){const a=j/18*Math.PI*2;parts.push({x,y:114,vx:Math.cos(a)*2.2,vy:Math.sin(a)*2.2,l:18,col:'#FFF3B8'});}});
      if(T>14+n*14+6&&T%3===0)parts.push({x:Math.random()*240,y:-4,vx:(Math.random()-.5)*.6,vy:1+Math.random(),l:200,col:['#F2C230','#EEF1F5','#C8102E','#3E7CC4'][T%4]});
      r(0,196,240,44,'#0A0F24');for(let i=0;i<9;i++){const x=12+i*26;r(x,182,6,14,'#05070F');r(x+1,178,4,4,'#05070F');}
    }
    function hell(){
      grad('#232650','#F08A5D',0,128);const sy=120-Math.min(40,T*0.6);c.fillStyle='#FFD08A';c.beginPath();c.arc(172,sy,16,0,Math.PI*2);c.fill();
      grad('#1D3F66','#0C2238',124,186);for(let i=0;i<24;i++){const x=(i*37+T*2)%260-10,y=130+(i*13)%52;r(x,y,8,1,'rgba(255,255,255,.35)');}
      r(0,124,240,2,'#FFB27A');grad('#7A6A4C','#C9B48A',186,240);
      const fx=(T*1.2+40)%320-80,bob=Math.round(Math.sin(T/2)*1.5);
      r(fx-4,150+bob,78,7,'#0A0A0A');r(fx-6,152+bob,82,3,'#0A0A0A');
      for(let i=0;i<6;i++){const x=fx+i*12,leg=Math.floor((T+i*2)/3)%2;r(x+2,156,5,4,'#0A0A0A');r(x+1,160,7,12,'#0A0A0A');r(x+1+(leg?0:3),172,3,10,'#0A0A0A');r(x+4-(leg?0:3),172,3,10,'#0A0A0A');}
      if(T%4===0)for(let j=0;j<5;j++)parts.push({x:fx+Math.random()*80,y:186,vx:(Math.random()-.5)*1.5,vy:-1.5-Math.random()*1.5,l:14,col:'#E8F4FF',g:.15});
      for(let i=0;i<6;i++){const x=(i*47-T*1.2+480)%260-10;r(x,186,20,2,'rgba(255,255,255,.7)');}
    }
    function halo(){
      grad('#050A2A','#5D7FB8');for(let i=0;i<30;i++)r((i*53)%240,(i*29)%90,1,1,'rgba(255,255,255,.5)');
      const open=T>48,sp=open?0.8:3.2;
      for(let i=0;i<9;i++){const y=((i*41-T*sp*(1+i%3*.3))%300+300)%300-40,x=(i*67)%240-30;c.fillStyle=`rgba(235,240,250,${.35+(i%3)*.2})`;c.beginPath();c.ellipse(x+40,y,48,10,0,0,Math.PI*2);c.fill();}
      if(T<26){const px=40-T*3,py=30-T*1.2;r(px,py,90,16,'#5C636E');r(px+90,py+4,20,8,'#4A5059');r(px+20,py-6,40,6,'#4A5059');r(px+86,py+16,26,4,'#2E3238');for(let e=0;e<4;e++){const ex=px+24+e*9;r(ex,py-8,3,3,'#3A3F47');if(T%2)r(ex-2,py-7,7,1,'#222');else r(ex+1,py-11,1,7,'#222');}}
      const jx=110+Math.sin(T/9)*10,jy=open?118:Math.min(118,30+T*4);
      if(open){const k=Math.min(1,(T-48)/8),cw=Math.round(42*k+8),cx=Math.round(jx+6-cw/2),cy=jy-38;
        for(let i=0;i<7;i++){const x0=cx+Math.round(i*cw/7),x1=cx+Math.round((i+1)*cw/7);r(x0,cy,x1-x0,6,i%2?'#4E5A2A':'#5E6B35');}
        r(cx,cy,cw,1,'#6E7B45');r(cx,cy+6,cw,1,'#3C4520');
        c.strokeStyle='rgba(30,30,30,.8)';c.lineWidth=1;c.beginPath();for(let i=0;i<=4;i++){c.moveTo(cx+i*cw/4,cy+7);c.lineTo(jx+(i<2?4:8),jy);}c.stroke();
        r(jx+3,jy,6,6,'#2E3238');r(jx+4,jy+6,4,8,'#4E5A2A');r(jx+3,jy+14,2,5,'#222');r(jx+7,jy+14,2,5,'#222');}
      else{r(jx-6,jy,24,5,'#4E5A2A');r(jx+16,jy-1,5,5,'#2E3238');r(jx-10,jy-3,6,2,'#4E5A2A');r(jx-10,jy+6,6,2,'#4E5A2A');r(jx+4,jy-4,8,4,'#2E3238');}
      if(T>70){const h=Math.min(60,(T-70)*1.2),top=240-h,F=['#4E6B3A','#6B8A4A','#8AA05C','#5D7A42','#A3A86A'];
        for(let j=0;j<4;j++)for(let i=0;i<9;i++){const x=i*28+(j%2)*12-12,y=top+j*16;r(x,y,26,15,F[(i*3+j)%5]);}
        for(let x=0;x<240;x+=2){const y=top+18+Math.round(Math.sin(x/22)*6+x*0.08);if(y<240)r(x,y,2,3,'#5B8FC9');}
        for(let i=0;i<5;i++){const x=150+i*8,y=top+40;if(y<236)r(x,y,5,4,i%2?'#B8432E':'#D9D2C2');}}
    }
    /* 큰 사람: 장면 스프라이트를 s배로 */
    function big(map,x,y,sc,pal,flip){for(let j=0;j<map.length;j++){const row=map[j];for(let i=0;i<row.length;i++){const k=row[flip?row.length-1-i:i];if(k==='.')continue;const col=pal[k];if(col)r(x+i*sc,y+j*sc,sc,sc,col);}}}
    const SOLP=(u,h)=>({h:h||u,u,c:u,s:P.skin,b:'#2A2620',p:u,k:'#1A1712'});
    function jsa(){
      grad('#9DC3E0','#D8E8F0',0,150);
      r(0,150,240,90,'#9A9C98');for(let i=0;i<40;i++)r((i*61)%240,150+(i*37)%90,2,1,'#8A8C88');
      for(let i=0;i<3;i++){const x=40+i*58;r(x,96,44,54,'#4B7BBF');r(x-3,90,50,7,'#3E6AA6');r(x+16,124,12,26,'#2E4F80');r(x+4,106,10,8,'#BFE3F2');r(x+30,106,10,8,'#BFE3F2');}
      r(0,170,240,3,'#C9CBC6');r(0,173,240,1,'#7E807C');
      r(20,60,1,90,'#D0D0D0');const w=Math.floor(T/5)%2;r(21,60,14,9,'#F4F4F4');r(26+w,62,4,4,'#C8102E');r(26+w,64,4,2,'#003478');
      r(196,128,3,10,'#55585E');r(195,124,5,5,'#55585E');
      big(SOL,128,152,6,SOLP('#3E4A30','#2E3420'));r(140,165,24,4,'#0A0A0A');if(T%30<3)r(142,165,4,2,'#FFFFFF');
    }
    function remains(){
      grad('#C9A27A','#E7C9A0',0,90);
      for(let x=0;x<240;x++){const h=60+Math.sin(x/30)*10+x*0.15;r(x,h,1,240-h,'#7A5A3A');}
      c.strokeStyle='rgba(244,241,228,.55)';c.lineWidth=1;for(let i=0;i<5;i++){c.beginPath();c.moveTo(30+i*40,120);c.lineTo(30+i*40,220);c.stroke();}for(let j=0;j<4;j++){c.beginPath();c.moveTo(30,120+j*33);c.lineTo(190,120+j*33);c.stroke();}
      for(let i=0;i<6;i++){const x=34+(i*53)%150,y=124+(i*29)%90;r(x,y-8,1,8,'#D0D0D0');r(x+1,y-8,4,3,'#C8102E');}
      r(98,178,22,10,'#5E6B4A');r(102,172,14,7,'#5E6B4A');r(100,184,18,2,'#4A3A28');
      r(128,182,8,12,'#6B6B5A');r(130,180,4,2,'#4A4A3A');
      big(SOL.slice(0,9),150,150,4,SOLP('#4E5A2A'));r(146,186,10,2,'#8A6A40');if(T%16<8)r(140,190,3,1,'#D9C8A8');
      if(T>40){const k=Math.min(1,(T-40)/16);c.globalAlpha=k;r(14,200,64,6,'#5A4128');r(16,180,60,22,'#F4F4F4');r(16,200,60,2,'#D8D8D8');c.fillStyle='#C8102E';c.beginPath();c.arc(46,191,8,Math.PI,0);c.fill();c.fillStyle='#003478';c.beginPath();c.arc(46,191,8,0,Math.PI);c.fill();c.globalAlpha=1;}
      if(T%5===0)parts.push({x:Math.random()*240,y:-4,vx:.6,vy:.9,l:240,col:['#C7782E','#A0522D','#D9A441'][T%3]});
    }
    function uxo(){
      grad('#8FB5D0','#D7E6EC',0,110);
      for(let j=0;j<10;j++)r(0,110+j*13,240,13,j%2?'#6B8A4A':'#7A6A48');
      const blink=Math.floor(T/4)%2;r(8,96,40,18,'#4E5A2A');r(48,102,14,12,'#4E5A2A');r(14,92,6,4,blink?'#FF3B30':'#7A1A16');r(26,92,6,4,blink?'#3E7CC4':'#1A2A4A');r(12,114,8,5,'#222');r(42,114,8,5,'#222');
      for(let x=70;x<230;x+=6)r(x,150+Math.sin(x/12)*2,4,2,x%12?'#F2C230':'#111');
      for(let x=70;x<230;x+=40)r(x,140,2,14,'#E8E2C8');
      c.save();c.translate(170,186);c.rotate(-.3);r(-18,-5,30,10,'#7A4A2A');r(12,-4,8,8,'#5A3A22');r(-24,-3,6,6,'#8A5A3A');c.restore();
      const ex=Math.min(128,70+T*1.1),bob=T%10<5?0:1;
      r(ex-3,150+bob,32,36,'#5E6B35');r(ex-1,152+bob,28,32,'#6E7B45');r(ex+4,160+bob,18,14,'#4E5A2A');
      r(ex-1,148+bob,28,6,'#3C4520');
      r(ex+1,128+bob,24,22,'#4E5A2A');r(ex+3,126+bob,20,3,'#4E5A2A');r(ex+4,133+bob,18,11,'#10202E');r(ex+5,134+bob,16,1,'#5D7FB8');if(T%20<4)r(ex+7,136+bob,5,3,'#9FD4FF');
      r(ex-8,154+bob,7,22,'#5E6B35');r(ex+27,154+bob,7,22,'#5E6B35');r(ex-8,176+bob,7,4,'#222');r(ex+27,176+bob,7,4,'#222');
      r(ex+1,186,10,12,'#5E6B35');r(ex+15,186,10,12,'#5E6B35');r(ex,196,12,3,'#222');r(ex+14,196,12,3,'#222');
      if(T>50&&T%16<8){c.fillStyle='rgba(242,194,48,.18)';c.beginPath();c.arc(170,186,30,0,Math.PI*2);c.fill();}
    }
    function prison(){
      r(0,0,240,240,'#3A3D42');r(0,190,240,50,'#2C2E32');
      r(150,40,40,30,'#1C1E22');r(152,42,36,26,'#5A6B8A');for(let i=0;i<4;i++)r(158+i*9,42,2,26,'#1C1E22');
      c.fillStyle='rgba(200,215,240,.16)';c.beginPath();c.moveTo(152,68);c.lineTo(188,68);c.lineTo(130+Math.sin(T/30)*6,200);c.lineTo(70+Math.sin(T/30)*6,200);c.closePath();c.fill();
      r(30,160,110,10,'#55585E');r(30,170,6,24,'#44474C');r(134,170,6,24,'#44474C');r(34,152,30,8,'#6E7178');
      big(SOL.slice(0,9),70,118,5,SOLP('#5F646C','#3A3D42'));
      for(let x=0;x<240;x+=22){r(x,0,5,240,'#16181B');r(x+1,0,1,240,'#4A4E54');}
      r(0,28,240,5,'#16181B');r(0,206,240,5,'#16181B');
      c.fillStyle='rgba(20,22,26,.25)';c.fillRect(0,0,240,240);
    }
    function sanggeun(){
      grad('#F6E3C2','#EBC896');
      r(150,30,60,70,'#FFF4D8');r(150,30,60,4,'#C9A87A');r(178,30,4,70,'#C9A87A');r(150,64,60,4,'#C9A87A');
      c.fillStyle='rgba(255,236,180,.35)';c.beginPath();c.moveTo(150,100);c.lineTo(210,100);c.lineTo(160,230);c.lineTo(60,230);c.closePath();c.fill();
      r(0,200,240,40,'#B98A5A');for(let x=0;x<240;x+=30)r(x,200,1,40,'#A47648');
      r(24,40,2,6,'#7A5A3A');r(14,46,24,40,'#5D6B35');r(18,46,16,6,'#4E5A2A');r(22,58,2,2,'#EFC75E');
      r(90,150,90,40,'#E8D5B0');for(let x=92;x<180;x+=8)r(x,128,3,26,'#E8D5B0');r(90,126,90,4,'#E8D5B0');r(90,190,4,14,'#C9B08A');r(176,190,4,14,'#C9B08A');
      r(116,140,30,12,'#F4F4F4');r(140,138,10,10,P.skin);r(143,141,1,1,'#2A2620');r(146,141,1,1,'#2A2620');if(T%40<20){r(144,145,2,1,'#C8102E');}
      big(SOL,44,140,5,SOLP('#5D6B35','#3A2A20'));
      if(T%14===0)parts.push({x:150,y:130,vx:(Math.random()-.5)*.4,vy:-.5,l:40,col:'#E25A7A'});
    }
    function draw(){
      T++;if(!cut)return;
      if(cut.n)stars(cut.n);else{const f={hell,halo,jsa,remains,uxo,prison,sanggeun}[cut.id];if(f)f();}
      for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx;p.y+=p.vy;if(p.g)p.vy+=p.g;if(--p.l<=0||p.y>244){parts.splice(i,1);continue;}r(p.x,p.y,2,2,p.col);}
    }
    return{play(ct,sv){cut=ct;svc=sv||'army';T=0;parts=[];clearInterval(timer);if(RM){T=80;draw();return;}draw();timer=setInterval(draw,1000/12);},stop(){clearInterval(timer);timer=null;}};
  }
  let cutPlayer=null,cutResume=null,cutAuto=null;
  function openCut(ct,text,svc,fromGame){
    const box=document.getElementById('cut');if(!box)return;
    cutPlayer=cutPlayer||CutPlayer(document.getElementById('cutCv'));
    document.getElementById('cutTitle').textContent=ct.title;document.getElementById('cutText').textContent=text;
    document.getElementById('cutTag').textContent=fromGame?'처음 겪는 순간':'다시 보기';
    box.hidden=false;cutPlayer.play(ct,svc);SFX.ach();buzz([20,40,20,40,60]);
    cutResume=null;if(fromGame&&typeof paused!=='undefined'&&!paused){setPaused(true);cutResume=true;}
    clearTimeout(cutAuto);if(fromGame&&typeof autoOn!=='undefined'&&autoOn)cutAuto=setTimeout(closeCut,5200);
    setTimeout(()=>{const b=document.getElementById('cutClose');if(b)b.focus({preventScroll:true});},50);
  }
  function closeCut(){
    const box=document.getElementById('cut');if(!box||box.hidden)return;box.hidden=true;if(cutPlayer)cutPlayer.stop();clearTimeout(cutAuto);
    if(cutResume){cutResume=null;setPaused(false);}
  }
  /* ---------- 상태 레이어: 사건 문장이 상태를 켜고 끈다 ---------- */
  const PROPS=[['k9',/군견|수의/],['band',/군악/],['chef',/조리|취사|급양/],['medic',/의무|간호|군의|약제|응급구조|임상|방사선|치과|치의/],['mp',/군사경찰|^MC|특임군사|특수임무군사/],
    ['honor',/의장|33경호/],['heli',/헬기|회전익|항공구조/],['jetmx',/항공기정비|항공정비|항공기제작|무장|항공전자|항공장구|비행제어/],['truck',/운전병|수송|견인차량|구급차량|대형버스/],
    ['comms',/통신|전산|사이버|네트워크|위성|TICN|C4I|SW개발|정보보호|암호/],['artillery',/포병|자주포|다련장|화포/]];
  const PROP_NAME={k9:'군견 동행',band:'군악',chef:'조리',medic:'의무',mp:'군사경찰',honor:'의장',heli:'헬기',jetmx:'항공정비',truck:'수송',comms:'통신',artillery:'포병'};
  const propOf=G=>{const c=G.cctx||G.ctx;const n=(c.role&&(c.role.name+' '+(c.role.title||'')))||'';for(const [id,re] of PROPS)if(re.test(n))return id;return '';};
  const blankSt=()=>({prop:'',cat:0,dog:0,gf:0,spouse:0,kids:0,weekend:0,deploy:'',dtmp:0,car:0,hurt:0,rank:'',fit:0,iq:0,mind:50});
  function updateState(st,e,G){
    const t=e.text||'';
    if(/고양이가 생활관 앞에서 기다리게|고양이는 부대 마스코트가 됐다/.test(t))st.cat=1;
    if(/고양이는 어느새 다른 곳으로 떠났다/.test(t))st.cat=0;
    if(/강아지를 입양/.test(t))st.dog=1;
    if(/사귀게 됐다|연애를 시작했다/.test(t))st.gf=1;
    if(/이별 통보|헤어졌다/.test(t))st.gf=0;
    if(/^결혼했다/.test(t)){st.spouse=1;st.gf=0;}
    if(/이혼했다/.test(t)){st.spouse=0;st.weekend=0;}
    if(/첫아이가 태어났다|아이가 태어났다|둘째가 태어났다/.test(t))st.kids=Math.min(2,st.kids+1);
    if(/주말부부/.test(t))st.weekend=1;
    if(/파병을 떠났다/.test(t))st.deploy=/청해/.test(t)?'sea':'desert';
    if(/파병을 마치고 돌아왔다/.test(t))st.deploy='';
    if(/파견에 다녀왔다/.test(t)&&!/청해/.test(t)){st.deploy='desert';st.dtmp=2;}else if(st.dtmp>0&&--st.dtmp===0)st.deploy='';
    if(/첫 차를 뽑/.test(t))st.car=1;
    if(st.hurt>0)st.hurt--;
    if(/다쳐|골절|삐끗|접질려|깁스/.test(t)&&!/집도/.test(t))st.hurt=5;
    if(G.ctx.rk==='enl'&&!G.life.switched)st.gf=G.gf==='dating'?1:st.gf&&G.gf!=='none'?1:0;
    st.prop=propOf(G);st.rank=G.curRk||st.rank;const S=G.stats||{};st.fit=S.fit|0;st.iq=S.iq|0;st.mind=S.mind==null?50:S.mind;
    return st;
  }
  function stateTags(st){
    return [st.deploy==='desert'?'파병 중':st.deploy==='sea'?'청해부대':'',st.spouse?(st.weekend?'주말부부':'기혼'):st.gf?'연애 중':'',st.kids?`자녀 ${st.kids}`:'',st.cat?'부대 고양이':'',st.dog?'반려견':'',st.car?'자차':'',st.hurt>0?'부상':'',st.mind<30?'멘탈 바닥':''].filter(Boolean);
  }
  function hudLeft(dateTxt,G){
    const rk=G&&G.curRk,svc=(G&&(G.svNow||G.ctx.sv.id))||'army';
    document.getElementById('sceneDate').innerHTML=(rk&&rankSym(rk)?`<span class="hud-rk">${patchSvg(rk,svc,0.8)}<b>${esc(rk)}</b></span>`:'')+`<span>${esc(dateTxt)}</span>`;
  }
  function applySnap(sn){
    if(scene)scene.set({...sn.sc,st:{...sn.sc.st}});
    document.getElementById('sceneDate').innerHTML=(sn.rk&&rankSym(sn.rk)?`<span class="hud-rk">${patchSvg(sn.rk,sn.psvc,0.8)}<b>${esc(sn.rk)}</b></span>`:'')+`<span>${esc(sn.date)}</span>`;
    document.getElementById('sceneLoc').innerHTML=`<b>${esc(sn.loc)}</b>${sn.tags.length?`<small>${esc(sn.tags.join(' · '))}</small>`:''}`;
  }
  /* ---------- 사건 아이콘 (로그 줄 앞) ---------- */
  const LOGIC={leave:'leave',range:'target',money:'coin',love:'heart',boot:'boot',final:'medal',field:'arrow',guard:'clock',study:'ladder',snow:'globe'};

  /* ---------- 공개 훅 ---------- */
  let scene=null,hero=null,lastKind='barracks';
  return{
    init(){
      const hc=document.getElementById('heroScene');if(hc){hero=Scene(hc);hero.set({svc:'army',kind:'idle',tod:'day',season:seasonOf(new Date())});hero.start();}
      const sc=document.getElementById('scene');if(sc){scene=Scene(sc);}
      const sb=document.getElementById('sndBtn');
      const paint=()=>{sb.setAttribute('aria-pressed',String(sound));sb.textContent=sound?'소리 켬':'소리';};
      if(sb){paint();sb.addEventListener('click',()=>{sound=!sound;store.set('mc-sound',sound?'1':'0');paint();if(sound)SFX.pick();});}
      const rb=document.getElementById('dexReset'),rc=document.getElementById('dexResetYes'),rn=document.getElementById('dexResetNo'),rq=document.getElementById('dexResetQ');
      if(rb){rb.addEventListener('click',()=>{rb.hidden=true;rq.hidden=false;});
        rn.addEventListener('click',()=>{rq.hidden=true;rb.hidden=false;});
        rc.addEventListener('click',()=>{dex=blank();saveDex();store.set(OLD_KEY,'null');renderDex();rq.hidden=true;rb.hidden=false;});}
      Object.assign(CAT,buildCat());
      const log=document.getElementById('log');const self=this;
      const tl=document.getElementById('toLatest');
      if(tl){tl.addEventListener('click',()=>{const last=log.lastElementChild;if(last)last.scrollIntoView({block:'nearest',behavior:RM?'auto':'smooth'});tl.hidden=true;self.forceUntil=Date.now()+1500;});
        addEventListener('scroll',()=>{if(tl.hidden)return;const last=log.lastElementChild;if(!last||last.getBoundingClientRect().top<innerHeight)tl.hidden=true;},{passive:true});}
      const pick=e=>{const li=e.target.closest('li[data-snap]');if(!li||e.target.closest('button'))return;self.replay(+li.dataset.snap);};
      log.addEventListener('click',pick);log.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(e);}});
      document.getElementById('rpBack').addEventListener('click',()=>self.exitReplay(false));
      document.getElementById('rpPrev').addEventListener('click',()=>{if(self.rp)self.replay(self.rp.i-1);});
      document.getElementById('rpNext').addEventListener('click',()=>{if(self.rp)self.replay(self.rp.i+1);});
      document.getElementById('pauseBtn').addEventListener('click',()=>{if(self.rp){self.rp.paused=false;self.exitReplay(false);}},true);
      if(store.get('mc-rp-hint','0')==='1'){const h=document.getElementById('rpHint');if(h)h.hidden=true;}
      const cc=document.getElementById('cutClose');if(cc){cc.addEventListener('click',closeCut);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCut();});
        document.getElementById('cut').addEventListener('click',e=>{if(e.target.id==='cut')closeCut();});}
      bindDex();renderDex();
    },
    onStart(G){
      if(hero)hero.stop();
      const ctx=G.ctx,d=G.life.start;lastKind=ctx.rk==='enl'?'boot':'barracks';
      if(scene){scene.set({svc:ctx.sv.id,kind:lastKind,fx:null,tod:'day',season:seasonOf(d)});scene.start();}
      hudLeft(fmtD(d),G);
      document.getElementById('sceneLoc').innerHTML=`<b>${esc(LABEL[lastKind])}</b>`;
      const b=document.getElementById('banner');if(b)b.classList.remove('show');
      this.ui={auto:false,skip:false,manual:0,maxSpeed:typeof speed==='number'?speed:1,hour:0,matesSvc:0,sameRole:false};
      if(this.rp)this.exitReplay(true);
      this.found=[];this.evSet=new Set(dex.ev);this.picks=[];this.snaps=[];this.forceUntil=Date.now()+2500;
      this.st=blankSt();this.st.prop=propOf(G);if(G.ctx.rk==='enl'&&G.gf==='dating')this.st.gf=1;this.st.rank=G.curRk||'';const S0=G.stats||{};this.st.fit=S0.fit|0;this.st.iq=S0.iq|0;this.st.mind=S0.mind==null?50:S0.mind;
      if(scene)scene.set({st:{...this.st}});
      const ra=document.getElementById('runAch');if(ra)ra.hidden=true;
      document.getElementById('result').classList.remove('done');
    },
    picks:[],st:null,snaps:[],rp:null,
    /* 자동 스크롤: 바로 앞 줄이 화면에 보이면(=맨 아래를 보고 있으면) 새 줄을 따라간다.
       위로 올려 지난 기록을 읽는 중이면 끌어내리지 않고 '새 기록' 버튼만 띄운다 */
    forceUntil:0,
    follow(li,isDec){
      if(!li)return;const prev=li.previousElementSibling;
      const atBottom=!prev||prev.getBoundingClientRect().top<innerHeight+120||Date.now()<this.forceUntil;
      const btn=document.getElementById('toLatest');
      if(atBottom){li.scrollIntoView({block:'nearest',behavior:RM||(typeof speed==='number'&&speed>=2)?'auto':'smooth'});if(btn)btn.hidden=true;}
      else if(btn){btn.textContent=isDec?'선택지가 기다려요 ↓':'새 기록 ↓';btn.hidden=false;}
    },
    /* 지난 장면 다시 보기: 로그 줄을 누르면 그 순간 장면으로, 진행은 멈춘다 */
    replay(i){
      const sn=this.snaps[i];if(!sn||!scene)return;
      if(!this.rp){this.rp={live:this.snaps.length-1,paused:false,done:false};
        if(typeof paused!=='undefined'&&!paused&&document.getElementById('end').hidden){setPaused(true);this.rp.paused=true;}
        const card=document.getElementById('result');if(card.classList.contains('done')){card.classList.remove('done');this.rp.done=true;}}
      this.rp.i=i;applySnap(sn);
      if(sn.stats&&typeof G!=='undefined'&&G){const keep=G.stats;G.stats=sn.stats;renderStats(null);G.stats=keep;}
      document.querySelectorAll('#log li.viewing').forEach(x=>x.classList.remove('viewing'));
      const li=document.querySelector(`#log li[data-snap="${i}"]`);if(li)li.classList.add('viewing');
      const bar=document.getElementById('replayBar');bar.hidden=false;
      document.getElementById('rpInfo').textContent=`다시 보는 중 · ${sn.date}`;
      document.getElementById('rpPrev').disabled=i<=0;document.getElementById('rpNext').disabled=i>=this.snaps.length-1;
      try{store.set('mc-rp-hint','1');const h=document.getElementById('rpHint');if(h)h.hidden=true;}catch(e){}
    },
    exitReplay(silent){
      if(!this.rp)return;const rp=this.rp;this.rp=null;
      document.getElementById('replayBar').hidden=true;document.querySelectorAll('#log li.viewing').forEach(x=>x.classList.remove('viewing'));
      if(!silent){const last=this.snaps[this.snaps.length-1];
        if(!document.getElementById('end').hidden){if(scene)scene.set({kind:'final',fx:null,tod:'day'});}else if(last)applySnap({...last,sc:{...last.sc,fx:null}});}
      if(typeof G!=='undefined'&&G)renderStats(null);
      if(rp.done)document.getElementById('result').classList.add('done');
      if(rp.paused)setPaused(false);
    },
    _scene(o){if(scene){scene.set(o);}},
    _cut(id,svc,g){const ct=CUTS.find(x=>x.id===id);if(ct)openCut(ct,'테스트',svc||'army',!!g);},
    ui:null,found:[],evSet:null,
    onSkip(){if(this.ui)this.ui.skip=true;dex.skips++;saveDex();},
    quiet:false,
    onEvent(e,G){
      const k=sceneOf(e);const t=e.text||'';
      let fx=null;if(e.kind==='promo')fx=/진급했다|임관했다/.test(t)?'promo':'good';if(e.kind==='bad')fx='bad';
      const svc=G.svNow||G.ctx.sv.id;
      if(this.st)updateState(this.st,e,G);
      const kind=(k==='barracks'&&(fx==='promo'||fx==='bad'))?'barracks':k;
      if(this.rp)this.exitReplay(true);
      lastKind=kind;
      const lab=kind==='barracks'?(svc==='army'?'생활관':BASE_LABEL[svc]):LABEL[kind];
      const tags=this.st?stateTags(this.st):[];
      const sn={sc:{svc:this.st&&this.st.deploy==='sea'?'navy':svc,kind,fx:fx?'promo':null,tod:todOf(t,k),season:seasonOf(e.d),st:{...(this.st||{})}},
        date:fmtYM(e.d),rk:G.curRk,psvc:svc,stats:{...G.stats},loc:this.st&&this.st.deploy==='desert'&&kind==='barracks'?'파병지':lab,tags};
      if(fx==='bad')sn.sc.fx='bad';
      applySnap(sn);this.snaps.push(sn);
      // 로그 줄 아이콘
      const li=document.getElementById('log').lastElementChild;const ic=LOGIC[kind];
      if(li){li.dataset.snap=this.snaps.length-1;li.classList.add('replayable');li.tabIndex=0;li.setAttribute('aria-label','이 장면 다시 보기: '+t);}
      if(li&&ic){const cv=document.createElement('canvas');cv.className='ico';cv.setAttribute('aria-hidden','true');iconTo(cv,ic,true);const p=li.querySelector('p');if(p)p.prepend(cv);}
      if(this.ui&&typeof speed==='number')this.ui.maxSpeed=Math.max(this.ui.maxSpeed,speed);
      // 처음 보는 희귀·전설·미기록 사건
      const h=dexHash(dexNorm(t)),tr=CAT.tier[h]||5;let rare=false;
      if(this.evSet&&!this.evSet.has(h)){this.evSet.add(h);if(tr>=3){rare=true;this.found.push(tr);if(li){li.classList.add('find','t'+tr);const p=li.querySelector('p');if(p)p.insertAdjacentHTML('beforeend',`<span class="find-tag">${tr===5?'미기록':TIER_NAME[tr]} 발견</span>`);}}}
      const ct=cutFor(t);
      if(ct&&!this.quiet&&!dex.cuts.includes(ct.id)){dex.cuts.push(ct.id);saveDex();openCut(ct,t,svc,true);}
      if(!this.quiet&&!this.rp)this.follow(li);
      if(this.quiet)return;
      if(rare&&!fx){SFX.ach();buzz([15,30,15]);banner(`<span><small>${tr===5?'미기록 사건':TIER_NAME[tr]+' 사건'} 발견</small>${esc(t.length>24?t.slice(0,23)+'…':t)}</span>`,'ach t'+tr,2000);return;}
      if(fx==='promo'){SFX.promo();buzz([20,40,20]);const m=t.match(/^(\S+?)(으로|로) 진급|^(\S+?)(으로|로) 임관/);const rk=m&&(m[1]||m[3]);
        banner(`${rk&&rankSym(rk)?patchSvg(rk,svc,1):''}<span>${esc(rk?rk+' 진급':'임관')}</span>`,'',1500);}
      else if(fx==='bad'){SFX.bad();buzz(60);banner(`<span>${esc(t.length>22?t.slice(0,21)+'…':t)}</span>`,'bad',1500);}
      else if(fx==='good')SFX.good();
      else if(e.kind==='leave')SFX.leave();
      else SFX.tick();
    },
    onDecision(){SFX.dec();buzz(15);},
    onChoose(auto,dec,i,li){
      // 다시 보는 중에 선택지를 누르면 바로 복귀하고 진행 (step은 choose가 예약하므로 여기선 멈춤만 푼다)
      if(this.rp){const resume=this.rp.paused;this.rp.paused=false;this.exitReplay(false);if(resume)setPaused(false,false);}if(this.ui){if(auto)this.ui.auto=true;else this.ui.manual++;}
      if(dec&&dec.opts[i]){const q=li&&li.querySelector('.q');this.picks.push({d:dec.d,q:q?q.textContent.replace(/^선택/,'').trim():dec.q,a:dec.opts[i].label,auto:!!auto});}
      if(!auto)SFX.pick();},
    onFinish(G,info){
      const L=info.isEnl?info.life:info.CL;
      if(scene)scene.set({kind:'final',fx:null,tod:'day'});
      document.getElementById('sceneLoc').innerHTML=`<b>${esc((L&&L.stampTxt)||'전역')}</b>`;
      SFX.stamp();buzz([30,60,90]);
      const card=document.getElementById('result');if(!RM){card.classList.remove('shake');void card.offsetWidth;card.classList.add('shake');}
      const u=this.ui||{auto:true,skip:true,manual:0,maxSpeed:4};u.hour=new Date().getHours();u.matesSvc=new Set((G.mates||[]).map(m=>m.ctx.sv.id)).size;
      const {got,f,delta}=record(G,u);
      card.classList.add('done');{const tl=document.getElementById('toLatest');if(tl)tl.hidden=true;}
      const ep=renderEpic(G,f,got);renderPicks(this.picks);
      const n3=this.found.filter(t=>t===3).length,n4=this.found.filter(t=>t===4).length,n5=this.found.filter(t=>t===5).length;
      const finds=[n4&&`전설 ${n4}`,n3&&`희귀 ${n3}`,n5&&`미기록 ${n5}`].filter(Boolean).join(' · ');
      renderRunAch(got.slice(),delta,finds);renderShare(G,f,ep,got,this.picks);
      const msgs=[];if(got.length)msgs.push(`<span><small>업적 달성${got.length>1?` · ${got.length}개`:''}</small>${esc(got.map(a=>a.t).join(' · '))}</span>`);
      if(finds)msgs.push(`<span><small>이번 복무에서 새로 찾은 사건</small>${esc(finds)}</span>`);
      msgs.forEach((m,i)=>setTimeout(()=>{SFX.ach();banner(m,'ach',2400);},700+i*2700));
      this.ui=null;
    }
  };
})();
