from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse


class BaseProvider(ABC):
    """
    Abstract base interface for all SwiftBalt media & file providers.
    Every platform provider must implement this interface to be registered.
    """

    id: str = "base"
    name: str = "Base Provider"
    icon: str = "globe"
    domains: List[str] = []
    capabilities: List[str] = ["video", "audio"]
    status: str = "operational"
    limitations: Optional[str] = None

    def detect(self, url: str) -> bool:
        """
        Returns True if the URL matches one of the provider's domains or patterns.
        """
        try:
            parsed = urlparse(url)
            host = (parsed.hostname or "").lower()
            return any(host == d or host.endswith("." + d) for d in self.domains)
        except Exception:
            return False

    @abstractmethod
    async def get_metadata(self, url: str) -> Dict[str, Any]:
        """
        Extracts public metadata for preview:
        title, author, uploader, duration, upload_date, description,
        view_count, thumbnail, etc.
        """
        pass

    @abstractmethod
    async def get_streams(self, url: str) -> List[Dict[str, Any]]:
        """
        Extracts available streams/formats (resolutions, codecs, bitrates, audio/video).
        """
        pass

    async def get_thumbnail(self, url: str) -> Optional[str]:
        """
        Returns the best thumbnail URL.
        """
        meta = await self.get_metadata(url)
        return meta.get("thumbnail")

    async def get_subtitles(self, url: str) -> List[Dict[str, Any]]:
        """
        Returns available subtitles (vtt, srt, language).
        """
        return []

    async def get_download_options(self, url: str) -> Dict[str, Any]:
        """
        Returns available qualities and formats for download, filtering out storyboard artifacts
        and sorting video resolutions cleanly.
        """
        streams = await self.get_streams(url)
        raw_qualities = set()
        for s in streams:
            q = s.get("quality")
            if q and q.lower() != "audio":
                raw_qualities.add(q)

        def _sort_key(val: str) -> int:
            digits = "".join(ch for ch in val if ch.isdigit())
            return int(digits) if digits else 0

        # Only allow standard user-facing video resolutions (ignoring thumbnail/storyboard heights like 27p, 45p, 90p, 180p)
        standard_allowed = {144, 240, 360, 480, 720, 1080, 1440, 2160, 4320}
        valid_qualities = [
            q for q in raw_qualities
            if _sort_key(q) in standard_allowed
        ]
        sorted_qualities = sorted(valid_qualities, key=_sort_key, reverse=True)
        if not sorted_qualities:
            sorted_qualities = ["1080p", "720p", "480p", "360p"]

        return {
            "qualities": sorted_qualities,
            "formats": ["mp4", "webm", "mkv", "mp3", "wav", "m4a", "opus", "flac"],
            "video_formats": ["mp4", "webm", "mkv"],
            "audio_formats": ["mp3", "wav", "m4a", "opus", "flac"]
        }

    async def get_player(self, url: str) -> Dict[str, Any]:
        """
        Returns streaming player information: playable direct stream URL,
        stream type (mp4, hls, dash), audio tracks, and subtitles.
        """
        meta = await self.get_metadata(url)
        streams = await self.get_streams(url)
        # Select best preview stream
        preview_stream = None
        for s in streams:
            if s.get("url") and s.get("format") in ("mp4", "webm", "mp3"):
                preview_stream = s.get("url")
                break
        return {
            "stream_url": preview_stream or streams[0].get("url") if streams else None,
            "type": "direct",
            "title": meta.get("title"),
            "thumbnail": meta.get("thumbnail"),
            "subtitles": await self.get_subtitles(url),
        }
