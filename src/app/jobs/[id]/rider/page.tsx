'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getToken } from '@/lib/session';

const FLOW = ['EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP'] as const;
const LABEL: Record<(typeof FLOW)[number], string> = {
  EN_ROUTE_PICKUP: 'Heading to pickup', AT_PICKUP: 'At pickup', IN_PROGRESS: 'Picked up', EN_ROUTE_DROP: 'Heading to drop',
};

export default function RiderJob() {
  const id = String(useParams().id);
  const [status, setStatus] = useState('ACCEPTED');
  const [code, setCode] = useState('');
  const [done, setDone] = useState(false);
  const step = FLOW.indexOf(status as (typeof FLOW)[number]);

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
    try { const r = await api.confirmCode(getToken(), id, code); setStatus(r.status); setDone(true); }
    catch (e) { alert((e as Error).message); }
  };

  return (
    <main style={{ padding: 20 }}>
      <h2 style={{ margin: 0 }}>Active job</h2>
      <div className="mono" style={{ color: 'var(--ink-2)', letterSpacing: '.06em', margin: '4px 0 16px' }}>{status.replace(/_/g, ' ')}</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {FLOW.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? 'var(--ink)' : 'var(--line-2)' }} />)}
      </div>
      {status === 'EN_ROUTE_DROP' ? (
        <Button onClick={arrive}>I&apos;ve arrived (verify GPS)</Button>
      ) : status === 'ARRIVED' ? (
        <div className="rf-card">
          <label className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>ENTER THE RECEIVER&apos;S DELIVERY CODE</label>
          <input className="rf-input mono" style={{ margin: '8px 0 12px', letterSpacing: '.4em', textAlign: 'center', fontSize: 22 }}
            value={code} onChange={(e) => setCode(e.target.value)} maxLength={4} />
          <Button onClick={confirm}>Confirm &amp; get paid</Button>
        </div>
      ) : done ? (
        <div className="mono" style={{ color: 'var(--success)', fontWeight: 700 }}>PAID ✓ — released to your wallet</div>
      ) : (
        <Button onClick={advance}>Mark: {LABEL[FLOW[Math.min(step + 1, FLOW.length - 1)]]}</Button>
      )}
    </main>
  );
}
