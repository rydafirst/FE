'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/components/ui/Toast';
import { useRequireAuth } from '@/lib/useAuth';
import { clearToken, getToken, getUserId, getUserRole } from '@/lib/session';
import { api } from '@/lib/api';

export default function ProfilePage() {
  const { ready } = useRequireAuth();
  if (!ready) return null;

  const role = getUserRole();
  const id = getUserId();

  const logout = () => {
    clearToken();
    window.location.href = '/';
  };

  return (
    <main style={{ padding: 20, paddingBottom: 96 }}>
      <h1 style={{ fontSize: 22, margin: '4px 0 16px', letterSpacing: '-0.02em' }}>Profile</h1>

      <div className="rf-card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--ink)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }} className="mono">
          {role === 'RIDER' ? 'R' : 'C'}
        </div>
        <div>
          <b style={{ fontSize: 15 }}>{role === 'RIDER' ? 'Rider account' : 'Customer account'}</b>
          <div className="mono" style={{ fontSize: 11, color: 'var(--mid)' }}>ID {id.slice(0, 8) || '—'}…</div>
        </div>
      </div>

      <BankAccountCard role={role} />

      <div className="rf-card" style={{ padding: 0, marginBottom: 16 }}>
        {role === 'RIDER' ? <Row href="/rider" label="Rider dashboard" /> : <Row href="/home" label="Book a delivery" />}
        <Row href="/kyc" label="Verification (KYC)" last />
      </div>

      <div className="rf-card" style={{ marginBottom: 16 }}>
        <p className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', margin: '0 0 6px', letterSpacing: '.06em' }}>SESSION</p>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 12px' }}>
          You stay signed in on this device until you log out here.
        </p>
        <Button variant="ghost" onClick={logout}>Log out</Button>
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
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [busy, setBusy] = useState(false);
  const { show, node: toast } = useToast();

  useEffect(() => {
    api.getAccount(getToken()).then((a) => { setAcct(a); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const a = await api.setAccount(getToken(), { bankCode, accountNumber, accountName, type: isRider ? 'payout' : 'refund' });
      setAcct(a); setEditing(false); setAccountNumber('');
      show('Bank account saved.', 'success');
    } catch (e) { show((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="rf-card" style={{ marginBottom: 16 }}>
      <p className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', margin: '0 0 6px', letterSpacing: '.06em' }}>
        {isRider ? 'PAYOUT ACCOUNT' : 'REFUND ACCOUNT (OPTIONAL)'}
      </p>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45, margin: '0 0 12px' }}>
        {isRider
          ? 'Where your earnings are paid after each completed delivery.'
          : 'Refunds normally go back to your original payment method. Add an account only as a fallback.'}
      </p>

      {!editing && loaded && acct && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{acct.accountName}</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{acct.accountNumberMasked} · bank {acct.bankCode}</div>
          </div>
          <button onClick={() => setEditing(true)} className="mono" style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 11 }}>EDIT</button>
        </div>
      )}

      {!editing && loaded && !acct && (
        <Button variant="ghost" onClick={() => setEditing(true)}>{isRider ? 'Add payout account' : 'Add fallback account'}</Button>
      )}

      {editing && (
        <div>
          <input className="rf-input" style={{ marginBottom: 8 }} placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          <input className="rf-input" style={{ marginBottom: 8 }} placeholder="Account number (10 digits)" inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} />
          <input className="rf-input" style={{ marginBottom: 12 }} placeholder="Bank code (e.g. 044)" inputMode="numeric" value={bankCode} onChange={(e) => setBankCode(e.target.value.replace(/\D/g, ''))} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save account'}</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
          <p className="mono" style={{ fontSize: 10, color: 'var(--mid)', margin: '10px 0 0' }}>STORED ENCRYPTED · ONLY THE LAST 4 DIGITS ARE EVER SHOWN</p>
        </div>
      )}

      {toast}
    </div>
  );
}

function Row({ href, label, last }: { href: string; label: string; last?: boolean }) {
  return (
    <a href={href} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px',
      textDecoration: 'none', color: 'var(--ink)', borderBottom: last ? 'none' : '1px solid var(--line-2)',
    }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <span className="mono" style={{ color: 'var(--mid)' }}>→</span>
    </a>
  );
}
