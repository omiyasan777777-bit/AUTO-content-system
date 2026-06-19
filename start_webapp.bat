@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo   note-article-system  v3
echo   http://127.0.0.1:8787 をブラウザで開いてください
echo ============================================================

REM ── Python チェック ──────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Python が見つかりません。
    echo.
    echo 下記の手順でインストールしてください:
    echo   1. https://www.python.org/downloads/ を開く
    echo   2. "Download Python 3.x.x" をクリック
    echo   3. インストーラーを起動し "Add Python to PATH" に
    echo      チェックを入れてからインストール
    echo   4. このファイルを再度ダブルクリック
    echo.
    start "" "https://www.python.org/downloads/"
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo [OK] Python %PY_VER% を検出しました

REM ── Flask チェック・自動インストール ─────────────────────────
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Flask をインストール中... (初回のみ)
    python -m pip install flask --quiet --disable-pip-version-check
    if errorlevel 1 (
        echo [ERROR] Flask のインストールに失敗しました。
        echo 手動で実行してください: python -m pip install flask
        pause
        exit /b 1
    )
    echo [OK] Flask インストール完了
) else (
    echo [OK] Flask 検出済み
)

REM ── サーバー起動 ─────────────────────────────────────────────
set ACS_ALLOW_FULL=1
echo.
echo ブラウザを開いています...
start "" http://127.0.0.1:8787
echo.
echo サーバーを起動中 (このウィンドウは開いたままにしてください)
echo 終了するにはこのウィンドウを閉じてください
echo ============================================================
python webapp\server.py
pause
