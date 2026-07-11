'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

type Role = 'CUSTOMER' | 'RIDER';

export default function LoginPage() {
  const [phase, setPhase] = useState<'phone' | 'code'>('phone');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function sendOtp() {
    setErr(null);
    try { await api.requestOtp(phone, email); setPhase('code'); }
    catch (e) { setErr((e as Error).message); }
  }
  async function verify() {
    setErr(null);
    try {
      const t = await api.verifyOtp(phone, code, role);
      sessionStorage.setItem('rf_token', t.accessToken);
      location.href = role === 'RIDER' ? '/rider' : '/home';
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <main style={{ padding: 24, display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center' }}>
      <h1 style={{ fontSize: 32, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Ryda</span>
        <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}>first</span>
      </h1>
      <p className="mono" style={{ color: 'var(--ink-2)', letterSpacing: '.06em', marginTop: 0 }}>RIDERS FIRST</p>
      <div style={{ height: 24 }} />

      {/* Who's signing in — customer or rider */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['CUSTOMER', 'RIDER'] as Role[]).map((r) => (
          <button key={r} onClick={() => setRole(r)} className="mono"
            style={{ flex: 1, padding: 10, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12, letterSpacing: '.06em',
              border: `1px solid ${role === r ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--bg)',
              color: role === r ? 'var(--ink)' : 'var(--mid)' }}>
            {r === 'CUSTOMER' ? 'I NEED A DELIVERY' : 'I AM A RIDER'}
          </button>
        ))}
      </div>

      {phase === 'phone' ? (
        <>
          <label className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>PHONE NUMBER</label>
          <input className="rf-input" style={{ margin: '8px 0 16px' }} value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="+234…" inputMode="tel" />
          <label className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>EMAIL</label>
          <input className="rf-input" style={{ margin: '8px 0 6px' }} value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" type="email" />
          <p className="mono" style={{ fontSize: 10, color: 'var(--mid)', margin: '0 0 16px' }}>
            WE&apos;LL EMAIL YOUR CODE FOR NOW
          </p>
          <Button onClick={sendOtp}>Send code</Button>
        </>
      ) : (
        <>
          <label className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>ENTER 6-DIGIT CODE</label>
          <input className="rf-input mono" style={{ margin: '8px 0 16px', letterSpacing: '.4em', textAlign: 'center', fontSize: 22 }}
            value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} inputMode="numeric" />
          <Button onClick={verify}>Verify as {role === 'RIDER' ? 'rider' : 'customer'}</Button>
        </>
      )}
      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
    </main>
  );
}
