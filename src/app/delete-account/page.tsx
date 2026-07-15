import Link from 'next/link';

export const metadata = { title: 'Delete your account — Rydafirst' };

// Public account-deletion instructions. Hosted at /delete-account so it can be used as the
// Google Play "Delete account URL" (Data safety). Must be reachable without signing in.
export default function DeleteAccountPage() {
  return (
    <main style={{ padding: 24, lineHeight: 1.6, color: 'var(--ink)' }}>
      <Link href="/" className="mono" style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-2)' }}>← HOME</Link>
      <h1 style={{ fontSize: 26, margin: '16px 0 4px' }}>Delete your Rydafirst account</h1>
      <p className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', margin: 0 }}>LAST UPDATED 15 JULY 2026</p>

      <h2 style={{ fontSize: 17, marginTop: 24 }}>Delete it in the app</h2>
      <p>The fastest way is inside the app: open <b>Profile → Delete my account</b> and confirm. Your
        account is closed immediately and you are signed out on every device.</p>

      <h2 style={{ fontSize: 17, marginTop: 20 }}>Or request it by email</h2>
      <p>If you can&apos;t access the app, email{' '}
        <a href="mailto:support@rydafirst.com?subject=Delete%20my%20account" style={{ color: 'var(--ink)' }}>support@rydafirst.com</a>{' '}
        from the address on your account, with the subject &ldquo;Delete my account&rdquo;. We action
        verified requests within 30 days.</p>

      <h2 style={{ fontSize: 17, marginTop: 20 }}>What is deleted</h2>
      <p>We erase the personal data that identifies you — your name, email address, profile photo — and
        release your phone number so it can be registered again. You are signed out everywhere.</p>

      <h2 style={{ fontSize: 17, marginTop: 20 }}>What is kept, and for how long</h2>
      <p>Records we are legally required to retain — for example transaction and payment records needed
        for tax, accounting and fraud-prevention obligations — are kept for the period required by law
        and then deleted. These retained records are anonymised so they no longer identify you. Rider
        verification documents are kept only for the period applicable regulations require.</p>

      <h2 style={{ fontSize: 17, marginTop: 20 }}>Questions</h2>
      <p>Contact <a href="mailto:privacy@rydafirst.com" style={{ color: 'var(--ink)' }}>privacy@rydafirst.com</a>.
        See also our <Link href="/privacy" style={{ color: 'var(--ink)' }}>Privacy Policy</Link>.</p>
    </main>
  );
}
