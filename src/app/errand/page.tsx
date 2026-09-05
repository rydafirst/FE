'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AddressInput, type Place } from '@/components/AddressInput';
import { api, type Quote } from '@/lib/api';
import { getToken } from '@/lib/session';
import { BottomNav } from '@/components/BottomNav';
import { useRequireAuth } from '@/lib/useAuth';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

/**
 * ERRAND ("buy-for-me"): the customer picks the shop + their delivery address, types what to buy and how
 * much it costs, and pays (delivery fee + goods). The goods-money is held and paid to the shop's account
 * once the customer confirms it on the tracking screen — no cash changes hands with the rider.
 */
export default function ErrandPage() {
  const { ready } = useRequireAuth();
  const [shop, setShop] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [storeName, setStoreName] = useState('');
  const [list, setList] = useState('');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const goodsMinor = Math.round((Number(amount.replace(/[^\d]/g, '')) || 0) * 100);

  const getQuote = async () => {
    setErr(null);
    if (!shop || !dropoff) { setErr('Choose the shop and your delivery address'); return; }
    if (goodsMinor <= 0) { setErr('Enter the amount to buy'); return; }
    if (!list.trim()) { setErr('Say what the rider should buy'); return; }
    setBusy(true);
    try { setQuote(await api.quote(getToken(), { type: 'ERRAND', pickup: { lat: shop.lat, lng: shop.lng }, dropoff: { lat: dropoff.lat, lng: dropoff.lng } })); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const book = async () => {
    if (!quote || !shop || !dropoff) return;
    setErr(null); setBusy(true);
    try {
      const job = await api.createErrand(getToken(), {
        quoteToken: quote.quoteToken, goodsMinor, shoppingList: list.trim(),
        ...(storeName.trim() ? { storeName: storeName.trim() } : {}),
        ...(shop.label ? { storeAddress: shop.label } : {}),
        ...(shop.area ? { storeArea: shop.area } : {}),
        ...(dropoff.label ? { dropoffAddress: dropoff.label } : {}),
        ...(dropoff.area ? { dropoffArea: dropoff.area } : {}),
      });
      location.href = (job as { paymentLink?: string }).paymentLink ?? `/jobs/${job.id}/track`;
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  if (!ready) return null;
  const feeMinor = quote?.amountMinor ?? 0;

  return (
    <main style={{ padding: 20, paddingBottom: 96, maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--text-heading)', letterSpacing: '-0.02em', margin: '0 0 4px' }}>Send an errand</h1>
      <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '0 0 16px', lineHeight: 1.5 }}>
        A rider buys what you need and delivers it. You pay the item price + delivery — we pay the shop directly, so no cash changes hands.
      </p>
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}

      <div style={{ marginBottom: 12 }}><AddressInput label="Shop / where to buy" placeholder="e.g. Sola Store, Ikeja" onSelect={(p) => { setShop(p); setQuote(null); }} /></div>
      <div style={{ marginBottom: 12 }}><AddressInput label="Deliver to" placeholder="Your address" onSelect={(p) => { setDropoff(p); setQuote(null); }} /></div>

      <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>SHOP NAME (OPTIONAL)</label>
      <input className="rf-input" style={{ width: '100%', margin: '4px 0 12px' }} value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. Sola Store" />

      <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>WHAT SHOULD THE RIDER BUY?</label>
      <textarea className="rf-input" style={{ width: '100%', minHeight: 76, margin: '4px 0 12px' }} value={list} onChange={(e) => { setList(e.target.value); setQuote(null); }} placeholder="e.g. 2 loaves of Agege bread and a tin of Milo" />

      <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>AMOUNT TO BUY (₦)</label>
      <input className="rf-input" inputMode="numeric" style={{ width: '100%', margin: '4px 0 4px' }} value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d]/g, '')); setQuote(null); }} placeholder="e.g. 5000" />
      <p style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', margin: '0 0 14px', lineHeight: 1.5 }}>
        Enter what the items cost. If it&apos;s more at the shop, your rider will ask and you can top up in the app.
      </p>

      {!quote ? (
        <Button onClick={getQuote} disabled={busy}>{busy ? 'Getting price…' : 'Get delivery price'}</Button>
      ) : (
        <div className="rf-card">
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 8 }}>ERRAND TOTAL</div>
          <Row label="Item money (to the shop)" value={naira(goodsMinor)} />
          <Row label="Delivery fee" value={naira(feeMinor)} />
          <div style={{ height: 1, background: 'var(--line-2)', margin: '8px 0' }} />
          <Row label="You pay now" value={naira(goodsMinor + feeMinor)} strong />
          <div style={{ height: 12 }} />
          <Button onClick={book} disabled={busy}>{busy ? 'Starting payment…' : `Pay ${naira(goodsMinor + feeMinor)}`}</Button>
        </div>
      )}
      <BottomNav />
    </main>
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
