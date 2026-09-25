export interface SubtitleTrack {
  lang: string;
  ext: string;
  url: string;
}

export interface PlayerInfo {
  stream_url?: string | null;
  type?: string;
  title?: string;
  thumbnail?: string | null;
  duration?: number;
  subtitles?: SubtitleTrack[];
  is_playable?: boolean;
  url?: string;
  platform?: string;
  initial_time?: number;
}

export interface WatchHistoryItem {
  id: string;
  url?: string;
  stream_url: string;
  title: string;
  thumbnail?: string | null;
  platform?: string;
  duration: number;
  currentTime: number;
  lastWatched: string;
  completed?: boolean;
}

export interface AnalyzeResult {
  provider_id: string;
  platform: string;
  title: string;
  author: string;
  uploader?: string;
  duration: number;
  upload_date: string;
  description: string;
  view_count: number;
  thumbnail?: string | null;
  fps?: number;
  video_codec?: string;
  audio_codec?: string;
  file_size?: number;
  type: 'video' | 'audio' | 'file';
  qualities: string[];
  formats: string[];
  video_formats?: string[];
  audio_formats?: string[];
  subtitles: SubtitleTrack[];
  player: PlayerInfo;
  is_direct: boolean;
  webpage_url: string;
}

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  platform: string;
  format: string;
  quality: string;
  status: 'queued' | 'processing' | 'downloading' | 'merging' | 'converting' | 'completed' | 'paused' | 'failed' | 'cancelled';
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
  speed: number;
  eta: number;
  file_path?: string | null;
  file_size: number;
  thumbnail_url?: string | null;
  error_message?: string | null;
}

export interface TorrentItem {
  id: string;
  name: string;
  magnet_uri?: string;
  status: 'downloading' | 'paused' | 'completed' | 'error';
  progress: number;
  total_size: number;
  downloaded_size: number;
  upload_size: number;
  download_speed: number;
  upload_speed: number;
  peers: number;
  seeds: number;
  eta: number;
  error_message?: string | null;
}

export interface ProviderInfo {
  id: string;
  name: string;
  icon: string;
  domains: string[];
  capabilities: string[];
  status: 'operational' | 'degraded' | 'maintenance' | 'unavailable';
  limitations?: string;
}

export interface HistoryItem {
  id: string;
  download_id?: string;
  title: string;
  url: string;
  platform: string;
  file_path?: string;
  file_size: number;
  format: string;
  quality: string;
  thumbnail_url?: string;
  created_at: string;
}

export interface FavoriteItem {
  id: string;
  url: string;
  title: string;
  platform: string;
  thumbnail_url?: string;
  duration: number;
  notes?: string;
  created_at: string;
}

export interface SettingsData {
  app_name: string;
  app_version: string;
  downloads_path: string;
  temp_path: string;
  torrents_path: string;
  max_concurrent_downloads: number;
  default_quality: string;
  default_format: string;
  auto_merge: boolean;
  auto_convert: boolean;
  delete_temp_files: boolean;
  notifications_enabled: boolean;
  theme: string;
  bandwidth_limit_mbps: number;
  ffmpeg_path: string;
  system_presets?: Record<string, string>;
}

export interface DashboardStats {
  downloads_today: number;
  active_downloads: number;
  queued_downloads: number;
  completed_downloads: number;
  failed_downloads: number;
  downloads_size_bytes: number;
  disk_total_bytes: number;
  disk_used_bytes: number;
  disk_free_bytes: number;
  activity_trend: { day: string; count: number }[];
}

export interface AnimeCard {
  slug: string;
  title: string;
  alt_title?: string;
  thumbnail: string;
  url: string;
}

export interface AnimeSeason {
  name: string;
  subpath: string;
  season_title?: string;
  lang?: 'VOSTFR' | 'VF' | string;
  is_vf?: boolean;
  is_vostfr?: boolean;
  is_film?: boolean;
  url: string;
}

export interface AnimeDetails {
  slug: string;
  title: string;
  alt_title: string;
  cover: string;
  synopsis: string;
  genres: string[];
  seasons: AnimeSeason[];
  webpage_url: string;
}

export interface AnimeEpisode {
  episode: number;
  title: string;
  players: Record<string, string>;
}

export interface AnimeEpisodesResponse {
  slug: string;
  subpath: string;
  total_episodes: number;
  episodes: AnimeEpisode[];
}

