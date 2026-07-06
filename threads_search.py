"""
threads_search.py - Threads 話題検索（他人の投稿を含むキーワード検索）

Threads公式APIのキーワード検索で、指定ワードの人気投稿（TOP）または
新着投稿（RECENT）を表示する。ジャンルの旬ネタ・競合の当たり投稿探しに使う。

※他人の投稿のインプレッション数は非公開のため取得できない（Threadsの仕様）。
  「人気順」はThreads公式の人気ランキング。いいね数はAPIが返す場合のみ表示。
※トークンに threads_keyword_search 権限が必要。

使い方:
  python threads_search.py --q "婚活"
  python threads_search.py --q "副業" --type RECENT --top 20
  python threads_search.py --q "ダイエット" --out threads_trend.md
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import threads_api
from threads_api import ThreadsError

BASE_DIR = Path(__file__).resolve().parent


def excerpt(text: str, limit: int = 70) -> str:
    t = (text or "(本文なし)").replace("\n", " ")
    return t[:limit] + ("…" if len(t) > limit else "")


def fmt_time(ts: str) -> str:
    try:
        return datetime.strptime(ts[:16], "%Y-%m-%dT%H:%M").strftime("%Y-%m-%d %H:%M")
    except Exception:
        return ts or ""


def main():
    parser = argparse.ArgumentParser(description="Threads 話題検索（キーワード）")
    parser.add_argument("--q", type=str, required=True, help="検索キーワード")
    parser.add_argument("--type", choices=["TOP", "RECENT"], default="TOP",
                        help="TOP=人気順（デフォルト） / RECENT=新着順")
    parser.add_argument("--top", type=int, default=15, help="表示件数（デフォルト15）")
    parser.add_argument("--out", type=str, default=None,
                        help="Markdownレポートの保存先（省略時は保存しない）")
    args = parser.parse_args()

    try:
        cfg = threads_api.load_config()
        print(f"[INFO] 「{args.q}」の{'人気' if args.type == 'TOP' else '新着'}投稿を検索中...")
        posts = threads_api.keyword_search(cfg, args.q, search_type=args.type,
                                           limit=args.top)
    except ThreadsError as e:
        msg = str(e)
        print(f"[ERROR] {msg}")
        if "permission" in msg.lower() or "scope" in msg.lower() or "oauth" in msg.lower():
            print("  ※キーワード検索には threads_keyword_search 権限が必要です。")
            print("    developers.facebook.com でチェックを入れてトークンを再生成してください。")
        sys.exit(1)

    posts = posts[:args.top]
    if not posts:
        print("[INFO] 見つかりませんでした。キーワードを変えてみてください")
        return

    label = "人気順（TOP）" if args.type == "TOP" else "新着順"
    print()
    print("=" * 60)
    print(f"  🔍 Threads 話題検索「{args.q}」 {label} {len(posts)}件")
    print("=" * 60)
    for i, p in enumerate(posts, 1):
        likes = f"  ❤ {p['like_count']:,}" if p.get("like_count") is not None else ""
        print(f"{i:2d}. @{p.get('username', '')}{likes}  ({fmt_time(p.get('timestamp'))})")
        print(f"     {excerpt(p.get('text'))}")
        if p.get("permalink"):
            print(f"     {p['permalink']}")

    if args.out:
        lines = [
            f"# Threads 話題検索レポート「{args.q}」（{label}）",
            "",
            f"- 生成日時: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "- ※他人の投稿のインプレッション数は非公開（Threadsの仕様）。人気順はThreads公式ランキング",
            "",
        ]
        for i, p in enumerate(posts, 1):
            likes = f"（❤ {p['like_count']:,}）" if p.get("like_count") is not None else ""
            lines.append(f"## {i}. @{p.get('username', '')} {likes} {fmt_time(p.get('timestamp'))}")
            lines.append("")
            lines.append(p.get("text") or "(本文なし)")
            if p.get("permalink"):
                lines.append("")
                lines.append(p["permalink"])
            lines.append("")
        out_path = BASE_DIR / args.out
        out_path.write_text("\n".join(lines), encoding="utf-8")
        print()
        print(f"[OK] レポートを保存しました: {out_path.name}")


if __name__ == "__main__":
    main()
