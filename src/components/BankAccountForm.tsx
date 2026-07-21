'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getToken } from '@/lib/session';

type Acct = { bankCode: string; accountName: string; accountNumberMasked: string; type: 'refund' | 'payout' };
type Bank = { code: string; name: string };

/**
 * Bank account entry: the user picks their bank by NAME (never a code) and types the account number.
 * The account holder name is resolved from the bank (name enquiry) and shown for confirmation —
 * never typed. Mirrors the mobile BankAccountForm so both platforms behave identically.
 */
export function BankAccountForm({ type, onSaved }: { type: 'refund' | 'payout'; onSaved?: (a: Acct) => void }) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [name, setName] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.banks(getToken()).then(setBanks).catch(() => setErr('Could not load the bank list. Please try again.'));
  }, []);

  const resolve = async (b: string, num: string) => {
    setResolving(true); setErr(null);
    try { const r = await api.resolveAccount(getToken(), { bankCode: b, accountNumber: num }); setName(r.accountName); }
    catch (e) { setName(null); setErr((e as Error).message); }
    finally { setResolving(false); }
  };
  const onBank = (code: string) => { setBankCode(code); setName(null); if (code && accountNumber.length === 10) void resolve(code, accountNumber); };
  const onNumber = (v: string) => { const num = v.replace(/\D/g, '').slice(0, 10); setAccountNumber(num); setName(null); if (num.length === 10 && bankCode) void resolve(bankCode, num); };
  const save = async () => { setSaving(true); try { const a = await api.setAccount(getToken(), { bankCode, accountNumber, type }); onSaved?.(a); } catch (e) { setErr((e as Error).message); } finally { setSaving(false); } };

  return (
    <div>
      <select
        className="rf-input"
        style={{ marginBottom: 8, appearance: 'none', color: bankCode ? 'var(--ink)' : 'var(--mid)' }}
        value={bankCode}
        onChange={(e) => onBank(e.target.value)}
      >
        <option value="" disabled>{banks.length ? 'Select your bank' : 'Loading banks…'}</option>
        {banks.map((b) => <option key={b.code} value={b.code} style={{ color: 'var(--ink)' }}>{b.name}</option>)}
      </select>
      <input className="rf-input" style={{ marginBottom: 8 }} placeholder="Account number (10 digits)" inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e) => onNumber(e.target.value)} />
      {resolving && <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginBottom: 8 }}>CHECKING ACCOUNT…</div>}
      {name && <div style={{ fontSize: 'var(--text-body)', fontWeight: 700, marginBottom: 8 }}>{name}</div>}
      <Button variant="ghost" onClick={save} disabled={!name || saving}>{saving ? 'Saving…' : 'Save account'}</Button>
      {err && <p style={{ color: 'var(--danger)', fontSize: 'var(--text-caption)', margin: '6px 0 0' }}>{err}</p>}
      <div className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', marginTop: 8 }}>NAME CONFIRMED WITH YOUR BANK · STORED ENCRYPTED</div>
    </div>
  );
}
