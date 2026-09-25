import React, { useEffect } from 'react';
import { CheckCircle2, ArrowDownToLine, X, ExternalLink } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'error';
  title: string;
  message: string;
  downloadId?: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 380,
        width: 'calc(100vw - 48px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 6000);
    return () => clearTimeout(timer);
  }, [toast.id]);

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div
      style={{
        pointerEvents: 'auto',
        background: 'var(--bg-elevated, #131720)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        borderRadius: 'var(--radius, 10px)',
        padding: '10px 13px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        animation: 'slideInToast 0.2s ease-out',
        color: 'var(--text, #fff)',
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: isSuccess
            ? 'rgba(34, 197, 94, 0.12)'
            : isError
            ? 'rgba(239, 68, 68, 0.12)'
            : 'var(--bg-hover)',
          color: isSuccess ? 'var(--green, #22c55e)' : isError ? '#ef4444' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isSuccess ? <CheckCircle2 size={14} /> : <ArrowDownToLine size={14} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{toast.title}</p>
        <p
          style={{
            margin: '1px 0 0',
            fontSize: 11,
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {toast.message}
        </p>
      </div>

      {toast.onAction && toast.actionLabel && (
        <button
          onClick={() => {
            toast.onAction?.();
            onDismiss(toast.id);
          }}
          style={{
            background: 'var(--bg-hover)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            transition: 'all 0.12s ease',
          }}
        >
          <span>{toast.actionLabel}</span>
          <ExternalLink size={10} />
        </button>
      )}

      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-subtle, #64748b)',
          cursor: 'pointer',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          flexShrink: 0,
        }}
        title="Fermer"
      >
        <X size={12} />
      </button>
    </div>
  );
};
