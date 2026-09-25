import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.database import crud
from app.core.security import validate_url_security

router = APIRouter(prefix="/api/favorites", tags=["Favorites"])


class FavoriteCreateRequest(BaseModel):
    url: str
    title: Optional[str] = "Favori"
    platform: Optional[str] = "generic"
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = 0
    notes: Optional[str] = None


@router.get("", response_model=List[Dict[str, Any]])
async def get_favorites(db: AsyncSession = Depends(get_db)):
    """Returns saved favorite media items."""
    items = await crud.list_favorites(db)
    return [
        {
            "id": i.id,
            "url": i.url,
            "title": i.title,
            "platform": i.platform,
            "thumbnail_url": i.thumbnail_url,
            "duration": i.duration,
            "notes": i.notes,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in items
    ]


@router.post("", response_model=Dict[str, Any])
async def add_favorite(payload: FavoriteCreateRequest, db: AsyncSession = Depends(get_db)):
    """Bookmarks a media URL into Favorites."""
    validated = validate_url_security(payload.url)
    fav_id = str(uuid.uuid4())[:8]

    fav = await crud.add_favorite(db, {
        "id": fav_id,
        "url": validated,
        "title": payload.title or "Favori",
        "platform": payload.platform or "generic",
        "thumbnail_url": payload.thumbnail_url,
        "duration": payload.duration or 0,
        "notes": payload.notes,
    })

    return {
        "id": fav.id,
        "url": fav.url,
        "title": fav.title,
        "platform": fav.platform,
        "thumbnail_url": fav.thumbnail_url,
        "duration": fav.duration,
        "notes": fav.notes,
    }


@router.delete("/{fav_id}")
async def delete_favorite(fav_id: str, db: AsyncSession = Depends(get_db)):
    """Removes a favorite entry."""
    success = await crud.delete_favorite(db, fav_id)
    if not success:
        raise HTTPException(status_code=404, detail="Favori introuvable.")
    return {"status": "deleted", "id": fav_id}
