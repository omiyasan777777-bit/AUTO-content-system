"""
threads_insights.py - Threads 人気投稿分析

自分の投稿からインプレッション（views）・いいねの高いものをランキング表示し、
threads_report.md にレポートを保存する。

使い方:
  python threads_insights.py                     # 直近30日をviews順でTop10
  python threads_insights.py --sort likes        # いいね順
  python threads_insights.py --days 90 --top 20  # 期間・件数を指定
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

BASE_DIR = Path(__file__).parent

SORT_LABELS = {
    "views": "インプレッション",
    "likes": "いいね",
    "replies": "リプライ",
    "reposts": "リポスト",
    "quotes": "引用",
}


def fmt_time(ts: str) -> str:
    # 例: 2026-07-01T09:30:00+0000 → 2026-07-01 09:30
    try:
        return datetime.strptime(ts[:16], "%Y-%m-%dT%H:%M").strftime("%Y-%m-%d %H:%M")
    except Exception:
        return ts or ""


def excerpt(text: str, limit: int = 60) -> str:
    t = (text or "(本文なし)").replace("\n", " ")
    return t[:limit] + ("…" if len(t) > limit else "")


def main():
    parser = argparse.ArgumentParser(description="Threads 人気投稿分析")
    parser.add_argument("--days", type=int, default=30, help="集計期間（日数、デフォルト30）")
    parser.add_argument("--top", type=int, default=10, help="表示件数（デフォルト10）")
    parser.add_argument("--sort", choices=list(SORT_LABELS), default="views",
                        help="並び順（views=インプレッション / likes=いいね など）")
    parser.add_argument("--out", type=str, default="threads_report.md",
                        help="レポートの保存先（デフォルト: threads_report.md）")
    args = parser.parse_args()

    try:
        cfg = threads_api.load_config()
        print(f"[INFO] @{cfg.get('username', '')} の直近{args.days}日の投稿を取得中...")
        posts = threads_api.fetch_ranked_posts(
            cfg, days=args.days, top=args.top, sort=args.sort)
    except ThreadsError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    if not posts:
        print(f"[INFO] 直近{args.days}日に投稿がありません")
        return

    label = SORT_LABELS[args.sort]
    print()
    print("=" * 60)
    print(f"  🧵 Threads 人気投稿 Top{len(posts)}（{label}順 / 直近{args.days}日）")
    print("=" * 60)
    for i, p in enumerate(posts, 1):
        ins = p.get("insights", {})
        print(f"{i:2d}. {excerpt(p.get('text'))}")
        print(f"     👁 {ins.get('views', 0):,}  ❤ {ins.get('likes', 0):,}"
              f"  💬 {ins.get('replies', 0):,}  🔁 {ins.get('reposts', 0):,}"
              f"  ({fmt_time(p.get('timestamp'))})")
        if p.get("permalink"):
            print(f"     {p['permalink']}")

    # Markdownレポート保存（内部資料なので表を使ってよい）
    lines = [
        f"# Threads 人気投稿レポート（{label}順）",
        "",
        f"- アカウント: @{cfg.get('username', '')}",
        f"- 集計期間: 直近{args.days}日",
        f"- 生成日時: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "| # | 投稿（冒頭） | 👁 views | ❤ likes | 💬 replies | 🔁 reposts | 投稿日時 | リンク |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for i, p in enumerate(posts, 1):
        ins = p.get("insights", {})
        link = f"[開く]({p['permalink']})" if p.get("permalink") else ""
        lines.append(
            f"| {i} | {excerpt(p.get('text'), 40).replace('|', '｜')} "
            f"| {ins.get('views', 0):,} | {ins.get('likes', 0):,} "
            f"| {ins.get('replies', 0):,} | {ins.get('reposts', 0):,} "
            f"| {fmt_time(p.get('timestamp'))} | {link} |"
        )
    lines += [
        "",
        "## 使い方のヒント",
        "",
        "- 上位投稿の「型・テーマ・書き出し」を次の投稿や有料noteのコンセプトに再利用する",
        "- インプレッションが高く いいねが少ない投稿 → フックは強いが中身の共感が弱い",
        "- いいね率が高い投稿のテーマ → 有料コンテンツのジャンル候補",
    ]
    out_path = BASE_DIR / args.out
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print()
    print(f"[OK] レポートを保存しました: {out_path.name}")


if __name__ == "__main__":
    main()
