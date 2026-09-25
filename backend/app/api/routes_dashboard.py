import shutil
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.core.config import settings
from app.database.session import get_db
from app.database.models import DownloadModel, HistoryModel
from app.downloads.manager import download_manager

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """Computes real-time dashboard analytics: downloads today, active, completed, failed, disk usage."""
    # Active downloads in memory
    all_jobs = download_manager.list_jobs()
    active_count = sum(1 for j in all_jobs if j["status"] in ("downloading", "processing", "merging"))
    queued_count = sum(1 for j in all_jobs if j["status"] == "queued")

    # DB counts
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)

    # Downloads today
    res_today = await db.execute(
        select(func.count(DownloadModel.id)).where(DownloadModel.created_at >= today_start)
    )
    downloads_today = res_today.scalar() or 0

    # Total completed & failed
    res_completed = await db.execute(
        select(func.count(DownloadModel.id)).where(DownloadModel.status == "completed")
    )
    completed_count = res_completed.scalar() or 0

    res_failed = await db.execute(
        select(func.count(DownloadModel.id)).where(DownloadModel.status == "failed")
    )
    failed_count = res_failed.scalar() or 0

    # Storage calculations
    total_b, used_b, free_b = shutil.disk_usage(str(settings.DATA_PATH))

    # Calculate actual size of downloads folder
    downloads_size = 0
    if settings.DOWNLOADS_PATH.exists():
        downloads_size = sum(f.stat().st_size for f in settings.DOWNLOADS_PATH.glob("**/*") if f.is_file())

    # Daily activity trend (past 7 days)
    activity_trend = []
    for day_offset in range(6, -1, -1):
        day_date = datetime.now(timezone.utc) - timedelta(days=day_offset)
        day = day_date.strftime("%a")
        start = day_date.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
        end = start + timedelta(days=1)
        r = await db.execute(
            select(func.count(DownloadModel.id)).where(
                DownloadModel.created_at >= start,
                DownloadModel.created_at < end
            )
        )
        activity_trend.append({"day": day, "count": r.scalar() or 0})

    return {
        "downloads_today": downloads_today,
        "active_downloads": active_count,
        "queued_downloads": queued_count,
        "completed_downloads": completed_count,
        "failed_downloads": failed_count,
        "downloads_size_bytes": downloads_size,
        "disk_total_bytes": total_b,
        "disk_used_bytes": used_b,
        "disk_free_bytes": free_b,
        "activity_trend": activity_trend,
    }
