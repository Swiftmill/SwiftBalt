import React, { useState, useEffect } from 'react';
import { Star, Trash2, ArrowDownToLine, Film } from 'lucide-react';
import { FavoriteItem } from '../types';
import { api } from '../services/api';

interface FavoritesPageProps {
  onAnalyze: (url: string) => void;
}

const fmtDuration = (s?: number) => {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
};

export const FavoritesPage: React.FC<FavoritesPageProps> = ({ onAnalyze }) => {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    api.getFavorites().then(setFavorites).catch(() => {});
  }, []);

  const handleDelete = async (id: string) => {
    await api.deleteFavorite(id);
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="page-wide">
      <div className="page-header">
        <h1 className="page-title">Favoris</h1>
        <p className="page-subtitle">Liens épinglés pour un accès rapide</p>
      </div>

      {favorites.length === 0 ? (
        <div className="card empty-state" style={{ borderRadius: 'var(--radius-lg)' }}>
          <div className="empty-state-icon"><Star size={32} /></div>
          <h3>Aucun favori</h3>
          <p>Épingle des liens depuis la page d'accueil pour les retrouver ici.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {favorites.map((fav) => (
            <div
              key={fav.id}
              className="card card-hover"
              style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {/* Thumbnail */}
              <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--bg)', overflow: 'hidden' }}>
                {fav.thumbnail_url
                  ? <img src={fav.thumbnail_url} alt={fav.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)' }}><Film size={24} /></div>
                }
                <div style={{ position: 'absolute', top: 8, left: 8 }}>
                  <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 4 }}>
                    {fav.platform}
                  </span>
                </div>
                {fav.duration && (
                  <div style={{ position: 'absolute', bottom: 6, right: 6 }}>
                    <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: 'white', background: 'rgba(0,0,0,0.7)', padding: '2px 5px', borderRadius: 4 }}>
                      {fmtDuration(fav.duration)}
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                  {fav.title}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, fontSize: 11, padding: '6px 10px' }}
                    onClick={() => onAnalyze(fav.url)}
                  >
                    <ArrowDownToLine size={12} />
                    Télécharger
                  </button>
                  <button
                    className="dl-action-btn danger"
                    onClick={() => handleDelete(fav.id)}
                    title="Supprimer"
                  >
                    <Trash2 size={12} />
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
