#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo " ⚽ Threads Poster を起動しています..."
echo ""
if ! command -v node >/dev/null 2>&1; then
  echo " [エラー] Node.js が見つかりません。"
  echo " https://nodejs.org/ja からLTS版をインストールしてください。"
  read -p "Enterキーで閉じる"
  exit 1
fi
(sleep 1.5 && open "http://127.0.0.1:4310") &
node server.mjs
