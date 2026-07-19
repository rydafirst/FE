'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUserRole, isLoggedIn } from '@/lib/session';

/** Admin section navigation, rendered as a left sidebar by the admin layout. */
export const NAV_ITEMS: { href: string; label: string }[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/riders', label: 'Riders' },
  { href: '/admin/deliveries', label: 'Deliveries' },
  { href: '/admin/finance', label: 'Finance' },
  { href: '/admin/disputes', label: 'Disputes' },
  { href: '/admin/settings', label: 'Settings' },
];

/** True when `href` is the active section for the current path (exact for /admin, prefix otherwise). */
export function isActive(href: string, path: string): boolean {
  return href === '/admin' ? path === '/admin' : path.startsWith(href);
}

/**
 * Gates a page to ADMIN and reports readiness. Returns `ready` so pages fetch only once access is
 * confirmed; `notAdmin` lets a page show an access message. Redirects to /login when signed out.
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
