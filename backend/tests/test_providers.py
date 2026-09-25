import pytest
from app.providers.registry import registry
from app.providers.direct import DirectProvider
from app.providers.twitch import TwitchProvider


def test_detect_direct_file():
    provider = registry.detect_provider("https://example.com/archive.zip")
    assert provider is not None
    assert isinstance(provider, DirectProvider)

    provider_iso = registry.detect_provider("https://releases.ubuntu.com/24.04/ubuntu-desktop.iso")
    assert provider_iso is not None
    assert isinstance(provider_iso, DirectProvider)


def test_detect_twitch():
    provider = registry.detect_provider("https://www.twitch.tv/shroud")
    assert provider is not None
    assert isinstance(provider, TwitchProvider)

    provider_clip = registry.detect_provider("https://clips.twitch.tv/AmazingClip123")
    assert provider_clip is not None
    assert isinstance(provider_clip, TwitchProvider)


def test_detect_youtube_tiktok_vimeo():
    yt = registry.detect_provider("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert yt is not None
    assert yt.name == "YouTube"

    tt = registry.detect_provider("https://www.tiktok.com/@user/video/123456789")
    assert tt is not None
    assert tt.name == "TikTok"

    vm = registry.detect_provider("https://vimeo.com/76979871")
    assert vm is not None
    assert vm.name == "Vimeo"


def test_all_providers_catalog():
    providers = registry.get_all_providers_status()
    assert len(providers) >= 20
    ids = [p["id"] for p in providers]
    assert "youtube" in ids
    assert "twitch" in ids
    assert "tiktok" in ids
    assert "direct" in ids
    assert "soundcloud" in ids
