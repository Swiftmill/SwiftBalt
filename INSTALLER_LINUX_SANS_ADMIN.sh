#!/usr/bin/env bash
# ===================================================================
#        SWIFTBALT — INSTALLATEUR UTILISATEUR SANS DROITS ROOT
#  Installe l'application dans ~/.local sans jamais demander 'sudo'
# ===================================================================

set -e

APP_NAME="SwiftBalt"
APP_DIR="$HOME/.local/share/swiftbalt"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==================================================================="
echo "   INSTALLATION DE SWIFTBALT POUR UBUNTU / LINUX (SANS ADMIN)"
echo "==================================================================="
echo ""
echo "Installation pour l'utilisateur actuel ($USER)..."
echo "Aucun mot de passe administrateur (sudo) ne sera demandé !"
echo ""

# Création des dossiers utilisateur standard XDG
mkdir -p "$APP_DIR"
mkdir -p "$BIN_DIR"
mkdir -p "$DESKTOP_DIR"
mkdir -p "$ICON_DIR"

# 1. Copie du binaire principal (AppImage ou exécutable direct)
if [ -f "$SCRIPT_DIR/SwiftBalt-x86_64.AppImage" ]; then
    echo "1. Copie de l'AppImage..."
    cp "$SCRIPT_DIR/SwiftBalt-x86_64.AppImage" "$APP_DIR/swiftbalt"
    chmod +x "$APP_DIR/swiftbalt"
elif [ -f "$SCRIPT_DIR/frontend/src-tauri/target/release/swiftbalt" ]; then
    echo "1. Copie des fichiers compilés..."
    cp "$SCRIPT_DIR/frontend/src-tauri/target/release/swiftbalt" "$APP_DIR/swiftbalt"
    chmod +x "$APP_DIR/swiftbalt"
    if [ -d "$SCRIPT_DIR/swiftbalt-backend" ]; then
        cp -r "$SCRIPT_DIR/swiftbalt-backend" "$APP_DIR/"
    fi
else
    echo "1. Configuration en mode script portable..."
    cp -r "$SCRIPT_DIR"/* "$APP_DIR/"
    chmod +x "$APP_DIR/LANCER_APPLICATION_LINUX.sh" 2>/dev/null || true
fi

# 2. Copie de l'icône
if [ -f "$SCRIPT_DIR/frontend/src-tauri/icons/128x128@2x.png" ]; then
    cp "$SCRIPT_DIR/frontend/src-tauri/icons/128x128@2x.png" "$ICON_DIR/swiftbalt.png"
elif [ -f "$SCRIPT_DIR/frontend/src-tauri/icons/128x128.png" ]; then
    cp "$SCRIPT_DIR/frontend/src-tauri/icons/128x128.png" "$ICON_DIR/swiftbalt.png"
fi

# 3. Création du lanceur dans ~/.local/bin
ln -sf "$APP_DIR/swiftbalt" "$BIN_DIR/swiftbalt" 2>/dev/null || true

# 4. Création du raccourci Bureau & Menu des Applications
cat <<EOF > "$DESKTOP_DIR/swiftbalt.desktop"
[Desktop Entry]
Name=SwiftBalt
Comment=Téléchargeur universel ultra-rapide & Anime Hub
Exec=$APP_DIR/swiftbalt
Icon=swiftbalt
Terminal=false
Type=Application
Categories=Network;AudioVideo;Video;
StartupWMClass=SwiftBalt
EOF

chmod +x "$DESKTOP_DIR/swiftbalt.desktop"

# Rafraîchir la base d'applications de bureau si l'utilitaire est présent
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

echo ""
echo "==================================================================="
echo "  INSTALLATION RÉUSSIE !"
echo "  - L'application est installée dans : $APP_DIR"
echo "  - Le raccourci est disponible dans votre menu des applications !"
echo "  - Vous pouvez aussi la lancer dans le terminal avec : swiftbalt"
echo "==================================================================="
