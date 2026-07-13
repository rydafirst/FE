'use client';
import { useEffect, useState } from 'react';
import { api, type EffectiveSettings } from '@/lib/api';
import { getToken } from '@/lib/session';
import { AdminNav, useAdminGuard } from '@/components/AdminNav';

const CITIES = ['LAGOS', 'ABUJA', 'PORT_HARCOURT', 'OTHER'];

export default function AdminSettingsPage() {
  const { ready, notAdmin } = useAdminGuard();
  const [s, setS] = useState<EffectiveSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || notAdmin) return;
    api.adminSettings(getToken()).then(setS).catch((e) => setErr((e as Error).message));
  }, [ready, notAdmin]);

  const save = async (patch: Partial<Pick<EffectiveSettings, 'requireGuarantor' | 'enforceRiderClearance' | 'launchCity'>>) => {
    setBusy(true); setMsg(null);
    try { setS(await api.adminUpdateSettings(getToken(), patch)); setMsg('Saved'); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <main style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <AdminNav />
      <h1 style={{ fontSize: 22, letterSpacing: '-0.02em', margin: '0 0 14px' }}>Settings</h1>
      {notAdmin && <p style={{ color: 'var(--danger)', fontSize: 13 }}>You need an admin account.</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
      {!s && !err && !notAdmin && <p className="mono" style={{ fontSize: 12, color: 'var(--mid)' }}>LOADING…</p>}

      {s && (
        <>
          <Toggle label="Enforce rider clearance" hint="Riders must have all documents approved before going online or accepting jobs."
            value={s.enforceRiderClearance} overridden={s.overridden.enforceRiderClearance} busy={busy}
            onChange={(v) => save({ enforceRiderClearance: v })} />
          <Toggle label="Require guarantor" hint="Add a guarantor document to the required onboarding set."
            value={s.requireGuarantor} overridden={s.overridden.requireGuarantor} busy={busy}
            onChange={(v) => save({ requireGuarantor: v })} />

          <div className="rf-card" style={{ marginBottom: 12 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', marginBottom: 8 }}>LAUNCH CITY {s.overridden.launchCity ? '· OVERRIDDEN' : '· FROM ENV'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CITIES.map((c) => (
                <button key={c} onClick={() => save({ launchCity: c })} disabled={busy} className="mono"
                  style={{ padding: '6px 12px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                    border: `1px solid ${s.launchCity === c ? 'var(--ink)' : 'var(--line)'}`,
                    background: s.launchCity === c ? 'var(--ink)' : 'var(--bg)', color: s.launchCity === c ? '#fff' : 'var(--ink-2)' }}>
                  {c.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {msg && <p style={{ fontSize: 12.5, color: 'var(--success)' }}>{msg}</p>}
          <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 8 }}>
            Changes take effect immediately and override the deployed environment defaults.
          </p>
        </>
      )}
    </main>
  );
}

function Toggle({ label, hint, value, overridden, busy, onChange }: {
  label: string; hint: string; value: boolean; overridden: boolean; busy: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="rf-card" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div>
        <b style={{ fontSize: 14 }}>{label}</b>
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3 }}>{hint}</div>
        {overridden && <div className="mono" style={{ fontSize: 10, color: 'var(--mid)', marginTop: 3 }}>OVERRIDDEN</div>}
      </div>
      <button onClick={() => onChange(!value)} disabled={busy} aria-pressed={value}
        style={{ width: 52, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: value ? 'var(--ink)' : 'var(--line)', position: 'relative', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 3, left: value ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </button>
    </div>
  );
}
