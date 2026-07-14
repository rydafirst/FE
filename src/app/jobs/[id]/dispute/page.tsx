'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getToken } from '@/lib/session';
import { useToast } from '@/components/ui/Toast';

export default function Dispute() {
  const id = String(useParams().id);
  const router = useRouter();
  const [counter, setCounter] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { show, node: toast } = useToast();

  const open = async () => {
    setBusy(true);
    try {
      const d = await api.openDispute(getToken(), id, counter);
      setResult(d.tier === 'auto' ? `Auto-resolved: ${d.resolution}` : 'Escalated for review');
    } catch (e) {
      show((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const back = () => { if (window.history.length > 1) router.back(); else router.push(`/jobs/${id}/track`); };

  return (
    <main style={{ padding: 20 }}>
      <button onClick={back} className="mono" aria-label="Back"
        style={{ background: 'none', border: 'none', padding: '4px 0 12px', cursor: 'pointer', fontSize: 12, letterSpacing: '.06em', color: 'var(--ink-2)' }}>
        ← BACK
      </button>
      <h2 style={{ marginBottom: 4 }}>Open a dispute</h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>Funds freeze immediately. Clear-cut cases resolve automatically; the rest go to a reviewer.</p>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <input type="checkbox" checked={counter} onChange={(e) => setCounter(e.target.checked)} />
        <span>I have evidence that contradicts the record</span>
      </label>
      <Button onClick={open} disabled={busy}>{busy ? 'Opening…' : 'Open dispute'}</Button>
      {result && <div className="mono" style={{ marginTop: 12, fontWeight: 700 }}>{result}</div>}
      {toast}
    </main>
  );
}
