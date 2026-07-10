'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getToken } from '@/lib/session';

const ITEMS = [
  ['ninVerified', 'NIN verified'], ['bvnVerified', 'BVN verified'],
  ['idDocUploaded', 'Government ID uploaded'], ['selfieMatched', 'Selfie / liveness matched'],
  ['addressProvided', 'Home address provided'],
] as const;
type Key = (typeof ITEMS)[number][0];

export default function Kyc() {
  const [state, setState] = useState<Record<Key, boolean>>({
    ninVerified: false, bvnVerified: false, idDocUploaded: false, selfieMatched: false, addressProvided: false,
  });
  const submit = async () => {
    try { await api.submitKyc(getToken(), state); alert('KYC submitted — pending review.'); location.href = '/rider'; }
    catch (e) { alert((e as Error).message); }
  };
  return (
    <main style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 4 }}>Rider verification</h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 0 }}>You can&apos;t accept jobs until NIN + BVN are verified.</p>
      {ITEMS.map(([k, label]) => (
        <label key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}>
          <span>{label}</span>
          <input type="checkbox" checked={state[k]} onChange={(e) => setState((s) => ({ ...s, [k]: e.target.checked }))} />
        </label>
      ))}
      <div style={{ height: 16 }} />
      <Button onClick={submit}>Submit for review</Button>
    </main>
  );
}
