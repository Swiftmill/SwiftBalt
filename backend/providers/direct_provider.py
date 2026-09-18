import os
import httpx
from typing import List, Optional
from urllib.parse import urlparse, unquote
from backend.providers.base import BaseProvider, MediaMetadata, FormatOption
from backend.security import is_safe_url, sanitize_filename

DIRECT_EXTENSIONS = {
    # Video
    'mp4', 'webm', 'mkv', 'mov', 'avi', 'flv', 'wmv', 'm4v',
    # Audio
    'mp3', 'm4a', 'wav', 'flac', 'aac', 'ogg', 'opus',
    # Documents & Archives
    'zip', 'rar', '7z', 'tar', 'gz', 'iso', 'pdf', 'exe', 'msi', 'apk',
    # Images
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'
}

class DirectUrlProvider(BaseProvider):
    id = "direct_url"
    name = "Téléchargement Direct (Fichier / URL)"
    domains = []
    icon = "file-down"
    capabilities = ["metadata", "download", "direct"]

    def detect(self, url: str) -> bool:
        if not url:
            return False
        parsed = urlparse(url)
        path = unquote(parsed.path.lower())
        ext = path.split('.')[-1] if '.' in path else ''
        return ext in DIRECT_EXTENSIONS

    async def get_metadata(self, url: str) -> MediaMetadata:
        is_safe, error_msg = is_safe_url(url)
        if not is_safe:
            raise ValueError(error_msg)

        parsed = urlparse(url)
        path = unquote(parsed.path)
        filename = os.path.basename(path) or "download_file"
        ext = filename.split('.')[-1] if '.' in filename else "bin"

        content_length: Optional[int] = None
        content_type: str = "application/octet-stream"

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.head(url)
                if resp.status_code >= 400:
                    resp = await client.get(url, headers={"Range": "bytes=0-10"})

                content_length_header = resp.headers.get("content-length")
                if content_length_header and content_length_header.isdigit():
                    content_length = int(content_length_header)
                content_type = resp.headers.get("content-type", content_type)
        except Exception:
            pass

        format_opt = FormatOption(
            format_id="direct",
            ext=ext,
            quality="Direct File",
            filesize=content_length,
            url=url,
            has_video=ext in ['mp4', 'webm', 'mkv', 'mov', 'avi'],
            has_audio=ext in ['mp3', 'm4a', 'wav', 'flac', 'aac', 'ogg', 'opus', 'mp4', 'webm', 'mkv']
        )

        return MediaMetadata(
            id=sanitize_filename(filename),
            title=filename,
            description=f"Direct file via {parsed.netloc} ({content_type})",
            author=parsed.netloc,
            uploader=parsed.netloc,
            thumbnail=None,
            duration=None,
            upload_date=None,
            provider_id=self.id,
            provider_name=self.name,
            source_url=url,
            available_formats=[format_opt],
            available_subtitles=[],
            is_direct_file=True,
            estimated_size=content_length
        )
