@echo off
title SwiftBalt ? G?n?ration du Setup Windows (.exe)
color 0b
echo ===================================================================
echo        SWIFTBALT ? GENERATEUR DE SETUP & INSTALLATEUR WINDOWS
echo ===================================================================
echo.
echo  1. Empaquetage du backend autonome (PyInstaller)...
cd /d "%~dp0"
echo     Compilation du moteur Python / yt-dlp / BitTorrent...
call py -3.13 -m PyInstaller --clean --noconfirm swiftbalt-backend.spec
if errorlevel 1 (
    echo [ERREUR] Echec de la compilation du backend.
    pause
    exit /b 1
)

echo     Copie des ressources dans l'application Tauri et a la racine...
xcopy /E /I /Y "dist\swiftbalt-backend" "frontend\src-tauri\resources\swiftbalt-backend" >nul
xcopy /E /I /Y "dist\swiftbalt-backend" "%~dp0swiftbalt-backend" >nul

echo.
echo  2. Compilation Rust + React (Frontend 100%% integre + NSIS Setup)...
cd /d "%~dp0frontend"
call npx @tauri-apps/cli build --bundles nsis
if errorlevel 1 (
    echo [ERREUR] Echec du build Tauri.
    pause
    exit /b 1
)

echo.
echo  3. Copie des executables a la racine...
copy /Y "%~dp0frontend\src-tauri\target\release\bundle\nsis\SwiftBalt_1.0.0_x64-setup.exe" "%~dp0SwiftBalt_Setup.exe" >nul
copy /Y "%~dp0frontend\src-tauri\target\release\swiftbalt.exe" "%~dp0SwiftBalt.exe" >nul

echo.
echo ===================================================================
echo   SUCCES ! Les executables Windows sont a jour a la racine :
echo   -> SwiftBalt.exe        (Application directe)
echo   -> SwiftBalt_Setup.exe  (Installeur Windows avec desinstalleur)
echo ===================================================================
echo.
pause
