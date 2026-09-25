from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.core.security import validate_url_security
from app.providers.registry import registry

router = APIRouter(prefix="/api", tags=["Analyze"])


class AnalyzeRequest(BaseModel):
    url: str


class AnalyzeResponse(BaseModel):
    provider_id: str
    platform: str
    title: str
    author: Optional[str] = "Inconnu"
    uploader: Optional[str] = None
    duration: int = 0
    upload_date: Optional[str] = "N/A"
    description: Optional[str] = ""
    view_count: int = 0
    thumbnail: Optional[str] = None
    fps: Optional[int] = 30
    video_codec: Optional[str] = "H.264"
    audio_codec: Optional[str] = "AAC"
    file_size: Optional[int] = 0
    type: str = "video"  # video, audio, file
    qualities: list[str] = []
    formats: list[str] = []
    subtitles: list[dict] = []
    player: dict = {}
    is_direct: bool = False


@router.post("/analyze", response_model=Dict[str, Any])
async def analyze_url(payload: AnalyzeRequest):
    """
    Analyzes any media or file URL:
    - Performs strict anti-SSRF & domain validation.
    - Identifies matching provider.
    - Extracts public metadata, streams, preview player options, qualities, and formats.
    """
    url = payload.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL manquante.")

    validated_url = validate_url_security(url)

    provider = registry.detect_provider(validated_url)
    if not provider:
        raise HTTPException(status_code=400, detail="Service non supporté ou URL non reconnue.")

    try:
        metadata = await provider.get_metadata(validated_url)
        streams = await provider.get_streams(validated_url)
        player_info = await provider.get_player(validated_url)
        subtitles = await provider.get_subtitles(validated_url)
        download_opts = await provider.get_download_options(validated_url)

        qualities = download_opts.get("qualities") or ["1080p", "720p", "480p", "360p"]
        formats = download_opts.get("formats") or ["mp4", "webm", "mkv", "mp3", "wav", "m4a", "opus", "flac"]
        video_formats = download_opts.get("video_formats") or ["mp4", "webm", "mkv"]
        audio_formats = download_opts.get("audio_formats") or ["mp3", "wav", "m4a", "opus", "flac"]

        return {
            "provider_id": provider.id,
            "platform": metadata.get("platform") or provider.name,
            "title": metadata.get("title") or "Contenu sans titre",
            "author": metadata.get("author") or "Auteur inconnu",
            "uploader": metadata.get("uploader"),
            "duration": metadata.get("duration") or 0,
            "upload_date": str(metadata.get("upload_date") or "N/A"),
            "description": metadata.get("description") or "",
            "view_count": metadata.get("view_count") or 0,
            "thumbnail": metadata.get("thumbnail"),
            "fps": metadata.get("fps") or 30,
            "video_codec": metadata.get("video_codec") or "H.264",
            "audio_codec": metadata.get("audio_codec") or "AAC",
            "file_size": metadata.get("file_size") or 0,
            "type": metadata.get("type") or "video",
            "qualities": qualities,
            "formats": formats,
            "video_formats": video_formats,
            "audio_formats": audio_formats,
            "subtitles": subtitles,
            "player": player_info,
            "is_direct": metadata.get("is_direct", False),
            "webpage_url": validated_url
        }

    except Exception as e:
        # User-friendly error message, never expose raw stack traces
        err_msg = str(e)
        if "Private video" in err_msg or "Sign in" in err_msg:
            raise HTTPException(status_code=403, detail="Contenu privé ou restreint par la plateforme.")
        elif "Video unavailable" in err_msg or "not found" in err_msg.lower():
            raise HTTPException(status_code=404, detail="Contenu indisponible ou introuvable.")
        else:
            raise HTTPException(status_code=400, detail=f"Échec de l'analyse : {err_msg[:200]}")
