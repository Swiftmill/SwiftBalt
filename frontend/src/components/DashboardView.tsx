import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Download, CheckCircle, HardDrive, HardDriveDownload } from 'lucide-react';
import { getStats } from '../services/api';
import type { DashboardStats } from '../types';

export const DashboardView: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    getStats().then(setStats);
  }, []);

  const formatStorage = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <LayoutDashboard size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Tableau de Bord & Statistiques</h1>
          <p className="text-zinc-400 text-xs">Aperçu global de l'activité du serveur SwiftBalt.</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
              <span>Téléchargements Totaux</span>
              <Download size={18} className="text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white">{stats.total_downloads}</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
              <span>Actifs / En cours</span>
              <HardDriveDownload size={18} className="text-purple-400" />
            </div>
            <div className="text-3xl font-black text-white">{stats.active_downloads}</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
              <span>Terminés</span>
              <CheckCircle size={18} className="text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white">{stats.completed_downloads}</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
              <span>Espace Stocké</span>
              <HardDrive size={18} className="text-amber-400" />
            </div>
            <div className="text-3xl font-black text-white">{formatStorage(stats.storage_used_bytes)}</div>
          </div>
        </div>
      )}
    </div>
  );
};
