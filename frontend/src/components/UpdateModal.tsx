import React, { useState } from 'react';
import { UpdateInfo, updaterService, detectPlatform } from '../services/updater';
import { Sparkles, Download, ExternalLink, X, CheckCircle2, Wrench, ShieldCheck, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

interface UpdateModalProps {
  updateInfo: UpdateInfo;
  onClose: () => void;
  onDismissVersion?: (version: string) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  updateInfo,
  onClose,
  onDismissVersion,
}) => {
  const platform = detectPlatform();
  const [installStatus, setInstallStatus] = useState<'idle' | 'downloading' | 'installing' | 'restarting' | 'error'>('idle');
  const [percent, setPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const getPlatformLabel = () => {
    switch (platform) {
      case 'windows': return 'Windows';
      case 'linux': return 'Linux (AppImage / DEB)';
      case 'macos': return 'macOS';
      case 'ios': return 'iOS / iPad';
      default: return 'Web';
    }
  };

  const handleAutoUpdate = async () => {
    setInstallStatus('downloading');
    setPercent(8);
    setStatusMessage('Démarrage du téléchargement...');
    setErrorMessage('');

    try {
      await updaterService.installAndRestartUpdate(updateInfo, (data) => {
        setInstallStatus(data.status);
        setPercent(data.percent);
        if (data.message) {
          setStatusMessage(data.message);
        } else if (data.status === 'downloading') {
          setStatusMessage(`Téléchargement de la mise à jour (${data.percent}%)...`);
        } else if (data.status === 'installing') {
          setStatusMessage('Installation silencieuse en cours...');
        } else if (data.status === 'restarting') {
          setStatusMessage('Redémarrage de SwiftBalt...');
        }
      });
    } catch (err: any) {
      setInstallStatus('error');
      setErrorMessage(typeof err === 'string' ? err : err?.message || 'Erreur lors de la mise à jour.');
    }
  };

  const handleManualDownload = () => {
    updaterService.openExternalUrl(updateInfo.downloadUrl);
    onClose();
  };

  const handleViewGithub = () => {
    updaterService.openExternalUrl(updateInfo.htmlUrl);
  };

  const handleIgnore = () => {
    if (onDismissVersion) {
      onDismissVersion(updateInfo.latestVersion);
    }
    updaterService.dismissUpdate(updateInfo.latestVersion);
    onClose();
  };

  const isWorking = installStatus === 'downloading' || installStatus === 'installing' || installStatus === 'restarting';

  return (
    <div className="update-modal-backdrop" onClick={isWorking ? undefined : onClose}>
      <div className="update-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Close Button (disabled while updating) */}
        {!isWorking && (
          <button
            className="update-modal-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        )}

        {/* Header with Glowing Icon */}
        <div className="update-modal-header">
          <div className="update-modal-icon-wrap">
            <Sparkles size={28} className="text-indigo-400" />
            <div className="update-modal-icon-glow" />
          </div>

          <div className="update-modal-titles">
            <span className="update-modal-badge">
              <ShieldCheck size={13} />
              Mise à jour disponible
            </span>
            <h2 className="update-modal-title">{updateInfo.releaseName}</h2>
            <div className="update-modal-version-row">
              <span className="version-pill current">v{updateInfo.currentVersion}</span>
              <span className="version-arrow">➔</span>
              <span className="version-pill target">v{updateInfo.latestVersion}</span>
              <span className="version-date">· {updateInfo.releaseDate}</span>
            </div>
          </div>
        </div>

        {/* Changelog & Highlights */}
        <div className="update-modal-content">
          {updateInfo.features.length > 0 && (
            <div className="update-section">
              <div className="update-section-title text-indigo-300">
                <CheckCircle2 size={15} className="text-indigo-400" />
                <span>Nouveautés & Ajouts</span>
              </div>
              <ul className="update-list">
                {updateInfo.features.map((feat, idx) => (
                  <li key={idx} className="update-list-item">
                    <span className="update-bullet-green">+</span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {updateInfo.fixes.length > 0 && (
            <div className="update-section">
              <div className="update-section-title text-amber-300">
                <Wrench size={15} className="text-amber-400" />
                <span>Correctifs & Améliorations</span>
              </div>
              <ul className="update-list">
                {updateInfo.fixes.map((fix, idx) => (
                  <li key={idx} className="update-list-item">
                    <span className="update-bullet-amber">✓</span>
                    <span>{fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Platform notice */}
          <div className="update-platform-notice">
            <span>Système détecté :</span>
            <strong>{getPlatformLabel()}</strong>
          </div>
        </div>

        {/* Footer Actions (Discord-style In-App Auto-Update) */}
        <div className="update-modal-footer">
          {installStatus === 'idle' ? (
            <>
              <div className="update-footer-left">
                <button
                  type="button"
                  className="update-btn-ghost"
                  onClick={handleIgnore}
                >
                  Ignorer cette version
                </button>
              </div>

              <div className="update-footer-right">
                <button
                  type="button"
                  className="update-btn-secondary"
                  onClick={handleViewGithub}
                >
                  <ExternalLink size={14} />
                  <span>Notes GitHub</span>
                </button>

                <button
                  type="button"
                  className="update-btn-primary"
                  onClick={handleAutoUpdate}
                >
                  <RefreshCw size={15} />
                  <span>Mettre à jour maintenant</span>
                </button>
              </div>
            </>
          ) : installStatus === 'error' ? (
            <div className="discord-update-error" style={{ width: '100%' }}>
              <div className="discord-update-error-row">
                <AlertCircle size={16} />
                <span>{errorMessage || 'Une erreur est survenue lors de la mise à jour.'}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="button"
                  className="update-btn-secondary"
                  onClick={handleManualDownload}
                >
                  <Download size={14} />
                  <span>Télécharger manuellement</span>
                </button>
                <button
                  type="button"
                  className="update-btn-primary"
                  onClick={handleAutoUpdate}
                >
                  <RefreshCw size={14} />
                  <span>Réessayer</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="discord-update-box">
              <div className="discord-update-top">
                <div className="discord-update-title-wrap">
                  <Loader2 size={16} className="discord-spinner" />
                  <span>{statusMessage || 'Mise à jour en cours...'}</span>
                </div>
                <span className="discord-update-pct">{percent}%</span>
              </div>

              <div className="discord-progress-track">
                <div
                  className="discord-progress-fill"
                  style={{ width: `${Math.max(percent, 6)}%` }}
                />
              </div>

              <div className="discord-steps-row">
                <span className={`discord-step ${installStatus === 'downloading' ? 'active' : percent > 90 ? 'done' : ''}`}>
                  {percent > 90 ? '✓' : '📥'} Téléchargement
                </span>
                <span className={`discord-step ${installStatus === 'installing' ? 'active' : installStatus === 'restarting' ? 'done' : ''}`}>
                  {installStatus === 'restarting' ? '✓' : '⚙️'} Installation
                </span>
                <span className={`discord-step ${installStatus === 'restarting' ? 'active' : ''}`}>
                  🚀 Redémarrage
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
