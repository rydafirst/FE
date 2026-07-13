'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUserRole, getToken } from '@/lib/session';
import { api, type Job } from '@/lib/api';

// Persistent bottom navigation for signed-in screens. Role-aware: customers book & track,
// riders get their dashboard. Everyone gets Profile (where logout lives).
type Tab = { href: string; label: string; icon: JSX.Element };

const CUSTOMER_ACTIVE = ['CREATED', 'FUNDED', 'SEARCHING', 'ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP', 'ARRIVED', 'AWAITING_CODE'];
const RIDER_ACTIVE = ['ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP', 'ARRIVED', 'AWAITING_CODE'];

function bannerLabel(status: string, isRider: boolean): string {
  if (isRider) return 'Active delivery — tap to continue';
  switch (status) {
    case 'CREATED': return 'Order awaiting payment';
    case 'FUNDED': case 'SEARCHING': return 'Finding you a rider…';
    case 'ACCEPTED': return 'Rider assigned';
    case 'EN_ROUTE_PICKUP': return 'Rider heading to pickup';
    case 'AT_PICKUP': return 'Rider at pickup';
    case 'IN_PROGRESS': return 'Your parcel is on the way';
    case 'EN_ROUTE_DROP': return 'Almost at the drop-off';
    case 'ARRIVED': case 'AWAITING_CODE': return 'Rider has arrived';
    default: return 'Order in progress';
  }
}

const ICON = {
  home: <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  bike: <><circle cx="6" cy="17" r="3.2" /><circle cx="18" cy="17" r="3.2" /><path d="M6 17 10 9h5l2 4M9 9h4" /></>,
  orders: <><path d="M6 3h9l4 4v14a0 0 0 0 1 0 0H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M9 12h7M9 16h7M9 8h4" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>,
};

export function BottomNav() {
  const path = usePathname();
  const role = getUserRole();
  const isRider = role === 'RIDER';
  const [activeJob, setActiveJob] = useState<Job | null>(null);

  // Poll the user's live order/trip so a persistent banner keeps it in view across pages.
  useEffect(() => {
    let stop = false;
    const set = isRider ? RIDER_ACTIVE : CUSTOMER_ACTIVE;
    const tick = async () => {
      try {
        const jobs = isRider ? await api.assignedJobs(getToken()) : await api.myJobs(getToken());
        const found = jobs.find((j) => set.includes(j.status)) ?? null;
        if (!stop) setActiveJob(found);
      } catch { /* keep last */ }
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => { stop = true; clearInterval(id); };
  }, [isRider]);

  const tabs: Tab[] =
    role === 'RIDER'
      ? [
          { href: '/rider', label: 'Dashboard', icon: ICON.bike },
          { href: '/activity', label: 'Activity', icon: ICON.orders },
          { href: '/profile', label: 'Profile', icon: ICON.user },
        ]
      : [
          { href: '/home', label: 'Book', icon: ICON.home },
          { href: '/activity', label: 'Activity', icon: ICON.orders },
          { href: '/profile', label: 'Profile', icon: ICON.user },
        ];

  return (
    <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, zIndex: 50 }}>
      {activeJob && (
        <Link href={isRider ? `/jobs/${activeJob.id}/rider` : `/jobs/${activeJob.id}/track`}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--ink)', color: '#fff', padding: '11px 16px', textDecoration: 'none' }}>
          <span className="rf-pulse" style={{ width: 9, height: 9, borderRadius: 5, background: 'var(--primary)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bannerLabel(activeJob.status, isRider)}</span>
          <span className="mono" style={{ fontSize: 11, letterSpacing: '.06em' }}>VIEW ›</span>
        </Link>
      )}
      <nav style={{ display: 'flex', borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
      {tabs.map((t) => {
        // Exact match: '/rider' must not also light up when on '/rider/trips'.
        const active = path === t.href;
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
    </div>
  );
}
