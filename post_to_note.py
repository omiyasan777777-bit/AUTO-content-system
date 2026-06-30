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

from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from webdriver_manager.chrome import ChromeDriverManager

# ==============================
# 設定
# ==============================
BASE_DIR = Path(__file__).parent
NOTE_NEW_URL = "https://note.com/new"


def create_driver(profile_dir: str = None):
    """Selenium Chrome ドライバーを作成"""
    # ロックファイル解放
    try:
        import psutil
        killed = set()
        for proc in psutil.process_iter(["pid", "name", "open_files"]):
            try:
                for f in (proc.info["open_files"] or []):
                    if "cloned_chrome_data" in f.path and f.path.endswith("lockfile"):
                        p = psutil.Process(proc.info["pid"])
                        for child in p.children(recursive=True):
                            if child.pid not in killed:
                                try:
                                    child.kill()
                                except Exception:
                                    pass
                                killed.add(child.pid)
                        if proc.info["pid"] not in killed:
                            try:
                                p.kill()
                            except Exception:
                                pass
                            killed.add(proc.info["pid"])
                        break
            except Exception:
                pass
        if killed:
            time.sleep(4)
    except ImportError:
        pass

    chrome_data = str(BASE_DIR / "cloned_chrome_data")
    os.makedirs(chrome_data, exist_ok=True)

    options = webdriver.ChromeOptions()
    options.add_argument(f"--user-data-dir={chrome_data}")
    options.add_argument(f"--profile-directory={profile_dir or 'Profile 1'}")
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    # ローカル環境のChromium/chromedriverを優先使用
    local_chromedriver = "/opt/node22/bin/chromedriver"
    local_chromium = "/opt/pw-browsers/chromium"
    if os.path.exists(local_chromium):
        options.binary_location = local_chromium
    if os.path.exists(local_chromedriver):
        service = ChromeService(executable_path=local_chromedriver)
    else:
        service = ChromeService(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    })
    return driver


def wait_for_login(driver, timeout=180):
    """note.com のログインを待つ"""
    current = driver.current_url
    if "login" not in current and "signup" not in current:
        return

    print("\n" + "=" * 60)
    print("  note.com にログインしてください！")
    print(f"  （最大 {timeout}秒 待機します）")
    print("=" * 60)

    waited = 0
    while waited < timeout:
        time.sleep(5)
        waited += 5
        try:
            url = driver.current_url
            if "login" not in url and "signup" not in url:
                print("[OK] ログイン完了！")
                time.sleep(3)
                return
        except Exception:
            pass
        if waited % 30 == 0:
            print(f"[INFO] ログイン待機中... ({waited}/{timeout}秒)")

    raise RuntimeError("ログインがタイムアウトしました")


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
    """見出しをnoteの2階層（大見出し=## / 小見出し=###）に正規化する。

    noteのエディタは見出しが2種類（大見出し・小見出し）しかないため、
    Markdownの#〜######を確実に2階層へマッピングする。
      - H1〜H2（# / ##）→ 大見出し（##）
      - H3以下（### 〜）→ 小見出し（###）
    コードフェンス（```）内の # はコメントの可能性があるため変換しない。
    """
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
        # 表の開始判定: |で始まり、次行が区切り行（|---|---|）
        if (
            stripped.startswith("|")
            and i + 1 < len(lines)
            and re.match(r"^\|[\s:|-]+\|$", lines[i + 1].strip())
        ):
            headers = [c.strip() for c in stripped.strip("|").split("|")]
            i += 2  # ヘッダー行 + 区切り行をスキップ
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                rows.append(cells)
                i += 1
            # 箇条書きへ変換
            for cells in rows:
                first = cells[0] if cells else ""
                rest = cells[1:]
                if len(headers) <= 2 and len(rest) == 1:
                    # 2列の表 → 「・項目: 説明」
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

    # メタ情報セクションを除去
    for marker in ["## メタ情報", "## このラインより下が有料エリアです"]:
        if marker in letter:
            letter = letter[:letter.index(marker)].rstrip()
        if marker in content:
            content = content[:content.index(marker)].rstrip()

    # 先頭の Markdown タイトル行を除去（note側でタイトル入力するため）
    lines = letter.split("\n")
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
        while lines and not lines[0].strip():
            lines = lines[1:]
        letter = "\n".join(lines)

    combined = f"{letter}\n\n---\n\n{content}"
    # noteは表非対応のため、残っている表は箇条書きに変換
    combined = convert_tables_to_lists(combined)
    # noteの見出しは大見出し/小見出しの2階層のみ。確実にマッピングする
    combined = normalize_headings(combined)
    return combined


def input_title(driver, title: str) -> bool:
    """note の記事タイトルを入力"""
    try:
        textarea = None
        for sel in [
            "textarea[placeholder*='タイトル']",
            "textarea.p-editor__title",
            "textarea",
        ]:
            try:
                textarea = driver.find_element(By.CSS_SELECTOR, sel)
                break
            except Exception:
                pass

        if textarea is None:
            print("[ERROR] タイトル入力欄が見つかりません")
            return False

        textarea.clear()
        textarea.send_keys(title)
        print(f"[OK] タイトル入力: {title[:50]}")
        return True
    except Exception as e:
        print(f"[ERROR] タイトル入力失敗: {e}")
        return False


def input_body(driver, body: str) -> bool:
    """note の記事本文を入力（クリップボード経由）"""
    try:
        import pyperclip

        # 本文入力エリアを探す
        editor = None
        for sel in [
            "div.ProseMirror",
            "div[contenteditable='true']",
            "div.p-editor__body",
        ]:
            try:
                editor = driver.find_element(By.CSS_SELECTOR, sel)
                break
            except Exception:
                pass

        if editor is None:
            print("[ERROR] 本文入力欄が見つかりません")
            return False

        # クリップボード経由でペースト（Mac は Command+V、それ以外は Ctrl+V）
        paste_key = Keys.COMMAND if sys.platform == "darwin" else Keys.CONTROL
        pyperclip.copy(body)
        ActionChains(driver).click(editor).pause(0.5).perform()
        ActionChains(driver).key_down(paste_key).send_keys("v").key_up(paste_key).perform()
        time.sleep(2)

        print(f"[OK] 本文入力: {len(body):,}文字")
        return True
    except ImportError:
        print("[ERROR] pyperclip が必要です: pip install pyperclip")
        return False
    except Exception as e:
        print(f"[ERROR] 本文入力失敗: {e}")
        return False


def save_draft(driver) -> bool:
    """下書き保存ボタンをクリック"""
    time.sleep(2)

    # 下書き保存ボタンを探す
    for sel in [
        "button[data-testid='save-draft']",
        "button.o-navPublish__draftButton",
    ]:
        try:
            btn = driver.find_element(By.CSS_SELECTOR, sel)
            btn.click()
            time.sleep(3)
            print("[OK] 下書き保存しました！")
            return True
        except Exception:
            pass

    # テキストで探す
    for btn in driver.find_elements(By.TAG_NAME, "button"):
        txt = btn.text.strip()
        if "下書き" in txt:
            btn.click()
            time.sleep(3)
            print("[OK] 下書き保存しました！")
            return True

    print("[WARN] 下書き保存ボタンが見つかりません。手動で保存してください")
    return False


def post(output_dir: Path, title: str = None, profile_dir: str = None, auto_save: bool = False):
    """メイン処理: note.com に下書き投稿"""
    print(f"\n{'='*60}")
    print(f"  note.com 下書き投稿")
    print(f"  出力フォルダ: {output_dir}")
    print(f"{'='*60}")

    # タイトル取得
    if not title:
        title = extract_title(output_dir)
    if not title:
        title = input("タイトルを入力してください: ").strip()
    if not title:
        print("[ERROR] タイトルが必要です")
        return

    # 記事本文を構築
    body = build_article(output_dir)
    print(f"[INFO] タイトル: {title}")
    print(f"[INFO] 本文: {len(body):,}文字")

    # Chrome 起動
    driver = create_driver(profile_dir)

    try:
        # note.com へアクセス
        driver.get(NOTE_NEW_URL)
        time.sleep(5)

        # ログイン待ち
        wait_for_login(driver)

        # 記事作成ページに再アクセス（ログイン後のリダイレクト対応）
        if "new" not in driver.current_url:
            driver.get(NOTE_NEW_URL)
            time.sleep(5)

        # タイトル入力
        if not input_title(driver, title):
            return

        time.sleep(1)

        # 本文入力
        if not input_body(driver, body):
            return

        time.sleep(2)

        # 下書き保存
        if auto_save:
            save_draft(driver)
        else:
            try:
                ans = input("\n下書き保存しますか？ [Y/n]: ").strip().lower()
                if ans in ("", "y", "yes"):
                    save_draft(driver)
                else:
                    print("[INFO] 手動で保存してください。ブラウザは開いたままです")
                    input("Enterを押すと終了します...")
            except EOFError:
                save_draft(driver)

    except KeyboardInterrupt:
        print("\n[INFO] 中断しました")
    finally:
        try:
            driver.quit()
        except Exception:
            pass

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
