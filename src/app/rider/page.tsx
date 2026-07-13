'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api, type AvailableJob, type Job } from '@/lib/api';
import { getToken } from '@/lib/session';
import { BottomNav } from '@/components/BottomNav';
import { NotificationBell } from '@/components/NotificationBell';
import { JobsMap } from '@/components/JobsMap';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { useRequireAuth } from '@/lib/useAuth';
import { useToast } from '@/components/ui/Toast';

const naira = (m: number) => `₦${(m / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
// A trip is "active" (resumable) until it reaches a terminal state.
const ACTIVE = ['ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'IN_PROGRESS', 'EN_ROUTE_DROP', 'ARRIVED', 'AWAITING_CODE'];

export default function RiderHome() {
  const { ready } = useRequireAuth();
  const [online, setOnline] = useState(false);
  const [jobs, setJobs] = useState<AvailableJob[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [earnings, setEarnings] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { show, node: toast } = useToast();

  useEffect(() => { api.wallet(getToken()).then((w) => setEarnings(w.releasedMinor)).catch(() => setEarnings(null)); }, []);

  // On load, read the rider's assigned job AND their persisted online state (both survive reloads
  // and are the same on any device, because they live on the backend, not this browser).
  useEffect(() => {
    if (!ready) return;
    api.assignedJobs(getToken())
      .then((js) => setActiveJob(js.find((j) => ACTIVE.includes(j.status)) ?? null))
      .catch(() => {});
    api.getAvailability(getToken()).then((a) => setOnline(a.online)).catch(() => {});
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

  // Toggle online/offline and RECORD it on the backend (optimistic; revert if the call fails).
  const toggleOnline = async () => {
    const next = !online;
    setOnline(next);
    try { await api.setAvailability(getToken(), next); }
    catch (e) { setOnline(!next); show((e as Error).message); }
  };

  // Pull-to-refresh: refetch everything that could have changed.
  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadFeed(),
      api.getAvailability(getToken()).then((a) => setOnline(a.online)).catch(() => {}),
      api.assignedJobs(getToken()).then((js) => setActiveJob(js.find((j) => ACTIVE.includes(j.status)) ?? null)).catch(() => {}),
      api.wallet(getToken()).then((w) => setEarnings(w.releasedMinor)).catch(() => {}),
    ]);
  }, [loadFeed]);

  const accept = async (id: string) => {
    try { const j = await api.accept(getToken(), id); location.href = `/jobs/${j.id}/rider`; }
    catch (e) { show((e as Error).message); loadFeed(); }
  };

  if (!ready) return null;

  return (
    <main style={{ padding: 20, paddingBottom: 96 }}>
      <PullToRefresh onRefresh={refreshAll}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <b style={{ fontSize: 18, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--ink)' }}>Ryda</span><span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>first</span>
        </b>
        <NotificationBell />
      </header>
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

      {online ? (
        <div style={{ margin: '12px 0' }}>
          <JobsMap pins={jobs.map((j) => ({ id: j.id, lat: j.pickupApprox.lat, lng: j.pickupApprox.lng, label: naira(j.amountMinor) }))} />
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', textAlign: 'center', marginTop: 8, letterSpacing: '.06em' }}>
            {jobs.length ? `${jobs.length} JOB${jobs.length > 1 ? 'S' : ''} NEARBY` : 'ONLINE — WAITING FOR JOBS'}
          </div>
        </div>
      ) : (
        <div style={{ height: 120, borderRadius: 6, background: 'var(--ink)', color: '#fff', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '12px 0' }} className="mono">OFFLINE</div>
      )}
      <Button variant={online ? 'ghost' : 'primary'} onClick={toggleOnline}>{online ? 'Go offline' : 'Go online'}</Button>

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
                <div style={{ fontSize: 13, color: 'var(--ink)', margin: '6px 0 10px' }}>
                  {j.pickupArea || 'Nearby'} <span style={{ color: 'var(--mid)' }}>→</span> {j.dropoffArea || 'Nearby'}
                </div>
                <Button onClick={() => accept(j.id)}>Accept job</Button>
              </div>
            ))
          )}
        </div>
      )}

      <div style={{ height: 16 }} />
      <Button variant="ghost" onClick={() => (location.href = '/documents')}>Documents &amp; verification</Button>
      </PullToRefresh>

      {toast}
      <BottomNav />
    </main>
  );
}
