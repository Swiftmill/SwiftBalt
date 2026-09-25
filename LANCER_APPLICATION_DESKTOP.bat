@echo off
title SwiftBalt — Application Desktop Native
color 0b
echo ===================================================
echo        SWIFTBALT — APPLICATION DESKTOP NATIVE
echo ===================================================
echo.
echo  Demarrage de l'application bureau (Windows/Linux native)...
echo  - Moteur ultra-leger Tauri 2.0 (Rust)
echo  - Pas d'Electron, empreinte RAM minimale (~30 Mo)
echo  - Demarrage instantane
echo.
cd /d "%~dp0frontend"
call npx @tauri-apps/cli dev

