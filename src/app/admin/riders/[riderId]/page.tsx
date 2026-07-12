'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, type AdminRiderDetail, type AdminRiderDoc } from '@/lib/api';
import { getToken, getUserRole, isLoggedIn } from '@/lib/session';

const DOC_STATUS: Record<string, string> = {
  SUBMITTED: 'var(--info)', UNDER_REVIEW: 'var(--info)', APPROVED: 'var(--success)',
  REJECTED: 'var(--danger)', EXPIRED: 'var(--danger)',
};

export default function AdminRiderPage() {
  const router = useRouter();
  const { riderId } = useParams<{ riderId: string }>();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AdminRiderDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.adminRiderDocuments(getToken(), riderId)); }
    catch (e) { setErr((e as Error).message); }
  }, [riderId]);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return; }
    if (getUserRole() !== 'ADMIN') { setErr('You need an admin account to view this page.'); setReady(true); return; }
    setReady(true);
    void load();
  }, [router, load]);

  const approve = async (doc: AdminRiderDoc) => {
    setBusy(doc.id);
    try { await api.adminApproveDocument(getToken(), doc.id); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  const reject = async (doc: AdminRiderDoc) => {
    const reason = window.prompt(`Reject "${doc.label}" — reason shown to the rider:`);
    if (!reason || reason.trim().length < 3) return;
    setBusy(doc.id);
    try { await api.adminRejectDocument(getToken(), doc.id, reason.trim()); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  if (!ready) return null;

  return (
    <main style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <a href="/admin" className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', textDecoration: 'none' }}>‹ BACK TO QUEUE</a>
      <h1 style={{ fontSize: 20, letterSpacing: '-0.02em', margin: '10px 0 4px' }}>
        Rider {riderId.slice(0, 8)}…
      </h1>
      {data && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 16 }}>
          {(data.track ?? 'NO VEHICLE')} · {data.status}
        </div>
      )}

      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
      {data === null && !err && <p className="mono" style={{ fontSize: 12, color: 'var(--mid)' }}>LOADING…</p>}
      {data?.documents.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>No documents uploaded yet.</p>}

      {data?.documents.map((doc) => (
        <div key={doc.id} className="rf-card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <b style={{ fontSize: 14 }}>{doc.label}</b>
            <span className="rf-pill" style={{ background: DOC_STATUS[doc.status] ?? 'var(--ink-2)', color: '#fff', fontSize: 10 }}>{doc.status}</span>
          </div>

          {/* Preview via short-lived signed URL. Falls back to a link if the image can't render. */}
          <a href={doc.previewUrl} target="_blank" rel="noreferrer">
            <img
              src={doc.previewUrl}
              alt={doc.label}
              style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)' }}
            />
          </a>

          {doc.expiresAt && (
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--mid)', marginTop: 8 }}>
              EXPIRES {new Date(doc.expiresAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          )}
          {doc.rejectionReason && doc.status === 'REJECTED' && (
            <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 8 }}>Rejected: {doc.rejectionReason}</div>
          )}

          {doc.status !== 'APPROVED' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => approve(doc)} disabled={busy === doc.id} className="rf-btn"
                style={{ flex: 1, background: 'var(--ink)', color: '#fff', opacity: busy === doc.id ? 0.6 : 1 }}>
                {busy === doc.id ? '…' : 'Approve'}
              </button>
              <button onClick={() => reject(doc)} disabled={busy === doc.id} className="rf-btn"
                style={{ flex: 1, background: 'var(--bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </main>
  );
}
