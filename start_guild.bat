@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   AI Guild "Gekko Koubou" - GUILD HALL
echo   Open in browser: http://127.0.0.1:8788
echo ============================================================
start "" http://127.0.0.1:8788
python guild\server.py
pause
