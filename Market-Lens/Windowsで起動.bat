@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js が見つかりません。
  echo https://nodejs.org/ からLTS版をインストールしてください。
  pause
  exit /b 1
)

echo Market Lens を起動しています...
echo 利用中はこの画面を閉じないでください。
start "" powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:4173'"
node server.mjs

echo.
echo Market Lens を終了しました。
pause
