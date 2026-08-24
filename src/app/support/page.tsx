'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { BottomNav } from '@/components/BottomNav';
import { useRequireAuth } from '@/lib/useAuth';
import { getToken } from '@/lib/session';
import { api, type SupportThread, type SupportCategory } from '@/lib/api';
import { SUPPORT_CATEGORIES, CATEGORY_LABELS, CATEGORY_HINTS } from '@/lib/supportBot';

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS: Record<string, { text: string; color: string }> = {
  BOT: { text: 'Assistant', color: 'var(--info)' },
  AWAITING_AGENT: { text: 'Waiting for agent', color: 'var(--warning)' },
  AGENT_JOINED: { text: 'Agent joined', color: 'var(--success)' },
  RESOLVED: { text: 'Resolved', color: 'var(--mid)' },
};

export default function SupportInboxPage() {
  const { ready } = useRequireAuth();
  const [threads, setThreads] = useState<SupportThread[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api.mySupportThreads(getToken()).then(setThreads).catch((e) => setErr((e as Error).message));
  }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const start = async (category: SupportCategory) => {
    if (busy) return;
    setBusy(category);
    try {
      const t = await api.startSupportThread(getToken(), { category });
      location.href = `/support/${t.id}`;
    } catch (e) { setErr((e as Error).message); setBusy(null); }
  };

  if (!ready) return null;

  return (
    <main style={{ padding: 20, paddingBottom: 96, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 4px' }}>
        <h1 style={{ fontSize: 'var(--text-heading)', letterSpacing: '-0.02em', margin: 0 }}>Help &amp; support</h1>
      </div>
      <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 16px' }}>
        Chat with our assistant. If it can’t solve it, a human agent joins within 30 minutes. Your conversations are saved here so you can pick up where you left off.
      </p>

      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}

      {!picking && (
        <Button onClick={() => setPicking(true)}>New conversation</Button>
      )}

      {picking && (
        <div className="rf-card" style={{ margin: '0 0 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em' }}>WHAT DO YOU NEED HELP WITH?</div>
            <button onClick={() => setPicking(false)} className="mono" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>CANCEL</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SUPPORT_CATEGORIES.map((c) => (
              <button key={c} type="button" disabled={!!busy} onClick={() => start(c)}
                style={{ textAlign: 'left', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: '12px 14px', cursor: busy ? 'default' : 'pointer' }}>
                <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--ink)' }}>
                  {CATEGORY_LABELS[c]}{busy === c ? ' …' : ''}
                </div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginTop: 2 }}>{CATEGORY_HINTS[c]}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 8 }}>YOUR CONVERSATIONS</div>
        {!threads && !err && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}
        {threads?.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)' }}>No conversations yet. Start one above.</p>}
        {threads?.map((t) => {
          const s = STATUS[t.status] ?? { text: t.status, color: 'var(--ink-2)' };
          return (
            <a key={t.id} href={`/support/${t.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div className="rf-card" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>{CATEGORY_LABELS[t.category]}</div>
                  <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 2 }}>
                    {ago(t.updatedAt)}{t.jobId ? ` · TRIP ${t.jobId.slice(0, 8)}` : ''}
                  </div>
                </div>
                <span className="rf-pill" style={{ background: s.color, color: 'var(--on-dark)', flexShrink: 0 }}>{s.text.toUpperCase()}</span>
              </div>
            </a>
          );
        })}
      </div>

      <BottomNav />
    </main>
  );
}
