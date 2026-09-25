import React, { useState, useEffect } from 'react';
import { UrlInput } from '../components/UrlInput';
import { PreviewCard } from '../components/PreviewCard';
import { MediaPlayerModal } from '../components/MediaPlayerModal';
import { AnalyzeResult, DownloadItem } from '../types';
import { api } from '../services/api';
import { wsService } from '../services/websocket';

interface HomePageProps {
  onDownloadStarted: (job?: DownloadItem) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onDownloadStarted }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzeData, setAnalyzeData] = useState<AnalyzeResult | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [activeJob, setActiveJob] = useState<DownloadItem | null>(null);

  const [quickMode, setQuickMode] = useState<'video' | 'audio'>('video');
  const [quickFormat, setQuickFormat] = useState<string>('mp4');
  const [quickQuality, setQuickQuality] = useState<string>('1080p');

  useEffect(() => {
    const handleUpdate = (updated: DownloadItem) => {
      setActiveJob((prev) => {
        if (prev && prev.id === updated.id) {
          if (updated.status === 'completed' && prev.status !== 'completed') {
            // Auto trigger browser download of the completed file
            const a = document.createElement('a');
            a.href = api.getDownloadFileUrl(updated.id);
            a.download = '';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
          return updated;
        }
        return prev;
      });
    };

    const unsub1 = wsService.on('download_progress', handleUpdate);
    const unsub2 = wsService.on('download_updated', handleUpdate);

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // Real-time polling fallback if active job is processing
  useEffect(() => {
    if (!activeJob || ['completed', 'failed', 'cancelled'].includes(activeJob.status)) {
      return;
    }
    const timer = setInterval(async () => {
      try {
        const list = await api.getDownloads();
        const found = list.find((d) => d.id === activeJob.id);
        if (found) {
          setActiveJob((prev) => {
            if (prev && prev.id === found.id) {
              if (found.status === 'completed' && prev.status !== 'completed') {
                const a = document.createElement('a');
                a.href = api.getDownloadFileUrl(found.id);
                a.download = '';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
              return found;
            }
            return prev;
          });
        }
      } catch {
        // ignore network error
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activeJob?.id, activeJob?.status]);

  const handleAnalyze = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setActiveJob(null);
    try {
      const result = await api.analyzeUrl(url);
      setAnalyzeData(result);
    } catch (err: any) {
      setError(err.message || 'Impossible d\'analyser ce lien.');
      setAnalyzeData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (format: string, quality: string) => {
    if (!analyzeData) return;
    try {
      const job = await api.createDownload({
        url: analyzeData.webpage_url,
        title: analyzeData.title,
        format: format,
        quality: quality === 'auto' ? '1080p' : quality,
        thumbnail_url: analyzeData.thumbnail,
        platform: analyzeData.platform,
      });
      setActiveJob(job);
      onDownloadStarted(job);
    } catch (err: any) {
      setError(err.message || 'Échec du lancement du téléchargement.');
    }
  };

  const handleSaveFavorite = async () => {
    if (!analyzeData) return;
    try {
      await api.addFavorite({
        url: analyzeData.webpage_url,
        title: analyzeData.title,
        platform: analyzeData.platform,
        thumbnail_url: analyzeData.thumbnail,
        duration: analyzeData.duration,
      });
    } catch {
      // ignore
    }
  };

  const videoFormats = ['mp4', 'webm', 'mkv'];
  const audioFormats = ['mp3', 'wav', 'm4a', 'opus', 'flac'];
  const qualities = ['2160p', '1440p', '1080p', '720p', '480p', '360p'];

  return (
    <div className="home-wrapper">
      {/* Hero */}
      <div className="home-hero">
        <h1>télécharge ce que tu veux</h1>
        <p>colle un lien, choisis ton format, c'est parti.</p>
      </div>

      {/* Download box */}
      <div className="download-box">
        <UrlInput
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
          error={error}
        />

        {/* Quick toggles */}
        <div className="quick-toggles">
          {/* Mode */}
          <button
            className={`toggle-btn${quickMode === 'video' ? ' active' : ''}`}
            onClick={() => { setQuickMode('video'); setQuickFormat('mp4'); }}
          >
            vidéo
          </button>
          <button
            className={`toggle-btn${quickMode === 'audio' ? ' active' : ''}`}
            onClick={() => { setQuickMode('audio'); setQuickFormat('wav'); }}
          >
            audio
          </button>

          <div className="toggle-divider" />

          {/* Formats */}
          {(quickMode === 'video' ? videoFormats : audioFormats).map((fmt) => (
            <button
              key={fmt}
              className={`toggle-btn${quickFormat === fmt ? ' active' : ''}`}
              onClick={() => setQuickFormat(fmt)}
            >
              {fmt}
            </button>
          ))}

          <div className="toggle-divider" />

          {/* Quality (only for video) */}
          {quickMode === 'video' && (
            <>
              {qualities.map((q) => (
                <button
                  key={q}
                  className={`toggle-btn${quickQuality === q ? ' active' : ''}`}
                  onClick={() => setQuickQuality(q)}
                >
                  {q}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Preview result */}
        {analyzeData && (
          <PreviewCard
            data={analyzeData}
            mode={quickMode}
            onModeChange={(m) => {
              setQuickMode(m);
              if (m === 'audio' && !audioFormats.includes(quickFormat)) {
                setQuickFormat('wav');
              } else if (m === 'video' && !videoFormats.includes(quickFormat)) {
                setQuickFormat('mp4');
              }
            }}
            format={quickFormat}
            onFormatChange={setQuickFormat}
            quality={quickQuality}
            onQualityChange={setQuickQuality}
            onDownload={handleDownload}
            onPlay={() => setIsPlayerOpen(true)}
            onSaveFavorite={handleSaveFavorite}
            activeJob={activeJob}
          />
        )}
      </div>

      {/* Player modal */}
      {analyzeData && (
        <MediaPlayerModal
          player={{
            ...analyzeData.player,
            url: analyzeData.webpage_url,
            platform: analyzeData.platform,
            title: analyzeData.player.title || analyzeData.title,
            thumbnail: analyzeData.player.thumbnail || analyzeData.thumbnail,
            duration: analyzeData.player.duration || analyzeData.duration,
          }}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
          onDownload={() => handleDownload(quickFormat, quickQuality)}
        />
      )}
    </div>
  );
};
