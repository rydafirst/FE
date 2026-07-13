'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { useRequireAuth } from '@/lib/useAuth';
import { api, type Job } from '@/lib/api';
import { getToken, getUserRole } from '@/lib/session';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
const ACTIVE = ['CREATED', 'FUNDED', 'SEARCHING', 'ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP', 'ARRIVED', 'AWAITING_CODE'];

type Category = 'all' | 'active' | 'completed' | 'cancelled' | 'failed';
const FILTERS: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' }, { key: 'failed', label: 'Failed' },
];
function categoryOf(s: string): Category {
  if (ACTIVE.includes(s)) return 'active';
  if (s === 'COMPLETED' || s === 'RELEASED') return 'completed';
  if (s === 'CANCELLED') return 'cancelled';
  if (s === 'FAILED_ATTEMPT') return 'failed';
  return 'all';
}
function badge(s: string): { text: string; color: string } {
  if (ACTIVE.includes(s)) return { text: 'In progress', color: 'var(--info)' };
  switch (s) {
    case 'COMPLETED': case 'RELEASED': return { text: 'Delivered', color: 'var(--success)' };
    case 'CANCELLED': return { text: 'Cancelled', color: 'var(--ink-2)' };
    case 'FAILED_ATTEMPT': return { text: 'Failed', color: 'var(--danger)' };
    case 'DISPUTED': case 'DISPUTE_RESOLVED': return { text: 'Dispute', color: 'var(--danger)' };
    default: return { text: s.replace(/_/g, ' ').toLowerCase(), color: 'var(--ink-2)' };
  }
}

export default function ActivityPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const isRider = getUserRole() === 'RIDER';
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [filter, setFilter] = useState<Category>('all');

  const load = useCallback(async () => {
    try { setJobs(await (isRider ? api.assignedJobs(getToken()) : api.myJobs(getToken()))); } catch { setJobs([]); }
  }, [isRider]);
  useEffect(() => { if (ready) void load(); }, [ready, load]);

  if (!ready) return null;

  const sorted = jobs ? [...jobs].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)) : null;
  const shown = sorted?.filter((j) => filter === 'all' || categoryOf(j.status) === filter) ?? null;

  const open = (j: Job) => {
    if (ACTIVE.includes(j.status)) return router.push(isRider ? `/jobs/${j.id}/rider` : `/jobs/${j.id}/track`);
    router.push(`/activity/${j.id}`);
  };

  return (
    <main style={{ padding: 20, paddingBottom: 96 }}>
      <h1 style={{ fontSize: 22, margin: '4px 0 12px', letterSpacing: '-0.02em' }}>Activity</h1>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 14 }}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className="mono"
            style={{ padding: '6px 14px', borderRadius: 999, fontSize: 11, whiteSpace: 'nowrap', cursor: 'pointer',
              border: `1px solid ${filter === f.key ? 'var(--ink)' : 'var(--line)'}`,
              background: filter === f.key ? 'var(--ink)' : 'var(--bg)', color: filter === f.key ? '#fff' : 'var(--ink-2)' }}>
            {f.label.toUpperCase()}
          </button>
        ))}
      </div>

      {shown === null && <p className="mono" style={{ fontSize: 12, color: 'var(--mid)' }}>LOADING…</p>}
      {shown?.length === 0 && (
        <div className="rf-card" style={{ textAlign: 'center', color: 'var(--ink-2)' }}>
          <p style={{ margin: '4px 0 6px', fontSize: 14 }}>Nothing here yet.</p>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--mid)' }}>{isRider ? 'ACCEPT A JOB FROM YOUR DASHBOARD' : 'BOOK A DELIVERY TO GET STARTED'}</span>
        </div>
      )}

      {shown?.map((j) => {
        const b = badge(j.status);
        return (
          <div key={j.id} onClick={() => open(j)} className="rf-card"
            style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h9l4 4v14a0 0 0 0 1 0 0H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M9 12h7M9 16h7M9 8h4" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 14, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {j.dropoffArea || j.dropoffAddress || 'Delivery'}
              </b>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--mid)', marginTop: 3 }}>
                {new Date(j.createdAt).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
              <b className="mono" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>{naira(j.amountMinor)}</b>
            </div>
            <span className="rf-pill" style={{ background: b.color, color: '#fff', fontSize: 10 }}>{b.text.toUpperCase()}</span>
          </div>
        );
      })}

      <BottomNav />
    </main>
  );
}
