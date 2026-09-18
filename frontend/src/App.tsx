import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { TwitchView } from './components/TwitchView';
import { TorrentView } from './components/TorrentView';
import { DownloadsView } from './components/DownloadsView';
import { HistoryView } from './components/HistoryView';
import { ProvidersView } from './components/ProvidersView';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { getDownloads, getTorrents } from './services/api';
import type { DownloadTask, TorrentTask } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('downloader');
  const [downloads, setDownloads] = useState<DownloadTask[]>([]);
  const [torrents, setTorrents] = useState<TorrentTask[]>([]);

  const refreshDownloads = async () => {
    try {
      const tasks = await getDownloads();
      setDownloads(tasks);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshTorrents = async () => {
    try {
      const list = await getTorrents();
      setTorrents(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    refreshDownloads();
    refreshTorrents();

    // WebSocket connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'download_update') {
          setDownloads((prev) => {
            const idx = prev.findIndex((t) => t.id === data.task.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = data.task;
              return updated;
            }
            return [data.task, ...prev];
          });
        } else if (data.type === 'torrent_update') {
          setTorrents((prev) => {
            const idx = prev.findIndex((t) => t.id === data.torrent.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = data.torrent;
              return updated;
            }
            return [data.torrent, ...prev];
          });
        }
      } catch (err) {
        console.error(err);
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  const activeDownloadsCount = downloads.filter((d) =>
    ['downloading', 'queued', 'converting', 'processing'].includes(d.status)
  ).length;

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeDownloadsCount={activeDownloadsCount}
      />

      <main className="flex-1">
        {activeTab === 'downloader' && (
          <HomeView onDownloadStarted={() => setActiveTab('queue')} />
        )}
        {activeTab === 'twitch' && (
          <TwitchView onDownloadStarted={() => setActiveTab('queue')} />
        )}
        {activeTab === 'torrent' && (
          <TorrentView torrents={torrents} onRefresh={refreshTorrents} />
        )}
        {activeTab === 'queue' && (
          <DownloadsView tasks={downloads} onRefresh={refreshDownloads} />
        )}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'providers' && <ProvidersView />}
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        <p>SwiftBalt Universal Media Platform — Minimalist & High Performance</p>
      </footer>
    </div>
  );
}

export default App;
