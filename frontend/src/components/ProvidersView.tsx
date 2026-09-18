import React, { useState, useEffect } from 'react';
import { Server, CheckCircle2, Globe } from 'lucide-react';
import { getProviders } from '../services/api';
import type { ProviderStatus } from '../types';

export const ProvidersView: React.FC = () => {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);

  useEffect(() => {
    getProviders().then(setProviders);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <Server size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Statut des Fournisseurs (Providers)</h1>
          <p className="text-zinc-400 text-xs">
            Aperçu des services et modules de téléchargement supportés en temps réel par SwiftBalt.
          </p>
        </div>
      </div>

      {/* Grid of providers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {providers.map((p) => (
          <div
            key={p.id}
            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-indigo-400 font-bold">
                    {p.name.charAt(0)}
                  </div>
                  <h3 className="font-bold text-white text-base">{p.name}</h3>
                </div>
                <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={12} /> Actif
                </span>
              </div>

              <div className="text-xs text-zinc-400 space-y-1 mb-3">
                <div className="flex items-center gap-1 text-zinc-500">
                  <Globe size={12} />
                  <span className="truncate">{p.domains.length > 0 ? p.domains.join(', ') : 'URL Directe / Magnet'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1 border-t border-zinc-800/80 pt-2">
              {p.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="px-2 py-0.5 bg-zinc-800/80 text-zinc-400 text-[10px] rounded uppercase font-mono"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
