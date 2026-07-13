'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/useAuth';
import { api, type Job, type RiderSummary } from '@/lib/api';
import { getToken, getUserRole } from '@/lib/session';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
const SUPPORT_EMAIL = 'support@rydafirst.ng';
const vehicleLabel = (tk: string | null) => tk === 'BIKE' ? 'Motorcycle' : tk === 'CAR' ? 'Car / Van' : tk === 'KEKE' ? 'Keke' : 'Vehicle';

function statusLabel(s: string): { text: string; color: string } {
  switch (s) {
    case 'COMPLETED': case 'RELEASED': return { text: 'Delivered', color: 'var(--success)' };
    case 'CANCELLED': return { text: 'Cancelled', color: 'var(--ink-2)' };
    case 'FAILED_ATTEMPT': return { text: 'Failed', color: 'var(--danger)' };
    case 'DISPUTED': case 'DISPUTE_RESOLVED': return { text: 'Under dispute', color: 'var(--danger)' };
    default: return { text: s.replace(/_/g, ' ').toLowerCase(), color: 'var(--info)' };
  }
}

export default function ActivityDetailPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const isRider = getUserRole() === 'RIDER';
  const [job, setJob] = useState<Job | null>(null);
  const [rider, setRider] = useState<RiderSummary | null>(null);

  useEffect(() => {
    if (!ready) return;
    api.getJob(getToken(), id).then(setJob).catch(() => {});
    api.jobRider(getToken(), id).then((r) => setRider(r.rider)).catch(() => {});
  }, [ready, id]);

  if (!ready) return null;

  const l = job ? statusLabel(job.status) : { text: '', color: 'var(--ink-2)' };
  const when = job ? new Date(job.createdAt).toLocaleString('en-NG', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <main style={{ padding: 20, maxWidth: 480, margin: '0 auto' }}>
      <button onClick={() => router.push('/activity')} className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>‹ ACTIVITY</button>
      <h1 style={{ fontSize: 20, margin: '10px 0 12px', letterSpacing: '-0.02em' }}>Delivery details</h1>

      {!job && <p className="mono" style={{ fontSize: 12, color: 'var(--mid)' }}>LOADING…</p>}

      {job && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <span className="rf-pill" style={{ background: l.color, color: '#fff', fontSize: 10 }}>{l.text.toUpperCase()}</span>
          </div>

          <div className="rf-card" style={{ marginBottom: 12 }}>
            <Row label="From" value={job.pickupArea || job.pickupAddress || '—'} />
            <Row label="To" value={job.dropoffArea || job.dropoffAddress || '—'} />
            <Row label="When" value={when} />
            <Row label="Amount" value={naira(job.amountMinor)} strong />
          </div>

          {!isRider && rider && (
            <div className="rf-card" style={{ marginBottom: 12 }}>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', marginBottom: 8 }}>YOUR RIDER</div>
              <b style={{ fontSize: 15 }}>{rider.name ?? 'Assigned rider'}{rider.nameVerified ? ' ✓' : ''}</b>
              <div className="mono" style={{ fontSize: 11, color: 'var(--mid)', marginTop: 2 }}>
                {vehicleLabel(rider.vehicleType)}
                {rider.vehicleColor ? ` · ${rider.vehicleColor.charAt(0) + rider.vehicleColor.slice(1).toLowerCase()}` : ''}
                {rider.vehiclePlate ? ` · ${rider.vehiclePlate}` : ''}
              </div>
            </div>
          )}

          <div className="rf-card">
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', marginBottom: 10 }}>NEED HELP WITH THIS DELIVERY?</div>
            <button onClick={() => router.push(`/jobs/${id}/dispute`)} className="rf-btn" style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line)', marginBottom: 8 }}>Report an issue</button>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Delivery help (ref ${id.slice(0, 8)})`)}`} className="rf-btn" style={{ display: 'block', textAlign: 'center', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line)', textDecoration: 'none' }}>Contact support</a>
          </div>
        </>
      )}
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0' }}>
      <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>{label}</span>
      <span className="mono" style={{ fontSize: strong ? 15 : 13, fontWeight: strong ? 700 : 400, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
