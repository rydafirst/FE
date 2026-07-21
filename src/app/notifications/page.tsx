'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { useRequireAuth } from '@/lib/useAuth';
import { api, type Notification } from '@/lib/api';
import { getToken } from '@/lib/session';

// Relative time, e.g. "just now", "5m", "3h", "2d" (matches mobile).
function ago(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function NotificationsPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const [items, setItems] = useState<Notification[] | null>(null);

  // Load, then mark all read so the bell dot clears once the list has been opened.
  useEffect(() => {
    if (!ready) return;
    let done = false;
    (async () => {
      try { setItems((await api.notifications(getToken())).items); } catch { setItems([]); }
      if (!done) { try { await api.markNotificationsRead(getToken()); } catch { /* non-critical */ } }
    })();
    return () => { done = true; };
  }, [ready]);

  if (!ready) return null;

  return (
    <main style={{ padding: 20, paddingBottom: 96 }}>
      <h1 style={{ fontSize: 'var(--text-heading)', margin: '4px 0 16px', letterSpacing: '-0.02em' }}>Notifications</h1>

      {items === null && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}
      {items?.length === 0 && (
        <div className="rf-card" style={{ textAlign: 'center', color: 'var(--ink-2)' }}>
          <p style={{ margin: '4px 0 6px', fontSize: 'var(--text-body)' }}>No notifications yet.</p>
          <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', letterSpacing: '.06em' }}>UPDATES ABOUT YOUR ORDERS APPEAR HERE</span>
        </div>
      )}

      {items?.map((n) => {
        const clickable = Boolean(n.jobId);
        return (
          <div
            key={n.id}
            onClick={clickable ? () => router.push(`/jobs/${n.jobId}/track`) : undefined}
            className="rf-card"
            style={{
              marginBottom: 10, cursor: clickable ? 'pointer' : 'default',
              border: `1px solid ${n.read ? 'var(--line)' : 'var(--ink)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--primary)', flexShrink: 0 }} />}
                <b style={{ fontSize: 'var(--text-body)' }}>{n.title}</b>
              </div>
              <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', flexShrink: 0 }}>{ago(n.createdAt)}</span>
            </div>
            <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '6px 0 0', lineHeight: 1.45 }}>{n.body}</p>
          </div>
        );
      })}

      <BottomNav />
    </main>
  );
}
