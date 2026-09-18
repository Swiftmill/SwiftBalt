from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from pydantic import BaseModel

class FormatOption(BaseModel):
    format_id: str
    ext: str
    resolution: Optional[str] = None
    quality: Optional[str] = None
    filesize: Optional[int] = None
    fps: Optional[float] = None
    vcodec: Optional[str] = None
    acodec: Optional[str] = None
    url: Optional[str] = None
    has_video: bool = True
    has_audio: bool = True

class SubtitleOption(BaseModel):
    lang: str
    name: Optional[str] = None
    ext: str = "vtt"
    url: str

class MediaMetadata(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    author: Optional[str] = None
    uploader: Optional[str] = None
    thumbnail: Optional[str] = None
    duration: Optional[float] = None
    upload_date: Optional[str] = None
    view_count: Optional[int] = None
    like_count: Optional[int] = None
    tags: List[str] = []
    categories: List[str] = []
    language: Optional[str] = None
    provider_id: str
    provider_name: str
    source_url: str
    available_formats: List[FormatOption] = []
    available_subtitles: List[SubtitleOption] = []
    is_direct_file: bool = False
    estimated_size: Optional[int] = None

class BaseProvider(ABC):
    id: str
    name: str
    domains: List[str]
    icon: str = "video"
    capabilities: List[str] = ["metadata", "download", "preview"]

    @abstractmethod
    def detect(self, url: str) -> bool:
        """Return True if this provider can handle the given URL."""
        pass

    @abstractmethod
    async def get_metadata(self, url: str) -> MediaMetadata:
        """Extract public metadata and stream options for the given URL."""
        pass

    def get_status(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "domains": self.domains,
            "icon": self.icon,
            "capabilities": self.capabilities,
            "status": "active"
        }
