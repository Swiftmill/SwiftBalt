import uuid
import asyncio
import base64
import json
import logging
import subprocess
import time
from urllib.parse import urlparse, parse_qs, unquote
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx

from app.core.config import settings, BASE_DIR
from app.core.events import event_manager
from app.database.session import async_session_factory
from app.database import crud

logger = logging.getLogger("swiftbalt.torrents")


class TorrentManager:
    """
    Manager for BitTorrent transfers using native aria2c engine with JSON-RPC.
    Supports .torrent file uploads, magnet links, pause, resume, real-time peer/seeder tracking,
    piece validation, and serving playable media files.
    """

    def __init__(self):
        self._torrents: Dict[str, Dict[str, Any]] = {}
        self._gid_to_id: Dict[str, str] = {}
        self._id_to_gid: Dict[str, str] = {}
        self._aria2_proc: Optional[subprocess.Popen] = None
        self._rpc_port: int = 6810
        self._rpc_url: str = f"http://127.0.0.1:{self._rpc_port}/jsonrpc"
        self._monitor_task: Optional[asyncio.Task] = None
        self._is_running: bool = False
        self._http_client: Optional[httpx.AsyncClient] = None

    def _get_aria2_path(self) -> Path:
        """Returns path to aria2c executable."""
        candidates = [
            BASE_DIR / "backend" / "bin" / "aria2c.exe",
            BASE_DIR / "bin" / "aria2c.exe",
            Path("C:/Users/andre/Pictures/SwiftBalt/backend/bin/aria2c.exe")
        ]
        for c in candidates:
            if c.exists():
                return c
        return Path("aria2c.exe")

    async def start(self):
        """Initializes aria2 daemon, connects RPC, restores database torrents, starts monitor."""
        if self._is_running:
            return

        settings.TORRENTS_PATH.mkdir(parents=True, exist_ok=True)
        settings.DOWNLOADS_PATH.mkdir(parents=True, exist_ok=True)

        self._http_client = httpx.AsyncClient(timeout=5.0)

        # Check if an aria2 instance is already responsive on our port
        rpc_alive = await self._check_rpc_alive()
        if not rpc_alive:
            aria2_exe = self._get_aria2_path()
            if aria2_exe.exists():
                cmd = [
                    str(aria2_exe),
                    "--enable-rpc=true",
                    f"--rpc-listen-port={self._rpc_port}",
                    "--rpc-listen-all=false",
                    "--rpc-allow-origin-all=true",
                    f"--dir={settings.DOWNLOADS_PATH}",
                    "--seed-time=0",
                    "--enable-dht=true",
                    "--bt-enable-lpd=true",
                    "--enable-peer-exchange=true",
                    "--file-allocation=none",
                    "--summary-interval=0",
                    "--max-connection-per-server=16",
                    "--follow-torrent=mem",
                    "--bt-stop-timeout=0",
                    "--allow-overwrite=true",
                    "--auto-file-renaming=false",
                    "--dht-listen-port=6881",
                    "--listen-port=6881-6999"
                ]
                try:
                    self._aria2_proc = subprocess.Popen(
                        cmd,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL
                    )
                    logger.info("aria2c daemon started on port %d", self._rpc_port)
                    await asyncio.sleep(1.0)
                except Exception as e:
                    logger.error("Failed to start aria2c process: %s", e)

        # Restore tracked torrents from SQLite database
        try:
            async with async_session_factory() as db:
                db_torrents = await crud.list_torrents(db)
                for t in db_torrents:
                    self._torrents[t.id] = {
                        "id": t.id,
                        "name": t.name,
                        "magnet_uri": t.magnet_uri,
                        "status": t.status,
                        "progress": t.progress,
                        "total_size": t.total_size,
                        "downloaded_size": t.downloaded_size,
                        "upload_size": t.upload_size,
                        "download_speed": t.download_speed,
                        "upload_speed": t.upload_speed,
                        "peers": t.peers,
                        "seeds": t.seeds,
                        "eta": t.eta,
                        "files_json": t.files_json,
                    }
        except Exception as e:
            logger.warning("Could not restore torrents from database: %s", e)

        self._is_running = True
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        logger.info("TorrentManager started successfully.")

    async def stop(self):
        """Stops monitor loop and terminates aria2 daemon."""
        self._is_running = False
        if self._monitor_task:
            self._monitor_task.cancel()
            self._monitor_task = None

        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

        if self._aria2_proc:
            try:
                self._aria2_proc.terminate()
                self._aria2_proc.wait(timeout=2)
            except Exception:
                pass
            self._aria2_proc = None

    async def _check_rpc_alive(self) -> bool:
        if not self._http_client:
            return False
        try:
            r = await self._http_client.post(
                self._rpc_url,
                json={"jsonrpc": "2.0", "id": "ping", "method": "aria2.getVersion"}
            )
            return r.status_code == 200
        except Exception:
            return False

    async def _rpc_call(self, method: str, params: list = None) -> Any:
        if not self._http_client:
            self._http_client = httpx.AsyncClient(timeout=5.0)
        try:
            payload = {
                "jsonrpc": "2.0",
                "id": str(uuid.uuid4())[:8],
                "method": method,
                "params": params or []
            }
            resp = await self._http_client.post(self._rpc_url, json=payload)
            data = resp.json()
            if "error" in data:
                logger.error("aria2 RPC error on %s: %s", method, data["error"])
                return None
            return data.get("result")
        except Exception as e:
            logger.debug("aria2 RPC exception on %s: %s", method, e)
            return None

    def parse_magnet(self, magnet_uri: str) -> Dict[str, Any]:
        """Extracts display name, infohash, and trackers from a magnet URI."""
        parsed = urlparse(magnet_uri)
        params = parse_qs(parsed.query)

        name = params.get("dn", ["Distribution Légale"])[0]
        xt = params.get("xt", [""])[0]
        trackers = params.get("tr", [])

        info_hash = xt.replace("urn:btih:", "") if "urn:btih:" in xt else "hash_" + str(uuid.uuid4())[:8]

        return {
            "name": unquote(name),
            "info_hash": info_hash,
            "trackers": trackers
        }

    async def add_magnet(
        self,
        magnet_uri: str,
        destination_dir: Optional[str] = None,
        name: Optional[str] = None,
        total_size: Optional[int] = None
    ) -> Dict[str, Any]:
        info = self.parse_magnet(magnet_uri)
        torrent_id = str(uuid.uuid4())[:8]
        torrent_name = name or info["name"]
        t_size = total_size if total_size and total_size > 0 else 0

        # Send to aria2 RPC
        gid = await self._rpc_call("aria2.addUri", [[magnet_uri]])
        if not gid:
            logger.warning("aria2 addUri returned no gid, will retry or track locally")

        torrent_data = {
            "id": torrent_id,
            "gid": gid,
            "name": torrent_name,
            "magnet_uri": magnet_uri,
            "status": "downloading",
            "progress": 0.0,
            "total_size": t_size,
            "downloaded_size": 0,
            "upload_size": 0,
            "download_speed": 0.0,
            "upload_speed": 0.0,
            "peers": 0,
            "seeds": 0,
            "eta": 0,
            "files_json": json.dumps([
                {"name": torrent_name, "size": t_size, "priority": "normal", "selected": True}
            ]),
            "file_path": None,
        }

        self._torrents[torrent_id] = torrent_data
        if gid:
            self._gid_to_id[gid] = torrent_id
            self._id_to_gid[torrent_id] = gid

        async with async_session_factory() as db:
            await crud.create_torrent(db, torrent_data)

        await event_manager.broadcast("torrent_added", torrent_data)
        return torrent_data

    async def add_torrent_file(
        self,
        file_bytes: bytes,
        file_name: str,
        destination_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """Adds a torrent via raw .torrent file bytes to aria2 engine."""
        torrent_id = str(uuid.uuid4())[:8]
        b64_content = base64.b64encode(file_bytes).decode("utf-8")

        gid = await self._rpc_call("aria2.addTorrent", [b64_content])

        # Extract display name from filename without .torrent
        display_name = file_name[:-8] if file_name.lower().endswith(".torrent") else file_name

        total_size = 0
        file_path = None
        files_list = []

        if gid:
            # Query aria2 immediately for file metadata
            st = await self._rpc_call("aria2.tellStatus", [gid])
            if st:
                bt_info = st.get("bittorrent", {}).get("info", {})
                if bt_info.get("name"):
                    display_name = bt_info["name"]
                total_size = int(st.get("totalLength", 0))
                files = st.get("files", [])
                if files:
                    file_path = files[0].get("path")
                    for f in files:
                        p = f.get("path", "")
                        fname = Path(p).name if p else display_name
                        files_list.append({
                            "name": fname,
                            "path": p,
                            "size": int(f.get("length", 0)),
                            "completed": int(f.get("completedLength", 0)),
                            "selected": f.get("selected") == "true"
                        })

        # Check if the target file is already present on disk (e.g. user re-adds completed torrent)
        init_status = "downloading"
        init_progress = 0.0
        init_downloaded = 0
        if file_path:
            p_obj = Path(file_path)
            if p_obj.exists() and p_obj.stat().st_size > 0:
                if total_size == 0 or p_obj.stat().st_size >= total_size * 0.95:
                    init_status = "completed"
                    init_progress = 100.0
                    init_downloaded = p_obj.stat().st_size
                    if total_size == 0:
                        total_size = p_obj.stat().st_size

        torrent_data = {
            "id": torrent_id,
            "gid": gid,
            "name": display_name,
            "magnet_uri": None,
            "status": init_status,
            "progress": init_progress,
            "total_size": total_size,
            "downloaded_size": init_downloaded,
            "upload_size": 0,
            "download_speed": 0.0,
            "upload_speed": 0.0,
            "peers": 0,
            "seeds": 0,
            "eta": 0,
            "files_json": json.dumps(files_list if files_list else [
                {"name": display_name, "size": total_size, "priority": "normal", "selected": True}
            ]),
            "file_path": file_path,
            "error_message": None,
        }

        self._torrents[torrent_id] = torrent_data
        if gid:
            self._gid_to_id[gid] = torrent_id
            self._id_to_gid[torrent_id] = gid

        async with async_session_factory() as db:
            await crud.create_torrent(db, torrent_data)

        await event_manager.broadcast("torrent_added", torrent_data)
        return torrent_data

    async def _monitor_loop(self):
        """Monitors real BitTorrent downloads via aria2 JSON-RPC and broadcasts stats."""
        while self._is_running:
            try:
                # Query all active or tellStatus for each mapped gid
                active_list = await self._rpc_call("aria2.tellActive") or []
                waiting_list = await self._rpc_call("aria2.tellWaiting", [0, 50]) or []
                stopped_list = await self._rpc_call("aria2.tellStopped", [0, 50]) or []

                all_items = {item["gid"]: item for item in (active_list + waiting_list + stopped_list) if "gid" in item}

                # Update matched torrents
                for torrent_id, torrent in list(self._torrents.items()):
                    gid = self._id_to_gid.get(torrent_id) or torrent.get("gid")
                    if not gid or gid not in all_items:
                        # If gid is not in active lists, try direct tellStatus
                        if gid:
                            direct_st = await self._rpc_call("aria2.tellStatus", [gid])
                            if direct_st:
                                all_items[gid] = direct_st

                    st = all_items.get(gid)
                    if not st:
                        continue

                    # Parse aria2 status
                    raw_status = st.get("status")  # active, waiting, paused, error, complete, removed
                    total_len = int(st.get("totalLength", 0))
                    completed_len = int(st.get("completedLength", 0))
                    dl_speed = float(st.get("downloadSpeed", 0))
                    ul_speed = float(st.get("uploadSpeed", 0))
                    connections = int(st.get("connections", 0))
                    seeders = int(st.get("numSeeders", 0))

                    if total_len > 0:
                        torrent["total_size"] = total_len
                    torrent["downloaded_size"] = completed_len
                    torrent["download_speed"] = dl_speed
                    torrent["upload_speed"] = ul_speed
                    torrent["peers"] = connections
                    torrent["seeds"] = seeders

                    # Compute progress
                    if total_len > 0:
                        prog = round((completed_len / total_len) * 100, 1)
                        torrent["progress"] = min(100.0, prog)
                    else:
                        torrent["progress"] = 0.0

                    # Compute ETA
                    if dl_speed > 0 and total_len > completed_len:
                        torrent["eta"] = int((total_len - completed_len) / dl_speed)
                    else:
                        torrent["eta"] = 0

                    # Extract primary file path
                    files = st.get("files", [])
                    if files:
                        torrent["file_path"] = files[0].get("path")

                    fpath = torrent.get("file_path") or (files[0].get("path") if files else None)
                    p_obj = Path(fpath) if fpath else None
                    file_is_complete_on_disk = bool(
                        p_obj and p_obj.exists() and p_obj.stat().st_size > 0
                        and (total_len == 0 or p_obj.stat().st_size >= total_len * 0.95)
                    )

                    # Map status
                    if raw_status == "complete" or (total_len > 0 and completed_len >= total_len) or file_is_complete_on_disk:
                        torrent["status"] = "completed"
                        torrent["progress"] = 100.0
                        torrent["downloaded_size"] = total_len if total_len > 0 else (p_obj.stat().st_size if p_obj else completed_len)
                        torrent["download_speed"] = 0.0
                        torrent["upload_speed"] = 0.0
                        torrent["eta"] = 0
                        torrent["error_message"] = None
                    elif raw_status == "paused":
                        torrent["status"] = "paused"
                        torrent["download_speed"] = 0.0
                        torrent["upload_speed"] = 0.0
                    elif raw_status == "error":
                        torrent["status"] = "error"
                        torrent["error_message"] = st.get("errorMessage") or "Erreur de téléchargement du torrent."
                        torrent["download_speed"] = 0.0
                    elif raw_status in ("active", "waiting"):
                        torrent["status"] = "downloading"
                        torrent["error_message"] = None

                    # Resolve torrent name if updated from bittorrent info
                    bt_info = st.get("bittorrent", {}).get("info", {})
                    if bt_info.get("name") and torrent.get("name") in ("Distribution Légale", "Torrent sans nom"):
                        torrent["name"] = bt_info["name"]

                    await self._save_torrent(torrent)
                    await event_manager.broadcast("torrent_updated", torrent)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug("Error in torrent monitor loop: %s", e)

            await asyncio.sleep(1.0)

    async def _save_torrent(self, torrent: dict):
        try:
            async with async_session_factory() as db:
                await crud.update_torrent(db, torrent["id"], torrent)
        except Exception:
            pass

    async def pause_torrent(self, torrent_id: str) -> bool:
        torrent = self._torrents.get(torrent_id)
        if not torrent:
            return False

        gid = self._id_to_gid.get(torrent_id) or torrent.get("gid")
        if gid:
            await self._rpc_call("aria2.pause", [gid])

        torrent["status"] = "paused"
        torrent["download_speed"] = 0.0
        torrent["upload_speed"] = 0.0
        await self._save_torrent(torrent)
        await event_manager.broadcast("torrent_updated", torrent)
        return True

    async def resume_torrent(self, torrent_id: str) -> bool:
        torrent = self._torrents.get(torrent_id)
        if not torrent:
            return False

        gid = self._id_to_gid.get(torrent_id) or torrent.get("gid")
        if gid:
            await self._rpc_call("aria2.unpause", [gid])

        torrent["status"] = "downloading"
        await self._save_torrent(torrent)
        await event_manager.broadcast("torrent_updated", torrent)
        return True

    async def delete_torrent(self, torrent_id: str) -> bool:
        torrent = self._torrents.pop(torrent_id, None)
        gid = self._id_to_gid.pop(torrent_id, None)
        if gid:
            self._gid_to_id.pop(gid, None)
            try:
                await self._rpc_call("aria2.remove", [gid])
                await self._rpc_call("aria2.removeDownloadResult", [gid])
            except Exception:
                pass

        async with async_session_factory() as db:
            await crud.delete_torrent(db, torrent_id)

        await event_manager.broadcast("torrent_deleted", {"id": torrent_id})
        return True

    def get_torrent(self, torrent_id: str) -> Optional[Dict[str, Any]]:
        return self._torrents.get(torrent_id)

    def list_torrents(self) -> List[Dict[str, Any]]:
        return list(self._torrents.values())


torrent_manager = TorrentManager()
