'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getUserRole, isLoggedIn, setToken } from '@/lib/session';

type Role = 'CUSTOMER' | 'RIDER';
type Mode = 'signin' | 'signup';
const RESEND_COOLDOWN = 30; // seconds between code requests (UX guard on top of the server rate limit)

export default function LoginPage() {
  // Already signed in? Skip login and go straight into the app.
  useEffect(() => {
    if (isLoggedIn()) {
      const r = getUserRole();
      window.location.href = r === 'ADMIN' ? '/admin' : r === 'RIDER' ? '/rider' : '/home';
    }
  }, []);

  const [mode, setMode] = useState<Mode>('signin');
  const [phase, setPhase] = useState<'phone' | 'code'>('phone');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const isSignup = mode === 'signup';

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setPhase('phone'); setErr(null); setNote(null); setCode('');
  }

  async function sendOtp() {
    setErr(null); setNote(null);
    // On sign-up we must capture a name so the customer/rider has an identity in the app.
    if (isSignup && name.trim().length < 2) { setErr('Please enter your name'); return; }
    setBusy(true);
    try {
      await api.requestOtp(phone, email, isSignup ? name.trim() : undefined);
      setPhase('code');
      setCooldown(RESEND_COOLDOWN);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function resend() {
    if (cooldown > 0 || busy) return;
    setErr(null); setNote(null); setBusy(true);
    try {
      await api.requestOtp(phone, email, isSignup ? name.trim() : undefined);
      setNote(`New code sent to ${email}`);
      setCooldown(RESEND_COOLDOWN);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function verify() {
    setErr(null); setNote(null); setBusy(true);
    try {
      const t = await api.verifyOtp(phone, code, role);
      setToken(t.accessToken);
      // Route by the *actual* role in the issued token (an allowlisted admin phone is upgraded to
      // ADMIN server-side regardless of the requested role).
      const actual = getUserRole();
      location.href = actual === 'ADMIN' ? '/admin' : actual === 'RIDER' ? '/rider' : '/home';
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <main style={{ padding: 24, display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center' }}>
      <h1 style={{ fontSize: 'var(--text-display)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Ryda</span>
        <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}>first</span>
      </h1>
      <p className="mono" style={{ color: 'var(--ink-2)', letterSpacing: '.06em', marginTop: 0 }}>RIDERS FIRST</p>
      <div style={{ height: 24 }} />

      {/* Sign in vs create a new account */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['signin', 'signup'] as Mode[]).map((m) => (
          <button key={m} onClick={() => switchMode(m)} className="mono"
            style={{ flex: 1, padding: 10, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 'var(--text-caption)', letterSpacing: '.06em',
              border: `1px solid ${mode === m ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--bg)',
              color: mode === m ? 'var(--ink)' : 'var(--mid)' }}>
            {m === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        ))}
      </div>

      {/* Who's signing in — customer or rider */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['CUSTOMER', 'RIDER'] as Role[]).map((r) => (
          <button key={r} onClick={() => setRole(r)} className="mono"
            style={{ flex: 1, padding: 10, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 'var(--text-caption)', letterSpacing: '.06em',
              border: `1px solid ${role === r ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--bg)',
              color: role === r ? 'var(--ink)' : 'var(--mid)' }}>
            {r === 'CUSTOMER' ? 'I NEED A DELIVERY' : 'I AM A RIDER'}
          </button>
        ))}
      </div>

      {phase === 'phone' ? (
        <>
          {isSignup && (
            <>
              <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>FULL NAME</label>
              <input className="rf-input" style={{ margin: '8px 0 16px' }} value={name}
                onChange={(e) => setName(e.target.value)} placeholder="e.g. Chidi Okafor" autoComplete="name" />
            </>
          )}
          <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>PHONE NUMBER</label>
          <input className="rf-input" style={{ margin: '8px 0 16px' }} value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="+234…" inputMode="tel" autoComplete="tel" />
          <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>EMAIL</label>
          <input className="rf-input" style={{ margin: '8px 0 6px' }} value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" type="email" autoComplete="email" />
          <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', margin: '0 0 16px' }}>
            WE&apos;LL EMAIL YOUR CODE FOR NOW
          </p>
          <Button onClick={sendOtp} disabled={busy}>{busy ? 'Sending…' : isSignup ? 'Create account' : 'Send code'}</Button>

          {isSignup && (
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', lineHeight: 1.5, margin: '14px 0 0', textAlign: 'center' }}>
              By creating an account you agree to our{' '}
              <Link href="/terms" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>Terms of Use</Link>{' '}
              and{' '}
              <Link href="/privacy" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>Privacy Policy</Link>.
            </p>
          )}
        </>
      ) : (
        <>
          <label className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)' }}>ENTER 6-DIGIT CODE</label>
          <input className="rf-input mono" style={{ margin: '8px 0 10px', letterSpacing: '.4em', textAlign: 'center', fontSize: 'var(--text-heading)' }}
            value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} inputMode="numeric" autoFocus />

          {/* Didn't get it? Resend, gated by a short cooldown. */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)' }}>SENT TO {email.toUpperCase()}</span>
            <button onClick={resend} disabled={cooldown > 0 || busy} className="mono"
              style={{ background: 'none', border: 'none', padding: 4, cursor: cooldown > 0 || busy ? 'default' : 'pointer',
                fontSize: 'var(--text-caption)', letterSpacing: '.06em', color: cooldown > 0 || busy ? 'var(--mid)' : 'var(--ink)' }}>
              {cooldown > 0 ? `RESEND IN ${cooldown}S` : 'RESEND CODE'}
            </button>
          </div>

          <Button onClick={verify} disabled={busy}>{busy ? 'Working…' : `Verify as ${role === 'RIDER' ? 'rider' : 'customer'}`}</Button>

          <button onClick={() => { setPhase('phone'); setCode(''); setErr(null); setNote(null); }} className="mono"
            style={{ background: 'none', border: 'none', marginTop: 12, cursor: 'pointer', fontSize: 'var(--text-caption)', letterSpacing: '.06em', color: 'var(--ink-2)' }}>
            ← USE A DIFFERENT EMAIL
          </button>
        </>
      )}

      {note && <p style={{ color: 'var(--success)', fontSize: 'var(--text-small)', marginBottom: 0 }}>{note}</p>}
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-small)', marginBottom: 0 }}>{err}</p>}
    </main>
  );
}
