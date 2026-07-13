'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUserRole, isLoggedIn } from '@/lib/session';

const TABS = [
  { href: '/admin', label: 'Riders' },
  { href: '/admin/deliveries', label: 'Deliveries' },
  { href: '/admin/finance', label: 'Finance' },
  { href: '/admin/disputes', label: 'Disputes' },
  { href: '/admin/settings', label: 'Settings' },
];

/**
 * Admin shell: gates the page to ADMIN, renders the section nav. Returns `ready` so pages only
 * fetch once access is confirmed. `notAdmin` lets a page show an access message.
 */
export function useAdminGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [notAdmin, setNotAdmin] = useState(false);
  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return; }
    if (getUserRole() !== 'ADMIN') setNotAdmin(true);
    setReady(true);
  }, [router]);
  return { ready, notAdmin };
}

export function AdminNav() {
  const path = usePathname();
  return (
    <header style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <b style={{ fontSize: 18, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--ink)' }}>Ryda</span><span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>first</span>
        </b>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.08em' }}>ADMIN</span>
      </div>
      <nav style={{ display: 'flex', gap: 6, overflowX: 'auto', borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
        {TABS.map((t) => {
          const on = t.href === '/admin' ? path === '/admin' : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className="mono"
              style={{ fontSize: 11, letterSpacing: '.06em', whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 999, textDecoration: 'none',
                border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: on ? 'var(--ink)' : 'var(--bg)', color: on ? '#fff' : 'var(--ink-2)' }}>
              {t.label.toUpperCase()}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
