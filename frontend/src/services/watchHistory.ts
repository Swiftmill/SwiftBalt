import { WatchHistoryItem } from '../types';

const STORAGE_KEY = 'swiftbalt_watch_history';

export const watchHistoryService = {
  getHistory(): WatchHistoryItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const list: WatchHistoryItem[] = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.sort((a, b) => new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime());
    } catch {
      return [];
    }
  },

  getItem(urlOrStream?: string | null): WatchHistoryItem | undefined {
    if (!urlOrStream) return undefined;
    const history = this.getHistory();
    return history.find(
      (item) =>
        (item.url && item.url === urlOrStream) ||
        (item.stream_url && item.stream_url === urlOrStream) ||
        item.id === urlOrStream
    );
  },

  saveProgress(data: {
    stream_url: string;
    url?: string;
    title?: string;
    thumbnail?: string | null;
    platform?: string;
    duration: number;
    currentTime: number;
  }): void {
    if (!data.stream_url && !data.url) return;
    if (isNaN(data.currentTime) || data.currentTime < 1) return;

    try {
      const history = this.getHistory();
      const id = data.url || data.stream_url;
      const duration = data.duration && !isNaN(data.duration) ? data.duration : 0;
      const isCompleted = duration > 0 && data.currentTime >= duration * 0.95;

      const existingIndex = history.findIndex(
        (item) => (data.url && item.url === data.url) || item.stream_url === data.stream_url || item.id === id
      );

      const existingItem = existingIndex >= 0 ? history[existingIndex] : null;

      const newItem: WatchHistoryItem = {
        id,
        url: data.url || existingItem?.url,
        stream_url: data.stream_url,
        title: data.title || existingItem?.title || 'Vidéo',
        thumbnail: data.thumbnail || existingItem?.thumbnail || null,
        platform: data.platform || existingItem?.platform || 'Web',
        duration: duration || existingItem?.duration || 0,
        currentTime: Math.floor(data.currentTime),
        lastWatched: new Date().toISOString(),
        completed: isCompleted,
      };

      if (existingIndex >= 0) {
        history.splice(existingIndex, 1);
      }
      history.unshift(newItem);

      // Keep up to 100 entries
      if (history.length > 100) {
        history.length = 100;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save watch history:', e);
    }
  },

  deleteItem(id: string): void {
    try {
      const history = this.getHistory().filter((item) => item.id !== id && item.stream_url !== id && item.url !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to delete watch history item:', e);
    }
  },

  clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear watch history:', e);
    }
  },
};

export const formatTimeSeconds = (s?: number): string => {
  if (!s || isNaN(s) || s < 0) return '0:00';
  const total = Math.floor(s);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const formatRelativeTime = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return "À l'instant";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
};
