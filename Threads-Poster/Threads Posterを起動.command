#!/bin/bash
# ⚽ Threads Poster — Mac用起動スクリプト（ダブルクリックで起動）

cd "$(dirname "$0")" || exit 1

# --- Node.js を探す（ダブルクリック起動だと Homebrew/nvm のPATHが通っていないことがある） ---
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  # nvm でインストールされている場合
  if [ -d "$HOME/.nvm/versions/node" ]; then
    LATEST_NVM="$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)"
    [ -n "$LATEST_NVM" ] && export PATH="$HOME/.nvm/versions/node/$LATEST_NVM/bin:$PATH"
  fi
  # volta の場合
  [ -d "$HOME/.volta/bin" ] && export PATH="$HOME/.volta/bin:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  clear
  echo ""
  echo " [エラー] Node.js が見つかりません。"
  echo ""
  echo " https://nodejs.org/ja を開いて「LTS」版を"
  echo " インストールしてから、もう一度ダブルクリックしてください。"
  echo ""
  read -r -p " Enterキーで閉じる"
  exit 1
fi

# --- 二重起動防止 ---
PID_FILE="data/threads-poster.pid"
mkdir -p data
if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" >/dev/null 2>&1; then
    echo "以前のThreads Posterを終了しています…"
    kill "$OLD_PID" >/dev/null 2>&1
    sleep 1
  fi
fi

clear
echo ""
echo " ⚽ Threads Poster を起動しています…"
echo " このウィンドウは、使っている間は閉じないでください。"
echo " （予約投稿はこのウィンドウが開いている間に実行されます）"
echo ""

# --- 空きポートを探す（4310〜4330） ---
PORT=4310
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  if [ "$PORT" -gt 4330 ]; then
    echo " 利用できるポートが見つかりませんでした。"
    read -r -p " Enterキーで閉じる"
    exit 1
  fi
done
URL="http://127.0.0.1:$PORT"

PORT="$PORT" node server.mjs &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"
trap 'kill "$SERVER_PID" >/dev/null 2>&1; rm -f "$PID_FILE"' EXIT INT TERM

# --- 起動を待ってからブラウザを開く ---
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 1 "$URL/api/status" >/dev/null 2>&1; then
    open "$URL"
    echo " 起動しました: $URL"
    wait "$SERVER_PID"
    exit $?
  fi
  sleep 1
done

echo " 起動できませんでした。上のエラー内容をご確認ください。"
wait "$SERVER_PID"
