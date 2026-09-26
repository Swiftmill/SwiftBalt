import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { HomePage } from './pages/HomePage';
import { DownloadsPage } from './pages/DownloadsPage';
import { TwitchHubPage } from './pages/TwitchHubPage';
import { AnimePage } from './pages/AnimePage';
import { TorrentCenterPage } from './pages/TorrentCenterPage';
import { HistoryPage } from './pages/HistoryPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { DownloadItem } from './types';
import { api } from './services/api';
import { wsService } from './services/websocket';
import { ArrowDownToLine, Home, Download, Tv, Settings as SettingsIcon } from 'lucide-react';
import { ToastContainer, ToastMessage } from './components/Toast';
import { DynamicIsland } from './components/DynamicIsland';
import { UpdateModal } from './components/UpdateModal';
import { updaterService, UpdateInfo } from './services/updater';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('home');
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const notifiedCompletedRef = useRef<Set<string>>(new Set());

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchDownloads = async () => {
    try {
      const data = await api.getDownloads();
      setDownloads(data);
    } catch {
      // ignore
    }
  };

  const handleDownloadStarted = (job?: DownloadItem) => {
    fetchDownloads();
    if (job) {
      addToast({
        type: 'info',
        title: 'Téléchargement lancé',
        message: `${job.title} · ${job.format.toUpperCase()}`,
        actionLabel: 'Ouvrir la file',
        onAction: () => navigate('downloads'),
      });
    }
  };

  useEffect(() => {
    fetchDownloads();
    wsService.connect();

    const unsubStatus = wsService.on('connection_status', (data) => {
      setIsWsConnected(data.connected);
    });

    const handleItemUpdate = (updatedItem: DownloadItem) => {
      setDownloads((prev) => {
        const index = prev.findIndex((item) => item.id === updatedItem.id);
        const prevItem = index >= 0 ? prev[index] : null;

        if (updatedItem.status === 'completed' && (!prevItem || prevItem.status !== 'completed')) {
          if (!notifiedCompletedRef.current.has(updatedItem.id)) {
            notifiedCompletedRef.current.add(updatedItem.id);
            addToast({
              type: 'success',
              title: 'Téléchargement prêt',
              message: `${updatedItem.title} · ${updatedItem.format.toUpperCase()}`,
              actionLabel: 'Enregistrer',
              onAction: () => {
                const a = document.createElement('a');
                a.href = api.getDownloadFileUrl(updatedItem.id);
                a.download = '';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              },
              duration: 5000,
            });
          }
        }

        if (index >= 0) {
          const newArr = [...prev];
          newArr[index] = { ...newArr[index], ...updatedItem };
          return newArr;
        }
        return prev;
      });
    };

    const unsubUpdated = wsService.on('download_updated', handleItemUpdate);
    const unsubProgress = wsService.on('download_progress', handleItemUpdate);

    const unsubQueued = wsService.on('download_queued', (newItem: DownloadItem) => {
      setDownloads((prev) => [newItem, ...prev.filter((d) => d.id !== newItem.id)]);
    });

    const unsubDeleted = wsService.on('download_deleted', (payload: { id: string }) => {
      setDownloads((prev) => prev.filter((d) => d.id !== payload.id));
    });

    const iv = setInterval(fetchDownloads, 2500);

    return () => {
      clearInterval(iv);
      unsubStatus();
      unsubUpdated();
      unsubProgress();
      unsubQueued();
      unsubDeleted();
    };
  }, []);

  useEffect(() => {
    // Check for updates in background shortly after load
    const timer = setTimeout(async () => {
      if (updaterService.isAutoCheckEnabled()) {
        try {
          const info = await updaterService.checkForUpdates(false);
          if (info.hasUpdate) {
            setUpdateInfo(info);
            setShowUpdateModal(true);
          }
        } catch {
          // ignore
        }
      }
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  const activeDownloads = downloads.filter((d) =>
    ['queued', 'processing', 'downloading', 'merging', 'converting'].includes(d.status)
  );

  const navigate = (tab: string) => {
    setCurrentTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* Dynamic Island for iOS & Mobile */}
      <DynamicIsland
        downloads={downloads}
        onOpenDownloads={() => navigate('downloads')}
      />

      {/* Top bar */}
      <TopBar
        onMenuOpen={() => setSidebarOpen(true)}
        isWsConnected={isWsConnected}
        onLogoClick={() => navigate('home')}
        availableUpdate={updateInfo}
        onOpenUpdateModal={() => setShowUpdateModal(true)}
      />

      {/* Sidebar overlay nav */}
      <Sidebar
        isOpen={sidebarOpen}
        currentTab={currentTab}
        onSelectTab={navigate}
        onClose={() => setSidebarOpen(false)}
        activeDownloadsCount={activeDownloads.length}
      />

      {/* Overlay */}
      <div
        className={`nav-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <main className="main-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentTab === 'home' && <HomePage onDownloadStarted={handleDownloadStarted} />}
        {currentTab === 'downloads' && (
          <DownloadsPage downloads={downloads} onRefresh={fetchDownloads} />
        )}
        {currentTab === 'anime' && <AnimePage onDownloadStarted={handleDownloadStarted} />}
        {currentTab === 'twitch' && <TwitchHubPage onDownloadStarted={handleDownloadStarted} />}
        {currentTab === 'torrent' && <TorrentCenterPage />}
        {currentTab === 'history' && (
          <HistoryPage onReanalyze={() => navigate('home')} />
        )}
        {currentTab === 'favorites' && (
          <FavoritesPage onAnalyze={() => navigate('home')} />
        )}
        {currentTab === 'providers' && <ProvidersPage />}
        {currentTab === 'dashboard' && <DashboardPage />}
        {currentTab === 'settings' && (
          <SettingsPage
            onOpenUpdateModal={(info) => {
              setUpdateInfo(info);
              setShowUpdateModal(true);
            }}
          />
        )}
      </main>

      {/* Floating active downloads badge */}
      {activeDownloads.length > 0 && currentTab !== 'downloads' && (
        <div className="floating-badge" onClick={() => navigate('downloads')}>
          <ArrowDownToLine size={13} style={{ color: 'var(--text-muted)' }} />
          <span>{activeDownloads.length} en cours</span>
          {activeDownloads[0]?.progress > 0 && (
            <span style={{ color: 'var(--text-muted)' }}>· {activeDownloads[0].progress}%</span>
          )}
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <button
          className={`mobile-nav-item${currentTab === 'home' ? ' active' : ''}`}
          onClick={() => navigate('home')}
        >
          <Home size={18} />
          <span>Accueil</span>
        </button>
        <button
          className={`mobile-nav-item${currentTab === 'downloads' ? ' active' : ''}`}
          onClick={() => navigate('downloads')}
        >
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <Download size={18} />
            {activeDownloads.length > 0 && (
              <span className="mobile-nav-badge">{activeDownloads.length}</span>
            )}
          </div>
          <span>Téléchargements</span>
        </button>
        <button
          className={`mobile-nav-item${currentTab === 'twitch' ? ' active' : ''}`}
          onClick={() => navigate('twitch')}
        >
          <Tv size={18} />
          <span>Twitch</span>
        </button>
        <button
          className={`mobile-nav-item${currentTab === 'settings' ? ' active' : ''}`}
          onClick={() => navigate('settings')}
        >
          <SettingsIcon size={18} />
          <span>Réglages</span>
        </button>
      </nav>

      {/* Real-time Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Software Update Modal */}
      {showUpdateModal && updateInfo && (
        <UpdateModal
          updateInfo={updateInfo}
          onClose={() => setShowUpdateModal(false)}
          onDismissVersion={() => {
            setUpdateInfo(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
