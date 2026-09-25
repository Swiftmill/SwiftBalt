# ⚡ SwiftBalt (MediaHub / OmniDownloader)

> Plateforme web universelle, moderne, modulaire et hautement performante inspirée de l'esthétique épurée de **cobalt.tools**, **Linear** et **Vercel**.
> Supporte l'analyse et le téléchargement de vidéos, audios, streams, fichiers directs et distributions torrents légales pour plus de 25 plateformes avec lecteur multimédia intégré et conversion FFmpeg temps réel.

---

## 🚀 Fonctionnalités Clés

- **Détection Automatique d'URL** : Détection instantanée dès la frappe ou le collage (`Ctrl + V`).
- **25+ Plateformes Supportées** :
  - *Médias Publics* : YouTube, TikTok, Twitch, Vimeo, SoundCloud, Reddit, X (Twitter), Instagram, Facebook, Dailymotion, Bluesky, Kick, Loom, Bilibili, VK, OK.ru, Rutube, Snapchat, Tumblr, Newgrounds, Mastodon, Discord CDN, etc.
  - *Fichiers Directs* : MP4, WebM, MKV, MP3, WAV, FLAC, ZIP, RAR, 7Z, PDF, ISO, APK, EXE avec support des requêtes de plage (`HTTP Range`).
- **Lecteur Multimédia Intégré** :
  - Support natif MP4, WebM, audio et flux HLS / m3u8.
  - Contrôleur de vitesse (0.5x à 2.0x), Picture-in-Picture, Plein écran, sélection des pistes audio et sous-titres (`VTT`/`SRT`).
  - Raccourcis clavier complets (`Espace`, `F`, `M`, `← / →`).
- **Twitch Hub Dédié** :
  - Gestionnaire de Streams, VODs et Clips publics.
  - Sélection fine de résolutions (1080p60, 720p60, 480p, audio only) et file spéciale VODs longues.
- **Torrent Center (Distributions Légales)** :
  - Prise en charge des liens magnet et fichiers `.torrent` pour les distributions open-source (Linux ISOs, médias Creative Commons).
  - Vitesse descendante/montante, graines (seeds), pairs (peers), ETA et gestion de file.
- **Download Manager Temps Réel** :
  - Synchronisation instantanée via **WebSocket** (0 polling agressif).
  - Gestion des statuts : `queued`, `processing`, `downloading`, `merging`, `converting`, `completed`, `paused`, `failed`, `cancelled`.
  - Pause, reprise, relance, annulation et suppression.
- **Moteur de Transcodage FFmpeg Sécurisé** :
  - Fusion automatique flux vidéo haute définition + flux audio sans perte.
  - Conversion Video -> MP4, WebM, MKV et Audio -> MP3, M4A, FLAC, WAV, Opus.
- **Sécurité et Isolation Stricte (Anti-SSRF)** :
  - Résolution DNS préalable bloquant les adresses IP privées (`127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, IPv6 loopback et unique local).
  - Assainissement des noms de fichiers contre les attaques par traversée (`path traversal`) et noms réservés Windows.
  - Arguments structurés pour FFmpeg sans exécution de commandes shell directes (`no shell=True`).
- **CLI Complète** : Interface en ligne de commande intégrée (`python -m app.cli.cli`).

---

## 🛠️ Prérequis

1. **Python** : Version 3.10 ou supérieure (3.11, 3.12 ou 3.13 recommandées).
2. **Node.js** : Version 18 ou supérieure (v20+ recommandée) et `npm`.
3. **FFmpeg** :
   - *Windows* : Télécharger depuis [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) ou via `winget install Gyan.FFmpeg`, puis vérifier que `ffmpeg` est dans le `PATH`.
   - *Linux / Ubuntu / Debian* : `sudo apt update && sudo apt install ffmpeg -y`
   - *macOS* : `brew install ffmpeg`

---

## ⚡ Installation & Démarrage Rapide

### 1. Installation des Dépendances

```bash
# Cloner le dépôt
git clone <URL_DU_REPO> SwiftBalt
cd SwiftBalt

# Installation Backend (Python)
pip install -r backend/requirements.txt

# Installation Frontend (React / Vite)
cd frontend
npm install
cd ..
```

---

### 2. Lancement en Mode Développement

Ouvre deux terminaux :

**Terminal 1 : Backend FastAPI**
```bash
# Depuis la racine du projet
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```
*Le backend démarre sur `http://127.0.0.1:8000` (API & Swagger sur `/docs`).*

**Terminal 2 : Frontend Vite**
```bash
cd frontend
npm run dev
```
*Le frontend démarre sur `http://localhost:5173` et communique automatiquement avec le backend via proxy.*

---

### 3. Lancement en Mode Production (Monolithique)

Le backend Python est configuré pour servir directement le build optimisé du frontend sur un port unique :

```bash
# 1. Compiler le frontend
cd frontend
npm run build
cd ..

# 2. Lancer l'application unifiée
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```
*Accède directement à `http://localhost:8000`.*

---

### 4. Lancement avec Docker (One-Click)

Un fichier `Dockerfile` multi-stage et un `docker-compose.yml` sont inclus :

```bash
docker compose up --build
```
L'application complète sera accessible sur `http://localhost:8000` avec FFmpeg préinstallé dans le conteneur.

---

### 5. 🐧 Version Ubuntu / Linux (100% Sans Droits Administrateur)

SwiftBalt est entièrement compatible **Ubuntu Linux** sans avoir besoin de droits `sudo` ou administrateur :

#### Option A : Format AppImage (Recommandé - Zéro Installation)
L'AppImage est un binaire autonome qui s'exécute directement sur Ubuntu :
```bash
chmod +x SwiftBalt-x86_64.AppImage
./SwiftBalt-x86_64.AppImage
```
*Aucun mot de passe root requis, aucune dépendance externe.*

#### Option B : Installation Utilisateur sans Sudo (`~/.local`)
Pour intégrer SwiftBalt dans votre menu d'applications Ubuntu sans droits admin :
```bash
chmod +x INSTALLER_LINUX_SANS_ADMIN.sh
./INSTALLER_LINUX_SANS_ADMIN.sh
```
*Installe l'application dans `~/.local/share/swiftbalt` et ajoute l'icône dans votre dock et lanceur GNOME/Ubuntu.*

#### Option C : Compilation directe sur Ubuntu
```bash
chmod +x COMPILER_APPLICATION_LINUX.sh
./COMPILER_APPLICATION_LINUX.sh
```

---

## ⚙️ Configuration (.env)

Copie le fichier d'exemple pour ajuster les paramètres selon tes besoins :

```bash
cp .env.example .env
```

| Variable | Description | Valeur par défaut |
|---|---|---|
| `SWIFTBALT_APP_NAME` | Nom de l'application | `SwiftBalt` |
| `SWIFTBALT_PORT` | Port d'écoute du serveur | `8000` |
| `SWIFTBALT_MAX_CONCURRENT_DOWNLOADS` | Téléchargements simultanés | `3` |
| `SWIFTBALT_DEFAULT_QUALITY` | Résolution par défaut | `1080p` |
| `SWIFTBALT_DEFAULT_FORMAT` | Format de conteneur par défaut | `mp4` |
| `SWIFTBALT_AUTO_MERGE_STREAMS` | Fusion automatique audio/vidéo | `true` |
| `SWIFTBALT_DELETE_TEMP_FILES` | Nettoyage des fichiers `.part` | `true` |
| `SWIFTBALT_FFMPEG_PATH` | Chemin d'accès au binaire FFmpeg | `ffmpeg` |

---

## 🧩 Guide : Comment Ajouter un Nouveau Provider

L'architecture est entièrement découplée grâce à l'interface `BaseProvider` située dans `backend/app/providers/base.py`.

### Étape 1 : Créer la classe du Provider
Crée un fichier dans `backend/app/providers/mon_service.py` :

```python
from typing import Dict, Any, List
from app.providers.base import BaseProvider

class MonServiceProvider(BaseProvider):
    id = "monservice"
    name = "Mon Service"
    icon = "video"
    domains = ["monservice.com", "m.monservice.com"]
    capabilities = ["video", "audio", "1080p"]
    status = "operational"

    async def get_metadata(self, url: str) -> Dict[str, Any]:
        # Logique d'extraction des métadonnées publiques
        return {
            "title": "Titre du média",
            "author": "Auteur",
            "duration": 120,
            "thumbnail": "https://...",
            "platform": self.name,
            "type": "video"
        }

    async def get_streams(self, url: str) -> List[Dict[str, Any]]:
        return [{
            "format_id": "hd",
            "format": "mp4",
            "quality": "1080p",
            "url": "https://..."
        }]
```

### Étape 2 : Enregistrer le Provider dans le Registre
Dans `backend/app/providers/registry.py`, importe et enregistre ton provider :

```python
from app.providers.mon_service import MonServiceProvider

# Dans _initialize_default_providers() :
self.register(MonServiceProvider())
```
*Le provider sera immédiatement pris en compte dans l'auto-détection, l'API `/api/providers` et la page web dédiée.*

---

## 💻 Utilisation de la CLI

SwiftBalt intègre une interface en ligne de commande basée sur `typer` et `rich` :

```bash
# Vérifier la liste des fournisseurs et leur statut
python -m app.cli.cli providers

# Inspecter et extraire les métadonnées d'une URL
python -m app.cli.cli analyze "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Télécharger un média en choisissant le format et la qualité
python -m app.cli.cli download "https://example.com/video.mp4" --format mp4 --quality 1080p

# Lancer un téléchargement torrent via magnet
python -m app.cli.cli torrent "magnet:?xt=urn:btih:..."

# Consulter l'historique des téléchargements
python -m app.cli.cli history
```

---

## 🧪 Lancement des Tests

Des tests unitaires automatisés couvrent la sécurité SSRF, l'auto-détection des providers, et l'API FastAPI :

```bash
# Lancer l'ensemble des tests pytest
python -m pytest
```

---

## 🛡️ Sécurité & Légalité

- **Respect strict des droits** : SwiftBalt est conçu exclusivement pour télécharger du contenu légalement accessible et distribué publiquement sans contournement de DRM, paywall, chiffrement propriétaire ou authentification privée.
- **Anti-SSRF** : Toutes les requêtes HTTP sont préalablement inspectées au niveau DNS. L'accès à `localhost`, `127.0.0.1`, aux sous-réseaux RFC1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) ou aux adresses link-local / multicast est formellement bloqué.
- **Sécurité du Système de Fichiers** : Tous les noms de fichiers proposés par des serveurs distants sont assainis pour interdire les traversées de répertoire (`../`) et les noms réservés du système d'exploitation.
