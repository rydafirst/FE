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
  // Diagnostic: force-retry a specific job's payout and show the exact provider response/error.
  const [diagId, setDiagId] = useState('');
  const [diagBusy, setDiagBusy] = useState(false);
  const [diagResult, setDiagResult] = useState<string | null>(null);

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

  const runDiagnostic = async () => {
    const id = diagId.trim();
    if (!id) return;
    setDiagBusy(true); setDiagResult(null);
    try {
      const res = await api.adminRetryPayout(getToken(), id, true); // force: re-drive even if not flagged pending
      setDiagResult(
        res.payoutPending
          ? `STILL PENDING — provider said: ${res.payoutError ?? '(no error text returned)'}`
          : 'SENT ✓ — the provider accepted this payout (or it had already succeeded).',
      );
      loadPayouts();
    } catch (e) {
      setDiagResult(`REQUEST FAILED: ${(e as Error).message}`);
    } finally { setDiagBusy(false); }
  };

  // "Accepted" ≠ "arrived": read the transfer's real terminal status straight from the processor.
  const checkStatus = async () => {
    const id = diagId.trim();
    if (!id) return;
    setDiagBusy(true); setDiagResult(null);
    try {
      const s = await api.adminTransferStatus(getToken(), id);
      setDiagResult(
        `PROCESSOR STATUS: ${s.status}` +
        (s.reason ? `\n${s.reason}` : '') +
        (s.payoutRef ? `\nTransfer ref: ${s.payoutRef}` : ''),
      );
    } catch (e) {
      setDiagResult(`STATUS CHECK FAILED: ${(e as Error).message}`);
    } finally { setDiagBusy(false); }
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
      <h1 style={{ fontSize: 'var(--text-heading)', letterSpacing: '-0.02em', margin: '0 0 14px' }}>Finance</h1>
      {notAdmin && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>You need an admin account.</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}
      {!data && !err && !notAdmin && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
            {cards.map((c) => (
              <div key={c.label} className="rf-card" style={{ padding: '14px 16px' }}>
                <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{c.label.toUpperCase()}</div>
                <div className="mono" style={{ fontSize: 'var(--text-heading)', fontWeight: 700, marginTop: 4 }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="rf-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <b style={{ fontSize: 'var(--text-body)' }}>Ledger reconciliation</b>
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 3 }}>
                DRIFT · HELD {data.reconciliation.drift.held} · REL {data.reconciliation.drift.released} · REF {data.reconciliation.drift.refunded}
              </div>
            </div>
            <span className="rf-pill" style={{ background: data.reconciliation.inSync ? 'var(--success)' : 'var(--danger)', color: 'var(--on-dark)', fontSize: 'var(--text-caption)' }}>
              {data.reconciliation.inSync ? 'IN SYNC' : 'DRIFT'}
            </span>
          </div>
        </>
      )}

      <div className="rf-card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: 'var(--text-body)' }}>Rider payouts needing retry</b>
          <button onClick={loadPayouts} className="mono" style={{ fontSize: 'var(--text-caption)', background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>REFRESH</button>
        </div>

        {note && <p style={{ color: 'var(--success)', fontSize: 'var(--text-small)', margin: '0 0 10px' }}>{note}</p>}

        {payouts === null && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}
        {payouts?.length === 0 && <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: 0 }}>No payouts pending — everyone&apos;s been paid. ✓</p>}

        {payouts && payouts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {payouts.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: '1px solid var(--line-2)', paddingTop: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>{naira(p.amountMinor)}{p.riderName ? ` · ${p.riderName}` : ''}</div>
                  <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.id.slice(0, 8)}{p.payoutError ? ` · ${p.payoutError}` : ''}
                  </div>
                </div>
                <button onClick={() => retry(p.id)} disabled={retrying === p.id}
                  style={{ background: 'var(--ink)', color: 'var(--on-dark)', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 'var(--text-small)', fontWeight: 600, cursor: retrying === p.id ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                  {retrying === p.id ? 'Retrying…' : 'Retry payout'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rf-card" style={{ marginTop: 16 }}>
        <b style={{ fontSize: 'var(--text-body)' }}>Diagnose a payout by Job ID</b>
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '4px 0 10px' }}>
          Force a re-attempt of a specific job&apos;s payout — even if it isn&apos;t in the list above — and see exactly
          what the payment provider returns. Safe to run: the transfer reuses a stable reference and can never double-pay.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={diagId}
            onChange={(e) => setDiagId(e.target.value)}
            placeholder="Paste the Job ID (e.g. 3583947e-4ec9-…)"
            className="mono"
            style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 'var(--text-small)' }}
          />
          <button onClick={runDiagnostic} disabled={diagBusy || !diagId.trim()}
            style={{ background: 'var(--ink)', color: 'var(--on-dark)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 'var(--text-small)', fontWeight: 600, cursor: diagBusy || !diagId.trim() ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
            {diagBusy ? 'Running…' : 'Retry & show error'}
          </button>
          <button onClick={checkStatus} disabled={diagBusy || !diagId.trim()}
            style={{ background: 'none', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 16px', fontSize: 'var(--text-small)', fontWeight: 600, cursor: diagBusy || !diagId.trim() ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
            Check transfer status
          </button>
        </div>
        {diagResult && (
          <pre style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 'var(--text-caption)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{diagResult}</pre>
        )}
      </div>
    </div>
  );
}
