'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, isActive } from '@/components/AdminNav';

/**
 * Admin shell: a fixed left sidebar on desktop that collapses into a hamburger drawer on mobile.
 * Wraps every /admin page, so pages render only their own content.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [path]);

  const current = NAV_ITEMS.find((i) => isActive(i.href, path))?.label ?? 'Admin';

  return (
    <div className="admin-shell">
      {/* Mobile top bar */}
      <div className="admin-topbar">
        <button className="admin-hamburger" aria-label="Open menu" onClick={() => setOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <b style={{ fontSize: 'var(--text-body)', letterSpacing: '-0.02em' }}>{current}</b>
      </div>

      {open && <button className="admin-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />}

      <aside className={`admin-sidebar${open ? ' open' : ''}`}>
        <div className="admin-brand">
          <b style={{ fontSize: 'var(--text-subtitle)', letterSpacing: '-0.02em' }}>
            <span style={{ color: 'var(--ink)' }}>Ryda</span><span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>first</span>
          </b>
          <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.1em' }}>ADMIN</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map((i) => (
            <Link key={i.href} href={i.href} className={`admin-navlink${isActive(i.href, path) ? ' active' : ''}`}>
              <span className="dot" />{i.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="admin-content">{children}</main>
    </div>
  );
}
