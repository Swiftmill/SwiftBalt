import asyncio
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse
import yt_dlp
from app.core.config import settings
from app.core.security import validate_url_security
from app.providers.base import BaseProvider


try:
    from yt_dlp.networking.impersonate import ImpersonateTarget
    HAVE_IMPERSONATE = True
except Exception:
    HAVE_IMPERSONATE = False


class YtDlpProvider(BaseProvider):
    """
    Unified, robust provider wrapping yt-dlp to support 25+ public video/audio platforms:
    YouTube, TikTok, Vimeo, Soundcloud, Reddit, Dailymotion, Twitter/X, Instagram,
    Facebook, Bilibili, Loom, Streamable, Bluesky, Newgrounds, Rutube, VK, OK.ru,
    Snapchat, Tumblr, Kick, Mastodon, Threads.
    """

    def __init__(
        self,
        provider_id: str,
        name: str,
        domains: List[str],
        icon: str = "video",
        capabilities: Optional[List[str]] = None,
        limitations: Optional[str] = None
    ):
        self.id = provider_id
        self.name = name
        self.icon = icon
        self.domains = domains
        self.capabilities = capabilities or ["video", "audio", "subtitles", "thumbnails", "quality_selection"]
        self.status = "operational"
        self.limitations = limitations

    def _get_ydl_opts(self, extract_flat: bool = False) -> dict:
        opts = {
            "quiet": True,
            "no_warnings": True,
            "no_color": True,
            "skip_download": True,
            "extract_flat": extract_flat,
            "socket_timeout": settings.REQUEST_TIMEOUT_SECONDS,
            "user_agent": settings.USER_AGENT,
            "geo_bypass": True,
            "noplaylist": True,
        }
        if HAVE_IMPERSONATE:
            opts["impersonate"] = ImpersonateTarget("chrome")
        return opts

    async def get_metadata(self, url: str) -> Dict[str, Any]:
        validated_url = validate_url_security(url)
        loop = asyncio.get_running_loop()

        def _extract():
            with yt_dlp.YoutubeDL(self._get_ydl_opts()) as ydl:
                return ydl.extract_info(validated_url, download=False)

        info = await loop.run_in_executor(None, _extract)
        if not info:
            raise ValueError(f"Impossible d'extraire les informations depuis {self.name}.")

        # Formats list
        raw_formats = info.get("formats", [])
        available_formats = []
        video_codec = "N/A"
        audio_codec = "N/A"
        fps = info.get("fps") or 30

        for f in raw_formats:
            fmt_note = f.get("format_note") or f.get("resolution") or (f"{f.get('height')}p" if f.get("height") else None)
            ext = f.get("ext") or "mp4"
            if f.get("vcodec") and f.get("vcodec") != "none":
                video_codec = f.get("vcodec").split(".")[0]
            if f.get("acodec") and f.get("acodec") != "none":
                audio_codec = f.get("acodec").split(".")[0]

            available_formats.append({
                "format_id": f.get("format_id"),
                "ext": ext,
                "resolution": f.get("resolution") or (f"{f.get('width')}x{f.get('height')}" if f.get("width") and f.get("height") else "audio only"),
                "height": f.get("height"),
                "fps": f.get("fps"),
                "filesize": f.get("filesize") or f.get("filesize_approx") or 0,
                "vcodec": f.get("vcodec"),
                "acodec": f.get("acodec"),
                "note": fmt_note,
                "url": f.get("url") if f.get("protocol", "").startswith("http") else None
            })

        # Subtitles
        subtitles_dict = info.get("subtitles", {})
        subtitles_list = []
        for lang, tracks in subtitles_dict.items():
            for t in tracks:
                if t.get("ext") in ("vtt", "srt"):
                    subtitles_list.append({
                        "lang": lang,
                        "ext": t.get("ext"),
                        "url": t.get("url")
                    })

        return {
            "id": info.get("id"),
            "title": info.get("title") or "Média sans titre",
            "author": info.get("uploader") or info.get("channel") or info.get("creator") or self.name,
            "uploader": info.get("uploader"),
            "platform": self.name,
            "duration": info.get("duration") or 0,
            "upload_date": info.get("upload_date") or "N/A",
            "description": (info.get("description") or "")[:400],
            "view_count": info.get("view_count") or 0,
            "like_count": info.get("like_count") or 0,
            "thumbnail": info.get("thumbnail"),
            "fps": fps,
            "video_codec": video_codec,
            "audio_codec": audio_codec,
            "subtitles": subtitles_list,
            "formats_count": len(available_formats),
            "type": "audio" if info.get("vcodec") == "none" else "video",
            "webpage_url": info.get("webpage_url") or url,
        }

    async def get_streams(self, url: str) -> List[Dict[str, Any]]:
        meta = await self.get_metadata(url)
        loop = asyncio.get_running_loop()

        def _extract():
            with yt_dlp.YoutubeDL(self._get_ydl_opts()) as ydl:
                return ydl.extract_info(url, download=False)

        info = await loop.run_in_executor(None, _extract)
        raw_formats = info.get("formats", []) if info else []
        streams = []

        for f in raw_formats:
            height = f.get("height")
            quality = f"{height}p" if height else "Audio"
            streams.append({
                "format_id": f.get("format_id"),
                "format": f.get("ext") or "mp4",
                "quality": quality,
                "resolution": f.get("resolution"),
                "filesize": f.get("filesize") or f.get("filesize_approx") or 0,
                "url": f.get("url"),
                "vcodec": f.get("vcodec"),
                "acodec": f.get("acodec")
            })
        return streams

    async def get_subtitles(self, url: str) -> List[Dict[str, Any]]:
        meta = await self.get_metadata(url)
        return meta.get("subtitles", [])

    async def get_player(self, url: str) -> Dict[str, Any]:
        meta = await self.get_metadata(url)
        loop = asyncio.get_running_loop()

        def _extract():
            with yt_dlp.YoutubeDL(self._get_ydl_opts()) as ydl:
                return ydl.extract_info(url, download=False)

        info = await loop.run_in_executor(None, _extract)
        preview_url = None
        stream_type = "direct"

        if info:
            # First try direct mp4/webm with both audio+video
            for f in reversed(info.get("formats", [])):
                if (
                    f.get("url")
                    and f.get("vcodec") != "none"
                    and f.get("acodec") != "none"
                    and f.get("ext") in ("mp4", "webm")
                    and f.get("protocol", "").startswith("http")
                ):
                    preview_url = f.get("url")
                    stream_type = "mp4"
                    break

            # Fallback to m3u8 HLS or any playable stream
            if not preview_url:
                for f in info.get("formats", []):
                    if f.get("url") and ("m3u8" in f.get("url") or f.get("protocol") == "m3u8_native"):
                        preview_url = f.get("url")
                        stream_type = "hls"
                        break

            if not preview_url and info.get("formats"):
                preview_url = info["formats"][-1].get("url")

        return {
            "stream_url": preview_url,
            "type": stream_type,
            "title": meta.get("title"),
            "thumbnail": meta.get("thumbnail"),
            "subtitles": meta.get("subtitles", []),
            "duration": meta.get("duration", 0)
        }
