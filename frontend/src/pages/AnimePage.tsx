import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Clapperboard,
  Search,
  X,
  Play,
  Download,
  Loader2,
  Tv,
  Film,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Star,
  Globe,
  Mic,
  ArrowLeft,
  Monitor,
  Server,
  RefreshCw,
  ExternalLink,
  Grid,
  List,
  Volume2,
  Eye,
} from 'lucide-react';
import { AnimeCard, AnimeDetails, AnimeSeason, AnimeEpisode, AnimeEpisodesResponse } from '../types';
import { api, API_BASE } from '../services/api';
import { watchHistoryService } from '../services/watchHistory';
import Hls from 'hls.js';

interface AnimePageProps {
  onDownloadStarted: () => void;
}

type ViewState = 'browse' | 'detail' | 'player';

const LANG_COLORS: Record<string, string> = {
  vf: '#f59e0b',
  vostfr: '#6366f1',
  film: '#ec4899',
};

const getLangBadgeStyle = (season: AnimeSeason) => {
  if (season.is_vf) return { bg: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b' };
  if (season.is_vostfr) return { bg: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)', color: '#818cf8' };
  if (season.is_film) return { bg: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.35)', color: '#f472b6' };
  return { bg: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)' };
};

const renderHostIcon = (host: string) => {
  const h = host.toLowerCase();
  if (h.includes('sibnet')) return <Server size={13} style={{ color: '#818cf8', flexShrink: 0 }} />;
  if (h.includes('anime-sama')) return <Tv size={13} style={{ color: '#38bdf8', flexShrink: 0 }} />;
  if (h.includes('sendvid')) return <Play size={13} style={{ color: '#ec4899', flexShrink: 0 }} />;
  if (h.includes('vidmoly')) return <Globe size={13} style={{ color: '#a855f7', flexShrink: 0 }} />;
  if (h.includes('streamwish')) return <Film size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />;
  if (h.includes('vk')) return <Monitor size={13} style={{ color: '#3b82f6', flexShrink: 0 }} />;
  return <Play size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />;
};

const pickBestHost = (players: Record<string, string>): string => {
  const keys = Object.keys(players);
  if (keys.length === 0) return '';
  return (
    keys.find(k => k.toLowerCase().includes('sibnet')) ||
    keys.find(k => k.toLowerCase().includes('anime-sama')) ||
    keys.find(k => k.toLowerCase().includes('vidmoly')) ||
    keys.find(k => !k.toLowerCase().includes('sendvid')) ||
    keys[0]
  );
};

export const AnimePage: React.FC<AnimePageProps> = ({ onDownloadStarted }) => {
  // Navigation state
  const [viewState, setViewState] = useState<ViewState>('browse');
  const [trending, setTrending] = useState<AnimeCard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AnimeCard[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingTrending, setIsLoadingTrending] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  // Anime Detail state
  const [selectedAnime, setSelectedAnime] = useState<AnimeDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [selectedLang, setSelectedLang] = useState<'VOSTFR' | 'VF'>('VOSTFR');
  const [selectedSeason, setSelectedSeason] = useState<AnimeSeason | null>(null);
  const [episodesData, setEpisodesData] = useState<AnimeEpisodesResponse | null>(null);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<AnimeEpisode | null>(null);
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [episodeListMode, setEpisodeListMode] = useState<'grid' | 'list'>('grid');

  // Player state
  const [playerMode, setPlayerMode] = useState<'embed' | 'direct' | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string>('');
  const [playerTitle, setPlayerTitle] = useState<string>('');
  const [isResolvingStream, setIsResolvingStream] = useState(false);
  const [resolveError, setResolveError] = useState<string>('');
  const [availableQualities, setAvailableQualities] = useState<{ id: number; label: string; height: number }[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);

  const searchTimerRef = useRef<number | null>(null);
  const heroTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const handleSelectQuality = (qualityId: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = qualityId;
      setSelectedQuality(qualityId);
    }
  };

  // Direct player setup (HLS or native MP4)
  useEffect(() => {
    if (playerMode !== 'direct' || !playerUrl || !videoRef.current) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = playerUrl.includes('.m3u8') || playerUrl.includes('proxy-hls');
    const video = videoRef.current;

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          capLevelToPlayerSize: false,
          abrEwmaDefaultEstimate: 25000000,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
        });
        hls.loadSource(playerUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          if (data.levels && data.levels.length > 0) {
            let bestIndex = 0;
            let maxH = 0;
            data.levels.forEach((lvl, idx) => {
              if ((lvl.height || 0) >= maxH) {
                maxH = lvl.height || 0;
                bestIndex = idx;
              }
            });

            const quals = data.levels.map((lvl, index) => ({
              id: index,
              label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}k`,
              height: lvl.height || 0,
            })).sort((a, b) => b.height - a.height);

            setAvailableQualities(quals);

            // Force highest resolution by default (1080p)
            hls.currentLevel = bestIndex;
            setSelectedQuality(bestIndex);
          }
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          setSelectedQuality(data.level);
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error('HLS fatal error:', data);
          }
        });
        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = playerUrl;
        video.play().catch(() => {});
      }
    } else {
      setAvailableQualities([]);
      setSelectedQuality(-1);
      video.src = playerUrl;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playerMode, playerUrl]);

  // Auto-advance hero banner
  useEffect(() => {
    if (trending.length < 2) return;
    heroTimerRef.current = window.setInterval(() => {
      setHeroIndex(i => (i + 1) % Math.min(trending.length, 5));
    }, 6000);
    return () => { if (heroTimerRef.current) clearInterval(heroTimerRef.current); };
  }, [trending.length]);

  // Load trending animes on mount
  useEffect(() => {
    api.getTrendingAnime()
      .then((data) => {
        setTrending(data);
        setIsLoadingTrending(false);
      })
      .catch((err) => {
        console.error('Failed to load trending animes:', err);
        setIsLoadingTrending(false);
      });
  }, []);

  // Debounced search
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!val.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimerRef.current = window.setTimeout(async () => {
      try {
        const results = await api.searchAnime(val.trim());
        setSearchResults(results);
      } catch (err) {
        console.error('Anime search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setIsSearching(false);
  };

  // Open Anime Detail view
  const handleOpenAnime = async (slug: string) => {
    setViewState('detail');
    setIsLoadingDetails(true);
    setSelectedAnime(null);
    setSelectedSeason(null);
    setEpisodesData(null);
    setSelectedEpisode(null);
    setPlayerMode(null);
    setResolveError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const details = await api.getAnimeDetails(slug);
      setSelectedAnime(details);
      if (details.seasons && details.seasons.length > 0) {
        const hasVostfr = details.seasons.some(s => s.lang === 'VOSTFR' || s.is_vostfr);
        const hasVf = details.seasons.some(s => s.lang === 'VF' || s.is_vf);
        const defaultLang = hasVostfr ? 'VOSTFR' : (hasVf ? 'VF' : 'VOSTFR');
        setSelectedLang(defaultLang);

        const initialSeason = details.seasons.find(s =>
          defaultLang === 'VF'
            ? (s.is_vf || s.lang === 'VF')
            : (s.is_vostfr || s.lang === 'VOSTFR' || (!s.is_vf && s.lang !== 'VF'))
        ) || details.seasons[0];

        await handleSelectSeason(details.slug, initialSeason);
      }
    } catch (err) {
      console.error('Failed to get anime details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Switch between VOSTFR and VF
  const handleLanguageChange = async (newLang: 'VOSTFR' | 'VF') => {
    if (!selectedAnime || selectedLang === newLang) return;
    setSelectedLang(newLang);

    const currentTitle = selectedSeason?.season_title || selectedSeason?.name.replace(/\s*\((?:VOSTFR|VF)\)/i, '').trim();
    const targetSeason = selectedAnime.seasons.find(s => {
      const sTitle = s.season_title || s.name.replace(/\s*\((?:VOSTFR|VF)\)/i, '').trim();
      const matchesTitle = currentTitle ? sTitle.toLowerCase() === currentTitle.toLowerCase() : true;
      const matchesLang = newLang === 'VF'
        ? (s.is_vf || s.lang === 'VF')
        : (s.is_vostfr || s.lang === 'VOSTFR' || (!s.is_vf && s.lang !== 'VF'));
      return matchesTitle && matchesLang;
    }) || selectedAnime.seasons.find(s =>
      newLang === 'VF'
        ? (s.is_vf || s.lang === 'VF')
        : (s.is_vostfr || s.lang === 'VOSTFR' || (!s.is_vf && s.lang !== 'VF'))
    );

    if (targetSeason) {
      await handleSelectSeason(selectedAnime.slug, targetSeason);
    }
  };

  // Select Season & Load Episodes
  const handleSelectSeason = async (slug: string, season: AnimeSeason) => {
    setSelectedSeason(season);
    setIsLoadingEpisodes(true);
    setSelectedEpisode(null);
    setPlayerMode(null);
    setResolveError('');
    try {
      const epData = await api.getAnimeEpisodes(slug, season.subpath);
      setEpisodesData(epData);
      if (epData.episodes && epData.episodes.length > 0) {
        const firstEp = epData.episodes[0];
        setSelectedEpisode(firstEp);
        const hosts = Object.keys(firstEp.players);
        if (hosts.length > 0) {
          setSelectedHost(pickBestHost(firstEp.players));
        }
      }
    } catch (err) {
      console.error('Failed to load season episodes:', err);
      setEpisodesData(null);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  // When changing episode, preserve host preference
  const handleSelectEpisode = (ep: AnimeEpisode) => {
    setSelectedEpisode(ep);
    setPlayerMode(null);
    setResolveError('');
    const hosts = Object.keys(ep.players);
    if (!hosts.includes(selectedHost) && hosts.length > 0) {
      setSelectedHost(pickBestHost(ep.players));
    }
  };

  // Launch Episode Playback
  const handlePlayEpisode = async (ep?: AnimeEpisode, host?: string) => {
    const targetEp = ep || selectedEpisode;
    const targetHost = host || selectedHost;
    if (!selectedAnime || !targetEp || !targetHost) return;

    const rawUrl = targetEp.players[targetHost];
    if (!rawUrl) return;

    const title = `${selectedAnime.title} — ${selectedSeason?.name || ''} · Ép. ${targetEp.episode}`;
    setPlayerTitle(title);
    setIsResolvingStream(true);
    setResolveError('');
    setViewState('player');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const resolved = await api.resolveAnimeStream(rawUrl);

      if (resolved.type === 'unavailable') {
        const altHost = Object.keys(targetEp.players).find(h => h !== targetHost && (h.includes('Sibnet') || h.includes('Anime-Sama')));
        if (altHost) {
          setSelectedHost(altHost);
          handlePlayEpisode(targetEp, altHost);
          return;
        }
      }

      if (resolved.is_direct && resolved.stream_url) {
        const fullStreamUrl = resolved.stream_url.startsWith('http')
          ? resolved.stream_url
          : `${API_BASE.replace('/api', '')}${resolved.stream_url}`;
        setPlayerUrl(fullStreamUrl);
        setPlayerMode('direct');

        watchHistoryService.saveProgress({
          stream_url: fullStreamUrl,
          url: selectedAnime.webpage_url,
          title,
          thumbnail: selectedAnime.cover,
          platform: 'Anime-Sama',
          duration: 1440,
          currentTime: 0,
        });
      } else {
        const embedUrl = resolved.embed_url || rawUrl;
        setPlayerUrl(embedUrl);
        setPlayerMode('embed');

        watchHistoryService.saveProgress({
          stream_url: rawUrl,
          url: selectedAnime.webpage_url,
          title,
          thumbnail: selectedAnime.cover,
          platform: 'Anime-Sama',
          duration: 1440,
          currentTime: 0,
        });
      }
    } catch (err: any) {
      console.error('Failed to resolve stream:', err);
      setPlayerUrl(rawUrl);
      setPlayerMode('embed');
    } finally {
      setIsResolvingStream(false);
    }
  };

  // Download Episode
  const handleDownloadEpisode = async () => {
    if (!selectedAnime || !selectedEpisode || !selectedHost) return;
    const rawUrl = selectedEpisode.players[selectedHost];
    if (!rawUrl) return;

    const title = `${selectedAnime.title} - ${selectedSeason?.name || ''} - ${selectedEpisode.title}`;
    try {
      const resolved = await api.resolveAnimeStream(rawUrl);
      const downloadTarget = (resolved.is_direct && resolved.raw_url) ? resolved.raw_url : rawUrl;
      await api.createDownload({ url: downloadTarget, title, format: 'mp4', quality: '1080p' });
      onDownloadStarted();
    } catch (err: any) {
      alert(`Erreur téléchargement: ${err.message || err}`);
    }
  };

  const goBack = () => {
    if (viewState === 'player') {
      setViewState('detail');
      setPlayerMode(null);
    } else if (viewState === 'detail') {
      setViewState('browse');
      setSelectedAnime(null);
    }
  };

  const spotlightAnime = trending.length > 0 ? trending[heroIndex] : null;
  const currentEpisodeIndex = selectedEpisode && episodesData
    ? episodesData.episodes.findIndex(e => e.episode === selectedEpisode.episode)
    : -1;
  const prevEp = currentEpisodeIndex > 0 ? episodesData?.episodes[currentEpisodeIndex - 1] : null;
  const nextEp = episodesData && currentEpisodeIndex < episodesData.episodes.length - 1
    ? episodesData.episodes[currentEpisodeIndex + 1]
    : null;

  // ============================================================
  // PLAYER VIEW
  // ============================================================
  if (viewState === 'player') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000' }}>
        {/* Player top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px',
          background: 'rgba(0,0,0,0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <button
            onClick={goBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: 'white', cursor: 'pointer', padding: '6px 12px',
              borderRadius: 8, fontSize: 12, fontWeight: 500,
              transition: 'background 0.15s',
            }}
          >
            <ArrowLeft size={14} />
            Retour
          </button>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
              {playerTitle}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {prevEp && (
              <button
                onClick={() => handlePlayEpisode(prevEp, selectedHost)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'rgba(255,255,255,0.08)', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 10px',
                  borderRadius: 8, fontSize: 11,
                }}
              >
                <ChevronLeft size={13} /> Ép. {prevEp.episode}
              </button>
            )}
            {nextEp && (
              <button
                onClick={() => handlePlayEpisode(nextEp, selectedHost)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)',
                  color: '#818cf8', cursor: 'pointer', padding: '6px 10px',
                  borderRadius: 8, fontSize: 11, fontWeight: 600,
                }}
              >
                Ép. {nextEp.episode} <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Player area */}
        <div style={{ flex: 1, position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isResolvingStream ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <Loader2 size={40} className="animate-spin" style={{ color: '#6366f1' }} />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Résolution du flux vidéo...</span>
            </div>
          ) : playerMode === 'direct' ? (
            <video
              ref={videoRef}
              key={playerUrl}
              controls
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', maxHeight: 'calc(100vh - 140px)', objectFit: 'contain', background: '#000' }}
              onTimeUpdate={(e) => {
                if (selectedAnime && selectedEpisode) {
                  const video = e.currentTarget;
                  watchHistoryService.saveProgress({
                    stream_url: playerUrl,
                    url: selectedAnime.webpage_url,
                    title: playerTitle,
                    thumbnail: selectedAnime.cover,
                    platform: 'Anime-Sama',
                    duration: video.duration || 1440,
                    currentTime: video.currentTime,
                  });
                }
              }}
            >
              Votre navigateur ne supporte pas la lecture vidéo.
            </video>
          ) : playerMode === 'embed' ? (
            <iframe
              key={playerUrl}
              src={playerUrl}
              title={playerTitle}
              style={{ width: '100%', height: '100%', border: 'none', minHeight: 'calc(100vh - 140px)' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40 }}>
              <Film size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
              <p style={{ fontSize: 14 }}>Aucun flux disponible</p>
            </div>
          )}
        </div>

        {/* Player bottom bar */}
        {playerMode && !isResolvingStream && selectedEpisode && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px',
            background: 'rgba(0,0,0,0.9)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Lecteur :</span>
            {Object.keys(selectedEpisode.players).map((host) => (
              <button
                key={host}
                onClick={() => {
                  setSelectedHost(host);
                  handlePlayEpisode(selectedEpisode, host);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, padding: '4px 10px',
                  borderRadius: 6,
                  border: selectedHost === host ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: selectedHost === host ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                  color: selectedHost === host ? '#818cf8' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {renderHostIcon(host)}
                <span>{host}</span>
              </button>
            ))}

            {availableQualities.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8 }}>
                <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', marginRight: 4 }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2 }}>Qualité :</span>
                {availableQualities.map((q) => {
                  const isQActive = selectedQuality === q.id;
                  return (
                    <button
                      key={q.id}
                      onClick={() => handleSelectQuality(q.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        fontSize: 11, padding: '3px 8px',
                        borderRadius: 6,
                        border: isQActive ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                        background: isQActive ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                        color: isQActive ? '#34d399' : 'var(--text-muted)',
                        fontWeight: isQActive ? 700 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      {q.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => handleSelectQuality(-1)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    fontSize: 11, padding: '3px 8px',
                    borderRadius: 6,
                    border: selectedQuality === -1 ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    background: selectedQuality === -1 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                    color: selectedQuality === -1 ? '#34d399' : 'var(--text-muted)',
                    fontWeight: selectedQuality === -1 ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  Auto
                </button>
              </div>
            )}

            <div style={{ flex: 1 }} />

            <button
              onClick={handleDownloadEpisode}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, padding: '5px 12px',
                borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-muted)', cursor: 'pointer',
              }}
            >
              <Download size={12} /> Télécharger
            </button>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // DETAIL VIEW (anime page)
  // ============================================================
  if (viewState === 'detail') {
    return (
      <div className="page-wide">
        {/* Back button */}
        <button
          onClick={goBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-muted)', cursor: 'pointer', padding: '7px 14px',
            borderRadius: 8, fontSize: 12, fontWeight: 500,
          }}
        >
          <ArrowLeft size={14} /> Retour au catalogue
        </button>

        {isLoadingDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 14 }}>
            <Loader2 size={32} className="animate-spin" style={{ color: '#6366f1' }} />
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Chargement des informations...</span>
          </div>
        ) : selectedAnime && (
          <div>
            {/* Hero Banner */}
            <div style={{
              position: 'relative',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              marginBottom: 28,
              background: 'linear-gradient(135deg, #0f0f18 0%, #16141f 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {/* Blurred cover background */}
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${selectedAnime.cover})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                opacity: 0.08,
                filter: 'blur(20px)',
              }} />

              <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 24, padding: 24, alignItems: 'flex-start' }}>
                {/* Cover */}
                <div style={{
                  width: 160, height: 220,
                  borderRadius: 10, overflow: 'hidden',
                  flexShrink: 0,
                  border: '2px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                }}>
                  <img src={selectedAnime.cover} alt={selectedAnime.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 26, fontWeight: 800, color: 'white', margin: '0 0 4px 0', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                    {selectedAnime.title}
                  </h1>
                  {selectedAnime.alt_title && (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                      {selectedAnime.alt_title}
                    </p>
                  )}

                  {/* Language & Seasons Selection */}
                  {selectedAnime.seasons.length > 0 && (() => {
                    const hasVostfr = selectedAnime.seasons.some(s => s.lang === 'VOSTFR' || s.is_vostfr);
                    const hasVf = selectedAnime.seasons.some(s => s.lang === 'VF' || s.is_vf);
                    const visibleSeasons = selectedAnime.seasons.filter(s => {
                      if (s.is_film) return true;
                      return selectedLang === 'VF'
                        ? (s.is_vf || s.lang === 'VF')
                        : (s.is_vostfr || s.lang === 'VOSTFR' || (!s.is_vf && s.lang !== 'VF'));
                    });
                    const seasonsToShow = visibleSeasons.length > 0 ? visibleSeasons : selectedAnime.seasons;

                    return (
                      <div style={{ marginBottom: 14 }}>
                        {/* Audio Language Switcher */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Version audio :
                          </span>
                          <div style={{
                            display: 'inline-flex',
                            background: 'rgba(255,255,255,0.06)',
                            padding: 3,
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}>
                            <button
                              type="button"
                              onClick={() => handleLanguageChange('VOSTFR')}
                              disabled={!hasVostfr}
                              style={{
                                padding: '4px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                cursor: hasVostfr ? 'pointer' : 'not-allowed',
                                background: selectedLang === 'VOSTFR' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                                color: selectedLang === 'VOSTFR' ? '#ffffff' : (hasVostfr ? 'var(--text-muted)' : 'rgba(255,255,255,0.2)'),
                                border: 'none', transition: 'all 0.15s',
                                boxShadow: selectedLang === 'VOSTFR' ? '0 2px 8px rgba(99,102,241,0.4)' : 'none',
                              }}
                            >
                              VOSTFR
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLanguageChange('VF')}
                              disabled={!hasVf}
                              style={{
                                padding: '4px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                cursor: hasVf ? 'pointer' : 'not-allowed',
                                background: selectedLang === 'VF' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                                color: selectedLang === 'VF' ? '#ffffff' : (hasVf ? 'var(--text-muted)' : 'rgba(255,255,255,0.2)'),
                                border: 'none', transition: 'all 0.15s',
                                boxShadow: selectedLang === 'VF' ? '0 2px 8px rgba(245,158,11,0.4)' : 'none',
                              }}
                            >
                              VF {!hasVf ? '(Indisponible)' : ''}
                            </button>
                          </div>
                        </div>

                        {/* Season Buttons (clean, without emojis) */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {seasonsToShow.map((season) => {
                            const isActive = selectedSeason?.subpath === season.subpath;
                            const isVF = season.is_vf || season.lang === 'VF';
                            const activeColor = isVF ? '#fcd34d' : '#c7d2fe';
                            const activeBg = isVF ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)';
                            const activeBorder = isVF ? '1px solid #f59e0b' : '1px solid #6366f1';
                            const label = season.season_title || season.name.replace(/\s*\((?:VOSTFR|VF)\)/i, '');

                            return (
                              <button
                                key={season.subpath}
                                onClick={() => handleSelectSeason(selectedAnime.slug, season)}
                                style={{
                                  fontSize: 11, fontWeight: 600, padding: '5px 14px',
                                  borderRadius: 99, cursor: 'pointer',
                                  background: isActive ? activeBg : 'rgba(255,255,255,0.05)',
                                  border: isActive ? activeBorder : '1px solid rgba(255,255,255,0.1)',
                                  color: isActive ? activeColor : 'var(--text-muted)',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Genres */}
                  {selectedAnime.genres.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                      {selectedAnime.genres.map((g) => (
                        <span
                          key={g}
                          style={{
                            fontSize: 10, padding: '2px 8px',
                            borderRadius: 4,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.09)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Synopsis */}
                  {selectedAnime.synopsis && (
                    <p style={{
                      fontSize: 12, color: 'rgba(255,255,255,0.65)',
                      lineHeight: 1.6, margin: 0, maxWidth: 560,
                    }}>
                      {selectedAnime.synopsis.slice(0, 280)}{selectedAnime.synopsis.length > 280 ? '...' : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content: Episodes + Player Preview */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
              {/* Episodes panel */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tv size={15} style={{ color: '#6366f1' }} />
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: 0 }}>
                      Épisodes
                      {episodesData && (
                        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                          {episodesData.total_episodes} au total
                        </span>
                      )}
                    </h2>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => setEpisodeListMode('grid')}
                      style={{
                        width: 30, height: 30, borderRadius: 6,
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: episodeListMode === 'grid' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                        color: episodeListMode === 'grid' ? '#818cf8' : 'var(--text-muted)',
                      }}
                    >
                      <Grid size={13} />
                    </button>
                    <button
                      onClick={() => setEpisodeListMode('list')}
                      style={{
                        width: 30, height: 30, borderRadius: 6,
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: episodeListMode === 'list' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                        color: episodeListMode === 'list' ? '#818cf8' : 'var(--text-muted)',
                      }}
                    >
                      <List size={13} />
                    </button>
                  </div>
                </div>

                {isLoadingEpisodes ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    <Loader2 size={18} className="animate-spin" /> Chargement des épisodes...
                  </div>
                ) : episodesData && episodesData.episodes.length > 0 ? (
                  episodeListMode === 'grid' ? (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))',
                      gap: 6,
                      maxHeight: 340,
                      overflowY: 'auto',
                      paddingRight: 4,
                    }}>
                      {episodesData.episodes.map((ep) => {
                        const isSelected = selectedEpisode?.episode === ep.episode;
                        return (
                          <button
                            key={ep.episode}
                            onClick={() => handleSelectEpisode(ep)}
                            onDoubleClick={() => handlePlayEpisode(ep, selectedHost)}
                            title={`Ép. ${ep.episode} — Double-clic pour lire`}
                            style={{
                              padding: '10px 4px',
                              borderRadius: 8,
                              border: isSelected ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                              background: isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                              color: isSelected ? '#c7d2fe' : 'var(--text-muted)',
                              fontSize: 12,
                              fontWeight: isSelected ? 700 : 400,
                              cursor: 'pointer',
                              transition: 'all 0.12s',
                              position: 'relative',
                            }}
                          >
                            {isSelected && (
                              <span style={{
                                position: 'absolute', top: 4, right: 4,
                                width: 6, height: 6, borderRadius: '50%',
                                background: '#6366f1',
                              }} />
                            )}
                            {ep.episode}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                      {episodesData.episodes.map((ep) => {
                        const isSelected = selectedEpisode?.episode === ep.episode;
                        const hosts = Object.keys(ep.players);
                        return (
                          <div
                            key={ep.episode}
                            onClick={() => handleSelectEpisode(ep)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 14px',
                              borderRadius: 8,
                              border: isSelected ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
                              background: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                              cursor: 'pointer',
                              transition: 'all 0.12s',
                            }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: 6,
                              background: isSelected ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: isSelected ? '#818cf8' : 'var(--text-muted)',
                              fontSize: 12, fontWeight: 700, flexShrink: 0,
                            }}>
                              {ep.episode}
                            </div>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? 'white' : 'var(--text)' }}>
                                Épisode {ep.episode}
                              </span>
                              <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                                {hosts.slice(0, 3).map(h => (
                                  <span key={h} style={{ fontSize: 9, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 4 }}>
                                    {h}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePlayEpisode(ep, Object.keys(ep.players).find(h => h.includes('Sibnet')) || Object.keys(ep.players)[0]); }}
                              style={{
                                width: 28, height: 28, borderRadius: 6,
                                background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)',
                                color: '#818cf8', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <Play size={11} style={{ fill: 'currentColor', marginLeft: 1 }} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : !isLoadingEpisodes ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun épisode disponible pour cette saison.</p>
                ) : null}
              </div>

              {/* Right sidebar: selected episode action panel */}
              <div>
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12, overflow: 'hidden',
                  position: 'sticky', top: 80,
                }}>
                  {/* Selected episode info */}
                  {selectedEpisode ? (
                    <>
                      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Épisode sélectionné
                        </span>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginTop: 2 }}>
                          Ép. {selectedEpisode.episode}
                        </div>
                        {selectedSeason && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{selectedSeason.season_title || selectedSeason.name.replace(/\s*\((?:VOSTFR|VF)\)/i, '')}</span>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                              background: (selectedSeason.is_vf || selectedSeason.lang === 'VF') ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)',
                              color: (selectedSeason.is_vf || selectedSeason.lang === 'VF') ? '#f59e0b' : '#818cf8',
                              border: (selectedSeason.is_vf || selectedSeason.lang === 'VF') ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(99,102,241,0.3)',
                            }}>
                              {selectedSeason.lang || (selectedSeason.is_vf ? 'VF' : 'VOSTFR')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Host selector */}
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
                          Lecteur vidéo
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {Object.keys(selectedEpisode.players).map((host) => {
                            const isActive = selectedHost === host;
                            return (
                              <button
                                key={host}
                                onClick={() => setSelectedHost(host)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '8px 12px', borderRadius: 8,
                                  border: isActive ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
                                  background: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                                  color: isActive ? '#c7d2fe' : 'var(--text-muted)',
                                  cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 600 : 400,
                                  transition: 'all 0.12s', textAlign: 'left',
                                }}
                              >
                                {renderHostIcon(host)}
                                <span style={{ flex: 1 }}>{host}</span>
                                {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button
                          onClick={() => handlePlayEpisode()}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '11px 16px',
                            borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: 'white', fontSize: 13, fontWeight: 700,
                            boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
                            transition: 'all 0.15s',
                          }}
                        >
                          <Play size={14} style={{ fill: 'currentColor' }} />
                          Regarder
                        </button>

                        <button
                          onClick={handleDownloadEpisode}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '9px 16px',
                            borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'var(--text)', fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          <Download size={13} />
                          Télécharger
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      <Tv size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                      <p style={{ margin: 0 }}>Sélectionne un épisode</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // BROWSE VIEW (main catalogue)
  // ============================================================
  const displayList = searchResults ?? trending;
  const isShowingSearch = !!searchResults;

  return (
    <div className="page-wide">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clapperboard size={20} style={{ color: '#6366f1' }} />
          <h1 className="page-title" style={{ margin: 0 }}>Anime Hub</h1>
          <span style={{
            fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
            color: '#818cf8', background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 99, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            Anime-Sama · VOSTFR &amp; VF
          </span>
        </div>
        <p className="page-subtitle">Catalogue intégral Anime-Sama — streaming &amp; téléchargement sans pub</p>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', maxWidth: 600, marginBottom: 28 }}>
        <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="input-field"
          value={searchQuery}
          onChange={handleSearchInput}
          placeholder="Rechercher un anime (Solo Leveling, One Piece, Bleach...)"
          style={{ paddingLeft: 42, paddingRight: 42, height: 44, fontSize: 13 }}
        />
        {isSearching ? (
          <Loader2 size={14} className="animate-spin" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        ) : searchQuery ? (
          <button
            onClick={handleClearSearch}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {/* Hero Banner (only when browsing, not searching) */}
      {!isShowingSearch && spotlightAnime && !isLoadingTrending && (
        <div
          style={{
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 32,
            height: 200,
            cursor: 'pointer',
            background: '#0d0d16',
          }}
          onClick={() => handleOpenAnime(spotlightAnime.slug)}
        >
          {/* Background image */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${spotlightAnime.thumbnail})`,
            backgroundSize: 'cover', backgroundPosition: 'center top',
            opacity: 0.35,
            transition: 'opacity 0.5s',
          }} />
          {/* Gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(10,10,20,0.98) 0%, rgba(10,10,20,0.7) 60%, rgba(10,10,20,0.1) 100%)',
          }} />
          {/* Content */}
          <div style={{ position: 'relative', zIndex: 2, padding: '28px 32px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sparkles size={12} style={{ color: '#818cf8' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                À la une
              </span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'white', margin: '0 0 12px 0', letterSpacing: '-0.5px', textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}>
              {spotlightAnime.title}
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 700,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', padding: '7px 16px', borderRadius: 8,
                boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
              }}>
                <Play size={12} style={{ fill: 'currentColor' }} /> Voir les épisodes
              </span>
            </div>
          </div>

          {/* Hero navigation dots */}
          <div style={{
            position: 'absolute', bottom: 14, right: 16, zIndex: 3,
            display: 'flex', gap: 5,
          }}>
            {trending.slice(0, 5).map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setHeroIndex(i); }}
                style={{
                  width: heroIndex === i ? 20 : 6, height: 6,
                  borderRadius: 99, border: 'none', cursor: 'pointer',
                  background: heroIndex === i ? '#6366f1' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.25s',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          {isShowingSearch
            ? `Résultats pour « ${searchQuery} » (${displayList.length})`
            : 'Tendances & Populaires'
          }
        </h2>
        {isShowingSearch && (
          <button className="btn btn-ghost" onClick={handleClearSearch} style={{ fontSize: 11 }}>
            Effacer la recherche
          </button>
        )}
      </div>

      {/* Anime Grid */}
      {isLoadingTrending && !isShowingSearch ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={28} className="animate-spin" style={{ color: '#6366f1' }} />
        </div>
      ) : displayList.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon"><Film size={32} /></div>
          <h3>Aucun anime trouvé</h3>
          <p>Essaie avec un autre titre (nom français ou japonais).</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
          gap: 14,
        }}>
          {displayList.map((anime) => (
            <div
              key={anime.slug}
              onClick={() => handleOpenAnime(anime.slug)}
              className="card card-hover"
              style={{
                padding: 0, borderRadius: 10,
                overflow: 'hidden', cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#0d0d12', overflow: 'hidden' }}>
                <img
                  src={anime.thumbnail}
                  alt={anime.title}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.28s ease' }}
                  onError={(e) => {
                    const slug = anime.slug;
                    (e.target as HTMLImageElement).src = `https://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/contenu/thumb/${slug}.webp`;
                  }}
                />
                <div className="anime-card-overlay" style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.2s ease',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.95)',
                    color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  }}>
                    <Play size={18} style={{ fill: 'currentColor', marginLeft: 2 }} />
                  </div>
                </div>
              </div>
              <div style={{ padding: '10px 11px', flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {anime.title}
                </span>
                {'alt_title' in anime && anime.alt_title && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                    {(anime as any).alt_title}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
