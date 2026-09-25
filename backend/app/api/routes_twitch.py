from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List
from app.core.security import validate_url_security
from app.providers.twitch import TwitchProvider

router = APIRouter(prefix="/api/twitch", tags=["Twitch Hub"])
twitch_provider = TwitchProvider()


@router.get("/analyze")
async def analyze_twitch_url(url: str = Query(..., description="Twitch channel, VOD or clip URL")):
    """Analyzes a Twitch stream, VOD, or clip and returns specialized details."""
    validated = validate_url_security(url)
    if not twitch_provider.detect(validated):
        raise HTTPException(status_code=400, detail="L'URL fournie n'est pas une URL Twitch valide.")

    try:
        meta = await twitch_provider.get_metadata(validated)
        streams = await twitch_provider.get_streams(validated)
        player = await twitch_provider.get_player(validated)

        return {
            "metadata": meta,
            "streams": streams,
            "player": player,
            "is_vod": meta.get("twitch_type") == "vod",
            "is_clip": meta.get("twitch_type") == "clip",
            "is_channel": meta.get("twitch_type") == "channel",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur Twitch Hub : {str(e)[:200]}")


@router.get("/featured")
async def get_featured_twitch():
    """Returns curated public demonstration channels and resources for quick testing."""
    return [
        {
            "channel": "monstercat",
            "title": "Monstercat 24/7 Live Music Stream",
            "category": "Music",
            "url": "https://www.twitch.tv/monstercat",
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/monstercat-profile_image-3e70d494801b0b5d-300x300.jpeg"
        },
        {
            "channel": "nasa",
            "title": "NASA TV Official Live Broadcast",
            "category": "Science & Technology",
            "url": "https://www.twitch.tv/nasa",
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/nasa-profile_image-28d0c1e4c34440c9-300x300.jpeg"
        }
    ]


@router.get("/hls/manifest.m3u8")
async def proxy_twitch_m3u8(url: str = Query(..., description="CloudFront M3U8 URL")):
    """
    Proxies and rewrites Twitch M3U8 manifests for seamless in-browser playback:
    - Bypasses CloudFront CORS restrictions
    - Handles muted/unmuted segment conversion (like SubVod)
    - Rewrites segment and init URLs to pass through the local segment proxy
    """
    import re
    from urllib.parse import urljoin, quote
    from fastapi import Response
    import httpx

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail="Impossible de charger le manifest Twitch.")
            content = res.text

        # 1) SubVod unmuting logic: replace unmuted with muted
        content = content.replace("unmuted", "muted")

        # 2) Base URL for relative segments
        base_url = url.rsplit("/", 1)[0] + "/"

        # 3) Rewrite lines
        lines = content.splitlines()
        rewritten_lines = []

        for line in lines:
            line_str = line.strip()
            if not line_str:
                rewritten_lines.append(line)
                continue

            if line_str.startswith('#EXT-X-MAP:URI="'):
                map_match = re.search(r'#EXT-X-MAP:URI="([^"]+)"', line_str)
                if map_match:
                    raw_uri = map_match.group(1)
                    full_uri = urljoin(base_url, raw_uri)
                    proxy_uri = f"/api/twitch/hls/segment?url={quote(full_uri)}"
                    line_str = f'#EXT-X-MAP:URI="{proxy_uri}"'
                rewritten_lines.append(line_str)
                continue

            if line_str.startswith("#"):
                rewritten_lines.append(line_str)
            else:
                full_segment_url = urljoin(base_url, line_str)
                proxy_segment_url = f"/api/twitch/hls/segment?url={quote(full_segment_url)}"
                rewritten_lines.append(proxy_segment_url)

        final_playlist = "\n".join(rewritten_lines)

        return Response(
            content=final_playlist,
            media_type="application/vnd.apple.mpegurl",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Cache-Control": "no-cache",
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur proxy M3U8 : {e}")


@router.get("/hls/segment")
async def proxy_twitch_segment(url: str = Query(..., description="CloudFront segment URL")):
    """
    Streams individual TS / MP4 segment chunks from CloudFront with CORS headers.
    """
    from fastapi.responses import StreamingResponse
    import httpx

    try:
        client = httpx.AsyncClient(timeout=30.0)
        req = client.build_request("GET", url, headers={"User-Agent": "Mozilla/5.0"})
        resp = await client.send(req, stream=True)

        if resp.status_code != 200:
            await resp.aclose()
            await client.aclose()
            raise HTTPException(status_code=resp.status_code, detail="Erreur segment Twitch.")

        media_type = "video/MP2T" if url.endswith(".ts") else "video/mp4"

        async def stream_content():
            try:
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    yield chunk
            finally:
                await resp.aclose()
                await client.aclose()

        return StreamingResponse(
            stream_content(),
            media_type=media_type,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Cache-Control": "public, max-age=86400",
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur segment : {e}")
