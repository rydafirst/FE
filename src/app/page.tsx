'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/**
 * Rydafirst public homepage.
 *
 * Design system first: type is Space Grotesk / Space Mono, colour is our token palette, and orange
 * (--primary) appears only on the primary action + live states — the monochrome-first rule the whole
 * product follows. The ONLY thing taken from the brand flyer is its warm paper texture and the
 * cream/black/orange pairing (see --paper in globals.css); none of the flyer's own type is used.
 *
 * It breaks out of the app's 480px mobile shell (the product lives at that width; the marketing site
 * is full-bleed) and links visitors into the product.
 */
export default function Home() {
  const revealRoot = useRef<HTMLDivElement>(null);

  // Gentle scroll-reveal for anything tagged data-reveal. Progressive enhancement — if the observer
  // never runs, the content is simply already visible (opacity handled by the .is-in default).
  useEffect(() => {
    const els = revealRoot.current?.querySelectorAll('[data-reveal]');
    if (!els?.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }),
      { threshold: 0.18 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="mkt-root" ref={revealRoot}>
      <style>{CSS}</style>
      <div className="mkt-grain" aria-hidden />

      {/* ---------------- Nav ---------------- */}
      <header className="mkt-nav">
        <Link href="/" className="mkt-brand" aria-label="Rydafirst home">
          ryd<span className="mkt-brand-y">a</span><span className="mkt-brand-first">first</span>
        </Link>
        <nav className="mkt-nav-links">
          <a href="#how">How it works</a>
          <a href="#trust">Why escrow</a>
          <a href="#riders">For riders</a>
        </nav>
        <Link href="/login" className="mkt-nav-cta">Open app</Link>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="mkt-hero">
        <div className="mkt-hero-copy">
          <p className="mkt-eyebrow up-1">GUARANTEED-PAYMENT DELIVERY · NIGERIA</p>
          <h1 className="mkt-h1 up-2">
            Send it, track it,<br />pay only <span className="mkt-accent">when it lands.</span>
          </h1>
          <p className="mkt-sub up-3">
            Your money is held in secure escrow and released to the rider the moment your delivery is
            confirmed — so senders never prepay into a void, and riders are never cheated after doing
            the work. Track every trip live, pickup to door.
          </p>

          <div className="mkt-cta-row up-4">
            <Link href="/login" className="mkt-btn mkt-btn--primary">Send a delivery</Link>
            <Link href="/login" className="mkt-btn mkt-btn--ghost">Ride &amp; earn →</Link>
          </div>

          <ul className="mkt-chips up-5" aria-label="What you get">
            <li><span className="mkt-dot" /> Escrow-protected</li>
            <li><span className="mkt-dot" /> Live GPS tracking</li>
            <li><span className="mkt-dot" /> Paid on delivery</li>
          </ul>
        </div>

        <div className="mkt-hero-art up-3" aria-hidden>
          <TrackingArt />
        </div>
      </section>

      {/* ---------------- Trust / the "why" ---------------- */}
      <section className="mkt-why" id="trust">
        <div className="mkt-why-inner" data-reveal>
          <p className="mkt-eyebrow" style={{ color: 'var(--primary)' }}>WHY WE BUILT THIS</p>
          <p className="mkt-why-lead">
            A rider finishes the job — then hears <span className="mkt-quote">“I&apos;ll pay you later.”</span>
            {' '}A sender is asked to prepay a stranger and fears the parcel just disappears. Someone always
            holds the upper hand. Rydafirst removes the standoff: the money is guaranteed by the system,
            not by trust.
          </p>
          <div className="mkt-why-grid">
            {WHY.map((w) => (
              <div className="mkt-why-card" key={w.t} data-reveal>
                <div className="mkt-why-ic">{w.icon}</div>
                <h3>{w.t}</h3>
                <p>{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Closing band ---------------- */}
      <section className="mkt-band" id="riders" data-reveal>
        <div>
          <h2 className="mkt-band-h">Built rider-first.</h2>
          <p className="mkt-band-sub">Every other platform treats the rider as replaceable. Here, your payment is guaranteed by design.</p>
        </div>
        <div className="mkt-band-cta">
          <Link href="/login" className="mkt-btn mkt-btn--primary">Send a delivery</Link>
          <Link href="/login" className="mkt-btn mkt-btn--dark">Become a rider</Link>
        </div>
      </section>

      <footer className="mkt-foot">
        <span className="mkt-brand" style={{ fontSize: 20 }}>ryd<span className="mkt-brand-y">a</span><span className="mkt-brand-first">first</span></span>
        <span className="mkt-foot-tag">WE ARE FOR RIDERS</span>
        <span className="mkt-foot-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/login">Open app</Link>
        </span>
      </footer>
    </div>
  );
}

const WHY = [
  { t: 'Held in escrow', d: 'The fare is locked with a licensed provider the second you pay — nobody can touch it mid-trip.', icon: <ShieldIcon /> },
  { t: 'Released on proof', d: 'A recipient code + GPS-verified arrival releases the money. No code, no release — no argument.', icon: <CheckIcon /> },
  { t: 'Auto-refunded on failure', d: 'If a delivery fails, the money returns to your account automatically. The system decides, not a stranger.', icon: <RefundIcon /> },
];

/* ============================ Hero artwork ============================ */
/* A live-tracking card + floating escrow badge, in our flat monochrome-with-one-orange style.
   Echoes the flyer's map + shield motifs without reusing its illustration. The route flows and a
   courier dot travels it — the "smooth web animation" on the page. */
function TrackingArt() {
  return (
    <div className="mkt-art-wrap">
      <svg viewBox="0 0 420 380" width="100%" role="img" aria-label="Live delivery tracking">
        <defs>
          <clipPath id="cardClip"><rect x="40" y="30" width="300" height="300" rx="22" /></clipPath>
        </defs>

        {/* tracking card */}
        <rect x="40" y="30" width="300" height="300" rx="22" fill="var(--bg)" stroke="var(--line)" strokeWidth="2" />
        <g clipPath="url(#cardClip)">
          {/* faint street grid */}
          <g stroke="var(--line-2)" strokeWidth="6">
            <line x1="40" y1="96" x2="340" y2="96" /><line x1="40" y1="170" x2="340" y2="170" />
            <line x1="40" y1="244" x2="340" y2="244" /><line x1="120" y1="30" x2="120" y2="330" />
            <line x1="212" y1="30" x2="212" y2="330" /><line x1="286" y1="30" x2="286" y2="330" />
          </g>
          {/* the route */}
          <path id="route" d="M96 262 C 150 250, 150 150, 210 150 S 300 120, 300 92"
            fill="none" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round"
            strokeDasharray="10 12" className="mkt-route" />
          {/* travelling courier dot */}
          <circle r="7" fill="var(--ink)" stroke="var(--bg)" strokeWidth="3">
            <animateMotion dur="4.2s" repeatCount="indefinite" rotate="auto"
              keyPoints="0;1" keyTimes="0;1" calcMode="linear"
              path="M96 262 C 150 250, 150 150, 210 150 S 300 120, 300 92" />
          </circle>
        </g>

        {/* pickup pin (orange, live) */}
        <g transform="translate(96 262)">
          <circle className="mkt-ping" r="16" fill="var(--primary)" opacity="0.18" />
          <circle r="7" fill="var(--primary)" stroke="var(--bg)" strokeWidth="3" />
        </g>
        {/* drop pin (ink) */}
        <g transform="translate(300 92)">
          <path d="M0 -18 C 10 -18 16 -10 16 -2 C 16 8 0 20 0 20 C 0 20 -16 8 -16 -2 C -16 -10 -10 -18 0 -18 Z"
            fill="var(--ink)" stroke="var(--bg)" strokeWidth="2" />
          <circle cx="0" cy="-2" r="5" fill="var(--bg)" />
        </g>

        {/* ETA chip */}
        <g className="mkt-float">
          <rect x="60" y="286" width="150" height="34" rx="17" fill="var(--ink)" />
          <circle cx="80" cy="303" r="4" fill="var(--primary)" className="rf-pulse" />
          <text x="94" y="308" fill="var(--on-dark)" fontFamily="var(--font-mono)" fontSize="13" letterSpacing="0.5">4.8 KM · 7 MIN</text>
        </g>

        {/* floating escrow badge */}
        <g className="mkt-float-2" transform="translate(300 250)">
          <rect x="-70" y="-34" width="150" height="74" rx="16" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="2" />
          <g transform="translate(-44 3)">
            <path d="M0 -20 L20 -12 V2 C20 16 10 24 0 28 C-10 24 -20 16 -20 2 V-12 Z" fill="var(--ink)" />
            <path d="M-8 2 l6 7 l11 -14" fill="none" stroke="var(--success)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <text x="-14" y="-4" fill="var(--ink)" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700" letterSpacing="0.5">ESCROW</text>
          <text x="-14" y="14" fill="var(--ink-2)" fontFamily="var(--font-sans)" fontSize="13" fontWeight="600">Held safe</text>
        </g>
      </svg>
    </div>
  );
}

function ShieldIcon() {
  return (<svg viewBox="0 0 24 24" width="26" height="26" fill="none"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" fill="var(--ink)" /><path d="M8.5 12l2.3 2.5L15.5 9" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function CheckIcon() {
  return (<svg viewBox="0 0 24 24" width="26" height="26" fill="none"><circle cx="12" cy="12" r="9" fill="var(--ink)" /><path d="M8 12.5l2.5 2.5L16 9" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function RefundIcon() {
  return (<svg viewBox="0 0 24 24" width="26" height="26" fill="none"><path d="M5 12a7 7 0 1 1 2 5" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" /><path d="M5 8v4h4" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}

/* ============================ Styles ============================ */
const CSS = `
.mkt-root{position:relative;left:50%;right:50%;margin-left:-50vw;margin-right:-50vw;width:100vw;
  min-height:100vh;background:var(--paper);color:var(--ink);overflow-x:hidden;
  font-family:var(--font-sans);}
.mkt-grain{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.5;mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.28'/%3E%3C/svg%3E");}
.mkt-root>*:not(.mkt-grain){position:relative;z-index:1;}

/* nav */
.mkt-nav{display:flex;align-items:center;gap:24px;max-width:1160px;margin:0 auto;padding:22px 32px;}
.mkt-brand{font-size:26px;font-weight:700;letter-spacing:-.03em;color:var(--ink);text-decoration:none;}
.mkt-brand-y{color:var(--primary);}
.mkt-brand-first{color:var(--ink-2);font-weight:400;}
.mkt-nav-links{display:flex;gap:26px;margin-left:auto;}
.mkt-nav-links a{color:var(--ink-2);text-decoration:none;font-size:15px;transition:color .18s;}
.mkt-nav-links a:hover{color:var(--ink);}
.mkt-nav-cta{font-family:var(--font-mono);font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  color:var(--on-dark);background:var(--ink-deep);text-decoration:none;padding:10px 16px;border-radius:var(--radius-pill);
  transition:transform .18s, background .18s;}
.mkt-nav-cta:hover{background:#000;transform:translateY(-1px);}

/* hero */
.mkt-hero{max-width:1160px;margin:0 auto;padding:40px 32px 64px;display:grid;grid-template-columns:1.05fr .95fr;
  gap:48px;align-items:center;}
.mkt-eyebrow{font-family:var(--font-mono);font-size:12.5px;font-weight:700;letter-spacing:.16em;color:var(--ink-2);margin:0 0 18px;}
.mkt-h1{font-size:clamp(40px,6vw,76px);line-height:.98;letter-spacing:-.035em;font-weight:700;margin:0;color:var(--ink-deep);}
.mkt-accent{color:var(--primary);}
.mkt-sub{font-size:clamp(16px,1.4vw,19px);line-height:1.55;color:var(--ink-2);max-width:30em;margin:22px 0 0;}
.mkt-cta-row{display:flex;gap:14px;flex-wrap:wrap;margin:30px 0 0;}
.mkt-btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;
  font-family:var(--font-mono);font-size:14px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  padding:15px 26px;border-radius:var(--radius-pill);transition:transform .18s, background .18s, box-shadow .18s;}
.mkt-btn--primary{background:var(--primary);color:var(--primary-ink);box-shadow:0 10px 26px -12px var(--primary);}
.mkt-btn--primary:hover{background:var(--primary-pressed);transform:translateY(-2px);}
.mkt-btn--ghost{background:transparent;color:var(--ink);border:1.5px solid var(--ink);}
.mkt-btn--ghost:hover{background:var(--ink);color:var(--on-dark);transform:translateY(-2px);}
.mkt-btn--dark{background:var(--ink-deep);color:var(--on-dark);}
.mkt-btn--dark:hover{background:#000;transform:translateY(-2px);}
.mkt-chips{display:flex;gap:22px;flex-wrap:wrap;list-style:none;padding:0;margin:28px 0 0;}
.mkt-chips li{display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:12.5px;letter-spacing:.04em;color:var(--ink);text-transform:uppercase;}
.mkt-dot{width:7px;height:7px;border-radius:50%;background:var(--primary);}

/* hero art */
.mkt-hero-art{display:flex;justify-content:center;}
.mkt-art-wrap{width:100%;max-width:440px;filter:drop-shadow(0 30px 50px rgba(20,20,20,.16));}
.mkt-route{animation:mktDash 2.6s linear infinite;}
@keyframes mktDash{to{stroke-dashoffset:-44;}}
.mkt-ping{transform-origin:center;animation:mktPing 2s ease-out infinite;}
@keyframes mktPing{0%{transform:scale(.6);opacity:.5;}100%{transform:scale(1.6);opacity:0;}}
.mkt-float{animation:mktFloat 5s ease-in-out infinite;}
.mkt-float-2{animation:mktFloat 6s ease-in-out infinite .4s;}
@keyframes mktFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-7px);}}

/* why */
.mkt-why{background:var(--paper-2);border-top:1px solid rgba(20,20,20,.08);border-bottom:1px solid rgba(20,20,20,.08);}
.mkt-why-inner{max-width:1160px;margin:0 auto;padding:72px 32px;}
.mkt-why-lead{font-size:clamp(22px,2.6vw,32px);line-height:1.32;letter-spacing:-.02em;color:var(--ink-deep);max-width:20em;margin:0 0 44px;font-weight:500;}
.mkt-quote{color:var(--primary);font-style:italic;}
.mkt-why-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
.mkt-why-card{background:var(--paper);border:1px solid rgba(20,20,20,.1);border-radius:16px;padding:26px;}
.mkt-why-ic{width:52px;height:52px;border-radius:14px;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;margin-bottom:16px;}
.mkt-why-card h3{font-size:19px;letter-spacing:-.01em;margin:0 0 8px;color:var(--ink);}
.mkt-why-card p{font-size:15px;line-height:1.55;color:var(--ink-2);margin:0;}

/* band */
.mkt-band{max-width:1160px;margin:0 auto;padding:72px 32px;display:flex;align-items:center;justify-content:space-between;gap:32px;flex-wrap:wrap;}
.mkt-band-h{font-size:clamp(32px,4vw,52px);letter-spacing:-.03em;margin:0;color:var(--ink-deep);}
.mkt-band-sub{font-size:17px;color:var(--ink-2);max-width:26em;margin:12px 0 0;line-height:1.5;}
.mkt-band-cta{display:flex;gap:14px;flex-wrap:wrap;}

/* footer */
.mkt-foot{background:var(--ink-deep);color:var(--on-dark);display:flex;align-items:center;gap:20px;flex-wrap:wrap;
  padding:26px 32px;max-width:none;}
.mkt-foot .mkt-brand{color:var(--on-dark);}
.mkt-foot .mkt-brand-first{color:#9a9a9a;}
.mkt-foot-tag{font-family:var(--font-mono);font-size:12px;letter-spacing:.14em;color:#8f8f8f;}
.mkt-foot-links{margin-left:auto;display:flex;gap:22px;}
.mkt-foot-links a{color:#c9c9c9;text-decoration:none;font-size:14px;}
.mkt-foot-links a:hover{color:var(--on-dark);}

/* entrance */
.up-1,.up-2,.up-3,.up-4,.up-5{opacity:0;transform:translateY(16px);animation:mktUp .7s cubic-bezier(.2,.7,.2,1) forwards;}
.up-1{animation-delay:.05s}.up-2{animation-delay:.15s}.up-3{animation-delay:.28s}.up-4{animation-delay:.42s}.up-5{animation-delay:.54s}
@keyframes mktUp{to{opacity:1;transform:none;}}
[data-reveal]{opacity:0;transform:translateY(22px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.7,.2,1);}
[data-reveal].is-in{opacity:1;transform:none;}

@media (max-width:860px){
  .mkt-hero{grid-template-columns:1fr;padding-top:24px;}
  .mkt-hero-art{order:-1;max-width:380px;margin:0 auto;}
  .mkt-nav-links{display:none;}
  .mkt-why-grid{grid-template-columns:1fr;}
}
@media (prefers-reduced-motion:reduce){
  .up-1,.up-2,.up-3,.up-4,.up-5,[data-reveal]{animation:none!important;opacity:1!important;transform:none!important;transition:none!important;}
  .mkt-route,.mkt-ping,.mkt-float,.mkt-float-2{animation:none!important;}
}
`;
