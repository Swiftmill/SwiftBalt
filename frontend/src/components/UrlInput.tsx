import React, { useState, useEffect } from 'react';
import { ArrowRight, Clipboard, Loader2, AlertCircle } from 'lucide-react';

interface UrlInputProps {
  onAnalyze: (url: string) => void;
  isLoading: boolean;
  error?: string | null;
}

const detectPlatform = (url: string): string | null => {
  const v = url.toLowerCase().trim();
  if (!v || (!v.startsWith('http') && !v.startsWith('magnet:'))) return null;
  if (v.includes('youtube.com') || v.includes('youtu.be')) return 'YouTube';
  if (v.includes('twitch.tv')) return 'Twitch';
  if (v.includes('tiktok.com')) return 'TikTok';
  if (v.includes('x.com') || v.includes('twitter.com')) return 'X / Twitter';
  if (v.includes('instagram.com')) return 'Instagram';
  if (v.includes('reddit.com') || v.includes('v.redd.it')) return 'Reddit';
  if (v.includes('vimeo.com')) return 'Vimeo';
  if (v.includes('soundcloud.com')) return 'SoundCloud';
  if (v.includes('bilibili.com')) return 'Bilibili';
  if (v.includes('dailymotion.com') || v.includes('dai.ly')) return 'Dailymotion';
  if (v.includes('bsky.app')) return 'Bluesky';
  if (v.includes('kick.com')) return 'Kick';
  if (v.includes('facebook.com') || v.includes('fb.watch')) return 'Facebook';
  if (v.startsWith('magnet:?')) return 'Magnet';
  if (v.match(/\.(zip|iso|rar|7z|pdf|mp4|mkv|mp3|wav|flac|exe|apk)(\?|$)/i)) return 'Fichier direct';
  return 'URL détectée';
};

export const UrlInput: React.FC<UrlInputProps> = ({ onAnalyze, isLoading, error }) => {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform(url));
  }, [url]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim() || isLoading) return;
    onAnalyze(url.trim());
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) {
        setUrl(text.trim());
        onAnalyze(text.trim());
      }
    } catch {
      // clipboard denied
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div>
      <form className="url-form" onSubmit={handleSubmit}>
        <div className="url-input-wrap">
          <input
            type="text"
            className="url-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="colle un lien ici..."
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />

          <div className="url-input-actions">
            <button
              type="button"
              className="url-paste-btn"
              onClick={handlePaste}
              title="Coller"
              tabIndex={-1}
            >
              <Clipboard size={15} />
            </button>

            <button
              type="submit"
              className="url-submit-btn"
              disabled={isLoading || !url.trim()}
              aria-label="Analyser"
            >
              {isLoading
                ? <Loader2 size={16} className="spin" style={{ color: 'var(--bg)' }} />
                : <ArrowRight size={17} strokeWidth={2.5} style={{ color: 'var(--bg)' }} />
              }
            </button>
          </div>
        </div>
      </form>

      {/* Hint row */}
      <div className="url-hint-row">
        <span>
          ou appuie sur{' '}
          <kbd style={{
            fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
            fontSize: 10,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '1px 5px',
            color: 'var(--text-muted)',
          }}>
            Ctrl+V
          </kbd>
        </span>

        {platform && (
          <span className="platform-detected">{platform}</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="error-box">
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
