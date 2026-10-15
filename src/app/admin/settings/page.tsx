'use client';
import { useEffect, useState } from 'react';
import { api, type EffectiveSettings, type DocCatalog } from '@/lib/api';
import { getToken } from '@/lib/session';
import { useAdminGuard } from '@/components/AdminNav';

const CITIES = ['LAGOS', 'ABUJA', 'PORT_HARCOURT', 'OTHER'];
const TRACK_LABEL: Record<string, string> = { BIKE: 'Bike', CAR: 'Car', KEKE: 'Keke', BICYCLE: 'Bicycle' };

export default function AdminSettingsPage() {
  const { ready, notAdmin } = useAdminGuard();
  const [s, setS] = useState<EffectiveSettings | null>(null);
  const [catalog, setCatalog] = useState<DocCatalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || notAdmin) return;
    api.adminSettings(getToken()).then(setS).catch((e) => setErr((e as Error).message));
    api.adminDocumentCatalog(getToken()).then(setCatalog).catch(() => {});
  }, [ready, notAdmin]);

  const save = async (patch: Partial<Pick<EffectiveSettings, 'requireGuarantor' | 'enforceRiderClearance' | 'marketplaceEnabled' | 'lateMoneyPenaltyEnabled' | 'launchCity' | 'referralRewardMinor' | 'referralsEnabled' | 'disabledDocByTrack'>>) => {
    setBusy(true); setMsg(null);
    try { setS(await api.adminUpdateSettings(getToken(), patch)); setMsg('Saved'); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-heading)', letterSpacing: '-0.02em', margin: '0 0 14px' }}>Settings</h1>
      {notAdmin && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>You need an admin account.</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}
      {!s && !err && !notAdmin && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}

      {s && (
        <>
          <Toggle label="Marketplace enabled" hint="Master switch for all vendor + shop features (onboarding, storefront, checkout). Keep OFF until the vendor fund-flow has legal sign-off. When off, every marketplace request is refused server-side, not just hidden."
            value={s.marketplaceEnabled} overridden={s.overridden.marketplaceEnabled} busy={busy}
            onChange={(v) => { if (!v || window.confirm('Turn the marketplace ON? Only do this once the vendor payout fund-flow has legal sign-off.')) save({ marketplaceEnabled: v }); }} />
          <Toggle label="Late-delivery money penalty" hint="When ON, an upheld late-delivery report forfeits 10% of that trip's delivery fee from the rider (in addition to a strike). Keep OFF until the money-forfeit flow has legal sign-off — strikes and suspensions still work with this off."
            value={s.lateMoneyPenaltyEnabled} overridden={s.overridden.lateMoneyPenaltyEnabled} busy={busy}
            onChange={(v) => { if (!v || window.confirm('Turn the money penalty ON? Upheld late reports will forfeit 10% of the trip fee from riders. Only do this once the forfeit flow has legal sign-off.')) save({ lateMoneyPenaltyEnabled: v }); }} />
          <Toggle label="Enforce rider clearance" hint="Riders must have all documents approved before going online or accepting jobs."
            value={s.enforceRiderClearance} overridden={s.overridden.enforceRiderClearance} busy={busy}
            onChange={(v) => save({ enforceRiderClearance: v })} />
          <Toggle label="Require guarantor" hint="Add a guarantor document to the required onboarding set."
            value={s.requireGuarantor} overridden={s.overridden.requireGuarantor} busy={busy}
            onChange={(v) => save({ requireGuarantor: v })} />

          <div className="rf-card" style={{ marginBottom: 12 }}>
            <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 8 }}>LAUNCH CITY {s.overridden.launchCity ? '· OVERRIDDEN' : '· FROM ENV'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CITIES.map((c) => (
                <button key={c} onClick={() => save({ launchCity: c })} disabled={busy} className="mono"
                  style={{ padding: '6px 12px', borderRadius: 999, fontSize: 'var(--text-caption)', cursor: 'pointer',
                    border: `1px solid ${s.launchCity === c ? 'var(--ink)' : 'var(--line)'}`,
                    background: s.launchCity === c ? 'var(--ink)' : 'var(--bg)', color: s.launchCity === c ? 'var(--on-dark)' : 'var(--ink-2)' }}>
                  {c.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <Toggle label="Referral program" hint="When ON, riders see their invite code/link and new riders can enter a referral code at sign-up. Turn OFF to pause the whole program — the code box is hidden and new claims are refused (already-earned referrals are unaffected)."
            value={s.referralsEnabled} overridden={s.overridden.referralsEnabled} busy={busy}
            onChange={(v) => save({ referralsEnabled: v })} />

          <ReferralReward valueMinor={s.referralRewardMinor} overridden={s.overridden.referralRewardMinor} busy={busy}
            onSave={(naira) => save({ referralRewardMinor: Math.round(naira * 100) })} />

          {catalog && (
            <div className="rf-card" style={{ marginBottom: 12 }}>
              <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 6 }}>
                RIDER DOCUMENTS — PER VEHICLE {s.overridden.disabledDocByTrack ? '· OVERRIDDEN' : '· FROM ENV'}
              </div>
              <div style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', marginBottom: 12, lineHeight: 1.45 }}>
                Tick a box to <b>require</b> that document for that vehicle; untick to stop collecting it. Changes apply to
                the rider checklist on the app and the web. Profile photo and government ID are always required; the
                guarantor has its own switch above.
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 360 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>Document</th>
                      {catalog.tracks.map((tr) => (
                        <th key={tr} className="mono" style={{ padding: '6px 8px', fontSize: 'var(--text-caption)', color: 'var(--ink-2)', textAlign: 'center' }}>{TRACK_LABEL[tr] ?? tr}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.items.map((d) => (
                      <tr key={d.type} style={{ borderTop: '1px solid var(--line-2)' }}>
                        <td style={{ padding: '8px', fontSize: 'var(--text-small)', color: 'var(--ink)' }}>{d.label}</td>
                        {catalog.tracks.map((tr) => {
                          const applies = d.tracks.includes(tr);
                          const required = applies && !(s.disabledDocByTrack[tr] ?? []).includes(d.type);
                          return (
                            <td key={tr} style={{ padding: '8px', textAlign: 'center' }}>
                              {applies ? (
                                <input type="checkbox" checked={required} disabled={busy}
                                  onChange={() => {
                                    const cur = { ...s.disabledDocByTrack };
                                    const list = new Set(cur[tr] ?? []);
                                    if (required) list.add(d.type); else list.delete(d.type); // required→hide, hidden→show
                                    cur[tr] = [...list];
                                    save({ disabledDocByTrack: cur });
                                  }}
                                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--ink)' }} />
                              ) : (
                                <span style={{ color: 'var(--line)' }}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {msg && <p style={{ fontSize: 'var(--text-small)', color: 'var(--success)' }}>{msg}</p>}
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginTop: 8 }}>
            Changes take effect immediately and override the deployed environment defaults.
          </p>
        </>
      )}
    </div>
  );
}

function ReferralReward({ valueMinor, overridden, busy, onSave }: {
  valueMinor: number; overridden: boolean; busy: boolean; onSave: (naira: number) => void;
}) {
  const [naira, setNaira] = useState(String(Math.round(valueMinor / 100)));
  useEffect(() => { setNaira(String(Math.round(valueMinor / 100))); }, [valueMinor]);
  const n = Number(naira);
  const dirty = Number.isFinite(n) && n >= 0 && Math.round(n * 100) !== valueMinor;
  return (
    <div className="rf-card" style={{ marginBottom: 12 }}>
      <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 6 }}>
        RIDER REFERRAL REWARD {overridden ? '· OVERRIDDEN' : '· FROM ENV'}
      </div>
      <div style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', marginBottom: 10 }}>
        Paid to a rider when someone they referred completes their first delivery (you credit it on the Referrals page).
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 'var(--text-body)' }}>₦</span>
        <input className="rf-input mono" style={{ maxWidth: 160 }} value={naira} inputMode="numeric"
          onChange={(e) => setNaira(e.target.value.replace(/[^0-9]/g, ''))} />
        <button onClick={() => onSave(n)} disabled={busy || !dirty} className="mono"
          style={{ border: 'none', borderRadius: 8, padding: '10px 16px', cursor: dirty ? 'pointer' : 'not-allowed',
            background: dirty ? 'var(--ink)' : 'var(--line)', color: dirty ? 'var(--on-dark)' : 'var(--mid)', fontSize: 'var(--text-caption)' }}>
          SAVE
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, hint, value, overridden, busy, onChange }: {
  label: string; hint: string; value: boolean; overridden: boolean; busy: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="rf-card" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div>
        <b style={{ fontSize: 'var(--text-body)' }}>{label}</b>
        <div style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', marginTop: 3 }}>{hint}</div>
        {overridden && <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 3 }}>OVERRIDDEN</div>}
      </div>
      <button onClick={() => onChange(!value)} disabled={busy} aria-pressed={value}
        style={{ width: 52, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: value ? 'var(--ink)' : 'var(--line)', position: 'relative', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 3, left: value ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: 'var(--on-dark)', transition: 'left .15s' }} />
      </button>
    </div>
  );
}
