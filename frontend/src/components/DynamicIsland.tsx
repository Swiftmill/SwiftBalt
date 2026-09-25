import React, { useState, useEffect } from 'react';
import { DownloadItem } from '../types';
import { ArrowDown, Check, Sparkles, X, ChevronDown, ExternalLink } from 'lucide-react';

interface DynamicIslandProps {
  downloads: DownloadItem[];
  onOpenDownloads: () => void;
}

export const DynamicIsland: React.FC<DynamicIslandProps> = ({ downloads, onOpenDownloads }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [completedNotification, setCompletedNotification] = useState<DownloadItem | null>(null);

  // Find the active downloading item
  const activeItem = downloads.find((d) =>
    ['downloading', 'processing', 'merging', 'converting', 'queued'].includes(d.status)
  );

  // Watch for completed items
  useEffect(() => {
    const recentlyCompleted = downloads.find((d) => d.status === 'completed');
    if (recentlyCompleted && !activeItem) {
      setCompletedNotification(recentlyCompleted);
      const timer = setTimeout(() => {
        setCompletedNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [downloads, activeItem]);

  const displayItem = activeItem || completedNotification;

  if (!displayItem) {
    return null;
  }

  const isCompleted = displayItem.status === 'completed';
  const progress = Math.min(100, Math.max(0, Math.round(displayItem.progress || 0)));

  const formatSpeed = (bytesPerSec?: number) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '';
    if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} Mo/s`;
    return `${(bytesPerSec / 1024).toFixed(0)} Ko/s`;
  };

  return (
    <div
      className={`dynamic-island-container ${isExpanded ? 'expanded' : 'compact'} ${isCompleted ? 'completed' : ''}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {!isExpanded ? (
        /* Compact Pill Mode */
        <div className="dynamic-island-compact">
          <div className="dynamic-island-compact-left">
            <div className={`dynamic-island-icon-badge ${isCompleted ? 'success' : 'pulsing'}`}>
              {isCompleted ? (
                <Check size={12} strokeWidth={3} className="text-green-400" />
              ) : (
                <ArrowDown size={12} strokeWidth={2.5} className="text-indigo-400 animate-bounce" />
              )}
            </div>
            <span className="dynamic-island-compact-title">
              {displayItem.platform.toUpperCase()}
            </span>
          </div>

          <div className="dynamic-island-compact-right">
            {isCompleted ? (
              <span className="dynamic-island-compact-status">Prêt</span>
            ) : (
              <div className="dynamic-island-progress-ring-wrap">
                <svg className="dynamic-island-ring" width="20" height="20" viewBox="0 0 24 24">
                  <circle
                    className="ring-bg"
                    cx="12"
                    cy="12"
                    r="9"
                    fill="none"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="2.5"
                  />
                  <circle
                    className="ring-bar"
                    cx="12"
                    cy="12"
                    r="9"
                    fill="none"
                    stroke="#5865f2"
                    strokeWidth="2.5"
                    strokeDasharray={56.5}
                    strokeDashoffset={56.5 - (56.5 * progress) / 100}
                    strokeLinecap="round"
                    transform="rotate(-90 12 12)"
                  />
                </svg>
                <span className="dynamic-island-compact-percent">{progress}%</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Expanded Dynamic Island Card */
        <div
          className="dynamic-island-expanded"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="dynamic-island-header">
            <div className="dynamic-island-header-left">
              <div className={`dynamic-island-icon-badge ${isCompleted ? 'success' : 'pulsing'}`}>
                {isCompleted ? <Check size={14} strokeWidth={3} /> : <Sparkles size={14} />}
              </div>
              <div className="dynamic-island-text-info">
                <div className="dynamic-island-expanded-title" title={displayItem.title}>
                  {displayItem.title || 'Téléchargement en cours...'}
                </div>
                <div className="dynamic-island-expanded-subtitle">
                  <span className="badge-platform">{displayItem.platform}</span>
                  <span>·</span>
                  <span className="badge-format">{displayItem.format.toUpperCase()}</span>
                  {displayItem.speed > 0 && (
                    <>
                      <span>·</span>
                      <span className="badge-speed">{formatSpeed(displayItem.speed)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              className="dynamic-island-close-btn"
              onClick={() => setIsExpanded(false)}
              aria-label="Réduire"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="dynamic-island-progress-track">
            <div
              className={`dynamic-island-progress-fill ${isCompleted ? 'bg-green' : 'bg-gradient'}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Footer details & quick action */}
          <div className="dynamic-island-footer">
            <span className="dynamic-island-status-text">
              {isCompleted
                ? '✅ Enregistré avec succès'
                : `${displayItem.status === 'processing' ? 'Conversion...' : 'Téléchargement...'} (${progress}%)`}
            </span>

            <button
              className="dynamic-island-action-btn"
              onClick={() => {
                setIsExpanded(false);
                onOpenDownloads();
              }}
            >
              <span>Voir tout</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
