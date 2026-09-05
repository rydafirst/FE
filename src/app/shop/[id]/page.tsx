'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api, type Product, type Vendor } from '@/lib/api';
import { getToken, isLoggedIn } from '@/lib/session';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG')}`;

export default function StorefrontPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({}); // productId -> qty
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return; }
    api.vendor(getToken(), id).then(setVendor).catch((e) => setErr((e as Error).message));
    api.vendorProducts(getToken(), id).then(setProducts).catch(() => setProducts([]));
  }, [id, router]);

  const add = (p: Product) => setCart((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 }));
  const sub = (p: Product) => setCart((c) => { const n = (c[p.id] ?? 0) - 1; const next = { ...c }; if (n <= 0) delete next[p.id]; else next[p.id] = n; return next; });

  const items = (products ?? []).filter((p) => cart[p.id]);
  const goodsMinor = items.reduce((s, p) => s + p.priceMinor * (cart[p.id] ?? 0), 0);

  const checkout = async () => {
    if (items.length === 0) return;
    if (vendor?.shopLat == null || vendor?.shopLng == null) { setErr('This shop has not set its location yet — please try another.'); return; }
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setErr('Location is needed to price delivery.'); return; }
    setBusy(true); setErr(null);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const quote = await api.quote(getToken(), { type: 'ERRAND', pickup: { lat: vendor.shopLat!, lng: vendor.shopLng! }, dropoff: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        const order = await api.createMarketplaceOrder(getToken(), {
          vendorId: id, quoteToken: quote.quoteToken,
          items: items.map((p) => ({ productId: p.id, quantity: cart[p.id] ?? 1 })),
        });
        const link = (order as { paymentLink?: string }).paymentLink;
        if (link) window.location.href = link;
        else router.replace(`/jobs/${order.id}/track`);
      } catch (e) { setErr((e as Error).message); setBusy(false); }
    }, () => { setErr('Could not get your delivery location. Allow location access and try again.'); setBusy(false); }, { enableHighAccuracy: true, timeout: 10000 });
  };

  return (
    <main style={{ maxWidth: 640, margin: '24px auto', padding: 24, paddingBottom: 120 }}>
      <a href="/shop" className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', textDecoration: 'none' }}>← ALL SHOPS</a>
      <h1 style={{ fontSize: 'var(--text-heading)', letterSpacing: '-0.02em', margin: '8px 0 4px' }}>{vendor?.businessName ?? 'Shop'}</h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)', margin: '0 0 20px' }}>{[vendor?.category, vendor?.area].filter(Boolean).join(' · ')}</p>
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}
      {products === null && <p className="mono" style={{ color: 'var(--mid)', fontSize: 'var(--text-caption)' }}>LOADING…</p>}
      {products?.length === 0 && <p style={{ color: 'var(--ink-2)' }}>This shop has no products listed yet.</p>}

      <div style={{ display: 'grid', gap: 10 }}>
        {products?.map((p) => (
          <div key={p.id} className="rf-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {p.photoUrls?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photoUrls[0]} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover' }} />
            ) : <span style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🛒</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ color: 'var(--ink)' }}>{p.name}</b>
              {p.description ? <div style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)' }}>{p.description}</div> : null}
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink)' }}>{naira(p.priceMinor)}</div>
            </div>
            {cart[p.id] ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="rf-btn rf-btn--ghost" style={{ padding: '2px 10px' }} onClick={() => sub(p)}>−</button>
                <b>{cart[p.id]}</b>
                <button className="rf-btn rf-btn--ghost" style={{ padding: '2px 10px' }} onClick={() => add(p)}>+</button>
              </div>
            ) : (
              <button className="rf-btn rf-btn--ghost" onClick={() => add(p)}>Add</button>
            )}
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--bg)', borderTop: '1px solid var(--line)', padding: 16 }}>
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{items.reduce((s, p) => s + (cart[p.id] ?? 0), 0)} ITEMS · GOODS {naira(goodsMinor)}</div>
              <div style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)' }}>+ delivery fee, quoted at checkout</div>
            </div>
            <Button onClick={checkout} disabled={busy}>{busy ? 'Starting…' : 'Checkout'}</Button>
          </div>
        </div>
      )}
    </main>
  );
}
