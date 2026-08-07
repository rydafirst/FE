'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/**
 * Rydafirst public homepage — the "ryda" poster campaign as a website.
 *
 * Design system for type/colour (Space Grotesk / Space Mono, --ink, --primary; orange only on the
 * primary action + live states). The background is the brand's woven-linen texture
 * (/brand/background.png) and the page is image-led: the escrow story is told with the generated
 * poster illustrations (/brand/poster-*.png). Breaks out of the app's 480px mobile shell.
 */
const APP_STORE_URL = 'https://apps.apple.com/app/rydafirst/id6789930826';

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden style={{ marginRight: 9, marginTop: -2 }}>
      <path d="M16.4 12.7c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.5 2.2 2.6 2.2 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.1-.8-2.1-3.1zM14.3 5.6c.6-.7 1-1.7.9-2.6-.9 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.5 1 .1 1.9-.5 2.5-1.2z" />
    </svg>
  );
}

export default function Home() {
  const revealRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = revealRoot.current?.querySelectorAll('[data-reveal]');
    if (!els?.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }),
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="mkt-root" ref={revealRoot}>
      <style>{CSS}</style>
      <div className="mkt-tex" aria-hidden />

      {/* Nav */}
      <header className="mkt-nav">
        <Link href="/" className="mkt-brand" aria-label="Rydafirst home">
          ryd<span className="mkt-brand-y">a</span><span className="mkt-brand-first">first</span>
        </Link>
        <nav className="mkt-nav-links">
          <a href="#how">How it works</a>
          <a href="#trust">The guarantee</a>
          <a href="#riders">For riders</a>
        </nav>
        <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="mkt-nav-cta">Get the app</a>
      </header>

      {/* Hero */}
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
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="mkt-btn mkt-btn--primary"><AppleIcon />Download on the App Store</a>
            <Link href="/login" className="mkt-btn mkt-btn--ghost">Open web app →</Link>
          </div>
          <ul className="mkt-chips up-5" aria-label="What you get">
            <li><span className="mkt-dot" /> Escrow-protected</li>
            <li><span className="mkt-dot" /> Live GPS tracking</li>
            <li><span className="mkt-dot" /> Paid on delivery</li>
          </ul>
        </div>
        <div className="mkt-hero-art up-3">
          <img src="/brand/hero.png" alt="A Rydafirst rider on a delivery motorbike" className="mkt-hero-img" />
        </div>
      </section>

      {/* How it works */}
      <section className="mkt-steps" id="how">
        <div className="mkt-steps-inner">
          <p className="mkt-eyebrow" style={{ color: 'var(--primary)' }}>HOW IT WORKS</p>
          <h2 className="mkt-steps-h">Four steps, zero trust required.</h2>
          <div className="mkt-steps-grid">
            {STEPS.map((s, i) => (
              <div className="mkt-step" key={s.t} data-reveal>
                <span className="mkt-step-n">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The guarantee — poster campaign */}
      <section className="mkt-campaign" id="trust">
        <div className="mkt-campaign-inner">
          <p className="mkt-eyebrow" style={{ color: 'var(--primary)' }}>THE GUARANTEE</p>
          <h2 className="mkt-campaign-h">Protected at every step.</h2>
          <p className="mkt-campaign-sub">Pay, deliver, refund — the whole flow is guaranteed by the system, not by trust.</p>
          <div className="mkt-poster-grid">
            {POSTERS.map((p) => (
              <figure className="mkt-poster" key={p.src} data-reveal>
                <img src={p.src} alt={p.alt} />
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* For riders */}
      <section className="mkt-riders" id="riders">
        <div className="mkt-riders-band" data-reveal>
          <p className="mkt-eyebrow">FOR RIDERS</p>
          <h2 className="mkt-riders-h">Do the work, get paid. <span className="mkt-accent">Guaranteed.</span></h2>
          <p className="mkt-riders-sub">
            Your payment is locked in escrow before you ever pick up, and released the moment delivery
            is confirmed. Fair pay if a trip fails through no fault of yours. No more “I’ll pay you later.”
          </p>
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="mkt-btn mkt-btn--primary" style={{ marginTop: 26 }}><AppleIcon />Become a rider</a>
        </div>
      </section>

      <footer className="mkt-foot">
        <span className="mkt-brand" style={{ fontSize: 20 }}>ryd<span className="mkt-brand-y">a</span><span className="mkt-brand-first">first</span></span>
        <span className="mkt-foot-tag">WE ARE FOR RIDERS</span>
        <span className="mkt-foot-contact">138 Unity Zone 6, Olorunsogo, Ado Ekiti, Ekiti State · <a href="tel:+2348149249926">+234 814 924 9926</a></span>
        <span className="mkt-foot-links">
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">Get the app</a>
        </span>
      </footer>
    </div>
  );
}

const STEPS = [
  { t: 'Book & pay', d: 'Set pickup and drop-off, get a clear fare, and pay it into escrow — not to the rider.' },
  { t: 'Rider accepts', d: 'A nearby rider is matched and heads to your pickup. You see who they are and their vehicle.' },
  { t: 'Track live', d: 'Follow every stage on the map — en route, picked up, arriving — pickup to door.' },
  { t: 'Confirm & release', d: 'The recipient gives their code, arrival is GPS-verified, and the money releases. Done.' },
];

const POSTERS = [
  { src: '/brand/poster-1-pay.png', alt: 'You pay, we hold — your delivery payment stays safe in escrow.' },
  { src: '/brand/poster-2-deliver.png', alt: 'Delivered, rider credited — payment is released after delivery is confirmed.' },
  { src: '/brand/poster-3-refund.png', alt: 'No delivery, money returned — if the trip isn’t completed, the sender is refunded.' },
];

const CSS = `
.mkt-root{position:relative;left:50%;right:50%;margin-left:-50vw;margin-right:-50vw;width:100vw;
  min-height:100vh;background:var(--site-bg);color:var(--ink);overflow-x:hidden;font-family:var(--font-sans);}
.mkt-tex{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.85;
  background-image:url(/brand/background.png);background-repeat:repeat;background-size:900px;}
.mkt-root>*:not(.mkt-tex){position:relative;z-index:1;}

.mkt-nav{display:flex;align-items:center;gap:24px;max-width:1180px;margin:0 auto;padding:22px 32px;}
.mkt-brand{font-size:26px;font-weight:700;letter-spacing:-.03em;color:var(--ink);text-decoration:none;}
.mkt-brand-y{color:var(--primary);}
.mkt-brand-first{color:var(--ink-2);font-weight:400;}
.mkt-nav-links{display:flex;gap:26px;margin-left:auto;}
.mkt-nav-links a{color:var(--ink-2);text-decoration:none;font-size:15px;transition:color .18s;}
.mkt-nav-links a:hover{color:var(--ink);}
.mkt-nav-cta{font-family:var(--font-mono);font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  color:var(--on-dark);background:var(--ink);text-decoration:none;padding:10px 16px;border-radius:var(--radius-pill);transition:transform .18s,background .18s;}
.mkt-nav-cta:hover{background:#000;transform:translateY(-1px);}

.mkt-hero{max-width:1180px;margin:0 auto;padding:40px 32px 60px;display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center;}
.mkt-eyebrow{font-family:var(--font-mono);font-size:12.5px;font-weight:700;letter-spacing:.16em;color:var(--ink-2);margin:0 0 18px;}
.mkt-h1{font-size:clamp(40px,6vw,76px);line-height:.98;letter-spacing:-.035em;font-weight:700;margin:0;color:var(--ink);}
.mkt-accent{color:var(--primary);}
.mkt-sub{font-size:clamp(16px,1.4vw,19px);line-height:1.55;color:var(--ink-2);max-width:30em;margin:22px 0 0;}
.mkt-cta-row{display:flex;gap:14px;flex-wrap:wrap;margin:30px 0 0;}
.mkt-btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-family:var(--font-mono);font-size:14px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:15px 26px;border-radius:var(--radius-pill);transition:transform .18s,background .18s;}
.mkt-btn--primary{background:var(--primary);color:var(--primary-ink);box-shadow:0 10px 26px -12px var(--primary);}
.mkt-btn--primary:hover{background:var(--primary-pressed);transform:translateY(-2px);}
.mkt-btn--ghost{background:transparent;color:var(--ink);border:1.5px solid var(--ink);}
.mkt-btn--ghost:hover{background:var(--ink);color:var(--on-dark);transform:translateY(-2px);}
.mkt-chips{display:flex;gap:22px;flex-wrap:wrap;list-style:none;padding:0;margin:28px 0 0;}
.mkt-chips li{display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:12.5px;letter-spacing:.04em;color:var(--ink);text-transform:uppercase;}
.mkt-dot{width:7px;height:7px;border-radius:50%;background:var(--primary);}
.mkt-hero-art{display:flex;justify-content:center;}
.mkt-hero-img{width:100%;max-width:540px;height:auto;display:block;border-radius:16px;}

.mkt-steps{max-width:1180px;margin:0 auto;padding:20px 32px 56px;}
.mkt-steps-h{font-size:clamp(28px,3.4vw,44px);letter-spacing:-.025em;margin:6px 0 34px;color:var(--ink);}
.mkt-steps-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;}
.mkt-step{border-top:2px solid var(--ink);padding:16px 4px 0;}
.mkt-step-n{font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--primary);letter-spacing:.05em;}
.mkt-step h3{font-size:19px;letter-spacing:-.01em;margin:10px 0 8px;color:var(--ink);}
.mkt-step p{font-size:15px;line-height:1.55;color:var(--ink-2);margin:0;}

.mkt-campaign{border-top:1px solid rgba(70,54,32,.1);}
.mkt-campaign-inner{max-width:1180px;margin:0 auto;padding:64px 32px 72px;}
.mkt-campaign-h{font-size:clamp(30px,3.6vw,48px);letter-spacing:-.03em;margin:6px 0 8px;color:var(--ink);}
.mkt-campaign-sub{font-size:17px;color:var(--ink-2);max-width:34em;margin:0 0 40px;line-height:1.5;}
.mkt-poster-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;}
.mkt-poster{margin:0;border-radius:16px;overflow:hidden;box-shadow:0 18px 40px -20px rgba(20,20,20,.4);}
.mkt-poster img{width:100%;height:auto;display:block;}

.mkt-riders{background:var(--ink);color:var(--on-dark);}
.mkt-riders-band{max-width:820px;margin:0 auto;padding:82px 32px;text-align:center;}
.mkt-riders .mkt-eyebrow{color:var(--primary);}
.mkt-riders-h{font-size:clamp(30px,4vw,52px);letter-spacing:-.03em;margin:8px 0 0;color:var(--on-dark);}
.mkt-riders-h .mkt-accent{color:var(--primary);}
.mkt-riders-sub{font-size:17px;line-height:1.55;color:#d8d3ca;max-width:34em;margin:18px auto 0;}

.mkt-foot{background:#0b0b0b;color:var(--on-dark);display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:26px 32px;}
.mkt-foot .mkt-brand{color:var(--on-dark);}
.mkt-foot .mkt-brand-first{color:#9a9a9a;}
.mkt-foot-tag{font-family:var(--font-mono);font-size:12px;letter-spacing:.14em;color:#8f8f8f;}
.mkt-foot-contact{font-family:var(--font-mono);font-size:11.5px;letter-spacing:.03em;color:#8f8f8f;}
.mkt-foot-contact a{color:#c9c9c9;text-decoration:none;}
.mkt-foot-contact a:hover{color:var(--on-dark);}
.mkt-foot-links{margin-left:auto;display:flex;gap:22px;}
.mkt-foot-links a{color:#c9c9c9;text-decoration:none;font-size:14px;}
.mkt-foot-links a:hover{color:var(--on-dark);}

.up-1,.up-2,.up-3,.up-4,.up-5{opacity:0;transform:translateY(16px);animation:mktUp .7s cubic-bezier(.2,.7,.2,1) forwards;}
.up-1{animation-delay:.05s}.up-2{animation-delay:.15s}.up-3{animation-delay:.28s}.up-4{animation-delay:.42s}.up-5{animation-delay:.54s}
@keyframes mktUp{to{opacity:1;transform:none;}}
[data-reveal]{opacity:0;transform:translateY(22px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.7,.2,1);}
[data-reveal].is-in{opacity:1;transform:none;}

@media (max-width:900px){
  .mkt-hero{grid-template-columns:1fr;padding-top:24px;}
  .mkt-hero-art{order:-1;max-width:420px;margin:0 auto;}
  .mkt-nav-links{display:none;}
  .mkt-steps-grid{grid-template-columns:1fr 1fr;}
  .mkt-poster-grid{grid-template-columns:1fr 1fr;}
}
@media (max-width:560px){
  .mkt-steps-grid{grid-template-columns:1fr;}
  .mkt-poster-grid{grid-template-columns:1fr;max-width:420px;margin:0 auto;}
}
@media (prefers-reduced-motion:reduce){
  .up-1,.up-2,.up-3,.up-4,.up-5,[data-reveal]{animation:none!important;opacity:1!important;transform:none!important;transition:none!important;}
}
`;
