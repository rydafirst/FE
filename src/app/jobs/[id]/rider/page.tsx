'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getToken, getUserId } from '@/lib/session';
import { connectSocket } from '@/lib/live';

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
  const [showUnavailable, setShowUnavailable] = useState(false);
  const done = outcome !== null;
  const step = FLOW.indexOf(status as (typeof FLOW)[number]);

  // Load the real job once to sync status and read the customer's "receiver unavailable" policy.
  useEffect(() => {
    api.getJob(getToken(), id)
      .then((j) => { setStatus(j.status); if (j.fallbackPolicy) setPolicy(j.fallbackPolicy); })
      .catch(() => { /* keep local defaults */ });
  }, [id]);

  // Stream live GPS to the customer while the job is active. Stops on completion/unmount.
  useEffect(() => {
    if (done) return;
    let sock: { emit: (e: string, d: unknown) => void; disconnect: () => void } | null = null;
    let watchId: number | null = null;
    let closed = false;
    connectSocket().then((s) => {
      if (closed) { s.disconnect(); return; }
      sock = s;
      if (!('geolocation' in navigator)) return;
      watchId = navigator.geolocation.watchPosition(
        (pos) => sock?.emit('location', { jobId: id, riderId: getUserId(), lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { /* permission denied — customer simply won't see live position */ },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
      );
    }).catch(() => { /* tracking is best-effort; the job flow still works without it */ });
    return () => {
      closed = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (sock) sock.disconnect();
    };
  }, [id, done]);

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
    try { const r = await api.failedAttempt(getToken(), id); setStatus(r.status); setOutcome('failed'); }
    catch (e) { alert((e as Error).message); }
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

      {done ? (
        outcome === 'paid' ? (
          <div className="mono" style={{ color: 'var(--success)', fontWeight: 700 }}>PAID ✓ — released to your wallet</div>
        ) : (
          <div className="rf-card">
            <div className="mono" style={{ color: 'var(--warning)', fontWeight: 700, marginBottom: 6 }}>DELIVERY FAILED — RECEIVER UNAVAILABLE</div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>
              {policy === 'RETURN' ? 'Please return the parcel to the sender. ' : ''}
              Your attempt fee has been paid; the rest was refunded to the customer.
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
