import os
import mimetypes
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse, unquote
import httpx
from app.core.config import settings
from app.core.security import validate_url_security, sanitize_filename
from app.providers.base import BaseProvider


DIRECT_FILE_EXTENSIONS = {
    # Archives & Disk images
    ".zip", ".rar", ".7z", ".tar", ".gz", ".iso", ".dmg", ".img",
    # Executables & Packages
    ".exe", ".msi", ".apk", ".bin", ".deb", ".rpm",
    # Documents
    ".pdf", ".epub", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
    # Audio
    ".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus",
    # Video
    ".mp4", ".webm", ".mkv", ".mov", ".avi", ".ts",
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"
}


class DirectProvider(BaseProvider):
    """
    Handles direct file URLs (ZIP, ISO, PDF, MP4, MP3, images, packages).
    Inspects Content-Type, Content-Length, Content-Disposition, Accept-Ranges.
    """
    id = "direct"
    name = "Direct File Download"
    icon = "download"
    domains = ["*"]
    capabilities = ["direct_download", "resume_support", "metadata_inspection"]
    status = "operational"

    def detect(self, url: str) -> bool:
        try:
            parsed = urlparse(url)
            path = parsed.path.lower()
            ext = os.path.splitext(path)[1]
            return ext in DIRECT_FILE_EXTENSIONS
        except Exception:
            return False

    async def get_metadata(self, url: str) -> Dict[str, Any]:
        # Validate security / SSRF first
        validated_url = validate_url_security(url)
        parsed = urlparse(validated_url)

        # Default guessed filename from URL
        raw_filename = unquote(os.path.basename(parsed.path)) or "downloaded_file"
        file_name = sanitize_filename(raw_filename)
        _, ext = os.path.splitext(file_name)

        content_length = 0
        content_type = mimetypes.guess_type(file_name)[0] or "application/octet-stream"
        accept_ranges = False
        server = "Unknown"

        # Make a fast HEAD request to inspect headers
        try:
            async with httpx.AsyncClient(
                headers={"User-Agent": settings.USER_AGENT},
                timeout=10.0,
                follow_redirects=True,
                verify=False
            ) as client:
                res = await client.head(validated_url)
                if res.status_code in (200, 206):
                    headers = res.headers
                    if "content-length" in headers:
                        content_length = int(headers["content-length"])
                    if "content-type" in headers:
                        content_type = headers["content-type"].split(";")[0].strip()
                    accept_ranges = headers.get("accept-ranges", "").lower() == "bytes"
                    server = headers.get("server", "Web Server")
                    
                    # Content-Disposition filename
                    cd = headers.get("content-disposition", "")
                    if "filename=" in cd:
                        parts = cd.split("filename=")
                        if len(parts) > 1:
                            disp_name = parts[1].split(";")[0].strip("\"' ")
                            if disp_name:
                                file_name = sanitize_filename(unquote(disp_name))
                                _, ext = os.path.splitext(file_name)
        except Exception:
            pass

        format_name = ext.lstrip(".").upper() if ext else "FILE"
        media_type = "video" if "video" in content_type else ("audio" if "audio" in content_type else "file")

        return {
            "title": file_name,
            "author": server,
            "uploader": parsed.netloc,
            "platform": "Direct File",
            "file_type": content_type,
            "extension": ext,
            "duration": 0,
            "upload_date": "N/A",
            "description": f"Fichier hébergé sur {parsed.netloc} ({content_type})",
            "view_count": 0,
            "file_size": content_length,
            "accept_ranges": accept_ranges,
            "server": server,
            "type": media_type,
            "thumbnail": None,
            "is_direct": True,
        }

    async def get_streams(self, url: str) -> List[Dict[str, Any]]:
        meta = await self.get_metadata(url)
        return [{
            "format_id": "direct",
            "format": meta.get("extension", "").lstrip(".").lower() or "bin",
            "quality": "Original",
            "url": url,
            "file_size": meta.get("file_size", 0),
            "media_type": meta.get("type", "file")
        }]

    async def get_player(self, url: str) -> Dict[str, Any]:
        meta = await self.get_metadata(url)
        is_playable = meta.get("type") in ("video", "audio")
        return {
            "stream_url": url if is_playable else None,
            "type": "direct",
            "title": meta.get("title"),
            "thumbnail": None,
            "is_playable": is_playable,
            "subtitles": []
        }
