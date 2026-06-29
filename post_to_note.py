"""
post_to_note.py - 生成済みコンテンツを note.com に下書き投稿

output/ フォルダの 05_sales_letter.md（無料部分）と
04_paid_content.md（有料部分）を結合し、note.com に下書き保存する。

使い方:
  python post_to_note.py                    # output/ から投稿
  python post_to_note.py --dir output_02    # 指定フォルダから投稿
  python post_to_note.py --title "タイトル" # タイトルを手動指定
"""

import os
import re
import sys
import time
import json
import argparse
from pathlib import Path

# Windows コンソール文字化け対策
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ==============================
# 設定
# ==============================
BASE_DIR = Path(__file__).parent
NOTE_NEW_URL = "https://note.com/new"
CHROMIUM_EXECUTABLE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
CHROME_USER_DATA = str(BASE_DIR / "cloned_chrome_data")


def extract_title(output_dir: Path) -> str:
    """商品設計書からタイトルを自動取得"""
    design_path = output_dir / "03_product_design.md"
    if design_path.exists():
        text = design_path.read_text(encoding="utf-8")
        for line in text.split("\n"):
            if "タイトル:" in line and "サブ" not in line and "候補" not in line:
                t = line.split("タイトル:")[-1].strip().strip("*").strip()
                if t and len(t) > 2:
                    return t
    return ""


def normalize_headings(text: str) -> str:
    """見出しをnoteの2階層（大見出し=## / 小見出し=###）に正規化する。"""
    lines = text.split("\n")
    result = []
    in_fence = False
    for line in lines:
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            result.append(line)
            continue
        if not in_fence:
            m = re.match(r"^(#{1,6})\s+(.*)$", line)
            if m:
                level = len(m.group(1))
                prefix = "## " if level <= 2 else "### "
                result.append(prefix + m.group(2))
                continue
        result.append(line)
    return "\n".join(result)


def convert_tables_to_lists(text: str) -> str:
    """Markdownの表を箇条書きに変換（noteは表に対応していないため）"""
    lines = text.split("\n")
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if (
            stripped.startswith("|")
            and i + 1 < len(lines)
            and re.match(r"^\|[\s:|-]+\|$", lines[i + 1].strip())
        ):
            headers = [c.strip() for c in stripped.strip("|").split("|")]
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                rows.append(cells)
                i += 1
            for cells in rows:
                first = cells[0] if cells else ""
                rest = cells[1:]
                if len(headers) <= 2 and len(rest) == 1:
                    result.append(f"・{first}: {rest[0]}")
                else:
                    result.append(f"■ {first}")
                    for h, c in zip(headers[1:], rest):
                        if c:
                            result.append(f"・{h}: {c}" if h else f"・{c}")
                result.append("")
            continue
        result.append(line)
        i += 1
    return "\n".join(result)


def build_article(output_dir: Path) -> str:
    """セールスレター + 有料部分を結合"""
    letter_path = output_dir / "05_sales_letter.md"
    content_path = output_dir / "04_paid_content.md"

    if not letter_path.exists():
        raise FileNotFoundError(f"セールスレターが見つかりません: {letter_path}")
    if not content_path.exists():
        raise FileNotFoundError(f"有料部分が見つかりません: {content_path}")

    letter = letter_path.read_text(encoding="utf-8")
    content = content_path.read_text(encoding="utf-8")

    for marker in ["## メタ情報", "## このラインより下が有料エリアです"]:
        if marker in letter:
            letter = letter[:letter.index(marker)].rstrip()
        if marker in content:
            content = content[:content.index(marker)].rstrip()

    lines = letter.split("\n")
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
        while lines and not lines[0].strip():
            lines = lines[1:]
        letter = "\n".join(lines)

    combined = f"{letter}\n\n---\n\n{content}"
    combined = convert_tables_to_lists(combined)
    combined = normalize_headings(combined)
    return combined


def post(output_dir: Path, title: str = None, profile_dir: str = None, auto_save: bool = False):
    """メイン処理: note.com に下書き投稿（Playwright使用）"""
    print(f"\n{'='*60}")
    print(f"  note.com 下書き投稿")
    print(f"  出力フォルダ: {output_dir}")
    print(f"{'='*60}")

    if not title:
        title = extract_title(output_dir)
    if not title:
        title = input("タイトルを入力してください: ").strip()
    if not title:
        print("[ERROR] タイトルが必要です")
        return

    body = build_article(output_dir)
    print(f"[INFO] タイトル: {title}")
    print(f"[INFO] 本文: {len(body):,}文字")

    from playwright.sync_api import sync_playwright

    os.makedirs(CHROME_USER_DATA, exist_ok=True)

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=CHROME_USER_DATA,
            executable_path=CHROMIUM_EXECUTABLE,
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )

        page = context.new_page()

        try:
            page.goto(NOTE_NEW_URL, wait_until="networkidle", timeout=30000)
        except Exception:
            page.goto(NOTE_NEW_URL, timeout=30000)

        # ログイン待機
        if "login" in page.url or "signup" in page.url:
            print("\n" + "=" * 60)
            print("  note.com にログインしてください！")
            print("  （最大180秒 待機します）")
            print("=" * 60)
            for _ in range(36):
                time.sleep(5)
                if "login" not in page.url and "signup" not in page.url:
                    print("[OK] ログイン完了！")
                    break
            else:
                raise RuntimeError("ログインがタイムアウトしました")

        if "new" not in page.url:
            try:
                page.goto(NOTE_NEW_URL, wait_until="networkidle", timeout=30000)
            except Exception:
                page.goto(NOTE_NEW_URL, timeout=30000)

        time.sleep(3)

        # タイトル入力
        try:
            title_sel = "textarea[placeholder*='タイトル'], textarea.p-editor__title, textarea"
            title_el = page.locator(title_sel).first
            title_el.click()
            title_el.fill(title)
            print(f"[OK] タイトル入力: {title[:50]}")
        except Exception as e:
            print(f"[ERROR] タイトル入力失敗: {e}")
            context.close()
            return

        time.sleep(1)

        # 本文入力（クリップボード経由）
        try:
            editor_sel = "div.ProseMirror, div[contenteditable='true'], div.p-editor__body"
            editor = page.locator(editor_sel).first
            editor.click()
            time.sleep(0.5)
            # JavaScriptでクリップボードに設定してペースト
            page.evaluate(f"navigator.clipboard.writeText({json.dumps(body)})")
            time.sleep(0.3)
            page.keyboard.press("Control+a")
            time.sleep(0.2)
            page.keyboard.press("Control+v")
            time.sleep(3)
            print(f"[OK] 本文入力: {len(body):,}文字")
        except Exception as e:
            print(f"[ERROR] 本文入力失敗: {e}")
            context.close()
            return

        time.sleep(2)

        # 下書き保存
        def do_save():
            saved = False
            for sel in [
                "button[data-testid='save-draft']",
                "button.o-navPublish__draftButton",
            ]:
                try:
                    btn = page.locator(sel).first
                    if btn.is_visible():
                        btn.click()
                        time.sleep(3)
                        print("[OK] 下書き保存しました！")
                        saved = True
                        break
                except Exception:
                    pass

            if not saved:
                for btn in page.locator("button").all():
                    try:
                        if "下書き" in btn.inner_text():
                            btn.click()
                            time.sleep(3)
                            print("[OK] 下書き保存しました！")
                            saved = True
                            break
                    except Exception:
                        pass

            if not saved:
                print("[WARN] 下書き保存ボタンが見つかりません。手動で保存してください")

        if auto_save:
            do_save()
        else:
            try:
                ans = input("\n下書き保存しますか？ [Y/n]: ").strip().lower()
                if ans in ("", "y", "yes"):
                    do_save()
                else:
                    print("[INFO] 手動で保存してください。ブラウザは開いたままです")
                    input("Enterを押すと終了します...")
            except EOFError:
                do_save()

        context.close()

    print(f"\n[完了] note.com への投稿処理が終わりました")


def main():
    parser = argparse.ArgumentParser(
        description="生成済みコンテンツを note.com に下書き投稿",
    )
    parser.add_argument("--dir", type=str, default="output",
                        help="出力フォルダ名 (デフォルト: output)")
    parser.add_argument("--title", type=str, default=None,
                        help="記事タイトル（省略時は商品設計書から自動取得）")
    parser.add_argument("--profile", type=str, default="Profile 1",
                        help="Chromeプロファイル名 (デフォルト: Profile 1)")
    parser.add_argument("--auto-save", action="store_true",
                        help="確認なしで自動的に下書き保存する")

    args = parser.parse_args()

    output_dir = BASE_DIR / args.dir
    if not output_dir.exists():
        print(f"[ERROR] フォルダが見つかりません: {output_dir}")
        sys.exit(1)

    post(output_dir, title=args.title, profile_dir=args.profile, auto_save=args.auto_save)


if __name__ == "__main__":
    main()
