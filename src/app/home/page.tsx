'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AddressInput, type Place } from '@/components/AddressInput';
import { MapPreview } from '@/components/MapPreview';
import { api, type JobType, type Quote, type Job } from '@/lib/api';
import { getToken } from '@/lib/session';
import { BottomNav } from '@/components/BottomNav';
import { NotificationBell } from '@/components/NotificationBell';
import { RatingPrompt } from '@/components/RatingModal';
import { useRequireAuth } from '@/lib/useAuth';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

type Fallback = 'WAIT' | 'DELEGATE' | 'RETURN';

// Plain-language explanation of each "receiver unavailable" choice, shown in the picker + popup.
const FALLBACK_OPTIONS: { value: Fallback; title: string; desc: string }[] = [
  { value: 'WAIT', title: 'Wait for them', desc: 'The rider waits 10 minutes free. After that a small waiting fee applies (₦50/min, max ₦1,000). Best if the receiver is just running late.' },
  { value: 'DELEGATE', title: 'Let someone else receive it', desc: 'If your receiver isn’t there, anyone present (a colleague, neighbour, security) can accept it with the code. The delivery still completes.' },
  { value: 'RETURN', title: 'Return it to me', desc: 'If no one can receive it, the rider brings the parcel back to you. Adds a refundable return deposit (75% of the fare) — refunded in full if the delivery completes, or used to pay the rider for the return trip.' },
];

export default function HomePage() {
  const { ready } = useRequireAuth();
  const [type, setType] = useState<JobType>('DELIVERY');
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [item, setItem] = useState('');
  const [weight, setWeight] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [fallback, setFallback] = useState<Fallback>('WAIT');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackAck, setFallbackAck] = useState(false); // only prompt once per session
  const [pending, setPending] = useState<Job | null>(null); // an existing unpaid order, if any
  const quoteRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the price breakdown as soon as a quote is ready.
  useEffect(() => {
    if (quote) quoteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [quote]);

  // Block booking while a previous order is still awaiting payment (avoids duplicate pending orders).
  useEffect(() => {
    if (!ready) return;
    api.myJobs(getToken()).then((js) => setPending(js.find((j) => j.status === 'CREATED') ?? null)).catch(() => {});
  }, [ready]);

  const cancelPending = async () => {
    if (!pending) return;
    try { await api.cancelJob(getToken(), pending.id); setPending(null); }
    catch (e) { setErr((e as Error).message); }
  };

  const getQuote = async () => {
    setErr(null);
    if (!pickup || !dropoff) { setErr('Choose a pickup and drop-off'); return; }
    // For deliveries, explain the "receiver unavailable" choice once before quoting.
    if (type === 'DELIVERY' && !fallbackAck) { setShowFallback(true); return; }
    await fetchQuote();
  };

  const fetchQuote = async () => {
    setBusy(true);
    try {
      setQuote(await api.quote(getToken(), {
        type, pickup: { lat: pickup!.lat, lng: pickup!.lng }, dropoff: { lat: dropoff!.lat, lng: dropoff!.lng },
      }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  // Called from the popup: keep whatever option is selected, then proceed to the quote.
  const confirmFallback = () => { setFallbackAck(true); setShowFallback(false); void fetchQuote(); };

  const pay = async () => {
    if (!quote) return;
    setErr(null); setBusy(true);
    try {
      const body: Parameters<typeof api.createJob>[1] = {
        quoteToken: quote.quoteToken, fallbackPolicy: fallback,
        ...(pickup?.label ? { pickupAddress: pickup.label } : {}),
        ...(dropoff?.label ? { dropoffAddress: dropoff.label } : {}),
        ...(pickup?.area ? { pickupArea: pickup.area } : {}),
        ...(dropoff?.area ? { dropoffArea: dropoff.area } : {}),
        ...(type === 'DELIVERY' && recipientName && recipientPhone ? { recipient: { name: recipientName, phone: recipientPhone } } : {}),
        ...(type === 'DELIVERY' && item ? { item } : {}),
        ...(type === 'DELIVERY' && customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(type === 'DELIVERY' && Number(weight) > 0 ? { weightKg: Number(weight) } : {}),
        ...(type === 'DELIVERY' && instructions ? { instructions } : {}),
      };
      const job = await api.createJob(getToken(), body);
      // Redirect to the Flutterwave hosted checkout; after paying, the customer returns to tracking.
      const link = (job as { paymentLink?: string }).paymentLink;
      location.href = link ?? `/jobs/${job.id}/track`;
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <main style={{ padding: 20, paddingBottom: 96 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <b style={{ fontSize: 18, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--ink)' }}>Ryda</span><span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>first</span>
        </b>
        <NotificationBell />
      </header>
      <RatingPrompt />

      {/* Block a second order while one is still awaiting payment. */}
      {pending && (
        <div className="rf-card" style={{ border: '1px solid var(--warning)', marginBottom: 16 }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--warning)', letterSpacing: '.08em', marginBottom: 6 }}>ORDER AWAITING PAYMENT</div>
          <b style={{ fontSize: 15 }}>Finish your last order first</b>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45, margin: '6px 0 12px' }}>
            You have an unpaid order of {naira(pending.amountMinor)}. Complete or cancel it before booking a new one.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => (location.href = `/jobs/${pending.id}/track`)}>View order</Button>
            <Button variant="ghost" onClick={cancelPending}>Cancel it</Button>
          </div>
        </div>
      )}

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
          <Field label="YOUR NAME"><input className="rf-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Shown to your rider" /></Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 2 }}><Field label="WHAT ARE YOU SENDING?"><input className="rf-input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. documents, phone" /></Field></div>
            <div style={{ flex: 1 }}><Field label="WEIGHT (KG)"><input className="rf-input" value={weight} inputMode="decimal" onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 2" /></Field></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="RECIPIENT NAME"><input className="rf-input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></Field>
            <Field label="RECIPIENT PHONE"><input className="rf-input" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="+234…" /></Field>
          </div>
          <Field label="NOTES FOR THE RIDER (OPTIONAL)">
            <input className="rf-input" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. call on arrival, gate code 1234, apartment 4B" />
          </Field>
          <Field label="IF RECEIVER UNAVAILABLE">
            <select className="rf-input" value={fallback} onChange={(e) => setFallback(e.target.value as Fallback)}>
              {FALLBACK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.title}</option>)}
            </select>
            <button onClick={() => setShowFallback(true)} className="mono"
              style={{ background: 'none', border: 'none', padding: '6px 0 0', cursor: 'pointer', fontSize: 10, letterSpacing: '.06em', color: 'var(--ink-2)' }}>
              WHAT DO THESE MEAN? →
            </button>
          </Field>
        </>
      )}

      <div style={{ height: 8 }} />
      <Button onClick={getQuote} disabled={busy || !!pending}>{busy ? 'Working…' : pending ? 'Finish your pending order first' : 'Get quote'}</Button>
      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}

      {quote && (() => {
        // "Return it to me" pre-charges a refundable 75% deposit so the rider can be paid to bring
        // it back if needed — refunded in full when the delivery succeeds.
        const returnDeposit = fallback === 'RETURN' ? Math.round(quote.breakdown.totalMinor * 0.75) : 0;
        const grandTotal = quote.breakdown.totalMinor + returnDeposit;
        return (
          <div className="rf-card" ref={quoteRef} style={{ marginTop: 16, scrollMarginTop: 16 }}>
            <Row label="Base" value={naira(quote.breakdown.baseMinor)} />
            <Row label="Distance" value={naira(quote.breakdown.distanceMinor)} />
            <Row label="Platform fee" value={naira(quote.breakdown.platformFeeMinor)} />
            {returnDeposit > 0 && <Row label="Return deposit (refundable)" value={naira(returnDeposit)} />}
            <div style={{ borderTop: '1px solid var(--line)', margin: '8px 0' }} />
            <Row label="Total" value={naira(grandTotal)} strong />
            {returnDeposit > 0 && (
              <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '6px 0 0', lineHeight: 1.45 }}>
                Includes a {naira(returnDeposit)} return deposit — fully refunded if your delivery is completed, or used to pay the rider if the parcel is returned to you.
              </p>
            )}
            <div style={{ height: 12 }} />
            <Button onClick={pay} disabled={busy}>Pay &amp; hold in escrow</Button>
            <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', textAlign: 'center', marginBottom: 0 }}>
              HELD SAFELY UNTIL DELIVERY IS CONFIRMED
            </p>
          </div>
        );
      })()}

      {/* Explainer popup for the "receiver unavailable" choice, shown on first Get quote. */}
      {showFallback && (
        <div onClick={confirmFallback} style={{
          position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.45)', zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 480, background: 'var(--bg)', borderTopLeftRadius: 16, borderTopRightRadius: 16,
            padding: 20, maxHeight: '86vh', overflowY: 'auto',
          }}>
            <b style={{ fontSize: 17 }}>If your receiver isn’t available</b>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '4px 0 14px' }}>
              Pick what the rider should do. You can change this any time before paying.
            </p>

            {FALLBACK_OPTIONS.map((o) => {
              const active = fallback === o.value;
              return (
                <button key={o.value} onClick={() => setFallback(o.value)} style={{
                  display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 10,
                  border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 8, padding: 14,
                  background: active ? 'var(--bg-2)' : 'var(--bg)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      border: `4px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
                    }} />
                    <b style={{ fontSize: 14 }}>{o.title}</b>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '0 0 0 24px', lineHeight: 1.45 }}>{o.desc}</p>
                </button>
              );
            })}

            <div style={{ height: 6 }} />
            <Button onClick={confirmFallback}>Continue</Button>
            <button onClick={confirmFallback} className="mono" style={{
              display: 'block', width: '100%', background: 'none', border: 'none', padding: '12px 0 2px',
              cursor: 'pointer', fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-2)',
            }}>
              SKIP — USE “{FALLBACK_OPTIONS.find((o) => o.value === fallback)?.title.toUpperCase()}”
            </button>
          </div>
        </div>
      )}

      <BottomNav />
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
