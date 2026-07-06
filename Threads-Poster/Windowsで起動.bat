@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ⚽ Threads Poster を起動しています...
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  [エラー] Node.js が見つかりません。
  echo  https://nodejs.org/ja からLTS版をインストールしてください。
  pause
  exit /b 1
)
start "" http://127.0.0.1:4310
node server.mjs
pause
