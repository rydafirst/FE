'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api, type Job } from '@/lib/api';
import { getToken } from '@/lib/session';
import { BottomNav } from '@/components/BottomNav';
import { useRequireAuth } from '@/lib/useAuth';
import { useToast } from '@/components/ui/Toast';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
// A trip is "active" (resumable) until it reaches a terminal state.
const ACTIVE = ['ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP', 'ARRIVED', 'AWAITING_CODE'];

export default function RiderHome() {
  const { ready } = useRequireAuth();
  const [online, setOnline] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [earnings, setEarnings] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { show, node: toast } = useToast();

  useEffect(() => { api.wallet(getToken()).then((w) => setEarnings(w.releasedMinor)).catch(() => setEarnings(null)); }, []);

  // Look up the rider's assigned job on load, so an in-progress trip is resumable on ANY device.
  useEffect(() => {
    if (!ready) return;
    api.assignedJobs(getToken())
      .then((js) => setActiveJob(js.find((j) => ACTIVE.includes(j.status)) ?? null))
      .catch(() => {});
  }, [ready]);

  const loadFeed = useCallback(async () => {
    try { setJobs(await api.availableJobs(getToken())); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  }, []);

  // Poll the available-jobs feed every 4s while online (Uber-style dispatch).
  useEffect(() => {
    if (!online) { setJobs([]); return; }
    loadFeed();
    const t = setInterval(loadFeed, 4000);
    return () => clearInterval(t);
  }, [online, loadFeed]);

  const accept = async (id: string) => {
    try { const j = await api.accept(getToken(), id); location.href = `/jobs/${j.id}/rider`; }
    catch (e) { show((e as Error).message); loadFeed(); }
  };

  if (!ready) return null;

  return (
    <main style={{ padding: 20, paddingBottom: 96 }}>
      {/* Resume an in-progress trip — visible on any browser/device signed into this account. */}
      {activeJob && (
        <div className="rf-card" style={{ border: '1px solid var(--ink)', marginBottom: 16 }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.08em', marginBottom: 4 }}>YOU HAVE AN ACTIVE DELIVERY</div>
          <b style={{ fontSize: 15 }}>{naira(activeJob.amountMinor)} · {activeJob.status.replace(/_/g, ' ').toLowerCase()}</b>
          <div style={{ height: 10 }} />
          <Button onClick={() => (location.href = `/jobs/${activeJob.id}/rider`)}>Resume delivery</Button>
        </div>
      )}

      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', letterSpacing: '.06em' }}>EARNINGS TODAY</div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 700 }}>{earnings === null ? '—' : naira(earnings)}</div>

      <div style={{ height: 150, borderRadius: 6, background: 'var(--ink)', color: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center', margin: '12px 0' }} className="mono">
        {online ? (jobs.length ? `${jobs.length} JOB${jobs.length > 1 ? 'S' : ''} NEARBY` : 'ONLINE — WAITING FOR JOBS') : 'OFFLINE'}
      </div>
      <Button variant={online ? 'ghost' : 'primary'} onClick={() => setOnline((v) => !v)}>{online ? 'Go offline' : 'Go online'}</Button>

      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}

      {/* Live dispatch feed */}
      {online && (
        <div style={{ marginTop: 16 }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 8 }}>
            AVAILABLE JOBS
          </div>
          {jobs.length === 0 ? (
            <div className="rf-card" style={{ textAlign: 'center', color: 'var(--ink-2)' }}>
              <div className="mono" style={{ fontSize: 12 }}>NO JOBS YET — YOU&apos;LL SEE THEM HERE</div>
            </div>
          ) : (
            jobs.map((j) => (
              <div key={j.id} className="rf-card" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{j.type}</span>
                  <b className="mono" style={{ fontSize: 16 }}>{naira(j.amountMinor)}</b>
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', margin: '6px 0 10px' }}>
                  {j.pickup ? `${j.pickup.lat.toFixed(3)}, ${j.pickup.lng.toFixed(3)}` : '—'}
                  {'  →  '}
                  {j.dropoff ? `${j.dropoff.lat.toFixed(3)}, ${j.dropoff.lng.toFixed(3)}` : '—'}
                </div>
                <Button onClick={() => accept(j.id)}>Accept job</Button>
              </div>
            ))
          )}
        </div>
      )}

      <div style={{ height: 16 }} />
      <Button variant="ghost" onClick={() => (location.href = '/kyc')}>Complete verification (KYC)</Button>

      {toast}
      <BottomNav />
    </main>
  );
}
