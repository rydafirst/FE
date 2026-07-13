'use client';
import { useEffect, useState } from 'react';
import { api, type AdminFinance } from '@/lib/api';
import { getToken } from '@/lib/session';
import { AdminNav, useAdminGuard } from '@/components/AdminNav';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

export default function AdminFinancePage() {
  const { ready, notAdmin } = useAdminGuard();
  const [data, setData] = useState<AdminFinance | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || notAdmin) return;
    api.adminFinance(getToken()).then(setData).catch((e) => setErr((e as Error).message));
  }, [ready, notAdmin]);
  if (!ready) return null;

  const cards = data ? [
    { label: 'Held in escrow', value: naira(data.totals.held) },
    { label: 'Released to riders', value: naira(data.totals.released) },
    { label: 'Refunded', value: naira(data.totals.refunded) },
  ] : [];

  return (
    <main style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <AdminNav />
      <h1 style={{ fontSize: 22, letterSpacing: '-0.02em', margin: '0 0 14px' }}>Finance</h1>
      {notAdmin && <p style={{ color: 'var(--danger)', fontSize: 13 }}>You need an admin account.</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
      {!data && !err && !notAdmin && <p className="mono" style={{ fontSize: 12, color: 'var(--mid)' }}>LOADING…</p>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
            {cards.map((c) => (
              <div key={c.label} className="rf-card" style={{ padding: '14px 16px' }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>{c.label.toUpperCase()}</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="rf-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <b style={{ fontSize: 14 }}>Ledger reconciliation</b>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--mid)', marginTop: 3 }}>
                DRIFT · HELD {data.reconciliation.drift.held} · REL {data.reconciliation.drift.released} · REF {data.reconciliation.drift.refunded}
              </div>
            </div>
            <span className="rf-pill" style={{ background: data.reconciliation.inSync ? 'var(--success)' : 'var(--danger)', color: '#fff', fontSize: 10 }}>
              {data.reconciliation.inSync ? 'IN SYNC' : 'DRIFT'}
            </span>
          </div>
        </>
      )}
    </main>
  );
}
