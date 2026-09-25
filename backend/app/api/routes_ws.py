from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.events import event_manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint broadcasting real-time download events,
    torrent updates, and system notifications to frontend clients.
    """
    await event_manager.connect(websocket)
    try:
        while True:
            # Keep-alive ping/pong receiver
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type": "pong"}')
    except WebSocketDisconnect:
        await event_manager.disconnect(websocket)
    except Exception:
        await event_manager.disconnect(websocket)
