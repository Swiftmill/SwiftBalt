use std::net::TcpStream;
use std::process::{Child, Command};
use std::sync::Mutex;

use std::path::PathBuf;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

static BACKEND_CHILD: Mutex<Option<Child>> = Mutex::new(None);

#[tauri::command]
async fn pick_folder(default_path: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::AsyncFileDialog::new().set_title("Choisir le dossier de téléchargement");
    if let Some(ref p) = default_path {
        dialog = dialog.set_directory(p);
    }
    let handle = dialog.pick_folder().await;
    Ok(handle.map(|h| h.path().to_string_lossy().to_string()))
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32")
            .args(&["url.dll,FileProtocolHandler", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn install_and_restart_update(
    window: tauri::Window,
    download_url: String,
    expected_size: Option<u64>,
) -> Result<(), String> {
    use std::io::Write;
    use tauri::Emitter;

    let temp_dir = std::env::temp_dir();
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let _exe_name = current_exe
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "swiftbalt.exe".to_string());

    let is_nsis_installer = download_url.to_lowercase().contains("setup")
        || current_exe
            .to_string_lossy()
            .to_lowercase()
            .contains("appdata\\local\\programs");

    let target_temp_file = if is_nsis_installer {
        temp_dir.join("SwiftBalt_Update_Setup.exe")
    } else {
        temp_dir.join("SwiftBalt_Update_New.exe")
    };

    // Remove any leftover temp file
    let _ = std::fs::remove_file(&target_temp_file);

    // Initial progress event
    let _ = window.emit(
        "update-progress",
        serde_json::json!({
            "status": "downloading",
            "percent": 5,
            "downloaded": 0,
            "total": expected_size.unwrap_or(0)
        }),
    );

    // Spawn download via curl
    #[cfg(target_os = "windows")]
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let mut curl_cmd = Command::new("curl.exe");
    curl_cmd
        .arg("-L")
        .arg("-s")
        .arg("-o")
        .arg(&target_temp_file)
        .arg(&download_url);

    #[cfg(target_os = "windows")]
    curl_cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = curl_cmd
        .spawn()
        .map_err(|e| format!("Impossible de démarrer le téléchargement: {}", e))?;

    let target_temp_clone = target_temp_file.clone();
    let window_clone = window.clone();
    let total_bytes = expected_size.unwrap_or(0);

    // Progress monitoring loop
    let progress_handle = std::thread::spawn(move || {
        while let Ok(None) = child.try_wait() {
            if let Ok(meta) = std::fs::metadata(&target_temp_clone) {
                let downloaded = meta.len();
                let pct = if total_bytes > 0 {
                    ((downloaded as f64 / total_bytes as f64) * 92.0).clamp(5.0, 95.0) as u32
                } else {
                    50
                };
                let _ = window_clone.emit(
                    "update-progress",
                    serde_json::json!({
                        "status": "downloading",
                        "percent": pct,
                        "downloaded": downloaded,
                        "total": total_bytes
                    }),
                );
            }
            std::thread::sleep(std::time::Duration::from_millis(150));
        }
        child.wait()
    });

    let exit_status = progress_handle
        .join()
        .map_err(|_| "Erreur du thread de progression".to_string())?
        .map_err(|e| format!("Échec du processus de téléchargement: {}", e))?;

    if !exit_status.success() || !target_temp_file.exists() {
        let _ = window.emit(
            "update-progress",
            serde_json::json!({
                "status": "error",
                "percent": 0,
                "message": "Erreur lors du téléchargement de la mise à jour."
            }),
        );
        return Err("Échec du téléchargement".to_string());
    }

    // Step 2: Installing state
    let _ = window.emit(
        "update-progress",
        serde_json::json!({
            "status": "installing",
            "percent": 98,
            "message": "Installation des fichiers en cours..."
        }),
    );

    std::thread::sleep(std::time::Duration::from_millis(600));

    // Step 3: Restarting state
    let _ = window.emit(
        "update-progress",
        serde_json::json!({
            "status": "restarting",
            "percent": 100,
            "message": "Redémarrage de SwiftBalt..."
        }),
    );

    std::thread::sleep(std::time::Duration::from_millis(400));

    // Platform-specific restart and apply
    #[cfg(target_os = "windows")]
    {
        let script_path = temp_dir.join("swiftbalt_restart_updater.bat");
        let mut script = std::fs::File::create(&script_path).map_err(|e| e.to_string())?;

        if is_nsis_installer {
            writeln!(script, "@echo off").map_err(|e| e.to_string())?;
            writeln!(script, "timeout /t 1 /nobreak > nul").map_err(|e| e.to_string())?;
            writeln!(
                script,
                "start \"\" \"{}\" /S",
                target_temp_file.to_string_lossy()
            )
            .map_err(|e| e.to_string())?;
            writeln!(script, "exit").map_err(|e| e.to_string())?;
        } else {
            writeln!(script, "@echo off").map_err(|e| e.to_string())?;
            writeln!(script, "timeout /t 1 /nobreak > nul").map_err(|e| e.to_string())?;
            writeln!(script, ":retry").map_err(|e| e.to_string())?;
            writeln!(
                script,
                "copy /y \"{}\" \"{}\" > nul 2>&1",
                target_temp_file.to_string_lossy(),
                current_exe.to_string_lossy()
            )
            .map_err(|e| e.to_string())?;
            writeln!(
                script,
                "if errorlevel 1 (timeout /t 1 /nobreak > nul & goto retry)"
            )
            .map_err(|e| e.to_string())?;
            writeln!(script, "start \"\" \"{}\"", current_exe.to_string_lossy())
                .map_err(|e| e.to_string())?;
            writeln!(script, "exit").map_err(|e| e.to_string())?;
        }

        let mut bat_cmd = Command::new("cmd.exe");
        bat_cmd.args(&["/C", script_path.to_str().unwrap()]);
        bat_cmd.creation_flags(CREATE_NO_WINDOW);
        let _ = bat_cmd.spawn();

        // Kill backend child if active
        let mut guard = BACKEND_CHILD.lock().unwrap();
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
        }

        std::thread::spawn(|| {
            std::thread::sleep(std::time::Duration::from_millis(300));
            std::process::exit(0);
        });
    }

    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("chmod")
            .args(&["+x", target_temp_file.to_str().unwrap()])
            .status();
        let _ = Command::new(&target_temp_file).spawn();
        std::process::exit(0);
    }

    Ok(())
}

#[tauri::command]
fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn window_toggle_maximize(window: tauri::Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn window_start_dragging(window: tauri::Window) {
    let _ = window.start_dragging();
}

fn log_launcher(msg: &str) {
    let temp_dir = std::env::var("TEMP")
        .or_else(|_| std::env::var("TMPDIR"))
        .unwrap_or_else(|_| "/tmp".to_string());
    let log_file = PathBuf::from(temp_dir).join("swiftbalt_launcher.log");
    use std::io::Write;
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(log_file) {
        let _ = writeln!(file, "[{}] {}", chrono_lite_timestamp(), msg);
    }
}

fn chrono_lite_timestamp() -> String {
    use std::time::SystemTime;
    match SystemTime::now().duration_since(SystemTime::UNIX_EPOCH) {
        Ok(d) => format!("{}", d.as_secs()),
        Err(_) => "0".to_string(),
    }
}

fn find_backend_executable() -> Option<(PathBuf, Vec<String>, Option<PathBuf>)> {
    let bin_name = if cfg!(target_os = "windows") {
        "swiftbalt-backend.exe"
    } else {
        "swiftbalt-backend"
    };

    // 1. AppImage support (Linux): when running inside an AppImage, APPDIR is set
    if let Ok(appdir) = std::env::var("APPDIR") {
        let appdir_path = PathBuf::from(appdir);
        let appimage_candidates = [
            appdir_path.join("resources").join("swiftbalt-backend").join(bin_name),
            appdir_path.join("usr").join("lib").join("SwiftBalt").join("resources").join("swiftbalt-backend").join(bin_name),
            appdir_path.join("usr").join("lib").join("swiftbalt").join("resources").join("swiftbalt-backend").join(bin_name),
            appdir_path.join("usr").join("lib").join("SwiftBalt").join("swiftbalt-backend").join(bin_name),
            appdir_path.join("usr").join("lib").join("swiftbalt").join("swiftbalt-backend").join(bin_name),
            appdir_path.join("usr").join("bin").join("resources").join("swiftbalt-backend").join(bin_name),
            appdir_path.join("usr").join("bin").join(bin_name),
            appdir_path.join(bin_name),
        ];
        for c in &appimage_candidates {
            if c.exists() {
                log_launcher(&format!("Found backend in AppImage: {:?}", c));
                return Some((c.clone(), vec![], c.parent().map(|p| p.to_path_buf())));
            }
        }
    }

    // 2. Look relative to current executable directory
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            log_launcher(&format!("Checking around exe_dir: {:?}", exe_dir));
            let candidates = [
                // Direct alongside exe
                exe_dir.join(bin_name),
                // Portable folder alongside exe (swiftbalt-backend/swiftbalt-backend.exe)
                exe_dir.join("swiftbalt-backend").join(bin_name),
                // NSIS installed resources folder (resources/swiftbalt-backend/swiftbalt-backend.exe)
                exe_dir.join("resources").join("swiftbalt-backend").join(bin_name),
                // Direct resources folder
                exe_dir.join("resources").join(bin_name),
                // One level up (useful if running from bin/ or a subfolder)
                exe_dir.parent().unwrap_or(exe_dir).join("swiftbalt-backend").join(bin_name),
                exe_dir.parent().unwrap_or(exe_dir).join("resources").join("swiftbalt-backend").join(bin_name),
            ];

            for c in &candidates {
                if c.exists() {
                    log_launcher(&format!("Found backend near exe: {:?}", c));
                    return Some((c.clone(), vec![], c.parent().map(|p| p.to_path_buf())));
                }
            }

            // Linux standard share/lib paths
            let linux_libs = [
                exe_dir.parent().unwrap_or(exe_dir).join("lib").join("SwiftBalt").join("resources").join("swiftbalt-backend").join(bin_name),
                exe_dir.parent().unwrap_or(exe_dir).join("lib").join("swiftbalt").join("resources").join("swiftbalt-backend").join(bin_name),
                exe_dir.parent().unwrap_or(exe_dir).join("lib").join("SwiftBalt").join("swiftbalt-backend").join(bin_name),
                exe_dir.parent().unwrap_or(exe_dir).join("lib").join("swiftbalt").join("swiftbalt-backend").join(bin_name),
            ];
            for l in &linux_libs {
                if l.exists() {
                    log_launcher(&format!("Found backend in linux lib: {:?}", l));
                    return Some((l.clone(), vec![], l.parent().map(|p| p.to_path_buf())));
                }
            }

            // macOS .app bundle paths (Contents/MacOS/SwiftBalt -> Contents/Resources/...)
            #[cfg(target_os = "macos")]
            if let Some(contents_dir) = exe_dir.parent() {
                let resources_dir = contents_dir.join("Resources");
                let macos_candidates = [
                    resources_dir.join("resources").join("swiftbalt-backend").join(bin_name),
                    resources_dir.join("swiftbalt-backend").join(bin_name),
                    resources_dir.join(bin_name),
                    exe_dir.join(bin_name),
                    exe_dir.join("resources").join("swiftbalt-backend").join(bin_name),
                ];
                for m in &macos_candidates {
                    if m.exists() {
                        log_launcher(&format!("Found backend in macOS bundle: {:?}", m));
                        return Some((m.clone(), vec![], m.parent().map(|p| p.to_path_buf())));
                    }
                }
            }
        }
    }

    // 3. User local installation path on Linux (~/.local/share/swiftbalt)
    #[cfg(target_os = "linux")]
    if let Ok(home) = std::env::var("HOME") {
        let user_share = PathBuf::from(home).join(".local").join("share").join("swiftbalt");
        let user_candidates = [
            user_share.join("swiftbalt-backend").join(bin_name),
            user_share.join("resources").join("swiftbalt-backend").join(bin_name),
            user_share.join(bin_name),
        ];
        for c in &user_candidates {
            if c.exists() {
                log_launcher(&format!("Found backend in user share: {:?}", c));
                return Some((c.clone(), vec![], c.parent().map(|p| p.to_path_buf())));
            }
        }
    }

    // 4. Local dist / dev paths
    let candidate_paths = [
        format!("resources/swiftbalt-backend/{}", bin_name),
        format!("dist/swiftbalt-backend/{}", bin_name),
        format!("../dist/swiftbalt-backend/{}", bin_name),
        format!("../../dist/swiftbalt-backend/{}", bin_name),
        format!("{}/dist/swiftbalt-backend/{}", bin_name, bin_name),
    ];
    for p in &candidate_paths {
        let path = PathBuf::from(p);
        if path.exists() {
            log_launcher(&format!("Found backend in dev/dist path: {:?}", path));
            let parent = path.parent().map(|p| p.to_path_buf());
            return Some((path, vec![], parent));
        }
    }

    log_launcher("No backend executable found anywhere!");
    None
}

fn start_backend_if_needed() {
    log_launcher("start_backend_if_needed called");
    if TcpStream::connect("127.0.0.1:8000").is_ok() {
        log_launcher("Backend SwiftBalt déjà actif sur 127.0.0.1:8000");
        return;
    }

    #[cfg(target_os = "windows")]
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    if let Some((exe_path, args, cwd)) = find_backend_executable() {
        log_launcher(&format!("Lancement du backend autonome : {:?} avec cwd: {:?}", exe_path, cwd));
        let mut cmd = Command::new(&exe_path);
        cmd.args(&args);
        if let Some(dir) = cwd {
            cmd.current_dir(dir);
        }
        cmd.stdin(std::process::Stdio::null());
        cmd.stdout(std::process::Stdio::null());
        cmd.stderr(std::process::Stdio::null());
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        match cmd.spawn() {
            Ok(c) => {
                let mut guard = BACKEND_CHILD.lock().unwrap();
                *guard = Some(c);
                log_launcher("Backend autonome lancé avec succès");
            }
            Err(e) => {
                log_launcher(&format!("Erreur spawn backend autonome: {:?}", e));
            }
        }
    } else {
        log_launcher("Backend autonome non trouvé, tentative fallback Python...");
        #[cfg(target_os = "windows")]
        {
            let mut cmd = Command::new("cmd");
            cmd.args(&["/C", "python -m uvicorn app.main:app --app-dir backend --port 8000 --host 127.0.0.1"]);
            cmd.current_dir("../../");
            cmd.stdin(std::process::Stdio::null());
            cmd.stdout(std::process::Stdio::null());
            cmd.stderr(std::process::Stdio::null());
            cmd.creation_flags(CREATE_NO_WINDOW);

            if let Ok(c) = cmd.spawn() {
                let mut guard = BACKEND_CHILD.lock().unwrap();
                *guard = Some(c);
                log_launcher("Backend Python fallback lancé avec succès");
            }
        }

        #[cfg(any(target_os = "linux", target_os = "macos"))]
        {
            let child = Command::new("python3")
                .args(&["-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--port", "8000", "--host", "127.0.0.1"])
                .current_dir("../../")
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn();

            if let Ok(c) = child {
                let mut guard = BACKEND_CHILD.lock().unwrap();
                *guard = Some(c);
                log_launcher("Backend Python fallback lancé avec succès");
            }
        }
    }

    // Wait up to 8 seconds for the port to open (PyInstaller cold start)
    for i in 0..40 {
        if TcpStream::connect("127.0.0.1:8000").is_ok() {
            log_launcher(&format!("Connexion au backend établie après {} ms", i * 200));
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    start_backend_if_needed();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            open_folder,
            open_url,
            install_and_restart_update,
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_start_dragging
        ])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let mut guard = BACKEND_CHILD.lock().unwrap();
                if let Some(mut child) = guard.take() {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
