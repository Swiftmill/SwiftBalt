import React, { useState } from 'react';
import { ArrowRight, Clipboard, Download, Eye, Star, Check, Sparkles, AlertCircle } from 'lucide-react';
import { analyzeUrl, startDownload, addFavorite } from '../services/api';
import type { MediaMetadata } from '../types';
import { MediaPlayer } from './MediaPlayer';

interface HomeViewProps {
  onDownloadStarted: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onDownloadStarted }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);

  const [selectedFormat, setSelectedFormat] = useState<string>('mp4');
  const [showPlayer, setShowPlayer] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [downloadQueued, setDownloadQueued] = useState(false);

  const handleAnalyze = async (urlToAnalyze?: string) => {
    const targetUrl = (urlToAnalyze || url).trim();
    if (!targetUrl) return;

    setLoading(true);
    setError(null);
    setMetadata(null);
    setShowPlayer(false);
    setDownloadQueued(false);

    try {
      const res = await analyzeUrl(targetUrl);
      setMetadata(res.metadata);

      if (res.metadata.is_direct_file) {
        setSelectedFormat(res.metadata.available_formats[0]?.ext || 'mp4');
      }
    } catch (err: any) {
      setError(err.message || "Impossible d'analyser l'URL demandée.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        handleAnalyze(text);
      }
    } catch (err) {
      setError("Impossible d'accéder au presse-papier.");
    }
  };

  const handleDownload = async () => {
    if (!metadata) return;

    try {
      const isAudioOnly = ['mp3', 'm4a', 'wav', 'flac'].includes(selectedFormat);
      await startDownload({
        url: metadata.source_url,
        provider_id: metadata.provider_id,
        title: metadata.title,
        thumbnail_url: metadata.thumbnail,
        target_format: selectedFormat,
        audio_only: isAudioOnly,
      });

      setDownloadQueued(true);
      onDownloadStarted();
    } catch (err: any) {
      setError(err.message || "Échec du démarrage du téléchargement.");
    }
  };

  const handleAddFavorite = async () => {
    if (!metadata) return;
    try {
      await addFavorite({
        id: metadata.id,
        title: metadata.title,
        source_url: metadata.source_url,
        provider_id: metadata.provider_id,
        thumbnail_url: metadata.thumbnail,
      });
      setIsFavorited(true);
    } catch (err) {
      console.error(err);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Hero Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
          <Sparkles size={14} /> SwiftBalt Universal Downloader
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-3">
          Colle un lien, télécharge en un clic.
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto">
          Compatible avec TikTok, Twitch, YouTube, Twitter/X, Instagram, fichiers directs et des dizaines d'autres plateformes.
        </p>
      </div>

      {/* Main Cobalt-style URL Input */}
      <div className="relative mb-6">
        <div className="flex items-center bg-zinc-900 border-2 border-zinc-800 focus-within:border-indigo-500 rounded-2xl p-2 shadow-2xl transition-all">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            placeholder="Dépose ou colle ton lien ici (ex: https://...)"
            className="w-full bg-transparent text-white placeholder-zinc-500 px-4 py-3 outline-none text-base sm:text-lg"
          />
          <button
            onClick={handlePaste}
            className="hidden sm:flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-xl text-xs font-medium transition mr-2"
            title="Coller le presse-papier"
          >
            <Clipboard size={14} /> Ctrl + V
          </button>
          <button
            onClick={() => handleAnalyze()}
            disabled={loading || !url.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 transition shadow-lg shadow-indigo-600/30"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>GO</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start gap-3 text-red-400 text-sm">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Analysis Result Card */}
      {metadata && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Thumbnail */}
            {metadata.thumbnail && (
              <div className="md:w-64 shrink-0 relative rounded-xl overflow-hidden bg-black border border-zinc-800">
                <img
                  src={metadata.thumbnail}
                  alt={metadata.title}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-indigo-400 uppercase">
                  {metadata.provider_name}
                </div>
              </div>
            )}

            {/* Metadata Info */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="text-xl font-bold text-white line-clamp-2">{metadata.title}</h2>
                  <button
                    onClick={handleAddFavorite}
                    className={`p-2 rounded-lg border transition ${
                      isFavorited
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                    }`}
                    title="Ajouter aux favoris"
                  >
                    <Star size={18} fill={isFavorited ? 'currentColor' : 'none'} />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-zinc-400 mb-4 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                  <div>
                    <span className="text-zinc-500 block">Auteur</span>
                    <span className="text-zinc-200 font-medium">{metadata.author || 'Inconnu'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Durée</span>
                    <span className="text-zinc-200 font-medium">
                      {formatDuration(metadata.duration)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Source</span>
                    <span className="text-indigo-400 font-medium">{metadata.provider_name}</span>
                  </div>
                </div>
              </div>

              {/* Format & Quality Selector */}
              <div className="space-y-4">
                {/* Format selection */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                    Format de sortie
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['mp4', 'webm', 'mp3', 'm4a', 'wav', 'flac'].map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setSelectedFormat(fmt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition uppercase ${
                          selectedFormat === fmt
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => setShowPlayer(!showPlayer)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <Eye size={18} />
                    <span>{showPlayer ? 'Masquer' : 'Visionner'}</span>
                  </button>

                  <button
                    onClick={handleDownload}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/30"
                  >
                    {downloadQueued ? (
                      <>
                        <Check size={18} />
                        <span>Ajouté aux Téléchargements !</span>
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        <span>Télécharger</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Embedded Player */}
          {showPlayer && (
            <div className="mt-6 border-t border-zinc-800 pt-4">
              <MediaPlayer
                src={
                  metadata.available_formats[0]?.url ||
                  metadata.source_url
                }
                poster={metadata.thumbnail}
                title={metadata.title}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
