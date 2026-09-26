import React from 'react';
import { UpdateInfo, updaterService, detectPlatform } from '../services/updater';
import { Sparkles, Download, ExternalLink, X, CheckCircle2, Wrench, ShieldCheck } from 'lucide-react';

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

  const getPlatformLabel = () => {
    switch (platform) {
      case 'windows': return 'Windows';
      case 'linux': return 'Linux (AppImage / DEB)';
      case 'macos': return 'macOS';
      case 'ios': return 'iOS / iPad';
      default: return 'Web';
    }
  };

  const handleDownload = () => {
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

  return (
    <div className="update-modal-backdrop" onClick={onClose}>
      <div className="update-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          className="update-modal-close"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X size={18} />
        </button>

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

        {/* Footer Actions */}
        <div className="update-modal-footer">
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
              onClick={handleDownload}
            >
              <Download size={15} />
              <span>Mettre à jour maintenant</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
