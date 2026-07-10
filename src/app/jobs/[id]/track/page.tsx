'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api, type Job } from '@/lib/api';
import { getToken } from '@/lib/session';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

// Ordered lifecycle for the progress bar.
const FLOW = ['FUNDED', 'SEARCHING', 'ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP', 'ARRIVED', 'COMPLETED', 'RELEASED'];

function label(status: string): { text: string; color: string } {
  switch (status) {
    case 'CREATED': return { text: 'Awaiting payment', color: 'var(--warning)' };
    case 'FUNDED': return { text: 'Payment received', color: 'var(--success)' };
    case 'SEARCHING': return { text: 'Finding a rider', color: 'var(--info)' };
    case 'ACCEPTED': return { text: 'Rider assigned', color: 'var(--info)' };
    case 'EN_ROUTE_PICKUP': return { text: 'Heading to pickup', color: 'var(--info)' };
    case 'AT_PICKUP': return { text: 'At pickup', color: 'var(--info)' };
    case 'IN_PROGRESS': return { text: 'Picked up', color: 'var(--info)' };
    case 'EN_ROUTE_DROP': return { text: 'On the way to drop-off', color: 'var(--info)' };
    case 'ARRIVED': return { text: 'Rider has arrived', color: 'var(--warning)' };
    case 'AWAITING_CODE': return { text: 'Share your delivery code', color: 'var(--warning)' };
    case 'COMPLETED': case 'RELEASED': return { text: 'Delivered', color: 'var(--success)' };
    case 'CANCELLED': return { text: 'Cancelled', color: 'var(--danger)' };
    case 'FAILED_ATTEMPT': return { text: 'Delivery failed', color: 'var(--danger)' };
    case 'DISPUTED': return { text: 'Under dispute', color: 'var(--danger)' };
    case 'DISPUTE_RESOLVED': return { text: 'Dispute resolved', color: 'var(--danger)' };
    default: return { text: status, color: 'var(--ink-2)' };
  }
}

export default function TrackPage() {
  const id = String(useParams().id);
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    try { setJob(await api.getJob(getToken(), id)); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  };

  // On return from Flutterwave, verify the transaction and fund the job (webhook-independent),
  // then poll the real job status every 4s (so you see FUNDED → SEARCHING → … as it happens).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const txn = params.get('transaction_id');
    const status = params.get('status');
    if (txn && (status === 'successful' || status === 'completed')) {
      api.confirmPayment(getToken(), id, txn).then(refresh).catch(() => { /* ignore; polling continues */ });
    }
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const step = job ? FLOW.indexOf(job.status) : -1;
  const l = job ? label(job.status) : { text: 'Loading…', color: 'var(--ink-2)' };
  const hasRider = !!job && ['ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP', 'ARRIVED', 'AWAITING_CODE'].includes(job.status);

  return (
    <main style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <b style={{ fontSize: 16 }}>Your delivery</b>
        <span className="rf-pill" style={{ background: l.color, color: '#fff' }}>{l.text.toUpperCase()}</span>
      </div>

      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}

      {/* Real status timeline */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {FLOW.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: step >= 0 && i <= step ? 'var(--ink)' : 'var(--line-2)' }} />
        ))}
      </div>

      {job && (
        <div className="rf-card" style={{ marginBottom: 12 }}>
          <Row label="Status" value={l.text} />
          <Row label="Type" value={job.type} />
          <Row label="Amount held in escrow" value={naira(job.amountMinor)} strong />
          <Row label="Job ID" value={job.id.slice(0, 8) + '…'} mono />
        </div>
      )}

      {/* Rider card (only once one is assigned) */}
      {hasRider ? (
        <div className="rf-card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--ink)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }} className="mono">R</div>
          <div style={{ flex: 1 }}><b>Your rider</b><div className="mono" style={{ fontSize: 11, color: 'var(--mid)' }}>ASSIGNED · BIKE</div></div>
        </div>
      ) : (
        <div className="rf-card" style={{ marginBottom: 12, textAlign: 'center', color: 'var(--ink-2)' }}>
          <div className="mono" style={{ fontSize: 12 }}>
            {job?.status === 'SEARCHING' ? 'FINDING A RIDER NEARBY…' : job?.status === 'CREATED' ? 'WAITING FOR PAYMENT…' : 'NO RIDER ASSIGNED YET'}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" onClick={refresh}>Refresh</Button>
        <Button variant="ghost" onClick={() => (location.href = '/home')}>New order</Button>
      </div>
    </main>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>{label}</span>
      <span className={mono ? 'mono' : ''} style={{ fontWeight: strong ? 700 : 400, fontSize: strong ? 15 : 13 }}>{value}</span>
    </div>
  );
}
