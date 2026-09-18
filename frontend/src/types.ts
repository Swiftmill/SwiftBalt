export interface FormatOption {
  format_id: string;
  ext: string;
  resolution?: string;
  quality?: string;
  filesize?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  url?: string;
  has_video: boolean;
  has_audio: boolean;
}

export interface SubtitleOption {
  lang: string;
  name?: string;
  ext: string;
  url: string;
}

export interface MediaMetadata {
  id: string;
  title: string;
  description?: string;
  author?: string;
  uploader?: string;
  thumbnail?: string;
  duration?: number;
  upload_date?: string;
  view_count?: number;
  like_count?: number;
  tags: string[];
  categories: string[];
  language?: string;
  provider_id: string;
  provider_name: string;
  source_url: string;
  available_formats: FormatOption[];
  available_subtitles: SubtitleOption[];
  is_direct_file: boolean;
  estimated_size?: number;
}

export interface ProviderStatus {
  id: string;
  name: string;
  domains: string[];
  icon: string;
  capabilities: string[];
  status: string;
}

export interface DownloadTask {
  id: string;
  url: string;
  provider_id: string;
  title: string;
  thumbnail_url?: string;
  format_id?: string;
  target_format: string;
  status: 'queued' | 'processing' | 'downloading' | 'merging' | 'converting' | 'completed' | 'paused' | 'failed' | 'cancelled';
  progress: number;
  speed_kbps: number;
  downloaded_bytes: number;
  total_bytes: number;
  eta_seconds?: number;
  file_path?: string;
  error_message?: string;
  created_at: number;
}

export interface TorrentTask {
  id: string;
  name: string;
  source: string;
  status: 'queued' | 'downloading' | 'seeding' | 'paused' | 'completed' | 'error';
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
  download_speed_kbps: number;
  upload_speed_kbps: number;
  num_peers: number;
  num_seeds: number;
  eta_seconds?: number;
  save_path?: string;
  files: Array<{ index: number; path: string; size: number }>;
  created_at: number;
}

export interface DashboardStats {
  app_name: string;
  total_downloads: number;
  active_downloads: number;
  completed_downloads: number;
  failed_downloads: number;
  active_torrents: number;
  storage_used_bytes: number;
}
