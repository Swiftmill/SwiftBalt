import asyncio
import re
from typing import Dict, Any, List, Optional
import yt_dlp
from backend.providers.base import BaseProvider, MediaMetadata, FormatOption, SubtitleOption

class YtdlpGenericProvider(BaseProvider):
    def __init__(
        self,
        provider_id: str,
        name: str,
        domains: List[str],
        icon: str = "video",
        capabilities: Optional[List[str]] = None
    ):
        self.id = provider_id
        self.name = name
        self.domains = domains
        self.icon = icon
        self.capabilities = capabilities or ["metadata", "download", "preview", "player"]

    def detect(self, url: str) -> bool:
        if not url:
            return False
        url_lower = url.lower()
        for domain in self.domains:
            if domain.lower() in url_lower:
                return True
        return False

    async def get_metadata(self, url: str) -> MediaMetadata:
        loop = asyncio.get_event_loop()
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'extract_flat': False,
        }

        def _extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)

        info = await loop.run_in_executor(None, _extract)
        if not info:
            raise ValueError(f"Impossible d'extraire les métadonnées pour {url}")

        formats: List[FormatOption] = []
        raw_formats = info.get('formats', [])
        for f in raw_formats:
            fmt_id = str(f.get('format_id', ''))
            ext = f.get('ext', 'mp4')
            resolution = f.get('resolution') or f"{f.get('width', '')}x{f.get('height', '')}".strip('x')
            vcodec = f.get('vcodec')
            acodec = f.get('acodec')

            has_video = vcodec != 'none' and vcodec is not None
            has_audio = acodec != 'none' and acodec is not None

            filesize = f.get('filesize') or f.get('filesize_approx')

            formats.append(
                FormatOption(
                    format_id=fmt_id,
                    ext=ext,
                    resolution=resolution if resolution else None,
                    quality=f.get('format_note') or (f"{f.get('height')}p" if f.get('height') else None),
                    filesize=filesize,
                    fps=f.get('fps'),
                    vcodec=vcodec if vcodec != 'none' else None,
                    acodec=acodec if acodec != 'none' else None,
                    url=f.get('url'),
                    has_video=has_video,
                    has_audio=has_audio
                )
            )

        subtitles: List[SubtitleOption] = []
        raw_subs = info.get('subtitles', {})
        for lang, sub_list in raw_subs.items():
            for sub in sub_list:
                subtitles.append(
                    SubtitleOption(
                        lang=lang,
                        name=sub.get('name') or lang,
                        ext=sub.get('ext', 'vtt'),
                        url=sub.get('url')
                    )
                )

        return MediaMetadata(
            id=str(info.get('id', '')),
            title=info.get('title') or "Sans titre",
            description=info.get('description'),
            author=info.get('uploader') or info.get('uploader_id') or info.get('channel'),
            uploader=info.get('uploader'),
            thumbnail=info.get('thumbnail'),
            duration=info.get('duration'),
            upload_date=str(info.get('upload_date')) if info.get('upload_date') else None,
            view_count=info.get('view_count'),
            like_count=info.get('like_count'),
            tags=info.get('tags') or [],
            categories=info.get('categories') or [],
            language=info.get('language'),
            provider_id=self.id,
            provider_name=self.name,
            source_url=url,
            available_formats=formats,
            available_subtitles=subtitles,
            is_direct_file=False
        )
