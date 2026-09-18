import pytest
import asyncio
from backend.security import is_safe_url, sanitize_filename
from backend.providers.registry import provider_registry
from backend.download_manager import download_manager
from backend.ffmpeg_service import ffmpeg_service

def test_security_is_safe_url():
    # Valid external URLs
    safe, msg = is_safe_url("https://example.com/video.mp4")
    assert safe is True

    # Blocked localhost & private IP ranges
    safe, msg = is_safe_url("http://localhost:8000/secret")
    assert safe is False

    safe, msg = is_safe_url("http://127.0.0.1/admin")
    assert safe is False

    safe, msg = is_safe_url("http://192.168.1.1/router")
    assert safe is False

    safe, msg = is_safe_url("http://10.0.0.5/")
    assert safe is False

    # Magnet link
    safe, msg = is_safe_url("magnet:?xt=urn:btih:12345")
    assert safe is True

def test_sanitize_filename():
    assert sanitize_filename("../../etc/passwd") == "passwd"
    assert sanitize_filename("my video title!!??.mp4") == "my video title____.mp4"
    assert sanitize_filename("   .hiddenfile.  ") == "hiddenfile"

def test_provider_registry():
    p_yt = provider_registry.find_provider_for_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert p_yt.id == "youtube"

    p_tiktok = provider_registry.find_provider_for_url("https://www.tiktok.com/@user/video/123456")
    assert p_tiktok.id == "tiktok"

    p_twitch = provider_registry.find_provider_for_url("https://www.twitch.tv/videos/987654321")
    assert p_twitch.id == "twitch"

    p_direct = provider_registry.find_provider_for_url("https://example.com/files/document.pdf")
    assert p_direct.id == "direct_url"

@pytest.mark.asyncio
async def test_direct_provider_metadata():
    provider = provider_registry.find_provider_for_url("https://example.com/sample.mp4")
    assert provider.id == "direct_url"
    meta = await provider.get_metadata("https://example.com/sample.mp4")
    assert meta.title == "sample.mp4"
    assert meta.is_direct_file is True

@pytest.mark.asyncio
async def test_download_manager_task_creation():
    task_id = await download_manager.add_task(
        url="https://example.com/sample.mp4",
        provider_id="direct_url",
        title="Sample Video",
        target_format="mp4"
    )
    assert task_id in download_manager.active_tasks
    assert download_manager.active_tasks[task_id]["status"] == "queued"
    await download_manager.delete_task(task_id)

def test_ffmpeg_service_binary():
    assert ffmpeg_service.ffmpeg_binary is not None
