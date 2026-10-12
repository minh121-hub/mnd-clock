#!/usr/bin/env python3
"""게임 병사 특기 vs 병무청 모집병 군사특기 대조표 (xlsx)."""
import json, glob, re, difflib
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

GUN = {"1": "army", "2": "navy", "3": "air", "4": "marine"}
GUN_NM = {"army": "육군", "navy": "해군", "air": "공군", "marine": "해병대"}
MOJIP = {"1": "기술행정병(기술병)", "2": "2", "3": "카투사", "4": "어학병", "5": "전문특기병", "6": "6", "7": "7", "8": "8",
         "9": "임기제부사관", "C": "취업맞춤특기병", "F": "기술행정병(연단위)"}

# 1) 병무청 목록: 군별로 특기명 기준 합치기 (여러 모집분야에 같은 특기가 나옴)
mma = {}
for f in sorted(glob.glob("l_*.json")):
    g, m = re.match(r"l_(\d)_(\w)\.json", f.split("/")[-1]).groups()
    try:
        rows = json.load(open(f)).get("list", [])
    except Exception:
        continue
    for r in rows:
        svc = GUN[g]; nm = re.sub(r"^\(맞춤\)\s*", "", (r.get("gtcd_nm") or "").strip())
        if not nm:
            continue
        k = (svc, nm)
        e = mma.setdefault(k, {"svc": svc, "name": nm, "codes": set(), "mojip": set(), "field": r.get("mjbunya") or "",
                               "duty": (r.get("immu_cn") or "").strip(), "body": (r.get("scjogeon_cn") or "").strip(),
                               "plan": r.get("iygyehoek_eyn") or "", "upd": (r.get("cjdatabyeongyeong_dtm") or "")[:10]})
        e["codes"].add(r.get("gsteukgi_cd") or ""); e["mojip"].add(MOJIP.get(m, m))

game = [r for r in json.load(open("game_roles.json")) if r["rk"] == "enl"]

def norm(s):
    s = re.sub(r"\(.*?\)|\[.*?\]", "", s)
    s = re.sub(r"[\s·ㆍ/,\-]", "", s)
    s = re.sub(r"(병|원|수)$", "", s)
    return s

def best(svc, name):
    cands = [e for e in mma.values() if e["svc"] == svc]
    n = norm(name); out = []
    for e in cands:
        m = norm(e["name"])
        if n == m:
            sc = 1.0
        elif min(len(n), len(m)) >= 2 and (n in m or m in n):
            sc = 0.6 + 0.3 * min(len(n), len(m)) / max(len(n), len(m))
        else:
            sc = difflib.SequenceMatcher(None, n, m).ratio()
        out.append((sc, e))
    out.sort(key=lambda x: -x[0])
    return out[:2]

rows, matched = [], set()
for r in game:
    top = best(r["svc"], r["name"])
    sc, e = top[0] if top else (0, None)
    status = "일치" if sc >= 0.999 else "유사" if sc >= 0.7 else "모집 목록에 없음"
    if e and sc >= 0.7:
        matched.add((e["svc"], e["name"]))
    alt = top[1][1]["name"] if len(top) > 1 and top[1][0] >= 0.7 else ""
    rows.append([GUN_NM[r["svc"]], r["name"], status, round(sc, 2),
                 e["name"] if e and sc >= 0.7 else "", alt,
                 ", ".join(sorted(e["mojip"])) if e and sc >= 0.7 else "",
                 ", ".join(sorted(c for c in e["codes"] if c)) if e and sc >= 0.7 else "",
                 (e["duty"][:300] if e and sc >= 0.7 else ""), round(r["w"], 4) if isinstance(r["w"], (int, float)) else "",
                 ""])
only = [e for k, e in mma.items() if k not in matched]

# 2) 엑셀
wb = Workbook()
F = "Arial"; H = Font(name=F, bold=True, color="FFFFFF"); B = Font(name=F); BB = Font(name=F, bold=True)
HF = PatternFill("solid", fgColor="56632F"); thin = Side(style="thin", color="C9CDBF")
FILL = {"일치": "E3EFD9", "유사": "FFF2CC", "모집 목록에 없음": "F8D7D3"}
wrap = Alignment(wrap_text=True, vertical="top")

def table(ws, header, data, widths, name):
    ws.append(header)
    for c in ws[1]:
        c.font = H; c.fill = HF; c.alignment = Alignment(vertical="center", wrap_text=True)
    for d in data:
        ws.append(d)
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.font = B; c.alignment = wrap
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    ref = f"A1:{get_column_letter(len(header))}{len(data) + 1}"
    t = Table(displayName=name, ref=ref); t.tableStyleInfo = TableStyleInfo(name="TableStyleLight1", showRowStripes=False)
    ws.add_table(t)

# 요약 (수식)
ws = wb.active; ws.title = "요약"
ws["A1"] = "게임 병사 특기 vs 병무청 모집병 군사특기 대조"; ws["A1"].font = Font(name=F, bold=True, size=14)
ws["A2"] = "출처: 병무청 누리집 '군사특기임무 및 설명' (mma.go.kr, dutyList.do), 2026-10-11 수집. 게임: 「국방부 시계」 병 특기 목록"
ws["A3"] = "매칭은 이름 기준 자동 판정(정규화 후 같으면 일치, 한쪽이 다른 쪽을 포함하거나 문자열 유사도 0.7 이상이면 유사). '유사'와 '모집 목록에 없음'은 사람이 확인해야 함"
for c in ("A2", "A3"):
    ws[c].font = Font(name=F, size=10, color="5B6054")
hdr = ["군", "게임 병 특기", "일치", "유사", "모집 목록에 없음", "일치+유사 비율", "병무청에만 있는 특기"]
for i, h in enumerate(hdr, 1):
    c = ws.cell(row=5, column=i, value=h); c.font = H; c.fill = HF
for j, (svc, nm) in enumerate(GUN_NM.items(), 6):
    ws.cell(row=j, column=1, value=nm)
    ws.cell(row=j, column=2, value=f'=COUNTIF(대조!$A:$A,A{j})')
    ws.cell(row=j, column=3, value=f'=COUNTIFS(대조!$A:$A,A{j},대조!$C:$C,C$5)')
    ws.cell(row=j, column=4, value=f'=COUNTIFS(대조!$A:$A,A{j},대조!$C:$C,D$5)')
    ws.cell(row=j, column=5, value=f'=COUNTIFS(대조!$A:$A,A{j},대조!$C:$C,E$5)')
    ws.cell(row=j, column=6, value=f'=IF(B{j}=0,0,(C{j}+D{j})/B{j})')
    ws.cell(row=j, column=7, value=f'=COUNTIF(병무청에만있음!$A:$A,A{j})')
ws.cell(row=10, column=1, value="합계").font = BB
for col in "BCDEG":
    ws[f"{col}10"] = f"=SUM({col}6:{col}9)"
ws["F10"] = "=IF(B10=0,0,(C10+D10)/B10)"
for r in range(6, 11):
    for c in range(1, 8):
        ws.cell(row=r, column=c).font = BB if r == 10 else B
    ws.cell(row=r, column=6).number_format = "0.0%"
ws["A12"] = "읽는 법"; ws["A12"].font = BB
notes = ["· '모집 목록에 없음'은 오류가 아니다. 보병·포병 같은 징집병 특기는 모집병 목록에 안 나온다. 게임 특기 이름이 병무청 이름과 다를 수도 있다",
         "· '병무청에만 있는 특기'는 게임에 추가할 후보다. 임무 설명은 1차 출처라 이벤트 문구를 새로 쓸 때 사실 근거로 쓸 수 있다",
         "· 부사관·장교 특기(213개)는 병무청 모집병 자료 범위 밖이라 대조하지 않았다. 각 군 간부 모집 누리집이 출처 후보다",
         "· 병무청 자료의 이용 조건(누리집 저작권 정책)은 공개 전에 따로 확인할 것"]
for i, n in enumerate(notes, 13):
    ws.cell(row=i, column=1, value=n).font = B
for i, w in enumerate([10, 14, 8, 8, 16, 14, 18], 1):
    ws.column_dimensions[get_column_letter(i)].width = w

# 대조
ws2 = wb.create_sheet("대조")
table(ws2, ["군", "게임 특기", "판정", "유사도", "병무청 특기", "다른 후보", "모집분야", "특기번호", "병무청 임무 (앞부분)", "게임 등장 가중치", "메모 (직접 확인)"],
      sorted(rows, key=lambda x: (list(GUN_NM.values()).index(x[0]), ["모집 목록에 없음", "유사", "일치"].index(x[2]), x[1])),
      [8, 18, 14, 8, 20, 16, 18, 14, 60, 10, 24], "Compare")
for row in ws2.iter_rows(min_row=2):
    row[2].fill = PatternFill("solid", fgColor=FILL[row[2].value]); row[3].number_format = "0.00"

# 병무청에만 있음
ws3 = wb.create_sheet("병무청에만있음")
table(ws3, ["군", "병무청 특기", "모집분야", "특기번호", "분야", "임무", "신체조건"],
      [[GUN_NM[e["svc"]], e["name"], ", ".join(sorted(e["mojip"])), ", ".join(sorted(c for c in e["codes"] if c)), e["field"], e["duty"][:500], e["body"][:300]]
       for e in sorted(only, key=lambda e: (list(GUN_NM).index(e["svc"]), e["name"]))],
      [8, 22, 20, 14, 12, 60, 40], "MmaOnly")

# 원자료
ws4 = wb.create_sheet("병무청원자료")
table(ws4, ["군", "특기", "모집분야", "특기번호", "분야", "입영계획", "임무", "신체조건", "자료 수정일"],
      [[GUN_NM[e["svc"]], e["name"], ", ".join(sorted(e["mojip"])), ", ".join(sorted(c for c in e["codes"] if c)), e["field"], e["plan"], e["duty"], e["body"], e["upd"]]
       for e in sorted(mma.values(), key=lambda e: (list(GUN_NM).index(e["svc"]), e["name"]))],
      [8, 22, 20, 14, 12, 8, 70, 50, 12], "MmaRaw")

wb.save("특기-대조표.xlsx")
print("game enl", len(game), "mma", len(mma), "mma-only", len(only))
from collections import Counter
print(Counter((r[0], r[2]) for r in rows))
