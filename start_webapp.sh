#!/bin/bash
cd "$(dirname "$0")"
echo "============================================================"
echo "  AUTO-content-system  Web UI  (default: FULL-AUTO)"
echo "  Full-auto runs every command without confirmation."
echo "  Open in browser: http://127.0.0.1:8787"
echo "============================================================"

PYTHON=python3
command -v "$PYTHON" >/dev/null 2>&1 || PYTHON=python
if ! command -v "$PYTHON" >/dev/null 2>&1; then
  echo "[エラー] Python が見つかりません。"
  echo "  https://www.python.org/downloads/ からインストールしてから、もう一度実行してください。"
  read -p "Enterキーで終了..." _
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "[警告] claude コマンド（Claude Code）が見つかりません。"
  echo "  本文生成にはClaude Codeのインストールが必要です: https://claude.com/claude-code"
  echo
fi

echo "必要なパッケージを確認しています…（初回は数分かかる場合があります）"
"$PYTHON" -m pip install -q --disable-pip-version-check -r requirements.txt
if [ $? -ne 0 ]; then
  echo "[エラー] 必要なパッケージのインストールに失敗しました。インターネット接続を確認して再実行してください。"
  read -p "Enterキーで終了..." _
  exit 1
fi

export ACS_ALLOW_FULL=1
echo "起動しています… ブラウザで http://127.0.0.1:8787 を開いてください。"
( sleep 1 && (open http://127.0.0.1:8787 2>/dev/null || xdg-open http://127.0.0.1:8787 2>/dev/null) ) &
"$PYTHON" webapp/server.py
