import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';

interface TopBarProps {
  onMenuOpen: () => void;
  isWsConnected: boolean;
  onLogoClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuOpen, isWsConnected, onLogoClick }) => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const isMobile = typeof navigator !== 'undefined' && (
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      (typeof window !== 'undefined' && 'ontouchstart' in window && !/Windows NT|Macintosh|Linux x86_64/i.test(navigator.userAgent))
    );
    const desktop = typeof window !== 'undefined' && !isMobile &&
      ('__TAURI_INTERNALS__' in window || window.location.hostname === 'tauri.localhost');
    setIsDesktop(desktop);
  }, []);

  const handleStartDrag = async (e: React.MouseEvent) => {
    // Only primary button (left click)
    if (e.button !== 0 || !isDesktop) return;

    // Check if clicked element or its parent is interactive
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, .topbar-brand, .window-control-btn, .menu-toggle')) {
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('window_start_dragging');
    } catch (err) {
      console.error(err);
    }
  };

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('window_minimize');
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('window_toggle_maximize');
      setIsMaximized((prev) => !prev);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('window_close');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header
      className="topbar"
      data-tauri-drag-region
      onMouseDown={handleStartDrag}
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('button, a, input, select, .topbar-brand, .window-control-btn, .menu-toggle')) {
          if (isDesktop) handleToggleMaximize();
        }
      }}
    >
      {/* Left: Menu button + Brand */}
      <div className="topbar-left">
        <button className="menu-toggle" onClick={onMenuOpen} aria-label="Ouvrir le menu">
          <Menu size={16} />
        </button>

        <div className="topbar-brand" onClick={onLogoClick} title="Retour à l'accueil">
          <div className="topbar-logo">
            <img src="logo.png" alt="SwiftBalt" />
          </div>
          <span className="topbar-name">swiftbalt</span>
          <span className="topbar-badge">v1</span>
        </div>
      </div>

      {/* Center: Draggable area with subtle title */}
      <div
        className="topbar-center"
        data-tauri-drag-region
        onMouseDown={handleStartDrag}
      >
        <span className="topbar-window-title">SwiftBalt</span>
      </div>

      {/* Right: Status badge + Custom Window Controls */}
      <div className="topbar-right">
        <div className="topbar-status" title={!isDesktop ? "SwiftBalt Cloud (iOS & Navigateur)" : (isWsConnected ? "Connecté au backend local" : "Connexion au backend...")}>
          <span className={`status-dot ${isWsConnected || !isDesktop ? 'online' : 'offline'}`} />
          <span>{isDesktop ? (isWsConnected ? 'online' : 'connecting') : 'online'}</span>
        </div>

        {isDesktop && (
          <div className="window-controls">
            <button
              type="button"
              className="window-control-btn btn-minimize"
              onClick={handleMinimize}
              title="Réduire"
              aria-label="Réduire la fenêtre"
            >
              <svg width="10" height="1" viewBox="0 0 10 1">
                <rect width="10" height="1" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className="window-control-btn btn-maximize"
              onClick={handleToggleMaximize}
              title={isMaximized ? 'Restaurer' : 'Agrandir'}
              aria-label="Agrandir ou restaurer la fenêtre"
            >
              {isMaximized ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2.5 1.5H8.5V7.5" stroke="currentColor" strokeWidth="1" />
                  <rect x="0.5" y="2.5" width="6.5" height="6.5" stroke="currentColor" strokeWidth="1" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="window-control-btn btn-close"
              onClick={handleClose}
              title="Fermer"
              aria-label="Fermer la fenêtre"
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
