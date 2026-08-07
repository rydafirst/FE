import Link from 'next/link';

export const metadata = {
  title: 'About — Rydafirst',
  description: 'Rydafirst is a rider-first, escrow-backed delivery company in Nigeria.',
};

// Responsive (mobile + desktop) About page. Breaks out of the app's 480px shell and centres a
// readable column, like the legal pages.
export default function AboutPage() {
  return (
    <main style={{ minHeight: '100vh', width: '100vw', position: 'relative', left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw', background: 'var(--bg)' }}>
     <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 22px 56px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <b style={{ fontSize: 'var(--text-subtitle)', letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--ink)' }}>Ryda</span>
          <span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>first</span>
        </b>
        <Link href="/" className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', textDecoration: 'none', letterSpacing: '.06em' }}>
          ← HOME
        </Link>
      </header>

      <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--primary)', letterSpacing: '.14em', margin: 0 }}>
        ABOUT RYDAFIRST
      </p>
      <h1 style={{ fontSize: 'var(--text-title)', lineHeight: 1.2, letterSpacing: '-0.03em', margin: '6px 0 4px' }}>
        We are for riders.
      </h1>
      <p style={{ fontSize: 'var(--text-body)', color: 'var(--ink-2)', lineHeight: 1.6, margin: '10px 0 24px', maxWidth: '46em' }}>
        Rydafirst Limited is a rider-first, guaranteed-payment delivery company built for Nigeria —
        starting in Lagos and expanding across the country.
      </p>

      <Section title="Why we exist">
        In Nigeria, delivery runs on a broken kind of trust. Riders finish a job and are told
        &ldquo;I&rsquo;ll pay you later&rdquo; — then chased away. Customers are afraid to prepay a
        stranger who might vanish with the package. Someone always holds the upper hand. Rydafirst
        removes that standoff: the payment is guaranteed by the system, not by trust.
      </Section>

      <Section title="How it works">
        The customer pays upfront into <B>escrow</B> held by a licensed Nigerian payment provider — we
        do not hold customer funds ourselves. The money is released to the rider only once the delivery
        is confirmed by the recipient, and auto-refunded to the customer if the delivery fails. Every
        trip is tracked live from pickup to hand-off, with a fixed, upfront price.
      </Section>

      <Section title="What we do">
        Rydafirst provides technology-enabled logistics, courier and last-mile delivery services. We
        match customers who need something delivered with verified independent riders nearby, and make
        sure both sides are protected — the customer&rsquo;s money and the rider&rsquo;s pay.
      </Section>

      <Section title="Who it’s for">
        Individuals sending personal items, small and medium businesses, online vendors and e-commerce
        sellers, and food and retail merchants who need reliable dispatch. We launch in Lagos, with a
        planned rollout to Abuja, Port Harcourt and other major Nigerian cities as the rider network
        grows.
      </Section>

      <Section title="Contact us">
        <p style={{ margin: '0 0 10px' }}>Rydafirst Limited</p>
        <p style={{ margin: '0 0 10px', color: 'var(--ink)' }}>
          138 Unity Zone 6, Olorunsogo, Ado Ekiti, Ekiti State, Nigeria<br />
          <a href="tel:+2348149249926" style={{ color: 'var(--primary)', textDecoration: 'none' }}>+234 814 924 9926</a>
        </p>
      </Section>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
        <Link href="/privacy" className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', textDecoration: 'none', letterSpacing: '.06em' }}>PRIVACY →</Link>
        <Link href="/terms" className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-2)', textDecoration: 'none', letterSpacing: '.06em' }}>TERMS →</Link>
      </div>

      <p className="mono" style={{ fontSize: 'var(--text-caption)', color: 'var(--mid)', letterSpacing: '.05em', marginTop: 32 }}>
        © 2026 RYDAFIRST LIMITED. ALL RIGHTS RESERVED.
      </p>
     </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 'var(--text-subtitle)', letterSpacing: '-0.01em', margin: '0 0 8px' }}>{title}</h2>
      <div style={{ fontSize: 'var(--text-body)', lineHeight: 1.6, color: 'var(--ink-2)' }}>{children}</div>
    </section>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{children}</b>;
}
