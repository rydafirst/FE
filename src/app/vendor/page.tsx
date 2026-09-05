'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api, type Product, type Vendor, type VendorOrder } from '@/lib/api';
import { getToken, isLoggedIn } from '@/lib/session';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG')}`;

const STATUS: Record<string, { text: string; color: string }> = {
  PENDING: { text: 'Awaiting approval', color: 'var(--warning)' },
  APPROVED: { text: 'Live', color: 'var(--success)' },
  REJECTED: { text: 'Needs changes', color: 'var(--danger)' },
  SUSPENDED: { text: 'Suspended', color: 'var(--danger)' },
};

export default function VendorConsolePage() {
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null | undefined>(undefined); // undefined = loading
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return; }
    api.myVendor(getToken()).then((v) => setVendor(v)).catch((e) => setErr((e as Error).message));
  }, [router]);

  if (vendor === undefined) return <main style={{ maxWidth: 560, margin: '32px auto', padding: 24 }}><p className="mono" style={{ color: 'var(--mid)' }}>LOADING…</p></main>;

  return (
    <main style={{ maxWidth: 560, margin: '24px auto', padding: 24 }}>
      <h1 style={{ fontSize: 'var(--text-heading)', letterSpacing: '-0.02em', margin: '0 0 4px' }}>Your shop</h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)', margin: '0 0 20px' }}>Sell on Rydafirst. Payouts go only to your verified business account.</p>
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}
      {vendor ? <VendorHome vendor={vendor} onChange={setVendor} /> : <RegisterForm onCreated={setVendor} />}
    </main>
  );
}

function RegisterForm({ onCreated }: { onCreated: (v: Vendor) => void }) {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [area, setArea] = useState('');
  const [rcNumber, setRcNumber] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (businessName.trim().length < 2) { setErr('Enter your business name.'); return; }
    setBusy(true); setErr(null);
    try {
      const v = await api.registerVendor(getToken(), {
        businessName: businessName.trim(),
        ...(category.trim() ? { category: category.trim() } : {}),
        ...(area.trim() ? { area: area.trim() } : {}),
        ...(rcNumber.trim() ? { rcNumber: rcNumber.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      onCreated(v);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="rf-card">
      <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 10 }}>REGISTER YOUR BUSINESS</div>
      <Field label="Business name"><input className="rf-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Solashine Ventures" /></Field>
      <Field label="Category (optional)"><input className="rf-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Groceries, Fashion" /></Field>
      <Field label="Area (optional)"><input className="rf-input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Yaba, Lagos" /></Field>
      <Field label="CAC / RC number (optional)"><input className="rf-input" value={rcNumber} onChange={(e) => setRcNumber(e.target.value)} placeholder="RC 1234567" /></Field>
      <Field label="About your shop (optional)"><textarea className="rf-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}
      <Button onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Register shop'}</Button>
    </div>
  );
}

function VendorHome({ vendor, onChange }: { vendor: Vendor; onChange: (v: Vendor) => void }) {
  const s = STATUS[vendor.status] ?? { text: vendor.status, color: 'var(--ink-2)' };
  return (
    <>
      <div className="rf-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <LogoUpload vendor={vendor} onChange={onChange} />
            <div style={{ fontWeight: 700, fontSize: 'var(--text-subtitle)' }}>{vendor.businessName}</div>
          </div>
          <span className="rf-pill" style={{ background: s.color, color: 'var(--on-dark)', fontSize: 'var(--text-caption)', whiteSpace: 'nowrap' }}>{s.text.toUpperCase()}</span>
        </div>
        {vendor.status === 'REJECTED' && vendor.rejectionReason ? (
          <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)', marginTop: 8 }}>{vendor.rejectionReason}</p>
        ) : null}
        {vendor.status === 'PENDING' ? (
          <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)', marginTop: 8 }}>Add your business account below — an admin reviews new shops before they go live.</p>
        ) : null}
      </div>

      <BusinessAccount vendor={vendor} onChange={onChange} />
      <ShopLocation vendor={vendor} onChange={onChange} />
      {vendor.status === 'APPROVED' ? <Orders /> : null}
      <Products />
    </>
  );
}

function Orders() {
  const [orders, setOrders] = useState<VendorOrder[] | null>(null);
  useEffect(() => { api.vendorOrders(getToken()).then(setOrders).catch(() => setOrders([])); }, []);
  if (orders === null) return null;
  return (
    <div className="rf-card" style={{ marginBottom: 16 }}>
      <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 10 }}>INCOMING ORDERS</div>
      {orders.length === 0 ? <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)', margin: 0 }}>No orders yet.</p> : null}
      {orders.map((o) => (
        <div key={o.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <b style={{ fontSize: 'var(--text-small)' }}>{o.items || 'Order'}</b>
            <span className="mono" style={{ fontSize: 'var(--text-caption)', color: o.vendorPaidAt ? 'var(--success)' : 'var(--warning)', whiteSpace: 'nowrap' }}>
              {o.vendorPaidAt ? `PAID ${naira(o.goodsMinor)}` : 'AWAITING DELIVERY'}
            </span>
          </div>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginTop: 2 }}>
            {new Date(o.createdAt).toLocaleString()} · {o.status.replace(/_/g, ' ')}
          </div>
        </div>
      ))}
    </div>
  );
}

function LogoUpload({ vendor, onChange }: { vendor: Vendor; onChange: (v: Vendor) => void }) {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const mime = file.type || 'image/jpeg';
    if (!/^image\//.test(mime)) return;
    setBusy(true);
    try {
      const { uploadUrl, key } = await api.vendorLogoUploadUrl(getToken(), mime, file.size);
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: file });
      if (!put.ok) throw new Error('Upload failed');
      onChange(await api.updateVendor(getToken(), { logoKey: key }));
    } catch { /* surfaced by the badge staying blank */ } finally { setBusy(false); }
  };
  return (
    <label style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }} title="Upload shop logo">
      {vendor.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vendor.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : <span style={{ fontSize: 18 }}>{busy ? '…' : '🏪'}</span>}
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
    </label>
  );
}

function ShopLocation({ vendor, onChange }: { vendor: Vendor; onChange: (v: Vendor) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const has = vendor.shopLat != null && vendor.shopLng != null;

  const setHere = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setErr('Location is not available in this browser.'); return; }
    setBusy(true); setErr(null);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const v = await api.updateVendor(getToken(), { shopLat: pos.coords.latitude, shopLng: pos.coords.longitude });
        onChange(v);
      } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
    }, () => { setErr('Could not get your location. Allow location access and try again.'); setBusy(false); }, { enableHighAccuracy: true, timeout: 10000 });
  };

  return (
    <div className="rf-card" style={{ marginBottom: 16 }}>
      <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 10 }}>SHOP LOCATION (USED TO PRICE DELIVERY)</div>
      {has ? (
        <div className="mono" style={{ color: 'var(--success)', fontSize: 'var(--text-caption)', marginBottom: 10 }}>✓ LOCATION SET</div>
      ) : (
        <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)', margin: '0 0 10px' }}>Set your shop location so customers can be charged the right delivery fee. Stand at your shop and tap below.</p>
      )}
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}
      <Button variant="ghost" onClick={setHere} disabled={busy}>{busy ? 'Getting location…' : has ? 'Update shop location' : 'Use my current location'}</Button>
    </div>
  );
}

function BusinessAccount({ vendor, onChange }: { vendor: Vendor; onChange: (v: Vendor) => void }) {
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ accountName: string; match: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(!vendor.account);

  useEffect(() => { api.banks(getToken()).then(setBanks).catch(() => {}); }, []);

  const save = async () => {
    if (!bankCode || accountNumber.length < 10) { setErr('Pick the bank and enter the 10-digit account number.'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api.vendorBusinessAccount(getToken(), bankCode, accountNumber);
      setResult(r);
      const fresh = await api.myVendor(getToken());
      if (fresh) onChange(fresh);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="rf-card" style={{ marginBottom: 16 }}>
      <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 10 }}>BUSINESS PAYOUT ACCOUNT (BUSINESS ACCOUNTS ONLY)</div>
      {vendor.account && !editing ? (
        <div>
          <div style={{ fontWeight: 700 }}>{vendor.account.accountName}</div>
          <div className="mono" style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', marginTop: 2 }}>{vendor.account.accountNumber}</div>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: vendor.accountVerified ? 'var(--success)' : 'var(--warning)', marginTop: 8 }}>
            {vendor.accountVerified ? '✓ NAME VERIFIED' : '⚠ NAME NOT AUTO-VERIFIED — ADMIN WILL CONFIRM'}
          </div>
          <button className="rf-btn rf-btn--ghost" style={{ marginTop: 10 }} onClick={() => { setEditing(true); setResult(null); }}>Change account</button>
        </div>
      ) : (
        <div>
          <select className="rf-input" value={bankCode} onChange={(e) => { setBankCode(e.target.value); setResult(null); }} style={{ width: '100%', marginBottom: 8 }}>
            <option value="">Select your bank</option>
            {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
          <input className="rf-input" inputMode="numeric" placeholder="Account number (10 digits)" value={accountNumber}
            onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10)); setResult(null); }} style={{ width: '100%', marginBottom: 8 }} />
          {result ? (
            <div style={{ border: `1px solid ${result.match ? 'var(--success)' : 'var(--warning)'}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>ACCOUNT NAME</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{result.accountName}</div>
              <div className="mono" style={{ color: result.match ? 'var(--success)' : 'var(--warning)', marginTop: 6, fontSize: 'var(--text-caption)' }}>
                {result.match ? '✓ MATCHES YOUR BUSINESS NAME' : '⚠ DOESN’T CLEARLY MATCH — ADMIN WILL REVIEW'}
              </div>
            </div>
          ) : null}
          {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}
          <Button onClick={save} disabled={busy || !bankCode || accountNumber.length < 10}>{busy ? 'Checking…' : 'Save account'}</Button>
        </div>
      )}
    </div>
  );
}

function Products() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<{ key: string; preview: string }[]>([]); // uploaded, waiting to attach on Add
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => api.myProducts(getToken()).then(setProducts).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, []);

  const pickPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true); setErr(null);
    try {
      for (const file of Array.from(files).slice(0, 6 - photos.length)) {
        const mime = file.type || 'image/jpeg';
        if (!/^image\//.test(mime)) continue;
        const { uploadUrl, key } = await api.productPhotoUploadUrl(getToken(), mime, file.size);
        const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: file });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);
        setPhotos((p) => [...p, { key, preview: URL.createObjectURL(file) }]);
      }
    } catch (e) { setErr((e as Error).message); } finally { setUploading(false); }
  };

  const add = async () => {
    const priceMinor = Math.round(Number(price) * 100);
    if (name.trim().length < 1) { setErr('Enter the product name.'); return; }
    if (!priceMinor || priceMinor < 1) { setErr('Enter a valid price.'); return; }
    setBusy(true); setErr(null);
    try {
      await api.addProduct(getToken(), { name: name.trim(), priceMinor, ...(description.trim() ? { description: description.trim() } : {}), ...(photos.length ? { photoKeys: photos.map((p) => p.key) } : {}) });
      setName(''); setPrice(''); setDescription(''); setPhotos([]); await load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const toggle = async (p: Product) => { await api.updateProduct(getToken(), p.id, { available: !p.available }); await load(); };
  const remove = async (p: Product) => { if (window.confirm(`Remove “${p.name}”?`)) { await api.removeProduct(getToken(), p.id); await load(); } };

  return (
    <div className="rf-card">
      <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 10 }}>YOUR PRODUCTS</div>
      {products?.map((p) => (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
            {p.photoUrls?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photoUrls[0]} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
            ) : null}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{naira(p.priceMinor)}{p.available ? '' : ' · HIDDEN'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="rf-btn rf-btn--ghost" style={{ padding: '4px 10px', fontSize: 'var(--text-caption)' }} onClick={() => toggle(p)}>{p.available ? 'Hide' : 'Show'}</button>
            <button className="rf-btn rf-btn--ghost" style={{ padding: '4px 10px', fontSize: 'var(--text-caption)' }} onClick={() => remove(p)}>Delete</button>
          </div>
        </div>
      ))}
      {products?.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)', margin: '4px 0 12px' }}>No products yet — add your first below.</p>}

      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input className="rf-input" style={{ flex: 2 }} placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="rf-input" style={{ flex: 1 }} inputMode="numeric" placeholder="Price ₦" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} />
        </div>
        <input className="rf-input" style={{ width: '100%', marginBottom: 8 }} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {photos.map((ph, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={ph.preview} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }} />
          ))}
          {photos.length < 6 && (
            <label className="rf-btn rf-btn--ghost" style={{ padding: '6px 12px', fontSize: 'var(--text-caption)', cursor: 'pointer' }}>
              {uploading ? 'Uploading…' : '+ Photo'}
              <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { void pickPhotos(e.target.files); e.target.value = ''; }} />
            </label>
          )}
        </div>
        {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}
        <Button onClick={add} disabled={busy || uploading}>{busy ? 'Adding…' : 'Add product'}</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 4 }}>{label.toUpperCase()}</div>
      {children}
    </div>
  );
}
