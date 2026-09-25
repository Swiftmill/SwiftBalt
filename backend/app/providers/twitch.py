import re
import json
import asyncio
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse
import httpx
import yt_dlp
from app.core.config import settings
from app.core.security import validate_url_security
from app.providers.base import BaseProvider


class TwitchProvider(BaseProvider):
    """
    Dedicated provider for Twitch Hub:
    Streams (live), VODs (past broadcasts, including subscriber-only VOD recovery via GQL),
    Clips, and Highlights.
    """
    id = "twitch"
    name = "Twitch Hub"
    icon = "twitch"
    domains = ["twitch.tv", "clips.twitch.tv"]
    capabilities = ["video", "vods", "sub_only_vods", "clips", "live_stream", "quality_selection", "audio_only"]
    status = "operational"

    def detect(self, url: str) -> bool:
        try:
            parsed = urlparse(url)
            host = (parsed.hostname or "").lower()
            return host in ("twitch.tv", "www.twitch.tv", "clips.twitch.tv", "m.twitch.tv")
        except Exception:
            return False

    def get_twitch_type(self, url: str) -> str:
        """Determines whether the URL is a Clip, a VOD, or a Live Channel."""
        parsed = urlparse(url)
        path = parsed.path.lower()
        if "clips.twitch.tv" in parsed.netloc or "/clip/" in path or "/clip" in path:
            return "clip"
        elif self.extract_vod_id(url) is not None or "/videos" in path or "/video" in path or "/v/" in path:
            return "vod"
        else:
            return "channel"

    def extract_vod_id(self, url: str) -> Optional[str]:
        m = re.search(r"(?:videos|video|v)/(\d+)", url)
        return m.group(1) if m else None

    async def _resolve_gql_sub_vod(self, vod_id: str) -> Optional[Dict[str, Any]]:
        """
        Recovers sub-only and regular Twitch VOD streams via Twitch GQL API + CloudFront CDN,
        exactly like sub-vod.fr and TwitchRecover.
        """
        query = [
            {
                "operationName": "VideoPlayer_VODSeekbarPreviewVideo",
                "variables": {"includePrivate": False, "videoID": vod_id},
                "extensions": {
                    "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "07e99e4d56c5a7c67117a154777b0baf85a5ffefa393b213f4bc712ccaf85dd6"
                    }
                }
            },
            {
                "operationName": "ComscoreStreamingQuery",
                "variables": {
                    "channel": "",
                    "clipSlug": "",
                    "isClip": False,
                    "isLive": False,
                    "isVodOrCollection": True,
                    "vodID": vod_id
                },
                "extensions": {
                    "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "e1edae8122517d013405f237ffcc124515dc6ded82480a88daef69c83b53ac01"
                    }
                }
            },
            {
                "operationName": "ChannelVideoCore",
                "variables": {"videoID": vod_id},
                "extensions": {
                    "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "cf1ccf6f5b94c94d662efec5223dfb260c9f8bf053239a76125a58118769e8e2"
                    }
                }
            }
        ]

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.post(
                    "https://gql.twitch.tv/gql",
                    json=query,
                    headers={
                        "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
                        "Content-Type": "application/json",
                        "User-Agent": settings.USER_AGENT
                    }
                )
                if res.status_code != 200:
                    return None
                data = res.json()
                if not isinstance(data, list) or len(data) < 2:
                    return None

                seek_url = data[0].get("data", {}).get("video", {}).get("seekPreviewsURL")
                vod_info = data[1].get("data", {}).get("video", {}) or {}
                owner_info = (data[2].get("data", {}).get("video", {}).get("owner", {})
                              if len(data) > 2 else {}) or vod_info.get("owner", {}) or {}

                if not seek_url or "storyboards" not in seek_url:
                    return None

                broadcast_type = str(vod_info.get("broadcastType") or "archive").lower()
                base_cdn = seek_url[:seek_url.index("storyboards")]
                title = vod_info.get("title") or f"Twitch VOD {vod_id}"
                channel_name = owner_info.get("displayName") or owner_info.get("login") or "Twitch Streamer"
                profile_pic = owner_info.get("profileImageURL")
                duration = vod_info.get("lengthSeconds") or 0
                category = vod_info.get("game", {}).get("name") if vod_info.get("game") else "Gaming"
                created_at = vod_info.get("createdAt") or "N/A"

                def make_m3u8(quality_key: str) -> str:
                    if broadcast_type == "highlight":
                        return f"{base_cdn}{quality_key}/highlight-{vod_id}.m3u8"
                    return f"{base_cdn}{quality_key}/index-dvr.m3u8"

                source_m3u8 = make_m3u8("chunked")
                p720_60_m3u8 = make_m3u8("720p60")
                p720_30_m3u8 = make_m3u8("720p30")
                p480_30_m3u8 = make_m3u8("480p30")
                p360_30_m3u8 = make_m3u8("360p30")
                p160_30_m3u8 = make_m3u8("160p30")
                audio_m3u8 = make_m3u8("audio_only")

                # Local proxy URL for browser playback (bypasses CORS & adblock)
                from urllib.parse import quote
                preview_player_url = f"/api/twitch/hls/manifest.m3u8?url={quote(source_m3u8)}"

                # Standard thumbnail
                thumbnail = profile_pic or f"https://static-cdn.jtvnw.net/cf_vods/{vod_id}/thumb/thumb0-640x360.jpg"

                return {
                    "id": vod_id,
                    "title": title,
                    "author": channel_name,
                    "channel": channel_name,
                    "platform": "Twitch",
                    "twitch_type": "vod",
                    "category": category,
                    "duration": duration,
                    "upload_date": created_at[:10] if len(created_at) >= 10 else "N/A",
                    "description": f"Rediffusion Twitch de {channel_name} (débloquée via SubVod)",
                    "view_count": 0,
                    "thumbnail": thumbnail,
                    "fps": 60,
                    "video_codec": "H.264",
                    "audio_codec": "AAC",
                    "qualities": ["Source (1080p60)", "720p60", "720p30", "480p30", "360p30", "160p30", "Audio"],
                    "formats": ["mp4", "mkv", "mp3", "wav", "m4a", "flac"],
                    "is_live": False,
                    "is_sub_only": True,
                    "webpage_url": f"https://www.twitch.tv/videos/{vod_id}",
                    "type": "video",
                    "stream_url": preview_player_url,
                    "direct_m3u8": source_m3u8,
                    "broadcast_type": broadcast_type,
                    "streams": [
                        {"format_id": "chunked", "quality": "Source (1080p60)", "url": source_m3u8, "format": "m3u8"},
                        {"format_id": "720p60", "quality": "720p60", "url": p720_60_m3u8, "format": "m3u8"},
                        {"format_id": "720p30", "quality": "720p30", "url": p720_30_m3u8, "format": "m3u8"},
                        {"format_id": "480p30", "quality": "480p30", "url": p480_30_m3u8, "format": "m3u8"},
                        {"format_id": "360p30", "quality": "360p30", "url": p360_30_m3u8, "format": "m3u8"},
                        {"format_id": "160p30", "quality": "160p30", "url": p160_30_m3u8, "format": "m3u8"},
                        {"format_id": "audio_only", "quality": "Audio", "url": audio_m3u8, "format": "m3u8"},
                    ]
                }
        except Exception:
            return None

    async def get_metadata(self, url: str) -> Dict[str, Any]:
        validated_url = validate_url_security(url)
        twitch_type = self.get_twitch_type(validated_url)

        # 1) If it's a VOD, first attempt sub-only recovery / direct GQL resolution
        if twitch_type == "vod":
            vod_id = self.extract_vod_id(validated_url)
            if vod_id:
                gql_vod = await self._resolve_gql_sub_vod(vod_id)
                if gql_vod:
                    return gql_vod

        # 2) Regular yt-dlp extraction for clips and live channels
        loop = asyncio.get_running_loop()

        def _extract():
            ydl_opts = {
                "quiet": True,
                "no_warnings": True,
                "skip_download": True,
                "socket_timeout": settings.REQUEST_TIMEOUT_SECONDS,
                "user_agent": settings.USER_AGENT,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(validated_url, download=False)

        try:
            info = await loop.run_in_executor(None, _extract)
        except Exception as e:
            # If yt-dlp errored on a sub-only VOD, try GQL again as fallback
            if twitch_type == "vod":
                vod_id = self.extract_vod_id(validated_url)
                if vod_id:
                    gql_vod = await self._resolve_gql_sub_vod(vod_id)
                    if gql_vod:
                        return gql_vod
            raise ValueError(f"Impossible de récupérer les informations de Twitch : {e}")

        if not info:
            raise ValueError("Impossible de récupérer les informations de Twitch.")

        raw_formats = info.get("formats", [])
        qualities = []
        for f in raw_formats:
            res = f.get("resolution") or (f"{f.get('height')}p" if f.get("height") else "Audio")
            if res not in qualities:
                qualities.append(res)

        channel_name = info.get("uploader") or info.get("channel") or "Twitch Streamer"
        title = info.get("title") or f"Contenu Twitch ({twitch_type.upper()})"

        return {
            "id": info.get("id"),
            "title": title,
            "author": channel_name,
            "channel": channel_name,
            "platform": "Twitch",
            "twitch_type": twitch_type,
            "category": info.get("genre") or info.get("categories", ["Gaming"])[0] if info.get("categories") else "Gaming",
            "duration": info.get("duration") or 0,
            "upload_date": info.get("upload_date") or "Direct",
            "description": (info.get("description") or f"{twitch_type.capitalize()} Twitch de {channel_name}")[:300],
            "view_count": info.get("view_count") or 0,
            "thumbnail": info.get("thumbnail"),
            "fps": info.get("fps") or 60,
            "video_codec": "H.264",
            "audio_codec": "AAC",
            "qualities": qualities or ["Auto", "1080p60", "720p60", "480p", "Audio"],
            "formats": ["mp4"],
            "is_live": info.get("is_live", False),
            "webpage_url": validated_url,
            "type": "video"
        }

    async def get_streams(self, url: str) -> List[Dict[str, Any]]:
        meta = await self.get_metadata(url)
        if meta.get("streams"):
            return meta["streams"]

        loop = asyncio.get_running_loop()

        def _extract():
            with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
                return ydl.extract_info(url, download=False)

        try:
            info = await loop.run_in_executor(None, _extract)
        except Exception:
            return []

        formats = []
        if info:
            for f in info.get("formats", []):
                formats.append({
                    "format_id": f.get("format_id"),
                    "format": f.get("ext") or "mp4",
                    "quality": f.get("resolution") or (f"{f.get('height')}p" if f.get("height") else "Audio"),
                    "filesize": f.get("filesize") or 0,
                    "url": f.get("url"),
                    "fps": f.get("fps")
                })
        return formats

    async def get_player(self, url: str) -> Dict[str, Any]:
        meta = await self.get_metadata(url)
        stream_url = meta.get("stream_url")
        stream_type = "hls" if meta.get("twitch_type") in ("vod", "channel") else "mp4"

        if not stream_url:
            streams = await self.get_streams(url)
            for s in streams:
                if s.get("url"):
                    stream_url = s["url"]
                    if "m3u8" in stream_url:
                        stream_type = "hls"
                    break

        return {
            "stream_url": stream_url,
            "type": stream_type,
            "title": meta.get("title"),
            "channel": meta.get("author"),
            "thumbnail": meta.get("thumbnail"),
            "duration": meta.get("duration", 0),
            "twitch_type": meta.get("twitch_type"),
            "subtitles": []
        }
