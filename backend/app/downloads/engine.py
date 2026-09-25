import os
import time
import asyncio
from pathlib import Path
from typing import Callable, Optional, Dict, Any
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import httpx
import yt_dlp
from app.core.config import settings
from app.core.security import sanitize_filename
from app.ffmpeg.service import ffmpeg_service

try:
    from yt_dlp.networking.impersonate import ImpersonateTarget
    HAVE_IMPERSONATE = True
except Exception:
    HAVE_IMPERSONATE = False


class DownloadEngine:
    """
    Executes individual downloads for either direct HTTP files or media platforms via yt-dlp.
    Reports real-time progress, speed, and ETA.
    """

    @staticmethod
    async def download_direct_file(
        url: str,
        destination_path: Path,
        progress_callback: Callable[[Dict[str, Any]], None],
        cancel_event: asyncio.Event,
        pause_event: asyncio.Event
    ) -> Path:
        """Downloads a direct HTTP/HTTPS file in chunks with pause/cancel and progress reporting."""
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        temp_file = destination_path.with_suffix(destination_path.suffix + ".part")

        # Resume support: check existing part size
        downloaded_bytes = 0
        if temp_file.exists():
            downloaded_bytes = temp_file.stat().st_size

        headers = {"User-Agent": settings.USER_AGENT}
        if downloaded_bytes > 0:
            headers["Range"] = f"bytes={downloaded_bytes}-"

        async with httpx.AsyncClient(
            headers=headers,
            timeout=settings.REQUEST_TIMEOUT_SECONDS,
            follow_redirects=True,
            verify=False
        ) as client:
            async with client.stream("GET", url) as response:
                if response.status_code not in (200, 206):
                    raise RuntimeError(f"HTTP error {response.status_code} during download.")

                total_content = response.headers.get("content-length")
                total_bytes = int(total_content) + downloaded_bytes if total_content else 0

                start_time = time.time()
                last_update = start_time
                bytes_since_update = 0

                mode = "ab" if (response.status_code == 206 and downloaded_bytes > 0) else "wb"
                if mode == "wb":
                    downloaded_bytes = 0

                with open(temp_file, mode) as f:
                    async for chunk in response.aiter_bytes(chunk_size=64 * 1024):
                        if cancel_event.is_set():
                            raise asyncio.CancelledError("Téléchargement annulé par l'utilisateur.")

                        # Handle pause: wait while paused
                        while pause_event.is_set():
                            await asyncio.sleep(0.5)
                            if cancel_event.is_set():
                                raise asyncio.CancelledError("Téléchargement annulé pendant la pause.")

                        f.write(chunk)
                        chunk_len = len(chunk)
                        downloaded_bytes += chunk_len
                        bytes_since_update += chunk_len

                        now = time.time()
                        if now - last_update >= 0.4:
                            elapsed = now - last_update
                            speed = bytes_since_update / elapsed if elapsed > 0 else 0
                            progress = (downloaded_bytes / total_bytes * 100) if total_bytes > 0 else 0
                            remaining_bytes = max(0, total_bytes - downloaded_bytes)
                            eta = int(remaining_bytes / speed) if speed > 0 else 0

                            progress_callback({
                                "status": "downloading",
                                "progress": round(progress, 1),
                                "downloaded_bytes": downloaded_bytes,
                                "total_bytes": total_bytes,
                                "speed": speed,
                                "eta": eta
                            })
                            last_update = now
                            bytes_since_update = 0

        # Rename .part to destination
        if destination_path.exists():
            destination_path.unlink()
        temp_file.rename(destination_path)
        return destination_path

    @staticmethod
    async def download_media(
        url: str,
        output_dir: Path,
        title: str,
        target_format: str = "mp4",
        target_quality: str = "1080p",
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        cancel_event: Optional[asyncio.Event] = None
    ) -> Path:
        """
        Downloads video or audio using yt-dlp with specific format/resolution options,
        merging audio+video if necessary, and calling progress hooks.
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        safe_title = sanitize_filename(title or "media_download")
        outtmpl = str(output_dir / f"{safe_title}.%(ext)s")

        is_audio_only = target_format.lower() in ("mp3", "m4a", "wav", "flac", "opus", "aac")

        # Format selector string
        if is_audio_only:
            ydl_format = "bestaudio/best"
        else:
            height = target_quality.rstrip("p")
            if height.isdigit():
                h = int(height)
                ydl_format = f"bestvideo[height<={h}]+bestaudio/best[height<={h}]/best"
            else:
                ydl_format = "bestvideo+bestaudio/best"

        last_progress_time = 0

        def ydl_progress_hook(d):
            nonlocal last_progress_time
            if cancel_event and cancel_event.is_set():
                raise yt_dlp.utils.DownloadCancelled("Téléchargement annulé par l'utilisateur.")

            status_str = d.get("status")
            now = time.time()
            if status_str == "downloading" and (now - last_progress_time >= 0.4):
                downloaded = d.get("downloaded_bytes") or 0
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                speed = d.get("speed") or 0
                eta = d.get("eta") or 0
                pct = (downloaded / total * 100) if total > 0 else 0

                if progress_callback:
                    progress_callback({
                        "status": "downloading",
                        "progress": round(pct, 1),
                        "downloaded_bytes": downloaded,
                        "total_bytes": total,
                        "speed": speed,
                        "eta": eta
                    })
                last_progress_time = now
            elif status_str == "finished":
                if progress_callback:
                    progress_callback({
                        "status": "merging",
                        "progress": 95.0,
                        "speed": 0,
                        "eta": 0
                    })

        def ydl_postprocessor_hook(d):
            """Tracks FFmpeg postprocessing (merge/convert) progress."""
            if cancel_event and cancel_event.is_set():
                raise yt_dlp.utils.DownloadCancelled("Téléchargement annulé par l'utilisateur.")
            status_str = d.get("status")
            if status_str == "started" and progress_callback:
                progress_callback({
                    "status": "merging",
                    "progress": 97.0,
                    "speed": 0,
                    "eta": 0
                })
            elif status_str == "finished" and progress_callback:
                progress_callback({
                    "status": "merging",
                    "progress": 99.0,
                    "speed": 0,
                    "eta": 0
                })

        # Clean URL if it's a YouTube watch URL with playlist/mix radio parameters
        clean_url = url
        try:
            parsed = urlparse(url)
            if "youtube.com" in parsed.netloc or "youtu.be" in parsed.netloc:
                qs = parse_qs(parsed.query)
                if "v" in qs:
                    new_query = urlencode({"v": qs["v"][0]})
                    clean_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, ""))
        except Exception:
            clean_url = url

        # Detect ffmpeg location automatically
        import shutil
        ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"
        ffmpeg_dir = str(Path(ffmpeg_bin).parent) if Path(ffmpeg_bin).is_file() else None

        ydl_opts = {
            "format": ydl_format,
            "outtmpl": outtmpl,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "progress_hooks": [ydl_progress_hook],
            "postprocessor_hooks": [ydl_postprocessor_hook],
            "socket_timeout": settings.REQUEST_TIMEOUT_SECONDS,
            "user_agent": settings.USER_AGENT,
            "geo_bypass": True,
            "retries": 5,
            "fragment_retries": 5,
            "file_access_retries": 3,
        }

        if HAVE_IMPERSONATE:
            ydl_opts["impersonate"] = ImpersonateTarget("chrome")

        # Explicit FFmpeg directory if found
        if ffmpeg_dir:
            ydl_opts["ffmpeg_location"] = ffmpeg_dir

        # Audio extraction or video merge
        if is_audio_only:
            ydl_opts["postprocessors"] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": target_format.lower(),
                "preferredquality": "320",
            }]
        elif target_format.lower() in ("mp4", "mkv", "webm"):
            ydl_opts["merge_output_format"] = target_format.lower()

        loop = asyncio.get_running_loop()

        def _execute():
            # If target output file already exists with valid size, return it directly
            for ext in [target_format.lower(), "mp4", "mkv", "webm", "m4a", "mp3", "wav", "opus", "flac"]:
                existing_file = output_dir / f"{safe_title}.{ext}"
                if existing_file.exists() and existing_file.stat().st_size > 1024:
                    return existing_file

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(clean_url, download=True)
                    if info is None:
                        raise RuntimeError("yt-dlp n'a pas pu extraire les informations du média.")

                    # If playlist entries returned despite noplaylist
                    if "entries" in info and info["entries"]:
                        entries = list(info["entries"])
                        if entries and entries[0]:
                            info = entries[0]

                    filename = ydl.prepare_filename(info)

                    # Chercher le vrai fichier de sortie (extension peut changer après FFmpeg)
                    base, _ = os.path.splitext(filename)
                    for ext in [target_format.lower(), "mp4", "mkv", "webm", "m4a", "mp3", "wav", "opus", "flac"]:
                        candidate = Path(f"{base}.{ext}")
                        if candidate.exists() and candidate.stat().st_size > 0:
                            return candidate

                    # Fallback : vérifier si safe_title.ext existe dans output_dir
                    for ext in [target_format.lower(), "mp4", "mkv", "webm", "m4a", "mp3", "wav", "opus", "flac"]:
                        candidate = output_dir / f"{safe_title}.{ext}"
                        if candidate.exists() and candidate.stat().st_size > 0:
                            return candidate

                    # Fallback : retourner le chemin calculé par yt-dlp
                    if is_audio_only:
                        return Path(f"{base}.{target_format.lower()}")
                    elif target_format.lower() in ("mp4", "mkv", "webm"):
                        return Path(f"{base}.{target_format.lower()}")
                    return Path(filename)
            except yt_dlp.utils.DownloadCancelled:
                # Clean up any partial files (.part, .ytdl, etc.)
                for p in output_dir.glob(f"{safe_title}*"):
                    try:
                        if p.is_file():
                            p.unlink()
                    except Exception:
                        pass
                raise asyncio.CancelledError("Téléchargement annulé par l'utilisateur.")

        return await loop.run_in_executor(None, _execute)
