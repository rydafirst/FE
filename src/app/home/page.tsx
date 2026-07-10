'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AddressInput, type Place } from '@/components/AddressInput';
import { MapPreview } from '@/components/MapPreview';
import { api, type JobType, type Quote } from '@/lib/api';
import { getToken } from '@/lib/session';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

export default function HomePage() {
  const [type, setType] = useState<JobType>('DELIVERY');
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [item, setItem] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [fallback, setFallback] = useState<'WAIT' | 'DELEGATE' | 'RETURN'>('WAIT');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const getQuote = async () => {
    setErr(null);
    if (!pickup || !dropoff) { setErr('Choose a pickup and drop-off'); return; }
    setBusy(true);
    try {
      setQuote(await api.quote(getToken(), {
        type, pickup: { lat: pickup.lat, lng: pickup.lng }, dropoff: { lat: dropoff.lat, lng: dropoff.lng },
      }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const pay = async () => {
    if (!quote) return;
    setErr(null); setBusy(true);
    try {
      const body: Parameters<typeof api.createJob>[1] = { quoteToken: quote.quoteToken, refundAccountId: 'acct_demo' };
      if (type === 'DELIVERY' && recipientName && recipientPhone) {
        (body as Record<string, unknown>).recipient = { name: recipientName, phone: recipientPhone };
      }
      (body as Record<string, unknown>).fallbackPolicy = fallback;
      const job = await api.createJob(getToken(), body);
      // Redirect to the Flutterwave hosted checkout; after paying, the customer returns to tracking.
      const link = (job as { paymentLink?: string }).paymentLink;
      location.href = link ?? `/jobs/${job.id}/track`;
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <main style={{ padding: 20, paddingBottom: 40 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <b style={{ fontSize: 18, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--ink)' }}>Ryda</span><span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>first</span>
        </b>
        <a href="/rider" className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', textDecoration: 'none' }}>RIDER →</a>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['DELIVERY', 'RIDE'] as JobType[]).map((t) => (
          <button key={t} onClick={() => { setType(t); setQuote(null); }} className="mono"
            style={{ flex: 1, padding: 10, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12, letterSpacing: '.06em',
              border: `1px solid ${type === t ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--bg)',
              color: type === t ? 'var(--ink)' : 'var(--mid)' }}>{t}</button>
        ))}
      </div>

      <MapPreview pickup={pickup} dropoff={dropoff} />
      <AddressInput label={type === 'DELIVERY' ? 'PICKUP' : 'FROM'} onSelect={(p) => { setPickup(p); setQuote(null); }} />
      <AddressInput label={type === 'DELIVERY' ? 'DROP-OFF' : 'TO'} onSelect={(p) => { setDropoff(p); setQuote(null); }} />

      {type === 'DELIVERY' && (
        <>
          <Field label="WHAT ARE YOU SENDING?"><input className="rf-input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. documents, phone" /></Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="RECIPIENT NAME"><input className="rf-input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></Field>
            <Field label="RECIPIENT PHONE"><input className="rf-input" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="+234…" /></Field>
          </div>
          <Field label="IF RECEIVER UNAVAILABLE">
            <select className="rf-input" value={fallback} onChange={(e) => setFallback(e.target.value as typeof fallback)}>
              <option value="WAIT">Wait (grace + waiting fee)</option>
              <option value="DELEGATE">Allow a proxy to receive</option>
              <option value="RETURN">Return to me</option>
            </select>
          </Field>
        </>
      )}

      <div style={{ height: 8 }} />
      <Button onClick={getQuote} disabled={busy}>{busy ? 'Working…' : 'Get quote'}</Button>
      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}

      {quote && (
        <div className="rf-card" style={{ marginTop: 16 }}>
          <Row label="Base" value={naira(quote.breakdown.baseMinor)} />
          <Row label="Distance" value={naira(quote.breakdown.distanceMinor)} />
          <Row label="Platform fee" value={naira(quote.breakdown.platformFeeMinor)} />
          <div style={{ borderTop: '1px solid var(--line)', margin: '8px 0' }} />
          <Row label="Total" value={naira(quote.breakdown.totalMinor)} strong />
          <div style={{ height: 12 }} />
          <Button onClick={pay} disabled={busy}>Pay &amp; hold in escrow</Button>
          <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', textAlign: 'center', marginBottom: 0 }}>
            HELD SAFELY UNTIL DELIVERY IS CONFIRMED
          </p>
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, marginBottom: 12 }}>
      <label className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>{label}</span>
      <span className="mono" style={{ fontWeight: strong ? 700 : 400, fontSize: strong ? 15 : 13 }}>{value}</span>
    </div>
  );
}
