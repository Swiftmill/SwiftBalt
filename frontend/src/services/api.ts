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

const isDesktop = typeof window !== 'undefined' && (
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

export const api = {
  // Analyze
  analyzeUrl: async (url: string): Promise<AnalyzeResult> => {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return handleResponse<AnalyzeResult>(res);
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
    const res = await fetch(`${API_BASE}/downloads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<DownloadItem>(res);
  },

  getDownloads: async (): Promise<DownloadItem[]> => {
    const res = await fetch(`${API_BASE}/downloads`);
    return handleResponse<DownloadItem[]>(res);
  },

  pauseDownload: async (id: string) => {
    const res = await fetch(`${API_BASE}/downloads/${id}/pause`, { method: 'POST' });
    return handleResponse(res);
  },

  resumeDownload: async (id: string) => {
    const res = await fetch(`${API_BASE}/downloads/${id}/resume`, { method: 'POST' });
    return handleResponse(res);
  },

  cancelDownload: async (id: string) => {
    const res = await fetch(`${API_BASE}/downloads/${id}/cancel`, { method: 'POST' });
    return handleResponse(res);
  },

  retryDownload: async (id: string): Promise<DownloadItem> => {
    const res = await fetch(`${API_BASE}/downloads/${id}/retry`, { method: 'POST' });
    return handleResponse<DownloadItem>(res);
  },

  deleteDownload: async (id: string, deleteFile = false) => {
    const res = await fetch(`${API_BASE}/downloads/${id}?delete_file=${deleteFile}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  getDownloadFileUrl: (id: string): string => {
    return `${API_BASE}/downloads/${id}/file`;
  },

  // Twitch Hub
  analyzeTwitch: async (url: string) => {
    const res = await fetch(`${API_BASE}/twitch/analyze?url=${encodeURIComponent(url)}`);
    return handleResponse(res);
  },

  getFeaturedTwitch: async () => {
    const res = await fetch(`${API_BASE}/twitch/featured`);
    return handleResponse(res);
  },

  // Torrents
  getTorrents: async (): Promise<TorrentItem[]> => {
    const res = await fetch(`${API_BASE}/torrents`);
    return handleResponse<TorrentItem[]>(res);
  },

  addMagnet: async (magnetUri: string): Promise<TorrentItem> => {
    const res = await fetch(`${API_BASE}/torrents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ magnet_uri: magnetUri }),
    });
    return handleResponse<TorrentItem>(res);
  },

  uploadTorrentFile: async (file: File): Promise<TorrentItem> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/torrents/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<TorrentItem>(res);
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
    const res = await fetch(`${API_BASE}/history`);
    return handleResponse<HistoryItem[]>(res);
  },

  clearHistory: async () => {
    const res = await fetch(`${API_BASE}/history`, { method: 'DELETE' });
    return handleResponse(res);
  },

  deleteHistoryItem: async (id: string) => {
    const res = await fetch(`${API_BASE}/history/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  // Favorites
  getFavorites: async (): Promise<FavoriteItem[]> => {
    const res = await fetch(`${API_BASE}/favorites`);
    return handleResponse<FavoriteItem[]>(res);
  },

  addFavorite: async (payload: {
    url: string;
    title?: string;
    platform?: string;
    thumbnail_url?: string | null;
    duration?: number;
    notes?: string;
  }): Promise<FavoriteItem> => {
    const res = await fetch(`${API_BASE}/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<FavoriteItem>(res);
  },

  deleteFavorite: async (id: string) => {
    const res = await fetch(`${API_BASE}/favorites/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  // Providers
  getProviders: async (): Promise<ProviderInfo[]> => {
    const res = await fetch(`${API_BASE}/providers`);
    return handleResponse<ProviderInfo[]>(res);
  },

  // Dashboard Stats
  getDashboardStats: async (): Promise<DashboardStats> => {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    return handleResponse<DashboardStats>(res);
  },

  // Settings
  getSettings: async (): Promise<SettingsData> => {
    const res = await fetch(`${API_BASE}/settings`);
    return handleResponse<SettingsData>(res);
  },

  updateSettings: async (settings: Partial<SettingsData>): Promise<SettingsData> => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return handleResponse<SettingsData>(res);
  },

  openDownloadsFolder: async (): Promise<{ status: string; opened?: string }> => {
    const res = await fetch(`${API_BASE}/settings/open-folder`, {
      method: 'POST',
    });
    return handleResponse(res);
  },

  // Anime-Sama Hub
  getTrendingAnime: async (): Promise<AnimeCard[]> => {
    const res = await fetch(`${API_BASE}/anime/trending`);
    return handleResponse<AnimeCard[]>(res);
  },

  searchAnime: async (q: string): Promise<AnimeCard[]> => {
    const res = await fetch(`${API_BASE}/anime/search?q=${encodeURIComponent(q)}`);
    return handleResponse<AnimeCard[]>(res);
  },

  getAnimeDetails: async (slug: string): Promise<AnimeDetails> => {
    const res = await fetch(`${API_BASE}/anime/${encodeURIComponent(slug)}`);
    return handleResponse<AnimeDetails>(res);
  },

  getAnimeEpisodes: async (slug: string, subpath: string): Promise<AnimeEpisodesResponse> => {
    const res = await fetch(`${API_BASE}/anime/${encodeURIComponent(slug)}/episodes?subpath=${encodeURIComponent(subpath)}`);
    return handleResponse<AnimeEpisodesResponse>(res);
  },

  resolveAnimeStream: async (url: string): Promise<{
    type: string;
    stream_url?: string;
    raw_url?: string;
    embed_url?: string;
    is_direct: boolean;
  }> => {
    const res = await fetch(`${API_BASE}/anime/resolve-stream?url=${encodeURIComponent(url)}`);
    return handleResponse(res);
  },
};
