'use client';
import { useEffect, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { useRequireAuth } from '@/lib/useAuth';
import { api, type Job } from '@/lib/api';
import { getToken } from '@/lib/session';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
// A rider's trip is resumable while active; anything past that is history.
const ACTIVE = ['ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP', 'ARRIVED', 'AWAITING_CODE'];

function badge(status: string): { text: string; color: string } {
  if (ACTIVE.includes(status)) return { text: 'In progress', color: 'var(--info)' };
  switch (status) {
    case 'COMPLETED': case 'RELEASED': return { text: 'Delivered', color: 'var(--success)' };
    case 'CANCELLED': return { text: 'Cancelled', color: 'var(--ink-2)' };
    case 'FAILED_ATTEMPT': return { text: 'Failed', color: 'var(--danger)' };
    case 'DISPUTED': case 'DISPUTE_RESOLVED': return { text: 'Dispute', color: 'var(--danger)' };
    default: return { text: status.replace(/_/g, ' '), color: 'var(--ink-2)' };
  }
}

export default function RiderTripsPage() {
  const { ready } = useRequireAuth();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    api.assignedJobs(getToken())
      .then((js) => setJobs([...js].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))))
      .catch((e) => setErr((e as Error).message));
  }, [ready]);

  if (!ready) return null;

  return (
    <main style={{ padding: 20, paddingBottom: 96 }}>
      <h1 style={{ fontSize: 22, margin: '4px 0 16px', letterSpacing: '-0.02em' }}>Your trips</h1>

      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
      {jobs === null && !err && <p className="mono" style={{ fontSize: 12, color: 'var(--mid)' }}>LOADING…</p>}
      {jobs?.length === 0 && (
        <div className="rf-card" style={{ textAlign: 'center', color: 'var(--ink-2)' }}>
          <p style={{ margin: '4px 0 12px', fontSize: 14 }}>No trips yet.</p>
          <a href="/rider" className="mono" style={{ fontSize: 12, color: 'var(--ink)', letterSpacing: '.06em' }}>GO TO DASHBOARD →</a>
        </div>
      )}

      {jobs?.map((j) => {
        const b = badge(j.status);
        const active = ACTIVE.includes(j.status);
        const inner = (
          <div className="rf-card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b className="mono" style={{ fontSize: 16 }}>{naira(j.amountMinor)}</b>
              <span className="rf-pill" style={{ background: b.color, color: '#fff', fontSize: 10 }}>{b.text.toUpperCase()}{active ? ' ›' : ''}</span>
            </div>
            <div style={{ fontSize: 13, margin: '8px 0 4px' }}>{j.pickupArea || 'Pickup'} <span style={{ color: 'var(--mid)' }}>→</span> {j.dropoffArea || 'Drop-off'}</div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--mid)' }}>
              {new Date(j.createdAt).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {j.id.slice(0, 8)}…
            </div>
          </div>
        );
        return active
          ? <a key={j.id} href={`/jobs/${j.id}/rider`} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</a>
          : <div key={j.id}>{inner}</div>;
      })}

      <BottomNav />
    </main>
  );
}
