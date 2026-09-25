#!/usr/bin/env bash
set -e

# ===================================================================
#        SWIFTBALT — COMPILATEUR POUR UBUNTU / LINUX
#   Génère l'AppImage portable (100% sans droits administrateur)
# ===================================================================

echo "==================================================================="
echo "       SWIFTBALT — COMPILATEUR LINUX (APPIMAGE & PORTABLE)"
echo "==================================================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Vérification des prérequis de base
if ! command -v python3 &> /dev/null; then
    echo "[ERREUR] python3 n'est pas installé."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "[ERREUR] Node.js n'est pas installé."
    exit 1
fi

# 2. Préparation du backend Linux avec PyInstaller
echo "1. Empaquetage du backend autonome pour Linux (PyInstaller)..."

# Créer un environnement virtuel si nécessaire
if [ ! -d ".venv-linux" ]; then
    echo "   Création d'un venv utilisateur local..."
    python3 -m venv .venv-linux
    .venv-linux/bin/pip install --upgrade pip
    .venv-linux/bin/pip install -r backend/requirements.txt
    .venv-linux/bin/pip install pyinstaller
fi

echo "   Compilation du binaire swiftbalt-backend..."
.venv-linux/bin/pyinstaller --clean --noconfirm swiftbalt-backend.spec

if [ ! -f "dist/swiftbalt-backend/swiftbalt-backend" ]; then
    echo "[ERREUR] Échec de la compilation du backend autonome Linux."
    exit 1
fi

# Rendre exécutable
chmod +x dist/swiftbalt-backend/swiftbalt-backend

# 3. Copie dans les ressources Tauri et à la racine
echo "   Copie du backend autonome dans les ressources de build..."
mkdir -p "frontend/src-tauri/resources/swiftbalt-backend"
cp -r dist/swiftbalt-backend/* "frontend/src-tauri/resources/swiftbalt-backend/"

mkdir -p "swiftbalt-backend"
cp -r dist/swiftbalt-backend/* "swiftbalt-backend/"

# 4. Compilation du Frontend et de l'AppImage Tauri
echo ""
echo "2. Compilation Tauri (AppImage sans admin & paquet DEB)..."
cd "$SCRIPT_DIR/frontend"
npm install
npm run build

# Build Tauri AppImage et deb
npx @tauri-apps/cli build --bundles appimage,deb

cd "$SCRIPT_DIR"

# 5. Récupération des artefacts à la racine
echo ""
echo "3. Exportation des exécutables Linux..."
APPIMAGE_SRC=$(find frontend/src-tauri/target/release/bundle/appimage/ -name "*.AppImage" 2>/dev/null | head -n 1)
DEB_SRC=$(find frontend/src-tauri/target/release/bundle/deb/ -name "*.deb" 2>/dev/null | head -n 1)

if [ -n "$APPIMAGE_SRC" ] && [ -f "$APPIMAGE_SRC" ]; then
    cp "$APPIMAGE_SRC" "SwiftBalt-x86_64.AppImage"
    chmod +x "SwiftBalt-x86_64.AppImage"
    echo "   -> [OK] SwiftBalt-x86_64.AppImage généré avec succès !"
fi

if [ -n "$DEB_SRC" ] && [ -f "$DEB_SRC" ]; then
    cp "$DEB_SRC" "SwiftBalt_amd64.deb"
    echo "   -> [OK] SwiftBalt_amd64.deb généré avec succès !"
fi

echo ""
echo "==================================================================="
echo "  SUCCÈS ! Les fichiers Linux sont prêts à la racine :"
echo "  -> SwiftBalt-x86_64.AppImage (Double-clic direct, AUCUN droit admin)"
echo "  -> SwiftBalt_amd64.deb       (Paquet Ubuntu standard)"
echo "==================================================================="
