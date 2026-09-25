import React, { useState, useEffect } from 'react';
import {
  History, Trash2, Copy, RotateCcw, Check, Film, Music,
  Play, PlayCircle, Download, Clock,
} from 'lucide-react';
import { HistoryItem, WatchHistoryItem, PlayerInfo } from '../types';
import { api } from '../services/api';
import { watchHistoryService, formatTimeSeconds, formatRelativeTime } from '../services/watchHistory';
import { MediaPlayerModal } from '../components/MediaPlayerModal';

interface HistoryPageProps {
  onReanalyze: (url: string) => void;
}

const fmtBytes = (b?: number) => {
  if (!b) return 'N/A';
  const mb = b / 1048576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} Go` : `${mb.toFixed(1)} Mo`;
};

export const HistoryPage: React.FC<HistoryPageProps> = ({ onReanalyze }) => {
  const [activeTab, setActiveTab] = useState<'watch' | 'downloads'>('watch');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Player for instant resume
  const [activeWatchPlayer, setActiveWatchPlayer] = useState<PlayerInfo | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  const loadData = () => {
    api.getHistory().then(setHistory).catch(() => {});
    setWatchHistory(watchHistoryService.getHistory());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClearAll = async () => {
    if (activeTab === 'downloads') {
      if (!confirm('Effacer tout l\'historique des téléchargements ?')) return;
      await api.clearHistory();
      setHistory([]);
    } else {
      if (!confirm('Effacer tout l\'historique de visionnage ?')) return;
      watchHistoryService.clearAll();
      setWatchHistory([]);
    }
  };

  const handleDeleteDownload = async (id: string) => {
    await api.deleteHistoryItem(id);
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDeleteWatch = (id: string) => {
    watchHistoryService.deleteItem(id);
    setWatchHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleResumeWatch = (item: WatchHistoryItem) => {
    setActiveWatchPlayer({
      stream_url: item.stream_url,
      url: item.url,
      title: item.title,
      thumbnail: item.thumbnail,
      platform: item.platform,
      duration: item.duration,
      initial_time: item.currentTime,
    });
    setIsPlayerOpen(true);
  };

  return (
    <div className="page-wide">
      {/* Top bar header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Historique</h1>
          <p className="page-subtitle">
            {activeTab === 'watch'
              ? 'Reprends tes vidéos et streams là où tu t\'es arrêté'
              : 'Fichiers récemment téléchargés'}
          </p>
        </div>
        {((activeTab === 'downloads' && history.length > 0) ||
          (activeTab === 'watch' && watchHistory.length > 0)) && (
          <button className="btn btn-ghost" onClick={handleClearAll} style={{ fontSize: 12 }}>
            <Trash2 size={13} />
            Tout effacer
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          className={`toggle-btn${activeTab === 'watch' ? ' active' : ''}`}
          onClick={() => setActiveTab('watch')}
          style={{ padding: '7px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <PlayCircle size={14} />
          <span>Visionnage & Reprise</span>
          <span style={{
            fontSize: 10,
            background: activeTab === 'watch' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
            padding: '1px 6px',
            borderRadius: 10,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {watchHistory.length}
          </span>
        </button>

        <button
          type="button"
          className={`toggle-btn${activeTab === 'downloads' ? ' active' : ''}`}
          onClick={() => setActiveTab('downloads')}
          style={{ padding: '7px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Download size={14} />
          <span>Téléchargements</span>
          <span style={{
            fontSize: 10,
            background: activeTab === 'downloads' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
            padding: '1px 6px',
            borderRadius: 10,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {history.length}
          </span>
        </button>
      </div>

      {/* WATCH HISTORY TAB */}
      {activeTab === 'watch' && (
        <>
          {watchHistory.length === 0 ? (
            <div className="card empty-state" style={{ borderRadius: 'var(--radius-lg)' }}>
              <div className="empty-state-icon"><Clock size={32} /></div>
              <h3>Aucun visionnage récent</h3>
              <p>Dès que tu regardes une vidéo ou un stream, ton avancement sera sauvegardé pour reprendre à tout moment.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {watchHistory.map((item) => {
                const percent = item.duration > 0 ? Math.min(100, Math.round((item.currentTime / item.duration) * 100)) : 0;
                return (
                  <div
                    key={item.id}
                    className="card card-sm card-hover"
                    style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14 }}
                  >
                    {/* Thumbnail with progress bar */}
                    <div style={{
                      position: 'relative',
                      width: 104,
                      height: 58,
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      background: '#111',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Film size={20} style={{ color: 'var(--text-muted)' }} />
                      )}

                      {/* Progress bar overlay at bottom of thumbnail */}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(0,0,0,0.6)' }}>
                        <div style={{ width: `${percent}%`, height: '100%', background: 'var(--accent)' }} />
                      </div>

                      {/* Timestamp badge */}
                      <span style={{
                        position: 'absolute',
                        bottom: 6,
                        right: 6,
                        fontSize: 9,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 600,
                        background: 'rgba(0,0,0,0.8)',
                        color: 'white',
                        padding: '1px 5px',
                        borderRadius: 4,
                        backdropFilter: 'blur(4px)',
                      }}>
                        {formatTimeSeconds(item.currentTime)}
                      </span>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                        <span style={{
                          background: 'rgba(255,255,255,0.06)',
                          padding: '1px 6px',
                          borderRadius: 4,
                          color: 'var(--text)',
                          fontWeight: 500,
                        }}>
                          {item.platform || 'Web'}
                        </span>
                        <span className="dot-sep">·</span>
                        <span>{formatRelativeTime(item.lastWatched)}</span>
                        <span className="dot-sep">·</span>
                        {item.completed ? (
                          <span style={{ color: 'var(--green)', fontWeight: 600 }}>Visionné en entier</span>
                        ) : (
                          <span>Arrêté à {formatTimeSeconds(item.currentTime)} ({percent}%)</span>
                        )}
                        {item.duration > 0 && (
                          <>
                            <span className="dot-sep">·</span>
                            <span>Durée {formatTimeSeconds(item.duration)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: 11, gap: 6 }}
                        onClick={() => handleResumeWatch(item)}
                        title={`Reprendre à ${formatTimeSeconds(item.currentTime)}`}
                      >
                        <Play size={11} style={{ fill: 'currentColor' }} />
                        <span>Reprendre ({formatTimeSeconds(item.currentTime)})</span>
                      </button>

                      {item.url && (
                        <button className="dl-action-btn" onClick={() => handleCopy(item.id, item.url!)} title="Copier l'URL">
                          {copiedId === item.id ? <Check size={12} style={{ color: 'var(--green)' }} /> : <Copy size={12} />}
                        </button>
                      )}

                      <button className="dl-action-btn danger" onClick={() => handleDeleteWatch(item.id)} title="Supprimer de l'historique">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* DOWNLOADS HISTORY TAB */}
      {activeTab === 'downloads' && (
        <>
          {history.length === 0 ? (
            <div className="card empty-state" style={{ borderRadius: 'var(--radius-lg)' }}>
              <div className="empty-state-icon"><History size={32} /></div>
              <h3>Historique vide</h3>
              <p>Tes téléchargements terminés apparaîtront ici.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  className="card card-sm card-hover"
                  style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  {/* Thumbnail */}
                  <div className="dl-thumb" style={{ flexShrink: 0 }}>
                    {item.thumbnail_url
                      ? <img src={item.thumbnail_url} alt={item.title} />
                      : (item.format === 'mp3' || item.format === 'wav' || item.format === 'm4a' || item.format === 'flac' || item.format === 'opus')
                        ? <Music size={16} />
                        : <Film size={16} />
                    }
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                      <span>{item.platform}</span>
                      <span className="dot-sep">·</span>
                      <span style={{ textTransform: 'uppercase' }}>{item.format}</span>
                      <span className="dot-sep">·</span>
                      <span>{fmtBytes(item.file_size)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button className="dl-action-btn" onClick={() => handleCopy(item.id, item.url)} title="Copier URL">
                      {copiedId === item.id ? <Check size={12} style={{ color: 'var(--green)' }} /> : <Copy size={12} />}
                    </button>
                    <button className="dl-action-btn accent" onClick={() => onReanalyze(item.url)} title="Réanalyser">
                      <RotateCcw size={12} />
                    </button>
                    <button className="dl-action-btn danger" onClick={() => handleDeleteDownload(item.id)} title="Supprimer">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Direct In-Page Resume Player Modal */}
      {activeWatchPlayer && (
        <MediaPlayerModal
          player={activeWatchPlayer}
          initialTime={activeWatchPlayer.initial_time}
          isOpen={isPlayerOpen}
          onClose={() => {
            setIsPlayerOpen(false);
            setWatchHistory(watchHistoryService.getHistory());
          }}
        />
      )}
    </div>
  );
};

