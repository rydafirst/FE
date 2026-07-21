'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type AdminOps, type AdminDelivery, type AdminFinance, type AdminDispute, type AdminQueueEntry, type PendingPayout } from '@/lib/api';
import { getToken } from '@/lib/session';
import { useAdminGuard } from '@/components/AdminNav';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'var(--success)', RELEASED: 'var(--success)',
  CANCELLED: 'var(--mid)', DISPUTED: 'var(--danger)', FAILED_ATTEMPT: 'var(--danger)',
};
const statusColor = (s: string) => STATUS_COLOR[s] ?? 'var(--info)';

export default function AdminDashboardPage() {
  const { ready, notAdmin } = useAdminGuard();
  const [ops, setOps] = useState<AdminOps | null>(null);
  const [deliveries, setDeliveries] = useState<AdminDelivery[] | null>(null);
  const [finance, setFinance] = useState<AdminFinance | null>(null);
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [queue, setQueue] = useState<AdminQueueEntry[]>([]);
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(() => {
    const t = getToken();
    api.adminOps(t).then(setOps).catch(() => {});
    api.adminDeliveries(t).then(setDeliveries).catch(() => {});
    api.adminFinance(t).then(setFinance).catch(() => {});
    api.adminDisputes(t).then(setDisputes).catch(() => {});
    api.adminDocQueue(t).then(setQueue).catch(() => {});
    api.adminPendingPayouts(t).then(setPayouts).catch(() => {});
    setUpdated(new Date());
  }, []);

  // Initial load + live refresh every 10s while the tab is open.
  useEffect(() => {
    if (!ready || notAdmin) return;
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [ready, notAdmin, load]);

  if (!ready) return null;
  if (notAdmin) return <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>You need an admin account.</p>;

  const openDisputes = disputes.filter((d) => d.status !== 'RESOLVED').length;
  const queuePending = queue.filter((q) => q.status === 'UNDER_REVIEW').length;

  const stats = [
    { label: 'Active jobs now', value: ops ? ops.summary.activeTotal : '—', href: '/admin/deliveries' },
    { label: 'Held in escrow', value: finance ? naira(finance.totals.held) : '—', href: '/admin/finance' },
    { label: 'Released to riders', value: finance ? naira(finance.totals.released) : '—', href: '/admin/finance' },
    { label: 'Payouts to retry', value: payouts.length, href: '/admin/finance', alert: payouts.length > 0 },
    { label: 'Riders to review', value: queuePending, href: '/admin/riders', alert: queuePending > 0 },
    { label: 'Open disputes', value: openDisputes, href: '/admin/disputes', alert: openDisputes > 0 },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <h1 style={{ fontSize: 'var(--text-title)', letterSpacing: '-0.02em', margin: 0 }}>Dashboard</h1>
        <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', marginRight: 6 }} />
          LIVE{updated ? ` · UPDATED ${ago(updated.toISOString())}` : ''}
        </span>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rf-card" style={{ textDecoration: 'none', color: 'inherit', padding: '16px 18px', borderColor: s.alert ? 'var(--danger)' : undefined }}>
            <div className="mono" style={{ fontSize: 'var(--text-caption)', color: s.alert ? 'var(--danger)' : 'var(--ink-2)', letterSpacing: '.05em' }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 'var(--text-title)', fontWeight: 700, marginTop: 6, letterSpacing: '-0.02em' }}>{s.value}</div>
          </Link>
        ))}
      </div>

      <div className="admin-dash-grid">
        {/* Live activity feed */}
        <div className="rf-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <b style={{ fontSize: 'var(--text-body)' }}>Live activity</b>
            <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LATEST BOOKINGS &amp; DELIVERIES</span>
          </div>
          {deliveries === null && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}
          {deliveries?.length === 0 && <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: 0 }}>No activity yet.</p>}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {deliveries?.slice(0, 12).map((d) => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--line-2)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-small)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.type === 'RIDE' ? 'Ride' : 'Delivery'} · {d.pickupArea ?? '—'} → {d.dropoffArea ?? '—'}
                  </div>
                  <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 2 }}>{naira(d.amountMinor)} · {ago(d.createdAt)}</div>
                </div>
                <span className="rf-pill" style={{ background: statusColor(d.status), color: 'var(--on-dark)', fontSize: 'var(--text-caption)', whiteSpace: 'nowrap' }}>{d.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active-by-status + shortcuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="rf-card">
            <b style={{ fontSize: 'var(--text-body)' }}>In progress right now</b>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ops && Object.keys(ops.summary.byStatus).length === 0 && <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: 0 }}>Nothing active.</p>}
              {ops && Object.entries(ops.summary.byStatus).map(([status, n]) => (
                <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{status.replace(/_/g, ' ')}</span>
                  <b style={{ fontSize: 'var(--text-body)' }}>{n}</b>
                </div>
              ))}
              {!ops && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
