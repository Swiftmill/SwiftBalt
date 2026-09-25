use std::fs;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::thread::sleep;
use std::time::Duration;

fn main() {
    let current_exe = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
    let base_dir = current_exe.parent().unwrap_or_else(|| Path::new("."));

    // 1. Portabilité absolue : tout reste confiné dans ./data
    let data_dir = base_dir.join("data");
    let _ = fs::create_dir_all(data_dir.join("downloads"));
    let _ = fs::create_dir_all(data_dir.join("temp"));
    let _ = fs::create_dir_all(data_dir.join("torrents"));
    let _ = fs::create_dir_all(data_dir.join("thumbnails"));
    let _ = fs::create_dir_all(data_dir.join("profile"));

    // 2. Lancement du moteur Python si non actif
    let mut backend_child: Option<Child> = None;
    if TcpStream::connect("127.0.0.1:8000").is_err() {
        let python_candidates = [
            base_dir.join(".venv").join("bin").join("python3"),
            base_dir.join(".venv").join("bin").join("python"),
            PathBuf::from("python3"),
            PathBuf::from("python"),
        ];

        let mut spawned = false;
        for py in &python_candidates {
            let mut cmd = Command::new(py);
            cmd.args([
                "-m",
                "uvicorn",
                "app.main:app",
                "--app-dir",
                "backend",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
            ]);
            cmd.env("SWIFTBALT_DATA_DIR", &data_dir);
            cmd.current_dir(base_dir);

            if let Ok(child) = cmd.spawn() {
                backend_child = Some(child);
                spawned = true;
                break;
            }
        }

        if !spawned {
            eprintln!("Erreur: Impossible de démarrer le moteur Python SwiftBalt.");
            return;
        }

        // Attendre que le serveur 127.0.0.1:8000 soit prêt (jusqu'à 6 secondes)
        for _ in 0..30 {
            if TcpStream::connect("127.0.0.1:8000").is_ok() {
                break;
            }
            sleep(Duration::from_millis(200));
        }
    }

    let url = "http://127.0.0.1:8000";
    let profile_dir = data_dir.join("profile");

    // 3. Ouvrir dans une fenêtre d'application autonome (App Mode sans barre d'adresse ni onglet)
    let browsers = [
        "google-chrome",
        "google-chrome-stable",
        "chromium-browser",
        "chromium",
        "brave-browser",
        "microsoft-edge",
    ];

    let mut browser_launched = false;
    for b in browsers {
        let app_arg = format!("--app={}", url);
        let user_data = format!("--user-data-dir={}", profile_dir.display());
        let res = Command::new(b)
            .args([
                &app_arg,
                &user_data,
                "--window-size=1120,760",
                "--no-first-run",
                "--no-default-browser-check",
            ])
            .spawn();

        if let Ok(mut c) = res {
            browser_launched = true;
            let _ = c.wait(); // Attend la fermeture de la fenêtre par l'utilisateur
            break;
        }
    }

    // Si aucun navigateur Chromium n'est installé, ouverture dans le navigateur par défaut
    if !browser_launched {
        if let Ok(mut c) = Command::new("xdg-open").arg(url).spawn() {
            let _ = c.wait();
        }
    }

    // Arrêt propre du moteur en arrière-plan à la fermeture
    if let Some(mut child) = backend_child {
        let _ = child.kill();
    }
}
