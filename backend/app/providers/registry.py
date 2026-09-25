from typing import List, Optional, Dict, Any
from urllib.parse import urlparse
from app.providers.base import BaseProvider
from app.providers.direct import DirectProvider
from app.providers.twitch import TwitchProvider
from app.providers.ytdlp_adapter import YtDlpProvider

class ProviderRegistry:
    """
    Central registry managing all SwiftBalt platform providers.
    Supports dynamic registration and auto-detection.
    """

    def __init__(self):
        self._providers: List[BaseProvider] = []
        self._initialize_default_providers()

    def register(self, provider: BaseProvider):
        self._providers.append(provider)

    def _initialize_default_providers(self):
        # 1. Direct file download provider (ZIP, PDF, ISO, MP4, MP3, etc.)
        self.register(DirectProvider())

        # 2. Dedicated Twitch Hub provider
        self.register(TwitchProvider())

        # 3. Dedicated and universal adapters for the required 25+ services
        services_definitions = [
            {
                "id": "youtube",
                "name": "YouTube",
                "domains": ["youtube.com", "youtu.be", "music.youtube.com", "m.youtube.com"],
                "icon": "youtube",
                "capabilities": ["video", "audio", "subtitles", "thumbnails", "1080p", "1440p", "4k"]
            },
            {
                "id": "tiktok",
                "name": "TikTok",
                "domains": ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
                "icon": "tiktok",
                "capabilities": ["video", "audio", "subtitles", "hd_watermark_free"]
            },
            {
                "id": "twitter",
                "name": "Twitter / X",
                "domains": ["twitter.com", "x.com", "t.co"],
                "icon": "twitter",
                "capabilities": ["video", "audio", "multiple_resolutions"]
            },
            {
                "id": "instagram",
                "name": "Instagram",
                "domains": ["instagram.com", "instagr.am"],
                "icon": "instagram",
                "capabilities": ["video", "reels", "stories", "audio"]
            },
            {
                "id": "reddit",
                "name": "Reddit",
                "domains": ["reddit.com", "v.redd.it", "redd.it"],
                "icon": "reddit",
                "capabilities": ["video", "audio", "auto_merge"]
            },
            {
                "id": "facebook",
                "name": "Facebook",
                "domains": ["facebook.com", "fb.watch", "fb.com"],
                "icon": "facebook",
                "capabilities": ["video", "reels", "audio"]
            },
            {
                "id": "vimeo",
                "name": "Vimeo",
                "domains": ["vimeo.com", "player.vimeo.com"],
                "icon": "vimeo",
                "capabilities": ["video", "audio", "1080p", "4k"]
            },
            {
                "id": "soundcloud",
                "name": "SoundCloud",
                "domains": ["soundcloud.com", "m.soundcloud.com"],
                "icon": "soundcloud",
                "capabilities": ["audio", "flac", "mp3", "wav", "thumbnails"]
            },
            {
                "id": "dailymotion",
                "name": "Dailymotion",
                "domains": ["dailymotion.com", "dai.ly"],
                "icon": "dailymotion",
                "capabilities": ["video", "audio", "1080p"]
            },
            {
                "id": "bilibili",
                "name": "Bilibili",
                "domains": ["bilibili.com", "b23.tv"],
                "icon": "bilibili",
                "capabilities": ["video", "audio", "danmaku"]
            },
            {
                "id": "bluesky",
                "name": "Bluesky",
                "domains": ["bsky.app", "bsky.social"],
                "icon": "bluesky",
                "capabilities": ["video", "audio", "post_media"]
            },
            {
                "id": "kick",
                "name": "Kick",
                "domains": ["kick.com"],
                "icon": "kick",
                "capabilities": ["video", "vods", "clips"]
            },
            {
                "id": "loom",
                "name": "Loom",
                "domains": ["loom.com"],
                "icon": "loom",
                "capabilities": ["video", "transcription", "audio"]
            },
            {
                "id": "streamable",
                "name": "Streamable",
                "domains": ["streamable.com"],
                "icon": "streamable",
                "capabilities": ["video", "audio"]
            },
            {
                "id": "threads",
                "name": "Threads",
                "domains": ["threads.net"],
                "icon": "threads",
                "capabilities": ["video", "audio"]
            },
            {
                "id": "pinterest",
                "name": "Pinterest",
                "domains": ["pinterest.com", "pin.it"],
                "icon": "pinterest",
                "capabilities": ["video", "image"]
            },
            {
                "id": "snapchat",
                "name": "Snapchat",
                "domains": ["snapchat.com", "story.snapchat.com"],
                "icon": "snapchat",
                "capabilities": ["stories", "spotlight"]
            },
            {
                "id": "vk",
                "name": "VK",
                "domains": ["vk.com", "vkvideo.ru"],
                "icon": "vk",
                "capabilities": ["video", "audio"]
            },
            {
                "id": "okru",
                "name": "OK.ru",
                "domains": ["ok.ru"],
                "icon": "okru",
                "capabilities": ["video", "audio"]
            },
            {
                "id": "rutube",
                "name": "RUTUBE",
                "domains": ["rutube.ru"],
                "icon": "rutube",
                "capabilities": ["video", "audio"]
            },
            {
                "id": "tumblr",
                "name": "Tumblr",
                "domains": ["tumblr.com"],
                "icon": "tumblr",
                "capabilities": ["video", "audio", "gif"]
            },
            {
                "id": "newgrounds",
                "name": "Newgrounds",
                "domains": ["newgrounds.com"],
                "icon": "newgrounds",
                "capabilities": ["audio", "video", "animation"]
            },
            {
                "id": "mastodon",
                "name": "Mastodon",
                "domains": ["mastodon.social", "mstdn.social", "mastodon.online"],
                "icon": "mastodon",
                "capabilities": ["video", "audio"]
            },
            {
                "id": "discord",
                "name": "Discord CDN",
                "domains": ["cdn.discordapp.com", "media.discordapp.net"],
                "icon": "discord",
                "capabilities": ["direct_video", "direct_audio", "attachment"]
            }
        ]

        for s in services_definitions:
            self.register(YtDlpProvider(
                provider_id=s["id"],
                name=s["name"],
                domains=s["domains"],
                icon=s["icon"],
                capabilities=s["capabilities"]
            ))

    def detect_provider(self, url: str) -> Optional[BaseProvider]:
        """
        Detects which provider supports the specified URL.
        Priority: DirectProvider first if file extension matched, then domain matching.
        """
        # 1. First check DirectProvider for direct file formats
        for p in self._providers:
            if isinstance(p, DirectProvider) and p.detect(url):
                return p

        # 2. Check dedicated / platform providers
        for p in self._providers:
            if not isinstance(p, DirectProvider) and p.detect(url):
                return p

        # 3. Fallback: if it's an HTTP/HTTPS link, see if DirectProvider or universal adapter can handle it
        parsed = urlparse(url)
        if parsed.scheme in ("http", "https"):
            # Return DirectProvider as generic web file fallback
            for p in self._providers:
                if isinstance(p, DirectProvider):
                    return p

        return None

    def get_provider_by_id(self, provider_id: str) -> Optional[BaseProvider]:
        for p in self._providers:
            if p.id == provider_id:
                return p
        return None

    def get_all_providers_status(self) -> List[Dict[str, Any]]:
        """Returns provider catalog and operational status for the /providers page."""
        catalog = []
        for p in self._providers:
            catalog.append({
                "id": p.id,
                "name": p.name,
                "icon": p.icon,
                "domains": p.domains,
                "capabilities": p.capabilities,
                "status": p.status,
                "limitations": p.limitations,
            })
        return catalog

# Global singleton
registry = ProviderRegistry()
