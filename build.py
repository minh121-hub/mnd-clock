#!/usr/bin/env python3
"""원본 HTML + 추가 레이어(fx.css, fx.js)를 합쳐 두 가지 산출물을 만든다.
dist/artifact.html : 아티팩트용 (doctype·head 없이, 플랫폼이 감싼다)
app/www/index.html : 앱용 단독 문서 (CSP, manifest, 서비스워커 등록 포함)"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
lines = (SRC / "orig.html").read_text(encoding="utf-8").split("\n")

# 1행은 플랫폼이 주입한 런타임이라 버린다. 2행(<title>)부터 </script> 까지가 원작자 코드
start = next(i for i, l in enumerate(lines) if l.startswith("<title>"))
end = max(i for i, l in enumerate(lines) if l.strip() == "</script>")
page = "\n".join(lines[start:end + 1])

def sub(old, new, count=1):
    """정확히 count번 나오는지 확인하고 바꾼다. 원본이 바뀌면 여기서 멈춘다."""
    global page
    n = page.count(old)
    if n != count:
        sys.exit(f"패치 실패 ({n}회 발견): {old[:70]!r}")
    page = page.replace(old, new)

fx_css = (SRC / "fx.css").read_text(encoding="utf-8")
fx_js = "\n".join((SRC / n).read_text(encoding="utf-8") for n in ("catalog.js", "dex-core.js", "fx.js"))
fx_js = fx_js.replace("if(typeof module!=='undefined')module.exports={runFacts,ACH,DEX_RANKS,dexNorm,dexHash};", "")

# --- 스타일 추가
sub("</style>\n\n<div class=\"wrap\">", "</style>\n<style>\n" + fx_css + "</style>\n\n<div class=\"wrap\">")

# --- 첫 화면 픽셀 씬
sub("""  </header>
""", """  </header>

  <div class="hero-scene" aria-hidden="true">
    <div class="scene"><canvas id="heroScene" width="240" height="60"></canvas>
      <div class="scene-hud"><span>입영 대기</span><span><b>신병교육대 정문</b></span></div></div>
  </div>
""")

# --- 복무 중 픽셀 씬 (HUD 안에 넣어 스크롤해도 붙어 있게)
sub("""    <div class="hud">
""", """    <div class="hud">
      <div class="scene" role="img" aria-label="지금 장면">
        <canvas id="scene" width="240" height="60"></canvas>
        <div class="scene-hud"><span id="sceneDate"></span><span id="sceneLoc"></span></div>
        <div class="banner" id="banner" aria-live="polite"></div>
        <div class="replay-bar" id="replayBar" hidden>
          <span id="rpInfo"></span>
          <button type="button" id="rpPrev" aria-label="이전 장면">◀</button>
          <button type="button" id="rpNext" aria-label="다음 장면">▶</button>
          <button type="button" id="rpBack" class="rp-back">지금으로</button>
        </div>
      </div>
      <p class="rp-hint" id="rpHint">지나간 줄을 누르면 그 장면을 다시 볼 수 있어요</p>
""")
sub("""        <button class="cbtn" id="skipBtn\"""", """        <button class="cbtn" id="sndBtn" type="button" aria-pressed="false" title="효과음을 켜고 끕니다">소리</button>
        <button class="cbtn" id="skipBtn\"""")

# --- 도감 섹션
sub("""  <section aria-labelledby="chartTitle">""", """  <section class="dex" aria-labelledby="dexTitle">
    <div class="dex-head"><h2 id="dexTitle">복무 도감</h2><span class="tag" id="achCount"></span></div>
    <p class="notes" style="margin:0">입대할 때마다 겪은 사건, 만난 특기와 부대, 단 계급장, 본 결말, 고른 선택이 이 기기에 쌓입니다.</p>
    <dl class="dex-meter" id="dexMeter" style="margin:0"></dl>
    <div class="dex-tabs" id="dexTabs" role="tablist" aria-label="도감 종류"></div>
    <div class="dex-panel" id="dexPanel" role="tabpanel"></div>
    <div class="dex-reset"><button class="cbtn" id="dexReset" type="button">도감 초기화</button>
      <span id="dexResetQ" hidden>지금까지 기록이 모두 지워집니다. <button class="cbtn warn" id="dexResetYes" type="button">지우기</button> <button class="cbtn" id="dexResetNo" type="button">취소</button></span></div>
  </section>

  <section aria-labelledby="chartTitle">""")

# --- 컷 오버레이
sub("""  <footer>""", """  <div class="cut" id="cut" hidden role="dialog" aria-modal="true" aria-labelledby="cutTitle">
    <div class="cut-box">
      <canvas id="cutCv" width="240" height="240" aria-hidden="true"></canvas>
      <div class="cut-tag" id="cutTag"></div>
      <h3 id="cutTitle"></h3>
      <p id="cutText"></p>
      <button class="btn" id="cutClose" type="button">계속 복무하기</button>
    </div>
  </div>
  <footer>""")
# --- 출처·라이선스 표기
sub("""  <footer>국방부·병무청과 관계없는 비공식 시뮬레이션 · 수치는 추정치 포함</footer>""",
"""  <footer>국방부·병무청과 관계없는 비공식 시뮬레이션 · 수치는 추정치 포함<br>
  원작 「국방부 시계」(원작자 허락을 받아 수정) · 특기·부대 설명은 나무위키 문서를 바탕으로 함 (CC BY-NC-SA 2.0 KR) · 이 수정본도 같은 조건으로 배포</footer>""")

# --- 보안: 외부 링크에 noreferrer 추가
sub('rel="noopener"', 'rel="noopener noreferrer"', count=page.count('rel="noopener"'))
sub("rel=\"noopener\">", "rel=\"noopener noreferrer\">", count=page.count("rel=\"noopener\">"))
# --- 보안: esc가 작은따옴표도 막도록
sub("""const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));""",
    """const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));""")
# --- 보안: chips 라벨도 이스케이프 (esc 선언 전에 호출되므로 인라인)
sub("""<label for="${name}-${o.id||'any'}">${o.label}</label>""",
    """<label for="${name}-${o.id||'any'}">${String(o.label).replace(/[&<>"']/g,'')}</label>""")

# --- 훅
sub("""  renderStats(e.fx);
}
function showDecision""", """  renderStats(e.fx);
  FX.onEvent(e,G);
}
function showDecision""")
sub("""  li.querySelectorAll('.opt').forEach(b=>b.addEventListener('click',()=>choose(dec,+b.dataset.i,li,false,true)));
  return li;""", """  li.querySelectorAll('.opt').forEach(b=>b.addEventListener('click',()=>choose(dec,+b.dataset.i,li,false,true)));
  if(!FX.quiet)FX.onDecision(dec);
  return li;""")
sub("""  applyChoice(G,dec,dec.opts[i],Math.random);""", """  applyChoice(G,dec,dec.opts[i],Math.random);FX.onChoose(auto,dec,i,li);""")
# --- 전역 화면 재구성: 웅장한 요약, 이번 판 업적, 갈림길 기록, 공유 카드
sub("""        <p class="summary" id="summary"></p>""", """        <div class="epic" id="epic">
          <div class="epic-eye" id="epicEye"></div>
          <div class="epic-ins" id="epicIns" aria-hidden="true"></div>
          <h3 class="epic-title" id="epicTitle"></h3>
          <p class="summary" id="summary"></p>
          <div class="epic-meta" id="epicMeta"></div>
        </div>
        <div class="run-ach" id="runAch" hidden>
          <div class="kicker">이번 복무에서 얻은 것</div>
          <ul class="badges" id="runAchList"></ul>
          <p class="run-dex" id="runDex"></p>
        </div>""")
sub("""        <p class="stat-line" id="picks" hidden></p>""", """        <p class="stat-line" id="picks" hidden></p>
        <div class="picks-wrap" id="picksWrap" hidden>
          <div class="kicker">내 선택 · 갈림길 기록</div>
          <ol class="picks" id="picksList"></ol>
          <button type="button" class="cbtn" id="picksMore" hidden></button>
        </div>""")
sub("""          <label class="kicker" for="shareTxt">공유 문구</label>
          <textarea class="share" id="shareTxt" readonly></textarea>""", """          <div class="kicker">공유 문구</div>
          <div class="share-card" id="shareCard"></div>
          <details class="share-raw"><summary>복사될 텍스트 보기</summary>
            <label class="sr" for="shareTxt">공유 문구 텍스트</label>
            <textarea class="share" id="shareTxt" readonly></textarea>
          </details>""")
sub("""  let it;while((it=nextItem(G,Math.random))){""", """  FX.quiet=true;let it;while((it=nextItem(G,Math.random))){""")
sub("""  const {ctx,life}=G;const sw=life.switched;""", """  FX.quiet=false;
  const {ctx,life}=G;const sw=life.switched;""")
sub("""stp.classList.add('show');
}""", """stp.classList.add('show');
  FX.onFinish(G,{ctx,isEnl,life,CL});
}""")
sub("""  timer=setTimeout(step,T(450));
}""", """  FX.onStart(G);
  timer=setTimeout(step,T(450));
}""")
sub("""renderOdds();renderChart();renderUnits();renderRoles();drawTicks(18,3,6);setProgress(0);startIdle();""",
    """renderOdds();renderChart();renderUnits();renderRoles();drawTicks(18,3,6);setProgress(0);startIdle();FX.init();""")

sub("""$('#skipBtn').addEventListener('click',()=>{if(G)finish();});""", """$('#skipBtn').addEventListener('click',()=>{if(G){FX.onSkip();finish();}});""")
# --- fx.js는 본 스크립트 앞에 둔다
sub("""<script>
/*LOGIC-START*/""", "<script>\n" + fx_js + "\n</script>\n<script>\n/*LOGIC-START*/")

(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist" / "artifact.html").write_text(page + "\n", encoding="utf-8")

# --- 앱용 단독 문서
CSP = ("default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; "
       "object-src 'none'; base-uri 'none'; form-action 'none'")
head = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#56632F">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}[hidden]{{display:none!important}}</style>
"""
reg = """<script>
if('serviceWorker' in navigator&&location.protocol!=='file:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
</script>"""
app = head + page.replace("\n<div class=\"wrap\">", "\n</head>\n<body>\n<div class=\"wrap\">", 1) + "\n" + reg + "\n</body>\n</html>\n"
(ROOT / "app" / "www").mkdir(parents=True, exist_ok=True)
(ROOT / "app" / "www" / "index.html").write_text(app, encoding="utf-8")
print("ok", len(page), "bytes")
