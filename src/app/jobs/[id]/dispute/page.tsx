'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getToken } from '@/lib/session';

export default function Dispute() {
  const id = String(useParams().id);
  const [counter, setCounter] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const open = async () => {
    try { const d = await api.openDispute(getToken(), id, counter);
      setResult(d.tier === 'auto' ? `Auto-resolved: ${d.resolution}` : 'Escalated for review'); }
    catch (e) { alert((e as Error).message); }
  };
  return (
    <main style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 4 }}>Open a dispute</h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>Funds freeze immediately. Clear-cut cases resolve automatically; the rest go to a reviewer.</p>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <input type="checkbox" checked={counter} onChange={(e) => setCounter(e.target.checked)} />
        <span>I have evidence that contradicts the record</span>
      </label>
      <Button onClick={open}>Open dispute</Button>
      {result && <div className="mono" style={{ marginTop: 12, fontWeight: 700 }}>{result}</div>}
    </main>
  );
}
