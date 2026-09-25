import asyncio
import json
from typing import Set, Any
from fastapi import WebSocket

class EventManager:
    """Manages connected WebSocket clients and broadcasts events."""
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def broadcast(self, event_type: str, data: Any):
        """Broadcast an event payload to all active websockets."""
        message = json.dumps({"type": event_type, "data": data}, default=str)
        stale_connections = []
        async with self._lock:
            for connection in list(self.active_connections):
                try:
                    await connection.send_text(message)
                except Exception:
                    stale_connections.append(connection)

            for dead in stale_connections:
                if dead in self.active_connections:
                    self.active_connections.remove(dead)

event_manager = EventManager()
