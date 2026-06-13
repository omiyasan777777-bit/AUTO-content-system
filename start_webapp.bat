@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   AUTO-content-system  Web UI  (default: FULL-AUTO)
echo   Full-auto runs every command without confirmation.
echo   Open in browser: http://127.0.0.1:8787
echo ============================================================
set ACS_ALLOW_FULL=1
start "" http://127.0.0.1:8787
python webapp\server.py
pause
