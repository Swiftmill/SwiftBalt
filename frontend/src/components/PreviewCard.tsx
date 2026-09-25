import React, { useState, useEffect } from 'react';
import { Play, Download, Star, Check, Film, Music, Volume2, Video, Loader2 } from 'lucide-react';
import { AnalyzeResult, DownloadItem } from '../types';
import { api } from '../services/api';

interface PreviewCardProps {
  data: AnalyzeResult;
  mode?: 'video' | 'audio';
  onModeChange?: (mode: 'video' | 'audio') => void;
  format?: string;
  onFormatChange?: (format: string) => void;
  quality?: string;
  onQualityChange?: (quality: string) => void;
  onDownload: (format: string, quality: string) => void;
  onPlay: () => void;
  onSaveFavorite: () => void;
  activeJob?: DownloadItem | null;
}

const fmtDuration = (s: number) => {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
};

const fmtBytes = (b?: number) => {
  if (!b) return null;
  const mb = b / 1048576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} Go` : `${mb.toFixed(0)} Mo`;
};

const fmtViews = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M vues`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k vues`;
  return `${n} vues`;
};

const fmtSpeed = (b?: number) => {
  if (!b) return '0 Ko/s';
  const mb = b / 1048576;
  return mb >= 1 ? `${mb.toFixed(1)} Mo/s` : `${(b / 1024).toFixed(0)} Ko/s`;
};

export const PreviewCard: React.FC<PreviewCardProps> = ({
  data,
  mode: propMode,
  onModeChange,
  format: propFormat,
  onFormatChange,
  quality: propQuality,
  onQualityChange,
  onDownload,
  onPlay,
  onSaveFavorite,
  activeJob,
}) => {
  // Mode: video vs audio
  const [internalMode, setInternalMode] = useState<'video' | 'audio'>(
    propMode || (data.type === 'audio' ? 'audio' : 'video')
  );
  const currentMode = propMode || internalMode;

  const handleSetMode = (m: 'video' | 'audio') => {
    setInternalMode(m);
    onModeChange?.(m);
    if (m === 'audio') {
      const nextFmt = (propFormat && ['mp3', 'wav', 'm4a', 'opus', 'flac'].includes(propFormat)) ? propFormat : 'wav';
      setSelectedFormat(nextFmt);
      onFormatChange?.(nextFmt);
    } else {
      const nextFmt = (propFormat && ['mp4', 'webm', 'mkv'].includes(propFormat)) ? propFormat : 'mp4';
      setSelectedFormat(nextFmt);
      onFormatChange?.(nextFmt);
    }
  };

  const videoFormats = data.video_formats || ['mp4', 'webm', 'mkv'];
  const audioFormats = data.audio_formats || ['mp3', 'wav', 'm4a', 'opus', 'flac'];
  const formats = currentMode === 'audio' ? audioFormats : videoFormats;

  // Filter video qualities to remove storyboard heights (27p, 45p, 90p, 180p) or "Audio" label
  const cleanVideoQualities = React.useMemo(() => {
    const raw = data.qualities || ['1080p', '720p', '480p', '360p'];
    const standard = [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144];
    const filtered = raw.filter((q) => {
      const num = parseInt(q.replace(/\D/g, ''), 10);
      return standard.includes(num);
    });
    // Sort descending
    filtered.sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return nb - na;
    });
    return filtered.length > 0 ? filtered : ['1080p', '720p', '480p', '360p'];
  }, [data.qualities]);

  // Audio quality options
  const audioBitrates = ['320 kbps', '256 kbps', '192 kbps', '128 kbps'];
  const audioLossless = ['Sans perte (PCM 16-bit / 48 kHz)'];

  const [selectedFormat, setSelectedFormat] = useState<string>(() => {
    if (propFormat && formats.includes(propFormat)) return propFormat;
    return currentMode === 'audio' ? 'wav' : 'mp4';
  });

  const [selectedQuality, setSelectedQuality] = useState<string>(() => {
    if (currentMode === 'audio') {
      return ['wav', 'flac'].includes(selectedFormat) ? 'Sans perte' : '320 kbps';
    }
    if (propQuality && cleanVideoQualities.includes(propQuality)) return propQuality;
    return cleanVideoQualities.includes('1080p') ? '1080p' : cleanVideoQualities[0];
  });

  const [favorited, setFavorited] = useState(false);

  // Synchronize when parent changes props
  useEffect(() => {
    if (propMode && propMode !== currentMode) {
      setInternalMode(propMode);
    }
  }, [propMode]);

  useEffect(() => {
    if (propFormat && formats.includes(propFormat) && propFormat !== selectedFormat) {
      setSelectedFormat(propFormat);
    }
  }, [propFormat, formats]);

  useEffect(() => {
    if (currentMode === 'audio') {
      if (['wav', 'flac'].includes(selectedFormat)) {
        setSelectedQuality('Sans perte');
      } else if (!['320 kbps', '256 kbps', '192 kbps', '128 kbps'].includes(selectedQuality)) {
        setSelectedQuality('320 kbps');
      }
    } else {
      if (!cleanVideoQualities.includes(selectedQuality)) {
        setSelectedQuality(cleanVideoQualities.includes('1080p') ? '1080p' : cleanVideoQualities[0]);
      }
    }
  }, [currentMode, selectedFormat, cleanVideoQualities]);

  const handleSelectFormat = (fmt: string) => {
    setSelectedFormat(fmt);
    onFormatChange?.(fmt);
  };

  const handleSelectQuality = (q: string) => {
    setSelectedQuality(q);
    onQualityChange?.(q);
  };

  const handleFav = () => {
    onSaveFavorite();
    setFavorited(true);
    setTimeout(() => setFavorited(false), 2500);
  };

  const isAudioLossless = ['wav', 'flac'].includes(selectedFormat);

  return (
    <div className="preview-card" style={{ marginTop: 28 }}>
      {/* Header */}
      <div className="preview-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="preview-platform-tag">{data.platform}</span>
          {/* Quick inline Mode switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '2px', border: '1px solid var(--border)' }}>
            <button
              onClick={() => handleSetMode('video')}
              style={{
                background: currentMode === 'video' ? 'var(--blue)' : 'transparent',
                color: currentMode === 'video' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Video size={11} />
              <span>Vidéo</span>
            </button>
            <button
              onClick={() => handleSetMode('audio')}
              style={{
                background: currentMode === 'audio' ? 'var(--accent)' : 'transparent',
                color: currentMode === 'audio' ? '#000' : 'var(--text-muted)',
                border: 'none',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Volume2 size={11} />
              <span>Audio</span>
            </button>
          </div>
        </div>

        <button className={`preview-fav-btn${favorited ? ' saved' : ''}`} onClick={handleFav}>
          {favorited ? <Check size={13} /> : <Star size={13} />}
          <span>{favorited ? 'enregistré' : 'favori'}</span>
        </button>
      </div>

      {/* Body */}
      <div className="preview-body">
        {/* Thumbnail */}
        <div className="preview-thumb" onClick={onPlay}>
          {data.thumbnail ? (
            <img src={data.thumbnail} alt={data.title} loading="lazy" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-subtle)' }}>
              {currentMode === 'audio' ? <Music size={28} /> : <Film size={28} />}
            </div>
          )}
          <div className="preview-thumb-overlay">
            <div className="preview-play-btn">
              <Play size={14} style={{ fill: 'var(--bg)', marginLeft: 2 }} />
            </div>
          </div>
          {data.duration > 0 && (
            <div className="preview-duration">{fmtDuration(data.duration)}</div>
          )}
        </div>

        {/* Info */}
        <div className="preview-info">
          <p className="preview-title">{data.title}</p>
          {data.author && (
            <span className="preview-author">{data.author}</span>
          )}
          <div className="preview-tags">
            {data.duration > 0 && (
              <span className="preview-tag">{fmtDuration(data.duration)}</span>
            )}
            {data.view_count > 0 && (
              <span className="preview-tag">{fmtViews(data.view_count)}</span>
            )}
            {currentMode === 'video' && (data.fps ?? 0) > 0 && (
              <span className="preview-tag">{data.fps}fps</span>
            )}
            {fmtBytes(data.file_size) && (
              <span className="preview-tag">{fmtBytes(data.file_size)}</span>
            )}
            <span className="preview-tag" style={{ color: currentMode === 'audio' ? 'var(--accent)' : 'var(--blue)' }}>
              {currentMode === 'audio' ? 'Mode Audio' : 'Mode Vidéo'}
            </span>
          </div>
        </div>
      </div>

      {/* Selectors */}
      <div className="preview-selectors">
        {/* Format Selector */}
        <div className="selector-row">
          <span className="selector-label">
            {currentMode === 'audio' ? 'format audio' : 'format vidéo'}
          </span>
          <div className="selector-pills">
            {formats.map((f) => (
              <button
                key={f}
                className={`toggle-btn${selectedFormat === f ? ' active' : ''}`}
                onClick={() => handleSelectFormat(f)}
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  textTransform: 'uppercase',
                  fontWeight: selectedFormat === f ? 700 : 500
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Quality Selector */}
        <div className="selector-row">
          <span className="selector-label">qualité</span>
          <div className="selector-pills">
            {currentMode === 'audio' ? (
              isAudioLossless ? (
                audioLossless.map((q) => (
                  <button
                    key={q}
                    className="toggle-btn active"
                    style={{ fontSize: 11, padding: '3px 10px' }}
                  >
                    {q}
                  </button>
                ))
              ) : (
                audioBitrates.map((b) => (
                  <button
                    key={b}
                    className={`toggle-btn${selectedQuality === b ? ' active' : ''}`}
                    onClick={() => handleSelectQuality(b)}
                    style={{ fontSize: 11, padding: '3px 10px' }}
                  >
                    {b}
                  </button>
                ))
              )
            ) : (
              cleanVideoQualities.map((q) => (
                <button
                  key={q}
                  className={`toggle-btn${selectedQuality === q ? ' active' : ''}`}
                  onClick={() => handleSelectQuality(q)}
                  style={{ fontSize: 11, padding: '3px 10px' }}
                >
                  {q}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {(() => {
        const isJobActive = Boolean(activeJob && ['queued', 'processing', 'downloading', 'merging', 'converting'].includes(activeJob.status));
        const isJobCompleted = Boolean(activeJob && activeJob.status === 'completed');

        const handleDownloadClick = () => {
          if (isJobCompleted && activeJob) {
            const a = document.createElement('a');
            a.href = api.getDownloadFileUrl(activeJob.id);
            a.download = '';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
          }
          onDownload(selectedFormat, selectedQuality);
        };

        return (
          <>
            <div className="preview-actions">
              <button className="btn btn-secondary" onClick={onPlay}>
                <Play size={13} style={{ fill: 'currentColor' }} />
                Aperçu
              </button>

              {isJobCompleted && activeJob ? (
                <button
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    background: 'var(--green)',
                    color: '#0a0a0c',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 0 16px rgba(34,197,94,0.3)',
                  }}
                  onClick={handleDownloadClick}
                >
                  <Download size={14} strokeWidth={2.5} />
                  <span>Enregistrer sur cet appareil ({activeJob.format.toUpperCase()})</span>
                </button>
              ) : isJobActive && activeJob ? (
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, opacity: 0.85, cursor: 'wait' }}
                  disabled
                >
                  <Loader2 size={14} className="animate-spin" />
                  <span>
                    {activeJob.status === 'converting'
                      ? 'Conversion audio...'
                      : activeJob.status === 'merging'
                      ? 'Finalisation...'
                      : activeJob.status === 'processing' || activeJob.status === 'queued'
                      ? 'Préparation...'
                      : `Téléchargement ${Math.round(activeJob.progress)}%`}
                  </span>
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleDownloadClick}
                >
                  <Download size={14} />
                  <span>
                    Télécharger · {selectedFormat.toUpperCase()} {currentMode === 'audio' ? (isAudioLossless ? '(Sans perte)' : `(${selectedQuality})`) : selectedQuality}
                  </span>
                </button>
              )}
            </div>

            {/* Subtle inline progress / status */}
            {isJobActive && activeJob && (
              <div style={{ padding: '0 18px 14px', marginTop: -4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Loader2 size={11} className="animate-spin" />
                    <span>
                      {activeJob.status === 'converting'
                        ? 'Conversion audio'
                        : activeJob.status === 'merging'
                        ? 'Finalisation'
                        : activeJob.status === 'queued'
                        ? 'File d\'attente'
                        : 'Téléchargement'}
                    </span>
                  </span>
                  <span>{Math.round(activeJob.progress)}%{activeJob.speed > 0 ? ` · ${fmtSpeed(activeJob.speed)}` : ''}</span>
                </div>
                <div className="progress-bar-wrap" style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      height: '100%',
                      width: `${activeJob.progress || 0}%`,
                      background: 'var(--text)',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {isJobCompleted && activeJob && (
              <div style={{ padding: '0 18px 14px', marginTop: -4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)' }}>
                  <Check size={13} />
                  <span style={{ fontWeight: 500 }}>Fichier prêt</span>
                </span>
                {activeJob.file_size > 0 && (
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-subtle)' }}>
                    {fmtBytes(activeJob.file_size)}
                  </span>
                )}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
};
