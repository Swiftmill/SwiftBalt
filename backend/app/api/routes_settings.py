import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.database.session import get_db
from app.database import crud

router = APIRouter(prefix="/api/settings", tags=["Settings"])


class SettingsUpdateModel(BaseModel):
    downloads_path: Optional[str] = None
    temp_path: Optional[str] = None
    max_concurrent_downloads: Optional[int] = None
    default_quality: Optional[str] = None
    default_format: Optional[str] = None
    auto_merge: Optional[bool] = None
    auto_convert: Optional[bool] = None
    delete_temp_files: Optional[bool] = None
    notifications_enabled: Optional[bool] = True
    theme: Optional[str] = "dark"
    bandwidth_limit_mbps: Optional[int] = 0


@router.get("", response_model=Dict[str, Any])
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Retrieves all configuration settings."""
    stored = await crud.get_all_settings(db)
    
    # Sync paths from DB if previously configured
    if "downloads_path" in stored and stored["downloads_path"]:
        try:
            p = Path(stored["downloads_path"]).expanduser().resolve()
            p.mkdir(parents=True, exist_ok=True)
            settings.DOWNLOADS_PATH = p
        except Exception:
            pass

    if "temp_path" in stored and stored["temp_path"]:
        try:
            tp = Path(stored["temp_path"]).expanduser().resolve()
            tp.mkdir(parents=True, exist_ok=True)
            settings.TEMP_PATH = tp
        except Exception:
            pass

    user_home = Path.home()
    presets = {
        "downloads": str(user_home / "Downloads"),
        "desktop": str(user_home / "Desktop"),
        "videos": str(user_home / "Videos"),
        "music": str(user_home / "Music"),
        "default": str(settings.DATA_PATH / "downloads"),
    }

    return {
        "app_name": settings.APP_NAME,
        "app_version": settings.APP_VERSION,
        "downloads_path": str(settings.DOWNLOADS_PATH),
        "temp_path": str(settings.TEMP_PATH),
        "torrents_path": str(settings.TORRENTS_PATH),
        "system_presets": presets,
        "max_concurrent_downloads": stored.get("max_concurrent_downloads", settings.MAX_CONCURRENT_DOWNLOADS),
        "default_quality": stored.get("default_quality", settings.DEFAULT_QUALITY),
        "default_format": stored.get("default_format", settings.DEFAULT_FORMAT),
        "auto_merge": stored.get("auto_merge", settings.AUTO_MERGE_STREAMS),
        "auto_convert": stored.get("auto_convert", settings.AUTO_CONVERT),
        "delete_temp_files": stored.get("delete_temp_files", settings.DELETE_TEMP_FILES),
        "notifications_enabled": stored.get("notifications_enabled", True),
        "theme": stored.get("theme", "dark"),
        "bandwidth_limit_mbps": stored.get("bandwidth_limit_mbps", 0),
        "ffmpeg_path": settings.FFMPEG_PATH,
    }


@router.put("", response_model=Dict[str, Any])
async def update_settings(payload: SettingsUpdateModel, db: AsyncSession = Depends(get_db)):
    """Updates configuration settings."""
    fields = payload.model_dump(exclude_none=True)
    
    # Handle downloads_path modification
    if "downloads_path" in fields and fields["downloads_path"]:
        try:
            new_p = Path(fields["downloads_path"]).expanduser().resolve()
            new_p.mkdir(parents=True, exist_ok=True)
            settings.DOWNLOADS_PATH = new_p
            fields["downloads_path"] = str(new_p)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Chemin de téléchargement invalide : {e}")

    # Handle temp_path modification
    if "temp_path" in fields and fields["temp_path"]:
        try:
            new_temp = Path(fields["temp_path"]).expanduser().resolve()
            new_temp.mkdir(parents=True, exist_ok=True)
            settings.TEMP_PATH = new_temp
            fields["temp_path"] = str(new_temp)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Chemin temporaire invalide : {e}")

    for k, v in fields.items():
        await crud.set_setting(db, k, v)
    return await get_settings(db)


@router.post("/open-folder")
async def open_downloads_folder():
    """Opens the host computer downloads folder in File Explorer."""
    try:
        p = settings.DOWNLOADS_PATH
        p.mkdir(parents=True, exist_ok=True)
        if os.name == "nt":
            os.startfile(str(p))
            return {"status": "ok", "opened": str(p)}
        return {"status": "unsupported_os", "path": str(p)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Impossible d'ouvrir le dossier : {e}")
