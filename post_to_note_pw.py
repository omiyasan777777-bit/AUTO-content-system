"""
post_to_note_pw.py - Playwright版 note.com 下書き投稿スクリプト
"""
import os
import re
import sys
import time
import argparse
from pathlib import Path

BASE_DIR = Path(__file__).parent
NOTE_NEW_URL = "https://note.com/new"
CHROMIUM_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"


def extract_title(output_dir: Path) -> str:
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


def post(output_dir: Path, title: str = None, auto_save: bool = False):
    if not title:
        title = extract_title(output_dir)
    if not title:
        print("[ERROR] タイトルが必要です")
        return

    body = build_article(output_dir)
    print(f"[INFO] タイトル: {title}")
    print(f"[INFO] 本文: {len(body):,}文字")

    from playwright.sync_api import sync_playwright

    user_data_dir = str(BASE_DIR / "cloned_chrome_data_pw")
    os.makedirs(user_data_dir, exist_ok=True)

    with sync_playwright() as p:
        proxy_server = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
        proxy_config = {"server": proxy_server} if proxy_server else None

        browser = p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            executable_path=CHROMIUM_PATH,
            headless=False,
            proxy=proxy_config,
            ignore_https_errors=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        page = browser.pages[0] if browser.pages else browser.new_page()

        try:
            page.goto(NOTE_NEW_URL, wait_until="networkidle", timeout=30000)

            # ログイン確認
            url = page.url
            if "login" in url or "signup" in url:
                print("\n" + "=" * 60)
                print("  note.com にログインしてください！（最大180秒）")
                print("=" * 60)
                for _ in range(36):
                    time.sleep(5)
                    if "login" not in page.url and "signup" not in page.url:
                        print("[OK] ログイン完了！")
                        time.sleep(3)
                        break
                else:
                    raise RuntimeError("ログインタイムアウト")

                if "new" not in page.url:
                    page.goto(NOTE_NEW_URL, wait_until="networkidle", timeout=30000)

            time.sleep(3)

            # タイトル入力
            for sel in ["textarea[placeholder*='タイトル']", "textarea.p-editor__title", "textarea"]:
                try:
                    el = page.wait_for_selector(sel, timeout=5000)
                    if el:
                        el.fill(title)
                        print(f"[OK] タイトル入力: {title[:50]}")
                        break
                except Exception:
                    pass

            time.sleep(1)

            # 本文入力（クリップボード経由）
            for sel in ["div.ProseMirror", "div[contenteditable='true']", "div.p-editor__body"]:
                try:
                    el = page.wait_for_selector(sel, timeout=5000)
                    if el:
                        el.click()
                        time.sleep(0.5)
                        page.evaluate(f"""
                            const el = document.querySelector('{sel}');
                            if (el) {{
                                el.focus();
                            }}
                        """)
                        # クリップボード経由でペースト
                        page.evaluate(f"""
                            navigator.clipboard.writeText({repr(body)}).catch(() => {{
                                // fallback: execCommand
                            }});
                        """)
                        time.sleep(0.5)
                        page.keyboard.press("Control+a")
                        time.sleep(0.3)
                        page.keyboard.press("Control+v")
                        time.sleep(3)
                        print(f"[OK] 本文入力: {len(body):,}文字")
                        break
                except Exception as e:
                    print(f"[WARN] {sel}: {e}")

            time.sleep(2)

            # 下書き保存
            if auto_save:
                saved = False
                for sel in ["button[data-testid='save-draft']", "button.o-navPublish__draftButton"]:
                    try:
                        btn = page.query_selector(sel)
                        if btn:
                            btn.click()
                            time.sleep(3)
                            print("[OK] 下書き保存しました！")
                            saved = True
                            break
                    except Exception:
                        pass

                if not saved:
                    for btn in page.query_selector_all("button"):
                        txt = btn.inner_text().strip()
                        if "下書き" in txt:
                            btn.click()
                            time.sleep(3)
                            print("[OK] 下書き保存しました！")
                            saved = True
                            break

                if not saved:
                    print("[WARN] 下書き保存ボタンが見つかりません")
            else:
                input("\n完了したらEnterを押してください...")

        except Exception as e:
            print(f"[ERROR] {e}")
            raise
        finally:
            browser.close()

    print("\n[完了] note.com への投稿処理が終わりました")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", type=str, default="output")
    parser.add_argument("--title", type=str, default=None)
    parser.add_argument("--auto-save", action="store_true")
    args = parser.parse_args()

    output_dir = BASE_DIR / args.dir
    if not output_dir.exists():
        print(f"[ERROR] フォルダが見つかりません: {output_dir}")
        sys.exit(1)

    post(output_dir, title=args.title, auto_save=args.auto_save)


if __name__ == "__main__":
    main()
