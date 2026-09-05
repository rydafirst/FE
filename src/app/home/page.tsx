'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AddressInput, type Place } from '@/components/AddressInput';
import { MapPreview } from '@/components/MapPreview';
import { api, type JobType, type Quote, type Job, type CreatedJob } from '@/lib/api';
import { getToken } from '@/lib/session';
import { BottomNav } from '@/components/BottomNav';
import { NotificationBell } from '@/components/NotificationBell';
import { RatingPrompt } from '@/components/RatingModal';
import { useRequireAuth } from '@/lib/useAuth';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

// #4 MULTI-STOP: a customer-entered EXTRA drop-off in the booking form. `place` is the chosen point
// (kept null until an address is picked); recipient/item are optional per-stop metadata sent to the
// backend paired by index to the quote `stops`. The primary drop-off above is stop #1; these follow.
const MAX_EXTRA_STOPS = 8;
interface ExtraStopForm { place: Place | null; recipientName: string; recipientPhone: string; item: string }
const emptyStop = (): ExtraStopForm => ({ place: null, recipientName: '', recipientPhone: '', item: '' });

// #0 DIRECT DELIVERY: the forced Wait/Delegate/Return machinery is disabled for launch — deliveries
// are now plain direct trips (book → pay → track → deliver → code → done). Kept (commented) so the
// fallback flow can be switched back on later. Mirrors mobile/src/screens/Home.tsx.
// type Fallback = 'WAIT' | 'DELEGATE' | 'RETURN';
//
// // Plain-language explanation of each "receiver unavailable" choice, shown in the picker + popup.
// const FALLBACK_OPTIONS: { value: Fallback; title: string; desc: string }[] = [
//   { value: 'WAIT', title: 'Wait for them', desc: 'The rider waits 10 minutes free. After that a small waiting fee applies (₦50/min, max ₦1,000). Best if the receiver is just running late.' },
//   { value: 'DELEGATE', title: 'Let someone else receive it', desc: 'If your receiver isn’t there, anyone present (a colleague, neighbour, security) can accept it with the code. The delivery still completes.' },
//   { value: 'RETURN', title: 'Return it to me', desc: 'If no one can receive it, the rider brings the parcel back to you. Adds a refundable return deposit (75% of the fare) — refunded in full if the delivery completes, or used to pay the rider for the return trip.' },
// ];

export default function HomePage() {
  const { ready } = useRequireAuth();
  const [type, setType] = useState<JobType>('DELIVERY');
  const [marketplaceOn, setMarketplaceOn] = useState(false); // hidden until the public config confirms it
  useEffect(() => { api.publicConfig().then((c) => setMarketplaceOn(c.marketplaceEnabled)).catch(() => {}); }, []);
  const [pickup, setPickup] = useState<Place | null>(null);
  const [locateSignal, setLocateSignal] = useState(0);
  const [showLocPrompt, setShowLocPrompt] = useState(false);
  useEffect(() => {
    // Proactively offer to use location on first open (dismissed once enabled).
    const perms = (navigator as unknown as { permissions?: { query: (o: { name: PermissionName }) => Promise<{ state: string }> } }).permissions;
    if (perms?.query) perms.query({ name: 'geolocation' as PermissionName }).then((s) => setShowLocPrompt(s.state !== 'granted')).catch(() => setShowLocPrompt(true));
    else setShowLocPrompt(true);
  }, []);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  // #4 MULTI-STOP: ordered extra drop-offs after the primary one. Empty = plain single-stop booking.
  const [extraStops, setExtraStops] = useState<ExtraStopForm[]>([]);
  // #4 MULTI-STOP: after booking a multi-stop order we hold the created job so we can show the
  // customer each stop's one-time code (returned once) before sending them on to pay.
  const [booked, setBooked] = useState<{ job: CreatedJob; link: string } | null>(null);
  const [item, setItem] = useState('');
  const [weight, setWeight] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  // #0 DIRECT DELIVERY: fallback choice + first-run explainer popup are disabled for launch.
  // const [fallback, setFallback] = useState<Fallback>('WAIT');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // const [showFallback, setShowFallback] = useState(false);
  // const [fallbackAck, setFallbackAck] = useState(false); // only prompt once per session
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

  // #4 MULTI-STOP: add/remove/patch an extra drop-off. Any change invalidates the current quote so
  // the fare is always re-computed for the full route the customer will actually pay for.
  const addStop = () => { if (extraStops.length < MAX_EXTRA_STOPS) { setExtraStops((s) => [...s, emptyStop()]); setQuote(null); } };
  const removeStop = (i: number) => { setExtraStops((s) => s.filter((_, idx) => idx !== i)); setQuote(null); };
  const patchStop = (i: number, patch: Partial<ExtraStopForm>) =>
    setExtraStops((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));

  const getQuote = async () => {
    setErr(null);
    // #2 COMING SOON: rides can't be quoted or paid yet — Delivery is the only bookable service.
    if (type === 'RIDE') return;
    if (!pickup || !dropoff) { setErr('Choose a pickup and drop-off'); return; }
    // #4 MULTI-STOP: every added stop must have a chosen address before we can quote the full route.
    if (extraStops.some((s) => !s.place)) { setErr('Choose an address for every added stop'); return; }
    // #0 DIRECT DELIVERY: no "receiver unavailable" explainer popup before quoting — quote directly.
    // if (type === 'DELIVERY' && !fallbackAck) { setShowFallback(true); return; }
    await fetchQuote();
  };

  const fetchQuote = async () => {
    setBusy(true);
    try {
      // #4 MULTI-STOP: pass the extra points as ordered `stops`; omitting them is a plain single-stop quote.
      const stops = extraStops.map((s) => s.place).filter((p): p is Place => !!p).map((p) => ({ lat: p.lat, lng: p.lng }));
      setQuote(await api.quote(getToken(), {
        type, pickup: { lat: pickup!.lat, lng: pickup!.lng }, dropoff: { lat: dropoff!.lat, lng: dropoff!.lng },
        ...(stops.length ? { stops } : {}),
      }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  // #0 DIRECT DELIVERY: the explainer popup is gone, so this confirm handler is no longer needed.
  // Called from the popup: keep whatever option is selected, then proceed to the quote.
  // const confirmFallback = () => { setFallbackAck(true); setShowFallback(false); void fetchQuote(); };

  const pay = async () => {
    if (!quote) return;
    setErr(null); setBusy(true);
    try {
      // #0 DIRECT DELIVERY: create the job WITHOUT `fallbackPolicy` — the backend defaults to
      // direct mode (no waiting fee, no return deposit). `fallbackPolicy: fallback` removed.
      const body: Parameters<typeof api.createJob>[1] = {
        quoteToken: quote.quoteToken,
        ...(pickup?.label ? { pickupAddress: pickup.label } : {}),
        ...(dropoff?.label ? { dropoffAddress: dropoff.label } : {}),
        ...(pickup?.area ? { pickupArea: pickup.area } : {}),
        ...(dropoff?.area ? { dropoffArea: dropoff.area } : {}),
        ...(type === 'DELIVERY' && recipientName && recipientPhone ? { recipient: { name: recipientName, phone: recipientPhone } } : {}),
        ...(type === 'DELIVERY' && item ? { item } : {}),
        ...(type === 'DELIVERY' && customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(type === 'DELIVERY' && Number(weight) > 0 ? { weightKg: Number(weight) } : {}),
        ...(type === 'DELIVERY' && instructions ? { instructions } : {}),
        // #4 MULTI-STOP: per-stop metadata in the SAME order & count as the quote `stops` above.
        ...(type === 'DELIVERY' && extraStops.length ? {
          extraStops: extraStops.map((s) => ({
            ...(s.recipientName.trim() && s.recipientPhone.trim() ? { recipient: { name: s.recipientName.trim(), phone: s.recipientPhone.trim() } } : {}),
            ...(s.item.trim() ? { item: s.item.trim() } : {}),
            ...(s.place?.label ? { address: s.place.label } : {}),
            ...(s.place?.area ? { area: s.place.area } : {}),
          })),
        } : {}),
      };
      const job = await api.createJob(getToken(), body);
      const link = (job as { paymentLink?: string }).paymentLink ?? `/jobs/${job.id}/track`;
      // #4 MULTI-STOP: if the server returned one-time codes for the extra stops, show them once so the
      // customer can share each with its recipient BEFORE we send them off to pay. Single-stop bookings
      // (no codes) go straight to checkout, exactly as before.
      if (job.extraStopCodes && job.extraStopCodes.length) { setBooked({ job, link }); return; }
      // Redirect to the Flutterwave hosted checkout; after paying, the customer returns to tracking.
      location.href = link;
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  // #4 MULTI-STOP: one-time codes handoff. The extra-stop codes are shown exactly once here, so the
  // customer can note/share each with its recipient before continuing to payment. (The primary stop's
  // code is still revealed later on the tracking screen, unchanged.)
  if (booked) {
    const codes = booked.job.extraStopCodes ?? [];
    return (
      <main style={{ padding: 20, paddingBottom: 96 }}>
        <div className="rf-card" style={{ border: '1px solid var(--ink)' }}>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.08em', marginBottom: 6 }}>SHARE YOUR STOP CODES</div>
          <b style={{ fontSize: 'var(--text-subtitle)' }}>Give each recipient their code</b>
          <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', lineHeight: 1.5, margin: '8px 0 14px' }}>
            The rider needs each stop&apos;s code to hand over. Share them now — they&apos;re shown once. Your first drop-off&apos;s
            code is revealed on the tracking screen.
          </p>
          {codes.map((code, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i === 0 ? '1px solid var(--line)' : '1px solid var(--line-2)' }}>
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)' }}>Stop {i + 2} code</span>
              <span className="mono" style={{ fontSize: 'var(--text-heading)', fontWeight: 700, letterSpacing: '.3em' }}>{code}</span>
            </div>
          ))}
          <div style={{ height: 14 }} />
          <Button onClick={() => { location.href = booked.link; }}>Continue to payment</Button>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main style={{ padding: 20, paddingBottom: 96 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <b style={{ fontSize: 'var(--text-subtitle)', letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--ink)' }}>Ryda</span><span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>first</span>
        </b>
        <NotificationBell />
      </header>
      <RatingPrompt />

      {/* Block a second order while one is still awaiting payment. */}
      {pending && (
        <div className="rf-card" style={{ border: '1px solid var(--warning)', marginBottom: 16 }}>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--warning)', letterSpacing: '.08em', marginBottom: 6 }}>ORDER AWAITING PAYMENT</div>
          <b style={{ fontSize: 'var(--text-body)' }}>Finish your last order first</b>
          <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', lineHeight: 1.45, margin: '6px 0 12px' }}>
            You have an unpaid order of {naira(pending.amountMinor)}. Complete or cancel it before booking a new one.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => (location.href = `/jobs/${pending.id}/track`)}>View order</Button>
            <Button variant="ghost" onClick={cancelPending}>Cancel it</Button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['DELIVERY', 'RIDE'] as JobType[]).map((t) => (
          <button key={t} onClick={() => { setType(t); setQuote(null); }} className="mono"
            style={{ flex: 1, padding: 10, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 'var(--text-caption)', letterSpacing: '.06em',
              border: `1px solid ${type === t ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--bg)',
              color: type === t ? 'var(--ink)' : 'var(--mid)' }}>{t}</button>
        ))}
      </div>

      {/* ERRAND ("buy-for-me"): a distinct flow — a rider buys something for you and delivers it. */}
      <a href="/errand" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <span style={{ width: 38, height: 38, borderRadius: 19, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🛍️</span>
        <span style={{ flex: 1 }}>
          <b style={{ fontSize: 'var(--text-body)', color: 'var(--ink)', display: 'block' }}>Send an errand</b>
          <span style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)' }}>Need something bought and delivered? Tap here.</span>
        </span>
        <span className="mono" style={{ color: 'var(--mid)' }}>→</span>
      </a>

      {/* MARKETPLACE: browse/sell. Both entry points are hidden while the marketplace master switch is off. */}
      {marketplaceOn && (<>
      <a href="/shop" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <span style={{ width: 38, height: 38, borderRadius: 19, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🛒</span>
        <span style={{ flex: 1 }}>
          <b style={{ fontSize: 'var(--text-body)', color: 'var(--ink)', display: 'block' }}>Shop from vendors</b>
          <span style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)' }}>Order products and we deliver them to you.</span>
        </span>
        <span className="mono" style={{ color: 'var(--mid)' }}>→</span>
      </a>

      {/* MARKETPLACE: become a vendor / manage your shop. */}
      <a href="/vendor" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <span style={{ width: 38, height: 38, borderRadius: 19, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏪</span>
        <span style={{ flex: 1 }}>
          <b style={{ fontSize: 'var(--text-body)', color: 'var(--ink)', display: 'block' }}>Sell on Rydafirst</b>
          <span style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)' }}>Register your shop and list your products.</span>
        </span>
        <span className="mono" style={{ color: 'var(--mid)' }}>→</span>
      </a>
      </>)}

      {/* #2 COMING SOON: Rydafirst is licensed as a courier, not a ride-hailing operator, so the Ride
          tab shows an on-brand Coming Soon panel and can't be quoted/paid. Delivery stays fully live. */}
      {type === 'RIDE' && (
        <div className="rf-card" style={{ textAlign: 'center', padding: '28px 20px', marginBottom: 16, background: 'var(--primary-soft)', border: '1px solid var(--primary)' }}>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--primary)', letterSpacing: '.14em', fontWeight: 700, marginBottom: 10 }}>
            COMING SOON
          </div>
          <b style={{ fontSize: 'var(--text-subtitle)', color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
            Rides are on the way
          </b>
          <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 auto', maxWidth: 320 }}>
            We&apos;re focused on fast, reliable deliveries for now. In-app rides are coming soon.
          </p>
          <div style={{ height: 16 }} />
          <Button variant="ghost" onClick={() => { setType('DELIVERY'); setQuote(null); }}>Book a delivery instead</Button>
        </div>
      )}

      {/* #2 COMING SOON: the booking form + quote/pay only render for Delivery. */}
      {type === 'DELIVERY' && (
      <>
      <MapPreview pickup={pickup} dropoff={dropoff} />
      {showLocPrompt && (
        <div className="rf-card" style={{ border: '1px solid var(--ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 'var(--text-heading)' }}>📍</span>
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 'var(--text-body)' }}>Turn on location</b>
            <div style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)' }}>Autofill your pickup from where you are.</div>
          </div>
          <Button onClick={() => { setShowLocPrompt(false); setLocateSignal((n) => n + 1); }}>Enable</Button>
        </div>
      )}
      <AddressInput label={type === 'DELIVERY' ? 'PICKUP' : 'FROM'} autoLocate={locateSignal} onSelect={(p) => { setPickup(p); setQuote(null); }} />
      <AddressInput label={type === 'DELIVERY' ? 'DROP-OFF' : 'TO'} onSelect={(p) => { setDropoff(p); setQuote(null); }} />

      {/* #4 MULTI-STOP: extra ordered drop-offs. Each is its own address + optional recipient/item, and
          can be removed. Up to 8 extra stops; the fare re-quotes for the whole route. */}
      {type === 'DELIVERY' && extraStops.map((s, i) => (
        <div key={i} className="rf-card" style={{ marginBottom: 12, border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em' }}>STOP {i + 2}</span>
            <button onClick={() => removeStop(i)} className="mono"
              style={{ fontSize: 'var(--text-caption)', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: 'var(--danger)' }}>REMOVE</button>
          </div>
          <AddressInput label={`STOP ${i + 2} ADDRESS`} onSelect={(p) => { patchStop(i, { place: p }); setQuote(null); }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="RECIPIENT NAME"><input className="rf-input" value={s.recipientName} onChange={(e) => patchStop(i, { recipientName: e.target.value })} /></Field>
            <Field label="RECIPIENT PHONE"><input className="rf-input" value={s.recipientPhone} inputMode="tel" onChange={(e) => patchStop(i, { recipientPhone: e.target.value })} placeholder="+234…" /></Field>
          </div>
          <Field label="WHAT ARE YOU SENDING? (OPTIONAL)"><input className="rf-input" value={s.item} onChange={(e) => patchStop(i, { item: e.target.value })} placeholder="e.g. documents" /></Field>
        </div>
      ))}
      {type === 'DELIVERY' && extraStops.length < MAX_EXTRA_STOPS && (
        <button onClick={addStop} className="mono"
          style={{ display: 'block', width: '100%', textAlign: 'center', background: 'none', border: '1px dashed var(--line)', borderRadius: 8, padding: '12px 4px', cursor: 'pointer', fontSize: 'var(--text-caption)', letterSpacing: '.06em', color: 'var(--ink)', marginBottom: 12 }}>
          + ADD ANOTHER STOP
        </button>
      )}

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
          {/* #0 DIRECT DELIVERY: "If receiver unavailable" selector removed — deliveries are direct now.
          <Field label="IF RECEIVER UNAVAILABLE">
            <select className="rf-input" value={fallback} onChange={(e) => setFallback(e.target.value as Fallback)}>
              {FALLBACK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.title}</option>)}
            </select>
            <button onClick={() => setShowFallback(true)} className="mono"
              style={{ background: 'none', border: 'none', padding: '6px 0 0', cursor: 'pointer', fontSize: 'var(--text-caption)', letterSpacing: '.06em', color: 'var(--ink-2)' }}>
              WHAT DO THESE MEAN? →
            </button>
          </Field>
          */}
        </>
      )}

      <div style={{ height: 8 }} />
      <Button onClick={getQuote} disabled={busy || !!pending}>{busy ? 'Working…' : pending ? 'Finish your pending order first' : 'Get quote'}</Button>
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}

      {quote && (
        // #0 DIRECT DELIVERY: plain total only — the refundable 75% "Return it to me" deposit lines
        // are removed. (The returnDeposit / grandTotal calc that added it to the total is gone.)
        <div className="rf-card" ref={quoteRef} style={{ marginTop: 16, scrollMarginTop: 16 }}>
          <Row label="Base" value={naira(quote.breakdown.baseMinor)} />
          <Row label="Distance" value={naira(quote.breakdown.distanceMinor)} />
          <Row label="Time" value={naira(quote.breakdown.timeMinor)} />
          <Row label="Platform fee" value={naira(quote.breakdown.platformFeeMinor)} />
          <div style={{ borderTop: '1px solid var(--line)', margin: '8px 0' }} />
          <Row label="Total" value={naira(quote.breakdown.totalMinor)} strong />
          <div style={{ height: 12 }} />
          <Button onClick={pay} disabled={busy}>Pay &amp; hold in escrow</Button>
          <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', textAlign: 'center', marginBottom: 0 }}>
            HELD SAFELY UNTIL DELIVERY IS CONFIRMED
          </p>
        </div>
      )}
      </>
      )}

      {/* #0 DIRECT DELIVERY: the "receiver unavailable" explainer popup is disabled for launch.
      {showFallback && (
        <div onClick={confirmFallback} style={{
          position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.45)', zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 480, background: 'var(--bg)', borderTopLeftRadius: 16, borderTopRightRadius: 16,
            padding: 20, maxHeight: '86vh', overflowY: 'auto',
          }}>
            <b style={{ fontSize: 'var(--text-subtitle)' }}>If your receiver isn’t available</b>
            <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '4px 0 14px' }}>
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
                    <b style={{ fontSize: 'var(--text-body)' }}>{o.title}</b>
                  </div>
                  <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '0 0 0 24px', lineHeight: 1.45 }}>{o.desc}</p>
                </button>
              );
            })}

            <div style={{ height: 6 }} />
            <Button onClick={confirmFallback}>Continue</Button>
            <button onClick={confirmFallback} className="mono" style={{
              display: 'block', width: '100%', background: 'none', border: 'none', padding: '12px 0 2px',
              cursor: 'pointer', fontSize: 'var(--text-caption)', letterSpacing: '.06em', color: 'var(--ink-2)',
            }}>
              SKIP — USE “{FALLBACK_OPTIONS.find((o) => o.value === fallback)?.title.toUpperCase()}”
            </button>
          </div>
        </div>
      )}
      */}

      <BottomNav />
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, marginBottom: 12 }}>
      <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)' }}>{label}</span>
      <span className="mono" style={{ fontWeight: strong ? 700 : 400, fontSize: strong ? 'var(--text-body)' : 'var(--text-small)' }}>{value}</span>
    </div>
  );
}
