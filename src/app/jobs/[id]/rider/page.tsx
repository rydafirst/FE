'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api, type Job } from '@/lib/api';
import { getToken, getUserId } from '@/lib/session';
import { connectSocket } from '@/lib/live';
import { useToast } from '@/components/ui/Toast';
import { ChatPanel } from '@/components/ChatPanel';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Geo = 'checking' | 'on' | 'off' | 'denied';

const FLOW = ['EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP'] as const;
const LABEL: Record<(typeof FLOW)[number], string> = {
  EN_ROUTE_PICKUP: 'Heading to pickup', AT_PICKUP: 'At pickup', IN_PROGRESS: 'Picked up', EN_ROUTE_DROP: 'Heading to drop',
};
// #0 DIRECT DELIVERY: the Wait/Delegate/Return fallback is disabled for launch. The rider page keeps
// its core flow (advance → arrive → confirm code); the waiting-fee / return machinery is commented out.
// type Fallback = 'WAIT' | 'DELEGATE' | 'RETURN';

export default function RiderJob() {
  const id = String(useParams().id);
  const [status, setStatus] = useState('ACCEPTED');
  const [job, setJob] = useState<Job | null>(null);
  // #0 DIRECT DELIVERY: the customer's fallback policy no longer drives the rider UI.
  // const [policy, setPolicy] = useState<Fallback>('WAIT');
  const [code, setCode] = useState('');
  // #4 MULTI-STOP: separate code box for the extra-stop confirmation step (EN_ROUTE_STOP).
  const [stopCode, setStopCode] = useState('');
  const [outcome, setOutcome] = useState<'paid' | null>(null);
  const [confirming, setConfirming] = useState(false);
  // #0 DIRECT DELIVERY: "receiver not available?" waiting flow removed.
  // const [showUnavailable, setShowUnavailable] = useState(false);
  const [geo, setGeo] = useState<Geo>('checking');
  const [showRelease, setShowRelease] = useState(false);
  const [showChat, setShowChat] = useState(false);
  // #0 DIRECT DELIVERY: `now` only drove the waiting-fee meter, now disabled.
  // const [now, setNow] = useState(Date.now());
  const [customer, setCustomer] = useState<{ name?: string; photoUrl?: string; phone?: string; phoneMasked?: boolean; callMode?: 'proxy' | 'direct'; callNumber?: string } | null>(null);
  const sockRef = useRef<any>(null);
  const { show, node: toast } = useToast();
  // Proxy mode: ask the server to ring us and bridge to the sender (no number exposed).
  const done = outcome !== null;
  const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const step = FLOW.indexOf(status as (typeof FLOW)[number]);
  // #4 MULTI-STOP: this job has extra ordered drop-offs after the primary one. `currentStop` is the
  // index (within extraStops) of the next one still to deliver — what the rider is working on now.
  const extraStops = job?.extraStops ?? [];
  const hasStops = extraStops.length > 0;
  const currentStop = extraStops.findIndex((s) => s.status === 'PENDING');

  // #0 DIRECT DELIVERY: live waiting meter (10-min free grace, then ₦50/min capped ₦1,000) is disabled.
  // const waitStartedAt = job?.waitStartedAt;
  // const elapsedS = waitStartedAt ? Math.max(0, Math.floor((now - waitStartedAt) / 1000)) : 0;
  // const graceLeftS = Math.max(0, 600 - elapsedS);
  // const accruedMinor = elapsedS > 600 ? Math.min(Math.ceil((elapsedS - 600) / 60) * 5_000, 100_000) : 0;
  // const waitingPaid = !!job?.waitingTxId;
  // useEffect(() => {
  //   if (status !== 'WAITING' && status !== 'AWAITING_RESOLUTION') return;
  //   const t = setInterval(() => setNow(Date.now()), 1000);
  //   return () => clearInterval(t);
  // }, [status]);

  // Load the real job once to sync status. (#0 DIRECT DELIVERY: no fallback policy to read anymore.)
  useEffect(() => {
    api.getJob(getToken(), id)
      .then((j) => { setJob(j); setStatus(j.status); /* #0: if (j.fallbackPolicy) setPolicy(j.fallbackPolicy); */ })
      .catch(() => { /* keep local defaults */ });
    api.jobCustomer(getToken(), id).then(setCustomer).catch(() => {});
  }, [id]);

  // Open one realtime socket for the whole job.
  useEffect(() => {
    let closed = false;
    connectSocket().then((s) => { if (closed) { s.disconnect(); return; } sockRef.current = s; }).catch(() => {});
    return () => { closed = true; if (sockRef.current) { sockRef.current.disconnect(); sockRef.current = null; } };
  }, []);

  // Detect the current location-permission state so we can prompt the rider explicitly.
  useEffect(() => {
    if (!('geolocation' in navigator)) { setGeo('off'); return; }
    const perms = (navigator as any).permissions;
    if (perms?.query) {
      perms.query({ name: 'geolocation' })
        .then((st: any) => {
          const map = (s: string): Geo => (s === 'granted' ? 'on' : s === 'denied' ? 'denied' : 'off');
          setGeo(map(st.state));
          st.onchange = () => setGeo(map(st.state));
        })
        .catch(() => setGeo('off'));
    } else {
      setGeo('off');
    }
  }, []);

  // Explicit opt-in: triggers the browser's location prompt, then starts sharing.
  const enableLocation = () => {
    navigator.geolocation.getCurrentPosition(
      () => setGeo('on'),
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'off'),
      { enableHighAccuracy: true },
    );
  };

  // Stream live GPS to the customer only while location is on and the job is active.
  useEffect(() => {
    if (geo !== 'on' || done) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => sockRef.current?.emit('location', { jobId: id, riderId: getUserId(), lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => { if (err.code === err.PERMISSION_DENIED) setGeo('denied'); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [geo, done, id]);

  const advance = async () => {
    const next = FLOW[step + 1] ?? FLOW[0];
    // Reaching the pickup is GPS-verified (mirrors drop-off arrival). Other steps are plain.
    if (next === 'AT_PICKUP') {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try { const j = await api.arrivePickup(getToken(), id, pos.coords.latitude, pos.coords.longitude); setStatus(j.status); }
        catch (e) { show((e as Error).message); }
      }, () => show('Location needed to confirm you are at the pickup'));
      return;
    }
    try { const j = await api.advance(getToken(), id, next); setStatus(j.status); } catch (e) { show((e as Error).message); }
  };
  const arrive = () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try { const j = await api.arrive(getToken(), id, pos.coords.latitude, pos.coords.longitude); setStatus(j.status); }
      catch (e) { show((e as Error).message); } // server rejects if outside geofence
    }, () => show('Location permission needed to verify arrival'));
  };
  /**
   * Submit the receiver's code. The server confirms the delivery before the response reaches us, so
   * a timeout here does not mean it failed — re-read the job and treat a landed delivery as success
   * rather than showing "Invalid code" on a trip that actually completed.
   */
  const confirm = async () => {
    if (confirming) return; // a second click would race the first and burn a code attempt
    setConfirming(true);
    try {
      const r = await api.confirmCode(getToken(), id, code);
      setStatus(r.status);
      // #4 MULTI-STOP: with extra stops, confirming the PRIMARY drop-off returns EN_ROUTE_STOP (no pay
      // yet) — refresh the job so the stop checklist shows the primary as delivered and moves on. Only
      // a terminal status (single-stop, or the final stop) means paid.
      if (r.status === 'EN_ROUTE_STOP') {
        const fresh = await api.getJob(getToken(), id).catch(() => null);
        if (fresh) { setJob(fresh); setStatus(fresh.status); }
      } else {
        setOutcome('paid');
      }
    } catch (e) {
      const landed = await api.getJob(getToken(), id).catch(() => null);
      if (landed && (landed.status === 'COMPLETED' || landed.status === 'RELEASED')) {
        setJob(landed);
        setStatus(landed.status);
        setOutcome('paid');
        return;
      }
      if (landed && landed.status === 'EN_ROUTE_STOP') {
        setJob(landed);
        setStatus(landed.status);
        return;
      }
      show((e as Error).message);
    } finally {
      setConfirming(false);
    }
  };
  /**
   * #4 MULTI-STOP: confirm an EXTRA drop-off (0-based index within extraStops) with the recipient's
   * code + the rider's current GPS fix (same geolocation pattern as arrival). Returns EN_ROUTE_STOP
   * while stops remain, or RELEASED/COMPLETED on the final one (which releases payment). As with the
   * primary confirm, a timeout may still have landed server-side, so re-read the job before erroring.
   */
  const confirmStop = async (index: number) => {
    if (confirming) return;
    setConfirming(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const r = await api.confirmStop(getToken(), id, index, {
          code: stopCode, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy,
        });
        setStatus(r.status);
        setStopCode('');
        const fresh = await api.getJob(getToken(), id).catch(() => null);
        if (fresh) { setJob(fresh); setStatus(fresh.status); }
        if (r.status === 'RELEASED' || r.status === 'COMPLETED') setOutcome('paid');
      } catch (e) {
        const landed = await api.getJob(getToken(), id).catch(() => null);
        if (landed && (landed.status === 'RELEASED' || landed.status === 'COMPLETED')) {
          setJob(landed); setStatus(landed.status); setOutcome('paid'); setStopCode(''); return;
        }
        if (landed) { setJob(landed); setStatus(landed.status); }
        show((e as Error).message);
      } finally {
        setConfirming(false);
      }
    }, () => { setConfirming(false); show('Location needed to confirm this stop'); }, { enableHighAccuracy: true });
  };
  // #6 Per-trip support: open the existing (unresolved) thread for this trip, or start one.
  const contactSupport = async () => {
    try {
      const threads = await api.mySupportThreads(getToken());
      const existing = threads.find((t) => t.jobId === id && t.status !== 'RESOLVED');
      if (existing) { location.href = `/support/${existing.id}`; return; }
      const t = await api.startSupportThread(getToken(), { category: 'DELIVERY_ISSUE', jobId: id });
      location.href = `/support/${t.id}`;
    } catch (e) { show((e as Error).message); }
  };
  // #0 DIRECT DELIVERY: start-waiting / charge-waiting are 409 in direct mode — disabled for launch.
  // const beginWaiting = async () => {
  //   try { const r = await api.startWaiting(getToken(), id); setStatus(r.status); setJob((j) => (j ? { ...j, waitStartedAt: r.waitStartedAt } : j)); }
  //   catch (e) { show((e as Error).message); }
  // };
  // const requestWaitingFee = async () => {
  //   try { const r = await api.chargeWaiting(getToken(), id); window.open(r.paymentLink, '_blank'); show('Waiting fee sent to the customer to pay', 'success'); }
  //   catch (e) { show((e as Error).message); }
  // };
  // const refreshJob = async () => { try { setJob(await api.getJob(getToken(), id)); } catch { /* noop */ } };
  // Hand an accepted job back to the pool (before pickup only) so another rider is matched.
  const release = async () => {
    try { await api.releaseJob(getToken(), id); show('Job released — back to the pool', 'success'); setTimeout(() => (location.href = '/rider'), 800); }
    catch (e) { show((e as Error).message); }
  };
  const releasable = ['ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP'].includes(status);

  // #0 DIRECT DELIVERY: no DELEGATE policy anymore — always the plain receiver-code label.
  const codeLabel = 'ENTER THE RECEIVER’S DELIVERY CODE';
  // const codeLabel = policy === 'DELEGATE'
  //   ? 'ENTER THE CODE (RECEIVER OR THEIR PROXY)'
  //   : 'ENTER THE RECEIVER’S DELIVERY CODE';

  return (
    <main style={{ padding: 20 }}>
      <h2 style={{ margin: 0 }}>Active job</h2>
      <div className="mono" style={{ color: 'var(--ink-2)', letterSpacing: '.06em', margin: '4px 0 16px' }}>{status.replace(/_/g, ' ')}</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {FLOW.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? 'var(--ink)' : 'var(--line-2)' }} />)}
      </div>

      {/* Location sharing — required so the customer can track the rider. */}
      {!done && geo !== 'on' && geo !== 'checking' && (
        <div className="rf-card" style={{ border: '1px solid var(--warning)', marginBottom: 16 }}>
          <b style={{ fontSize: 'var(--text-body)' }}>Turn on location</b>
          <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', lineHeight: 1.45, margin: '6px 0 12px' }}>
            Share your location so the customer can see you moving and so you can confirm arrival at the drop-off.
          </p>
          {geo === 'denied' ? (
            <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--danger)', margin: 0 }}>
              LOCATION IS BLOCKED FOR THIS SITE. ENABLE IT IN YOUR BROWSER SETTINGS, THEN RELOAD.
            </p>
          ) : (
            <Button onClick={enableLocation}>Enable location</Button>
          )}
        </div>
      )}
      {!done && geo === 'on' && (
        <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--success)', letterSpacing: '.06em', marginBottom: 16 }}>
          ● SHARING YOUR LIVE LOCATION
        </div>
      )}

      {/* Delivery details the rider needs to complete the drop. */}
      {!done && job && (
        <div className="rf-card" style={{ marginBottom: 16 }}>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 10 }}>DELIVERY DETAILS</div>

          {(customer?.photoUrl || customer?.name || job.customerName) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {customer?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={customer.photoUrl} alt="" style={{ width: 40, height: 40, borderRadius: 20, objectFit: 'cover', background: 'var(--bg-2)' }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--ink)', color: 'var(--on-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }} className="mono">
                  {(customer?.name || job.customerName || 'C').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em' }}>CUSTOMER</div>
                <div style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>{customer?.name || job.customerName || 'Customer'}</div>
              </div>
              {/* Reach the SENDER — the recipient listed below is a different person. IN-APP CALL uses
                  the masked line (private); CALL OUT dials the customer's real number. */}
              <div style={{ display: 'flex', gap: 6 }}>
                {customer?.callMode === 'proxy' && customer?.callNumber ? (
                  <a href={`tel:${customer.callNumber}`} className="mono rf-chip" style={{ textDecoration: 'none' }}>IN-APP CALL</a>
                ) : null}
                {customer?.phone ? (
                  <a href={`tel:${customer.phone}`} className="mono rf-chip" style={{ textDecoration: 'none' }}>CALL OUT</a>
                ) : null}
                <button type="button" className="mono rf-chip" onClick={() => setShowChat(true)}>MESSAGE</button>
              </div>
            </div>
          )}
          {job.pickupAddress && <Detail label="Pickup" value={job.pickupAddress} />}
          {job.dropoffAddress && <Detail label="Drop-off" value={job.dropoffAddress} />}

          {job.recipient && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>{job.recipient.name}</div>
                <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{job.recipient.phone}</div>
              </div>
              <a href={`tel:${job.recipient.phone}`} className="mono"
                style={{ fontSize: 'var(--text-caption)', letterSpacing: '.06em', textDecoration: 'none', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 12px' }}>
                CALL
              </a>
            </div>
          )}

          {job.item && <Detail label="Sending" value={job.item} />}
          {job.weightGrams ? <Detail label="Weight" value={`${(job.weightGrams / 1000).toLocaleString()} kg`} /> : null}
          {job.instructions && <Detail label="Notes" value={job.instructions} />}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {job.pickup && <NavLink label="Navigate to pickup" pt={job.pickup} />}
            {job.dropoff && <NavLink label="Navigate to drop-off" pt={job.dropoff} />}
          </div>
        </div>
      )}

      {/* #4 MULTI-STOP: ordered stop checklist + progress. Shown only for multi-stop jobs; single-stop
          jobs are unchanged. Highlights the stop the rider is currently delivering. */}
      {!done && job && hasStops && <StopChecklist job={job} />}

      {done ? (
        <div className="mono" style={{ color: 'var(--success)', fontWeight: 700 }}>PAID ✓ — released to your wallet</div>
      ) : status === 'EN_ROUTE_STOP' ? (
        // #4 MULTI-STOP: primary drop-off is done; step through each remaining stop with its own code.
        // The final stop's confirmation releases payment. GPS is captured on confirm (see confirmStop).
        currentStop >= 0 ? (
          <div className="rf-card" style={{ marginBottom: 12 }}>
            <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 8 }}>
              STOP {currentStop + 2} OF {extraStops.length + 1}{currentStop === extraStops.length - 1 ? ' · FINAL' : ''}
            </div>
            {extraStops[currentStop]?.address && <Detail label="Drop-off" value={extraStops[currentStop].address!} />}
            {extraStops[currentStop]?.recipient?.name && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>{extraStops[currentStop].recipient!.name}</div>
                  {extraStops[currentStop].recipient?.phone && <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{extraStops[currentStop].recipient!.phone}</div>}
                </div>
                {extraStops[currentStop].recipient?.phone && (
                  <a href={`tel:${extraStops[currentStop].recipient!.phone}`} className="mono"
                    style={{ fontSize: 'var(--text-caption)', letterSpacing: '.06em', textDecoration: 'none', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 12px' }}>CALL</a>
                )}
              </div>
            )}
            {extraStops[currentStop]?.item && <Detail label="Sending" value={extraStops[currentStop].item!} />}
            {extraStops[currentStop]?.instructions && <Detail label="Notes" value={extraStops[currentStop].instructions!} />}
            {extraStops[currentStop]?.point && (
              <div style={{ display: 'flex', gap: 8, margin: '4px 0 12px' }}>
                <NavLink label="Navigate to this stop" pt={extraStops[currentStop].point} />
              </div>
            )}
            <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>ENTER THE RECEIVER&apos;S DELIVERY CODE</label>
            <input className="rf-input mono" style={{ margin: '8px 0 12px', letterSpacing: '.4em', textAlign: 'center', fontSize: 'var(--text-heading)' }}
              value={stopCode} onChange={(e) => setStopCode(e.target.value)} maxLength={4} inputMode="numeric" />
            <Button onClick={() => confirmStop(currentStop)} disabled={confirming}>
              {confirming ? 'Confirming…' : currentStop === extraStops.length - 1 ? 'Confirm & get paid' : 'Confirm stop'}
            </Button>
            <div style={{ height: 8 }} />
            <Button variant="ghost" onClick={() => setShowChat((v) => !v)}>{showChat ? 'Hide messages' : 'Message the customer'}</Button>
            {showChat && <div style={{ marginTop: 12 }}><ChatPanel jobId={id} /></div>}
          </div>
        ) : (
          <div className="mono" style={{ color: 'var(--ink-2)' }}>All stops delivered — finalising…</div>
        )
      ) : status === 'EN_ROUTE_DROP' ? (
        <Button onClick={arrive}>I&apos;ve arrived (verify GPS)</Button>
      ) : /* #0 DIRECT DELIVERY: the WAITING / AWAITING_RESOLUTION branch (waiting-fee meter, request
           waiting fee, "I've been paid — refresh") is removed — direct mode never enters those
           states and the waiting endpoints are 409. See the commented meter vars/handlers above. */
        status === 'ARRIVED' ? (
        <>
          <div className="rf-card" style={{ marginBottom: 12 }}>
            <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{codeLabel}</label>
            <input className="rf-input mono" style={{ margin: '8px 0 12px', letterSpacing: '.4em', textAlign: 'center', fontSize: 'var(--text-heading)' }}
              value={code} onChange={(e) => setCode(e.target.value)} maxLength={4} inputMode="numeric" />
            <Button onClick={confirm} disabled={confirming}>{confirming ? 'Confirming…' : 'Confirm & get paid'}</Button>
          </div>

          {/* #0 DIRECT DELIVERY: the "Receiver not available? → Start waiting" path is removed. If the
              receiver isn't around, the rider just calls/messages the customer to sort it out. */}
          <Button variant="ghost" onClick={() => setShowChat((v) => !v)}>{showChat ? 'Hide messages' : 'Message the customer'}</Button>
          {showChat && <div style={{ marginTop: 12 }}><ChatPanel jobId={id} /></div>}
          {/*
          {!showUnavailable ? (
            <button onClick={() => setShowUnavailable(true)} className="mono"
              style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontSize: 'var(--text-caption)', letterSpacing: '.06em', color: 'var(--ink-2)' }}>
              RECEIVER NOT AVAILABLE? →
            </button>
          ) : (
            <div className="rf-card">
              <b style={{ fontSize: 'var(--text-body)' }}>Receiver unavailable</b>
              <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '6px 0 12px', lineHeight: 1.45 }}>
                Start the wait — the first 10 minutes are free. After that you can ask the customer to
                cover the wait, or they can choose to have the package returned. You&apos;re paid in full either way.
              </p>
              <Button onClick={beginWaiting}>Start waiting (first 10 min free)</Button>
              <div style={{ height: 8 }} />
              <Button variant="ghost" onClick={() => setShowChat((v) => !v)}>{showChat ? 'Hide messages' : 'Message the customer'}</Button>
              {showChat && <div style={{ marginTop: 12 }}><ChatPanel jobId={id} /></div>}
            </div>
          )}
          */}
        </>
      ) : (
        (() => {
          const next = FLOW[Math.min(step + 1, FLOW.length - 1)];
          return (
            <Button onClick={advance}>
              {next === 'AT_PICKUP' ? "I've arrived at pickup (verify GPS)" : `Mark: ${LABEL[next]}`}
            </Button>
          );
        })()
      )}

      {!done && releasable && (
        showRelease ? (
          <div className="rf-card" style={{ marginTop: 16 }}>
            <b style={{ fontSize: 'var(--text-body)' }}>Release this job?</b>
            <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '6px 0 12px', lineHeight: 1.45 }}>
              It goes back to the pool for another rider — only possible before pickup, and no money moves. Releasing too many jobs can limit the offers you get.
            </p>
            <Button variant="ghost" onClick={release}>Release to another rider</Button>
          </div>
        ) : (
          <button onClick={() => setShowRelease(true)} className="mono"
            style={{ display: 'block', width: '100%', textAlign: 'center', background: 'none', border: 'none', padding: '16px 4px 4px', cursor: 'pointer', fontSize: 'var(--text-caption)', letterSpacing: '.06em', color: 'var(--ink-2)' }}>
            CAN&apos;T CONTINUE? RELEASE THIS JOB →
          </button>
        )
      )}

      <div style={{ marginTop: 16 }}>
        <Button variant="ghost" onClick={contactSupport}>Contact support about this trip</Button>
      </div>
      {toast}
    </main>
  );
}

// #4 MULTI-STOP: ordered checklist of every drop-off (primary + extras) with delivered/pending state
// and a progress meter. The primary drop is stop #1; `primaryStopDeliveredAt` marks it done.
function StopChecklist({ job }: { job: Job }) {
  const extras = job.extraStops ?? [];
  const primaryDone = !!job.primaryStopDeliveredAt;
  const rows = [
    { label: job.dropoffAddress || 'Primary drop-off', delivered: primaryDone },
    ...extras.map((s, i) => ({ label: s.address || s.recipient?.name || `Stop ${i + 2}`, delivered: s.status === 'DELIVERED' })),
  ];
  const total = rows.length;
  const doneCount = rows.filter((r) => r.delivered).length;
  const current = rows.findIndex((r) => !r.delivered); // first pending = the one in progress
  return (
    <div className="rf-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em' }}>STOPS</span>
        <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{doneCount}/{total} DELIVERED</span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {rows.map((r, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: r.delivered ? 'var(--success)' : 'var(--line-2)' }} />)}
      </div>
      {rows.map((r, i) => {
        const isCurrent = i === current;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line-2)' }}>
            <span style={{
              width: 20, height: 20, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--text-caption)', fontWeight: 700,
              background: r.delivered ? 'var(--success)' : isCurrent ? 'var(--ink)' : 'var(--bg-2)',
              color: r.delivered || isCurrent ? 'var(--on-dark)' : 'var(--ink-2)',
              border: r.delivered || isCurrent ? 'none' : '1px solid var(--line)',
            }} className="mono">{r.delivered ? '✓' : i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-small)', fontWeight: isCurrent ? 600 : 400, color: r.delivered ? 'var(--ink-2)' : 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
            </div>
            <span className="mono" style={{ fontSize: 'var(--text-caption)', letterSpacing: '.05em', color: r.delivered ? 'var(--success)' : isCurrent ? 'var(--ink)' : 'var(--ink-2)' }}>
              {r.delivered ? 'DELIVERED' : isCurrent ? 'CURRENT' : 'PENDING'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 'var(--text-small)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function NavLink({ label, pt }: { label: string; pt: { lat: number; lng: number } }) {
  // Opens the device's maps app with directions to the point.
  const href = `https://www.google.com/maps/dir/?api=1&destination=${pt.lat},${pt.lng}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="mono"
      style={{ flex: 1, textAlign: 'center', fontSize: 'var(--text-caption)', letterSpacing: '.05em', textDecoration: 'none',
        color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 6px' }}>
      {label.toUpperCase()}
    </a>
  );
}
