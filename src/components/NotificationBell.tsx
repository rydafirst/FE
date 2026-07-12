'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getToken } from '@/lib/session';

/**
 * Header bell that links to the in-app notifications list. Shows a small orange dot while there
 * are unread notifications. Polls lightly so the dot stays current after actions elsewhere.
 * Mirrors the mobile AppHeader bell exactly.
 */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try { const n = await api.notifications(getToken()); if (!stop) setUnread(n.unread); }
      catch { /* keep last */ }
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  return (
    <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      style={{ position: 'relative', display: 'inline-flex', padding: 4, color: 'var(--ink)' }}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: 2, right: 2, width: 9, height: 9, borderRadius: 5,
          background: 'var(--primary)', border: '1.5px solid var(--bg)',
        }} />
      )}
    </Link>
  );
}
