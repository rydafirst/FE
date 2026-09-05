'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Vendor } from '@/lib/api';
import { getToken, isLoggedIn } from '@/lib/session';

export default function ShopBrowsePage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace('/login'); return; }
    api.vendors(getToken()).then(setVendors).catch((e) => setErr((e as Error).message));
  }, [router]);

  return (
    <main style={{ maxWidth: 640, margin: '24px auto', padding: 24 }}>
      <h1 style={{ fontSize: 'var(--text-heading)', letterSpacing: '-0.02em', margin: '0 0 4px' }}>Shops on Rydafirst</h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 'var(--text-small)', margin: '0 0 20px' }}>Order from a registered vendor — we deliver it to you.</p>
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}
      {vendors === null && !err && <p className="mono" style={{ color: 'var(--mid)', fontSize: 'var(--text-caption)' }}>LOADING…</p>}
      {vendors?.length === 0 && <p style={{ color: 'var(--ink-2)' }}>No shops are open yet. Check back soon.</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {vendors?.map((v) => (
          <a key={v.id} href={`/shop/${v.id}`} className="rf-card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 20 }}>
              {v.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : '🏪'}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', color: 'var(--ink)' }}>{v.businessName}</b>
              <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{[v.category, v.area].filter(Boolean).join(' · ') || 'Shop'}</span>
            </span>
            <span className="mono" style={{ color: 'var(--mid)' }}>→</span>
          </a>
        ))}
      </div>
    </main>
  );
}
