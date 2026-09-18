import type { MediaMetadata, ProviderStatus, DownloadTask, TorrentTask, DashboardStats } from '../types';

const API_BASE = '/api';

export async function analyzeUrl(url: string): Promise<{ provider: ProviderStatus; metadata: MediaMetadata }> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Échec de l'analyse de l'URL");
  }
  return res.json();
}

export async function startDownload(params: {
  url: string;
  provider_id: string;
  title: string;
  thumbnail_url?: string;
  format_id?: string;
  target_format: string;
  audio_only?: boolean;
}): Promise<{ task_id: string }> {
  const res = await fetch(`${API_BASE}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Échec du démarrage du téléchargement");
  }
  return res.json();
}

export async function getDownloads(): Promise<DownloadTask[]> {
  const res = await fetch(`${API_BASE}/downloads`);
  const data = await res.json();
  return data.downloads;
}

export async function pauseDownload(id: string) {
  await fetch(`${API_BASE}/download/${id}/pause`, { method: 'POST' });
}

export async function resumeDownload(id: string) {
  await fetch(`${API_BASE}/download/${id}/resume`, { method: 'POST' });
}

export async function deleteDownload(id: string) {
  await fetch(`${API_BASE}/download/${id}`, { method: 'DELETE' });
}

export async function getProviders(): Promise<ProviderStatus[]> {
  const res = await fetch(`${API_BASE}/providers`);
  const data = await res.json();
  return data.providers;
}

export async function getTwitchInfo(url: string) {
  const res = await fetch(`${API_BASE}/twitch/info?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Échec de la récupération des détails Twitch");
  }
  const data = await res.json();
  return data.data;
}

export async function addTorrent(source: string) {
  const res = await fetch(`${API_BASE}/torrent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Échec de l'ajout du torrent");
  }
  return res.json();
}

export async function getTorrents(): Promise<TorrentTask[]> {
  const res = await fetch(`${API_BASE}/torrents`);
  const data = await res.json();
  return data.torrents;
}

export async function pauseTorrent(id: string) {
  await fetch(`${API_BASE}/torrent/${id}/pause`, { method: 'POST' });
}

export async function resumeTorrent(id: string) {
  await fetch(`${API_BASE}/torrent/${id}/resume`, { method: 'POST' });
}

export async function deleteTorrent(id: string) {
  await fetch(`${API_BASE}/torrent/${id}`, { method: 'DELETE' });
}

export async function getHistory() {
  const res = await fetch(`${API_BASE}/history`);
  const data = await res.json();
  return data.history;
}

export async function clearHistory() {
  await fetch(`${API_BASE}/history`, { method: 'DELETE' });
}

export async function getFavorites() {
  const res = await fetch(`${API_BASE}/favorites`);
  const data = await res.json();
  return data.favorites;
}

export async function addFavorite(item: any) {
  await fetch(`${API_BASE}/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
}

export async function deleteFavorite(id: string) {
  await fetch(`${API_BASE}/favorites/${id}`, { method: 'DELETE' });
}

export async function getStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/stats`);
  return res.json();
}

export async function getSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  return res.json();
}
