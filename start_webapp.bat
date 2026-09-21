@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   AUTO-content-system  Web UI  (default: FULL-AUTO)
echo   Full-auto runs every command without confirmation.
echo   Open in browser: http://127.0.0.1:8787
echo ============================================================

where python >nul 2>nul
if errorlevel 1 (
  echo [エラー] Python が見つかりません。
  echo   https://www.python.org/downloads/ からインストールしてから、
  echo   もう一度このファイルをダブルクリックしてください。
  echo   （インストール時に「Add python.exe to PATH」に必ずチェックを入れてください）
  pause
  exit /b 1
)

where claude >nul 2>nul
if errorlevel 1 (
  echo [警告] claude コマンド（Claude Code）が見つかりません。
  echo   本文生成にはClaude Codeのインストールが必要です: https://claude.com/claude-code
  echo   インストール済みの場合は、一度PCを再起動してから再実行してください。
  echo.
)

echo 必要なパッケージを確認しています…（初回は数分かかる場合があります）
python -m pip install -q --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
  echo [エラー] 必要なパッケージのインストールに失敗しました。インターネット接続を確認して再実行してください。
  pause
  exit /b 1
)

set ACS_ALLOW_FULL=1
echo 起動しています… ブラウザが自動で開きます。
echo （開かない場合は手動で http://127.0.0.1:8787 を開いてください）
start "" http://127.0.0.1:8787
python webapp\server.py
pause
