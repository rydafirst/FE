'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, type AdminDelivery, type AdminOps } from '@/lib/api';
import { getToken } from '@/lib/session';
import { AdminNav, useAdminGuard } from '@/components/AdminNav';

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
function color(s: string): string {
  if (ACTIVE.includes(s)) return 'var(--info)';
  if (s === 'COMPLETED' || s === 'RELEASED') return 'var(--success)';
  if (s === 'CANCELLED') return 'var(--ink-2)';
  return 'var(--danger)';
}

export default function AdminDeliveriesPage() {
  const { ready, notAdmin } = useAdminGuard();
  const [summary, setSummary] = useState<AdminOps['summary'] | null>(null);
  const [rows, setRows] = useState<AdminDelivery[] | null>(null);
  const [filter, setFilter] = useState<Category>('all');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ops, deliveries] = await Promise.all([api.adminOps(getToken()), api.adminDeliveries(getToken())]);
      setSummary(ops.summary); setRows(deliveries);
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { if (ready && !notAdmin) void load(); }, [ready, notAdmin, load]);
  if (!ready) return null;

  const shown = rows?.filter((r) => filter === 'all' || categoryOf(r.status) === filter) ?? null;

  return (
    <main style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <AdminNav />
      <h1 style={{ fontSize: 22, letterSpacing: '-0.02em', margin: '0 0 14px' }}>Deliveries</h1>
      {notAdmin && <p style={{ color: 'var(--danger)', fontSize: 13 }}>You need an admin account.</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
          <div className="rf-card" style={{ padding: '12px 14px' }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>ACTIVE TOTAL</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{summary.activeTotal}</div>
          </div>
          {Object.entries(summary.byStatus).map(([k, v]) => (
            <div key={k} className="rf-card" style={{ padding: '12px 14px' }}>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>{k.replace(/_/g, ' ').toUpperCase()}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className="mono"
            style={{ padding: '6px 14px', borderRadius: 999, fontSize: 11, whiteSpace: 'nowrap', cursor: 'pointer',
              border: `1px solid ${filter === f.key ? 'var(--ink)' : 'var(--line)'}`,
              background: filter === f.key ? 'var(--ink)' : 'var(--bg)', color: filter === f.key ? '#fff' : 'var(--ink-2)' }}>
            {f.label.toUpperCase()}
          </button>
        ))}
      </div>

      {shown === null && !err && <p className="mono" style={{ fontSize: 12, color: 'var(--mid)' }}>LOADING…</p>}
      {shown?.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>No deliveries here.</p>}

      {shown?.map((d) => (
        <div key={d.id} className="rf-card" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(d.pickupArea || '—')} → {(d.dropoffArea || '—')}
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--mid)', marginTop: 3 }}>
              {new Date(d.createdAt).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {naira(d.amountMinor)} · {d.id.slice(0, 8)}…
            </div>
          </div>
          <span className="rf-pill" style={{ background: color(d.status), color: '#fff', fontSize: 10 }}>{d.status.replace(/_/g, ' ')}</span>
        </div>
      ))}
    </main>
  );
}
