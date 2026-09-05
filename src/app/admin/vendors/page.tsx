'use client';
import { useEffect, useState } from 'react';
import { api, type Vendor } from '@/lib/api';
import { getToken } from '@/lib/session';
import { useAdminGuard } from '@/components/AdminNav';

export default function AdminVendorsPage() {
  const { ready, notAdmin } = useAdminGuard();
  const [rows, setRows] = useState<Vendor[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api.adminPendingVendors(getToken()).then(setRows).catch((e) => setErr((e as Error).message));
  useEffect(() => { if (ready && !notAdmin) load(); }, [ready, notAdmin]);

  const approve = async (id: string) => {
    setBusy(id); setErr(null);
    try { await api.adminApproveVendor(getToken(), id); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const reject = async (id: string) => {
    const reason = window.prompt('Reason for rejection (shown to the vendor):');
    if (!reason) return;
    setBusy(id); setErr(null);
    try { await api.adminRejectVendor(getToken(), id, reason); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  if (!ready) return null;

  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-heading)', letterSpacing: '-0.02em', margin: '0 0 14px' }}>Vendor approvals</h1>
      {notAdmin && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>You need an admin account to view this page.</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}
      {rows === null && !err && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}
      {rows?.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-body)' }}>No vendors awaiting approval.</p>}

      {rows?.map((v) => (
        <div key={v.id} className="rf-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-body)' }}>{v.businessName}</div>
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 4 }}>
                {[v.category, v.area, v.rcNumber ? `RC ${v.rcNumber}` : null].filter(Boolean).join(' · ') || '—'}
              </div>
              {v.description ? <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '8px 0 0' }}>{v.description}</p> : null}
            </div>
            <span className="rf-pill" style={{ background: v.accountVerified ? 'var(--success)' : 'var(--warning)', color: 'var(--on-dark)', fontSize: 'var(--text-caption)', whiteSpace: 'nowrap' }}>
              {v.accountVerified ? 'NAME MATCH' : 'NAME UNVERIFIED'}
            </span>
          </div>

          <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, margin: '12px 0' }}>
            <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>BUSINESS PAYOUT ACCOUNT</div>
            {v.account ? (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontWeight: 700 }}>{v.account.accountName}</div>
                <div className="mono" style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)' }}>{v.account.bankCode} · {v.account.accountNumber}</div>
              </div>
            ) : <div style={{ color: 'var(--danger)', fontSize: 'var(--text-small)', marginTop: 4 }}>No account added yet — cannot approve.</div>}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="rf-btn" disabled={busy === v.id || !v.account} onClick={() => approve(v.id)}>{busy === v.id ? '…' : 'Approve'}</button>
            <button className="rf-btn rf-btn--ghost" disabled={busy === v.id} onClick={() => reject(v.id)}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
