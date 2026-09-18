import React, { useState } from 'react';
import { HardDriveDownload, Magnet, Pause, Play, Trash2, AlertCircle } from 'lucide-react';
import { addTorrent, pauseTorrent, resumeTorrent, deleteTorrent } from '../services/api';
import type { TorrentTask } from '../types';

interface TorrentViewProps {
  torrents: TorrentTask[];
  onRefresh: () => void;
}

export const TorrentView: React.FC<TorrentViewProps> = ({ torrents, onRefresh }) => {
  const [magnetInput, setMagnetInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddTorrent = async () => {
    if (!magnetInput.trim()) return;
    setLoading(true);
    setError(null);

    try {
      await addTorrent(magnetInput.trim());
      setMagnetInput('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Impossible d'ajouter le lien magnet / torrent.");
    } finally {
      setLoading(false);
    }
  };

  const formatSpeed = (kbps: number) => {
    if (kbps >= 1024) {
      return `${(kbps / 1024).toFixed(1)} MB/s`;
    }
    return `${kbps.toFixed(0)} KB/s`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <HardDriveDownload size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Torrent Center</h1>
          <p className="text-zinc-400 text-xs">
            Gestionnaire BitTorrent légal pour fichiers .torrent et liens Magnet distribués publiquement.
          </p>
        </div>
      </div>

      {/* Input Box */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-8 shadow-xl">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
          Lien Magnet ou URL .torrent
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Magnet size={18} className="absolute left-3 top-3.5 text-zinc-500" />
            <input
              type="text"
              value={magnetInput}
              onChange={(e) => setMagnetInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTorrent()}
              placeholder="Colle ton lien magnet (magnet:?xt=urn:btih:...)"
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-zinc-500 outline-none"
            />
          </div>
          <button
            onClick={handleAddTorrent}
            disabled={loading || !magnetInput.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-emerald-600/20"
          >
            {loading ? 'Chargement...' : 'Ajouter Torrent'}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Active Torrents Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white mb-2">Torrents Actifs ({torrents.length})</h2>

        {torrents.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-8 text-center text-zinc-500 text-sm">
            Aucun torrent en cours de téléchargement.
          </div>
        ) : (
          torrents.map((torrent) => (
            <div
              key={torrent.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-white text-base truncate">{torrent.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        torrent.status === 'completed' || torrent.status === 'seeding'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : torrent.status === 'paused'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-indigo-500/20 text-indigo-400 animate-pulse'
                      }`}
                    >
                      {torrent.status}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 flex flex-wrap gap-4">
                    <span>Vitesse DL: <strong className="text-white">{formatSpeed(torrent.download_speed_kbps)}</strong></span>
                    <span>Vitesse UL: <strong className="text-white">{formatSpeed(torrent.upload_speed_kbps)}</strong></span>
                    <span>Peers: <strong className="text-white">{torrent.num_peers}</strong></span>
                    <span>Seeds: <strong className="text-white">{torrent.num_seeds}</strong></span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                  {torrent.status === 'paused' ? (
                    <button
                      onClick={() => resumeTorrent(torrent.id).then(onRefresh)}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-lg transition"
                      title="Reprendre"
                    >
                      <Play size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => pauseTorrent(torrent.id).then(onRefresh)}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded-lg transition"
                      title="Mettre en pause"
                    >
                      <Pause size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteTorrent(torrent.id).then(onRefresh)}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 rounded-lg transition"
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1 font-mono">
                  <span>{torrent.progress}%</span>
                  <span>
                    {(torrent.downloaded_bytes / (1024 * 1024)).toFixed(1)} MB /{' '}
                    {(torrent.total_bytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${torrent.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
