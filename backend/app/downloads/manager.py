import uuid
import asyncio
import httpx
from pathlib import Path
from typing import Dict, Any, Optional, List
from app.core.config import settings
from app.core.events import event_manager
from app.core.security import sanitize_filename, validate_url_security
from app.database.session import async_session_factory
from app.database import crud
from app.providers.registry import registry
from app.providers.direct import DirectProvider
from app.providers.twitch import TwitchProvider
from app.downloads.engine import DownloadEngine


class DownloadJob:
    def __init__(
        self,
        job_id: str,
        url: str,
        title: str,
        platform: str,
        target_format: str = "mp4",
        target_quality: str = "1080p",
        thumbnail_url: Optional[str] = None
    ):
        self.id = job_id
        self.url = url
        self.title = title
        self.platform = platform
        self.format = target_format
        self.quality = target_quality
        self.thumbnail_url = thumbnail_url
        self.status = "queued"
        self.progress = 0.0
        self.downloaded_bytes = 0
        self.total_bytes = 0
        self.speed = 0.0
        self.eta = 0
        self.file_path: Optional[str] = None
        self.file_size = 0
        self.error_message: Optional[str] = None

        self.cancel_event = asyncio.Event()
        self.pause_event = asyncio.Event()
        self.task: Optional[asyncio.Task] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "url": self.url,
            "title": self.title,
            "platform": self.platform,
            "format": self.format,
            "quality": self.quality,
            "status": self.status,
            "progress": round(self.progress, 1),
            "downloaded_bytes": self.downloaded_bytes,
            "total_bytes": self.total_bytes,
            "speed": round(self.speed, 1),
            "eta": self.eta,
            "file_path": self.file_path,
            "file_size": self.file_size,
            "thumbnail_url": self.thumbnail_url,
            "error_message": self.error_message,
        }


class DownloadManager:
    """
    Central queue manager handling concurrent downloads, worker tasks,
    pause/resume/cancel lifecycles, and database synchronization.
    """

    def __init__(self):
        self._jobs: Dict[str, DownloadJob] = {}
        self._semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_DOWNLOADS)
        self._queue = asyncio.Queue()
        self._workers: List[asyncio.Task] = []
        self._is_running = False

    async def start(self):
        """Starts worker pool listening on the download queue."""
        if self._is_running:
            return
        self._is_running = True
        for _ in range(settings.MAX_CONCURRENT_DOWNLOADS):
            t = asyncio.create_task(self._worker_loop())
            self._workers.append(t)

    async def _worker_loop(self):
        while self._is_running:
            job_id = await self._queue.get()
            job = self._jobs.get(job_id)
            if not job or job.cancel_event.is_set():
                self._queue.task_done()
                continue

            async with self._semaphore:
                await self._execute_download(job)
            self._queue.task_done()

    async def add_download(
        self,
        url: str,
        title: Optional[str] = None,
        target_format: str = "mp4",
        target_quality: str = "1080p",
        thumbnail_url: Optional[str] = None,
        platform: Optional[str] = None
    ) -> DownloadJob:
        """Enqueues a new download job."""
        validated_url = validate_url_security(url)
        job_id = str(uuid.uuid4())[:8]

        # Detect provider to determine platform if not supplied
        provider = registry.detect_provider(validated_url)
        resolved_platform = platform or (provider.name if provider else "Direct File")
        resolved_title = title or "Téléchargement"

        job = DownloadJob(
            job_id=job_id,
            url=validated_url,
            title=resolved_title,
            platform=resolved_platform,
            target_format=target_format,
            target_quality=target_quality,
            thumbnail_url=thumbnail_url
        )
        self._jobs[job_id] = job

        # Save to DB
        async with async_session_factory() as db:
            await crud.create_download(db, job.to_dict())

        # Notify via WebSocket
        await event_manager.broadcast("download_queued", job.to_dict())

        # Push to async queue
        await self._queue.put(job_id)
        return job

    async def _execute_download(self, job: DownloadJob):
        job.status = "processing"
        await self._notify_update(job)

        provider = registry.detect_provider(job.url)
        is_direct = isinstance(provider, DirectProvider)

        # Capture the running loop BEFORE entering the thread executor,
        # so progress_callback (sync, called from a thread) can schedule
        # async notifications safely via run_coroutine_threadsafe.
        loop = asyncio.get_running_loop()

        def progress_callback(update_info: dict):
            if job.cancel_event.is_set() or job.id not in self._jobs:
                return
            job.status = update_info.get("status", job.status)
            job.progress = update_info.get("progress", job.progress)
            job.downloaded_bytes = update_info.get("downloaded_bytes", job.downloaded_bytes)
            job.total_bytes = update_info.get("total_bytes", job.total_bytes)
            job.speed = update_info.get("speed", job.speed)
            job.eta = update_info.get("eta", job.eta)
            # Schedule coroutine from sync thread — thread-safe
            asyncio.run_coroutine_threadsafe(self._notify_update(job), loop)

        try:
            if is_direct:
                # Direct HTTP chunked download
                dest_filename = sanitize_filename(f"{job.title}.{job.format}")
                dest_path = settings.DOWNLOADS_PATH / dest_filename
                result_path = await DownloadEngine.download_direct_file(
                    url=job.url,
                    destination_path=dest_path,
                    progress_callback=progress_callback,
                    cancel_event=job.cancel_event,
                    pause_event=job.pause_event
                )
            else:
                # If Twitch VOD, resolve direct CloudFront stream to bypass sub-only restriction
                download_url = job.url
                if isinstance(provider, TwitchProvider) and provider.get_twitch_type(job.url) == "vod":
                    vod_id = provider.extract_vod_id(job.url)
                    if vod_id:
                        gql_data = await provider._resolve_gql_sub_vod(vod_id)
                        if gql_data:
                            streams = gql_data.get("streams", [])
                            target_q = (job.quality or "auto").lower()
                            candidates = []
                            for st in streams:
                                fid = st.get("format_id", "").lower()
                                ql = st.get("quality", "").lower()
                                if st.get("quality") == job.quality or fid == job.quality.lower():
                                    candidates.insert(0, st["url"])
                                elif any(x in target_q for x in ("auto", "max", "1080", "source", "chunked")) and fid == "chunked":
                                    candidates.append(st["url"])
                                elif "720" in target_q and "720" in fid:
                                    candidates.append(st["url"])
                                elif "480" in target_q and "480" in fid:
                                    candidates.append(st["url"])
                                elif "360" in target_q and "360" in fid:
                                    candidates.append(st["url"])
                                elif "160" in target_q and "160" in fid:
                                    candidates.append(st["url"])
                                elif "audio" in target_q and ("audio" in fid or "audio" in ql):
                                    candidates.append(st["url"])

                            source_url = gql_data.get("direct_m3u8") or (streams[0]["url"] if streams else None)
                            if source_url and source_url not in candidates:
                                candidates.append(source_url)

                            # Validate candidate accessibility (avoid 403 on non-existent frame rates)
                            chosen_url = source_url
                            async with httpx.AsyncClient(timeout=3.0) as check_client:
                                for cand in candidates:
                                    try:
                                        r = await check_client.get(cand, headers={"Range": "bytes=0-10"})
                                        if r.status_code in (200, 206):
                                            chosen_url = cand
                                            break
                                    except Exception:
                                        continue

                            download_url = chosen_url or job.url

                # yt-dlp download & merge
                result_path = await DownloadEngine.download_media(
                    url=download_url,
                    output_dir=settings.DOWNLOADS_PATH,
                    title=job.title,
                    target_format=job.format,
                    target_quality=job.quality,
                    progress_callback=progress_callback,
                    cancel_event=job.cancel_event
                )

            # Mark completed
            job.status = "completed"
            job.progress = 100.0
            job.speed = 0.0
            job.eta = 0
            job.file_path = str(result_path)
            job.file_size = result_path.stat().st_size if result_path.exists() else 0

            # Add to history
            async with async_session_factory() as db:
                await crud.add_history(db, {
                    "id": str(uuid.uuid4())[:8],
                    "download_id": job.id,
                    "title": job.title,
                    "url": job.url,
                    "platform": job.platform,
                    "file_path": job.file_path,
                    "file_size": job.file_size,
                    "format": job.format,
                    "quality": job.quality,
                    "thumbnail_url": job.thumbnail_url,
                })

        except asyncio.CancelledError:
            job.status = "cancelled"
            job.speed = 0.0
        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)
            job.speed = 0.0

        await self._notify_update(job)

    async def _notify_update(self, job: DownloadJob):
        if job.id not in self._jobs:
            return
        # Update database
        try:
            async with async_session_factory() as db:
                await crud.update_download(db, job.id, job.to_dict())
        except Exception:
            pass
        # Broadcast over WebSocket
        await event_manager.broadcast("download_progress", job.to_dict())
        await event_manager.broadcast("download_updated", job.to_dict())

    def pause_download(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if job and job.status == "downloading":
            job.pause_event.set()
            job.status = "paused"
            asyncio.create_task(self._notify_update(job))
            return True
        return False

    def resume_download(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if job and job.status == "paused":
            job.pause_event.clear()
            job.status = "downloading"
            asyncio.create_task(self._notify_update(job))
            return True
        return False

    def cancel_download(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if job:
            job.cancel_event.set()
            job.status = "cancelled"
            job.speed = 0.0
            safe_title = sanitize_filename(job.title or "")
            if safe_title:
                for f in settings.DOWNLOADS_PATH.glob(f"{safe_title}*"):
                    try:
                        if f.is_file():
                            f.unlink()
                    except Exception:
                        pass
            asyncio.create_task(self._notify_update(job))
            return True
        return False

    async def retry_download(self, job_id: str) -> Optional[DownloadJob]:
        job = self._jobs.get(job_id)
        if not job:
            async with async_session_factory() as db:
                db_item = await crud.get_download(db, job_id)
                if db_item:
                    return await self.add_download(
                        url=db_item.url,
                        title=db_item.title,
                        target_format=db_item.format,
                        target_quality=db_item.quality,
                        thumbnail_url=db_item.thumbnail_url,
                        platform=db_item.platform
                    )
            return None

        if job.status in ("failed", "cancelled"):
            return await self.add_download(
                url=job.url,
                title=job.title,
                target_format=job.format,
                target_quality=job.quality,
                thumbnail_url=job.thumbnail_url,
                platform=job.platform
            )
        return None

    async def delete_download(self, job_id: str, delete_file: bool = True) -> bool:
        job = self._jobs.pop(job_id, None)
        if job:
            job.cancel_event.set()
            job.status = "cancelled"
            safe_title = sanitize_filename(job.title or "")
            if safe_title:
                for f in settings.DOWNLOADS_PATH.glob(f"{safe_title}*"):
                    try:
                        if f.is_file():
                            f.unlink()
                    except Exception:
                        pass
            if delete_file and job.file_path:
                p = Path(job.file_path)
                if p.exists():
                    try:
                        p.unlink()
                    except Exception:
                        pass

        async with async_session_factory() as db:
            await crud.delete_download(db, job_id)

        await event_manager.broadcast("download_deleted", {"id": job_id})
        return True

    def get_job(self, job_id: str) -> Optional[DownloadJob]:
        return self._jobs.get(job_id)

    def list_jobs(self) -> List[Dict[str, Any]]:
        return [job.to_dict() for job in self._jobs.values()]


download_manager = DownloadManager()
