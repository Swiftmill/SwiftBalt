import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from app.core.config import settings
from app.database.session import init_db
from app.downloads.manager import download_manager
from app.torrents.manager import torrent_manager

# API Routers
from app.api.routes_analyze import router as analyze_router
from app.api.routes_download import router as download_router
from app.api.routes_stream import router as stream_router
from app.api.routes_twitch import router as twitch_router
from app.api.routes_torrents import router as torrents_router
from app.api.routes_history import router as history_router
from app.api.routes_favorites import router as favorites_router
from app.api.routes_providers import router as providers_router
from app.api.routes_dashboard import router as dashboard_router
from app.api.routes_settings import router as settings_router
from app.api.routes_anime import router as anime_router
from app.api.routes_ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables, download manager, and BitTorrent engine
    await init_db()
    await download_manager.start()
    await torrent_manager.start()
    yield
    # Shutdown logic
    await torrent_manager.stop()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="SwiftBalt (MediaHub / OmniDownloader) - High Performance Universal Media & File Hub",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(analyze_router)
app.include_router(download_router)
app.include_router(stream_router)
app.include_router(twitch_router)
app.include_router(torrents_router)
app.include_router(history_router)
app.include_router(favorites_router)
app.include_router(providers_router)
app.include_router(dashboard_router)
app.include_router(settings_router)
app.include_router(anime_router)
app.include_router(ws_router)


@app.get("/api/health")
async def health_check():
    devnull = ">nul 2>&1" if os.name == "nt" else ">/dev/null 2>&1"
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "ffmpeg": bool(os.system(f"{settings.FFMPEG_PATH} -version {devnull}") == 0)
    }


# Static mount for downloaded thumbnails if any
if settings.THUMBNAILS_PATH.exists():
    app.mount("/static/thumbnails", StaticFiles(directory=str(settings.THUMBNAILS_PATH)), name="thumbnails")

# Mount production frontend build if available (supports portable root/dist and frontend/dist)
candidate_dists = [
    settings.BASE_PATH / "frontend" / "dist",
    settings.BASE_PATH / "dist",
    Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
    Path(__file__).resolve().parent.parent.parent / "dist",
]
found_dist = None
for dist_dir in candidate_dists:
    if dist_dir.exists() and (dist_dir / "index.html").exists():
        found_dist = dist_dir
        break

if found_dist:
    assets_dir = found_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.exception_handler(404)
    async def spa_fallback_404(request: Request, exc):
        if request.url.path.startswith("/api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        index_file = found_dist / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    app.mount("/", StaticFiles(directory=str(found_dist), html=True), name="frontend")


