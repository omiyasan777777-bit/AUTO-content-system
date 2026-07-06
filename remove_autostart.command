#!/bin/bash
# 深夜のThreads の常駐（自動起動）を解除する（Mac用・ダブルクリックで実行）

PLIST="$HOME/Library/LaunchAgents/com.shinya-threads.webapp.plist"

if [ -f "$PLIST" ]; then
  launchctl unload "$PLIST" 2>/dev/null
  rm -f "$PLIST"
  echo "🌙 常駐を解除しました。サーバーは停止しています。"
  echo "   また使うときは start_webapp.command（都度起動）か"
  echo "   setup_autostart.command（常駐）を実行してください。"
else
  echo "常駐設定は見つかりませんでした（すでに解除済みです）。"
fi
