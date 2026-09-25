import os
import mimetypes
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from app.core.config import settings

router = APIRouter(prefix="/api/stream", tags=["Streaming"])


def range_requests_response(
    request: Request, file_path: Path, content_type: str
):
    """Handles HTTP 206 Partial Content range requests for video seeking."""
    file_size = file_path.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        return FileResponse(path=file_path, media_type=content_type)

    # Parse range header (e.g. bytes=0-1000)
    try:
        range_str = range_header.replace("bytes=", "")
        parts = range_str.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
    except Exception:
        start = 0
        end = file_size - 1

    start = max(0, start)
    end = min(file_size - 1, end)
    chunk_size = end - start + 1

    def iterfile():
        with open(file_path, mode="rb") as f:
            f.seek(start)
            bytes_left = chunk_size
            while bytes_left > 0:
                read_len = min(64 * 1024, bytes_left)
                data = f.read(read_len)
                if not data:
                    break
                bytes_left -= len(data)
                yield data

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": content_type,
    }

    return StreamingResponse(iterfile(), status_code=206, headers=headers)


@router.get("/file")
async def stream_local_file(path: str, request: Request):
    """
    Streams a locally downloaded audio or video file with HTTP Range support for timeline seeking.
    Path must be verified inside DOWNLOADS_PATH or TEMP_PATH to prevent traversal attacks.
    """
    requested_path = Path(path).resolve()
    allowed_dirs = [settings.DOWNLOADS_PATH.resolve(), settings.TEMP_PATH.resolve()]

    is_allowed = any(str(requested_path).startswith(str(d)) for d in allowed_dirs)
    if not is_allowed or not requested_path.exists() or not requested_path.is_file():
        raise HTTPException(status_code=404, detail="Fichier introuvable ou accès refusé.")

    mime_type, _ = mimetypes.guess_type(str(requested_path))
    return range_requests_response(request, requested_path, mime_type or "application/octet-stream")
