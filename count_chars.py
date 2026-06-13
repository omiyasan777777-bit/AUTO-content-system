"""
count_chars.py - Markdownファイルの文字数を正確にカウントする

Windows環境の `wc -m` はマルチバイト非対応で日本語をバイト数（1文字=3）で
カウントしてしまうため、Pythonで正確に文字数を測るためのスクリプト。

使い方:
  python count_chars.py output/chapters/ch01.md
  python count_chars.py output/chapters/ch*.md     # 複数ファイル（合計も表示）
  python count_chars.py output/04_paid_content.md

出力する文字数は「空白・改行を除いた本文文字数」。
参考として全文字数（空白・改行込み）も併記する。
"""

import sys
import glob
from pathlib import Path

# Windows コンソール文字化け対策
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def count_file(path: Path) -> tuple[int, int]:
    """(本文文字数, 全文字数) を返す。本文文字数は空白・改行・タブを除く"""
    text = path.read_text(encoding="utf-8")
    total = len(text)
    body = sum(1 for ch in text if not ch.isspace())
    return body, total


def main():
    if len(sys.argv) < 2:
        print("使い方: python count_chars.py <ファイル> [ファイル...]")
        sys.exit(1)

    # Windowsのcmd/PowerShellはグロブを展開しないため、ここで展開する
    paths = []
    for arg in sys.argv[1:]:
        matched = sorted(glob.glob(arg))
        if matched:
            paths.extend(Path(m) for m in matched)
        else:
            paths.append(Path(arg))

    grand_body = 0
    grand_total = 0
    missing = False

    for p in paths:
        if not p.exists():
            print(f"[ERROR] ファイルが見つかりません: {p}")
            missing = True
            continue
        body, total = count_file(p)
        grand_body += body
        grand_total += total
        print(f"{p}: {body:,}文字（空白・改行除く） / {total:,}文字（全体）")

    if len(paths) > 1:
        print("-" * 50)
        print(f"合計: {grand_body:,}文字（空白・改行除く） / {grand_total:,}文字（全体）")

    if missing:
        sys.exit(1)


if __name__ == "__main__":
    main()
