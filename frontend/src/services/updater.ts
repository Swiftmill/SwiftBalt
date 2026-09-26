export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size: number;
  platform: 'windows' | 'linux' | 'macos' | 'ios' | 'other';
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseDate: string;
  releaseNotes: string;
  features: string[];
  fixes: string[];
  htmlUrl: string;
  downloadUrl: string;
  platformAsset?: ReleaseAsset;
  assets: ReleaseAsset[];
}

export const CURRENT_VERSION = '1.0.0';
const GITHUB_REPO = 'Swiftmill/SwiftBalt';
const CLOUD_VERSION_URL = 'https://swiftbalt.vercel.app/version.json';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

const STORAGE_AUTO_CHECK = 'swiftbalt_auto_check_updates';
const STORAGE_DISMISSED = 'swiftbalt_dismissed_update';
const STORAGE_LAST_CHECK = 'swiftbalt_last_update_check';

// Detect operating system
export function detectPlatform(): 'windows' | 'linux' | 'macos' | 'ios' | 'android' | 'web' {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua)) return 'linux';
  return 'web';
}

// Compare semantic versions (e.g. 1.0.1 > 1.0.0)
export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/i, '').trim();
  const clean2 = v2.replace(/^v/i, '').trim();

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// Parse release body text into features and fixes
function parseChangelog(bodyText?: string): { features: string[]; fixes: string[] } {
  if (!bodyText) {
    return {
      features: ['Mise à jour de performance et nouvelles fonctionnalités'],
      fixes: ['Améliorations de stabilité et corrections de bugs'],
    };
  }

  const features: string[] = [];
  const fixes: string[] = [];

  const lines = bodyText.split('\n');
  let currentSection: 'features' | 'fixes' | 'none' = 'none';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect section headers
    const lower = line.toLowerCase();
    if (lower.includes('ajout') || lower.includes('nouveaut') || lower.includes('feat') || lower.includes('what\'s new')) {
      currentSection = 'features';
      continue;
    }
    if (lower.includes('fix') || lower.includes('correct') || lower.includes('bug') || lower.includes('patch')) {
      currentSection = 'fixes';
      continue;
    }

    // Extract bullet points
    if (line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
      const cleanLine = line.replace(/^[-*•]\s*/, '').trim();
      if (!cleanLine) continue;

      if (currentSection === 'fixes' || lower.includes('fix') || lower.includes('corrig') || lower.includes('resolv')) {
        fixes.push(cleanLine);
      } else {
        features.push(cleanLine);
      }
    } else if (currentSection === 'features') {
      features.push(line);
    } else if (currentSection === 'fixes') {
      fixes.push(line);
    }
  }

  if (features.length === 0 && fixes.length === 0) {
    // If no bullet points found, split by lines or sentences
    const cleanLines = lines.filter((l) => l.trim().length > 3);
    for (const l of cleanLines) {
      if (l.toLowerCase().includes('fix') || l.toLowerCase().includes('corr')) {
        fixes.push(l.trim());
      } else {
        features.push(l.trim());
      }
    }
  }

  return {
    features: features.length > 0 ? features : ['Améliorations générales et optimisations du moteur'],
    fixes: fixes.length > 0 ? fixes : ['Corrections de bugs et amélioration de la stabilité'],
  };
}

export const updaterService = {
  isAutoCheckEnabled(): boolean {
    const val = localStorage.getItem(STORAGE_AUTO_CHECK);
    return val === null ? true : val === 'true';
  },

  setAutoCheckEnabled(enabled: boolean): void {
    localStorage.setItem(STORAGE_AUTO_CHECK, enabled ? 'true' : 'false');
  },

  getLastCheckTime(): string | null {
    return localStorage.getItem(STORAGE_LAST_CHECK);
  },

  dismissUpdate(version: string): void {
    localStorage.setItem(STORAGE_DISMISSED, version);
  },

  isUpdateDismissed(version: string): boolean {
    return localStorage.getItem(STORAGE_DISMISSED) === version;
  },

  async checkForUpdates(force = false): Promise<UpdateInfo> {
    const platform = detectPlatform();
    let latestTag = '';
    let releaseName = '';
    let releaseDate = '';
    let body = '';
    let htmlUrl = `https://github.com/${GITHUB_REPO}/releases/latest`;
    let rawAssets: any[] = [];

    // Try cloud version.json first (fast, edge cached, no GitHub rate limits)
    try {
      const cloudRes = await fetch(CLOUD_VERSION_URL, { cache: 'no-cache' });
      if (cloudRes.ok) {
        const cloudData = await cloudRes.json();
        if (cloudData.version) {
          latestTag = `v${cloudData.version.replace(/^v/i, '')}`;
          releaseName = cloudData.name || `SwiftBalt ${latestTag}`;
          releaseDate = cloudData.release_date || new Date().toISOString().split('T')[0];
          if (Array.isArray(cloudData.changelog)) {
            body = cloudData.changelog.map((c: string) => `- ${c}`).join('\n');
          }
          if (cloudData.github_release_url) {
            htmlUrl = cloudData.github_release_url;
          }
        }
      }
    } catch {
      // ignore, fallback to github
    }

    // If cloud version was not available or we need full assets, query GitHub Releases
    if (!latestTag || force) {
      try {
        const ghRes = await fetch(GITHUB_API_URL, {
          headers: { Accept: 'application/vnd.github.v3+json' },
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          latestTag = ghData.tag_name || latestTag;
          releaseName = ghData.name || releaseName || `SwiftBalt ${latestTag}`;
          releaseDate = ghData.published_at ? new Date(ghData.published_at).toLocaleDateString('fr-FR') : releaseDate;
          body = ghData.body || body;
          htmlUrl = ghData.html_url || htmlUrl;
          rawAssets = ghData.assets || [];
        }
      } catch (err) {
        console.warn('GitHub API update check error', err);
      }
    }

    // Update last check time
    localStorage.setItem(STORAGE_LAST_CHECK, new Date().toLocaleString('fr-FR'));

    if (!latestTag) {
      return {
        hasUpdate: false,
        currentVersion: CURRENT_VERSION,
        latestVersion: CURRENT_VERSION,
        releaseName: `SwiftBalt v${CURRENT_VERSION}`,
        releaseDate: new Date().toLocaleDateString('fr-FR'),
        releaseNotes: '',
        features: [],
        fixes: [],
        htmlUrl,
        downloadUrl: 'https://swiftbalt.vercel.app',
        assets: [],
      };
    }

    const cleanLatest = latestTag.replace(/^v/i, '');
    const hasUpdate = compareVersions(cleanLatest, CURRENT_VERSION) > 0;

    // Check if dismissed (unless forced check)
    if (hasUpdate && !force && this.isUpdateDismissed(cleanLatest)) {
      return {
        hasUpdate: false, // suppressed for modal auto-popup
        currentVersion: CURRENT_VERSION,
        latestVersion: cleanLatest,
        releaseName,
        releaseDate,
        releaseNotes: body,
        features: [],
        fixes: [],
        htmlUrl,
        downloadUrl: 'https://swiftbalt.vercel.app',
        assets: [],
      };
    }

    // Map assets
    const assets: ReleaseAsset[] = rawAssets.map((a: any) => {
      let p: 'windows' | 'linux' | 'macos' | 'ios' | 'other' = 'other';
      const name = (a.name || '').toLowerCase();
      if (name.endsWith('.exe') || name.includes('windows')) p = 'windows';
      else if (name.endsWith('.appimage') || name.endsWith('.deb') || name.includes('linux')) p = 'linux';
      else if (name.endsWith('.dmg') || name.includes('macos') || name.includes('darwin')) p = 'macos';
      else if (name.endsWith('.ipa') || name.includes('ios')) p = 'ios';

      return {
        name: a.name,
        downloadUrl: a.browser_download_url,
        size: a.size || 0,
        platform: p,
      };
    });

    // Find best asset for this platform
    let platformAsset = assets.find((a) => a.platform === platform);
    if (!platformAsset && platform === 'linux') {
      platformAsset = assets.find((a) => a.name.endsWith('.AppImage')) || assets.find((a) => a.name.endsWith('.deb'));
    }

    const defaultDownloadUrl = platformAsset
      ? platformAsset.downloadUrl
      : 'https://swiftbalt.vercel.app';

    const { features, fixes } = parseChangelog(body);

    return {
      hasUpdate,
      currentVersion: CURRENT_VERSION,
      latestVersion: cleanLatest,
      releaseName: releaseName || `SwiftBalt v${cleanLatest}`,
      releaseDate: releaseDate || new Date().toLocaleDateString('fr-FR'),
      releaseNotes: body,
      features,
      fixes,
      htmlUrl,
      downloadUrl: defaultDownloadUrl,
      platformAsset,
      assets,
    };
  },

  async openExternalUrl(url: string): Promise<void> {
    const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (isDesktop) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_url', { url });
        return;
      } catch (err) {
        console.warn('Tauri open_url invoke failed, fallback to window.open', err);
      }
    }

    // Standard web / mobile fallback
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  async installAndRestartUpdate(
    updateInfo: UpdateInfo,
    onProgress?: (data: { status: 'downloading' | 'installing' | 'restarting' | 'error'; percent: number; message?: string }) => void
  ): Promise<void> {
    const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

    if (isDesktop) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { listen } = await import('@tauri-apps/api/event');

        const unlisten = await listen<any>('update-progress', (event) => {
          if (onProgress && event.payload) {
            onProgress(event.payload);
          }
        });

        // Determine best download URL for Windows desktop: prefer direct exe or setup
        const downloadUrl = updateInfo.downloadUrl;
        const expectedSize = updateInfo.platformAsset?.size || 0;

        await invoke('install_and_restart_update', {
          downloadUrl,
          expectedSize: expectedSize > 0 ? expectedSize : null,
        });

        unlisten();
        return;
      } catch (err: any) {
        console.error('Desktop install and restart failed:', err);
        if (onProgress) {
          onProgress({
            status: 'error',
            percent: 0,
            message: typeof err === 'string' ? err : 'Erreur lors de l\'installation automatique.',
          });
        }
        throw err;
      }
    }

    // Web / iOS PWA Flow (Discord style animated update)
    if (onProgress) {
      onProgress({ status: 'downloading', percent: 15, message: 'Téléchargement des modules...' });
      await new Promise((r) => setTimeout(r, 600));

      onProgress({ status: 'downloading', percent: 65, message: 'Optimisation des caches...' });
      await new Promise((r) => setTimeout(r, 700));

      onProgress({ status: 'installing', percent: 95, message: 'Installation des fichiers...' });
      await new Promise((r) => setTimeout(r, 600));

      onProgress({ status: 'restarting', percent: 100, message: 'Redémarrage de l\'application...' });
      await new Promise((r) => setTimeout(r, 800));
    }

    // Reload browser / PWA to take effect
    window.location.reload();
  },
};
