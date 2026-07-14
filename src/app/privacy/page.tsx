import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Rydafirst',
  description: 'How Rydafirst collects, uses, and protects your data.',
};

// Static privacy policy. Hosted at /privacy so it can be used as the
// App Store / Play Store "Privacy Policy URL". Plain prose, monochrome.
export default function PrivacyPolicy() {
  return (
    <main style={{ minHeight: '100vh', padding: '28px 22px 56px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <b style={{ fontSize: 18, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--ink)' }}>Ryda</span>
          <span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>first</span>
        </b>
        <Link href="/" className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', textDecoration: 'none', letterSpacing: '.06em' }}>
          ← HOME
        </Link>
      </header>

      <p className="mono" style={{ fontSize: 11, color: 'var(--primary)', letterSpacing: '.14em', margin: 0 }}>
        PRIVACY POLICY
      </p>
      <h1 style={{ fontSize: 26, lineHeight: 1.2, letterSpacing: '-0.03em', margin: '6px 0 4px' }}>
        Your data, handled with care.
      </h1>
      <p className="mono" style={{ fontSize: 11, color: 'var(--mid)', letterSpacing: '.05em', margin: '0 0 24px' }}>
        LAST UPDATED: JULY 2026
      </p>

      <Section title="Who we are">
        Rydafirst (“Rydafirst”, “we”, “us”) operates a rider-first delivery platform in Nigeria that
        connects customers who need items delivered with independent riders, and holds payment in escrow
        until a delivery is confirmed. This policy explains what personal data we collect, why we collect
        it, how we use and share it, and the choices you have.
      </Section>

      <Section title="Information we collect">
        <P><B>Account &amp; contact details.</B> Your name, phone number, and (if you provide it) email address,
        collected when you create an account and sign in with a one-time passcode.</P>
        <P><B>Location.</B> Pickup and drop-off addresses you enter, and — while a delivery is active — the
        live location used to match riders and let you track the trip from pickup to hand-off.</P>
        <P><B>Payment &amp; refund details.</B> Payments are processed by our payment provider (Flutterwave).
        We do not store your full card details on our servers. If you request a refund, we collect the bank
        account details you provide to send it.</P>
        <P><B>Rider verification data.</B> If you sign up as a rider, we collect the identity and vehicle
        documents required to verify you — such as a government-issued ID, driver’s licence, vehicle
        registration and, where applicable, guarantor details — along with the details you enter (legal
        name, vehicle type, plate, colour).</P>
        <P><B>Device &amp; notification data.</B> A push-notification token and basic device information so we
        can send you delivery updates.</P>
        <P><B>Support &amp; dispute information.</B> Messages, delivery codes, and any details you share when you
        contact us or raise a dispute.</P>
      </Section>

      <Section title="How we use your information">
        We use your information to create and secure your account; to quote, match, and complete deliveries;
        to hold and release escrow payments and process refunds; to verify riders and keep the platform safe;
        to send you delivery and account notifications; to resolve disputes and provide customer support; and
        to comply with our legal and regulatory obligations.
      </Section>

      <Section title="How we share your information">
        <P><B>With riders and customers.</B> To complete a delivery, we share the information both sides need —
        for example a customer’s pickup/drop-off area and the rider’s name, vehicle, and live location.</P>
        <P><B>With service providers.</B> We share data with vendors who help us operate: our payment processor
        (Flutterwave), SMS and email providers (for one-time passcodes and notifications), and secure cloud
        storage for verification documents. They may only use the data to provide their service to us.</P>
        <P><B>For legal and safety reasons.</B> We may disclose information where required by law, to enforce our
        terms, or to protect the rights, property, or safety of our users and the public.</P>
        <P>We do <B>not</B> sell your personal data, and we do <B>not</B> use it to track you across other
        companies’ apps or websites for advertising.</P>
      </Section>

      <Section title="Data retention">
        We keep personal data only for as long as needed to provide the service, meet legal, tax, and
        regulatory requirements, resolve disputes, and enforce our agreements. Rider verification documents
        are retained for the period required by applicable regulations. When data is no longer needed, we
        delete or anonymise it.
      </Section>

      <Section title="Security">
        We protect your data using encryption in transit, access controls, private document storage, and
        constant-time verification on sensitive operations. No system is perfectly secure, but we work to
        safeguard your information and to limit access to those who need it.
      </Section>

      <Section title="Your rights &amp; choices">
        You can access or update your profile in the app, and you can request that we correct or delete your
        personal data by contacting us. You may control push notifications from your device settings. Some
        data must be retained where we are legally required to keep it.
      </Section>

      <Section title="Children">
        Rydafirst is not intended for anyone under 18. We do not knowingly collect personal data from
        children. If you believe a child has provided us data, contact us and we will remove it.
      </Section>

      <Section title="Changes to this policy">
        We may update this policy from time to time. When we make material changes, we will update the “Last
        updated” date above and, where appropriate, notify you in the app.
      </Section>

      <Section title="Contact us">
        Questions about this policy or your data? Email us at{' '}
        <a href="mailto:privacy@rydafirst.com" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
          privacy@rydafirst.com
        </a>.
      </Section>

      <p className="mono" style={{ fontSize: 10.5, color: 'var(--mid)', letterSpacing: '.05em', marginTop: 32 }}>
        © 2026 RYDAFIRST. ALL RIGHTS RESERVED.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 16, letterSpacing: '-0.01em', margin: '0 0 8px' }}>{title}</h2>
      <div style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 10px' }}>{children}</p>;
}

function B({ children }: { children: React.ReactNode }) {
  return <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{children}</b>;
}
