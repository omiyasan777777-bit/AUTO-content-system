#!/bin/bash
# 深夜のThreads を常駐化するセットアップ（Mac用・ダブルクリックで実行）
#
# これを一度実行すると、Macにログインするたびにサーバーが裏で自動起動し、
# 以降はターミナル不要で http://127.0.0.1:8787 を開くだけで使えるようになる。
# （予約投稿もMacが起きていれば常時実行される）
# やめたいときは remove_autostart.command を実行する。

cd "$(dirname "$0")"
DIR="$(pwd)"
PLIST="$HOME/Library/LaunchAgents/com.shinya-threads.webapp.plist"

# デスクトップ/書類/ダウンロードはmacOSの保護対象で、自動起動（launchd）からは
# アクセスできず起動に失敗する。ホーム直下などへの移動を案内して終了する。
case "$DIR" in
  "$HOME/Desktop"*|"$HOME/Documents"*|"$HOME/Downloads"*)
    echo "⚠️  このフォルダは「デスクトップ/書類/ダウンロード」の中にあります。"
    echo "   Macの保護機能により、自動起動からはアクセスできません。"
    echo ""
    echo "   ターミナルで以下を実行して、ホーム直下に移動してください:"
    echo ""
    echo "     launchctl unload \"$PLIST\" 2>/dev/null"
    echo "     mv \"$DIR\" \"\$HOME/AUTO-content-system\""
    echo "     cd \"\$HOME/AUTO-content-system\""
    echo "     ./setup_autostart.command"
    echo ""
    read -p "Enterキーで閉じます..."
    exit 1
    ;;
esac

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.shinya-threads.webapp</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd "$DIR" &amp;&amp; exec python3 webapp/server.py</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>ACS_ALLOW_FULL</key><string>1</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DIR/webapp/server.log</string>
  <key>StandardErrorPath</key><string>$DIR/webapp/server.log</string>
</dict>
</plist>
PLISTEOF

# 既に登録済みなら入れ替え、今すぐ起動
launchctl unload "$PLIST" 2>/dev/null
launchctl load "$PLIST"

echo "============================================================"
echo "  🌙 深夜のThreads 常駐セットアップ 完了！"
echo ""
echo "  ・サーバーはこの瞬間から裏で動いています"
echo "  ・Macを再起動しても自動で立ち上がります"
echo "  ・使うときはブラウザで開くだけ:"
echo "      http://127.0.0.1:8787"
echo "    （↑ブックマーク登録がおすすめ）"
echo ""
echo "  やめたいとき: remove_autostart.command をダブルクリック"
echo "  動作ログ: webapp/server.log"
echo "============================================================"

sleep 2
open "http://127.0.0.1:8787"
