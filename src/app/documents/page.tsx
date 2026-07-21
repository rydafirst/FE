'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { useRequireAuth } from '@/lib/useAuth';
import { api, VEHICLE_COLORS, type ChecklistItem, type DocChecklist, type DocState, type VehicleColor, type VehicleTrack } from '@/lib/api';
import { getToken } from '@/lib/session';

const TRACKS: { value: VehicleTrack; label: string; hint: string }[] = [
  { value: 'BIKE', label: 'Motorcycle', hint: 'Dispatch bike' },
  { value: 'CAR', label: 'Car / Van', hint: 'Larger loads' },
  { value: 'KEKE', label: 'Keke (tricycle)', hint: 'Mid-size loads' },
];

const STATE: Record<DocState, { text: string; color: string }> = {
  MISSING: { text: 'Upload', color: 'var(--mid)' },
  SUBMITTED: { text: 'Submitted', color: 'var(--info)' },
  UNDER_REVIEW: { text: 'Reviewing', color: 'var(--info)' },
  APPROVED: { text: 'Approved', color: 'var(--success)' },
  REJECTED: { text: 'Rejected', color: 'var(--danger)' },
  EXPIRED: { text: 'Expired', color: 'var(--danger)' },
};

const ONBOARDING_MSG: Record<DocChecklist['onboarding'], string> = {
  NO_TRACK: 'Choose your vehicle to begin.',
  INCOMPLETE: 'Upload the required documents below.',
  ACTION_REQUIRED: 'Some documents were rejected — re-upload them.',
  UNDER_REVIEW: 'Under review — we’ll notify you when it’s done.',
  EXPIRED: 'A document expired — re-upload to stay active.',
  APPROVED: 'Approved — you’re cleared to go online.',
};

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

export default function DocumentsPage() {
  const { ready } = useRequireAuth();
  const [data, setData] = useState<DocChecklist | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<ChecklistItem | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.documentsChecklist(getToken())); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { if (ready) void load(); }, [ready, load]);

  const chooseTrack = async (track: VehicleTrack) => {
    try { await api.setVehicleTrack(getToken(), track); await load(); } catch (e) { setErr((e as Error).message); }
  };

  // Row click → (optionally ask expiry) → open the native file picker.
  const onRowClick = (item: ChecklistItem) => {
    if (['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(item.status)) return;
    pending.current = item;
    fileRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-picked
    const item = pending.current;
    pending.current = null;
    if (!file || !item) return;

    let expiresAt: number | undefined;
    if (item.expires) {
      const input = window.prompt(`Expiry date for "${item.label}" (YYYY-MM-DD):`);
      if (!input) return;
      const ms = Date.parse(`${input}T00:00:00`);
      if (Number.isNaN(ms) || ms <= Date.now()) { setErr('Enter a valid future expiry date (YYYY-MM-DD).'); return; }
      expiresAt = ms;
    }

    setErr(null);
    setBusy(item.type);
    try {
      const { uploadUrl } = await api.requestDocumentUpload(getToken(), {
        type: item.type, contentType: file.type || 'application/octet-stream', ...(expiresAt ? { expiresAt } : {}),
      });
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      await load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  if (!ready) return null;

  return (
    <main style={{ padding: 20, paddingBottom: 96 }}>
      <h1 style={{ fontSize: 'var(--text-heading)', margin: '4px 0 16px', letterSpacing: '-0.02em' }}>Documents &amp; verification</h1>
      <input ref={fileRef} type="file" accept={ACCEPT} onChange={onFile} style={{ display: 'none' }} />

      {data && (
        <div className="rf-card" style={{ marginBottom: 16, border: `1px solid ${data.onboarding === 'APPROVED' ? 'var(--success)' : 'var(--line)'}` }}>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>DOCUMENT STATUS</div>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 700, marginTop: 6 }}>{ONBOARDING_MSG[data.onboarding]}</div>
        </div>
      )}

      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)' }}>{err}</p>}
      {data === null && !err && <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>LOADING…</p>}

      {data && !data.track && (
        <>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', marginBottom: 8 }}>WHAT DO YOU DELIVER WITH?</div>
          {TRACKS.map((tr) => (
            <button key={tr.value} onClick={() => chooseTrack(tr.value)} className="rf-card"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', marginBottom: 10, cursor: 'pointer', background: 'var(--bg)' }}>
              <span>
                <span style={{ fontSize: 'var(--text-body)', fontWeight: 700, display: 'block' }}>{tr.label}</span>
                <span style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)' }}>{tr.hint}</span>
              </span>
              <span style={{ color: 'var(--ink-2)', fontSize: 'var(--text-heading)' }}>›</span>
            </button>
          ))}
        </>
      )}

      {data?.track && <RiderDetails />}

      {data?.track && data.items.map((item) => {
        const st = STATE[item.status];
        const isBusy = busy === item.type;
        const clickable = !['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(item.status);
        return (
          <div key={item.type} onClick={() => onRowClick(item)} className="rf-card"
            style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: clickable ? 'pointer' : 'default' }}>
            <div style={{ paddingRight: 10 }}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>{item.label}</div>
              {item.rejectionReason && item.status === 'REJECTED' && (
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--danger)', marginTop: 3 }}>{item.rejectionReason}</div>
              )}
              {item.expires && item.expiresAt && (
                <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 3 }}>
                  EXPIRES {new Date(item.expiresAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
            <span className="rf-pill" style={{ background: isBusy ? 'var(--info)' : st.color, color: 'var(--on-dark)', fontSize: 'var(--text-caption)' }}>{isBusy ? 'UPLOADING' : st.text.toUpperCase()}</span>
          </div>
        );
      })}

      <BottomNav />
    </main>
  );
}

// The identity + vehicle details a customer sees once this rider is assigned.
function RiderDetails() {
  const [legalName, setLegalName] = useState('');
  const [plate, setPlate] = useState('');
  const [color, setColor] = useState<VehicleColor | ''>('');
  const [verified, setVerified] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.riderProfile(getToken()).then((p) => {
      setLegalName(p.legalName ?? ''); setPlate(p.vehiclePlate ?? '');
      setColor((p.vehicleColor as VehicleColor) ?? ''); setVerified(p.nameVerified); setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const p = await api.updateRiderProfile(getToken(), {
        ...(legalName.trim() ? { legalName: legalName.trim() } : {}),
        ...(plate.trim() ? { vehiclePlate: plate.trim() } : {}),
        ...(color ? { vehicleColor: color } : {}),
      });
      setVerified(p.nameVerified); setMsg('Saved');
    } catch (e) { setMsg((e as Error).message); } finally { setSaving(false); }
  };

  if (!loaded) return null;

  return (
    <div className="rf-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', letterSpacing: '.06em' }}>YOUR DETAILS (SHOWN TO CUSTOMERS)</span>
        {legalName.trim() && (
          <span className="rf-pill" style={{ background: verified ? 'var(--success)' : 'var(--warning)', color: 'var(--on-dark)', fontSize: 'var(--text-caption)' }}>
            {verified ? 'NAME VERIFIED' : 'PENDING CHECK'}
          </span>
        )}
      </div>
      <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>FULL NAME (AS ON YOUR ID)</label>
      <input className="rf-input" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="e.g. Tolu Olonibua" style={{ marginBottom: 10 }} />
      <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>VEHICLE PLATE NUMBER</label>
      <input className="rf-input" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="e.g. ABC 123 DE" style={{ marginBottom: 10 }} />
      <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>VEHICLE COLOUR</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {VEHICLE_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} className="mono"
            style={{ padding: '6px 12px', borderRadius: 999, fontSize: 'var(--text-caption)', cursor: 'pointer',
              border: `1px solid ${color === c ? 'var(--ink)' : 'var(--line)'}`,
              background: color === c ? 'var(--ink)' : 'var(--bg)', color: color === c ? 'var(--on-dark)' : 'var(--ink-2)' }}>
            {c}
          </button>
        ))}
      </div>
      <button onClick={save} disabled={saving} className="rf-btn" style={{ width: '100%', background: 'var(--ink)', color: 'var(--on-dark)', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving…' : 'Save details'}
      </button>
      {msg && <p style={{ fontSize: 'var(--text-small)', color: msg === 'Saved' ? 'var(--success)' : 'var(--danger)', marginTop: 8, textAlign: 'center' }}>{msg}</p>}
    </div>
  );
}
