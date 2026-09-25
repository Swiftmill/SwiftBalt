import React, { useState, useEffect } from 'react';
import { BarChart3, HardDrive } from 'lucide-react';
import { DashboardStats } from '../types';
import { api } from '../services/api';

const fmtBytes = (b?: number) => {
  if (!b) return '0 Mo';
  const gb = b / 1073741824;
  if (gb >= 1) return `${gb.toFixed(1)} Go`;
  return `${(b / 1048576).toFixed(0)} Mo`;
};

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch(() => {});
    const iv = setInterval(() => api.getDashboardStats().then(setStats).catch(() => {}), 5000);
    return () => clearInterval(iv);
  }, []);

  const diskPct = stats?.disk_total_bytes
    ? Math.round((stats.disk_used_bytes / stats.disk_total_bytes) * 100)
    : 0;

  const maxTrend = Math.max(...(stats?.activity_trend?.map((t) => t.count) ?? [1]), 1);

  return (
    <div className="page-wide">
      <div className="page-header">
        <h1 className="page-title">Statistiques</h1>
        <p className="page-subtitle">Métriques d'usage et espace disque local</p>
      </div>

      {/* Stats row */}
      <div className="stats-grid">
        {[
          { label: "Aujourd'hui", value: stats?.downloads_today ?? 0 },
          { label: 'En cours',    value: stats?.active_downloads ?? 0 },
          { label: 'Terminés',    value: stats?.completed_downloads ?? 0 },
          { label: 'Échecs',      value: stats?.failed_downloads ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card">
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {/* Disk */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <HardDrive size={15} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Espace disque</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{diskPct}%</span>
          </div>
          <div className="progress-bar-wrap" style={{ height: 6 }}>
            <div
              className="progress-bar-fill"
              style={{ width: `${diskPct}%`, background: diskPct > 85 ? 'var(--red)' : diskPct > 60 ? 'var(--amber)' : 'var(--text)' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
            <span>utilisé · {fmtBytes(stats?.disk_used_bytes)}</span>
            <span>libre · {fmtBytes(stats?.disk_free_bytes)}</span>
          </div>
        </div>

        {/* Activity chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart3 size={15} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Activité · 7 jours</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 64 }}>
            {stats?.activity_trend?.map((item) => {
              const h = Math.max(8, Math.round((item.count / maxTrend) * 100));
              return (
                <div key={item.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${h}%`, background: 'var(--text)', borderRadius: 3, opacity: 0.7 }} />
                  <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-subtle)' }}>{item.day}</span>
                </div>
              );
            }) ?? (
              <span style={{ fontSize: 12, color: 'var(--text-subtle)', fontFamily: 'JetBrains Mono, monospace' }}>Aucune donnée</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
