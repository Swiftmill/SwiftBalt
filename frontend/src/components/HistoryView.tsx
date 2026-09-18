import React, { useState, useEffect } from 'react';
import { History, Trash2, ExternalLink } from 'lucide-react';
import { getHistory, clearHistory, getFavorites, deleteFavorite } from '../services/api';

export const HistoryView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'favorites'>('history');
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<any[]>([]);

  const loadData = async () => {
    const h = await getHistory();
    const f = await getFavorites();
    setHistoryItems(h);
    setFavoriteItems(f);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClearHistory = async () => {
    await clearHistory();
    setHistoryItems([]);
  };

  const handleDeleteFavorite = async (id: string) => {
    await deleteFavorite(id);
    setFavoriteItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Historique & Favoris</h1>
            <p className="text-zinc-400 text-xs">Retrouve tes téléchargements passés et tes liens enregistrés.</p>
          </div>
        </div>

        {/* Subtabs */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'history' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Historique ({historyItems.length})
          </button>
          <button
            onClick={() => setActiveSubTab('favorites')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'favorites' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Favoris ({favoriteItems.length})
          </button>
        </div>
      </div>

      {activeSubTab === 'history' ? (
        <div>
          {historyItems.length > 0 && (
            <div className="flex justify-end mb-4">
              <button
                onClick={handleClearHistory}
                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-2 transition"
              >
                <Trash2 size={14} /> Effacer l'historique
              </button>
            </div>
          )}

          {historyItems.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 text-sm">
              Aucun historique disponible.
            </div>
          ) : (
            <div className="space-y-3">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-bold text-white text-sm mb-1">{item.title}</h3>
                    <div className="text-xs text-zinc-500 flex items-center gap-3">
                      <span>Source : <strong className="text-indigo-400">{item.provider_id}</strong></span>
                      <span>Format : <strong className="text-zinc-300 uppercase">{item.target_format}</strong></span>
                    </div>
                  </div>
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition"
                    title="Ouvrir l'URL d'origine"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {favoriteItems.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 text-sm">
              Aucun favori enregistré.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {favoriteItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-4"
                >
                  {item.thumbnail_url && (
                    <img
                      src={item.thumbnail_url}
                      alt={item.title}
                      className="w-20 h-16 object-cover rounded-lg border border-zinc-800 shrink-0"
                    />
                  )}
                  <div className="flex-1 overflow-hidden">
                    <h3 className="font-bold text-white text-sm truncate mb-1">{item.title}</h3>
                    <p className="text-xs text-indigo-400 mb-2">{item.provider_id}</p>
                    <div className="flex items-center gap-2">
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-zinc-300 hover:text-white bg-zinc-800 px-2 py-1 rounded flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> Lien
                      </a>
                      <button
                        onClick={() => handleDeleteFavorite(item.id)}
                        className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-1 rounded"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
