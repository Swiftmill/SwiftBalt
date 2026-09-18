import React, { useState } from 'react';
import { Tv, Search, Download, Play, AlertCircle, Check } from 'lucide-react';
import { getTwitchInfo, startDownload } from '../services/api';
import { MediaPlayer } from './MediaPlayer';

interface TwitchViewProps {
  onDownloadStarted: () => void;
}

export const TwitchView: React.FC<TwitchViewProps> = ({ onDownloadStarted }) => {
  const [twitchUrl, setTwitchUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<any | null>(null);
  const [downloadQueued, setDownloadQueued] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);

  const handleSearch = async () => {
    if (!twitchUrl.trim()) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    setDownloadQueued(false);

    try {
      const data = await getTwitchInfo(twitchUrl.trim());
      setInfo(data);
    } catch (err: any) {
      setError(err.message || "Échec de la recherche sur Twitch.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!info) return;
    try {
      await startDownload({
        url: info.source_url,
        provider_id: 'twitch',
        title: `${info.channel} - ${info.title}`,
        thumbnail_url: info.thumbnail,
        target_format: 'mp4',
        audio_only: false,
      });
      setDownloadQueued(true);
      onDownloadStarted();
    } catch (err: any) {
      setError(err.message || "Échec du téléchargement.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
          <Tv size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Twitch Hub VOD & Clip Manager</h1>
          <p className="text-zinc-400 text-xs">
            Télécharge et visionne vos VODs, Replays et Clips publics Twitch en haute qualité.
          </p>
        </div>
      </div>

      {/* Twitch URL Input */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-3.5 text-zinc-500" />
          <input
            type="url"
            value={twitchUrl}
            onChange={(e) => setTwitchUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Colle une URL Twitch (ex: https://www.twitch.tv/videos/123456 ou clip...)"
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-zinc-500 outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !twitchUrl.trim()}
          className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Chercher'
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Info Card */}
      {info && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-col md:flex-row gap-6">
            {info.thumbnail && (
              <img
                src={info.thumbnail}
                alt={info.title}
                className="w-full md:w-64 h-40 object-cover rounded-xl border border-zinc-800"
              />
            )}

            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 uppercase mb-2">
                  Twitch {info.type}
                </div>
                <h2 className="text-xl font-bold text-white mb-1">{info.title}</h2>
                <p className="text-sm text-zinc-400 mb-4">Chaîne : <span className="text-purple-400 font-semibold">{info.channel}</span></p>

                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 bg-zinc-950 p-3 rounded-xl mb-4">
                  <div>Catégorie : <span className="text-white">{info.category || 'N/A'}</span></div>
                  <div>Durée : <span className="text-white">{info.duration ? `${Math.floor(info.duration / 60)} min` : 'N/A'}</span></div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPlayer(!showPlayer)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition"
                >
                  <Play size={18} />
                  <span>{showPlayer ? 'Masquer' : 'Visionner'}</span>
                </button>

                <button
                  onClick={handleDownload}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-purple-600/30"
                >
                  {downloadQueued ? (
                    <>
                      <Check size={18} />
                      <span>Ajouté aux Téléchargements</span>
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      <span>Télécharger VOD/Clip</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {showPlayer && (
            <div className="mt-6 border-t border-zinc-800 pt-4">
              <MediaPlayer src={info.formats[0]?.url || info.source_url} title={info.title} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
