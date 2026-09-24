'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, type AdminQueueEntry } from '@/lib/api';
import { getToken } from '@/lib/session';
import { useAdminGuard } from '@/components/AdminNav';

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  UNDER_REVIEW: { text: 'Needs review', color: 'var(--warning)' },
  ACTION_REQUIRED: { text: 'Rejected — awaiting rider', color: 'var(--danger)' },
  EXPIRED: { text: 'Expired', color: 'var(--danger)' },
  INCOMPLETE: { text: 'In progress', color: 'var(--ink-2)' },
  NO_TRACK: { text: 'Not started', color: 'var(--mid)' },
  APPROVED: { text: 'Approved', color: 'var(--success)' },
};

export default function AdminQueuePage() {
  const { ready, notAdmin } = useAdminGuard();
  const [rows, setRows] = useState<AdminQueueEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!ready || notAdmin) return;
    api.adminDocQueue(getToken()).then(setRows).catch((e) => setErr((e as Error).message));
  }, [ready, notAdmin]);

  // Search by name (falls back to ID when a rider has no name yet). Case-insensitive substring.
  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.name ?? '').toLowerCase().includes(q) || r.riderId.toLowerCase().includes(q));
  }, [rows, query]);

  if (!ready) return null;

  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-heading)', letterSpacing: '-0.02em', margin: '0 0 14px' }}>Rider verification</h1>

      {notAdmin && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>You need an admin account to view this page.</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}

      {/* Search across riders by name (or ID). */}
      {!notAdmin && (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <input
            className="rf-input"
            style={{ width: '100%', paddingLeft: 34 }}
            placeholder="Search riders by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mid)', fontSize: 'var(--text-small)' }}>⌕</span>
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search"
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 'var(--text-body)' }}>×</button>
          )}
        </div>
      )}

      {rows === null && !err && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}
      {rows?.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-body)' }}>No riders in the queue.</p>}
      {rows && rows.length > 0 && filtered?.length === 0 && (
        <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-body)' }}>No riders match “{query}”.</p>
      )}

      {rows && filtered && filtered.length > 0 && (
        <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginBottom: 8 }}>
          {filtered.length} RIDER{filtered.length === 1 ? '' : 'S'}{query ? ` · MATCHING “${query}”` : ''}
        </div>
      )}

      {filtered?.map((r) => {
        const s = STATUS_LABEL[r.status] ?? { text: r.status, color: 'var(--ink-2)' };
        const initial = (r.name ?? 'R').trim().charAt(0).toUpperCase();
        return (
          <a key={r.riderId} href={`/admin/riders/${r.riderId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="rf-card" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 19, background: 'var(--ink)', color: 'var(--on-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }} className="mono">
                  {initial}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.name ?? 'No name yet'}{r.nameVerified ? ' ✓' : ''}
                  </div>
                  <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 3 }}>
                    {(r.track ?? 'NO VEHICLE')} · {r.riderId.slice(0, 8)}…
                  </div>
                </div>
              </div>
              <span className="rf-pill" style={{ background: s.color, color: 'var(--on-dark)', fontSize: 'var(--text-caption)', flexShrink: 0 }}>{s.text.toUpperCase()} ›</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
