'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, type AdminDelivery, type AdminOps } from '@/lib/api';
import { getToken } from '@/lib/session';
import { useAdminGuard } from '@/components/AdminNav';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
const ACTIVE = ['CREATED', 'FUNDED', 'SEARCHING', 'ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP', 'ARRIVED', 'AWAITING_CODE', 'EN_ROUTE_STOP'];

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
    <div>
      <h1 style={{ fontSize: 'var(--text-heading)', letterSpacing: '-0.02em', margin: '0 0 14px' }}>Deliveries</h1>
      {notAdmin && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>You need an admin account.</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
          <div className="rf-card" style={{ padding: '12px 14px' }}>
            <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>ACTIVE TOTAL</div>
            <div className="mono" style={{ fontSize: 'var(--text-heading)', fontWeight: 700, marginTop: 2 }}>{summary.activeTotal}</div>
          </div>
          {Object.entries(summary.byStatus).map(([k, v]) => (
            <div key={k} className="rf-card" style={{ padding: '12px 14px' }}>
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{k.replace(/_/g, ' ').toUpperCase()}</div>
              <div className="mono" style={{ fontSize: 'var(--text-heading)', fontWeight: 700, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className="mono"
            style={{ padding: '6px 14px', borderRadius: 999, fontSize: 'var(--text-caption)', whiteSpace: 'nowrap', cursor: 'pointer',
              border: `1px solid ${filter === f.key ? 'var(--ink)' : 'var(--line)'}`,
              background: filter === f.key ? 'var(--ink)' : 'var(--bg)', color: filter === f.key ? 'var(--on-dark)' : 'var(--ink-2)' }}>
            {f.label.toUpperCase()}
          </button>
        ))}
      </div>

      {shown === null && !err && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}
      {shown?.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-body)' }}>No deliveries here.</p>}

      {shown?.map((d) => <DeliveryRow key={d.id} d={d} />)}
    </div>
  );
}

/**
 * One delivery row — click to expand. The expanded panel shows the FULL job id with a copy button and,
 * for a completed/released delivery, one-click payout actions wired straight to this job (no copying an
 * id into a separate box). This is the admin's "is this rider actually paid, and if not, pay them" path.
 */
function DeliveryRow({ d }: { d: AdminDelivery }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // A payout only exists once the delivery is done — that's when a rider transfer was attempted.
  const payoutRelevant = d.status === 'COMPLETED' || d.status === 'RELEASED';

  const copyId = async () => {
    try { await navigator.clipboard.writeText(d.id); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  const checkStatus = async () => {
    setBusy(true); setResult(null);
    try {
      const s = await api.adminTransferStatus(getToken(), d.id);
      setResult(`Payout status: ${s.status}${s.reason ? ` — ${s.reason}` : ''}${s.payoutRef ? `\nTransfer ref: ${s.payoutRef}` : ''}`);
    } catch (e) { setResult(`Status check failed: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await api.adminResendPayout(getToken(), d.id);
      const msg: Record<string, string> = {
        RESENT: `Re-sent ✓ — a fresh transfer for ${naira(r.amountMinor ?? 0)} was created. Tap "Check payout status" in a minute to confirm it settles.`,
        ALREADY_SUCCESSFUL: 'No action — the rider has already been paid.',
        IN_FLIGHT: `No action — the transfer is still ${r.providerStatus}. Wait for it to settle before re-sending.`,
        UNKNOWN_AMOUNT: 'Cannot re-send — the failed transfer amount could not be read. Needs manual review.',
      };
      setResult(msg[r.outcome] ?? `${r.outcome} (${r.providerStatus})`);
    } catch (e) { setResult(`Re-send failed: ${(e as Error).message}`); } finally { setBusy(false); }
  };

  const chip = { fontSize: 'var(--text-caption)', borderRadius: 8, padding: '7px 12px', cursor: busy ? 'default' : 'pointer', fontWeight: 600 } as const;

  return (
    <div className="rf-card" style={{ marginBottom: 8 }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {(d.pickupArea || '—')} → {(d.dropoffArea || '—')}
          </div>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 3 }}>
            {new Date(d.createdAt).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {naira(d.amountMinor)} · {d.id.slice(0, 8)}…
          </div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {d.payoutPending && (
            <span className="rf-pill" style={{ background: 'var(--danger)', color: 'var(--on-dark)', fontSize: 'var(--text-caption)' }}>PAYOUT DUE</span>
          )}
          <span className="rf-pill" style={{ background: color(d.status), color: 'var(--on-dark)', fontSize: 'var(--text-caption)' }}>{d.status.replace(/_/g, ' ')}</span>
          <span className="mono" style={{ color: 'var(--mid)', fontSize: 'var(--text-caption)' }}>{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line-2)', paddingTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', wordBreak: 'break-all' }}>JOB ID: {d.id}</span>
            <button onClick={copyId} className="mono" style={{ ...chip, background: 'none', border: '1px solid var(--line)', color: 'var(--ink)' }}>{copied ? 'COPIED ✓' : 'COPY ID'}</button>
          </div>

          {payoutRelevant ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button onClick={checkStatus} disabled={busy} style={{ ...chip, background: 'none', color: 'var(--ink)', border: '1px solid var(--line)' }}>Check payout status</button>
              <button onClick={resend} disabled={busy} style={{ ...chip, background: 'var(--success)', color: 'var(--on-dark)', border: 'none' }}>{busy ? 'Working…' : 'Re-send payout'}</button>
            </div>
          ) : (
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', margin: '8px 0 0' }}>No rider payout yet — a payout exists only after the delivery is completed.</p>
          )}

          {result && <pre style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 'var(--text-caption)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{result}</pre>}
        </div>
      )}
    </div>
  );
}
