'use client';
import { useEffect, useState } from 'react';
import { api, type PendingRating } from '@/lib/api';
import { getToken, getUserRole } from '@/lib/session';

// Skippable "rate your rider" prompt shown to a customer after a delivery completes. Returns on the
// next visit until they rate. Mount once on a customer landing page.
export function RatingPrompt() {
  const [pending, setPending] = useState<PendingRating | null>(null);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (getUserRole() !== 'CUSTOMER') return;
    api.pendingRatings(getToken()).then((list) => setPending(list[0] ?? null)).catch(() => {});
  }, []);

  if (!pending) return null;

  const close = () => { setPending(null); setStars(0); setNote(''); };
  const submit = async () => {
    if (stars < 1) return;
    setSaving(true);
    try { await api.rateJob(getToken(), pending.jobId, { stars, ...(note.trim() ? { comment: note.trim() } : {}) }); close(); }
    catch { setSaving(false); }
  };

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg)', width: '100%', maxWidth: 480, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 }}>
        <h3 style={{ margin: 0, fontSize: 'var(--text-subtitle)' }}>How was your delivery?</h3>
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '4px 0 0' }}>
          {pending.riderName ? `Rate ${pending.riderName}` : 'Rate your rider'}{pending.dropoffArea ? ` · to ${pending.dropoffArea}` : ''}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '18px 0' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setStars(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-display)', lineHeight: 1, color: n <= stars ? 'var(--primary)' : 'var(--line)' }}>★</button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" rows={2}
          className="rf-input" style={{ width: '100%', resize: 'none' }} />
        <button onClick={submit} disabled={stars < 1 || saving} className="rf-btn"
          style={{ width: '100%', marginTop: 12, background: 'var(--ink)', color: 'var(--on-dark)', opacity: stars < 1 || saving ? 0.5 : 1 }}>
          {saving ? 'Submitting…' : 'Submit rating'}
        </button>
        <button onClick={close} className="mono" style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', fontSize: 'var(--text-caption)' }}>NOT NOW</button>
      </div>
    </div>
  );
}
