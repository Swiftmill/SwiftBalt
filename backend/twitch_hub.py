import asyncio
import yt_dlp
from typing import Dict, Any, List, Optional
from backend.providers.base import MediaMetadata, FormatOption

class TwitchHubService:
    def __init__(self):
        pass

    async def get_twitch_info(self, url: str) -> Dict[str, Any]:
        """
        Extracts details for Twitch channel, VOD or clip safely.
        """
        loop = asyncio.get_event_loop()
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
        }

        def _extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)

        info = await loop.run_in_executor(None, _extract)
        if not info:
            raise ValueError("Impossible de récupérer les informations Twitch pour cette URL.")

        is_clip = "clip" in url.lower() or "/clip/" in url.lower()
        is_vod = "/videos/" in url.lower() or "/video/" in url.lower()

        formats: List[Dict[str, Any]] = []
        for f in info.get('formats', []):
            formats.append({
                "format_id": f.get("format_id"),
                "resolution": f.get("resolution") or (f"{f.get('height')}p" if f.get('height') else "Source"),
                "quality": f.get("format_note"),
                "fps": f.get("fps"),
                "url": f.get("url"),
                "ext": f.get("ext", "mp4")
            })

        return {
            "id": info.get("id"),
            "title": info.get("title") or "Stream Twitch",
            "channel": info.get("uploader") or info.get("channel") or info.get("uploader_id"),
            "category": info.get("category") or info.get("game"),
            "duration": info.get("duration"),
            "thumbnail": info.get("thumbnail"),
            "view_count": info.get("view_count"),
            "created_at": info.get("upload_date"),
            "type": "clip" if is_clip else ("vod" if is_vod else "live"),
            "source_url": url,
            "formats": formats
        }

twitch_hub_service = TwitchHubService()
