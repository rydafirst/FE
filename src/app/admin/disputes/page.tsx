'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, type AdminDispute } from '@/lib/api';
import { getToken } from '@/lib/session';
import { AdminNav, useAdminGuard } from '@/components/AdminNav';

const OPEN = ['OPEN', 'ESCALATED', 'UNDER_REVIEW'];

export default function AdminDisputesPage() {
  const { ready, notAdmin } = useAdminGuard();
  const [rows, setRows] = useState<AdminDispute[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => api.adminDisputes(getToken()).then(setRows).catch((e) => setErr((e as Error).message)), []);
  useEffect(() => { if (ready && !notAdmin) void load(); }, [ready, notAdmin, load]);

  const resolve = async (d: AdminDispute, resolution: 'RELEASE' | 'REFUND' | 'SPLIT') => {
    let share: number | undefined;
    if (resolution === 'SPLIT') {
      const v = window.prompt("Rider's share (₦):");
      if (v == null) return;
      share = Math.round(Number(v) * 100);
      if (!Number.isFinite(share) || share < 0) return;
    }
    setBusy(d.id);
    try { await api.adminResolveDispute(getToken(), d.id, resolution, share); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  if (!ready) return null;

  return (
    <main style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <AdminNav />
      <h1 style={{ fontSize: 22, letterSpacing: '-0.02em', margin: '0 0 14px' }}>Disputes</h1>
      {notAdmin && <p style={{ color: 'var(--danger)', fontSize: 13 }}>You need an admin account.</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
      {!rows && !err && !notAdmin && <p className="mono" style={{ fontSize: 12, color: 'var(--mid)' }}>LOADING…</p>}
      {rows?.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>No disputes.</p>}

      {rows?.map((d) => {
        const open = OPEN.includes(d.status);
        return (
          <div key={d.id} className="rf-card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="mono" style={{ fontSize: 12.5 }}>Job {d.jobId.slice(0, 8)}…</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--mid)', marginTop: 3 }}>
                  {d.tier.toUpperCase()} · {new Date(d.createdAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}
                  {d.resolution ? ` · ${d.resolution}` : ''}
                </div>
              </div>
              <span className="rf-pill" style={{ background: open ? 'var(--warning)' : 'var(--success)', color: '#fff', fontSize: 10 }}>{d.status.replace(/_/g, ' ')}</span>
            </div>
            {open && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {(['RELEASE', 'REFUND', 'SPLIT'] as const).map((r) => (
                  <button key={r} onClick={() => resolve(d, r)} disabled={busy === d.id} className="rf-btn"
                    style={{ flex: 1, fontSize: 12, background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line)' }}>
                    {r[0] + r.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}
