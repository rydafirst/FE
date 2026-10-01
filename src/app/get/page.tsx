'use client';

import { useEffect, useState } from 'react';

/**
 * Smart download link — a single shareable URL (rydafirst.com/get) for social bios (TikTok, Instagram…).
 * On an iPhone it sends the visitor straight to the App Store; on Android, straight to Google Play.
 * On desktop (or anything we can't detect) it shows both buttons so they can still get there.
 */
const APP_STORE_URL = 'https://apps.apple.com/app/rydafirst/id6789930826';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=ng.rydafirst.app';

type Platform = 'detecting' | 'ios' | 'android' | 'other';

export default function GetAppPage() {
  const [platform, setPlatform] = useState<Platform>('detecting');

  useEffect(() => {
    const ua = navigator.userAgent || '';
    // iPadOS 13+ reports as "Macintosh" but is a touch device, so catch that too.
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    if (isIOS) {
      setPlatform('ios');
      window.location.replace(APP_STORE_URL);
    } else if (isAndroid) {
      setPlatform('android');
      window.location.replace(PLAY_STORE_URL);
    } else {
      setPlatform('other');
    }
  }, []);

  const redirecting = platform === 'ios' || platform === 'android';

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '32px 24px', gap: 18, background: 'var(--site-bg, #f4efe6)', color: 'var(--ink, #1a1a1a)',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>
      <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em' }}>
        ryd<span style={{ color: 'var(--primary, #e8622c)' }}>a</span><span style={{ color: 'var(--ink-2, #6b6b6b)', fontWeight: 400 }}>first</span>
      </div>

      <p style={{ fontSize: 16, color: 'var(--ink-2, #6b6b6b)', margin: 0, maxWidth: 420, lineHeight: 1.5 }}>
        {redirecting
          ? 'Opening your app store… if nothing happens, tap your store below.'
          : 'Get the Rydafirst app — escrow-protected delivery, paid on arrival.'}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 6 }}>
        {(platform === 'ios' || platform === 'other' || platform === 'detecting') && (
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" style={btn}>
            <AppleIcon /> App Store
          </a>
        )}
        {(platform === 'android' || platform === 'other' || platform === 'detecting') && (
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" style={btn}>
            <PlayIcon /> Google Play
          </a>
        )}
      </div>
    </main>
  );
}

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none',
  fontFamily: 'var(--font-mono, monospace)', fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
  padding: '14px 24px', borderRadius: 999, background: 'var(--primary, #e8622c)', color: 'var(--primary-ink, #fff)',
};

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden style={{ marginTop: -2 }}>
      <path d="M16.4 12.7c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.5 2.2 2.6 2.2 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.1-.8-2.1-3.1zM14.3 5.6c.6-.7 1-1.7.9-2.6-.9 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.5 1 .1 1.9-.5 2.5-1.2z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden style={{ marginTop: -1 }}>
      <path fill="currentColor" d="M3.6 2.3c-.3.2-.5.6-.5 1.1v17.2c0 .5.2.9.5 1.1l.1.1L13 12.6v-.2L3.7 2.2l-.1.1z" />
      <path fill="currentColor" d="M16.3 15.9 13 12.6v-.2l3.3-3.3.1.1 3.9 2.2c1.1.6 1.1 1.6 0 2.3l-3.9 2.2h-.1z" />
      <path fill="currentColor" d="M16.4 15.8 13 12.5 3.6 21.9c.4.4 1 .4 1.7 0l11.1-6.1" opacity=".85" />
      <path fill="currentColor" d="M16.4 9.2 5.3 3.1c-.7-.4-1.3-.4-1.7 0L13 12.5l3.4-3.3z" opacity=".7" />
    </svg>
  );
}
