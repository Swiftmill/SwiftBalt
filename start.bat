@echo off
title SwiftBalt
color 0A

echo.
echo  ==========================================
echo            SwiftBalt  v1.0
echo        OmniDownloader ^& MediaHub
echo  ==========================================
echo.

cd /d "%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
    py --version >nul 2>&1
    if errorlevel 1 (
        color 0C
        echo [ERREUR] Python n est pas accessible dans le PATH.
        echo Installe Python 3.10+ en cochant "Add python.exe to PATH".
        echo.
        pause
        exit /b 1
    )
    set "PY_CMD=py"
) else (
    set "PY_CMD=python"
)

node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERREUR] Node.js non trouve. Installe Node.js 18+.
    echo.
    pause
    exit /b 1
)

call npm --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERREUR] npm non trouve. Installe Node.js / npm.
    echo.
    pause
    exit /b 1
)

echo [1/3] Demarrage du backend (port 8000)...
start "SwiftBalt - Backend" cmd /k "%PY_CMD% -m uvicorn app.main:app --app-dir backend --port 8000 --host 127.0.0.1"

ping 127.0.0.1 -n 4 >nul

echo [2/3] Demarrage du frontend (port 5173)...
start "SwiftBalt - Frontend" cmd /k "cd frontend && call npm run dev"

ping 127.0.0.1 -n 4 >nul

echo [3/3] Ouverture dans votre navigateur...
start "" "http://localhost:5173"

echo.
echo ==========================================
echo  SwiftBalt est lance avec succes !
echo.
echo  Frontend :  http://localhost:5173
echo  Backend  :  http://127.0.0.1:8000
echo  API docs :  http://127.0.0.1:8000/docs
echo ==========================================
echo.
echo Laisse les fenetres ouvertes.
echo.
pause