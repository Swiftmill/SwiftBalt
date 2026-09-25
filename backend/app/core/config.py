import sys
import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

def get_writable_data_dir() -> Path:
    # 1. Custom env var
    if "SWIFTBALT_DATA_DIR" in os.environ:
        d = Path(os.environ["SWIFTBALT_DATA_DIR"])
        d.mkdir(parents=True, exist_ok=True)
        return d

    # 2. Check if local directory alongside app is writable (e.g. dev or portable mode)
    # But only if not in Program Files!
    local_data = BASE_DIR / "data"
    is_program_files = False
    try:
        s = str(BASE_DIR).lower()
        if "program files" in s or "programmes" in s:
            is_program_files = True
    except Exception:
        pass

    if not is_program_files:
        try:
            local_data.mkdir(parents=True, exist_ok=True)
            test_file = local_data / ".write_test"
            test_file.write_text("ok")
            test_file.unlink()
            return local_data
        except Exception:
            pass

    # 3. Standard OS User Data directory
    if os.name == "nt":
        appdata = os.environ.get("LOCALAPPDATA")
        if appdata:
            base = Path(appdata) / "SwiftBalt"
        else:
            base = Path.home() / "AppData" / "Local" / "SwiftBalt"
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / "SwiftBalt"
    else:
        xdg = os.environ.get("XDG_DATA_HOME")
        if xdg:
            base = Path(xdg) / "swiftbalt"
        else:
            base = Path.home() / ".local" / "share" / "swiftbalt"

    d = base / "data"
    d.mkdir(parents=True, exist_ok=True)
    return d

DATA_DIR = get_writable_data_dir()
for sub in ["downloads", "temp", "torrents", "thumbnails", "metadata", "logs"]:
    try:
        (DATA_DIR / sub).mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

class Settings(BaseSettings):
    APP_NAME: str = "SwiftBalt"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    
    # Host & Port
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]
    
    # Paths
    BASE_PATH: Path = BASE_DIR
    DATA_PATH: Path = DATA_DIR
    DOWNLOADS_PATH: Path = DATA_DIR / "downloads"
    TEMP_PATH: Path = DATA_DIR / "temp"
    TORRENTS_PATH: Path = DATA_DIR / "torrents"
    THUMBNAILS_PATH: Path = DATA_DIR / "thumbnails"
    METADATA_PATH: Path = DATA_DIR / "metadata"
    LOGS_PATH: Path = DATA_DIR / "logs"
    DATABASE_URL: str = f"sqlite+aiosqlite:///{DATA_DIR / 'swiftbalt.db'}"
    
    # Downloader Settings
    MAX_CONCURRENT_DOWNLOADS: int = 3
    DEFAULT_QUALITY: str = "1080p"
    DEFAULT_FORMAT: str = "mp4"
    AUTO_MERGE_STREAMS: bool = True
    AUTO_CONVERT: bool = False
    DELETE_TEMP_FILES: bool = True
    USER_AGENT: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 SwiftBalt/1.0"
    MAX_FILE_SIZE_BYTES: int = 10 * 1024 * 1024 * 1024  # 10 GiB max
    REQUEST_TIMEOUT_SECONDS: int = 45
    
    # Security / Anti-SSRF
    ALLOW_LOCAL_IP_IN_DEV: bool = False
    ENABLE_RATE_LIMIT: bool = True
    RATE_LIMIT_PER_MINUTE: int = 120
    
    # FFmpeg Settings
    FFMPEG_PATH: str = "ffmpeg"
    FFPROBE_PATH: str = "ffprobe"
    
    model_config = SettingsConfigDict(
        env_prefix="SWIFTBALT_",
        env_file=".env",
        extra="allow"
    )

settings = Settings()

# Ensure directories exist
for p in [
    settings.DATA_PATH,
    settings.DOWNLOADS_PATH,
    settings.TEMP_PATH,
    settings.TORRENTS_PATH,
    settings.THUMBNAILS_PATH,
    settings.METADATA_PATH,
    settings.LOGS_PATH,
]:
    p.mkdir(parents=True, exist_ok=True)
