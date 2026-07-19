'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, type AdminFinance, type PendingPayout } from '@/lib/api';
import { getToken } from '@/lib/session';
import { useAdminGuard } from '@/components/AdminNav';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

export default function AdminFinancePage() {
  const { ready, notAdmin } = useAdminGuard();
  const [data, setData] = useState<AdminFinance | null>(null);
  const [payouts, setPayouts] = useState<PendingPayout[] | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadPayouts = useCallback(() => {
    api.adminPendingPayouts(getToken()).then(setPayouts).catch(() => setPayouts([]));
  }, []);

  useEffect(() => {
    if (!ready || notAdmin) return;
    api.adminFinance(getToken()).then(setData).catch((e) => setErr((e as Error).message));
    loadPayouts();
  }, [ready, notAdmin, loadPayouts]);

  const retry = async (jobId: string) => {
    setRetrying(jobId); setNote(null); setErr(null);
    try {
      const res = await api.adminRetryPayout(getToken(), jobId);
      setNote(res.payoutPending ? `Still pending${res.payoutError ? `: ${res.payoutError}` : ''}` : 'Payout sent to the rider ✓');
      loadPayouts();
    } catch (e) { setErr((e as Error).message); } finally { setRetrying(null); }
  };

  if (!ready) return null;

  const cards = data ? [
    { label: 'Held in escrow', value: naira(data.totals.held) },
    { label: 'Released to riders', value: naira(data.totals.released) },
    { label: 'Refunded', value: naira(data.totals.refunded) },
    { label: 'Platform revenue', value: naira(data.totals.platformRevenue) },
  ] : [];

  return (
    <div>
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

      <div className="rf-card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>Rider payouts needing retry</b>
          <button onClick={loadPayouts} className="mono" style={{ fontSize: 10, background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>REFRESH</button>
        </div>

        {note && <p style={{ color: 'var(--success)', fontSize: 12.5, margin: '0 0 10px' }}>{note}</p>}

        {payouts === null && <p className="mono" style={{ fontSize: 11, color: 'var(--mid)' }}>LOADING…</p>}
        {payouts?.length === 0 && <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>No payouts pending — everyone&apos;s been paid. ✓</p>}

        {payouts && payouts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {payouts.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: '1px solid var(--line-2)', paddingTop: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{naira(p.amountMinor)}{p.riderName ? ` · ${p.riderName}` : ''}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.id.slice(0, 8)}{p.payoutError ? ` · ${p.payoutError}` : ''}
                  </div>
                </div>
                <button onClick={() => retry(p.id)} disabled={retrying === p.id}
                  style={{ background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: retrying === p.id ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                  {retrying === p.id ? 'Retrying…' : 'Retry payout'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
