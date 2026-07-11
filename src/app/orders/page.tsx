'use client';
import { useEffect, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { useRequireAuth } from '@/lib/useAuth';
import { api, type Job } from '@/lib/api';
import { getToken } from '@/lib/session';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

// Human label + colour per status, matching the tracking page.
function badge(status: string): { text: string; color: string } {
  switch (status) {
    case 'CREATED': return { text: 'Awaiting payment', color: 'var(--warning)' };
    case 'FUNDED': case 'SEARCHING': return { text: 'Finding a rider', color: 'var(--info)' };
    case 'ACCEPTED': case 'EN_ROUTE_PICKUP': case 'AT_PICKUP': case 'IN_PROGRESS': case 'EN_ROUTE_DROP': case 'ARRIVED': case 'AWAITING_CODE':
      return { text: 'In progress', color: 'var(--info)' };
    case 'COMPLETED': case 'RELEASED': return { text: 'Delivered', color: 'var(--success)' };
    case 'CANCELLED': return { text: 'Cancelled', color: 'var(--ink-2)' };
    case 'FAILED_ATTEMPT': return { text: 'Failed', color: 'var(--danger)' };
    case 'DISPUTED': case 'DISPUTE_RESOLVED': return { text: 'Dispute', color: 'var(--danger)' };
    default: return { text: status, color: 'var(--ink-2)' };
  }
}

const ACTIVE = ['FUNDED', 'SEARCHING', 'ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP', 'ARRIVED', 'AWAITING_CODE', 'CREATED'];

export default function OrdersPage() {
  const { ready } = useRequireAuth();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    api.myJobs(getToken()).then(setJobs).catch((e) => setErr((e as Error).message));
  }, [ready]);

  if (!ready) return null;

  return (
    <main style={{ padding: 20, paddingBottom: 96 }}>
      <h1 style={{ fontSize: 22, margin: '4px 0 16px', letterSpacing: '-0.02em' }}>Your orders</h1>

      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
      {jobs === null && !err && <p className="mono" style={{ fontSize: 12, color: 'var(--mid)' }}>LOADING…</p>}
      {jobs?.length === 0 && (
        <div className="rf-card" style={{ textAlign: 'center', color: 'var(--ink-2)' }}>
          <p style={{ margin: '4px 0 12px', fontSize: 14 }}>No orders yet.</p>
          <a href="/home" className="mono" style={{ fontSize: 12, color: 'var(--ink)', letterSpacing: '.06em' }}>BOOK A DELIVERY →</a>
        </div>
      )}

      {jobs?.map((j) => {
        const b = badge(j.status);
        const active = ACTIVE.includes(j.status);
        return (
          <a key={j.id} href={`/jobs/${j.id}/track`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="rf-card" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b className="mono" style={{ fontSize: 16 }}>{naira(j.amountMinor)}</b>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>{j.type}</span>
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--mid)', marginTop: 4 }}>
                  {new Date(j.createdAt).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {j.id.slice(0, 8)}…
                </div>
              </div>
              <span className="rf-pill" style={{ background: b.color, color: '#fff', fontSize: 10 }}>{b.text.toUpperCase()}{active && j.status !== 'CREATED' ? ' ›' : ''}</span>
            </div>
          </a>
        );
      })}

      <BottomNav />
    </main>
  );
}
