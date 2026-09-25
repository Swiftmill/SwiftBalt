import React, { useState, useMemo } from 'react';
import { Tv2, Play, Download, ArrowRight, AlertCircle, Loader2, Unlock } from 'lucide-react';
import { api, API_BASE } from '../services/api';
import { MediaPlayerModal } from '../components/MediaPlayerModal';

interface TwitchHubPageProps {
  onDownloadStarted: () => void;
}

export const TwitchHubPage: React.FC<TwitchHubPageProps> = ({ onDownloadStarted }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string>('Source (1080p60)');

  const availableQualities: string[] = useMemo(() => {
    if (!result) return [];
    if (result.metadata?.qualities && Array.isArray(result.metadata.qualities)) {
      return result.metadata.qualities;
    }
    if (result.streams && Array.isArray(result.streams)) {
      const qs = result.streams.map((s: any) => s.quality).filter(Boolean);
      if (qs.length > 0) return qs;
    }
    return ['Source (1080p60)', '720p60', '480p30', '360p30', '160p30', 'Audio'];
  }, [result]);

  const handleAnalyze = async (target: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data: any = await api.analyzeTwitch(target);
      setResult(data);
      // Auto pick highest / first quality
      const qs = data?.metadata?.qualities || (data?.streams ? data.streams.map((s: any) => s.quality).filter(Boolean) : []);
      if (qs && qs.length > 0) {
        setSelectedQuality(qs[0]);
      } else {
        setSelectedQuality('Source (1080p60)');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la récupération Twitch.');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    try {
      const isAudio = selectedQuality.toLowerCase().includes('audio');
      const targetFormat = isAudio ? 'mp3' : 'mp4';
      await api.createDownload({
        url: result.metadata?.webpage_url || url,
        title: result.metadata?.title,
        format: targetFormat,
        quality: selectedQuality,
        thumbnail_url: result.metadata?.thumbnail,
        platform: 'Twitch',
      });
      onDownloadStarted();
    } catch (err: any) {
      setError(err.message || 'Erreur au lancement du téléchargement.');
    }
  };

  // Player configured with the selected quality stream
  const activePlayer = useMemo(() => {
    if (!result?.player) return null;
    let streamUrl = result.player.stream_url;

    if (result.streams && result.streams.length > 0) {
      const match = result.streams.find(
        (s: any) => s.quality === selectedQuality || s.format_id === selectedQuality
      );
      if (match && match.url) {
        if (match.url.includes('.m3u8')) {
          streamUrl = `${API_BASE}/twitch/hls/manifest.m3u8?url=${encodeURIComponent(match.url)}`;
        } else {
          streamUrl = match.url;
        }
      }
    }

    return {
      ...result.player,
      stream_url: streamUrl,
      url: result.metadata?.webpage_url || url,
      platform: 'Twitch',
      title: result.player.title || result.metadata?.title || 'Twitch Stream / VOD',
      thumbnail: result.player.thumbnail || result.metadata?.thumbnail,
      duration: result.player.duration || result.metadata?.duration || 0,
    };
  }, [result, selectedQuality, url]);

  return (
    <div className="page-wide">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Tv2 size={18} style={{ color: 'var(--text-muted)' }} />
          <h1 className="page-title" style={{ margin: 0 }}>Twitch Hub</h1>
          <span style={{
            fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
            color: '#a78bfa', background: 'rgba(167,139,250,0.1)',
            border: '1px solid rgba(167,139,250,0.2)',
            borderRadius: 99, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            VOD · Clips · Live
          </span>
        </div>
        <p className="page-subtitle">Analyse et enregistrement de flux publics Twitch</p>
      </div>

      {/* Input */}
      <div style={{ maxWidth: 560, marginBottom: 32 }}>
        <form
          style={{ display: 'flex', gap: 8 }}
          onSubmit={(e) => { e.preventDefault(); if (url.trim()) handleAnalyze(url.trim()); }}
        >
          <input
            className="input-field"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Lien de chaîne, clip ou VOD Twitch..."
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !url.trim()}
            style={{ flexShrink: 0 }}
          >
            {isLoading
              ? <Loader2 size={15} className="animate-spin" />
              : <ArrowRight size={15} />
            }
          </button>
        </form>

        {error && (
          <div className="error-box" style={{ marginTop: 10 }}>
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {result.metadata?.thumbnail && (
              <div
                style={{ position: 'relative', width: 220, aspectRatio: '16/9', borderRadius: 'var(--radius)', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', background: 'var(--bg)' }}
                onClick={() => setIsPlayerOpen(true)}
              >
                <img src={result.metadata.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={14} style={{ fill: 'white', color: 'white', marginLeft: 2 }} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa', background: 'rgba(147,51,234,0.1)', border: '1px solid rgba(147,51,234,0.2)', borderRadius: 99, padding: '2px 8px' }}>
                  twitch · {result.metadata?.twitch_type || 'vod'}
                </span>
                {result.metadata?.is_sub_only && (
                  <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 99, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Unlock size={10} />
                    <span>Sub-VOD Débloqué</span>
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '10px 0 4px' }}>
                {result.metadata?.title}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                {result.metadata?.author}
              </p>

              {/* Quality selector */}
              {availableQualities.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Qualité vidéo & flux
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {availableQualities.map((q) => {
                      const isSelected = selectedQuality === q;
                      return (
                        <button
                          key={q}
                          type="button"
                          className={`toggle-btn${isSelected ? ' active' : ''}`}
                          onClick={() => setSelectedQuality(q)}
                          style={{ fontSize: 11, padding: '3px 10px' }}
                        >
                          {q}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button className="btn btn-secondary" onClick={() => setIsPlayerOpen(true)}>
                  <Play size={13} style={{ fill: 'currentColor' }} />
                  <span>Lecteur ({selectedQuality})</span>
                </button>
                <button className="btn btn-primary" onClick={handleDownload}>
                  <Download size={13} />
                  <span>Télécharger · {selectedQuality}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {result && activePlayer && (
        <MediaPlayerModal
          player={activePlayer}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};
