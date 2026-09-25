from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.torrents.manager import torrent_manager
from app.database.session import get_db
from app.database import crud
from app.core.security import validate_url_security

router = APIRouter(prefix="/api/torrents", tags=["Torrent Center"])


class AddMagnetRequest(BaseModel):
    magnet_uri: str
    destination: Optional[str] = None


@router.post("", response_model=Dict[str, Any])
async def add_magnet_torrent(payload: AddMagnetRequest):
    """Adds a legal torrent via magnet URI."""
    magnet = payload.magnet_uri.strip()
    validate_url_security(magnet, allow_magnet=True)
    torrent = await torrent_manager.add_magnet(magnet, destination_dir=payload.destination)
    return torrent


@router.post("/upload", response_model=Dict[str, Any])
async def upload_torrent_file(file: UploadFile = File(...)):
    """Uploads and parses a .torrent file to create an active torrent job via aria2 BitTorrent engine."""
    if not file.filename.lower().endswith(".torrent"):
        raise HTTPException(status_code=400, detail="Seuls les fichiers avec l'extension .torrent sont acceptés.")

    content = await file.read()
    if len(content) < 20:
        raise HTTPException(status_code=400, detail="Fichier .torrent invalide ou vide.")

    from app.core.config import settings
    from app.core.security import sanitize_filename

    # Save .torrent to disk
    settings.TORRENTS_PATH.mkdir(parents=True, exist_ok=True)
    safe_name = sanitize_filename(file.filename)
    saved_torrent_file = settings.TORRENTS_PATH / safe_name
    saved_torrent_file.write_bytes(content)

    # Pass directly to aria2 torrent manager
    torrent = await torrent_manager.add_torrent_file(
        file_bytes=content,
        file_name=file.filename
    )
    return torrent


@router.get("", response_model=List[Dict[str, Any]])
async def list_torrents(db: AsyncSession = Depends(get_db)):
    """Lists legal torrents tracked by Torrent Center."""
    results = []
    seen_ids = set()

    for t in torrent_manager.list_torrents():
        results.append(t)
        seen_ids.add(t["id"])

    db_items = await crud.list_torrents(db)
    for t in db_items:
        if t.id not in seen_ids:
            results.append({
                "id": t.id,
                "name": t.name,
                "magnet_uri": t.magnet_uri,
                "status": t.status,
                "progress": t.progress,
                "total_size": t.total_size,
                "downloaded_size": t.downloaded_size,
                "upload_size": t.upload_size,
                "download_speed": t.download_speed,
                "upload_speed": t.upload_speed,
                "peers": t.peers,
                "seeds": t.seeds,
                "eta": t.eta,
                "error_message": getattr(t, "error_message", None),
            })
            seen_ids.add(t.id)
    return results


@router.post("/{torrent_id}/pause")
async def pause_torrent(torrent_id: str):
    success = await torrent_manager.pause_torrent(torrent_id)
    if not success:
        raise HTTPException(status_code=400, detail="Impossible de mettre en pause ce torrent.")
    return {"status": "paused", "id": torrent_id}


@router.post("/{torrent_id}/resume")
async def resume_torrent(torrent_id: str):
    success = await torrent_manager.resume_torrent(torrent_id)
    if not success:
        raise HTTPException(status_code=400, detail="Impossible de reprendre ce torrent.")
    return {"status": "resumed", "id": torrent_id}


@router.delete("/{torrent_id}")
async def delete_torrent(torrent_id: str):
    success = await torrent_manager.delete_torrent(torrent_id)
    if not success:
        raise HTTPException(status_code=404, detail="Torrent introuvable.")
    return {"status": "deleted", "id": torrent_id}


@router.get("/{torrent_id}/file")
async def get_torrent_file(torrent_id: str, db: AsyncSession = Depends(get_db)):
    """Serves the genuine completed torrent payload file directly to the user as a file download."""
    torrent = torrent_manager.get_torrent(torrent_id)
    name = None
    status = "downloading"
    progress = 0.0
    file_path = None

    if torrent:
        name = torrent.get("name")
        status = torrent.get("status", "downloading")
        progress = torrent.get("progress", 0.0)
        file_path = torrent.get("file_path")
    else:
        db_item = await crud.get_torrent(db, torrent_id)
        if db_item:
            name = db_item.name
            status = db_item.status
            progress = db_item.progress

    if not name:
        raise HTTPException(status_code=404, detail="Torrent introuvable.")

    if status != "completed" and progress < 100.0:
        raise HTTPException(
            status_code=400,
            detail=f"Le téléchargement n'est pas encore terminé ({progress}%). Veuillez attendre la fin du téléchargement BitTorrent pour obtenir le fichier complet."
        )

    from app.core.config import settings
    from app.core.security import sanitize_filename

    target_path = None
    if file_path:
        p = Path(file_path)
        if p.exists() and p.is_file() and p.stat().st_size > 0:
            target_path = p

    if not target_path:
        safe_name = sanitize_filename(name)
        candidates = [
            settings.DOWNLOADS_PATH / safe_name,
            settings.DOWNLOADS_PATH / f"{safe_name}.mp4",
            settings.DOWNLOADS_PATH / f"{safe_name}.mkv",
            settings.DOWNLOADS_PATH / f"{safe_name}.iso",
            settings.DOWNLOADS_PATH / f"{safe_name}.zip",
        ]
        # Also check exact matching files in downloads
        for item in settings.DOWNLOADS_PATH.iterdir():
            if item.is_file() and not item.name.endswith(".aria2") and not item.name.endswith(".torrent"):
                if item.name.lower() == safe_name.lower() or item.name.lower().startswith(safe_name[:20].lower()):
                    candidates.append(item)

        for c in candidates:
            if c.exists() and c.is_file() and c.stat().st_size > 0:
                target_path = c
                break

    if not target_path or not target_path.exists():
        raise HTTPException(status_code=404, detail="Fichier téléchargé introuvable sur le disque.")

    return FileResponse(
        path=str(target_path),
        filename=target_path.name,
        media_type="application/octet-stream"
    )
