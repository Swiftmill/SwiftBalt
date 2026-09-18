import React, { useState, useEffect } from 'react';
import { Settings, Folder, Cpu, Shield } from 'lucide-react';
import { getSettings } from '../services/api';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<any | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <Settings size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Paramètres de Configuration</h1>
          <p className="text-zinc-400 text-xs">Configuration globale du serveur et du stockage SwiftBalt.</p>
        </div>
      </div>

      {settings && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2 flex items-center gap-2">
              <Folder size={18} className="text-indigo-400" /> Dossiers & Stockage
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Nom de l'Application</label>
                <input
                  type="text"
                  value={settings.app_name}
                  disabled
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Dossier de Téléchargement</label>
                <input
                  type="text"
                  value={settings.download_dir}
                  disabled
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2 flex items-center gap-2">
              <Cpu size={18} className="text-indigo-400" /> Téléchargements & File d'attente
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Téléchargements Simultanés Max</label>
                <input
                  type="number"
                  value={settings.max_concurrent_downloads}
                  disabled
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Taille Fichier Max (GB)</label>
                <input
                  type="number"
                  value={settings.max_file_size_gb}
                  disabled
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-2 flex items-center gap-2">
              <Shield size={18} className="text-indigo-400" /> Sécurité & Réseau
            </h2>
            <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-sm">
              <div>
                <div className="font-semibold text-white">Protection SSRF (Blocage IPs Privées)</div>
                <div className="text-xs text-zinc-500">Bloque l'accès aux réseaux 127.0.0.1, 10.0.0.0/8, etc.</div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-full">
                {settings.block_private_ips ? 'Activé' : 'Désactivé'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
