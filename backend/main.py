import os
import time
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.config import settings, init_storage_directories
from backend.security import is_safe_url
from backend.providers.registry import provider_registry
from backend.download_manager import download_manager
from backend.torrent_manager import torrent_manager
from backend.twitch_hub import twitch_hub_service
from backend.websocket_manager import ws_manager

init_storage_directories()

app = FastAPI(
    title=settings.APP_NAME,
    description="SwiftBalt - Universal Media Platform & Downloader API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve downloads static directory
app.mount("/data/downloads", StaticFiles(directory=settings.DOWNLOAD_DIR), name="downloads")

# Data Models
class AnalyzeRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    provider_id: str
    title: str
    thumbnail_url: Optional[str] = None
    format_id: Optional[str] = None
    target_format: Optional[str] = "mp4"
    audio_only: Optional[bool] = False

class TorrentRequest(BaseModel):
    source: str  # magnet or torrent file path

class FavoriteRequest(BaseModel):
    id: str
    title: str
    source_url: str
    provider_id: str
    thumbnail_url: Optional[str] = None

# In-memory history and favorites store for V1
history_list: List[Dict[str, Any]] = []
favorites_list: List[Dict[str, Any]] = []

@app.on_event("startup")
async def startup_event():
    download_manager.start_worker()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

@app.post("/api/analyze")
async def analyze_url(req: AnalyzeRequest):
    url = req.url.strip()
    is_safe, error_msg = is_safe_url(url)
    if not is_safe:
        raise HTTPException(status_code=400, detail=error_msg)

    provider = provider_registry.find_provider_for_url(url)
    if not provider:
        raise HTTPException(status_code=400, detail="Aucun fournisseur trouvé pour cette URL.")

    try:
        metadata = await provider.get_metadata(url)
        return {
            "status": "success",
            "provider": provider.get_status(),
            "metadata": metadata.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Échec de l'analyse : {str(e)}")

@app.post("/api/download")
async def create_download(req: DownloadRequest):
    is_safe, error_msg = is_safe_url(req.url)
    if not is_safe:
        raise HTTPException(status_code=400, detail=error_msg)

    task_id = await download_manager.add_task(
        url=req.url,
        provider_id=req.provider_id,
        title=req.title,
        thumbnail_url=req.thumbnail_url,
        format_id=req.format_id,
        target_format=req.target_format,
        audio_only=req.audio_only or False
    )

    # Record in history
    history_entry = {
        "id": task_id,
        "title": req.title,
        "source_url": req.url,
        "provider_id": req.provider_id,
        "target_format": req.target_format,
        "created_at": time.time()
    }
    history_list.insert(0, history_entry)

    return {"status": "success", "task_id": task_id}

@app.get("/api/downloads")
async def get_downloads():
    return {"downloads": list(download_manager.active_tasks.values())}

@app.post("/api/download/{task_id}/pause")
async def pause_download(task_id: str):
    await download_manager.pause_task(task_id)
    return {"status": "success"}

@app.post("/api/download/{task_id}/resume")
async def resume_download(task_id: str):
    await download_manager.resume_task(task_id)
    return {"status": "success"}

@app.delete("/api/download/{task_id}")
async def delete_download(task_id: str):
    await download_manager.delete_task(task_id)
    return {"status": "success"}

@app.get("/api/twitch/info")
async def get_twitch_info(url: str = Query(...)):
    is_safe, error_msg = is_safe_url(url)
    if not is_safe:
        raise HTTPException(status_code=400, detail=error_msg)

    try:
        info = await twitch_hub_service.get_twitch_info(url)
        return {"status": "success", "data": info}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/torrent")
async def add_torrent(req: TorrentRequest):
    try:
        torrent_id = await torrent_manager.add_torrent(req.source)
        return {"status": "success", "torrent_id": torrent_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Échec de l'ajout du torrent : {str(e)}")

@app.get("/api/torrents")
async def get_torrents():
    return {"torrents": list(torrent_manager.torrents.values())}

@app.post("/api/torrent/{torrent_id}/pause")
async def pause_torrent(torrent_id: str):
    await torrent_manager.pause_torrent(torrent_id)
    return {"status": "success"}

@app.post("/api/torrent/{torrent_id}/resume")
async def resume_torrent(torrent_id: str):
    await torrent_manager.resume_torrent(torrent_id)
    return {"status": "success"}

@app.delete("/api/torrent/{torrent_id}")
async def delete_torrent(torrent_id: str, delete_files: bool = Query(False)):
    await torrent_manager.delete_torrent(torrent_id, delete_files)
    return {"status": "success"}

@app.get("/api/history")
async def get_history():
    return {"history": history_list}

@app.delete("/api/history")
async def clear_history():
    global history_list
    history_list = []
    return {"status": "success"}

@app.get("/api/favorites")
async def get_favorites():
    return {"favorites": favorites_list}

@app.post("/api/favorites")
async def add_favorite(req: FavoriteRequest):
    fav = req.model_dump()
    fav["created_at"] = time.time()
    favorites_list.insert(0, fav)
    return {"status": "success"}

@app.delete("/api/favorites/{fav_id}")
async def remove_favorite(fav_id: str):
    global favorites_list
    favorites_list = [f for f in favorites_list if f["id"] != fav_id]
    return {"status": "success"}

@app.get("/api/providers")
async def get_providers():
    return {"providers": provider_registry.list_providers()}

@app.get("/api/stats")
async def get_stats():
    tasks = list(download_manager.active_tasks.values())
    active_dl = sum(1 for t in tasks if t["status"] in ["downloading", "processing", "converting"])
    completed_dl = sum(1 for t in tasks if t["status"] == "completed")
    failed_dl = sum(1 for t in tasks if t["status"] == "failed")

    storage_used = 0
    if os.path.exists(settings.DOWNLOAD_DIR):
        for path, dirs, files in os.walk(settings.DOWNLOAD_DIR):
            for f in files:
                fp = os.path.join(path, f)
                storage_used += os.path.getsize(fp)

    return {
        "app_name": settings.APP_NAME,
        "total_downloads": len(tasks),
        "active_downloads": active_dl,
        "completed_downloads": completed_dl,
        "failed_downloads": failed_dl,
        "active_torrents": len(torrent_manager.torrents),
        "storage_used_bytes": storage_used
    }

@app.get("/api/settings")
async def get_settings():
    return {
        "app_name": settings.APP_NAME,
        "download_dir": settings.DOWNLOAD_DIR,
        "max_concurrent_downloads": settings.MAX_CONCURRENT_DOWNLOADS,
        "max_file_size_gb": round(settings.MAX_FILE_SIZE_BYTES / (1024**3), 2),
        "bandwidth_limit_kbps": settings.BANDWIDTH_LIMIT_KBPS,
        "block_private_ips": settings.BLOCK_PRIVATE_IPS
    }
