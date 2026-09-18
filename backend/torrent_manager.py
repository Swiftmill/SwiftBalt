import asyncio
import os
import uuid
import time
import libtorrent as lt
from typing import Dict, Any, List, Optional
from backend.config import settings
from backend.websocket_manager import ws_manager
from backend.security import sanitize_filename

class TorrentManager:
    def __init__(self):
        self.session = lt.session({'listen_interfaces': '0.0.0.0:6881'})
        self.torrents: Dict[str, Dict[str, Any]] = {}
        self.handles: Dict[str, lt.torrent_handle] = {}
        self.loop_task: Optional[asyncio.Task] = None

    def start_monitoring(self):
        if not self.loop_task or self.loop_task.done():
            self.loop_task = asyncio.create_task(self._monitor_torrents())

    async def add_torrent(self, source: str) -> str:
        torrent_id = str(uuid.uuid4())[:8]
        params = lt.add_torrent_params()
        params.save_path = settings.TORRENT_DIR

        if source.startswith("magnet:?"):
            params.url = source
        elif os.path.exists(source):
            info = lt.torrent_info(source)
            params.ti = info

        handle = self.session.add_torrent(params)
        self.handles[torrent_id] = handle

        torrent_data = {
            "id": torrent_id,
            "name": handle.status().name or "Torrent Loading...",
            "source": source,
            "status": "downloading",
            "progress": 0.0,
            "downloaded_bytes": 0,
            "total_bytes": 0,
            "download_speed_kbps": 0.0,
            "upload_speed_kbps": 0.0,
            "num_peers": 0,
            "num_seeds": 0,
            "eta_seconds": None,
            "save_path": settings.TORRENT_DIR,
            "files": [],
            "created_at": time.time()
        }

        self.torrents[torrent_id] = torrent_data
        self.start_monitoring()

        await ws_manager.broadcast({
            "type": "torrent_update",
            "torrent": torrent_data
        })

        return torrent_id

    async def pause_torrent(self, torrent_id: str):
        if torrent_id in self.handles:
            self.handles[torrent_id].pause()
            if torrent_id in self.torrents:
                self.torrents[torrent_id]["status"] = "paused"
                await ws_manager.broadcast({
                    "type": "torrent_update",
                    "torrent": self.torrents[torrent_id]
                })

    async def resume_torrent(self, torrent_id: str):
        if torrent_id in self.handles:
            self.handles[torrent_id].resume()
            if torrent_id in self.torrents:
                self.torrents[torrent_id]["status"] = "downloading"
                await ws_manager.broadcast({
                    "type": "torrent_update",
                    "torrent": self.torrents[torrent_id]
                })

    async def delete_torrent(self, torrent_id: str, delete_files: bool = False):
        if torrent_id in self.handles:
            handle = self.handles[torrent_id]
            self.session.remove_torrent(handle, 1 if delete_files else 0)
            del self.handles[torrent_id]

        if torrent_id in self.torrents:
            del self.torrents[torrent_id]

        await ws_manager.broadcast({
            "type": "torrent_deleted",
            "torrent_id": torrent_id
        })

    async def _monitor_torrents(self):
        while self.handles:
            for torrent_id, handle in list(self.handles.items()):
                if not handle.is_valid():
                    continue

                status = handle.status()
                torrent_data = self.torrents.get(torrent_id)
                if not torrent_data:
                    continue

                torrent_data["name"] = status.name or torrent_data["name"]
                torrent_data["progress"] = round(status.progress * 100, 2)
                torrent_data["downloaded_bytes"] = status.total_done
                torrent_data["total_bytes"] = status.total_wanted
                torrent_data["download_speed_kbps"] = round(status.download_rate / 1024, 2)
                torrent_data["upload_speed_kbps"] = round(status.upload_rate / 1024, 2)
                torrent_data["num_peers"] = status.num_peers
                torrent_data["num_seeds"] = status.num_seeds

                if status.state == lt.torrent_status.seeding:
                    torrent_data["status"] = "seeding"
                elif status.is_finished or status.progress >= 1.0:
                    torrent_data["status"] = "completed"
                elif status.paused:
                    torrent_data["status"] = "paused"
                else:
                    torrent_data["status"] = "downloading"

                # Extract files list if metadata has loaded
                if handle.has_metadata():
                    info = handle.torrent_info()
                    file_list = []
                    for idx in range(info.num_files()):
                        f = info.file_at(idx)
                        file_list.append({
                            "index": idx,
                            "path": f.path,
                            "size": f.size
                        })
                    torrent_data["files"] = file_list

                await ws_manager.broadcast({
                    "type": "torrent_update",
                    "torrent": torrent_data
                })

            await asyncio.sleep(1)

torrent_manager = TorrentManager()
