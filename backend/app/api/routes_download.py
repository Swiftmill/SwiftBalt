from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.security import sanitize_filename
from app.downloads.manager import download_manager
from app.database.session import get_db
from app.database import crud

router = APIRouter(prefix="/api/downloads", tags=["Downloads"])


class DownloadCreateRequest(BaseModel):
    url: str
    title: Optional[str] = "Téléchargement"
    format: Optional[str] = "mp4"
    quality: Optional[str] = "1080p"
    thumbnail_url: Optional[str] = None
    platform: Optional[str] = None


@router.post("", response_model=Dict[str, Any])
async def create_download_task(payload: DownloadCreateRequest):
    """Enqueues a new download job into the async worker queue."""
    job = await download_manager.add_download(
        url=payload.url,
        title=payload.title,
        target_format=payload.format or "mp4",
        target_quality=payload.quality or "1080p",
        thumbnail_url=payload.thumbnail_url,
        platform=payload.platform
    )
    return job.to_dict()


@router.get("", response_model=List[Dict[str, Any]])
async def list_download_tasks(db: AsyncSession = Depends(get_db)):
    """Lists all active and recent download tasks from memory and database."""
    in_memory = {j["id"]: j for j in download_manager.list_jobs()}
    db_items = await crud.list_downloads(db, limit=100)

    results = []
    for item in db_items:
        if item.id in in_memory:
            results.append(in_memory[item.id])
        else:
            status = item.status
            progress = item.progress
            file_path = item.file_path
            file_size = item.file_size
            error_msg = item.error_message

            # Reconcile if marked in-progress but not in active memory
            if status in ("processing", "merging", "downloading"):
                safe_title = sanitize_filename(item.title or "")
                found_candidate = None
                for ext in [item.format.lower() if item.format else "mp4", "mp4", "mkv", "webm", "mp3", "m4a"]:
                    c = settings.DOWNLOADS_PATH / f"{safe_title}.{ext}"
                    if c.exists() and c.stat().st_size > 1024:
                        found_candidate = c
                        break

                if found_candidate:
                    status = "completed"
                    progress = 100.0
                    file_path = str(found_candidate)
                    file_size = found_candidate.stat().st_size
                    error_msg = None
                    try:
                        await crud.update_download(db, item.id, {
                            "status": status,
                            "progress": progress,
                            "file_path": file_path,
                            "file_size": file_size,
                            "error_message": None
                        })
                    except Exception:
                        pass
                else:
                    status = "failed"
                    error_msg = "Téléchargement interrompu par le redémarrage du serveur"
                    try:
                        await crud.update_download(db, item.id, {
                            "status": status,
                            "error_message": error_msg
                        })
                    except Exception:
                        pass

            results.append({
                "id": item.id,
                "url": item.url,
                "title": item.title,
                "platform": item.platform,
                "format": item.format,
                "quality": item.quality,
                "status": status,
                "progress": progress,
                "downloaded_bytes": item.downloaded_bytes,
                "total_bytes": item.total_bytes,
                "speed": item.speed,
                "eta": item.eta,
                "file_path": file_path,
                "file_size": file_size,
                "thumbnail_url": item.thumbnail_url,
                "error_message": error_msg,
            })
    return results


@router.get("/{download_id}", response_model=Dict[str, Any])
async def get_download_task(download_id: str, db: AsyncSession = Depends(get_db)):
    job = download_manager.get_job(download_id)
    if job:
        return job.to_dict()

    db_item = await crud.get_download(db, download_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Téléchargement introuvable.")

    return {
        "id": db_item.id,
        "url": db_item.url,
        "title": db_item.title,
        "platform": db_item.platform,
        "format": db_item.format,
        "quality": db_item.quality,
        "status": db_item.status,
        "progress": db_item.progress,
        "downloaded_bytes": db_item.downloaded_bytes,
        "total_bytes": db_item.total_bytes,
        "speed": db_item.speed,
        "eta": db_item.eta,
        "file_path": db_item.file_path,
        "file_size": db_item.file_size,
        "thumbnail_url": db_item.thumbnail_url,
        "error_message": db_item.error_message,
    }


@router.post("/{download_id}/pause")
async def pause_download_task(download_id: str):
    success = download_manager.pause_download(download_id)
    if not success:
        raise HTTPException(status_code=400, detail="Impossible de mettre en pause ce téléchargement.")
    return {"status": "paused", "id": download_id}


@router.post("/{download_id}/resume")
async def resume_download_task(download_id: str):
    success = download_manager.resume_download(download_id)
    if not success:
        raise HTTPException(status_code=400, detail="Impossible de reprendre ce téléchargement.")
    return {"status": "resumed", "id": download_id}


@router.post("/{download_id}/cancel")
async def cancel_download_task(download_id: str):
    success = download_manager.cancel_download(download_id)
    if not success:
        raise HTTPException(status_code=400, detail="Impossible d'annuler ce téléchargement.")
    return {"status": "cancelled", "id": download_id}


@router.post("/{download_id}/retry")
async def retry_download_task(download_id: str):
    new_job = await download_manager.retry_download(download_id)
    if not new_job:
        raise HTTPException(status_code=400, detail="Impossible de relancer ce téléchargement.")
    return new_job.to_dict()


@router.delete("/{download_id}")
async def delete_download_task(download_id: str, delete_file: bool = False):
    success = await download_manager.delete_download(download_id, delete_file=delete_file)
    if not success:
        raise HTTPException(status_code=404, detail="Téléchargement introuvable.")
    return {"status": "deleted", "id": download_id}


@router.get("/{download_id}/file")
async def get_downloaded_file(download_id: str, db: AsyncSession = Depends(get_db)):
    """Serves the completed downloaded file directly to the user as an attachment."""
    file_path_str = None
    job = download_manager.get_job(download_id)
    if job and job.file_path:
        file_path_str = job.file_path
    else:
        db_item = await crud.get_download(db, download_id)
        if db_item and db_item.file_path:
            file_path_str = db_item.file_path
        elif db_item:
            # Check if file exists in DOWNLOADS_PATH
            safe_title = sanitize_filename(db_item.title or "")
            for ext in [db_item.format.lower() if db_item.format else "mp4", "mp4", "mkv", "webm", "mp3", "m4a"]:
                c = settings.DOWNLOADS_PATH / f"{safe_title}.{ext}"
                if c.exists():
                    file_path_str = str(c)
                    break

    if not file_path_str:
        raise HTTPException(status_code=404, detail="Fichier introuvable.")

    target_path = Path(file_path_str).resolve()
    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="Le fichier n'existe plus sur le disque.")

    return FileResponse(
        path=target_path,
        filename=target_path.name,
        media_type="application/octet-stream"
    )

