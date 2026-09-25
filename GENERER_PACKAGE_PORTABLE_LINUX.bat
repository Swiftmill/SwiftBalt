@echo off
title SwiftBalt — Generateur Portable Linux
color 0b
echo ===================================================================
echo     SWIFTBALT — GENERATION DE L'APPLICATION PORTABLE LINUX
echo ===================================================================
echo.
cd /d "%~dp0"

echo 1. Compilation du frontend React...
cd frontend
call npm run build
cd ..

echo 2. Compilation du binaire natif Linux SwiftBalt (logo ecrou)...
cd linux_launcher
set RUSTFLAGS=-C linker-flavor=ld.lld -C linker=rust-lld
call cargo build --target x86_64-unknown-linux-musl --release
cd ..

echo 3. Assemblage du dossier portable...
xcopy /E /I /Y "backend" "SwiftBalt-Linux-Portable\backend" >nul
xcopy /E /I /Y "frontend\dist" "SwiftBalt-Linux-Portable\dist" >nul
copy /Y "frontend\src-tauri\icons\128x128@2x.png" "SwiftBalt-Linux-Portable\swiftbalt.png" >nul
copy /Y "linux_launcher\target\x86_64-unknown-linux-musl\release\linux_launcher" "SwiftBalt-Linux-Portable\SwiftBalt" >nul

echo 4. Creation des archives avec permissions executables (0755)...
py -3.13 -c "
import os, zipfile, tarfile

portable_dir = 'SwiftBalt-Linux-Portable'

with tarfile.open('SwiftBalt-Linux-Portable.tar.gz', 'w:gz') as tar:
    for root, dirs, files in os.walk(portable_dir):
        for f in files:
            full_p = os.path.join(root, f)
            rel_p = os.path.relpath(full_p, '.')
            ti = tar.gettarinfo(full_p, arcname=rel_p)
            ti.mode = 0o755 if f in ['SwiftBalt', 'Lancer_SwiftBalt.sh', 'Creer_Raccourci_Bureau.sh'] else 0o644
            with open(full_p, 'rb') as fp:
                tar.addfile(ti, fp)

with zipfile.ZipFile('SwiftBalt-Linux-Portable.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(portable_dir):
        for f in files:
            full_p = os.path.join(root, f)
            rel_p = os.path.relpath(full_p, '.')
            zi = zipfile.ZipInfo(rel_p)
            zi.external_attr = (0o755 << 16) if f in ['SwiftBalt', 'Lancer_SwiftBalt.sh', 'Creer_Raccourci_Bureau.sh'] else (0o644 << 16)
            with open(full_p, 'rb') as fp:
                zf.writestr(zi, fp.read())
"

echo.
echo ===================================================================
echo  SUCCES ! Les packages portables Linux sont prets :
echo  -> SwiftBalt-Linux-Portable.tar.gz (Recommande pour garder le double-clic)
echo  -> SwiftBalt-Linux-Portable.zip
echo  -> Binaire natif avec logo ecrou : SwiftBalt-Linux-Portable\SwiftBalt
echo ===================================================================
echo.
pause
