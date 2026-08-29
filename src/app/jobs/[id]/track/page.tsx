'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { LiveMap, type LatLng } from '@/components/LiveMap';
import { BankAccountForm } from '@/components/BankAccountForm';
import { ChatPanel } from '@/components/ChatPanel';
import { api, type Job, type RiderSummary } from '@/lib/api';
import { getToken, getUserId } from '@/lib/session';
import { connectSocket, fetchRoute } from '@/lib/live';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

// Ordered lifecycle for the progress bar.
// #4 MULTI-STOP: EN_ROUTE_STOP sits after the primary drop-off (ARRIVED) — the rider is working
// through the extra stops before the final release.
const FLOW = ['FUNDED', 'SEARCHING', 'ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP', 'ARRIVED', 'EN_ROUTE_STOP', 'COMPLETED', 'RELEASED'];
// A customer can cancel (and be refunded) any time before the parcel is picked up.
const CANCELLABLE = ['CREATED', 'FUNDED', 'SEARCHING', 'ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP'];

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
    case 'EN_ROUTE_STOP': return { text: 'Delivering your stops', color: 'var(--info)' };
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
  const [showCancel, setShowCancel] = useState(false);
  const [refAcct, setRefAcct] = useState<{ accountName: string; accountNumberMasked: string; bankCode: string } | null>(null);
  const [riderPos, setRiderPos] = useState<LatLng | null>(null);
  const [trail, setTrail] = useState<LatLng[]>([]); // breadcrumb of the rider's actual movement
  const [route, setRoute] = useState<LatLng[]>([]); // planned road route pickup -> dropoff
  // Read the payment status Flutterwave appended on redirect. A cancelled/failed payment must
  // NOT start a trip — the job stays unfunded and we send the customer back to booking.
  const [cancelled, setCancelled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const s = new URLSearchParams(window.location.search).get('status');
    return s === 'cancelled' || s === 'failed';
  });

  const [showChat, setShowChat] = useState(false);
  // #0 DIRECT DELIVERY: waiting-fee / keep-waiting / return-to-me are disabled for launch. In direct
  // mode the backend never puts a job in WAITING/AWAITING_RESOLUTION and the pay-waiting/return
  // endpoints return 409, so this UI + its calls are commented out. `needsResolution` is pinned false
  // so the rest of the screen (which reads it) still compiles and behaves as "no resolution needed".
  const needsResolution = false;
  // const needsResolution = !!job && (job.status === 'WAITING' || job.status === 'AWAITING_RESOLUTION');
  // const waitingDue = !!job?.waitingFeeMinor && !job?.waitingTxId;
  // const payWaiting = async () => {
  //   try { const r = await api.payWaiting(getToken(), id); window.open(r.paymentLink, '_blank'); }
  //   catch (e) { setErr((e as Error).message); }
  // };
  // const returnToMe = async () => {
  //   try { const r = await api.initiateReturn(getToken(), id); if (r.paymentLink) window.open(r.paymentLink, '_blank'); }
  //   catch (e) { setErr((e as Error).message); }
  // };
  const notifyComing = async () => {
    try { await api.notifyComing(getToken(), id); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  };
  const revealCode = async () => {
    try { const r = await api.issueCode(getToken(), id); setDeliveryCode(r.code); }
    catch (e) { setErr((e as Error).message); }
  };
  const cancelOrder = async () => {
    try { await api.cancelJob(getToken(), id); location.href = '/activity'; }
    catch (e) { setErr((e as Error).message); }
  };
  // #6 Per-trip support: open the existing (unresolved) support thread for this trip, or start one.
  const contactSupport = async () => {
    try {
      const threads = await api.mySupportThreads(getToken());
      const existing = threads.find((t) => t.jobId === id && t.status !== 'RESOLVED');
      if (existing) { location.href = `/support/${existing.id}`; return; }
      const t = await api.startSupportThread(getToken(), { category: 'DELIVERY_ISSUE', jobId: id });
      location.href = `/support/${t.id}`;
    } catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => { api.getAccount(getToken()).then(setRefAcct).catch(() => {}); }, []);

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

  // Fetch the road-following route once we know pickup + drop-off (keyless OSRM; best-effort).
  useEffect(() => {
    if (!job?.pickup || !job?.dropoff || route.length) return;
    fetchRoute(job.pickup, job.dropoff).then((r) => { if (r) setRoute(r); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.pickup?.lat, job?.pickup?.lng, job?.dropoff?.lat, job?.dropoff?.lng]);

  // Live rider location: join the job's realtime room and update the map as pings arrive.
  useEffect(() => {
    if (cancelled) return; // no trip to track
    let sock: { emit: (e: string, d: unknown) => void; on: (e: string, cb: (d: unknown) => void) => void; disconnect: () => void } | null = null;
    let closed = false;
    connectSocket().then((s) => {
      if (closed) { s.disconnect(); return; }
      sock = s;
      s.emit('subscribe', { jobId: id, userId: getUserId() });
      s.on('location', (msg: { point?: LatLng }) => {
        if (!msg?.point) return;
        const p = { lat: msg.point.lat, lng: msg.point.lng };
        setRiderPos(p);
        // Append to the breadcrumb trail, skipping near-duplicate consecutive pings.
        setTrail((prev) => {
          const last = prev[prev.length - 1];
          if (last && Math.abs(last.lat - p.lat) < 1e-5 && Math.abs(last.lng - p.lng) < 1e-5) return prev;
          return [...prev, p];
        });
      });
    }).catch(() => { /* map still shows pickup/dropoff without live rider */ });
    return () => { closed = true; if (sock) sock.disconnect(); };
  }, [id]);

  // NOTE: we deliberately do NOT auto-cancel the order on a "cancelled"/"failed" redirect. A bank
  // transfer can still land AFTER Flutterwave's page closes (the webhook funds it minutes later), and
  // cancelling a CREATED order at that moment would strand an in-flight payment. Instead the order
  // stays open: the webhook funds it if the money arrives, and the payment-window timeout cancels it
  // (with feedback) if it never does. This screen just shows "payment not completed" as guidance.

  const hasRider = !!job && ['ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP', 'ARRIVED', 'EN_ROUTE_STOP', 'AWAITING_CODE'].includes(job.status);

  // Assigned rider's public details. These two hooks MUST sit above the early return below: a hook
  // declared after a conditional return runs on some renders and not others (here, only when the job
  // is NOT cancelled), so the hook count changes between renders and React throws #300, white-
  // screening the page. This is the crash on the track screen when a job is/goes CANCELLED.
  const [rider, setRider] = useState<RiderSummary | null>(null);
  useEffect(() => {
    if (!hasRider) { setRider(null); return; }
    let stop = false;
    api.jobRider(getToken(), id).then((r) => { if (!stop) setRider(r.rider); }).catch(() => {});
    return () => { stop = true; };
  }, [hasRider, id]);

  // Payment cancelled / order expired: no trip, no charge. Send the customer back to booking.
  if (cancelled || job?.status === 'CANCELLED') {
    const expired = !cancelled && job?.status === 'CANCELLED';
    return (
      <main style={{ padding: 20, minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="rf-card" style={{ textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--warning)', letterSpacing: '.08em', marginBottom: 8 }}>
            {expired ? 'ORDER EXPIRED' : 'PAYMENT NOT COMPLETED'}
          </div>
          <b style={{ fontSize: 'var(--text-subtitle)' }}>You weren’t charged</b>
          <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', lineHeight: 1.5, margin: '8px 0 16px' }}>
            {expired
              ? 'This order timed out before payment was completed, so it was cancelled and nothing was held in escrow.'
              : 'The payment was cancelled, so no rider was requested and nothing was held in escrow.'}
            {' '}You can start again whenever you’re ready.
          </p>
          <Button onClick={() => (location.href = '/home')}>Back to booking</Button>
          <button onClick={() => (location.href = '/activity')} className="mono"
            style={{ background: 'none', border: 'none', marginTop: 12, cursor: 'pointer', fontSize: 'var(--text-caption)', letterSpacing: '.06em', color: 'var(--ink-2)' }}>
            VIEW MY ACTIVITY →
          </button>
        </div>
      </main>
    );
  }

  const step = job ? FLOW.indexOf(job.status) : -1;
  const l = job ? label(job.status) : { text: 'Loading…', color: 'var(--ink-2)' };
  const vehicleLabel = (tk: string | null) => tk === 'BIKE' ? 'Motorcycle' : tk === 'CAR' ? 'Car / Van' : tk === 'KEKE' ? 'Keke' : 'Vehicle';
  // #4 MULTI-STOP: numbered map markers — the current stop is the first undelivered one.
  const extraStops = job?.extraStops ?? [];
  const primaryDelivered = !!job?.primaryStopDeliveredAt || extraStops.some((s) => s.status === 'DELIVERED');
  const deliveredExtras = extraStops.filter((s) => s.status === 'DELIVERED').length;
  const allStopsDone = extraStops.length > 0 && primaryDelivered && deliveredExtras >= extraStops.length;
  const mapStops = extraStops.map((s, i) => ({
    lat: s.point.lat, lng: s.point.lng,
    label: s.address || s.area || `Stop ${i + 2}`,
    done: s.status === 'DELIVERED',
    current: primaryDelivered && !allStopsDone && i === deliveredExtras,
  }));

  return (
    <main style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => (location.href = '/activity')} aria-label="Back to activity"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-heading)', lineHeight: 1, color: 'var(--ink)', padding: 0 }}>←</button>
          <b style={{ fontSize: 'var(--text-subtitle)' }}>Your delivery</b>
        </div>
        <span className="rf-pill" style={{ background: l.color, color: 'var(--on-dark)' }}>{l.text.toUpperCase()}</span>
      </div>

      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}

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
          {/* #0 DIRECT DELIVERY: no return deposit is charged, so the split-out deposit lines are
              removed and the plain escrow total is shown.
          {job.returnReserveMinor ? (
            <>
              <Row label="Delivery fare" value={naira(job.amountMinor - job.returnReserveMinor)} />
              <Row label="Return deposit (refundable)" value={naira(job.returnReserveMinor)} />
            </>
          ) : null} */}
          <Row label="Amount held in escrow" value={naira(job.amountMinor)} strong />
          {/* #0 DIRECT DELIVERY: return-deposit explainer removed.
          {job.returnReserveMinor ? (
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', margin: '4px 0 0', lineHeight: 1.4 }}>
              Your {naira(job.returnReserveMinor)} return deposit is refunded in full once the delivery is completed.
            </p>
          ) : null} */}
        </div>
      )}

      {/* #4 MULTI-STOP: compact per-stop progress for the customer — delivered/pending, current stop
          highlighted. Only rendered when the order has extra stops; single-stop orders are unchanged. */}
      {job?.extraStops?.length ? <StopProgress job={job} /> : null}

      {/* Live map: pickup + drop-off always; the rider marker appears once a rider is assigned and streaming. */}
      {job && (job.pickup || job.dropoff) && (
        <div style={{ marginBottom: 12 }}>
          <LiveMap pickup={job.pickup} dropoff={job.dropoff} rider={hasRider ? riderPos : null} trail={hasRider ? trail : undefined} route={route} stops={mapStops} height={360} />
          {hasRider && !riderPos && (
            <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', textAlign: 'center', marginTop: 6 }}>
              WAITING FOR RIDER LOCATION…
            </p>
          )}
          {hasRider && (
            <div style={{ marginTop: 10 }}>
              <Button variant="ghost" onClick={notifyComing}>I&apos;m on my way — notify rider</Button>
            </div>
          )}
        </div>
      )}

      {/* Rider card (only once one is assigned) */}
      {hasRider ? (
        <div className="rf-card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          {rider?.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rider.photoUrl} alt="" style={{ width: 40, height: 40, borderRadius: 20, objectFit: 'cover', background: 'var(--bg-2)' }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--ink)', color: 'var(--on-dark)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }} className="mono">
              {(rider?.name ?? 'R').trim().charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <b>{rider?.name ?? 'Assigned rider'}{rider?.nameVerified ? ' ✓' : ''}{rider?.ratingCount ? `  ★ ${rider.rating?.toFixed(1)}` : ''}</b>
            <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>
              {rider ? vehicleLabel(rider.vehicleType) : 'ASSIGNED'}
              {rider?.vehicleColor ? ` · ${rider.vehicleColor.charAt(0) + rider.vehicleColor.slice(1).toLowerCase()}` : ''}
              {rider?.vehiclePlate ? ` · ${rider.vehiclePlate}` : ''}
            </div>
          </div>
          {/* Present only while the delivery is live — the server stops returning contact once the
              job ends. Proxy mode requests a call (no number ever sent); direct mode uses tel:.
              MESSAGE sits beside CALL so the customer has an obvious way to chat, not just the toggle
              lower down. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Two ways to call: IN-APP (masked line, private) and CALL OUT (the rider's real number). */}
            {rider?.callMode === 'proxy' && rider?.callNumber ? (
              <a href={`tel:${rider.callNumber}`} className="mono rf-chip" style={{ textDecoration: 'none', textAlign: 'center' }}>IN-APP CALL</a>
            ) : null}
            {rider?.phone ? (
              <a href={`tel:${rider.phone}`} className="mono rf-chip" style={{ textDecoration: 'none', textAlign: 'center' }}>CALL OUT</a>
            ) : null}
            <button type="button" onClick={() => setShowChat(true)} className="mono rf-chip" style={{ cursor: 'pointer' }}>MESSAGE</button>
          </div>
        </div>
      ) : (
        <div className="rf-card" style={{ marginBottom: 12, textAlign: 'center', color: 'var(--ink-2)' }}>
          <div className="mono" style={{ fontSize: 'var(--text-caption)' }}>
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
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em' }}>DELIVERY CODE</div>
              <div className="mono" style={{ fontSize: 'var(--text-display)', fontWeight: 700, letterSpacing: '.3em', margin: '6px 0' }}>{deliveryCode}</div>
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>GIVE THIS TO YOUR RIDER ON ARRIVAL</div>
            </>
          ) : (
            <Button variant="ghost" onClick={revealCode}>Reveal delivery code</Button>
          )}
        </div>
      )}

      {/* #0 DIRECT DELIVERY: recipient-unavailable / waiting-fee / return-to-me panel is disabled for
          launch. In direct mode the customer and rider just call/chat to sort it out (the chat is still
          available below). Kept commented so it can be switched back on with the fallback flow.
      {needsResolution && (
        <div className="rf-card" style={{ border: '1px solid var(--warning)', marginBottom: 12 }}>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--warning)', letterSpacing: '.06em', marginBottom: 6 }}>RECIPIENT UNAVAILABLE</div>
          <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 10px' }}>
            {waitingDue
              ? `Your rider waited past the free 10 minutes. Pay the waiting fee (${naira(job!.waitingFeeMinor!)}) so they can hand over — or have it returned to you.`
              : 'Your rider is at the drop-off but no one has collected. Keep them waiting (a small fee applies after the free 10 minutes) or have the package returned to you at a reduced fee.'}
          </p>
          <Button onClick={payWaiting}>{waitingDue ? `Pay waiting fee ${naira(job!.waitingFeeMinor!)}` : 'Keep waiting & pay the fee'}</Button>
          <div style={{ height: 8 }} />
          <Button variant="ghost" onClick={returnToMe}>Return the package to me</Button>
          <div style={{ height: 8 }} />
          <Button variant="ghost" onClick={() => setShowChat((v) => !v)}>{showChat ? 'Hide messages' : 'Message your rider'}</Button>
          {showChat && <div style={{ marginTop: 12 }}><ChatPanel jobId={id} /></div>}
        </div>
      )}
      */}

      {hasRider && !needsResolution && (
        <div style={{ marginBottom: 12 }}>
          <Button variant="ghost" onClick={() => setShowChat((v) => !v)}>{showChat ? 'Hide messages' : 'Message your rider'}</Button>
          {showChat && <div style={{ marginTop: 12 }}><ChatPanel jobId={id} /></div>}
        </div>
      )}

      {job && CANCELLABLE.includes(job.status) && (
        showCancel ? (
          <div className="rf-card" style={{ marginBottom: 12 }}>
            <b style={{ fontSize: 'var(--text-body)' }}>Cancel this order?</b>
            <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '6px 0 12px', lineHeight: 1.45 }}>
              {job.status === 'CREATED'
                ? 'This order isn’t paid yet, so nothing will be charged.'
                : `You’ll be refunded ${naira(job.amountMinor)} to your original payment method. You can add a bank account below as a backup — it’s optional.`}
            </p>
            {job.status !== 'CREATED' && !refAcct && (
              <div style={{ marginBottom: 12 }}>
                <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 6 }}>BACKUP REFUND ACCOUNT (OPTIONAL)</div>
                <BankAccountForm type="refund" onSaved={setRefAcct} />
              </div>
            )}
            {job.status !== 'CREATED' && refAcct && (
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 12 }}>BACKUP ACCOUNT ON FILE · {refAcct.accountNumberMasked}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={cancelOrder}>Yes, cancel</Button>
              <Button variant="ghost" onClick={() => setShowCancel(false)}>Keep order</Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowCancel(true)} className="mono"
            style={{ display: 'block', width: '100%', textAlign: 'center', background: 'none', border: 'none', padding: '4px', cursor: 'pointer', fontSize: 'var(--text-caption)', letterSpacing: '.06em', color: 'var(--danger)', marginBottom: 12 }}>
            CANCEL THIS ORDER →
          </button>
        )
      )}

      <div style={{ marginBottom: 12 }}>
        <Button variant="ghost" onClick={contactSupport}>Contact support about this trip</Button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" onClick={refresh}>Refresh</Button>
        <Button variant="ghost" onClick={() => (location.href = '/home')}>New order</Button>
      </div>
    </main>
  );
}

// #4 MULTI-STOP: customer-facing progress list for a multi-stop delivery. Stop #1 is the primary
// drop-off (done once `primaryStopDeliveredAt` is set); the extras follow in order. The first stop
// still pending is highlighted as the one the rider is on now.
function StopProgress({ job }: { job: Job }) {
  const extras = job.extraStops ?? [];
  const rows = [
    { label: job.dropoffAddress || 'Drop-off 1', delivered: !!job.primaryStopDeliveredAt },
    ...extras.map((s, i) => ({ label: s.address || s.recipient?.name || `Stop ${i + 2}`, delivered: s.status === 'DELIVERED' })),
  ];
  const total = rows.length;
  const doneCount = rows.filter((r) => r.delivered).length;
  const current = rows.findIndex((r) => !r.delivered);
  return (
    <div className="rf-card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em' }}>DELIVERY STOPS</span>
        <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{doneCount}/{total} DELIVERED</span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {rows.map((r, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: r.delivered ? 'var(--success)' : 'var(--line-2)' }} />)}
      </div>
      {rows.map((r, i) => {
        const isCurrent = i === current;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line-2)' }}>
            <span className="mono" style={{
              width: 20, height: 20, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--text-caption)', fontWeight: 700,
              background: r.delivered ? 'var(--success)' : isCurrent ? 'var(--info)' : 'var(--bg-2)',
              color: r.delivered || isCurrent ? 'var(--on-dark)' : 'var(--ink-2)',
              border: r.delivered || isCurrent ? 'none' : '1px solid var(--line)',
            }}>{r.delivered ? '✓' : i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-small)', fontWeight: isCurrent ? 600 : 400, color: r.delivered ? 'var(--ink-2)' : 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
            </div>
            <span className="mono" style={{ fontSize: 'var(--text-caption)', letterSpacing: '.05em', color: r.delivered ? 'var(--success)' : isCurrent ? 'var(--info)' : 'var(--ink-2)' }}>
              {r.delivered ? 'DELIVERED' : isCurrent ? 'CURRENT' : 'PENDING'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)' }}>{label}</span>
      <span className={mono ? 'mono' : ''} style={{ fontWeight: strong ? 700 : 400, fontSize: strong ? 'var(--text-body)' : 'var(--text-small)' }}>{value}</span>
    </div>
  );
}
