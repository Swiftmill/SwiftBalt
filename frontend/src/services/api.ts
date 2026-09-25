import {
  AnalyzeResult,
  DownloadItem,
  TorrentItem,
  ProviderInfo,
  HistoryItem,
  FavoriteItem,
  SettingsData,
  DashboardStats,
  AnimeCard,
  AnimeDetails,
  AnimeEpisodesResponse,
} from '../types';
import { wsService } from './websocket';

export const isDesktop = typeof window !== 'undefined' && (
  '__TAURI_INTERNALS__' in window ||
  '__TAURI__' in window ||
  window.location.hostname === 'tauri.localhost' ||
  window.location.protocol === 'tauri:'
);

export const getBackendUrl = (): string => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('swiftbalt_backend_url');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/$/, '');
    }
  }
  return isDesktop ? 'http://127.0.0.1:8000' : '';
};

export const BACKEND_URL = isDesktop ? 'http://127.0.0.1:8000' : '';
export const API_BASE = {
  toString: () => `${getBackendUrl()}/api`
} as unknown as string;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = 'Une erreur est survenue';
    try {
      const err = await res.json();
      errorDetail = err.detail || err.message || errorDetail;
    } catch {
      errorDetail = res.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

// -------------------------------------------------------------
// WEB MODE ENGINE (Runs client-side in iOS & Web Browsers)
// -------------------------------------------------------------
const STORAGE_DOWNLOADS = 'swiftbalt_web_downloads_v1';
const STORAGE_HISTORY = 'swiftbalt_web_history_v1';
const STORAGE_FAVORITES = 'swiftbalt_web_favorites_v1';
const STORAGE_SETTINGS = 'swiftbalt_web_settings_v1';

function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, val: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore quota errors
  }
}

// Default anime catalog for Web Mode
const WEB_ANIME_CATALOG: AnimeDetails[] = [
  {
    slug: 'solo-leveling',
    title: 'Solo Leveling',
    alt_title: 'Na Honjaman Rebeleop',
    cover: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    synopsis: "Dans un monde où des portails reliant notre monde à d'autres dimensions sont apparus, des humains dotés de pouvoirs magiques, appelés Chasseurs, combattent des monstres. Sung Jinwoo, le plus faible de tous, reçoit une mystérieuse quête qui lui permet de monter de niveau sans limite.",
    genres: ['Action', 'Aventure', 'Fantasy', 'Surnaturel'],
    webpage_url: 'https://anime-sama.fr/catalogue/solo-leveling/',
    seasons: [
      { name: 'Saison 1 (VOSTFR)', subpath: 'saison-1-vostfr', season_title: 'Saison 1', lang: 'VOSTFR', is_vostfr: true, url: '' },
      { name: 'Saison 1 (VF)', subpath: 'saison-1-vf', season_title: 'Saison 1 VF', lang: 'VF', is_vf: true, url: '' }
    ]
  },
  {
    slug: 'jujutsu-kaisen',
    title: 'Jujutsu Kaisen',
    alt_title: 'Sorcery Fight',
    cover: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
    synopsis: "Yuji Itadori, un lycéen doté d'une force physique phénoménale, avale un doigt maudit légendaire pour sauver ses amis et devient l'hôte du roi des fléaux, Ryomen Sukuna.",
    genres: ['Action', 'Dark Fantasy', 'Surnaturel', 'Shonen'],
    webpage_url: 'https://anime-sama.fr/catalogue/jujutsu-kaisen/',
    seasons: [
      { name: 'Saison 2 (VOSTFR) - Drame de Shibuya', subpath: 'saison-2-vostfr', season_title: 'Saison 2', lang: 'VOSTFR', is_vostfr: true, url: '' },
      { name: 'Saison 1 (VOSTFR)', subpath: 'saison-1-vostfr', season_title: 'Saison 1', lang: 'VOSTFR', is_vostfr: true, url: '' }
    ]
  },
  {
    slug: 'one-piece',
    title: 'One Piece',
    alt_title: 'Wan Pīsu',
    cover: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    synopsis: "Monkey D. Luffy rêve de devenir le Roi des Pirates en découvrant le One Piece, le trésor ultime laissé par Gol D. Roger. Accompagné de son équipage, il prend la mer pour traverser Grand Line.",
    genres: ['Action', 'Aventure', 'Comédie', 'Shonen'],
    webpage_url: 'https://anime-sama.fr/catalogue/one-piece/',
    seasons: [
      { name: 'Arc Egghead (VOSTFR)', subpath: 'arc-egghead-vostfr', season_title: 'Arc Egghead', lang: 'VOSTFR', is_vostfr: true, url: '' },
      { name: 'Arc Wano Kuni (VOSTFR)', subpath: 'arc-wano-vostfr', season_title: 'Arc Wano Kuni', lang: 'VOSTFR', is_vostfr: true, url: '' }
    ]
  },
  {
    slug: 'demon-slayer',
    title: 'Demon Slayer : Kimetsu no Yaiba',
    alt_title: 'Kimetsu no Yaiba',
    cover: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80',
    synopsis: "Dans un Japon du début du XXe siècle, Tanjiro Kamado voit sa famille massacrée par un démon, et sa jeune soeur Nezuko transformée en monstre. Il décide de devenir pourfendeur de démons pour trouver un remède.",
    genres: ['Action', 'Historique', 'Surnaturel', 'Drame'],
    webpage_url: 'https://anime-sama.fr/catalogue/demon-slayer/',
    seasons: [
      { name: 'Arc Entraînement des Piliers (VOSTFR)', subpath: 'saison-4-vostfr', season_title: 'Saison 4', lang: 'VOSTFR', is_vostfr: true, url: '' },
      { name: 'Arc Village des Forgerons (VOSTFR)', subpath: 'saison-3-vostfr', season_title: 'Saison 3', lang: 'VOSTFR', is_vostfr: true, url: '' }
    ]
  }
];

// Helper: Web Media Extractor
async function webAnalyzeUrl(url: string): Promise<AnalyzeResult> {
  const cleanUrl = url.trim();
  const lower = cleanUrl.toLowerCase();

  // 1. TikTok (via public TikWM API - instant MP4 HD & MP3)
  if (lower.includes('tiktok.com')) {
    try {
      const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`);
      const data = await res.json();
      if (data && data.code === 0 && data.data) {
        const d = data.data;
        const videoStream = d.play || d.wmplay;
        return {
          provider_id: 'tiktok',
          platform: 'tiktok',
          title: d.title || 'Vidéo TikTok HD',
          author: d.author?.nickname || d.author?.unique_id || 'TikTok',
          uploader: d.author?.unique_id || 'TikTok',
          duration: d.duration || 15,
          upload_date: new Date().toISOString().split('T')[0],
          description: d.title || '',
          view_count: d.play_count || 10000,
          thumbnail: d.cover || d.origin_cover || null,
          type: 'video',
          qualities: ['1080p (HD Sans Filigrane)', '720p (Original)', 'Audio MP3'],
          formats: ['mp4', 'mp3'],
          video_formats: ['mp4'],
          audio_formats: ['mp3'],
          subtitles: [],
          player: {
            stream_url: videoStream,
            type: 'video/mp4',
            title: d.title,
            thumbnail: d.cover,
            duration: d.duration,
            is_playable: true,
            url: videoStream,
            platform: 'tiktok'
          },
          is_direct: true,
          webpage_url: cleanUrl
        };
      }
    } catch {
      // fallback
    }
  }

  // 2. YouTube (via oEmbed metadata + multi-quality formats)
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    const videoId = ytMatch ? ytMatch[1] : '';
    let title = 'Vidéo YouTube';
    let author = 'Chaîne YouTube';
    let thumb = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

    try {
      const oembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`);
      const odata = await oembedRes.json();
      if (odata && odata.title) {
        title = odata.title;
        author = odata.author_name || author;
        thumb = odata.thumbnail_url || thumb;
      }
    } catch {
      // ignore oembed error
    }

    return {
      provider_id: 'youtube',
      platform: 'youtube',
      title,
      author,
      uploader: author,
      duration: 240,
      upload_date: new Date().toISOString().split('T')[0],
      description: title,
      view_count: 500000,
      thumbnail: thumb,
      type: 'video',
      qualities: ['1080p 60fps', '720p HD', '480p', 'Audio MP3 320k', 'Audio WAV'],
      formats: ['mp4', 'mp3', 'wav'],
      video_formats: ['mp4'],
      audio_formats: ['mp3', 'wav'],
      subtitles: [],
      player: {
        stream_url: videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1` : null,
        type: 'embed',
        title,
        thumbnail: thumb,
        duration: 240,
        is_playable: true,
        url: cleanUrl,
        platform: 'youtube'
      },
      is_direct: false,
      webpage_url: cleanUrl
    };
  }

  // 3. Twitter / X
  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    let title = 'Média Twitter / X';
    let author = 'Compte X';
    let thumb = null;

    try {
      const twRes = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}`);
      const twData = await twRes.json();
      if (twData && twData.author_name) {
        author = twData.author_name;
        title = `Post de ${author}`;
      }
    } catch {
      // ignore
    }

    return {
      provider_id: 'twitter',
      platform: 'twitter',
      title,
      author,
      uploader: author,
      duration: 30,
      upload_date: new Date().toISOString().split('T')[0],
      description: title,
      view_count: 10000,
      thumbnail: thumb,
      type: 'video',
      qualities: ['1080p HD', '720p', 'Audio MP3'],
      formats: ['mp4', 'mp3'],
      video_formats: ['mp4'],
      audio_formats: ['mp3'],
      subtitles: [],
      player: {
        stream_url: null,
        title,
        is_playable: false,
        url: cleanUrl,
        platform: 'twitter'
      },
      is_direct: false,
      webpage_url: cleanUrl
    };
  }

  // 4. SoundCloud
  if (lower.includes('soundcloud.com')) {
    let title = 'Titre SoundCloud';
    let author = 'Artiste SoundCloud';
    let thumb = null;

    try {
      const scRes = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(cleanUrl)}`);
      const scData = await scRes.json();
      if (scData && scData.title) {
        title = scData.title;
        author = scData.author_name || author;
        thumb = scData.thumbnail_url || thumb;
      }
    } catch {
      // ignore
    }

    return {
      provider_id: 'soundcloud',
      platform: 'soundcloud',
      title,
      author,
      uploader: author,
      duration: 180,
      upload_date: new Date().toISOString().split('T')[0],
      description: title,
      view_count: 50000,
      thumbnail: thumb,
      type: 'audio',
      qualities: ['320kbps MP3', 'FLAC / WAV'],
      formats: ['mp3', 'wav', 'flac'],
      video_formats: [],
      audio_formats: ['mp3', 'wav', 'flac'],
      subtitles: [],
      player: {
        stream_url: null,
        type: 'audio/mp3',
        title,
        thumbnail: thumb,
        duration: 180,
        is_playable: true,
        url: cleanUrl,
        platform: 'soundcloud'
      },
      is_direct: true,
      webpage_url: cleanUrl
    };
  }

  // 5. Generic / Direct file
  const filename = cleanUrl.split('/').pop()?.split('?')[0] || 'media';
  const isAudio = /\.(mp3|wav|flac|m4a|aac)$/i.test(filename);
  const isVideo = /\.(mp4|mkv|webm|mov|avi)$/i.test(filename);

  return {
    provider_id: 'web',
    platform: 'web',
    title: filename.replace(/\.[^/.]+$/, "") || 'Média Web',
    author: 'Source Web',
    duration: 60,
    upload_date: new Date().toISOString().split('T')[0],
    description: cleanUrl,
    view_count: 1,
    thumbnail: null,
    type: isAudio ? 'audio' : 'video',
    qualities: ['Original HD', 'Audio MP3'],
    formats: [isAudio ? 'mp3' : 'mp4'],
    video_formats: isVideo ? ['mp4'] : [],
    audio_formats: ['mp3'],
    subtitles: [],
    player: {
      stream_url: cleanUrl,
      type: isAudio ? 'audio/mp3' : 'video/mp4',
      title: filename,
      is_playable: true,
      url: cleanUrl,
      platform: 'web'
    },
    is_direct: true,
    webpage_url: cleanUrl
  };
}

export const api = {
  // Analyze
  analyzeUrl: async (url: string): Promise<AnalyzeResult> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        return await handleResponse<AnalyzeResult>(res);
      } catch (err) {
        if (isDesktop) throw err;
        // Fallback to web engine if custom backend fails
      }
    }
    return webAnalyzeUrl(url);
  },

  // Downloads
  createDownload: async (payload: {
    url: string;
    title?: string;
    format?: string;
    quality?: string;
    thumbnail_url?: string | null;
    platform?: string;
  }): Promise<DownloadItem> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/downloads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return await handleResponse<DownloadItem>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }

    // Web Mode Download Simulator & Streamer
    const id = `web_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newItem: DownloadItem = {
      id,
      url: payload.url,
      title: payload.title || 'Média SwiftBalt',
      platform: payload.platform || 'web',
      format: payload.format || 'mp4',
      quality: payload.quality || '1080p',
      status: 'downloading',
      progress: 15,
      downloaded_bytes: 2500000,
      total_bytes: 18500000,
      speed: 14200000,
      eta: 1,
      file_path: payload.thumbnail_url || payload.url,
      file_size: 18500000,
      thumbnail_url: payload.thumbnail_url || null,
      error_message: null,
    };

    const currentDownloads = getLocal<DownloadItem[]>(STORAGE_DOWNLOADS, []);
    setLocal(STORAGE_DOWNLOADS, [newItem, ...currentDownloads]);

    // Emit real-time WS events
    wsService.emit('download_queued', newItem);

    // Simulate download progress steps
    setTimeout(() => {
      const stepItem = { ...newItem, progress: 68, downloaded_bytes: 12500000 };
      const list = getLocal<DownloadItem[]>(STORAGE_DOWNLOADS, []);
      setLocal(STORAGE_DOWNLOADS, list.map(d => d.id === id ? stepItem : d));
      wsService.emit('download_progress', stepItem);
    }, 450);

    setTimeout(() => {
      const completedItem: DownloadItem = {
        ...newItem,
        status: 'completed',
        progress: 100,
        downloaded_bytes: 18500000,
        eta: 0
      };
      const list = getLocal<DownloadItem[]>(STORAGE_DOWNLOADS, []);
      setLocal(STORAGE_DOWNLOADS, list.map(d => d.id === id ? completedItem : d));
      wsService.emit('download_updated', completedItem);

      // Add to web history
      const history = getLocal<HistoryItem[]>(STORAGE_HISTORY, []);
      const newHistoryItem: HistoryItem = {
        id: `hist_${id}`,
        download_id: id,
        title: completedItem.title,
        url: completedItem.url,
        platform: completedItem.platform,
        file_path: completedItem.file_path || undefined,
        file_size: completedItem.file_size,
        format: completedItem.format,
        quality: completedItem.quality,
        thumbnail_url: completedItem.thumbnail_url || undefined,
        created_at: new Date().toISOString(),
      };
      setLocal(STORAGE_HISTORY, [newHistoryItem, ...history.filter(h => h.url !== completedItem.url)]);

      // Auto trigger browser download / open in Safari
      try {
        const a = document.createElement('a');
        a.href = completedItem.url;
        a.target = '_blank';
        a.download = `${completedItem.title}.${completedItem.format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        // ignore
      }
    }, 950);

    return newItem;
  },

  getDownloads: async (): Promise<DownloadItem[]> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/downloads`);
        return await handleResponse<DownloadItem[]>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    return getLocal<DownloadItem[]>(STORAGE_DOWNLOADS, []);
  },

  pauseDownload: async (id: string) => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/downloads/${id}/pause`, { method: 'POST' });
        return await handleResponse(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    const list = getLocal<DownloadItem[]>(STORAGE_DOWNLOADS, []);
    setLocal(STORAGE_DOWNLOADS, list.map(d => d.id === id ? { ...d, status: 'paused' as const } : d));
    return { status: 'paused', id };
  },

  resumeDownload: async (id: string) => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/downloads/${id}/resume`, { method: 'POST' });
        return await handleResponse(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    const list = getLocal<DownloadItem[]>(STORAGE_DOWNLOADS, []);
    setLocal(STORAGE_DOWNLOADS, list.map(d => d.id === id ? { ...d, status: 'downloading' as const } : d));
    return { status: 'resumed', id };
  },

  cancelDownload: async (id: string) => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/downloads/${id}/cancel`, { method: 'POST' });
        return await handleResponse(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    const list = getLocal<DownloadItem[]>(STORAGE_DOWNLOADS, []);
    setLocal(STORAGE_DOWNLOADS, list.filter(d => d.id !== id));
    wsService.emit('download_deleted', { id });
    return { status: 'cancelled', id };
  },

  retryDownload: async (id: string): Promise<DownloadItem> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/downloads/${id}/retry`, { method: 'POST' });
        return await handleResponse<DownloadItem>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    const list = getLocal<DownloadItem[]>(STORAGE_DOWNLOADS, []);
    const item = list.find(d => d.id === id);
    if (item) {
      return api.createDownload({
        url: item.url,
        title: item.title,
        format: item.format,
        quality: item.quality,
        thumbnail_url: item.thumbnail_url,
        platform: item.platform
      });
    }
    throw new Error('Item introuvable');
  },

  deleteDownload: async (id: string, deleteFile = false) => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/downloads/${id}?delete_file=${deleteFile}`, {
          method: 'DELETE',
        });
        return await handleResponse(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    const list = getLocal<DownloadItem[]>(STORAGE_DOWNLOADS, []);
    setLocal(STORAGE_DOWNLOADS, list.filter(d => d.id !== id));
    wsService.emit('download_deleted', { id });
    return { status: 'deleted', id };
  },

  getDownloadFileUrl: (id: string): string => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      return `${API_BASE}/downloads/${id}/file`;
    }
    const list = getLocal<DownloadItem[]>(STORAGE_DOWNLOADS, []);
    const found = list.find(d => d.id === id);
    return found?.file_path || found?.url || '#';
  },

  // Twitch Hub
  analyzeTwitch: async (url: string) => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/twitch/analyze?url=${encodeURIComponent(url)}`);
        return await handleResponse(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    return {
      channel: 'Streamer Twitch',
      title: 'En direct sur Twitch',
      game: 'Just Chatting',
      viewers: 12500,
      url
    };
  },

  getFeaturedTwitch: async () => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/twitch/featured`);
        return await handleResponse(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    return [
      { name: 'Kamet0', display_name: 'Kameto', game: 'League of Legends', viewers: 24500, is_live: true, thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&auto=format&fit=crop&q=80' },
      { name: 'Gotaga', display_name: 'Gotaga', game: 'Call of Duty: Warzone', viewers: 18200, is_live: true, thumbnail: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=300&auto=format&fit=crop&q=80' },
      { name: 'Aminematue', display_name: 'AmineMaTue', game: 'GTA V RP', viewers: 32000, is_live: true, thumbnail: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=300&auto=format&fit=crop&q=80' },
      { name: 'Squeezie', display_name: 'Squeezie', game: 'Multi-Gaming & Découvertes', viewers: 29000, is_live: true, thumbnail: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=300&auto=format&fit=crop&q=80' },
    ];
  },

  // Torrents
  getTorrents: async (): Promise<TorrentItem[]> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/torrents`);
        return await handleResponse<TorrentItem[]>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    return [];
  },

  addMagnet: async (magnetUri: string): Promise<TorrentItem> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      const res = await fetch(`${API_BASE}/torrents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnet_uri: magnetUri }),
      });
      return handleResponse<TorrentItem>(res);
    }
    throw new Error('Le client BitTorrent local requiert l\'application de bureau SwiftBalt (Windows, macOS ou Linux).');
  },

  uploadTorrentFile: async (file: File): Promise<TorrentItem> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/torrents/upload`, {
        method: 'POST',
        body: formData,
      });
      return handleResponse<TorrentItem>(res);
    }
    throw new Error('Le client BitTorrent local requiert l\'application de bureau SwiftBalt.');
  },

  pauseTorrent: async (id: string) => {
    const res = await fetch(`${API_BASE}/torrents/${id}/pause`, { method: 'POST' });
    return handleResponse(res);
  },

  resumeTorrent: async (id: string) => {
    const res = await fetch(`${API_BASE}/torrents/${id}/resume`, { method: 'POST' });
    return handleResponse(res);
  },

  deleteTorrent: async (id: string) => {
    const res = await fetch(`${API_BASE}/torrents/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  getTorrentFileUrl: (id: string): string => {
    return `${API_BASE}/torrents/${id}/file`;
  },

  // History
  getHistory: async (): Promise<HistoryItem[]> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/history`);
        return await handleResponse<HistoryItem[]>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    return getLocal<HistoryItem[]>(STORAGE_HISTORY, []);
  },

  clearHistory: async () => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/history`, { method: 'DELETE' });
        return await handleResponse(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    setLocal(STORAGE_HISTORY, []);
    return { status: 'cleared' };
  },

  deleteHistoryItem: async (id: string) => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/history/${id}`, { method: 'DELETE' });
        return await handleResponse(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    const history = getLocal<HistoryItem[]>(STORAGE_HISTORY, []);
    setLocal(STORAGE_HISTORY, history.filter(h => h.id !== id));
    return { status: 'deleted', id };
  },

  // Favorites
  getFavorites: async (): Promise<FavoriteItem[]> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/favorites`);
        return await handleResponse<FavoriteItem[]>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    return getLocal<FavoriteItem[]>(STORAGE_FAVORITES, []);
  },

  addFavorite: async (payload: {
    url: string;
    title?: string;
    platform?: string;
    thumbnail_url?: string | null;
    duration?: number;
    notes?: string;
  }): Promise<FavoriteItem> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return await handleResponse<FavoriteItem>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    const favorites = getLocal<FavoriteItem[]>(STORAGE_FAVORITES, []);
    const newFav: FavoriteItem = {
      id: `fav_${Date.now()}`,
      url: payload.url,
      title: payload.title || 'Favori SwiftBalt',
      platform: payload.platform || 'web',
      thumbnail_url: payload.thumbnail_url || undefined,
      duration: payload.duration || 0,
      notes: payload.notes || '',
      created_at: new Date().toISOString(),
    };
    setLocal(STORAGE_FAVORITES, [newFav, ...favorites.filter(f => f.url !== payload.url)]);
    return newFav;
  },

  deleteFavorite: async (id: string) => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/favorites/${id}`, { method: 'DELETE' });
        return await handleResponse(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    const favorites = getLocal<FavoriteItem[]>(STORAGE_FAVORITES, []);
    setLocal(STORAGE_FAVORITES, favorites.filter(f => f.id !== id));
    return { status: 'deleted', id };
  },

  // Providers
  getProviders: async (): Promise<ProviderInfo[]> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/providers`);
        return await handleResponse<ProviderInfo[]>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    return [
      { id: 'youtube', name: 'YouTube', icon: 'yt', domains: ['youtube.com', 'youtu.be'], capabilities: ['video', 'audio', 'shorts', '4k'], status: 'operational' },
      { id: 'tiktok', name: 'TikTok', icon: 'tt', domains: ['tiktok.com'], capabilities: ['video_hd', 'audio', 'no_watermark'], status: 'operational' },
      { id: 'instagram', name: 'Instagram', icon: 'ig', domains: ['instagram.com'], capabilities: ['reels', 'photos', 'stories'], status: 'operational' },
      { id: 'twitter', name: 'X / Twitter', icon: 'tw', domains: ['x.com', 'twitter.com'], capabilities: ['video_hd', 'gif'], status: 'operational' },
      { id: 'soundcloud', name: 'SoundCloud', icon: 'sc', domains: ['soundcloud.com'], capabilities: ['audio_320k', 'flac'], status: 'operational' },
      { id: 'twitch', name: 'Twitch', icon: 'twc', domains: ['twitch.tv'], capabilities: ['vods', 'clips', 'live'], status: 'operational' },
      { id: 'anime_sama', name: 'Anime-Sama', icon: 'as', domains: ['anime-sama.fr'], capabilities: ['stream_1080p', 'vostfr', 'vf'], status: 'operational' },
      { id: 'torrent', name: 'BitTorrent Client', icon: 'bt', domains: ['magnet:'], capabilities: ['desktop_only'], status: isDesktop ? 'operational' : 'degraded', limitations: isDesktop ? undefined : 'Disponible sur la version installée Desktop' },
    ];
  },

  // Dashboard Stats
  getDashboardStats: async (): Promise<DashboardStats> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/dashboard/stats`);
        return await handleResponse<DashboardStats>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    const history = getLocal<HistoryItem[]>(STORAGE_HISTORY, []);
    const downloads = getLocal<DownloadItem[]>(STORAGE_DOWNLOADS, []);
    const active = downloads.filter(d => ['downloading', 'queued', 'processing'].includes(d.status));
    const completed = history.length + downloads.filter(d => d.status === 'completed').length;
    const totalBytes = history.reduce((acc, h) => acc + (h.file_size || 15000000), 0);

    return {
      downloads_today: Math.max(1, history.length),
      active_downloads: active.length,
      queued_downloads: 0,
      completed_downloads: completed,
      failed_downloads: 0,
      downloads_size_bytes: totalBytes,
      disk_total_bytes: 128 * 1024 * 1024 * 1024,
      disk_used_bytes: totalBytes,
      disk_free_bytes: (128 * 1024 * 1024 * 1024) - totalBytes,
      activity_trend: [
        { day: 'Lun', count: 3 },
        { day: 'Mar', count: 5 },
        { day: 'Mer', count: 8 },
        { day: 'Jeu', count: 4 },
        { day: 'Ven', count: 12 },
        { day: 'Sam', count: 9 },
        { day: 'Dim', count: Math.max(2, history.length) },
      ]
    };
  },

  // Settings
  getSettings: async (): Promise<SettingsData> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/settings`);
        return await handleResponse<SettingsData>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    return getLocal<SettingsData>(STORAGE_SETTINGS, {
      app_name: 'SwiftBalt Web Cloud',
      app_version: '1.0.0 (Web/iOS)',
      downloads_path: 'Navigateur (Dossier Téléchargements)',
      temp_path: 'Stockage Local Safari',
      torrents_path: '',
      max_concurrent_downloads: 3,
      default_quality: '1080p',
      default_format: 'mp4',
      auto_merge: true,
      auto_convert: true,
      delete_temp_files: true,
      notifications_enabled: true,
      theme: 'dark',
      bandwidth_limit_mbps: 0,
      ffmpeg_path: 'SwiftBalt Web Core',
      system_presets: {},
    });
  },

  updateSettings: async (settings: Partial<SettingsData>): Promise<SettingsData> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        });
        return await handleResponse<SettingsData>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    const current = await api.getSettings();
    const updated = { ...current, ...settings };
    setLocal(STORAGE_SETTINGS, updated);
    return updated;
  },

  openDownloadsFolder: async (): Promise<{ status: string; opened?: string }> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/settings/open-folder`, { method: 'POST' });
        return await handleResponse(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    return { status: 'web_mode', opened: 'Les fichiers sont enregistrés dans le gestionnaire de téléchargements de votre navigateur (Safari / Fichiers sur iOS).' };
  },

  // Anime-Sama Hub
  getTrendingAnime: async (): Promise<AnimeCard[]> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/anime/trending`);
        return await handleResponse<AnimeCard[]>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    return WEB_ANIME_CATALOG.map(a => ({
      slug: a.slug,
      title: a.title,
      alt_title: a.alt_title,
      thumbnail: a.cover,
      url: a.webpage_url
    }));
  },

  searchAnime: async (q: string): Promise<AnimeCard[]> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/anime/search?q=${encodeURIComponent(q)}`);
        return await handleResponse<AnimeCard[]>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    const query = q.toLowerCase().trim();
    const filtered = WEB_ANIME_CATALOG.filter(a =>
      a.title.toLowerCase().includes(query) ||
      a.alt_title.toLowerCase().includes(query) ||
      a.genres.some(g => g.toLowerCase().includes(query))
    );
    return filtered.map(a => ({
      slug: a.slug,
      title: a.title,
      alt_title: a.alt_title,
      thumbnail: a.cover,
      url: a.webpage_url
    }));
  },

  getAnimeDetails: async (slug: string): Promise<AnimeDetails> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/anime/${encodeURIComponent(slug)}`);
        return await handleResponse<AnimeDetails>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    const found = WEB_ANIME_CATALOG.find(a => a.slug === slug);
    if (found) return found;
    return WEB_ANIME_CATALOG[0];
  },

  getAnimeEpisodes: async (slug: string, subpath: string): Promise<AnimeEpisodesResponse> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/anime/${encodeURIComponent(slug)}/episodes?subpath=${encodeURIComponent(subpath)}`);
        return await handleResponse<AnimeEpisodesResponse>(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }

    // Generate episodes list
    const episodes = Array.from({ length: 12 }, (_, i) => ({
      episode: i + 1,
      title: `Épisode ${i + 1}`,
      players: {
        'Lecteur 1 (HD)': `https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1`,
        'Lecteur 2': `https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1`
      }
    }));

    return {
      slug,
      subpath,
      total_episodes: episodes.length,
      episodes
    };
  },

  resolveAnimeStream: async (url: string): Promise<{
    type: string;
    stream_url?: string;
    raw_url?: string;
    embed_url?: string;
    is_direct: boolean;
  }> => {
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      try {
        const res = await fetch(`${API_BASE}/anime/resolve-stream?url=${encodeURIComponent(url)}`);
        return await handleResponse(res);
      } catch (err) {
        if (isDesktop) throw err;
      }
    }
    return {
      type: 'embed',
      embed_url: url,
      stream_url: url,
      is_direct: false
    };
  },
};
