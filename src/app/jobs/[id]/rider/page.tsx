'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getToken, getUserId } from '@/lib/session';
import { connectSocket } from '@/lib/live';

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
  const [policy, setPolicy] = useState<Fallback>('WAIT');
  const [code, setCode] = useState('');
  const [outcome, setOutcome] = useState<'paid' | 'failed' | null>(null);
  const [feeMinor, setFeeMinor] = useState<number | null>(null);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [geo, setGeo] = useState<Geo>('checking');
  const sockRef = useRef<any>(null);
  const done = outcome !== null;
  const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const step = FLOW.indexOf(status as (typeof FLOW)[number]);

  // Load the real job once to sync status and read the customer's "receiver unavailable" policy.
  useEffect(() => {
    api.getJob(getToken(), id)
      .then((j) => { setStatus(j.status); if (j.fallbackPolicy) setPolicy(j.fallbackPolicy); })
      .catch(() => { /* keep local defaults */ });
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
    try { const j = await api.advance(getToken(), id, next); setStatus(j.status); } catch (e) { alert((e as Error).message); }
  };
  const arrive = () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try { const j = await api.arrive(getToken(), id, pos.coords.latitude, pos.coords.longitude); setStatus(j.status); }
      catch (e) { alert((e as Error).message); } // server rejects if outside geofence
    }, () => alert('Location permission needed to verify arrival'));
  };
  const confirm = async () => {
    try { const r = await api.confirmCode(getToken(), id, code); setStatus(r.status); setOutcome('paid'); }
    catch (e) { alert((e as Error).message); }
  };
  const reportUnavailable = async () => {
    try {
      const r = await api.failedAttempt(getToken(), id);
      setStatus(r.status); setFeeMinor(r.attemptFeeMinor); setOutcome('failed');
    } catch (e) { alert((e as Error).message); }
  };

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

      {done ? (
        outcome === 'paid' ? (
          <div className="mono" style={{ color: 'var(--success)', fontWeight: 700 }}>PAID ✓ — released to your wallet</div>
        ) : (
          <div className="rf-card">
            <div className="mono" style={{ color: 'var(--warning)', fontWeight: 700, marginBottom: 6 }}>DELIVERY FAILED — RECEIVER UNAVAILABLE</div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>
              {policy === 'RETURN' ? 'Please return the parcel to the sender. ' : ''}
              {feeMinor !== null ? `${naira(feeMinor)} (attempt + any waiting fee) was paid to you; ` : 'Your attempt fee has been paid; '}
              the rest was refunded to the customer.
            </p>
          </div>
        )
      ) : status === 'EN_ROUTE_DROP' ? (
        <Button onClick={arrive}>I&apos;ve arrived (verify GPS)</Button>
      ) : status === 'ARRIVED' ? (
        <>
          <div className="rf-card" style={{ marginBottom: 12 }}>
            <label className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>{codeLabel}</label>
            <input className="rf-input mono" style={{ margin: '8px 0 12px', letterSpacing: '.4em', textAlign: 'center', fontSize: 22 }}
              value={code} onChange={(e) => setCode(e.target.value)} maxLength={4} inputMode="numeric" />
            <Button onClick={confirm}>Confirm &amp; get paid</Button>
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
                {policy === 'WAIT' && 'The customer chose “wait”: please wait up to 10 minutes (a waiting fee may apply). If they receive it, use the code above instead.'}
                {policy === 'DELEGATE' && 'The customer allows a proxy: anyone present can receive it with the code above. Only report failed if no one at all can accept it.'}
                {policy === 'RETURN' && 'The customer chose “return”: if no one can receive it, return the parcel to the sender.'}
              </p>
              <Button variant="ghost" onClick={reportUnavailable}>
                {policy === 'RETURN' ? 'Return to sender (end delivery)' : 'Report failed attempt'}
              </Button>
            </div>
          )}
        </>
      ) : (
        <Button onClick={advance}>Mark: {LABEL[FLOW[Math.min(step + 1, FLOW.length - 1)]]}</Button>
      )}
    </main>
  );
}
