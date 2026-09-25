import React, { useState, useEffect } from 'react';
import { Check, Save, Copy, FolderOpen, Smartphone, Laptop, Folder, Download, Monitor, Film, Zap } from 'lucide-react';
import { SettingsData } from '../types';
import { api } from '../services/api';

const Select: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({
  value, onChange, options,
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="settings-input"
    style={{ cursor: 'pointer', minWidth: 140 }}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <label className="toggle-switch">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="toggle-track" />
  </label>
);

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [folderOpenFeedback, setFolderOpenFeedback] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);

  const handlePickFolder = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const selected = await invoke<string | null>('pick_folder', { defaultPath: settings?.downloads_path });
      if (selected) {
        update({ downloads_path: selected });
      }
    } catch {
      // ignore
    }
  };

  const copyPath = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleOpenFolder = async () => {
    try {
      await api.openDownloadsFolder();
      setFolderOpenFeedback(true);
      setTimeout(() => setFolderOpenFeedback(false), 2200);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {});
  }, []);

  const update = (patch: Partial<SettingsData>) => {
    setSettings((prev) => prev ? { ...prev, ...patch } : null);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err: any) {
      setSaveError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
        Chargement...
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Réglages</h1>
          <p className="page-subtitle">Configuration du moteur de téléchargement et des répertoires</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isSaving}
          style={{ minWidth: 130 }}
        >
          {isSaved ? <Check size={14} style={{ color: 'var(--green)' }} /> : <Save size={14} />}
          {isSaved ? 'Enregistré' : isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {saveError && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 12.5, marginBottom: 20 }}>
          {saveError}
        </div>
      )}

      {/* Multi-Device Architecture Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(88,101,242,0.08) 0%, rgba(59,130,246,0.04) 100%)',
        border: '1px solid rgba(88,101,242,0.2)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 18px',
        marginBottom: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Smartphone size={15} />
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
            Adaptation Téléphone & Multi-Appareils
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
              <Smartphone size={13} style={{ color: 'var(--accent)' }} />
              <span>Sur Téléphone / Tablette</span>
            </div>
            Dès qu'un téléchargement est terminé, il est envoyé directement dans la mémoire de votre téléphone (dossier Téléchargements / Fichiers iOS & Android) sans dépendre des disques du PC.
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
              <Laptop size={13} style={{ color: 'var(--blue)' }} />
              <span>Sur votre PC hôte</span>
            </div>
            Les fichiers sont automatiquement enregistrés sur le disque dur du PC dans le dossier que vous choisissez librement ci-dessous.
          </div>
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Storage section */}
        <div className="settings-section">
          <p className="settings-section-title">Répertoires de stockage (PC)</p>
          <div className="card-sm" style={{ padding: '0 16px' }}>
            {/* Dossier downloads */}
            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div className="settings-row-info">
                  <p className="settings-row-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Folder size={14} style={{ color: 'var(--accent)' }} />
                    Dossier downloads
                  </p>
                  <p className="settings-row-desc">Emplacement où les fichiers téléchargés sont enregistrés sur votre PC</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenFolder}
                  title="Ouvrir le dossier dans l'Explorateur Windows"
                  style={{ fontSize: 11.5, padding: '5px 10px', height: 30 }}
                >
                  <FolderOpen size={13} />
                  <span>{folderOpenFeedback ? 'Dossier ouvert !' : 'Ouvrir sur le PC'}</span>
                </button>
              </div>

              {/* Editable Input with Copy */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <input
                  className="settings-input"
                  type="text"
                  placeholder="Ex: C:\Users\andre\Downloads"
                  value={settings.downloads_path}
                  onChange={(e) => update({ downloads_path: e.target.value })}
                  style={{ width: '100%', minWidth: 0, fontSize: 12, letterSpacing: '-0.2px' }}
                />
                {isDesktop && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="Parcourir les dossiers de l'ordinateur"
                    onClick={handlePickFolder}
                    style={{ padding: '6px 12px', height: 34, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Folder size={13} />
                    <span>Parcourir</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title="Copier le chemin complet"
                  onClick={() => copyPath(settings.downloads_path, 'dl')}
                  style={{ padding: '6px 10px', height: 34, flexShrink: 0 }}
                >
                  {copiedKey === 'dl' ? <Check size={13} style={{ color: 'var(--green)' }} /> : <Copy size={13} />}
                </button>
              </div>

              {/* Quick Presets for Windows */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-subtle)', marginRight: 2 }}>Présélections :</span>
                {settings.system_presets?.downloads && (
                  <button
                    type="button"
                    className="toggle-btn"
                    style={{ fontSize: 11, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    onClick={() => update({ downloads_path: settings.system_presets!.downloads })}
                  >
                    <Download size={11} />
                    <span>Téléchargements Windows</span>
                  </button>
                )}
                {settings.system_presets?.desktop && (
                  <button
                    type="button"
                    className="toggle-btn"
                    style={{ fontSize: 11, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    onClick={() => update({ downloads_path: settings.system_presets!.desktop })}
                  >
                    <Monitor size={11} />
                    <span>Bureau</span>
                  </button>
                )}
                {settings.system_presets?.videos && (
                  <button
                    type="button"
                    className="toggle-btn"
                    style={{ fontSize: 11, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    onClick={() => update({ downloads_path: settings.system_presets!.videos })}
                  >
                    <Film size={11} />
                    <span>Vidéos</span>
                  </button>
                )}
                {settings.system_presets?.default && (
                  <button
                    type="button"
                    className="toggle-btn"
                    style={{ fontSize: 11, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    onClick={() => update({ downloads_path: settings.system_presets!.default })}
                  >
                    <Zap size={11} />
                    <span>SwiftBalt par défaut</span>
                  </button>
                )}
              </div>
            </div>

            {/* Dossier temporaire */}
            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '16px 0' }}>
              <div className="settings-row-info">
                <p className="settings-row-label">Dossier temporaire</p>
                <p className="settings-row-desc">Fichiers partiels et fragments vidéo pendant le traitement</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <input
                  className="settings-input"
                  type="text"
                  placeholder="Ex: C:\Users\andre\AppData\Local\Temp"
                  value={settings.temp_path}
                  onChange={(e) => update({ temp_path: e.target.value })}
                  style={{ width: '100%', minWidth: 0, fontSize: 12, letterSpacing: '-0.2px' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title="Copier le chemin"
                  onClick={() => copyPath(settings.temp_path, 'temp')}
                  style={{ padding: '6px 10px', height: 34, flexShrink: 0 }}
                >
                  {copiedKey === 'temp' ? <Check size={13} style={{ color: 'var(--green)' }} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Download engine section */}
        <div className="settings-section">
          <p className="settings-section-title">Téléchargement & Moteur</p>
          <div className="card-sm" style={{ padding: '0 16px' }}>
            <div className="settings-row">
              <div className="settings-row-info">
                <p className="settings-row-label">Téléchargements simultanés</p>
                <p className="settings-row-desc">Nombre max de tâches en parallèle</p>
              </div>
              <input
                className="settings-input"
                type="number"
                min={1}
                max={10}
                value={settings.max_concurrent_downloads}
                onChange={(e) => update({ max_concurrent_downloads: parseInt(e.target.value) || 1 })}
                style={{ width: 70, textAlign: 'center' }}
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <p className="settings-row-label">Qualité par défaut</p>
                <p className="settings-row-desc">Résolution vidéo préférée</p>
              </div>
              <Select
                value={settings.default_quality}
                onChange={(v) => update({ default_quality: v })}
                options={[
                  { value: 'Auto', label: 'Auto (max)' },
                  { value: '2160p', label: '4K · 2160p' },
                  { value: '1440p', label: '1440p' },
                  { value: '1080p', label: '1080p' },
                  { value: '720p',  label: '720p'  },
                  { value: '480p',  label: '480p'  },
                ]}
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <p className="settings-row-label">Format par défaut</p>
                <p className="settings-row-desc">Conteneur vidéo préféré</p>
              </div>
              <Select
                value={settings.default_format}
                onChange={(v) => update({ default_format: v })}
                options={[
                  { value: 'mp4',  label: 'MP4'  },
                  { value: 'webm', label: 'WebM' },
                  { value: 'mp3',  label: 'MP3'  },
                  { value: 'wav',  label: 'WAV (Sans perte / PCM)' },
                  { value: 'flac', label: 'FLAC' },
                ]}
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <p className="settings-row-label">Fusion automatique</p>
                <p className="settings-row-desc">Fusionner audio + vidéo automatiquement</p>
              </div>
              <Toggle checked={settings.auto_merge} onChange={(v) => update({ auto_merge: v })} />
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <p className="settings-row-label">Nettoyer les fichiers temporaires</p>
                <p className="settings-row-desc">Supprimer les fichiers .temp après fusion</p>
              </div>
              <Toggle checked={settings.delete_temp_files} onChange={(v) => update({ delete_temp_files: v })} />
            </div>
          </div>
        </div>

        {/* Engine info */}
        <div className="settings-section">
          <p className="settings-section-title">Moteur Système</p>
          <div className="card-sm" style={{ padding: '0 16px' }}>
            <div className="settings-row">
              <p className="settings-row-label">FFmpeg</p>
              <code style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                {settings.ffmpeg_path}
              </code>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
