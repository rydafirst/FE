'use client';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!ready || notAdmin) return;
    api.adminDocQueue(getToken()).then(setRows).catch((e) => setErr((e as Error).message));
  }, [ready, notAdmin]);

  if (!ready) return null;

  return (
    <div>
      <h1 style={{ fontSize: 22, letterSpacing: '-0.02em', margin: '0 0 14px' }}>Rider verification</h1>

      {notAdmin && <p style={{ color: 'var(--danger)', fontSize: 13 }}>You need an admin account to view this page.</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
      {rows === null && !err && <p className="mono" style={{ fontSize: 12, color: 'var(--mid)' }}>LOADING…</p>}
      {rows?.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>No riders in the queue.</p>}

      {rows?.map((r) => {
        const s = STATUS_LABEL[r.status] ?? { text: r.status, color: 'var(--ink-2)' };
        return (
          <a key={r.riderId} href={`/admin/riders/${r.riderId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="rf-card" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="mono" style={{ fontSize: 13 }}>{r.riderId.slice(0, 8)}…</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--mid)', marginTop: 4 }}>{r.track ?? 'NO VEHICLE'}</div>
              </div>
              <span className="rf-pill" style={{ background: s.color, color: '#fff', fontSize: 10 }}>{s.text.toUpperCase()} ›</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
