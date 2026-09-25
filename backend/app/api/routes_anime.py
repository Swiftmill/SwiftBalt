import re
import time
import urllib.parse
import asyncio
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
import httpx

router = APIRouter(prefix="/api/anime", tags=["Anime"])

BASE_URL = "https://anime-sama.to"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
}

# In-memory caches with timestamp
_cache: Dict[str, Any] = {}
_cache_time: Dict[str, float] = {}

def get_cached(key: str, ttl_seconds: float = 1800) -> Optional[Any]:
    if key in _cache and (time.time() - _cache_time.get(key, 0)) < ttl_seconds:
        return _cache[key]
    return None

def set_cached(key: str, value: Any):
    _cache[key] = value
    _cache_time[key] = time.time()


@router.get("/trending")
async def get_trending_anime():
    """Get trending and popular animes from Anime-Sama."""
    cached = get_cached("trending", ttl_seconds=3600)
    if cached:
        return cached

    # Curated list of popular animes — always shown first
    POPULAR = [
        ("solo-leveling", "Solo Leveling"),
        ("jujutsu-kaisen", "Jujutsu Kaisen"),
        ("demon-slayer", "Demon Slayer : Kimetsu no Yaiba"),
        ("one-piece", "One Piece"),
        ("naruto-shippuden", "Naruto Shippuden"),
        ("chainsaw-man", "Chainsaw Man"),
        ("attack-on-titan", "L'Attaque des Titans"),
        ("bleach", "Bleach"),
        ("hunter-x-hunter", "Hunter x Hunter"),
        ("death-note", "Death Note"),
        ("my-hero-academia", "My Hero Academia"),
        ("fullmetal-alchemist-brotherhood", "Fullmetal Alchemist: Brotherhood"),
        ("kaiju-no-8", "Kaiju No. 8"),
        ("mashle", "Mashle: Magic and Muscles"),
        ("frieren", "Sousou no Frieren"),
        ("wind-breaker", "Wind Breaker"),
        ("oshi-no-ko", "Oshi no Ko"),
        ("dandadan", "DanDaDan"),
        ("dr-stone", "Dr. Stone"),
        ("tokyo-revengers", "Tokyo Revengers"),
        ("black-clover", "Black Clover"),
        ("fairy-tail", "Fairy Tail"),
        ("sword-art-online", "Sword Art Online"),
        ("re-zero", "Re:Zero"),
        ("steins-gate", "Steins;Gate"),
        ("overlord", "Overlord"),
        ("one-punch-man", "One Punch Man"),
        ("dragon-ball-super", "Dragon Ball Super"),
        ("mob-psycho-100", "Mob Psycho 100"),
        ("haikyuu", "Haikyuu!!"),
        ("vinland-saga", "Vinland Saga"),
        ("spy-x-family", "Spy x Family"),
        ("the-apothecary-diaries", "The Apothecary Diaries"),
        ("blue-exorcist", "Blue Exorcist"),
        ("sword-art-online-alternative-gun-gale-online", "SAO Alternative GGO"),
        ("nanatsu-no-taizai", "The Seven Deadly Sins"),
        ("black-butler", "Black Butler"),
    ]

    items = [
        {
            "slug": slug,
            "title": title,
            "thumbnail": f"https://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/contenu/thumb/{slug}.webp",
            "url": f"{BASE_URL}/catalogue/{slug}/",
        }
        for slug, title in POPULAR
    ]

    # Try to also add recently-updated anime from homepage
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(BASE_URL, headers=HEADERS)
            html = resp.text

            # Find slugs that appear alongside images on the homepage (recently updated)
            # Look for pattern: img src with cdn thumbnail + nearby catalogue link
            existing_slugs = {item["slug"] for item in items}

            # Simple: find all /catalogue/slug/ hrefs
            raw_slugs = re.findall(r'href="(?:https://anime-sama\.to)?/catalogue/([^"/]+)/?"', html)
            bad = {"catalogue", "planning", "contact", "dmca"}

            # Take top 20 unique slugs not already in our list
            seen = set()
            extra_added = 0
            for slug in raw_slugs:
                if slug in seen or slug in bad or slug in existing_slugs:
                    continue
                if len(slug) < 3 or slug.isdigit():
                    continue
                seen.add(slug)
                items.append({
                    "slug": slug,
                    "title": slug.replace("-", " ").title(),
                    "thumbnail": f"https://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/contenu/thumb/{slug}.webp",
                    "url": f"{BASE_URL}/catalogue/{slug}/",
                })
                extra_added += 1
                if extra_added >= 15:
                    break
    except Exception as e:
        print(f"Error adding extra anime from homepage: {e}")

    set_cached("trending", items)
    return items


@router.get("/search")
async def search_anime(q: str = Query(..., min_length=1)):
    """Search animes using Anime-Sama instant fuzzy search API."""
    query = q.strip().lower()
    cache_key = f"search:{query}"
    cached = get_cached(cache_key, ttl_seconds=600)
    if cached is not None:
        return cached

    results = []
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            # 1. Try Anime-Sama ajax search endpoint
            fetch_url = f"{BASE_URL}/template-php/defaut/fetch.php"
            resp = await client.post(
                fetch_url,
                data={"query": query},
                headers={
                    **HEADERS,
                    "X-Requested-With": "XMLHttpRequest",
                    "Content-Type": "application/x-www-form-urlencoded",
                }
            )

            html = resp.text

            # Simplified regex: find all <a> with class asn-search-result and extract data
            # Pattern: <a href="URL" class="asn-search-result">...</a>
            link_blocks = re.findall(
                r'<a\s+href="([^"]+)"\s+class="asn-search-result">(.*?)</a>',
                html,
                re.S
            )

            for href, inner in link_blocks:
                # Extract slug from URL
                slug_m = re.search(r'/catalogue/([^/]+)/?$', href)
                if not slug_m:
                    continue
                slug = slug_m.group(1)

                # Extract title from h3
                title_m = re.search(r'<h3[^>]*>(.*?)</h3>', inner, re.S)
                title = re.sub(r'<[^>]+>', '', title_m.group(1)).strip() if title_m else slug.replace("-", " ").title()

                # Extract alt title from p
                sub_m = re.search(r'<p[^>]*>(.*?)</p>', inner, re.S)
                alt_title = re.sub(r'<[^>]+>', '', sub_m.group(1)).strip() if sub_m else ""
                # Limit alt_title length
                if len(alt_title) > 80:
                    alt_title = alt_title[:77] + "..."

                # Extract image
                img_m = re.search(r'src="([^"]+)"', inner)
                thumb = img_m.group(1) if img_m else f"https://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/contenu/thumb/{slug}.webp"

                results.append({
                    "slug": slug,
                    "title": title,
                    "alt_title": alt_title,
                    "thumbnail": thumb,
                    "url": f"{BASE_URL}/catalogue/{slug}/",
                })

            # 2. If no results, try catalogue URL search
            if not results:
                cat_resp = await client.get(f"{BASE_URL}/catalogue/?search={urllib.parse.quote(query)}", headers=HEADERS)
                cat_html = cat_resp.text
                # Simple slug extraction
                slugs = re.findall(r'href="(?:https://anime-sama\.to)?/catalogue/([^"/]+)/?"', cat_html)
                bad = {"catalogue", "planning", "contact", "dmca"}
                seen = set()
                for slug in slugs:
                    if slug in seen or slug in bad:
                        continue
                    seen.add(slug)
                    results.append({
                        "slug": slug,
                        "title": slug.replace("-", " ").title(),
                        "alt_title": "",
                        "thumbnail": f"https://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/contenu/thumb/{slug}.webp",
                        "url": f"{BASE_URL}/catalogue/{slug}/",
                    })

    except Exception as e:
        print(f"Anime search error: {e}")

    set_cached(cache_key, results)
    return results


import socket

_doh_cache: Dict[str, str] = {}

async def resolve_safe_ip(domain: str) -> str:
    """
    Resolve domain bypassing local DNS poisoning (e.g. French ISP blocks redirecting to 127.0.0.1)
    via Cloudflare DNS-over-HTTPS (DoH).
    """
    clean_domain = domain.strip().lower()
    if clean_domain in _doh_cache:
        return _doh_cache[clean_domain]

    # Try local resolution first
    try:
        local_ip = socket.gethostbyname(clean_domain)
        if not local_ip.startswith("127.") and local_ip != "0.0.0.0" and local_ip != "::1":
            _doh_cache[clean_domain] = local_ip
            return local_ip
    except Exception:
        pass

    # Query Cloudflare DoH
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get(
                f"https://cloudflare-dns.com/dns-query?name={clean_domain}&type=A",
                headers={"accept": "application/dns-json"}
            )
            data = r.json()
            for ans in data.get("Answer", []):
                if ans.get("type") == 1:
                    ip = ans.get("data")
                    if ip and not ip.startswith("127.") and ip != "0.0.0.0":
                        _doh_cache[clean_domain] = ip
                        return ip
    except Exception as e:
        print(f"DoH resolution error for {clean_domain}: {e}")

    return clean_domain


async def build_safe_request(url: str, headers: dict) -> tuple[str, dict, bool]:
    """
    Replaces poisoned hostname with safe DoH IP and adds Host header if needed.
    Returns (actual_url, headers, verify_ssl).
    """
    parsed = urllib.parse.urlparse(url)
    domain = parsed.hostname or ""
    safe_ip = await resolve_safe_ip(domain)

    fetch_headers = dict(headers)
    if safe_ip != domain and safe_ip != parsed.netloc:
        port_str = f":{parsed.port}" if parsed.port else ""
        new_netloc = f"{safe_ip}{port_str}"
        fetch_url = urllib.parse.urlunparse(parsed._replace(netloc=new_netloc))
        fetch_headers["Host"] = parsed.netloc
        return fetch_url, fetch_headers, False
    return url, fetch_headers, True


# IMPORTANT: Static routes MUST come before /{slug} to avoid FastAPI capturing them as slug params
@router.get("/resolve-stream")
async def resolve_anime_stream(url: str = Query(..., description="Episode embed or player URL")):
    """
    Attempt to resolve direct stream (MP4/HLS) from embed URL.
    - Sibnet: extracts direct MP4 via /api/anime/proxy-video
    - Anime-Sama / Ansembed / Vidmoly: extracts direct HLS (m3u8) via /api/anime/proxy-hls with DoH DNS bypass
    - Sendvid: checks availability and extracts direct mp4 or reports if dead
    """
    clean_url = url.strip()

    # 1. Sibnet direct resolution
    if "video.sibnet.ru" in clean_url:
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(
                    clean_url,
                    headers={
                        **HEADERS,
                        "Referer": "https://video.sibnet.ru/",
                    }
                )
                html = resp.text
                src_matches = re.findall(r'src:\s*["\'](/v/[^"\']+)["\']', html)
                if not src_matches:
                    src_matches = re.findall(r'["\'](/v/[^"\']+\.mp4[^"\']*)["\']', html)

                if src_matches:
                    direct_mp4 = f"https://video.sibnet.ru{src_matches[0]}"
                    proxied_url = f"/api/anime/proxy-video?url={urllib.parse.quote(direct_mp4)}&referer={urllib.parse.quote('https://video.sibnet.ru/')}"
                    return {
                        "type": "direct",
                        "is_hls": False,
                        "stream_url": proxied_url,
                        "raw_url": direct_mp4,
                        "embed_url": clean_url,
                        "is_direct": True,
                    }
        except Exception as e:
            print(f"Sibnet resolution error: {e}")

    # 2. Anime-Sama / Ansembed / Vidmoly direct HLS resolution
    if any(k in clean_url.lower() for k in ["ansembed", "smoothpre", "vidmoly", "anime-sama"]):
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(
                    clean_url,
                    headers={
                        **HEADERS,
                        "Referer": "https://anime-sama.to/",
                    }
                )
                html = resp.text
                m3u8_matches = re.findall(r'sources:\s*\[\s*\{\s*file:\s*["\']([^"\']+master\.m3u8[^"\']*)["\']', html)
                if not m3u8_matches:
                    m3u8_matches = re.findall(r'["\'](https?://[^"\']+\.m3u8[^"\']*)["\']', html)

                if m3u8_matches:
                    m3u8_url = m3u8_matches[0]
                    proxied_url = f"/api/anime/proxy-hls?url={urllib.parse.quote(m3u8_url)}&referer={urllib.parse.quote('https://ansembed.net/')}"
                    return {
                        "type": "direct",
                        "is_hls": True,
                        "stream_url": proxied_url,
                        "raw_url": m3u8_url,
                        "embed_url": clean_url,
                        "is_direct": True,
                    }
        except Exception as e:
            print(f"Anime-Sama HLS resolution error: {e}")

    # 3. Sendvid resolution and availability check
    if "sendvid.com" in clean_url.lower():
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(clean_url, headers=HEADERS)
                if resp.status_code == 404 or "temporarily unavailable" in resp.text.lower() or "video deleted" in resp.text.lower():
                    return {
                        "type": "unavailable",
                        "error": "Cette vidéo n'est plus disponible sur Sendvid. Veuillez sélectionner le lecteur Sibnet ou Anime-Sama.",
                        "embed_url": clean_url,
                        "is_direct": False,
                    }
                # Check if direct mp4 source is in page
                mp4_matches = re.findall(r'<source\s+src="([^"]+\.mp4[^"]*)"', resp.text)
                if not mp4_matches:
                    mp4_matches = re.findall(r'var\s+video_source\s*=\s*["\']([^"\']+)["\']', resp.text)
                if mp4_matches:
                    mp4_url = mp4_matches[0]
                    return {
                        "type": "direct",
                        "is_hls": False,
                        "stream_url": f"/api/anime/proxy-video?url={urllib.parse.quote(mp4_url)}&referer={urllib.parse.quote('https://sendvid.com/')}",
                        "raw_url": mp4_url,
                        "embed_url": clean_url,
                        "is_direct": True,
                    }
        except Exception as e:
            print(f"Sendvid check error: {e}")

    # Fallback to embed player
    return {
        "type": "embed",
        "embed_url": clean_url,
        "is_direct": False,
    }


@router.api_route("/proxy-video", methods=["GET", "HEAD"])
async def proxy_video(
    request: Request,
    url: str = Query(...),
    referer: Optional[str] = Query(None)
):
    """
    Streaming proxy for direct video files (e.g. Sibnet MP4)
    Supports HTTP Range requests for smooth scrubbing and seeking in HTML5 player!
    Uses DoH safe resolution to bypass ISP blocks.
    """
    clean_url = url.strip()
    target_headers = {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": referer or "https://video.sibnet.ru/",
    }

    range_header = request.headers.get("range")
    if range_header:
        target_headers["Range"] = range_header

    fetch_url, fetch_headers, verify_ssl = await build_safe_request(clean_url, target_headers)

    client = httpx.AsyncClient(timeout=60.0, verify=verify_ssl, follow_redirects=True)
    req = client.build_request(request.method, fetch_url, headers=fetch_headers)
    resp = await client.send(req, stream=True)

    status_code = resp.status_code
    response_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    }

    for k in ["content-type", "content-length", "content-range", "accept-ranges"]:
        if k in resp.headers:
            response_headers[k] = resp.headers[k]

    if "accept-ranges" not in response_headers:
        response_headers["accept-ranges"] = "bytes"
    if "content-type" not in response_headers:
        response_headers["content-type"] = "video/mp4"

    if request.method == "HEAD":
        await resp.aclose()
        await client.aclose()
        return Response(status_code=status_code, headers=response_headers)

    async def stream_generator():
        try:
            async for chunk in resp.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    return StreamingResponse(
        stream_generator(),
        status_code=status_code,
        headers=response_headers,
    )


@router.api_route("/proxy-hls", methods=["GET", "HEAD"])
async def proxy_hls(
    request: Request,
    url: str = Query(...),
    referer: Optional[str] = Query(None)
):
    """
    Streaming proxy for HLS playlists (.m3u8) and video segments (.ts).
    Bypasses DNS poisoning from French ISPs via DoH and rewrites playlist URLs.
    """
    clean_url = url.strip()
    target_headers = {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": referer or "https://ansembed.net/",
    }

    range_header = request.headers.get("range")
    if range_header:
        target_headers["Range"] = range_header

    fetch_url, fetch_headers, verify_ssl = await build_safe_request(clean_url, target_headers)

    is_playlist = ".m3u8" in clean_url.lower()

    if is_playlist:
        async with httpx.AsyncClient(timeout=15.0, verify=verify_ssl, follow_redirects=True) as client:
            resp = await client.get(fetch_url, headers=fetch_headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Erreur chargement playlist HLS")

            base_proxy = f"{str(request.base_url).rstrip('/')}/api/anime/proxy-hls"
            base_url = clean_url

            if "#EXT-X-STREAM-INF" in resp.text:
                # Master playlist with multiple quality streams!
                # Sort variants by BANDWIDTH descending so highest quality (1080p) is always listed first
                variants = []
                lines = resp.text.splitlines()
                header_lines = []
                idx = 0
                while idx < len(lines):
                    line = lines[idx].strip()
                    if line.startswith("#EXT-X-STREAM-INF"):
                        bw_match = re.search(r'BANDWIDTH=(\d+)', line)
                        bandwidth = int(bw_match.group(1)) if bw_match else 0
                        if idx + 1 < len(lines):
                            url_line = lines[idx + 1].strip()
                            abs_url = urllib.parse.urljoin(base_url, url_line)
                            proxied_url = f"{base_proxy}?url={urllib.parse.quote(abs_url)}&referer={urllib.parse.quote(referer or base_url)}"
                            variants.append((bandwidth, line, proxied_url))
                            idx += 2
                            continue
                    elif not variants and line:
                        header_lines.append(line)
                    idx += 1

                variants.sort(key=lambda x: x[0], reverse=True)
                out_lines = list(header_lines)
                for _, inf_line, stream_u in variants:
                    out_lines.append(inf_line)
                    out_lines.append(stream_u)
                content = "\n".join(out_lines) + "\n"
            else:
                lines = resp.text.splitlines()
                out_lines = []
                for line in lines:
                    l = line.strip()
                    if not l:
                        continue
                    if l.startswith("#"):
                        if 'URI="' in l:
                            def repl_uri(m):
                                raw_uri = m.group(1)
                                abs_uri = urllib.parse.urljoin(base_url, raw_uri)
                                return f'URI="{base_proxy}?url={urllib.parse.quote(abs_uri)}&referer={urllib.parse.quote(referer or base_url)}"'
                            l = re.sub(r'URI="([^"]+)"', repl_uri, l)
                        out_lines.append(l)
                    else:
                        abs_seg_url = urllib.parse.urljoin(base_url, l)
                        proxied_seg = f"{base_proxy}?url={urllib.parse.quote(abs_seg_url)}&referer={urllib.parse.quote(referer or base_url)}"
                        out_lines.append(proxied_seg)

                content = "\n".join(out_lines) + "\n"
            resp_headers = {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Cache-Control": "no-cache",
            }

            if request.method == "HEAD":
                return Response(status_code=200, media_type="application/vnd.apple.mpegurl", headers=resp_headers)

            return Response(
                content=content,
                media_type="application/vnd.apple.mpegurl",
                headers=resp_headers
            )
    else:
        # Binary video chunk / segment (.ts)
        client = httpx.AsyncClient(timeout=45.0, verify=verify_ssl, follow_redirects=True)
        req = client.build_request(request.method, fetch_url, headers=fetch_headers)
        resp = await client.send(req, stream=True)

        resp_headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
        for k in ["content-type", "content-length", "content-range", "accept-ranges"]:
            if k in resp.headers:
                resp_headers[k] = resp.headers[k]
        if "content-type" not in resp_headers:
            resp_headers["content-type"] = "video/mp2t"
        if "accept-ranges" not in resp_headers:
            resp_headers["accept-ranges"] = "bytes"

        if request.method == "HEAD":
            await resp.aclose()
            await client.aclose()
            return Response(status_code=resp.status_code, headers=resp_headers)

        async def chunk_generator():
            try:
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    yield chunk
            finally:
                await resp.aclose()
                await client.aclose()

        return StreamingResponse(
            chunk_generator(),
            status_code=resp.status_code,
            headers=resp_headers,
        )


@router.get("/{slug}/episodes")
async def get_anime_episodes(slug: str, subpath: str = Query(..., description="Season subpath e.g. saison1/vostfr")):
    """Get all episodes and their video source players for a given season subpath."""
    clean_subpath = subpath.strip().strip("/")
    cache_key = f"episodes:{slug}:{clean_subpath}"
    cached = get_cached(cache_key, ttl_seconds=600)
    if cached:
        return cached

    js_url = f"{BASE_URL}/catalogue/{slug}/{clean_subpath}/episodes.js"
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(js_url, headers=HEADERS)
            if resp.status_code != 200:
                raise HTTPException(status_code=404, detail="Liste des épisodes non disponible")

            content = resp.text

            # Parse arrays e.g.: var eps1 = [ 'https://...', 'https://...' ];
            # var eps2 = [...]; var eps3 = [...];
            arrays = re.findall(r'var\s+(eps\d+)\s*=\s*\[(.*?)\];', content, re.S)

            sources_by_player: Dict[str, List[str]] = {}
            max_episodes = 0

            for name, body in arrays:
                raw_links = [
                    l.strip().strip("'\"").strip()
                    for l in body.split(",")
                    if l.strip().strip("'\"").strip()
                ]
                if raw_links:
                    sources_by_player[name] = raw_links
                    if len(raw_links) > max_episodes:
                        max_episodes = len(raw_links)

            # Build list of episodes
            episodes = []
            for ep_idx in range(max_episodes):
                ep_num = ep_idx + 1
                players: Dict[str, str] = {}

                # Map eps1, eps2, eps3 to friendly host names
                for var_name, links in sources_by_player.items():
                    if ep_idx < len(links):
                        link = links[ep_idx]
                        # Determine host name
                        host_label = "Lecteur 1"
                        if "sibnet.ru" in link:
                            host_label = "Sibnet"
                        elif "sendvid.com" in link:
                            host_label = "Sendvid"
                        elif "ansembed" in link or "smoothpre.com" in link:
                            host_label = "Anime-Sama"
                        elif "vidmoly" in link:
                            host_label = "Vidmoly"
                        elif "streamwish" in link:
                            host_label = "Streamwish"
                        elif "vk.com" in link:
                            host_label = "VK"
                        elif "okru" in link or "ok.ru" in link:
                            host_label = "OK.ru"
                        else:
                            num = var_name.replace("eps", "")
                            host_label = f"Lecteur {num}"

                        players[host_label] = link

                episodes.append({
                    "episode": ep_num,
                    "title": f"Épisode {ep_num}",
                    "players": players,
                })

            result = {
                "slug": slug,
                "subpath": clean_subpath,
                "total_episodes": max_episodes,
                "episodes": episodes,
            }

            set_cached(cache_key, result)
            return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur extraction épisodes: {str(e)}")


@router.get("/{slug}")
async def get_anime_details(slug: str):
    """Get full details of an anime (title, synopsis, genres, and available seasons)."""
    cache_key = f"anime:{slug}"
    cached = get_cached(cache_key, ttl_seconds=1800)
    if cached:
        return cached

    target_url = f"{BASE_URL}/catalogue/{slug}/"
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            resp = await client.get(target_url, headers=HEADERS)
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail="Anime non trouvé")
            html = resp.text

            # 1. Title
            title_m = re.search(r"""<h1[^>]*id=["']titreOeuvre["'][^>]*>(.*?)</h1>""", html, re.I | re.S)
            if not title_m:
                title_m = re.search(r"""<h1[^>]*>(.*?)</h1>""", html, re.I | re.S)
            title = re.sub(r"""<[^>]+>""", '', title_m.group(1)).strip() if title_m else slug.replace("-", " ").title()

            # 2. Alternate title from keywords or h2
            alt_title = ""
            alt_m = re.search(r"""<h2[^>]*id=["']titreAlt["'][^>]*>(.*?)</h2>""", html, re.I | re.S)
            if alt_m:
                alt_title = re.sub(r"""<[^>]+>""", '', alt_m.group(1)).strip()
            else:
                kw_m = re.search(r"""<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']""", html, re.I)
                if kw_m:
                    kws = [k.strip() for k in kw_m.group(1).split(",") if k.strip() and "anime" not in k.lower() and "streaming" not in k.lower()]
                    if len(kws) > 1:
                        alt_title = ", ".join(kws[1:4])

            # 3. Synopsis from meta description or page
            synopsis = ""
            desc_m = re.search(r"""<meta\s+name=["']description["']\s+content=["']([^"']+)["']""", html, re.I)
            if desc_m:
                synopsis = desc_m.group(1).strip()
            else:
                syn_m = re.search(r"""class=["']synopsis-content["'][^>]*>(.*?)</div>""", html, re.S)
                if syn_m:
                    synopsis = re.sub(r"""<[^>]+>""", '', syn_m.group(1)).strip()

            # 4. Cover image
            cover_m = re.search(r"""<img[^>]*id=["']coverOeuvre["'][^>]*src=["']([^"']+)["']""", html, re.I)
            if not cover_m:
                cover_m = re.search(r"""<img[^>]*src=["']([^"']+)["'][^>]*id=["']coverOeuvre["']""", html, re.I)
            cover = cover_m.group(1) if cover_m else f"https://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/contenu/thumb/{slug}.webp"

            # 5. Genres
            genres = []
            genre_matches = re.findall(r"""class=["']genre-tag["'][^>]*>(.*?)</span>""", html, re.S)
            for g in genre_matches:
                clean_g = re.sub(r'<[^>]+>', '', g).strip()
                if clean_g and clean_g not in genres:
                    genres.append(clean_g)

            # 6. Seasons & Formats (with automatic VOSTFR and VF discovery)
            panels_dq = re.findall(r'panneauAnime\("([^"]+)"\s*,\s*"([^"]+)"\)', html)
            panels_sq = re.findall(r"panneauAnime\('([^']+)'\s*,\s*'([^']+)'\)", html)
            raw_panels = panels_dq + panels_sq

            parsed_seasons = []
            for name, subpath in raw_panels:
                name = name.strip()
                subpath = subpath.strip().strip("/")
                if name.lower() == "nom" or subpath.lower() == "url":
                    continue
                parsed_seasons.append((name, subpath))

            async def resolve_season_variants(name: str, subpath: str):
                is_vf = "vf" in subpath.lower() or "vf" in name.lower()
                is_vostfr = "vostfr" in subpath.lower() or "vostfr" in name.lower() or (not is_vf)
                is_film = "film" in subpath.lower() or "film" in name.lower()
                clean_name = re.sub(r'\s*\((?:VOSTFR|VF|VA)\)', '', name, flags=re.I).strip()
                
                variants = []
                primary_lang = "VF" if is_vf else "VOSTFR"
                variants.append({
                    "name": f"{clean_name} ({primary_lang})" if not is_film else clean_name,
                    "season_title": clean_name,
                    "subpath": subpath,
                    "lang": primary_lang,
                    "is_vf": primary_lang == "VF",
                    "is_vostfr": primary_lang == "VOSTFR",
                    "is_film": is_film,
                    "url": f"{BASE_URL}/catalogue/{slug}/{subpath}/",
                })

                if primary_lang == "VOSTFR":
                    alt_subpath = subpath.replace("vostfr", "vf")
                    alt_lang = "VF"
                else:
                    alt_subpath = subpath.replace("vf", "vostfr")
                    alt_lang = "VOSTFR"

                if alt_subpath != subpath:
                    try:
                        head_resp = await client.head(f"{BASE_URL}/catalogue/{slug}/{alt_subpath}/episodes.js", headers=HEADERS)
                        if head_resp.status_code == 200:
                            variants.append({
                                "name": f"{clean_name} ({alt_lang})" if not is_film else f"{clean_name} ({alt_lang})",
                                "season_title": clean_name,
                                "subpath": alt_subpath,
                                "lang": alt_lang,
                                "is_vf": alt_lang == "VF",
                                "is_vostfr": alt_lang == "VOSTFR",
                                "is_film": is_film,
                                "url": f"{BASE_URL}/catalogue/{slug}/{alt_subpath}/",
                            })
                    except Exception:
                        pass
                return variants

            season_lists = await asyncio.gather(*(resolve_season_variants(n, s) for n, s in parsed_seasons))
            seasons = [item for sub in season_lists for item in sub]

            details = {
                "slug": slug,
                "title": title,
                "alt_title": alt_title,
                "cover": cover,
                "synopsis": synopsis,
                "genres": genres,
                "seasons": seasons,
                "webpage_url": target_url,
            }

            set_cached(cache_key, details)
            return details
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération de l'anime: {str(e)}")
