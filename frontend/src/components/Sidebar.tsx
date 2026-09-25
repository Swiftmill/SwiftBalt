import React from 'react';
import {
  ArrowDownToLine,
  ListChecks,
  Tv2,
  Clapperboard,
  Magnet,
  History,
  Star,
  Boxes,
  BarChart3,
  Settings2,
  X,
  Zap,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onClose: () => void;
  activeDownloadsCount: number;
}

const NAV_ITEMS = [
  { id: 'home',      label: 'Téléchargeur',  icon: ArrowDownToLine },
  { id: 'downloads', label: 'File d\'attente', icon: ListChecks      },
  { id: 'anime',     label: 'Anime Hub',     icon: Clapperboard    },
  { id: 'twitch',    label: 'Twitch Hub',    icon: Tv2              },
  { id: 'torrent',   label: 'Torrents',      icon: Magnet           },
] as const;

const NAV_ITEMS_SECONDARY = [
  { id: 'history',   label: 'Historique',   icon: History  },
  { id: 'favorites', label: 'Favoris',      icon: Star     },
  { id: 'providers', label: 'Services',     icon: Boxes    },
  { id: 'dashboard', label: 'Statistiques', icon: BarChart3 },
  { id: 'settings',  label: 'Réglages',     icon: Settings2 },
] as const;

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  currentTab,
  onSelectTab,
  onClose,
  activeDownloadsCount,
}) => {
  return (
    <nav className={`nav-sidebar${isOpen ? ' open' : ''}`} aria-hidden={!isOpen}>
      {/* Header */}
      <div className="nav-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="topbar-logo" style={{ width: 22, height: 22, borderRadius: 5, overflow: 'hidden', padding: 0 }}>
            <img src="/logo.png" alt="SwiftBalt" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px' }}>swiftbalt</span>
        </div>
        <button className="nav-sidebar-close" onClick={onClose} aria-label="Fermer">
          <X size={15} />
        </button>
      </div>

      {/* Nav items */}
      <div className="nav-list">
        {/* Primary */}
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item${currentTab === id ? ' active' : ''}`}
            onClick={() => onSelectTab(id)}
          >
            <Icon className="nav-item-icon" size={15} />
            <span>{label}</span>
            {id === 'downloads' && activeDownloadsCount > 0 && (
              <span className="nav-badge">{activeDownloadsCount}</span>
            )}
          </button>
        ))}

        <div className="nav-separator" />

        {/* Secondary */}
        {NAV_ITEMS_SECONDARY.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item${currentTab === id ? ' active' : ''}`}
            onClick={() => onSelectTab(id)}
          >
            <Icon className="nav-item-icon" size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="nav-sidebar-footer">
        libre & open source
      </div>
    </nav>
  );
};
