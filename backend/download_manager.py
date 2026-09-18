import asyncio
import os
import uuid
import time
import httpx
import yt_dlp
from typing import Dict, Any, Optional
from backend.config import settings
from backend.websocket_manager import ws_manager
from backend.security import sanitize_filename
from backend.ffmpeg_service import ffmpeg_service

class DownloadManager:
    def __init__(self):
        self.active_tasks: Dict[str, Dict[str, Any]] = {}
        self.queue: asyncio.Queue = asyncio.Queue()
        self.worker_task: Optional[asyncio.Task] = None
        self.paused_tasks: set = set()
        self.cancelled_tasks: set = set()

    def start_worker(self):
        if not self.worker_task or self.worker_task.done():
            self.worker_task = asyncio.create_task(self._process_queue())

    async def add_task(
        self,
        url: str,
        provider_id: str,
        title: str,
        thumbnail_url: Optional[str] = None,
        format_id: Optional[str] = None,
        target_format: Optional[str] = None,
        audio_only: bool = False
    ) -> str:
        task_id = str(uuid.uuid4())
        task_data = {
            "id": task_id,
            "url": url,
            "provider_id": provider_id,
            "title": title,
            "thumbnail_url": thumbnail_url,
            "format_id": format_id,
            "target_format": target_format or ("mp3" if audio_only else "mp4"),
            "audio_only": audio_only,
            "status": "queued",
            "progress": 0.0,
            "speed_kbps": 0.0,
            "downloaded_bytes": 0,
            "total_bytes": 0,
            "eta_seconds": None,
            "file_path": None,
            "error_message": None,
            "created_at": time.time()
        }

        self.active_tasks[task_id] = task_data
        await self.queue.put(task_id)

        await ws_manager.broadcast({
            "type": "download_update",
            "task": task_data
        })

        self.start_worker()
        return task_id

    async def pause_task(self, task_id: str):
        if task_id in self.active_tasks:
            self.paused_tasks.add(task_id)
            self.active_tasks[task_id]["status"] = "paused"
            await ws_manager.broadcast({
                "type": "download_update",
                "task": self.active_tasks[task_id]
            })

    async def resume_task(self, task_id: str):
        if task_id in self.active_tasks:
            self.paused_tasks.discard(task_id)
            self.active_tasks[task_id]["status"] = "queued"
            await self.queue.put(task_id)
            await ws_manager.broadcast({
                "type": "download_update",
                "task": self.active_tasks[task_id]
            })

    async def cancel_task(self, task_id: str):
        if task_id in self.active_tasks:
            self.cancelled_tasks.add(task_id)
            self.active_tasks[task_id]["status"] = "cancelled"
            await ws_manager.broadcast({
                "type": "download_update",
                "task": self.active_tasks[task_id]
            })

    async def delete_task(self, task_id: str):
        await self.cancel_task(task_id)
        if task_id in self.active_tasks:
            file_path = self.active_tasks[task_id].get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
            del self.active_tasks[task_id]

    async def _process_queue(self):
        while True:
            task_id = await self.queue.get()
            if task_id in self.cancelled_tasks or task_id in self.paused_tasks:
                self.queue.task_done()
                continue

            try:
                await self._execute_download(task_id)
            except Exception as e:
                if task_id in self.active_tasks:
                    self.active_tasks[task_id]["status"] = "failed"
                    self.active_tasks[task_id]["error_message"] = str(e)
                    await ws_manager.broadcast({
                        "type": "download_update",
                        "task": self.active_tasks[task_id]
                    })
            finally:
                self.queue.task_done()

    async def _execute_download(self, task_id: str):
        task = self.active_tasks.get(task_id)
        if not task:
            return

        task["status"] = "downloading"
        await ws_manager.broadcast({"type": "download_update", "task": task})

        url = task["url"]
        provider_id = task["provider_id"]
        sanitized_title = sanitize_filename(task["title"])

        if provider_id == "direct_url":
            await self._download_direct_file(task, sanitized_title)
        else:
            await self._download_ytdlp(task, sanitized_title)

    async def _download_direct_file(self, task: Dict[str, Any], sanitized_title: str):
        url = task["url"]
        task_id = task["id"]
        target_ext = task["target_format"] or "bin"
        out_filename = f"{sanitized_title}_{task_id[:6]}.{target_ext}"
        out_path = os.path.join(settings.DOWNLOAD_DIR, out_filename)

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                total_bytes = int(response.headers.get("content-length", 0))
                task["total_bytes"] = total_bytes

                downloaded = 0
                start_time = time.time()

                with open(out_path, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=65536):
                        if task_id in self.cancelled_tasks:
                            f.close()
                            if os.path.exists(out_path):
                                os.remove(out_path)
                            return
                        if task_id in self.paused_tasks:
                            return

                        f.write(chunk)
                        downloaded += len(chunk)
                        task["downloaded_bytes"] = downloaded

                        elapsed = time.time() - start_time
                        if elapsed > 0:
                            speed = (downloaded / 1024) / elapsed
                            task["speed_kbps"] = round(speed, 2)
                            if total_bytes > 0:
                                task["progress"] = round((downloaded / total_bytes) * 100, 2)
                                remaining_bytes = total_bytes - downloaded
                                task["eta_seconds"] = int((remaining_bytes / 1024) / speed) if speed > 0 else None

                        await ws_manager.broadcast({"type": "download_update", "task": task})

        task["file_path"] = out_path
        task["status"] = "completed"
        task["progress"] = 100.0
        await ws_manager.broadcast({"type": "download_update", "task": task})

    async def _download_ytdlp(self, task: Dict[str, Any], sanitized_title: str):
        task_id = task["id"]
        url = task["url"]
        format_id = task.get("format_id")
        target_format = task.get("target_format", "mp4")
        audio_only = task.get("audio_only", False)

        main_loop = asyncio.get_event_loop()

        raw_out_path = os.path.join(settings.TEMP_DIR, f"{sanitized_title}_{task_id[:6]}.%(ext)s")
        final_out_path = os.path.join(settings.DOWNLOAD_DIR, f"{sanitized_title}_{task_id[:6]}.{target_format}")

        def progress_hook(d):
            if task_id in self.cancelled_tasks:
                raise Exception("Téléchargement annulé par l'utilisateur.")

            if d['status'] == 'downloading':
                task["status"] = "downloading"
                task["downloaded_bytes"] = d.get('downloaded_bytes', 0)
                task["total_bytes"] = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
                if task["total_bytes"] > 0:
                    task["progress"] = round((task["downloaded_bytes"] / task["total_bytes"]) * 100, 2)
                task["speed_kbps"] = round((d.get('speed', 0) or 0) / 1024, 2)
                task["eta_seconds"] = d.get('eta')

                asyncio.run_coroutine_threadsafe(
                    ws_manager.broadcast({"type": "download_update", "task": task}),
                    main_loop
                )

        ydl_format = format_id or ("bestaudio/best" if audio_only else "bestvideo+bestaudio/best")

        ydl_opts = {
            'format': ydl_format,
            'outtmpl': raw_out_path,
            'quiet': True,
            'no_warnings': True,
            'progress_hooks': [progress_hook],
        }

        def _run_ydl():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=True)

        info = await main_loop.run_in_executor(None, _run_ydl)

        # Find actual downloaded file in temp dir
        temp_files = [
            os.path.join(settings.TEMP_DIR, f)
            for f in os.listdir(settings.TEMP_DIR)
            if f.startswith(f"{sanitized_title}_{task_id[:6]}")
        ]

        if not temp_files:
            raise RuntimeError("Le fichier téléchargé n'a pas été trouvé dans le dossier temporaire.")

        downloaded_file = temp_files[0]

        # Check if conversion or audio extraction is required
        ext = downloaded_file.split('.')[-1].lower()

        if ext != target_format or audio_only:
            task["status"] = "converting"
            await ws_manager.broadcast({"type": "download_update", "task": task})

            await ffmpeg_service.convert_media(
                input_path=downloaded_file,
                output_path=final_out_path,
                target_format=target_format
            )

            if os.path.exists(downloaded_file):
                os.remove(downloaded_file)
        else:
            os.rename(downloaded_file, final_out_path)

        task["file_path"] = final_out_path
        task["status"] = "completed"
        task["progress"] = 100.0
        await ws_manager.broadcast({"type": "download_update", "task": task})

download_manager = DownloadManager()
