@echo off
rem Threads Pinball Scheduler を起動してブラウザを開く
cd /d "%~dp0Threads-Pinball"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js が見つかりません。https://nodejs.org からインストールしてください。
  pause
  exit /b 1
)
start "" http://127.0.0.1:9696/
node server.mjs
pause
