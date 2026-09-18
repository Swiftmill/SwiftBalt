import React from 'react';
import { Layers, Pause, Play, Trash2, Download, FileVideo } from 'lucide-react';
import type { DownloadTask } from '../types';
import { pauseDownload, resumeDownload, deleteDownload } from '../services/api';

interface DownloadsViewProps {
  tasks: DownloadTask[];
  onRefresh: () => void;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({ tasks, onRefresh }) => {
  const formatSpeed = (kbps: number) => {
    if (kbps >= 1024) {
      return `${(kbps / 1024).toFixed(1)} MB/s`;
    }
    return `${kbps.toFixed(0)} KB/s`;
  };

  const getStatusBadge = (status: DownloadTask['status']) => {
    switch (status) {
      case 'completed':
        return <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase">Terminé</span>;
      case 'downloading':
        return <span className="bg-indigo-500/20 text-indigo-400 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase animate-pulse">Téléchargement</span>;
      case 'converting':
        return <span className="bg-purple-500/20 text-purple-400 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase animate-pulse">Conversion FFmpeg</span>;
      case 'queued':
        return <span className="bg-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase">En attente</span>;
      case 'paused':
        return <span className="bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase">En Pause</span>;
      case 'failed':
        return <span className="bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase">Erreur</span>;
      default:
        return <span className="bg-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase">{status}</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Layers size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Gestionnaire de Téléchargements</h1>
            <p className="text-zinc-400 text-xs">Suivi en temps réel de vos fichiers et conversions.</p>
          </div>
        </div>
      </div>

      {/* Task Cards List */}
      {tasks.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-12 text-center text-zinc-500 text-sm">
          Aucun téléchargement dans la file d'attente.
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row gap-5 items-center justify-between"
            >
              {/* Thumbnail & Title */}
              <div className="flex items-center gap-4 w-full md:w-1/2">
                {task.thumbnail_url ? (
                  <img
                    src={task.thumbnail_url}
                    alt={task.title}
                    className="w-16 h-12 object-cover rounded-lg border border-zinc-800 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-12 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 shrink-0">
                    <FileVideo size={20} />
                  </div>
                )}
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-white text-sm truncate">{task.title}</h3>
                    {getStatusBadge(task.status)}
                  </div>
                  <div className="text-xs text-zinc-400 flex items-center gap-3 font-mono">
                    <span>Format: <strong className="text-indigo-400 uppercase">{task.target_format}</strong></span>
                    {task.speed_kbps > 0 && <span>Vitesse: {formatSpeed(task.speed_kbps)}</span>}
                  </div>
                </div>
              </div>

              {/* Progress & Actions */}
              <div className="w-full md:w-1/2 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1 font-mono">
                    <span>{task.progress}%</span>
                    <span>
                      {(task.downloaded_bytes / (1024 * 1024)).toFixed(1)} MB /{' '}
                      {task.total_bytes ? (task.total_bytes / (1024 * 1024)).toFixed(1) : '?'} MB
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        task.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>

                {/* Control buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {task.status === 'downloading' && (
                    <button
                      onClick={() => pauseDownload(task.id).then(onRefresh)}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded-lg transition"
                      title="Mettre en pause"
                    >
                      <Pause size={16} />
                    </button>
                  )}
                  {task.status === 'paused' && (
                    <button
                      onClick={() => resumeDownload(task.id).then(onRefresh)}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-lg transition"
                      title="Reprendre"
                    >
                      <Play size={16} />
                    </button>
                  )}
                  {task.status === 'completed' && task.file_path && (
                    <a
                      href={`/data/downloads/${task.file_path.split('/').pop()}`}
                      download
                      className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition flex items-center gap-1 text-xs font-bold px-3"
                    >
                      <Download size={14} /> Fichier
                    </a>
                  )}
                  <button
                    onClick={() => deleteDownload(task.id).then(onRefresh)}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 rounded-lg transition"
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
