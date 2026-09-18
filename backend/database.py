from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Boolean
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class DownloadTask(Base):
    __tablename__ = "downloads"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    source_url = Column(String, nullable=False)
    provider_id = Column(String, nullable=False)
    format_id = Column(String, nullable=True)
    target_format = Column(String, nullable=True)

    # Statuses: queued, processing, downloading, merging, converting, completed, paused, failed, cancelled
    status = Column(String, default="queued")
    progress = Column(Float, default=0.0)
    speed_kbps = Column(Float, default=0.0)
    downloaded_bytes = Column(Integer, default=0)
    total_bytes = Column(Integer, default=0)
    eta_seconds = Column(Integer, nullable=True)

    file_path = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    error_message = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class HistoryEntry(Base):
    __tablename__ = "history"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    source_url = Column(String, nullable=False)
    provider_id = Column(String, nullable=False)
    file_path = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    format = Column(String, nullable=True)
    status = Column(String, nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow)

class FavoriteItem(Base):
    __tablename__ = "favorites"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    source_url = Column(String, nullable=False)
    provider_id = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class TorrentTask(Base):
    __tablename__ = "torrents"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    source = Column(String, nullable=False)  # magnet or torrent file path
    status = Column(String, default="queued")  # queued, downloading, seeding, paused, completed, error
    progress = Column(Float, default=0.0)
    downloaded_bytes = Column(Integer, default=0)
    total_bytes = Column(Integer, default=0)
    download_speed_kbps = Column(Float, default=0.0)
    upload_speed_kbps = Column(Float, default=0.0)
    num_peers = Column(Integer, default=0)
    num_seeds = Column(Integer, default=0)
    eta_seconds = Column(Integer, nullable=True)
    save_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
