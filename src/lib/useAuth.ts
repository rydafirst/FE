'use client';
import { useEffect, useState } from 'react';
import { isLoggedIn } from './session';

/**
 * Client-side guard for signed-in screens: if there's no session, send the user to /login.
 * Returns `ready` so the page can avoid rendering (and firing API calls) before the check.
 */
export function useRequireAuth(): { ready: boolean } {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isLoggedIn()) { window.location.href = '/login'; return; }
    setReady(true);
  }, []);
  return { ready };
}
