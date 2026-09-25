import React from 'react';
import {
  ArrowDownToLine,
  Download,
  Tv,
  Magnet,
  History,
  Bookmark,
  Server,
  BarChart2,
  Sliders,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeDownloadsCount: number;
  isWsConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  activeDownloadsCount,
  isWsConnected,
}) => {
  const navItems = [
    { id: 'home', label: 'Téléchargeur', icon: ArrowDownToLine },
    { id: 'downloads', label: 'File d’attente', icon: Download, count: activeDownloadsCount },
    { id: 'twitch', label: 'Twitch', icon: Tv },
    { id: 'torrent', label: 'Torrents', icon: Magnet },
    { id: 'history', label: 'Historique', icon: History },
    { id: 'favorites', label: 'Favoris', icon: Bookmark },
    { id: 'providers', label: 'Services', icon: Server },
    { id: 'dashboard', label: 'Stats', icon: BarChart2 },
    { id: 'settings', label: 'Réglages', icon: Sliders },
  ];

  return (
    <header className="w-full border-b border-[#1e2029] bg-[#0c0d11]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand: cobalt aesthetic */}
        <div
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-2 cursor-pointer select-none group"
        >
          <span className="text-base font-black tracking-tight text-white group-hover:text-blue-400 transition-colors font-mono">
            swiftbalt
          </span>
          <span className="text-[10px] font-semibold text-zinc-400 bg-[#191a22] border border-[#272935] px-1.5 py-0.5 rounded-md">
            v1.0
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`relative px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-[#1e202a] text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#15161d]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
                {Boolean(item.count && item.count > 0) && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 px-2 py-1 rounded-md bg-[#13141a] border border-[#20222c]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isWsConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="hidden sm:inline font-mono">{isWsConnected ? 'online' : 'connecting'}</span>
          </div>
        </div>
      </div>

      {/* Mobile Bar */}
      <div className="md:hidden flex items-center overflow-x-auto px-2 py-1.5 gap-1 border-t border-[#1a1c24] bg-[#0c0d11]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${
                isActive ? 'bg-blue-600 text-white' : 'text-zinc-400 bg-[#14151b]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {Boolean(item.count && item.count > 0) && (
                <span className="ml-1 px-1 rounded-full text-[9px] bg-white text-blue-900 font-bold">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
