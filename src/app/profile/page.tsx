'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { BottomNav } from '@/components/BottomNav';
import { BankAccountForm } from '@/components/BankAccountForm';
import { useRequireAuth } from '@/lib/useAuth';
import { clearToken, getToken, getUserRole } from '@/lib/session';
import { api } from '@/lib/api';

export default function ProfilePage() {
  const { ready } = useRequireAuth();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Declared with the other hooks — NOT after the `if (!ready) return null` below. A hook placed
  // after that early return runs only once auth resolves, so React sees the hook count jump between
  // renders and throws #300 ("rendered more hooks than during the previous render"), white-screening
  // the page. This is the crash testers hit on every profile open.
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ready) api.myAvatar(getToken()).then((a) => setPhotoUrl(a.photoUrl)).catch(() => {}); }, [ready]);
  useEffect(() => { if (ready) api.me(getToken()).then((m) => setPhone(m.phone)).catch(() => {}); }, [ready]);
  if (!ready) return null;

  const role = getUserRole();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { if (fileRef.current) fileRef.current.value = ''; return; }
    setUploading(true);
    try {
      const { uploadUrl } = await api.avatarUploadUrl(getToken(), f.type, f.size);
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': f.type }, body: f });
      if (!put.ok) throw new Error('Upload failed');
      const a = await api.myAvatar(getToken());
      setPhotoUrl(a.photoUrl);
    } catch { /* surfaced by retry */ } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const logout = () => {
    clearToken();
    window.location.href = '/';
  };

  const deleteAccount = async () => {
    if (deleting) return;
    if (!window.confirm('Delete your account? This erases your name, email and photo and signs you out everywhere. This cannot be undone. (Records required by law are kept, without identifying you.)')) return;
    setDeleting(true);
    try {
      await api.deleteAccount(getToken());
      clearToken();
      window.location.href = '/';
    } catch { setDeleting(false); }
  };

  return (
    <main style={{ padding: 20, paddingBottom: 96 }}>
      <h1 style={{ fontSize: 'var(--text-heading)', margin: '4px 0 16px', letterSpacing: '-0.02em' }}>Profile</h1>

      <div className="rf-card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" onClick={() => fileRef.current?.click()} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', background: 'var(--bg-2)', cursor: 'pointer' }} />
        ) : (
          <div onClick={() => fileRef.current?.click()} style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--ink)', color: 'var(--on-dark)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, cursor: 'pointer' }} className="mono">
            {role === 'RIDER' ? 'R' : 'C'}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 'var(--text-body)' }}>{role === 'RIDER' ? 'Rider account' : 'Customer account'}</b>
          <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>{phone || '—'}</div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="mono"
            style={{ background: 'none', border: 'none', padding: '4px 0 0', cursor: 'pointer', fontSize: 'var(--text-caption)', letterSpacing: '.06em', color: 'var(--ink)' }}>
            {uploading ? 'UPLOADING…' : photoUrl ? 'CHANGE PHOTO →' : 'ADD A PHOTO →'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} style={{ display: 'none' }} />
      </div>

      <BankAccountCard role={role} />

      <div className="rf-card" style={{ padding: 0, marginBottom: 16 }}>
        {role === 'RIDER'
          ? <><Row href="/rider" label="Rider dashboard" /><Row href="/documents" label="Documents & verification" last /></>
          : <Row href="/home" label="Book a delivery" last />}
      </div>

      <div className="rf-card" style={{ marginBottom: 16 }}>
        <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', margin: '0 0 6px', letterSpacing: '.06em' }}>SESSION</p>
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '0 0 12px' }}>
          You stay signed in on this device until you log out here.
        </p>
        <Button variant="ghost" onClick={logout}>Log out</Button>
      </div>

      <div className="rf-card" style={{ marginBottom: 16, borderColor: 'var(--danger)' }}>
        <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--danger)', margin: '0 0 6px', letterSpacing: '.06em' }}>DELETE ACCOUNT</p>
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', margin: '0 0 12px', lineHeight: 1.45 }}>
          Permanently erase your personal data (name, email, photo) and sign out everywhere. Records the
          law requires us to keep are retained without identifying you.{' '}
          <a href="/delete-account" style={{ color: 'var(--ink)' }}>Learn more</a>.
        </p>
        <button onClick={deleteAccount} disabled={deleting}
          style={{ background: 'var(--danger)', color: 'var(--on-dark)', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: deleting ? 'default' : 'pointer', fontSize: 'var(--text-body)', fontWeight: 600 }}>
          {deleting ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>

      <BottomNav />
    </main>
  );
}

// Manage the user's bank account. For riders it's the payout destination; for customers an
// optional fallback refund account (refunds otherwise go back to the original payment method).
function BankAccountCard({ role }: { role: 'CUSTOMER' | 'RIDER' | 'ADMIN' }) {
  const isRider = role === 'RIDER';
  const [acct, setAcct] = useState<{ bankCode: string; accountName: string; accountNumberMasked: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api.getAccount(getToken()).then((a) => { setAcct(a); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  return (
    <div className="rf-card" style={{ marginBottom: 16 }}>
      <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', margin: '0 0 6px', letterSpacing: '.06em' }}>
        {isRider ? 'PAYOUT ACCOUNT' : 'REFUND ACCOUNT (OPTIONAL)'}
      </p>
      <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-2)', lineHeight: 1.45, margin: '0 0 12px' }}>
        {isRider
          ? 'Where your earnings are paid after each completed delivery.'
          : 'Refunds normally go back to your original payment method. Add an account only as a fallback.'}
      </p>

      {!editing && loaded && acct && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>{acct.accountName}</div>
            <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>{acct.accountNumberMasked} · bank {acct.bankCode}</div>
          </div>
          <button onClick={() => setEditing(true)} className="mono" style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 'var(--text-caption)' }}>EDIT</button>
        </div>
      )}

      {!editing && loaded && !acct && (
        <Button variant="ghost" onClick={() => setEditing(true)}>{isRider ? 'Add payout account' : 'Add fallback account'}</Button>
      )}

      {editing && (
        <div>
          <BankAccountForm type={isRider ? 'payout' : 'refund'} onSaved={(a) => { setAcct(a); setEditing(false); }} />
          <button onClick={() => setEditing(false)} className="mono" style={{ background: 'none', border: 'none', padding: '10px 0 0', cursor: 'pointer', fontSize: 'var(--text-caption)', letterSpacing: '.06em', color: 'var(--ink-2)' }}>CANCEL</button>
        </div>
      )}
    </div>
  );
}

function Row({ href, label, last }: { href: string; label: string; last?: boolean }) {
  return (
    <a href={href} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px',
      textDecoration: 'none', color: 'var(--ink)', borderBottom: last ? 'none' : '1px solid var(--line-2)',
    }}>
      <span style={{ fontSize: 'var(--text-body)' }}>{label}</span>
      <span className="mono" style={{ color: 'var(--mid)' }}>→</span>
    </a>
  );
}
