# SwiftBalt - Universal Media Platform & Downloader

**SwiftBalt** est une plateforme web moderne, minimaliste et ultra-rapide inspirée de *cobalt.tools*, permettant de détecter, prévisualiser, visionner, convertir et télécharger des contenus médias publics autorisés depuis des dizaines de plateformes (TikTok, Twitch, YouTube, Twitter/X, Instagram, Dailymotion, Bilibili, Reddit, etc.), ainsi que de gérer des liens Magnet/Torrents légaux et des téléchargements de fichiers directs.

---

## 🌟 Fonctionnalités Principales

- **Détection Automatique d'URL** : Analyse instantanée des liens collés et sélection automatique du provider adapté.
- **Support Multi-Plateformes** : YouTube, TikTok, Twitch, Twitter/X, Instagram, Facebook, Dailymotion, Bilibili, Reddit, SoundCloud, Streamable, Vimeo, VK, Kick, Threads, Mastodon, et fichiers d'URL directes.
- **Aperçu & Lecteur Média Intégré** : Métadonnées publiques, miniature, titre, auteur, durée, et lecteur vidéo/audio HTML5/HLS/DASH personnalisé (avec vitesse de lecture, Picture-in-Picture, et plein écran).
- **Convertisseur FFmpeg** : Conversion vers MP4, WebM, MKV, MP3, M4A, WAV, FLAC, AAC, Opus avec contrôle de débit/qualité.
- **Twitch Hub** : Module dédié aux VODs, Replays et Clips publics Twitch avec sélection de qualité et recherche.
- **Torrent Center** : Moteur BitTorrent basé sur `libtorrent` pour la gestion des fichiers `.torrent` et liens `magnet` distribués légalement.
- **Gestionnaire de File d'Attente & WebSockets** : Suivi en temps réel de la progression, vitesse (KB/s - MB/s), ETA et état des téléchargements.
- **Historique & Favoris** : Sauvegarde des téléchargements passés et liens favoris avec possibilité de relance ou suppression.
- **Sécurité Anti-SSRF** : Validation rigoureuse des URLs, blocage des adresses IP privées/locales (`127.0.0.1`, `10.0.0.0/8`, etc.), sanitisation des noms de fichiers.
- **CLI Dédiée (`swiftbalt` & `mediahub`)** : Utilitaire en ligne de commande complet pour analyser, télécharger et gérer vos fichiers depuis le terminal.

---

## 🚀 Installation & Démarrage Rapide

### 1. Prérequis
- **Python 3.10+**
- **Node.js 18+** & **npm**
- **FFmpeg**

### 2. Démarrage Rapide avec Docker

```bash
git clone https://github.com/swiftbalt/swiftbalt.git
cd swiftbalt
docker compose up -d
```

L'interface web est ensuite accessible sur : `http://localhost:5173` (ou `http://localhost:8000`).

---

### 3. Installation Manuelle (Développement)

#### Backend (FastAPI & Python)
```bash
# Installation des dépendances Python et du CLI
pip install -r requirements.txt
pip install -e .

# Lancement du serveur backend
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

#### Frontend (Vite + React + Tailwind CSS)
```bash
cd frontend
npm install
npm run dev
```

Accédez à `http://localhost:5173`.

---

## 💻 Utilisation de la CLI (`swiftbalt` / `mediahub`)

Une fois installée (`pip install -e .`), la commande `swiftbalt` (ou son alias `mediahub`) est disponible directement dans votre terminal :

```bash
# Analyser une URL
swiftbalt analyze https://www.youtube.com/watch?v=dQw4w9WgXcQ

# Télécharger une vidéo ou un fichier MP3
swiftbalt download https://www.tiktok.com/@user/video/123456 --format mp3

# Ajouter un torrent magnet
swiftbalt torrent "magnet:?xt=urn:btih:..."

# Consulter l'historique
swiftbalt history

# Lister les fournisseurs actifs
swiftbalt providers
```

---

## 🛡️ Sécurité & Anti-Abus

SwiftBalt intègre des mesures de sécurité de niveau entreprise :
- **Protection SSRF** : Interdiction d'accès aux hôtes locaux (`localhost`) et plages d'IP privées (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`).
- **Sanitisation Path Traversal** : Élimination des caractères dangereux (`../`, `\`, `:`).
- **Pas de contournement DRM** : SwiftBalt respecte scrupuleusement les protections de contenu et ne télécharge que les contenus publiquement accessibles et autorisés.

---

## 🧪 Tests Unitaires & d'Intégration

Pour exécuter la suite de tests :

```bash
pytest tests/
```

---

## 📜 Licence & Crédits

Projet développé avec passion pour la communauté Open-Source.
Modèle UI inspiré de *cobalt.tools*.
