"""
setup_note.py - note.com ログインセットアップ

Chromeを専用プロファイルで起動し、note.comにログインしてCookieを保存する。
一度ログインすれば以降は自動ログインされる。

使い方:
  python setup_note.py                        # Profile 1 でログイン
  python setup_note.py --profile "Profile 2"  # 別プロファイルでログイン
"""

import os
import sys
import time
import argparse
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager

BASE_DIR = Path(__file__).parent


def kill_chrome_for_profile():
    """cloned_chrome_data を掴んでいるChromeプロセスを終了"""
    try:
        import psutil
        killed = 0
        for proc in psutil.process_iter(["pid", "name", "cmdline"]):
            try:
                cmdline = " ".join(proc.info["cmdline"] or [])
                if "cloned_chrome_data" in cmdline:
                    proc.kill()
                    killed += 1
            except Exception:
                pass
        if killed:
            print(f"[INFO] 既存のChromeプロセス {killed}件 を終了しました")
            time.sleep(3)
    except ImportError:
        pass


def setup(profile_dir: str = "Profile 1"):
    print()
    print("=" * 60)
    print("  note.com ログインセットアップ")
    print(f"  プロファイル: {profile_dir}")
    print("=" * 60)

    # ChromeDriver自動取得
    print("[1/3] ChromeDriverを準備中...")
    service = ChromeService(ChromeDriverManager().install())
    print("[OK]  ChromeDriver準備完了")

    # 専用プロファイルのChromeプロセスを終了
    kill_chrome_for_profile()

    # Chrome起動
    print("[2/3] Chromeを起動中...")
    chrome_data = str(BASE_DIR / "cloned_chrome_data")
    os.makedirs(chrome_data, exist_ok=True)

    options = webdriver.ChromeOptions()
    options.add_argument(f"--user-data-dir={chrome_data}")
    options.add_argument(f"--profile-directory={profile_dir}")
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    driver = webdriver.Chrome(service=service, options=options)
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    })

    # note.comログインページへ
    print("[3/3] note.com を開いています...")
    driver.get("https://note.com/login")
    time.sleep(3)

    # 既にログイン済みかチェック
    url = driver.current_url
    if "login" not in url and "signup" not in url:
        cookies = driver.get_cookies()
        print()
        print("=" * 60)
        print("  既にログイン済みです！")
        print(f"  Cookie {len(cookies)}件 保存済み")
        print("  セットアップ完了 - このままコンテンツ制作に進めます")
        print("=" * 60)
        driver.quit()
        return

    # ログイン待ち
    print()
    print("=" * 60)
    print("  ブラウザで note.com にログインしてください！")
    print("  （最大5分間 待機します）")
    print("=" * 60)

    for i in range(60):
        time.sleep(5)
        try:
            url = driver.current_url
            if "login" not in url and "signup" not in url:
                cookies = driver.get_cookies()
                print()
                print("=" * 60)
                print("  ログイン成功！")
                print(f"  Cookie {len(cookies)}件 保存しました")
                print("  次回以降は自動ログインされます")
                print("=" * 60)
                time.sleep(2)
                driver.quit()
                return
        except Exception:
            pass
        if (i + 1) % 6 == 0:
            print(f"[INFO] 待機中... {(i+1)*5}秒")

    print("[ERROR] タイムアウト。もう一度 python setup_note.py を実行してください")
    driver.quit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="note.com ログインセットアップ")
    parser.add_argument("--profile", type=str, default="Profile 1",
                        help="Chromeプロファイル名 (例: 'Profile 1', 'Profile 2')")
    args = parser.parse_args()
    setup(profile_dir=args.profile)
