import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    DateTime,
    Boolean,
    Text,
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class DownloadModel(Base):
    __tablename__ = "downloads"

    id = Column(String(64), primary_key=True, index=True)
    url = Column(Text, nullable=False)
    title = Column(String(255), default="Sans titre")
    platform = Column(String(64), default="generic")
    status = Column(String(32), default="queued", index=True)
    # queued, processing, downloading, merging, converting, completed, paused, failed, cancelled
    progress = Column(Float, default=0.0)
    downloaded_bytes = Column(Integer, default=0)
    total_bytes = Column(Integer, default=0)
    speed = Column(Float, default=0.0)  # bytes per sec
    eta = Column(Integer, default=0)    # seconds remaining
    file_path = Column(Text, nullable=True)
    file_size = Column(Integer, default=0)
    format = Column(String(32), default="mp4")
    quality = Column(String(32), default="1080p")
    thumbnail_url = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class HistoryModel(Base):
    __tablename__ = "history"

    id = Column(String(64), primary_key=True, index=True)
    download_id = Column(String(64), nullable=True)
    title = Column(String(255), default="Sans titre")
    url = Column(Text, nullable=False)
    platform = Column(String(64), default="generic")
    file_path = Column(Text, nullable=True)
    file_size = Column(Integer, default=0)
    format = Column(String(32), default="mp4")
    quality = Column(String(32), default="1080p")
    duration = Column(Integer, default=0)
    thumbnail_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class FavoriteModel(Base):
    __tablename__ = "favorites"

    id = Column(String(64), primary_key=True, index=True)
    url = Column(Text, nullable=False, unique=True)
    title = Column(String(255), default="Sans titre")
    platform = Column(String(64), default="generic")
    thumbnail_url = Column(Text, nullable=True)
    duration = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class TorrentModel(Base):
    __tablename__ = "torrents"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), default="Torrent sans nom")
    magnet_uri = Column(Text, nullable=True)
    status = Column(String(32), default="downloading")  # downloading, paused, completed, error
    progress = Column(Float, default=0.0)
    total_size = Column(Integer, default=0)
    downloaded_size = Column(Integer, default=0)
    upload_size = Column(Integer, default=0)
    download_speed = Column(Float, default=0.0)
    upload_speed = Column(Float, default=0.0)
    peers = Column(Integer, default=0)
    seeds = Column(Integer, default=0)
    eta = Column(Integer, default=0)
    files_json = Column(Text, default="[]")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class SettingModel(Base):
    __tablename__ = "settings"

    key = Column(String(64), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class ProviderStatusModel(Base):
    __tablename__ = "providers"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    status = Column(String(32), default="active")  # active, degraded, maintenance, unavailable
    last_check = Column(DateTime, default=datetime.datetime.utcnow)
    capabilities_json = Column(Text, default="[]")
    enabled = Column(Boolean, default=True)
