#!/bin/bash

cd "$(dirname "$0")" || exit 1

PID_FILE="work/market-lens.pid"

mkdir -p work

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" >/dev/null 2>&1; then
    echo "以前のMarket Lensを終了しています…"
    kill "$OLD_PID" >/dev/null 2>&1
    sleep 1
  fi
fi

clear
echo "Market Lens を起動しています…"
echo "このウィンドウは、Market Lensを使っている間は閉じないでください。"
echo

PORT=4173
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  if [ "$PORT" -gt 4190 ]; then
    echo "利用できるポートが見つかりませんでした。"
    exit 1
  fi
done
URL="http://127.0.0.1:$PORT"

PORT="$PORT" node server.mjs &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"
trap 'kill "$SERVER_PID" >/dev/null 2>&1; rm -f "$PID_FILE"' EXIT INT TERM

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 1 "$URL" >/dev/null 2>&1; then
    open "$URL"
    echo "起動しました: $URL"
    wait "$SERVER_PID"
    exit $?
  fi
  sleep 1
done

echo "起動できませんでした。上のエラー内容をご確認ください。"
wait "$SERVER_PID"
