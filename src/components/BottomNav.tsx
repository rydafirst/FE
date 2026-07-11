'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUserRole } from '@/lib/session';

// Persistent bottom navigation for signed-in screens. Role-aware: customers book & track,
// riders get their dashboard. Everyone gets Profile (where logout lives).
type Tab = { href: string; label: string; icon: JSX.Element };

const ICON = {
  home: <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  bike: <><circle cx="6" cy="17" r="3.2" /><circle cx="18" cy="17" r="3.2" /><path d="M6 17 10 9h5l2 4M9 9h4" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>,
};

export function BottomNav() {
  const path = usePathname();
  const role = getUserRole();

  const tabs: Tab[] =
    role === 'RIDER'
      ? [
          { href: '/rider', label: 'Dashboard', icon: ICON.bike },
          { href: '/profile', label: 'Profile', icon: ICON.user },
        ]
      : [
          { href: '/home', label: 'Book', icon: ICON.home },
          { href: '/profile', label: 'Profile', icon: ICON.user },
        ];

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480,
      display: 'flex', borderTop: '1px solid var(--line)', background: 'var(--bg)', zIndex: 50,
    }}>
      {tabs.map((t) => {
        const active = path === t.href || path.startsWith(t.href + '/');
        return (
          <Link key={t.href} href={t.href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '10px 0 12px', textDecoration: 'none',
            color: active ? 'var(--ink)' : 'var(--mid)',
          }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {t.icon}
            </svg>
            <span className="mono" style={{ fontSize: 9.5, letterSpacing: '.08em' }}>{t.label.toUpperCase()}</span>
          </Link>
        );
      })}
    </nav>
  );
}
