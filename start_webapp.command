#!/bin/bash
# AUTO-content-system Web UI 起動スクリプト（Mac用・ダブルクリックで起動）
# Windows は start_webapp.bat を使ってください。
cd "$(dirname "$0")"

echo "============================================================"
echo "  深夜のThreads (AUTO-content-system)  Web UI  (default: FULL-AUTO)"
echo "  Full-auto runs every command without confirmation."
echo "  Open in browser: http://127.0.0.1:8787"
echo "============================================================"

export ACS_ALLOW_FULL=1

# python3 優先（Macの標準）。無ければ python を使う
if command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  PY=python
fi

# サーバー起動を少し待ってからブラウザを開く
( sleep 2 && open "http://127.0.0.1:8787" ) &

"$PY" webapp/server.py
