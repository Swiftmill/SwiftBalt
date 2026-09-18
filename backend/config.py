import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "SwiftBalt"
    ENVIRONMENT: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    SECRET_KEY: str = "swiftbalt_secret_key"

    DATA_DIR: str = "data"
    DOWNLOAD_DIR: str = "data/downloads"
    TEMP_DIR: str = "data/temp"
    TORRENT_DIR: str = "data/torrents"
    THUMBNAIL_DIR: str = "data/thumbnails"
    METADATA_DIR: str = "data/metadata"
    LOG_DIR: str = "data/logs"

    DATABASE_URL: str = "sqlite+aiosqlite:///data/swiftbalt.db"

    MAX_CONCURRENT_DOWNLOADS: int = 3
    MAX_FILE_SIZE_BYTES: int = 10737418240  # 10GB
    RATE_LIMIT_PER_MINUTE: int = 60
    BANDWIDTH_LIMIT_KBPS: int = 0

    BLOCK_PRIVATE_IPS: bool = True
    ALLOW_DIRECT_DOWNLOADS: bool = True

    FFMPEG_PATH: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

def init_storage_directories():
    for d in [
        settings.DATA_DIR,
        settings.DOWNLOAD_DIR,
        settings.TEMP_DIR,
        settings.TORRENT_DIR,
        settings.THUMBNAIL_DIR,
        settings.METADATA_DIR,
        settings.LOG_DIR,
    ]:
        os.makedirs(d, exist_ok=True)
