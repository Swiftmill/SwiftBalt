import React, { useState, useEffect } from 'react';
import { Boxes, Search, Globe } from 'lucide-react';
import { ProviderInfo } from '../types';
import { api } from '../services/api';

export const ProvidersPage: React.FC = () => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getProviders().then(setProviders).catch(() => {});
  }, []);

  const filtered = providers.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.domains.some((d) => d.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-wide">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title" style={{ margin: 0 }}>Services supportés</h1>
            <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 99, padding: '2px 8px' }}>
              {providers.length} disponibles
            </span>
          </div>
          <p className="page-subtitle">Statut et capacités des intégrations publiques</p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="input-field"
            style={{ paddingLeft: 30, width: 200, fontSize: 12 }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="provider-grid">
        {filtered.map((p) => (
          <div key={p.id} className="provider-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="provider-name">{p.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'block' }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Globe size={10} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
              <span className="provider-urls">{p.domains.slice(0, 2).join(', ')}</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
              {p.capabilities.map((cap) => (
                <span key={cap} className="preview-tag">{cap}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card empty-state" style={{ borderRadius: 'var(--radius-lg)', marginTop: 12 }}>
          <div className="empty-state-icon"><Boxes size={32} /></div>
          <h3>Aucun résultat</h3>
          <p>Essaie un autre terme de recherche.</p>
        </div>
      )}
    </div>
  );
};
