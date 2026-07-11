import Link from 'next/link';

// Landing page. Sits in front of login so first-time visitors get context, not a bare OTP box.
export default function Landing() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b style={{ fontSize: 20, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--ink)' }}>Ryda</span><span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>first</span>
        </b>
        <Link href="/login" className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', textDecoration: 'none', letterSpacing: '.06em' }}>
          SIGN IN →
        </Link>
      </header>

      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
        <CourierIllustration />

        <p className="mono" style={{ fontSize: 11, color: 'var(--primary)', letterSpacing: '.14em', margin: '20px 0 0' }}>
          WE ARE FOR RIDERS
        </p>
        <h1 style={{ fontSize: 30, lineHeight: 1.15, letterSpacing: '-0.03em', margin: '4px 0 0' }}>
          Send anything across town, paid only on delivery.
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.5, margin: '10px 0 0' }}>
          Your money is held safely in escrow and released to the rider the moment your delivery is
          confirmed — so no one can be cheated. Track every trip live, from pickup to your door.
        </p>
      </section>

      <footer style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        <Link href="/login" style={{ textDecoration: 'none' }}>
          <button className="rf-btn">Get started</button>
        </Link>
        <Link href="/login" className="mono"
          style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink)', textDecoration: 'none', letterSpacing: '.06em', padding: '4px 0' }}>
          I WANT TO RIDE &amp; EARN →
        </Link>
      </footer>
    </main>
  );
}

// Minimal monochrome courier illustration. The single orange accent (the parcel) ties to the CTA.
function CourierIllustration() {
  const ink = 'var(--ink)';
  return (
    <svg viewBox="0 0 400 240" width="100%" style={{ maxHeight: 220, display: 'block' }} role="img" aria-label="A rider delivering a parcel">
      {/* ground */}
      <line x1="20" y1="212" x2="380" y2="212" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
      {/* motion lines */}
      <g stroke="var(--mid)" strokeWidth="3" strokeLinecap="round">
        <line x1="18" y1="150" x2="60" y2="150" />
        <line x1="8" y1="172" x2="46" y2="172" />
        <line x1="24" y1="194" x2="58" y2="194" />
      </g>

      {/* wheels */}
      <g fill="none" stroke={ink} strokeWidth="9">
        <circle cx="128" cy="184" r="30" />
        <circle cx="300" cy="184" r="30" />
      </g>
      <g fill={ink}>
        <circle cx="128" cy="184" r="6" />
        <circle cx="300" cy="184" r="6" />
      </g>

      {/* bike frame + deck */}
      <g fill="none" stroke={ink} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M128 184 L188 150 L262 150" />
        <path d="M300 184 L262 150" />
        <path d="M262 150 L288 120" />
        <path d="M188 150 L172 120" />
      </g>
      {/* handlebar */}
      <line x1="288" y1="120" x2="308" y2="112" stroke={ink} strokeWidth="9" strokeLinecap="round" />

      {/* parcel on the rear rack — the one orange accent */}
      <g transform="rotate(-4 120 120)">
        <rect x="86" y="96" width="70" height="54" rx="6" fill="var(--primary)" />
        <line x1="121" y1="96" x2="121" y2="150" stroke="var(--primary-ink)" strokeWidth="3" opacity="0.7" />
        <line x1="86" y1="123" x2="156" y2="123" stroke="var(--primary-ink)" strokeWidth="3" opacity="0.7" />
      </g>

      {/* rider: torso + arm to bars, and helmet */}
      <g fill="none" stroke={ink} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M196 128 L214 92" />
        <path d="M214 96 L300 112" />
        <path d="M196 128 L188 150" />
      </g>
      {/* helmet */}
      <circle cx="222" cy="74" r="20" fill={ink} />
      <path d="M204 78 h30" stroke="var(--bg)" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
