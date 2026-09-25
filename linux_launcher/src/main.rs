use std::fs;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread::sleep;
use std::time::Duration;

fn main() {
    let current_exe = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
    let base_dir = current_exe.parent().unwrap_or_else(|| Path::new("."));

    // 0. Si l'AppImage ou binaire autonome natif SwiftBalt est présent, l'exécuter directement
    let native_candidates = [
        base_dir.join("SwiftBalt-x86_64.AppImage"),
        base_dir.join("swiftbalt"),
    ];

    for candidate in &native_candidates {
        if candidate.exists() {
            println!("Lancement du binaire natif autonome : {:?}", candidate);
            let _ = Command::new("chmod").args(["+x", candidate.to_str().unwrap()]).status();
            let args: Vec<String> = std::env::args().skip(1).collect();
            if let Ok(mut child) = Command::new(candidate).args(&args).spawn() {
                let _ = child.wait();
                return;
            }
        }
    }

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

        let log_file = fs::File::create(data_dir.join("backend.log")).ok();

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

            if let Some(ref f) = log_file {
                if let Ok(f_out) = f.try_clone() {
                    cmd.stdout(Stdio::from(f_out));
                }
                if let Ok(f_err) = f.try_clone() {
                    cmd.stderr(Stdio::from(f_err));
                }
            }

            if let Ok(child) = cmd.spawn() {
                backend_child = Some(child);
                spawned = true;
                break;
            }
        }

        if !spawned {
            eprintln!("[ERREUR] Impossible de lancer Python 3 pour démarrer SwiftBalt.");
            eprintln!("Veuillez utiliser l'AppImage autonome SwiftBalt-x86_64.AppImage");
            return;
        }

        // Attendre que le serveur 127.0.0.1:8000 soit prêt (jusqu'à 8 secondes)
        let mut server_ready = false;
        for _ in 0..40 {
            if TcpStream::connect("127.0.0.1:8000").is_ok() {
                server_ready = true;
                break;
            }
            sleep(Duration::from_millis(200));
        }

        if !server_ready {
            eprintln!("[ERREUR] Le serveur SwiftBalt (127.0.0.1:8000) n'a pas répondu à temps.");
            eprintln!("Consultez le fichier data/backend.log pour voir le message d'erreur.");
            eprintln!("Conseil : Lancez directement SwiftBalt-x86_64.AppImage sans Python requis.");
            if let Some(mut child) = backend_child {
                let _ = child.kill();
            }
            return;
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
