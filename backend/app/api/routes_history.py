from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.database import crud

router = APIRouter(prefix="/api/history", tags=["History"])


@router.get("", response_model=List[Dict[str, Any]])
async def get_history(limit: int = 100, db: AsyncSession = Depends(get_db)):
    """Returns download history."""
    items = await crud.list_history(db, limit=limit)
    return [
        {
            "id": i.id,
            "download_id": i.download_id,
            "title": i.title,
            "url": i.url,
            "platform": i.platform,
            "file_path": i.file_path,
            "file_size": i.file_size,
            "format": i.format,
            "quality": i.quality,
            "thumbnail_url": i.thumbnail_url,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in items
    ]


@router.delete("")
async def clear_all_history(db: AsyncSession = Depends(get_db)):
    """Clears all history entries."""
    count = await crud.clear_history(db)
    return {"status": "cleared", "deleted_count": count}


@router.delete("/{history_id}")
async def delete_history_item(history_id: str, db: AsyncSession = Depends(get_db)):
    """Deletes a single history entry."""
    success = await crud.delete_history_item(db, history_id)
    if not success:
        raise HTTPException(status_code=404, detail="Élément d'historique introuvable.")
    return {"status": "deleted", "id": history_id}
