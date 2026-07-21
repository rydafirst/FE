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
type Fallback = 'WAIT' | 'DELEGATE' | 'RETURN';

export default function RiderJob() {
  const id = String(useParams().id);
  const [status, setStatus] = useState('ACCEPTED');
  const [job, setJob] = useState<Job | null>(null);
  const [policy, setPolicy] = useState<Fallback>('WAIT');
  const [code, setCode] = useState('');
  const [outcome, setOutcome] = useState<'paid' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [geo, setGeo] = useState<Geo>('checking');
  const [showRelease, setShowRelease] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [customer, setCustomer] = useState<{ name?: string; photoUrl?: string; phone?: string; phoneMasked?: boolean } | null>(null);
  const sockRef = useRef<any>(null);
  const { show, node: toast } = useToast();
  const done = outcome !== null;
  const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const step = FLOW.indexOf(status as (typeof FLOW)[number]);

  // Live waiting meter (mirrors the server: 10-min free grace, then ₦50/min capped ₦1,000).
  const waitStartedAt = job?.waitStartedAt;
  const elapsedS = waitStartedAt ? Math.max(0, Math.floor((now - waitStartedAt) / 1000)) : 0;
  const graceLeftS = Math.max(0, 600 - elapsedS);
  const accruedMinor = elapsedS > 600 ? Math.min(Math.ceil((elapsedS - 600) / 60) * 5_000, 100_000) : 0;
  const waitingPaid = !!job?.waitingTxId;
  useEffect(() => {
    if (status !== 'WAITING' && status !== 'AWAITING_RESOLUTION') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  // Load the real job once to sync status and read the customer's "receiver unavailable" policy.
  useEffect(() => {
    api.getJob(getToken(), id)
      .then((j) => { setJob(j); setStatus(j.status); if (j.fallbackPolicy) setPolicy(j.fallbackPolicy); })
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
      setOutcome('paid');
    } catch (e) {
      const landed = await api.getJob(getToken(), id).catch(() => null);
      if (landed && (landed.status === 'COMPLETED' || landed.status === 'RELEASED')) {
        setJob(landed);
        setStatus(landed.status);
        setOutcome('paid');
        return;
      }
      show((e as Error).message);
    } finally {
      setConfirming(false);
    }
  };
  const beginWaiting = async () => {
    try { const r = await api.startWaiting(getToken(), id); setStatus(r.status); setJob((j) => (j ? { ...j, waitStartedAt: r.waitStartedAt } : j)); }
    catch (e) { show((e as Error).message); }
  };
  const requestWaitingFee = async () => {
    try { const r = await api.chargeWaiting(getToken(), id); window.open(r.paymentLink, '_blank'); show('Waiting fee sent to the customer to pay', 'success'); }
    catch (e) { show((e as Error).message); }
  };
  const refreshJob = async () => { try { setJob(await api.getJob(getToken(), id)); } catch { /* noop */ } };
  // Hand an accepted job back to the pool (before pickup only) so another rider is matched.
  const release = async () => {
    try { await api.releaseJob(getToken(), id); show('Job released — back to the pool', 'success'); setTimeout(() => (location.href = '/rider'), 800); }
    catch (e) { show((e as Error).message); }
  };
  const releasable = ['ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP'].includes(status);

  const codeLabel = policy === 'DELEGATE'
    ? 'ENTER THE CODE (RECEIVER OR THEIR PROXY)'
    : 'ENTER THE RECEIVER’S DELIVERY CODE';

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
          <b style={{ fontSize: 15 }}>Turn on location</b>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45, margin: '6px 0 12px' }}>
            Share your location so the customer can see you moving and so you can confirm arrival at the drop-off.
          </p>
          {geo === 'denied' ? (
            <p className="mono" style={{ fontSize: 11, color: 'var(--danger)', margin: 0 }}>
              LOCATION IS BLOCKED FOR THIS SITE. ENABLE IT IN YOUR BROWSER SETTINGS, THEN RELOAD.
            </p>
          ) : (
            <Button onClick={enableLocation}>Enable location</Button>
          )}
        </div>
      )}
      {!done && geo === 'on' && (
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--success)', letterSpacing: '.06em', marginBottom: 16 }}>
          ● SHARING YOUR LIVE LOCATION
        </div>
      )}

      {/* Delivery details the rider needs to complete the drop. */}
      {!done && job && (
        <div className="rf-card" style={{ marginBottom: 16 }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 10 }}>DELIVERY DETAILS</div>

          {(customer?.photoUrl || customer?.name || job.customerName) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {customer?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={customer.photoUrl} alt="" style={{ width: 40, height: 40, borderRadius: 20, objectFit: 'cover', background: 'var(--bg-2)' }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }} className="mono">
                  {(customer?.name || job.customerName || 'C').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.06em' }}>CUSTOMER</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{customer?.name || job.customerName || 'Customer'}</div>
              </div>
              {/* Reach the SENDER — the recipient listed below is a different person. */}
              {customer?.phone && (
                <a href={`tel:${customer.phone}`} className="mono rf-chip" style={{ textDecoration: 'none' }}>CALL</a>
              )}
              <button type="button" className="mono rf-chip" onClick={() => setShowChat(true)}>MESSAGE</button>
            </div>
          )}
          {job.pickupAddress && <Detail label="Pickup" value={job.pickupAddress} />}
          {job.dropoffAddress && <Detail label="Drop-off" value={job.dropoffAddress} />}

          {job.recipient && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{job.recipient.name}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{job.recipient.phone}</div>
              </div>
              <a href={`tel:${job.recipient.phone}`} className="mono"
                style={{ fontSize: 11, letterSpacing: '.06em', textDecoration: 'none', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 12px' }}>
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

      {done ? (
        <div className="mono" style={{ color: 'var(--success)', fontWeight: 700 }}>PAID ✓ — released to your wallet</div>
      ) : status === 'EN_ROUTE_DROP' ? (
        <Button onClick={arrive}>I&apos;ve arrived (verify GPS)</Button>
      ) : status === 'WAITING' || status === 'AWAITING_RESOLUTION' ? (
        <>
          <div className="rf-card" style={{ border: '1px solid var(--warning)', marginBottom: 12 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 6 }}>
              {graceLeftS > 0 ? 'FREE WAITING' : 'METERED WAITING'}
            </div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 800 }}>
              {String(Math.floor(elapsedS / 60)).padStart(2, '0')}:{String(elapsedS % 60).padStart(2, '0')}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '6px 0 0', lineHeight: 1.45 }}>
              {graceLeftS > 0
                ? `First 10 minutes are free — ${Math.ceil(graceLeftS / 60)} min left. After that, ask the customer to cover the wait.`
                : waitingPaid
                  ? 'Waiting fee paid ✓ — you can hand over once the recipient enters the code.'
                  : `Waiting fee so far: ${naira(accruedMinor)} (₦50/min after the free 10). The customer must pay it before you hand over.`}
            </p>
            {graceLeftS === 0 && !waitingPaid && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Button onClick={requestWaitingFee}>Request waiting fee</Button>
                <Button variant="ghost" onClick={refreshJob}>I&apos;ve been paid — refresh</Button>
              </div>
            )}
          </div>
          <div className="rf-card" style={{ marginBottom: 12 }}>
            <label className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>{codeLabel}</label>
            <input className="rf-input mono" style={{ margin: '8px 0 12px', letterSpacing: '.4em', textAlign: 'center', fontSize: 22 }}
              value={code} onChange={(e) => setCode(e.target.value)} maxLength={4} inputMode="numeric" />
            <Button onClick={confirm} disabled={confirming}>{confirming ? 'Confirming…' : 'Confirm & get paid'}</Button>
          </div>
          <Button variant="ghost" onClick={() => setShowChat((v) => !v)}>{showChat ? 'Hide messages' : 'Message the customer'}</Button>
          {showChat && <div style={{ marginTop: 12 }}><ChatPanel jobId={id} /></div>}
        </>
      ) : status === 'ARRIVED' ? (
        <>
          <div className="rf-card" style={{ marginBottom: 12 }}>
            <label className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>{codeLabel}</label>
            <input className="rf-input mono" style={{ margin: '8px 0 12px', letterSpacing: '.4em', textAlign: 'center', fontSize: 22 }}
              value={code} onChange={(e) => setCode(e.target.value)} maxLength={4} inputMode="numeric" />
            <Button onClick={confirm} disabled={confirming}>{confirming ? 'Confirming…' : 'Confirm & get paid'}</Button>
          </div>

          {/* Receiver-unavailable path, driven by the customer's chosen policy. */}
          {!showUnavailable ? (
            <button onClick={() => setShowUnavailable(true)} className="mono"
              style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-2)' }}>
              RECEIVER NOT AVAILABLE? →
            </button>
          ) : (
            <div className="rf-card">
              <b style={{ fontSize: 14 }}>Receiver unavailable</b>
              <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '6px 0 12px', lineHeight: 1.45 }}>
                Start the wait — the first 10 minutes are free. After that you can ask the customer to
                cover the wait, or they can choose to have the package returned. You&apos;re paid in full either way.
              </p>
              <Button onClick={beginWaiting}>Start waiting (first 10 min free)</Button>
              <div style={{ height: 8 }} />
              <Button variant="ghost" onClick={() => setShowChat((v) => !v)}>{showChat ? 'Hide messages' : 'Message the customer'}</Button>
              {showChat && <div style={{ marginTop: 12 }}><ChatPanel jobId={id} /></div>}
            </div>
          )}
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
            <b style={{ fontSize: 14 }}>Release this job?</b>
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '6px 0 12px', lineHeight: 1.45 }}>
              It goes back to the pool for another rider — only possible before pickup, and no money moves. Releasing too many jobs can limit the offers you get.
            </p>
            <Button variant="ghost" onClick={release}>Release to another rider</Button>
          </div>
        ) : (
          <button onClick={() => setShowRelease(true)} className="mono"
            style={{ display: 'block', width: '100%', textAlign: 'center', background: 'none', border: 'none', padding: '16px 4px 4px', cursor: 'pointer', fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-2)' }}>
            CAN&apos;T CONTINUE? RELEASE THIS JOB →
          </button>
        )
      )}
      {toast}
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.06em' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 13.5, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function NavLink({ label, pt }: { label: string; pt: { lat: number; lng: number } }) {
  // Opens the device's maps app with directions to the point.
  const href = `https://www.google.com/maps/dir/?api=1&destination=${pt.lat},${pt.lng}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="mono"
      style={{ flex: 1, textAlign: 'center', fontSize: 10.5, letterSpacing: '.05em', textDecoration: 'none',
        color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 6px' }}>
      {label.toUpperCase()}
    </a>
  );
}
