import React, { useState, useRef, useEffect } from 'react';
import {
  X, Play, Pause, Volume2, VolumeX,
  Maximize, Minimize, Download, Gauge, Tv, RotateCcw,
} from 'lucide-react';
import Hls from 'hls.js';
import { PlayerInfo, SubtitleTrack } from '../types';
import { watchHistoryService, formatTimeSeconds } from '../services/watchHistory';

interface MediaPlayerModalProps {
  player: PlayerInfo;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
  initialTime?: number;
}

export const MediaPlayerModal: React.FC<MediaPlayerModalProps> = ({
  player,
  isOpen,
  onClose,
  onDownload,
  initialTime,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const resumeNoticeTimeoutRef = useRef<number | null>(null);
  const lastSaveRef = useRef<number>(0);
  const hasRestoredTimeRef = useRef<boolean>(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSubtitle] = useState<string>('none');
  const [showControls, setShowControls] = useState(true);
  const [resumeNotice, setResumeNotice] = useState<{ time: number; text: string } | null>(null);

  const saveCurrentProgress = () => {
    if (!videoRef.current || !player?.stream_url) return;
    const ct = videoRef.current.currentTime;
    const dur = videoRef.current.duration || player.duration || 0;
    if (ct > 1) {
      watchHistoryService.saveProgress({
        stream_url: player.stream_url,
        url: player.url,
        title: player.title,
        thumbnail: player.thumbnail,
        platform: player.platform,
        duration: dur,
        currentTime: ct,
      });
    }
  };

  const applyResumeTime = () => {
    if (hasRestoredTimeRef.current || !videoRef.current) return;
    const saved = watchHistoryService.getItem(player.url || player.stream_url);
    const target = initialTime ?? player.initial_time ?? (saved && saved.currentTime > 4 && !saved.completed ? saved.currentTime : 0);

    if (target && target > 2) {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
      hasRestoredTimeRef.current = true;
      setResumeNotice({ time: target, text: `Reprise à ${formatTimeSeconds(target)}` });
      if (resumeNoticeTimeoutRef.current) clearTimeout(resumeNoticeTimeoutRef.current);
      resumeNoticeTimeoutRef.current = window.setTimeout(() => {
        setResumeNotice(null);
      }, 5000);
    } else {
      hasRestoredTimeRef.current = true;
    }
  };

  const restartFromBeginning = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      saveCurrentProgress();
    }
    setResumeNotice(null);
  };

  // Reset restore flag when player URL changes
  useEffect(() => {
    hasRestoredTimeRef.current = false;
    setResumeNotice(null);
  }, [player?.stream_url]);

  // Sync fullscreen state
  useEffect(() => {
    const handleFs = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  // Save progress on unmount / close
  useEffect(() => {
    return () => {
      saveCurrentProgress();
      if (resumeNoticeTimeoutRef.current) clearTimeout(resumeNoticeTimeoutRef.current);
    };
  }, [player?.stream_url]);

  // HLS stream playback setup
  useEffect(() => {
    if (!isOpen || !player?.stream_url || !videoRef.current) return;
    const video = videoRef.current;
    const isHls = player.stream_url.includes('.m3u8') || player.type === 'hls';

    let hlsInstance: Hls | null = null;

    if (isHls) {
      if (Hls.isSupported()) {
        hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsInstance.loadSource(player.stream_url);
        hlsInstance.attachMedia(video);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          applyResumeTime();
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = player.stream_url;
        applyResumeTime();
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else {
      video.src = player.stream_url;
      applyResumeTime();
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [isOpen, player?.stream_url]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      switch (e.code) {
        case 'Space':      e.preventDefault(); togglePlay();      break;
        case 'KeyF':       e.preventDefault(); toggleFullscreen(); break;
        case 'KeyM':       e.preventDefault(); toggleMute();      break;
        case 'ArrowRight': e.preventDefault(); seekDelta(5);      break;
        case 'ArrowLeft':  e.preventDefault(); seekDelta(-5);     break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            onClose();
          }
          break;
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [isOpen, isPlaying, volume, isMuted]);

  // Controls and cursor auto-hide timer
  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 2400);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 600);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      resetControlsTimer();
    } else {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
      resetControlsTimer();
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (v: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = v;
    setVolume(v);
    setIsMuted(v === 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (videoRef.current) { videoRef.current.currentTime = t; setCurrentTime(t); }
  };

  const seekDelta = (s: number) => {
    if (!videoRef.current) return;
    const t = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + s));
    videoRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await videoRef.current.requestPictureInPicture();
    } catch { /* ignore */ }
  };

  const fmtTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    saveCurrentProgress();
    onClose();
  };

  if (!isOpen) return null;

  const btnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 8, border: 'none',
    background: 'rgba(255,255,255,0.08)', color: 'white',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.12s',
  };

  const shouldHideCursor = !showControls && isPlaying;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div
        ref={containerRef}
        className={`media-player-container${shouldHideCursor ? ' hide-cursor' : ''}`}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: isFullscreen ? '100vw' : 840,
          maxHeight: isFullscreen ? '100vh' : undefined,
          background: '#000',
          borderRadius: isFullscreen ? 0 : 20,
          overflow: 'hidden',
          border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: isFullscreen ? 'none' : '0 24px 80px rgba(0,0,0,0.8)',
          cursor: shouldHideCursor ? 'none' : 'default',
        }}
        onMouseMove={resetControlsTimer}
        onMouseLeave={handleMouseLeave}
      >
        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
          padding: '14px 16px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'opacity 0.25s ease-in-out',
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'all' : 'none',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
            {player.title || 'Lecteur'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {onDownload && (
              <button style={btnStyle} onClick={onDownload} title="Télécharger">
                <Download size={14} />
              </button>
            )}
            <button style={btnStyle} onClick={handleClose} title="Fermer (Échap)">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Resume notification banner */}
        {resumeNotice && (
          <div style={{
            position: 'absolute',
            top: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '7px 14px',
            background: 'rgba(15, 15, 20, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 20,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
            transition: 'opacity 0.2s ease',
            opacity: showControls || !isPlaying ? 1 : 0.7,
            pointerEvents: 'all',
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#f1f1f1' }}>
              {resumeNotice.text}
            </span>
            <button
              onClick={restartFromBeginning}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                borderRadius: 12,
                padding: '3px 10px',
                color: '#c4b5fd',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.22)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
            >
              <RotateCcw size={11} />
              Recommencer au début
            </button>
            <button
              onClick={() => setResumeNotice(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 2,
              }}
              title="Masquer"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Video wrapper */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: isFullscreen ? '100vh' : undefined,
          aspectRatio: isFullscreen ? undefined : '16/9',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: shouldHideCursor ? 'none' : 'default',
        }}>
          {player.stream_url ? (
            <video
              ref={videoRef}
              poster={player.thumbnail || undefined}
              onLoadedMetadata={applyResumeTime}
              onCanPlay={applyResumeTime}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  const ct = videoRef.current.currentTime;
                  setCurrentTime(ct);
                  setDuration(videoRef.current.duration || 0);

                  const now = Date.now();
                  if (now - lastSaveRef.current > 2000) {
                    lastSaveRef.current = now;
                    saveCurrentProgress();
                  }
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => {
                setIsPlaying(false);
                setShowControls(true);
                saveCurrentProgress();
              }}
              onEnded={() => {
                setIsPlaying(false);
                setShowControls(true);
                saveCurrentProgress();
              }}
              onClick={togglePlay}
              onDoubleClick={(e) => {
                e.preventDefault();
                toggleFullscreen();
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                cursor: shouldHideCursor ? 'none' : 'pointer',
                display: 'block',
              }}
              playsInline
              autoPlay
            >
              {player.subtitles?.map((sub: SubtitleTrack, idx: number) => (
                <track key={idx} kind="subtitles" label={sub.lang} src={sub.url} default={selectedSubtitle === sub.lang} />
              ))}
            </video>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>Prévisualisation non disponible</p>
              <p style={{ fontSize: 12 }}>Télécharge le fichier pour le lire localement.</p>
            </div>
          )}
        </div>

        {/* Controls */}
        {player.stream_url && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
            padding: '12px 16px 16px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.6), transparent)',
            display: 'flex', flexDirection: 'column', gap: 10,
            transition: 'opacity 0.25s ease-in-out',
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? 'all' : 'none',
          }}>
            {/* Seek bar */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              style={{ width: '100%', accentColor: 'white', cursor: 'pointer', height: 3 }}
            />

            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button style={btnStyle} onClick={togglePlay}>
                  {isPlaying ? <Pause size={14} style={{ fill: 'white' }} /> : <Play size={14} style={{ fill: 'white' }} />}
                </button>
                <button style={btnStyle} onClick={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  style={{ width: 64, accentColor: 'white', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.6)' }}>
                  {fmtTime(currentTime)} / {fmtTime(duration)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '4px 8px' }}>
                  <Gauge size={11} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  <select
                    value={playbackRate}
                    onChange={(e) => {
                      const r = parseFloat(e.target.value);
                      if (videoRef.current) videoRef.current.playbackRate = r;
                      setPlaybackRate(r);
                    }}
                    style={{ background: 'transparent', color: 'white', fontSize: 11, border: 'none', outline: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                      <option key={r} value={r} style={{ background: '#111' }}>{r}x</option>
                    ))}
                  </select>
                </div>
                <button style={btnStyle} onClick={togglePiP} title="Picture-in-Picture">
                  <Tv size={13} />
                </button>
                <button style={btnStyle} onClick={toggleFullscreen} title="Plein écran (F ou double-clic)">
                  {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
