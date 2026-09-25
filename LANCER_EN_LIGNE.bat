@echo off
title SwiftBalt - Serveur & Acces En Ligne
color 0b
echo ===================================================
echo           SWIFTBALT - DEMARRAGE EN LIGNE
echo ===================================================
echo.
echo [1/3] Verification du build frontend...
cd /d "%~dp0frontend"
call npm run build
cd /d "%~dp0"

echo.
echo [2/3] Lancement du serveur backend SwiftBalt...
start /b python -m uvicorn app.main:app --app-dir backend --port 8000 --host 127.0.0.1 > nul 2>&1
timeout /t 2 /nobreak > nul

echo.
echo [3/3] Creation du tunnel securise Cloudflare...
echo.
echo ===================================================
echo  TON SITE EST EN LIGNE ! REGARDE L'URL CI-DESSOUS :
echo ===================================================
echo.
cloudflared tunnel --url http://127.0.0.1:8000
pause
