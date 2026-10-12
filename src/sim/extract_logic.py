#!/usr/bin/env python3
"""원작 HTML에서 게임 로직(LOGIC-START ~ LOGIC-END)만 뽑아 src/logic.js로 저장한다. 시뮬레이션 전에 한 번 실행."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parents[1]
html = (root / "orig.html").read_text(encoding="utf-8")
m = re.search(r"/\*LOGIC-START\*/(.*?)/\*LOGIC-END\*/", html, re.S)
(root / "logic.js").write_text(m.group(1), encoding="utf-8")
print("src/logic.js", len(m.group(1)), "bytes")
