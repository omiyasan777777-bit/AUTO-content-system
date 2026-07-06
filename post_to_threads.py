"""
post_to_threads.py - Threads へ自動投稿（公式API）

テキストを Threads に投稿する。ツリー（連投）の区切りは:
  1. 本文中の「---」だけの行 → そこで手動分割（自由に設定できる）
  2. 各パートが500字を超える場合のみ、段落の区切りで自動分割

投稿には threads_config.json の「現在選択中」のアカウントが使われる
（アカウントの切替は Web UI 右上のプルダウンから）。

使い方:
  python post_to_threads.py --text "投稿する本文"
  python post_to_threads.py --file promo.md        # ファイルの中身を投稿
  python post_to_threads.py --text "..." --dry-run # 分割結果の確認のみ
"""

import argparse
import sys
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import threads_api
from threads_api import ThreadsError


def main():
    parser = argparse.ArgumentParser(description="Threads へ自動投稿")
    parser.add_argument("--text", type=str, help="投稿する本文")
    parser.add_argument("--file", type=str, help="投稿する本文が入ったファイル")
    parser.add_argument("--dry-run", action="store_true",
                        help="投稿せず、分割結果だけ表示する")
    args = parser.parse_args()

    if args.text:
        text = args.text
    elif args.file:
        path = Path(args.file)
        if not path.exists():
            print(f"[ERROR] ファイルが見つかりません: {path}")
            sys.exit(1)
        text = path.read_text(encoding="utf-8")
    else:
        print("[ERROR] --text か --file で本文を指定してください")
        sys.exit(1)

    chunks = threads_api.split_text(text)
    if not chunks:
        print("[ERROR] 本文が空です")
        sys.exit(1)

    print(f"[INFO] 本文 {len(text.strip()):,}字 → {len(chunks)}投稿"
          + ("（ツリー連投）" if len(chunks) > 1 else ""))
    for i, c in enumerate(chunks, 1):
        head = c.replace("\n", " ")[:40]
        print(f"  {i}. ({len(c)}字) {head}…" if len(c) > 40 else f"  {i}. ({len(c)}字) {head}")

    if args.dry_run:
        print("[INFO] --dry-run のため投稿していません")
        return

    try:
        cfg = threads_api.load_config()
        print(f"[INFO] @{cfg.get('username', '')} として投稿中...")
        ids = threads_api.publish_thread(cfg, text)
        link = threads_api.get_permalink(cfg, ids[0])
        print(f"[OK] 投稿しました！（{len(ids)}件）")
        if link:
            print(f"     {link}")
    except ThreadsError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
