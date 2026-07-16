#!/bin/bash
# AIギルド「月光工房」起動（Mac用・ダブルクリックで実行）
cd "$(dirname "$0")"
echo "============================================================"
echo "  AIギルド 月光工房 - GUILD HALL"
echo "  ブラウザで開く: http://127.0.0.1:8788"
echo "============================================================"
python3 -c "import flask" 2>/dev/null || python3 -m pip install flask
(sleep 2 && open http://127.0.0.1:8788) &
python3 guild/server.py
