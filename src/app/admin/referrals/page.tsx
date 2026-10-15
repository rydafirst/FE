'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, type AdminReferralRow } from '@/lib/api';
import { getToken } from '@/lib/session';
import { useAdminGuard } from '@/components/AdminNav';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
const who = (p: { name: string | null; phone: string | null }) => p.name || p.phone || '—';
function ago(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_COLOR: Record<string, string> = { PENDING: 'var(--info)', CREDITED: 'var(--success)', REJECTED: 'var(--mid)' };

export default function AdminReferralsPage() {
  const { ready, notAdmin } = useAdminGuard();
  const [rows, setRows] = useState<AdminReferralRow[] | null>(null);
  const [reward, setReward] = useState<number>(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api.adminReferrals(getToken()).then((r) => { setRows(r.items); setReward(r.rewardMinor); }).catch(() => setRows([]));
  }, []);

  useEffect(() => { if (ready && !notAdmin) load(); }, [ready, notAdmin, load]);

  if (!ready) return null;
  if (notAdmin) return <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>You need an admin account.</p>;

  const act = async (id: string, kind: 'credit' | 'reject') => {
    if (busy) return;
    if (kind === 'reject' && !window.confirm('Reject this referral? The referrer will not be paid.')) return;
    setBusy(id + kind); setErr(null);
    try {
      if (kind === 'credit') await api.adminCreditReferral(getToken(), id);
      else await api.adminRejectReferral(getToken(), id);
      load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  const pending = rows?.filter((r) => r.status === 'PENDING') ?? [];
  const qualified = pending.filter((r) => r.qualified).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <h1 style={{ fontSize: 'var(--text-title)', letterSpacing: '-0.02em', margin: 0 }}>Referrals</h1>
        <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>REWARD {naira(reward)} · {qualified} READY TO PAY</span>
      </div>

      <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 16px', maxWidth: 560 }}>
        A rider earns {naira(reward)} when someone they referred completes their first delivery. Rows marked
        <b> Ready</b> have qualified — crediting pays the referrer to their payout account. Set the amount in{' '}
        <a href="/admin/settings" style={{ color: 'var(--ink)' }}>Settings</a>.
      </p>

      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}

      {rows === null && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}
      {rows?.length === 0 && <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)' }}>No referrals yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows?.map((r) => (
          <div key={r.id} className="rf-card" style={{ borderColor: r.status === 'PENDING' && r.qualified ? 'var(--success)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>
                  {who(r.referrer)} <span style={{ color: 'var(--mid)' }}>referred</span> {who(r.referee)}
                </div>
                <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 2 }}>
                  {r.referee.phone ?? '—'} · {r.refereeDeliveries} deliver{r.refereeDeliveries === 1 ? 'y' : 'ies'} · {ago(r.createdAt)}
                </div>
                {r.payoutError && <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--danger)', marginTop: 4 }}>LAST PAYOUT ERROR: {r.payoutError}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="rf-pill" style={{ background: STATUS_COLOR[r.status], color: 'var(--on-dark)', fontSize: 'var(--text-caption)' }}>
                  {r.status === 'PENDING' && r.qualified ? 'READY' : r.status}
                </span>
                <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginTop: 4 }}>{naira(r.rewardMinor)}</div>
              </div>
            </div>

            {r.status === 'PENDING' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => act(r.id, 'credit')} disabled={!r.qualified || busy === r.id + 'credit'}
                  title={r.qualified ? '' : 'The referred rider has not completed a delivery yet'}
                  style={{ flex: 1, background: r.qualified ? 'var(--ink)' : 'var(--line)', color: r.qualified ? 'var(--on-dark)' : 'var(--mid)', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: r.qualified ? 'pointer' : 'not-allowed', fontSize: 'var(--text-body)', fontWeight: 600 }}>
                  {busy === r.id + 'credit' ? 'Paying…' : `Credit ${naira(r.rewardMinor)}`}
                </button>
                <button onClick={() => act(r.id, 'reject')} disabled={busy === r.id + 'reject'} className="mono"
                  style={{ border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', fontSize: 'var(--text-caption)' }}>
                  {busy === r.id + 'reject' ? '…' : 'REJECT'}
                </button>
              </div>
            )}
            {r.status === 'CREDITED' && r.creditedAt && (
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--success)', marginTop: 10 }}>
                PAID {ago(r.creditedAt)}{r.payoutRef ? ` · ${r.payoutRef}` : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
