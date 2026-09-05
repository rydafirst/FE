'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api, type ErrandReceipt } from '@/lib/api';
import { getToken } from '@/lib/session';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

/**
 * ERRAND proof-of-payment receipt — a clean, print-friendly page. "Download / Print" uses the browser's
 * print dialog so either party can Save as PDF. All figures come from the server, never the client.
 */
export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [rc, setRc] = useState<ErrandReceipt | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.errandReceipt(getToken(), id).then(setRc).catch((e) => setErr((e as Error).message));
  }, [id]);

  if (err) return <main style={{ maxWidth: 520, margin: '48px auto', padding: 24 }}><p style={{ color: 'var(--danger)' }}>{err}</p></main>;
  if (!rc) return <main style={{ maxWidth: 520, margin: '48px auto', padding: 24 }}><p style={{ color: 'var(--mid)' }}>Loading receipt…</p></main>;

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
      <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.05em', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );

  return (
    <main style={{ maxWidth: 520, margin: '32px auto', padding: 24 }}>
      <style>{`@media print { .noprint { display: none !important; } body { background: #fff; } }`}</style>
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 28, background: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="mono" style={{ fontWeight: 800, letterSpacing: '.14em', fontSize: 18 }}>RYDAFIRST</div>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginTop: 4 }}>PAYMENT RECEIPT</div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--success)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800 }}>✓</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 10 }}>{naira(rc.amountMinor)}</div>
          <div className="mono" style={{ color: 'var(--success)', marginTop: 4, fontSize: 'var(--text-caption)' }}>PAID TO THE SHOP</div>
        </div>
        <Row label="RECEIPT NO." value={rc.receiptNo} />
        <Row label="PAID ON" value={new Date(rc.paidAt).toLocaleString()} />
        {rc.store ? <Row label="SHOP" value={rc.store} /> : null}
        <Row label="PAID TO" value={`${rc.vendorName} · ${rc.vendorAccountMasked}`} />
        {rc.payoutRef ? <Row label="TRANSFER REF" value={rc.payoutRef} /> : null}
        <Row label="ITEMS" value={rc.shoppingList} />
        <Row label="ORDER" value={rc.orderId} />
        <p style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginTop: 16, textAlign: 'center' }}>
          Paid via Rydafirst escrow. This receipt confirms the shop was paid directly for the items above.
        </p>
      </div>
      <div className="noprint" style={{ marginTop: 16 }}>
        <Button onClick={() => window.print()}>Download / print receipt</Button>
      </div>
    </main>
  );
}
