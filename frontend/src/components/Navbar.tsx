import React from 'react';
import { Download, Tv, HardDriveDownload, History, Server, LayoutDashboard, Settings, Layers } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeDownloadsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, activeDownloadsCount }) => {
  const navItems = [
    { id: 'downloader', label: 'Downloader', icon: Download },
    { id: 'twitch', label: 'Twitch Hub', icon: Tv },
    { id: 'torrent', label: 'Torrent Center', icon: HardDriveDownload },
    {
      id: 'queue',
      label: 'Downloads',
      icon: Layers,
      badge: activeDownloadsCount > 0 ? activeDownloadsCount : null,
    },
    { id: 'history', label: 'Historique', icon: History },
    { id: 'providers', label: 'Providers', icon: Server },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 bg-black/70 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div
          onClick={() => setActiveTab('downloader')}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            S
          </div>
          <span className="text-xl font-black tracking-tight text-white group-hover:text-indigo-400 transition-colors">
            SwiftBalt
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-indigo-400 text-black font-bold rounded-full animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Mobile menu indicator */}
        <div className="md:hidden flex items-center gap-2">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="bg-zinc-900 text-white border border-zinc-700 rounded-lg px-3 py-1.5 text-sm"
          >
            {navItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};
