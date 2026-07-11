'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { LiveMap, type LatLng } from '@/components/LiveMap';
import { api, type Job } from '@/lib/api';
import { getToken, getUserId } from '@/lib/session';
import { connectSocket } from '@/lib/live';

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
  const [deliveryCode, setDeliveryCode] = useState<string | null>(null);
  const [riderPos, setRiderPos] = useState<LatLng | null>(null);
  // Read the payment status Flutterwave appended on redirect. A cancelled/failed payment must
  // NOT start a trip — the job stays unfunded and we send the customer back to booking.
  const [cancelled, setCancelled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const s = new URLSearchParams(window.location.search).get('status');
    return s === 'cancelled' || s === 'failed';
  });

  const revealCode = async () => {
    try { const r = await api.issueCode(getToken(), id); setDeliveryCode(r.code); }
    catch (e) { setErr((e as Error).message); }
  };

  const refresh = async () => {
    try { setJob(await api.getJob(getToken(), id)); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  };

  // On return from Flutterwave, verify the transaction and fund the job (webhook-independent),
  // then poll the real job status every 4s (so you see FUNDED → SEARCHING → … as it happens).
  useEffect(() => {
    if (cancelled) return; // payment didn't go through — don't fetch or poll a trip
    const txn = new URLSearchParams(window.location.search).get('transaction_id');
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => { stopped = true; if (timer) clearInterval(timer); };
    const TERMINAL = ['CANCELLED', 'RELEASED', 'COMPLETED', 'DISPUTE_RESOLVED', 'FAILED_ATTEMPT'];

    // Bank transfers settle asynchronously, so keep re-verifying while the job is still
    // unfunded (CREATED). confirmFunding is idempotent, so this can never double-fund.
    // Stop polling once the order reaches a terminal state (delivered/cancelled/etc.).
    const tick = async () => {
      let current: Job | null = null;
      try { current = await api.getJob(getToken(), id); setJob(current); setErr(null); }
      catch (e) { setErr((e as Error).message); }
      if (current && TERMINAL.includes(current.status)) { stop(); return; }
      if (txn && current && current.status === 'CREATED') {
        try {
          const r = await api.confirmPayment(getToken(), id, txn);
          if (r.funded && !stopped) { try { setJob(await api.getJob(getToken(), id)); } catch { /* next tick */ } }
        } catch { /* still settling — try again next tick */ }
      }
    };

    tick();
    timer = setInterval(() => { if (!stopped) tick(); }, 4000);
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cancelled]);

  // Live rider location: join the job's realtime room and update the map as pings arrive.
  useEffect(() => {
    if (cancelled) return; // no trip to track
    let sock: { emit: (e: string, d: unknown) => void; on: (e: string, cb: (d: unknown) => void) => void; disconnect: () => void } | null = null;
    let closed = false;
    connectSocket().then((s) => {
      if (closed) { s.disconnect(); return; }
      sock = s;
      s.emit('subscribe', { jobId: id, userId: getUserId() });
      s.on('location', (msg: { point?: LatLng }) => { if (msg?.point) setRiderPos({ lat: msg.point.lat, lng: msg.point.lng }); });
    }).catch(() => { /* map still shows pickup/dropoff without live rider */ });
    return () => { closed = true; if (sock) sock.disconnect(); };
  }, [id]);

  // Payment cancelled / order expired: no trip, no charge. Send the customer back to booking.
  if (cancelled || job?.status === 'CANCELLED') {
    const expired = !cancelled && job?.status === 'CANCELLED';
    return (
      <main style={{ padding: 20, minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="rf-card" style={{ textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--warning)', letterSpacing: '.08em', marginBottom: 8 }}>
            {expired ? 'ORDER EXPIRED' : 'PAYMENT NOT COMPLETED'}
          </div>
          <b style={{ fontSize: 18 }}>You weren’t charged</b>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: '8px 0 16px' }}>
            {expired
              ? 'This order timed out before payment was completed, so it was cancelled and nothing was held in escrow.'
              : 'The payment was cancelled, so no rider was requested and nothing was held in escrow.'}
            {' '}You can start again whenever you’re ready.
          </p>
          <Button onClick={() => (location.href = '/home')}>Back to booking</Button>
        </div>
      </main>
    );
  }

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

      {/* Live map: pickup + drop-off always; the rider marker appears once a rider is assigned and streaming. */}
      {job && (job.pickup || job.dropoff) && (
        <div style={{ marginBottom: 12 }}>
          <LiveMap pickup={job.pickup} dropoff={job.dropoff} rider={hasRider ? riderPos : null} />
          {hasRider && !riderPos && (
            <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', textAlign: 'center', marginTop: 6 }}>
              WAITING FOR RIDER LOCATION…
            </p>
          )}
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

      {/* Receiver's delivery code — the sender reveals it and gives it to the rider on arrival.
          The rider entering this code is what releases the escrow. */}
      {hasRider && (
        <div className="rf-card" style={{ marginBottom: 12, textAlign: 'center' }}>
          {deliveryCode ? (
            <>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.06em' }}>DELIVERY CODE</div>
              <div className="mono" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '.3em', margin: '6px 0' }}>{deliveryCode}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)' }}>GIVE THIS TO YOUR RIDER ON ARRIVAL</div>
            </>
          ) : (
            <Button variant="ghost" onClick={revealCode}>Reveal delivery code</Button>
          )}
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
