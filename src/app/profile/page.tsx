'use client';
import { Button } from '@/components/ui/Button';
import { BottomNav } from '@/components/BottomNav';
import { useRequireAuth } from '@/lib/useAuth';
import { clearToken, getUserId, getUserRole } from '@/lib/session';

export default function ProfilePage() {
  const { ready } = useRequireAuth();
  if (!ready) return null;

  const role = getUserRole();
  const id = getUserId();

  const logout = () => {
    // Explicit, user-initiated logout only — sessions otherwise persist indefinitely.
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

      <div className="rf-card" style={{ padding: 0, marginBottom: 16 }}>
        {role === 'RIDER' ? (
          <Row href="/rider" label="Rider dashboard" />
        ) : (
          <Row href="/home" label="Book a delivery" />
        )}
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
