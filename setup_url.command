#!/bin/bash
# URLを http://sinya-threads:8787 で開けるようにする（Mac用・ダブルクリックで実行）
#
# Macの /etc/hosts に「sinya-threads = 自分のPC(127.0.0.1)」という対応を1行登録する。
# 登録には管理者パスワードが1回だけ必要（Macログイン時のパスワード）。
# 元の http://127.0.0.1:8787 もそのまま使える。

ALIAS="sinya-threads"
PORT="${ACS_PORT:-8787}"

echo "============================================================"
echo "  🌙 URL変更セットアップ: http://$ALIAS:$PORT"
echo "============================================================"

if grep -qE "^127\.0\.0\.1[[:space:]]+$ALIAS([[:space:]]|$)" /etc/hosts; then
  echo "[OK] すでに登録済みです"
else
  echo "Macの管理者パスワードを入力してください（入力中は画面に表示されません）:"
  sudo sh -c "printf '127.0.0.1\t$ALIAS\n' >> /etc/hosts"
  if [ $? -ne 0 ]; then
    echo "[ERROR] 登録に失敗しました（パスワード誤り、または権限がありません）"
    read -p "Enterキーで閉じます..."
    exit 1
  fi
  # DNSキャッシュを更新
  sudo dscacheutil -flushcache 2>/dev/null
  sudo killall -HUP mDNSResponder 2>/dev/null
  echo "[OK] 登録しました"
fi

echo ""
echo "  これからは次のURLで開けます（ブックマーク推奨）:"
echo "    http://$ALIAS:$PORT"
echo ""
echo "  ※ブラウザのアドレスバーに入力するとき、初回だけ"
echo "    「http://」まで含めて入力してください"
echo "    （sinya-threads とだけ打つと検索扱いになるため）"
echo "============================================================"

sleep 1
open "http://$ALIAS:$PORT"
