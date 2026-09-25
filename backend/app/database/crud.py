import json
import datetime
from typing import List, Optional
from sqlalchemy.future import select
from sqlalchemy import delete, update, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.models import (
    DownloadModel,
    HistoryModel,
    FavoriteModel,
    TorrentModel,
    SettingModel,
    ProviderStatusModel,
)


# --- Downloads CRUD ---
async def create_download(session: AsyncSession, item_data: dict) -> DownloadModel:
    item = DownloadModel(**item_data)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def get_download(session: AsyncSession, download_id: str) -> Optional[DownloadModel]:
    result = await session.execute(select(DownloadModel).where(DownloadModel.id == download_id))
    return result.scalar_one_or_none()


async def list_downloads(session: AsyncSession, limit: int = 100) -> List[DownloadModel]:
    result = await session.execute(select(DownloadModel).order_by(desc(DownloadModel.created_at)).limit(limit))
    return list(result.scalars().all())


async def update_download(session: AsyncSession, download_id: str, updates: dict) -> Optional[DownloadModel]:
    updates["updated_at"] = datetime.datetime.utcnow()
    await session.execute(
        update(DownloadModel).where(DownloadModel.id == download_id).values(**updates)
    )
    await session.commit()
    return await get_download(session, download_id)


async def delete_download(session: AsyncSession, download_id: str) -> bool:
    result = await session.execute(delete(DownloadModel).where(DownloadModel.id == download_id))
    await session.commit()
    return result.rowcount > 0


# --- History CRUD ---
async def add_history(session: AsyncSession, history_data: dict) -> HistoryModel:
    item = HistoryModel(**history_data)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def list_history(session: AsyncSession, limit: int = 100) -> List[HistoryModel]:
    result = await session.execute(select(HistoryModel).order_by(desc(HistoryModel.created_at)).limit(limit))
    return list(result.scalars().all())


async def clear_history(session: AsyncSession) -> int:
    result = await session.execute(delete(HistoryModel))
    await session.commit()
    return result.rowcount


async def delete_history_item(session: AsyncSession, history_id: str) -> bool:
    result = await session.execute(delete(HistoryModel).where(HistoryModel.id == history_id))
    await session.commit()
    return result.rowcount > 0


# --- Favorites CRUD ---
async def add_favorite(session: AsyncSession, fav_data: dict) -> FavoriteModel:
    item = FavoriteModel(**fav_data)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def list_favorites(session: AsyncSession) -> List[FavoriteModel]:
    result = await session.execute(select(FavoriteModel).order_by(desc(FavoriteModel.created_at)))
    return list(result.scalars().all())


async def delete_favorite(session: AsyncSession, fav_id: str) -> bool:
    result = await session.execute(delete(FavoriteModel).where(FavoriteModel.id == fav_id))
    await session.commit()
    return result.rowcount > 0


# --- Torrents CRUD ---
async def create_torrent(session: AsyncSession, torrent_data: dict) -> TorrentModel:
    valid_cols = {c.name for c in TorrentModel.__table__.columns}
    filtered = {k: v for k, v in torrent_data.items() if k in valid_cols}
    item = TorrentModel(**filtered)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def get_torrent(session: AsyncSession, torrent_id: str) -> Optional[TorrentModel]:
    result = await session.execute(select(TorrentModel).where(TorrentModel.id == torrent_id))
    return result.scalar_one_or_none()


async def list_torrents(session: AsyncSession) -> List[TorrentModel]:
    result = await session.execute(select(TorrentModel).order_by(desc(TorrentModel.created_at)))
    return list(result.scalars().all())


async def update_torrent(session: AsyncSession, torrent_id: str, updates: dict) -> Optional[TorrentModel]:
    clean_updates = dict(updates)
    clean_updates["updated_at"] = datetime.datetime.utcnow()
    clean_updates.pop("id", None)
    valid_cols = {c.name for c in TorrentModel.__table__.columns}
    filtered = {k: v for k, v in clean_updates.items() if k in valid_cols}
    await session.execute(
        update(TorrentModel).where(TorrentModel.id == torrent_id).values(**filtered)
    )
    await session.commit()
    return await get_torrent(session, torrent_id)


async def delete_torrent(session: AsyncSession, torrent_id: str) -> bool:
    result = await session.execute(delete(TorrentModel).where(TorrentModel.id == torrent_id))
    await session.commit()
    return result.rowcount > 0


# --- Settings CRUD ---
async def get_all_settings(session: AsyncSession) -> dict:
    result = await session.execute(select(SettingModel))
    settings_dict = {}
    for s in result.scalars().all():
        try:
            settings_dict[s.key] = json.loads(s.value)
        except Exception:
            settings_dict[s.key] = s.value
    return settings_dict


async def set_setting(session: AsyncSession, key: str, value: any) -> SettingModel:
    val_str = json.dumps(value) if not isinstance(value, str) else value
    result = await session.execute(select(SettingModel).where(SettingModel.key == key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = val_str
        setting.updated_at = datetime.datetime.utcnow()
    else:
        setting = SettingModel(key=key, value=val_str)
        session.add(setting)
    await session.commit()
    return setting
