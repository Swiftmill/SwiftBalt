import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database.session import init_db


@pytest.fixture(autouse=True)
async def setup_database():
    await init_db()


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "SwiftBalt"
    assert "ffmpeg" in data


@pytest.mark.asyncio
async def test_providers_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/providers")
    assert response.status_code == 200
    providers = response.json()
    assert len(providers) >= 20


@pytest.mark.asyncio
async def test_dashboard_stats_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/dashboard/stats")
    assert response.status_code == 200
    data = response.json()
    assert "downloads_today" in data
    assert "disk_total_bytes" in data
    assert "activity_trend" in data


@pytest.mark.asyncio
async def test_settings_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["app_name"] == "SwiftBalt"
    assert "downloads_path" in data
