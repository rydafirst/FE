'use client';
import { useRef, useState, type ReactNode } from 'react';

/**
 * Drag-down-to-refresh for touch devices. Triggers onRefresh when the user pulls past a
 * threshold at the top of the page. On desktop it's inert (no touch events).
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void> | void; children: ReactNode }) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const settling = startY.current === null;

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = window.scrollY <= 0 && !refreshing ? e.touches[0].clientY : null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPull(Math.min(dy * 0.5, 90)); // damped
  };
  const onTouchEnd = async () => {
    if (startY.current === null) return;
    const trigger = pull >= 45;
    startY.current = null;
    if (trigger) {
      setRefreshing(true); setPull(36);
      try { await onRefresh(); } finally { setRefreshing(false); setPull(0); }
    } else {
      setPull(0);
    }
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div style={{
        height: pull, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: settling ? 'height .22s ease' : 'none',
      }}>
        <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', letterSpacing: '.08em' }}>
          {refreshing ? 'REFRESHING…' : pull >= 45 ? 'RELEASE TO REFRESH' : pull > 0 ? 'PULL TO REFRESH' : ''}
        </span>
      </div>
      {children}
    </div>
  );
}
