from typing import List, Optional
from backend.providers.base import BaseProvider
from backend.providers.ytdlp_provider import YtdlpGenericProvider
from backend.providers.direct_provider import DirectUrlProvider

# Default Supported Services Definitions
PROVIDERS_CONFIG = [
    {"id": "youtube", "name": "YouTube", "domains": ["youtube.com", "youtu.be"], "icon": "youtube"},
    {"id": "bilibili", "name": "Bilibili", "domains": ["bilibili.com", "b23.tv"], "icon": "video"},
    {"id": "bluesky", "name": "Bluesky", "domains": ["bsky.app"], "icon": "cloud"},
    {"id": "dailymotion", "name": "Dailymotion", "domains": ["dailymotion.com", "dai.ly"], "icon": "play"},
    {"id": "facebook", "name": "Facebook", "domains": ["facebook.com", "fb.watch"], "icon": "facebook"},
    {"id": "instagram", "name": "Instagram", "domains": ["instagram.com", "instagr.am"], "icon": "instagram"},
    {"id": "loom", "name": "Loom", "domains": ["loom.com"], "icon": "video"},
    {"id": "okru", "name": "OK.ru", "domains": ["ok.ru"], "icon": "video"},
    {"id": "pinterest", "name": "Pinterest", "domains": ["pinterest.com", "pin.it"], "icon": "image"},
    {"id": "newgrounds", "name": "Newgrounds", "domains": ["newgrounds.com"], "icon": "gamepad"},
    {"id": "reddit", "name": "Reddit", "domains": ["reddit.com", "redd.it"], "icon": "message-square"},
    {"id": "rutube", "name": "RUTUBE", "domains": ["rutube.ru"], "icon": "video"},
    {"id": "snapchat", "name": "Snapchat", "domains": ["snapchat.com"], "icon": "camera"},
    {"id": "soundcloud", "name": "SoundCloud", "domains": ["soundcloud.com"], "icon": "music"},
    {"id": "streamable", "name": "Streamable", "domains": ["streamable.com"], "icon": "video"},
    {"id": "tiktok", "name": "TikTok", "domains": ["tiktok.com", "vm.tiktok.com"], "icon": "video"},
    {"id": "tumblr", "name": "Tumblr", "domains": ["tumblr.com"], "icon": "file-text"},
    {"id": "twitch", "name": "Twitch", "domains": ["twitch.tv", "clips.twitch.tv"], "icon": "twitch"},
    {"id": "twitter", "name": "Twitter / X", "domains": ["twitter.com", "x.com"], "icon": "twitter"},
    {"id": "vimeo", "name": "Vimeo", "domains": ["vimeo.com"], "icon": "video"},
    {"id": "vk", "name": "VKontakte", "domains": ["vk.com", "vk.ru"], "icon": "share-2"},
    {"id": "kick", "name": "Kick", "domains": ["kick.com"], "icon": "tv"},
    {"id": "threads", "name": "Threads", "domains": ["threads.net"], "icon": "at-sign"},
    {"id": "mastodon", "name": "Mastodon", "domains": ["mastodon.social"], "icon": "globe"},
]

class ProviderRegistry:
    def __init__(self):
        self.providers: List[BaseProvider] = []
        self._load_providers()

    def _load_providers(self):
        # Register direct download provider first
        self.providers.append(DirectUrlProvider())

        # Register all media service providers
        for p in PROVIDERS_CONFIG:
            self.providers.append(
                YtdlpGenericProvider(
                    provider_id=p["id"],
                    name=p["name"],
                    domains=p["domains"],
                    icon=p["icon"]
                )
            )

    def find_provider_for_url(self, url: str) -> Optional[BaseProvider]:
        # 1. Check media services
        for provider in self.providers:
            if provider.id != "direct_url" and provider.detect(url):
                return provider

        # 2. Check direct URL provider
        direct_provider = next((p for p in self.providers if p.id == "direct_url"), None)
        if direct_provider and direct_provider.detect(url):
            return direct_provider

        # 3. Fallback to generic yt-dlp provider if no specific domain matched
        return YtdlpGenericProvider(
            provider_id="generic",
            name="Media Provider",
            domains=[],
            icon="globe"
        )

    def list_providers(self) -> List[dict]:
        return [p.get_status() for p in self.providers]

provider_registry = ProviderRegistry()
