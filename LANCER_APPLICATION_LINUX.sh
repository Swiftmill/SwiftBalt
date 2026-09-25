#!/usr/bin/env bash
# ===================================================================
#        SWIFTBALT — LANCEUR DIRECT PORTABLE POUR LINUX
#   Exécute directement SwiftBalt sans installation préalable
# ===================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Si une AppImage est présente
if [ -f "$SCRIPT_DIR/SwiftBalt-x86_64.AppImage" ]; then
    chmod +x "$SCRIPT_DIR/SwiftBalt-x86_64.AppImage"
    exec "$SCRIPT_DIR/SwiftBalt-x86_64.AppImage" "$@"
fi

# 2. Si le binaire Tauri natif est compilé
if [ -f "$SCRIPT_DIR/frontend/src-tauri/target/release/swiftbalt" ]; then
    chmod +x "$SCRIPT_DIR/frontend/src-tauri/target/release/swiftbalt"
    exec "$SCRIPT_DIR/frontend/src-tauri/target/release/swiftbalt" "$@"
fi

# 3. Mode portable / développement : lance le backend Python et l'interface
echo "Lancement de SwiftBalt en mode portable..."

# Démarrer le backend Python s'il n'est pas déjà actif
if ! curl -s http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
    echo "Démarrage du moteur Python SwiftBalt..."
    python3 -m uvicorn app.main:app --app-dir backend --port 8000 --host 127.0.0.1 &
    BACKEND_PID=$!
    trap "kill $BACKEND_PID 2>/dev/null" EXIT
    sleep 1
fi

# Lancer le frontend (via navigateur ou client tauri dev)
if command -v xdg-open &> /dev/null; then
    echo "Ouverture de l'application..."
    xdg-open "http://127.0.0.1:8000"
else
    echo "SwiftBalt est accessible sur : http://127.0.0.1:8000"
fi

wait
