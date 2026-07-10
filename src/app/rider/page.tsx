'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getToken } from '@/lib/session';

export default function RiderHome() {
  const [online, setOnline] = useState(false);
  const [jobId, setJobId] = useState('');
  const [earnings, setEarnings] = useState<number | null>(null);

  useEffect(() => { api.wallet(getToken()).then((w) => setEarnings(w.releasedMinor)).catch(() => setEarnings(null)); }, []);

  const accept = async () => {
    try { const j = await api.accept(getToken(), jobId.trim()); location.href = `/jobs/${j.id}/rider`; }
    catch (e) { alert((e as Error).message); }
  };
  const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

  return (
    <main style={{ padding: 20 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', letterSpacing: '.06em' }}>EARNINGS TODAY</div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 700 }}>{earnings === null ? '—' : naira(earnings)}</div>
      <div style={{ height: 150, borderRadius: 6, background: 'var(--ink)', color: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center', margin: '12px 0' }} className="mono">
        {online ? 'ONLINE — WAITING FOR JOBS' : 'OFFLINE'}
      </div>
      <Button variant={online ? 'ghost' : 'primary'} onClick={() => setOnline((v) => !v)}>{online ? 'Go offline' : 'Go online'}</Button>
      <div className="rf-card" style={{ marginTop: 16 }}>
        <label className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>ACCEPT A JOB (paste job id)</label>
        <input className="rf-input" style={{ margin: '8px 0 12px' }} value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="job id" />
        <Button onClick={accept}>Accept job</Button>
      </div>
      <div style={{ height: 10 }} />
      <Button variant="ghost" onClick={() => (location.href = '/kyc')}>Complete verification (KYC)</Button>
    </main>
  );
}
