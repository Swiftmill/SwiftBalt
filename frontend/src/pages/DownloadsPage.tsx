import React, { useState } from 'react';
import {
  Download, Pause, Play, X, RotateCcw, Trash2,
  CheckCircle2, Film, Music, AlertCircle,
} from 'lucide-react';
import { DownloadItem } from '../types';
import { api } from '../services/api';

interface DownloadsPageProps {
  downloads: DownloadItem[];
  onRefresh: () => void;
}

type FilterKey = 'all' | 'active' | 'completed' | 'failed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'Tous'      },
  { key: 'active',    label: 'En cours'  },
  { key: 'completed', label: 'Terminés'  },
  { key: 'failed',    label: 'Échoués'   },
];

const ACTIVE_STATUSES = ['queued', 'processing', 'downloading', 'merging', 'converting', 'paused'];

const fmtSpeed = (bps?: number) => {
  if (!bps) return '';
  const mb = bps / 1048576;
  return mb >= 1 ? `${mb.toFixed(1)} Mo/s` : `${(bps / 1024).toFixed(0)} Ko/s`;
};

const fmtBytes = (b?: number) => {
  if (!b) return '0 Mo';
  const mb = b / 1048576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} Go` : `${mb.toFixed(1)} Mo`;
};

const fmtEta = (s?: number) => {
  if (!s || s <= 0) return '';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

const statusLabel: Record<string, string> = {
  queued:      'en attente',
  processing:  'traitement',
  downloading: 'téléchargement',
  merging:     'fusion',
  converting:  'conversion',
  paused:      'pause',
  completed:   'terminé',
  failed:      'échec',
  cancelled:   'annulé',
};

const statusClass: Record<string, string> = {
  queued:      'queued',
  processing:  'processing',
  downloading: 'downloading',
  merging:     'processing',
  converting:  'processing',
  paused:      'paused',
  completed:   'completed',
  failed:      'failed',
  cancelled:   'cancelled',
};

export const DownloadsPage: React.FC<DownloadsPageProps> = ({ downloads, onRefresh }) => {
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = downloads.filter((d) => {
    if (filter === 'active')    return ACTIVE_STATUSES.includes(d.status);
    if (filter === 'completed') return d.status === 'completed';
    if (filter === 'failed')    return ['failed', 'cancelled'].includes(d.status);
    return true;
  });

  const act = async (fn: () => Promise<any>) => {
    await fn();
    onRefresh();
  };

  return (
    <div className="page-wide">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">File de téléchargement</h1>
          <p className="page-subtitle">Progression en direct et gestion des tâches</p>
        </div>

        <div className="filter-tabs">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              className={`filter-tab${filter === key ? ' active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card empty-state" style={{ borderRadius: 'var(--radius-lg)' }}>
          <div className="empty-state-icon">
            <Download size={32} />
          </div>
          <h3>Aucune tâche</h3>
          <p>
            {filter === 'all'
              ? 'Lance ton premier téléchargement depuis la page d\'accueil.'
              : `Aucune tâche dans cette catégorie.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((item) => {
            const isActive   = ACTIVE_STATUSES.includes(item.status);
            const isPaused   = item.status === 'paused';
            const isDone     = item.status === 'completed';
            const isFailed   = ['failed', 'cancelled'].includes(item.status);
            const isInFlight = ['downloading', 'queued', 'processing'].includes(item.status);

            return (
              <div key={item.id} className="dl-item">
                <div className="dl-item-row">
                  {/* Thumbnail */}
                  <div className="dl-thumb">
                    {item.thumbnail_url
                      ? <img src={item.thumbnail_url} alt={item.title} />
                      : (item.format === 'mp3' || item.format === 'wav' || item.format === 'm4a' || item.format === 'flac' || item.format === 'opus')
                        ? <Music size={18} />
                        : <Film size={18} />
                    }
                  </div>

                  {/* Info */}
                  <div className="dl-info">
                    <p className="dl-title">{item.title}</p>
                    <div className="dl-meta">
                      <span style={{ color: 'var(--text)' }}>{item.platform}</span>
                      <span className="dot-sep">·</span>
                      <span style={{ textTransform: 'uppercase' }}>{item.format}</span>
                      {item.quality && (
                        <>
                          <span className="dot-sep">·</span>
                          <span>{item.quality}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`status-badge ${statusClass[item.status] || 'queued'}`}>
                    {statusLabel[item.status] || item.status}
                  </span>

                  {/* Actions */}
                  <div className="dl-actions">
                    {isDone && (
                      <a
                        href={api.getDownloadFileUrl(item.id)}
                        download
                        className="dl-action-btn accent"
                        title="Télécharger le fichier sur votre appareil"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                      >
                        <Download size={13} />
                      </a>
                    )}
                    {item.status === 'downloading' && (
                      <button className="dl-action-btn" onClick={() => act(() => api.pauseDownload(item.id))} title="Pause">
                        <Pause size={13} />
                      </button>
                    )}
                    {isPaused && (
                      <button className="dl-action-btn success" onClick={() => act(() => api.resumeDownload(item.id))} title="Reprendre">
                        <Play size={13} />
                      </button>
                    )}
                    {isInFlight && (
                      <button className="dl-action-btn danger" onClick={() => act(() => api.cancelDownload(item.id))} title="Annuler">
                        <X size={13} />
                      </button>
                    )}
                    {isFailed && (
                      <button className="dl-action-btn accent" onClick={() => act(() => api.retryDownload(item.id))} title="Relancer">
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button className="dl-action-btn danger" onClick={() => act(() => api.deleteDownload(item.id, true))} title="Supprimer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress */}
                {isActive && (
                  <div>
                    <div className="progress-bar-wrap">
                      <div
                        className={`progress-bar-fill${isPaused ? ' paused' : ''}`}
                        style={{ width: `${item.progress || 0}%` }}
                      />
                    </div>
                    <div className="progress-meta">
                      <span>
                        {item.progress || 0}%
                        {item.downloaded_bytes > 0 && ` · ${fmtBytes(item.downloaded_bytes)} / ${fmtBytes(item.total_bytes)}`}
                      </span>
                      <span>
                        {item.speed > 0 && fmtSpeed(item.speed)}
                        {item.eta > 0 && ` · ${fmtEta(item.eta)} restants`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Done */}
                {isDone && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', color: 'var(--green)' }}>
                      <CheckCircle2 size={13} />
                      <span>Terminé ({fmtBytes(item.file_size)})</span>
                    </div>
                    <a
                      href={api.getDownloadFileUrl(item.id)}
                      download
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '4px 10px',
                        fontSize: 11.5,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        textDecoration: 'none',
                        color: 'var(--text)'
                      }}
                      title="Télécharger directement sur cet appareil (téléphone ou PC)"
                    >
                      <Download size={13} style={{ color: 'var(--green)' }} />
                      <span>Enregistrer sur cet appareil</span>
                    </a>
                  </div>
                )}

                {/* Error */}
                {item.error_message && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#f87171', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 7, padding: '8px 10px' }}>
                    <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{item.error_message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
