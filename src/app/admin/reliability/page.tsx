'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, type LateReport, type RiderReliabilitySummary } from '@/lib/api';
import { getToken } from '@/lib/session';
import { useAdminGuard } from '@/components/AdminNav';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
const mins = (s: number) => `${Math.round(s / 60)} min`;
const when = (ms: number) => new Date(ms).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function verdictColor(v: LateReport['verdict']): string {
  return v === 'LATE' ? 'var(--danger)' : v === 'ON_TIME' ? 'var(--success)' : 'var(--warning)';
}
function statusColor(s: LateReport['status']): string {
  return s === 'UPHELD' ? 'var(--danger)' : s === 'WAIVED' || s === 'DISMISSED' ? 'var(--ink-2)' : 'var(--warning)';
}

/**
 * Admin adjudication of rider lateness. The queue holds only the reports the traffic check could not
 * clear either way (verdict UNCERTAIN → PENDING); clearly on-time reports auto-dismiss and clearly late
 * ones auto-strike, so they never land here. Upholding a report applies a strike (and, when the money
 * switch is on, records the 10% forfeit); waiving clears it with no penalty.
 */
export default function AdminReliabilityPage() {
  const { ready, notAdmin } = useAdminGuard();
  const [reports, setReports] = useState<LateReport[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setReports(await api.adminReliabilityReports(getToken())); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  }, []);

  useEffect(() => { if (ready && !notAdmin) load(); }, [ready, notAdmin, load]);

  const decide = async (id: string, action: 'uphold' | 'waive') => {
    setBusyId(id); setErr(null);
    try {
      if (action === 'uphold') await api.adminUpholdReport(getToken(), id);
      else await api.adminWaiveReport(getToken(), id);
      await load();
    } catch (e) { setErr((e as Error).message); } finally { setBusyId(null); }
  };

  if (!ready) return null;

  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-heading)', letterSpacing: '-0.02em', margin: '0 0 6px' }}>Rider reliability</h1>
      <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Late-delivery reports the traffic check couldn&apos;t clear on its own. Upholding adds a strike (3 in a month = 1-day
        suspension); waiving clears it with no penalty. Check traffic on the route before deciding.
      </p>
      {notAdmin && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>You need an admin account.</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}

      <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', margin: '0 0 10px', letterSpacing: '.06em' }}>PENDING REVIEW</div>
      {!reports && !err && !notAdmin && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}
      {reports && reports.length === 0 && (
        <div className="rf-card" style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)' }}>Nothing waiting — no late reports need a decision.</div>
      )}

      {reports?.map((r) => (
        <div key={r.id} className="rf-card" style={{ marginBottom: 12, borderColor: 'var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
            <span className="mono" style={{ fontSize: 'var(--text-caption)', color: verdictColor(r.verdict), letterSpacing: '.06em' }}>{r.verdict}</span>
            <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{when(r.createdAt)}</span>
          </div>
          <Row label="Actual (pickup → delivered)" value={mins(r.actualSec)} strong />
          <Row label="Our estimate (15 km/h)" value={mins(r.staticEtaSec)} />
          <Row label="Traffic-aware estimate" value={r.trafficAwareSec != null ? mins(r.trafficAwareSec) : 'unavailable'} />
          <Row label="Delivery fee" value={naira(r.deliveryFeeMinor)} />
          {r.forfeitMinor != null ? <Row label="Forfeit if upheld (10%)" value={naira(r.forfeitMinor)} /> : null}
          <div style={{ height: 1, background: 'var(--line-2)', margin: '8px 0' }} />
          <Row label="Rider" value={r.riderId} mono />
          <Row label="Job" value={r.jobId} mono />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => decide(r.id, 'uphold')} disabled={busyId === r.id} className="mono"
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--danger)', color: 'var(--on-dark)', fontSize: 'var(--text-caption)', letterSpacing: '.06em' }}>
              {busyId === r.id ? '…' : 'UPHOLD (STRIKE)'}
            </button>
            <button onClick={() => decide(r.id, 'waive')} disabled={busyId === r.id} className="mono"
              style={{ flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line)', fontSize: 'var(--text-caption)', letterSpacing: '.06em' }}>
              {busyId === r.id ? '…' : 'WAIVE (NO PENALTY)'}
            </button>
          </div>
        </div>
      ))}

      <div style={{ height: 24 }} />
      <RiderLookup />
    </div>
  );
}

/** Look up any rider's reliability standing — strikes, score, suspension — with admin overrides. */
function RiderLookup() {
  const [riderId, setRiderId] = useState('');
  const [summary, setSummary] = useState<RiderReliabilitySummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async () => {
    if (!riderId.trim()) return;
    setBusy(true); setErr(null);
    try { setSummary(await api.adminRiderReliability(getToken(), riderId.trim())); }
    catch (e) { setErr((e as Error).message); setSummary(null); } finally { setBusy(false); }
  };
  const addStrike = async () => {
    if (!summary) return;
    const reason = window.prompt('Reason for this strike?') ?? undefined;
    setBusy(true); setErr(null);
    try { await api.adminRiderStrike(getToken(), summary.riderId, { reason }); await lookup(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const lift = async () => {
    if (!summary) return;
    setBusy(true); setErr(null);
    try { await api.adminLiftSuspension(getToken(), summary.riderId); await lookup(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', margin: '0 0 10px', letterSpacing: '.06em' }}>RIDER STANDING</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="rf-input" style={{ flex: 1 }} value={riderId} onChange={(e) => setRiderId(e.target.value)} placeholder="Rider ID" onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }} />
        <button onClick={lookup} disabled={busy} className="mono"
          style={{ padding: '0 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--ink)', color: 'var(--on-dark)', fontSize: 'var(--text-caption)', letterSpacing: '.06em' }}>
          {busy ? '…' : 'LOOK UP'}
        </button>
      </div>
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}

      {summary && (
        <div className="rf-card" style={{ borderColor: summary.suspendedUntil ? 'var(--danger)' : 'var(--line)' }}>
          <Row label="Reliability score" value={`${Math.round(summary.score * 100)}%`} strong />
          <Row label="Active strikes (30 days)" value={`${summary.activeStrikes} / 3`} />
          <Row label="Total strikes" value={String(summary.totalStrikes)} />
          <Row label="Suspended" value={summary.suspendedUntil ? `until ${when(summary.suspendedUntil)}` : 'no'} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={addStrike} disabled={busy} className="mono"
              style={{ flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line)', fontSize: 'var(--text-caption)', letterSpacing: '.06em' }}>
              ADD STRIKE
            </button>
            {summary.suspendedUntil ? (
              <button onClick={lift} disabled={busy} className="mono"
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--ink)', color: 'var(--on-dark)', fontSize: 'var(--text-caption)', letterSpacing: '.06em' }}>
                LIFT SUSPENSION
              </button>
            ) : null}
          </div>

          {summary.reports.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 8, letterSpacing: '.06em' }}>RECENT REPORTS</div>
              {summary.reports.map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid var(--line-2)', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{when(r.createdAt)}</span>
                  <span className="mono" style={{ fontSize: 'var(--text-caption)', color: verdictColor(r.verdict) }}>{r.verdict}</span>
                  <span className="mono" style={{ fontSize: 'var(--text-caption)', color: statusColor(r.status) }}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', gap: 12 }}>
      <span style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)' }}>{label}</span>
      <span className={mono ? 'mono' : ''} style={{ fontWeight: strong ? 700 : 400, fontSize: strong ? 'var(--text-body)' : 'var(--text-small)', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
