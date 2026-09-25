import React, { useState, useEffect, useRef } from 'react';
import { Magnet, Pause, Play, Trash2, FileText, Users, ArrowDown, ArrowUp, AlertCircle, FileUp, Upload, Download } from 'lucide-react';
import { TorrentItem } from '../types';
import { api } from '../services/api';
import { wsService } from '../services/websocket';

const fmtSpeed = (b?: number) => {
  if (!b) return '0 Ko/s';
  const mb = b / 1048576;
  return mb >= 1 ? `${mb.toFixed(1)} Mo/s` : `${(b / 1024).toFixed(0)} Ko/s`;
};

const fmtSize = (b?: number) => {
  if (!b) return '0 Mo';
  const mb = b / 1048576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} Go` : `${mb.toFixed(0)} Mo`;
};

const statusClass: Record<string, string> = {
  downloading: 'downloading',
  completed:   'completed',
  paused:      'paused',
  seeding:     'processing',
  error:       'error',
};

export const TorrentCenterPage: React.FC = () => {
  const [torrents, setTorrents] = useState<TorrentItem[]>([]);
  const [magnetInput, setMagnetInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTorrents = async () => {
    try {
      const list = await api.getTorrents();
      setTorrents(list);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchTorrents();
    const iv = setInterval(fetchTorrents, 1500);

    const unsubUpdated = wsService.on('torrent_updated', (updated: TorrentItem) => {
      setTorrents((prev) => {
        const idx = prev.findIndex((t) => t.id === updated.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...updated };
          return next;
        }
        return [updated, ...prev];
      });
    });

    const unsubAdded = wsService.on('torrent_added', (added: TorrentItem) => {
      setTorrents((prev) => {
        if (prev.some((t) => t.id === added.id)) return prev;
        return [added, ...prev];
      });
    });

    const unsubDeleted = wsService.on('torrent_deleted', (payload: { id: string }) => {
      setTorrents((prev) => prev.filter((t) => t.id !== payload.id));
    });

    return () => {
      clearInterval(iv);
      unsubUpdated();
      unsubAdded();
      unsubDeleted();
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magnetInput.trim()) return;
    setIsAdding(true);
    setError(null);
    try {
      await api.addMagnet(magnetInput.trim());
      setMagnetInput('');
      fetchTorrents();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'ajout du magnet.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAdding(true);
    setError(null);
    try {
      await api.uploadTorrentFile(file);
      fetchTorrents();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'import du fichier .torrent.');
    } finally {
      setIsAdding(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.torrent')) {
      setIsAdding(true);
      setError(null);
      try {
        await api.uploadTorrentFile(file);
        fetchTorrents();
      } catch (err: any) {
        setError(err.message || 'Erreur lors de l\'import du fichier .torrent.');
      } finally {
        setIsAdding(false);
      }
    }
  };

  return (
    <div className="page-wide">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Magnet size={18} style={{ color: 'var(--text-muted)' }} />
          <h1 className="page-title" style={{ margin: 0 }}>Torrent Center</h1>
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#22d3ee', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 99, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            légal · open data
          </span>
        </div>
        <p className="page-subtitle">Images Linux, archives et jeux de données libres</p>
      </div>

      {/* Magnet input & File upload */}
      <div style={{ maxWidth: 640, marginBottom: 32 }}>
        <form
          onSubmit={handleAdd}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        >
          <div style={{ flex: 1, minWidth: 260, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 14px' }}>
            <Magnet size={14} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
            <input
              type="text"
              value={magnetInput}
              onChange={(e) => setMagnetInput(e.target.value)}
              placeholder="magnet:?xt=urn:btih:... ou glissez un .torrent"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', padding: '9px 0' }}
            />
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept=".torrent"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAdding}
            title="Importer un fichier .torrent"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          >
            <FileUp size={14} />
            Fichier .torrent
          </button>

          <button className="btn btn-primary" type="submit" disabled={isAdding || !magnetInput.trim()} style={{ flexShrink: 0 }}>
            Ajouter
          </button>
        </form>

        {error && (
          <div className="error-box" style={{ marginTop: 10 }}>
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Torrent list */}
      {torrents.length === 0 ? (
        <div className="card empty-state" style={{ borderRadius: 'var(--radius-lg)' }}>
          <div className="empty-state-icon"><Magnet size={32} /></div>
          <h3>Aucun torrent</h3>
          <p>Colle un lien magnet pour commencer le téléchargement.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {torrents.map((t) => (
            <div key={t.id} className="torrent-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Icon */}
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)' }}>
                  <FileText size={16} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                    <span>{fmtSize(t.downloaded_size)} / {fmtSize(t.total_size)}</span>
                    <span className="dot-sep">·</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--green)' }}>
                      <ArrowDown size={10} /> {fmtSpeed(t.download_speed)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--blue)' }}>
                      <ArrowUp size={10} /> {fmtSpeed(t.upload_speed)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Users size={10} /> {t.seeds}s / {t.peers}p
                    </span>
                  </div>
                  {t.error_message && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={11} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.error_message}</span>
                    </p>
                  )}
                </div>

                {/* Status + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span className={`status-badge ${statusClass[t.status] || 'queued'}`}>
                    {t.status === 'completed' ? 'complété' : t.status === 'downloading' ? 'en cours' : t.status === 'paused' ? 'en pause' : t.status === 'error' ? 'erreur' : t.status}
                  </span>

                  {(t.status === 'completed' || (t.total_size > 0 && t.downloaded_size >= t.total_size * 0.95)) && (
                    <a
                      href={api.getTorrentFileUrl(t.id)}
                      download
                      className="btn btn-primary"
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        height: '28px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        textDecoration: 'none',
                        borderRadius: 'var(--radius-sm)'
                      }}
                      title="Télécharger le fichier sur votre ordinateur"
                    >
                      <Download size={13} />
                      <span>Télécharger</span>
                    </a>
                  )}

                  {t.status === 'downloading' && (
                    <button className="dl-action-btn" onClick={() => { api.pauseTorrent(t.id).then(fetchTorrents); }} title="Pause">
                      <Pause size={12} />
                    </button>
                  )}
                  {t.status === 'paused' && (
                    <button className="dl-action-btn success" onClick={() => { api.resumeTorrent(t.id).then(fetchTorrents); }} title="Reprendre">
                      <Play size={12} />
                    </button>
                  )}
                  <button className="dl-action-btn danger" onClick={() => { api.deleteTorrent(t.id).then(fetchTorrents); }} title="Supprimer">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="progress-bar-wrap">
                  <div
                    className={`progress-bar-fill${t.status === 'paused' ? ' paused' : t.status === 'completed' ? ' done' : ''}`}
                    style={{ width: `${t.progress || 0}%` }}
                  />
                </div>
                <div className="progress-meta">
                  <span>{t.progress || 0}%</span>
                  <span>{t.eta > 0 ? `${t.eta}s restants` : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
