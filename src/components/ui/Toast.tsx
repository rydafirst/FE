'use client';
import { useCallback, useState } from 'react';

type Kind = 'error' | 'success' | 'info';

/**
 * Lightweight, on-brand toast to replace the browser's native alert().
 * Usage: const { show, node } = useToast(); …show('message', 'error'); …render {node}.
 */
export function useToast() {
  const [msg, setMsg] = useState<{ text: string; kind: Kind } | null>(null);

  const show = useCallback((text: string, kind: Kind = 'error') => {
    setMsg({ text, kind });
    window.setTimeout(() => setMsg((m) => (m && m.text === text ? null : m)), 4000);
  }, []);

  const dot = msg?.kind === 'error' ? 'var(--danger)' : msg?.kind === 'success' ? 'var(--success)' : 'var(--info)';

  const node = msg ? (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 200,
      width: 'calc(100% - 40px)', maxWidth: 440,
    }}>
      <div onClick={() => setMsg(null)} style={{
        background: 'var(--ink)', color: '#fff', borderRadius: 10, padding: '12px 16px',
        display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer',
        boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={{ fontSize: 13.5, lineHeight: 1.35 }}>{msg.text}</span>
      </div>
    </div>
  ) : null;

  return { show, node };
}
