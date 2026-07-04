"""
setup_threads.py - Threads API の初期設定ウィザード

Meta公式の Threads API を使うためのアクセストークンを登録する。
一度設定すれば threads_insights.py（人気投稿分析）と
post_to_threads.py（自動投稿）が使えるようになる。

使い方:
  python setup_threads.py            # 初期設定（トークン登録）
  python setup_threads.py --refresh  # 長期トークンの更新（60日延長）

トークンの取り方（初回のみ・約5分）:
  1. https://developers.facebook.com/ で「アプリを作成」
  2. ユースケースで「Threads APIにアクセス」を選択
  3. アプリ設定 > Threads API > 「アクセストークンを生成」
     （threads_basic, threads_content_publish, threads_manage_insights を許可）
  4. 表示されたトークンをこのウィザードに貼り付ける
"""

import argparse
import sys
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import threads_api
from threads_api import ThreadsError


def setup():
    print()
    print("=" * 60)
    print("  Threads API セットアップ")
    print("=" * 60)
    print("""
【トークンの取り方（初回のみ）】
 1. https://developers.facebook.com/ でアプリを作成
    （ユースケース: Threads APIにアクセス）
 2. アプリ設定 > Threads API > アクセストークンを生成
    権限: threads_basic / threads_content_publish / threads_manage_insights
 3. 生成されたトークンを下に貼り付けてください
""")
    token = input("アクセストークン: ").strip()
    if not token:
        print("[ERROR] トークンが空です")
        return

    # 任意: アプリシークレットがあれば長期トークン（60日）に交換する
    secret = input("アプリシークレット（任意・Enterでスキップ）: ").strip()
    expires_in = None
    if secret:
        try:
            d = threads_api.exchange_long_lived_token(token, secret)
            token = d["access_token"]
            expires_in = d.get("expires_in")
            print(f"[OK] 長期トークンに交換しました（有効期間 約{(expires_in or 0)//86400}日）")
        except ThreadsError as e:
            print(f"[WARN] 長期トークンへの交換に失敗: {e}")
            print("       貼り付けたトークンをそのまま使用します")

    # トークン検証（自分のプロフィール取得）
    print("[INFO] トークンを確認中...")
    try:
        me = threads_api.get_me(token)
    except ThreadsError as e:
        print(f"[ERROR] トークンが無効です: {e}")
        return

    threads_api.save_config({
        "access_token": token,
        "user_id": me["id"],
        "username": me.get("username", ""),
        "expires_in": expires_in,
        "obtained_at": int(time.time()),
    })
    print()
    print("=" * 60)
    print(f"  設定完了！ @{me.get('username', me['id'])} として接続しました")
    print("  ・人気投稿分析: python threads_insights.py")
    print("  ・自動投稿:     python post_to_threads.py --text \"...\"")
    print("  ※トークンの期限が切れたら --refresh で更新できます")
    print("=" * 60)


def refresh():
    try:
        cfg = threads_api.load_config()
        cfg = threads_api.refresh_long_lived_token(cfg)
        days = (cfg.get("expires_in") or 0) // 86400
        print(f"[OK] トークンを更新しました（有効期間 約{days}日）")
    except ThreadsError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Threads API 初期設定")
    parser.add_argument("--refresh", action="store_true",
                        help="長期トークンを更新する（60日延長）")
    args = parser.parse_args()
    refresh() if args.refresh else setup()
