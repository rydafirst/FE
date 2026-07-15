import Link from 'next/link';

export const metadata = { title: 'Terms of Use — Rydafirst' };

// Baseline Terms of Use for the App Store submission. Review with counsel before launch;
// the operative dispute/escrow rules mirror the in-app behaviour.
export default function TermsPage() {
  return (
    <main style={{ padding: 24, lineHeight: 1.6, color: 'var(--ink)' }}>
      <Link href="/login" className="mono" style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-2)' }}>← BACK</Link>
      <h1 style={{ fontSize: 26, margin: '16px 0 4px' }}>Terms of Use</h1>
      <p className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', margin: 0 }}>LAST UPDATED 14 JULY 2026</p>

      <h2 style={{ fontSize: 17, marginTop: 24 }}>1. Who we are</h2>
      <p>Rydafirst operates a technology platform that connects customers who need items delivered
        with independent riders who carry out those deliveries in Nigeria. Rydafirst provides the
        platform; riders provide the delivery service.</p>

      <h2 style={{ fontSize: 17, marginTop: 20 }}>2. Your account</h2>
      <p>You must provide accurate details (your name, phone number and email) and keep them current.
        You are responsible for activity on your account. Access is verified with a one-time code sent
        to your email or phone. You must be at least 18 years old to use Rydafirst.</p>

      <h2 style={{ fontSize: 17, marginTop: 20 }}>3. Payments and escrow</h2>
      <p>Delivery fees are collected up front and held in escrow. Funds are released to the rider once a
        delivery is completed and confirmed. Where a delivery cannot be completed, funds are released,
        refunded or split according to our dispute rules and the reason the delivery failed. All charges
        are for a real-world delivery service.</p>

      <h2 style={{ fontSize: 17, marginTop: 20 }}>4. Acceptable use and conduct</h2>
      <p>You agree to treat riders, customers and staff with respect. There is zero tolerance for
        abusive, harassing, hateful, fraudulent or otherwise objectionable behaviour or content,
        including in in-app messages. We review reports and may suspend or remove accounts that breach
        these terms. Contact between a rider and customer is limited to what is needed to complete a
        delivery.</p>

      <h2 style={{ fontSize: 17, marginTop: 20 }}>5. Prohibited items</h2>
      <p>You may not send illegal, dangerous, stolen or restricted goods. You are responsible for the
        contents you send and for complying with applicable law.</p>

      <h2 style={{ fontSize: 17, marginTop: 20 }}>6. Disputes</h2>
      <p>If something goes wrong with a delivery, you can open a dispute in the app within the stated
        window. Our team reviews the evidence (including the delivery timeline and messages) and decides
        whether funds are released, refunded or split.</p>

      <h2 style={{ fontSize: 17, marginTop: 20 }}>7. Liability</h2>
      <p>Rydafirst provides the platform on an "as is" basis and is not the provider of the delivery
        itself. To the extent permitted by law, our liability is limited to the fees paid for the
        affected delivery.</p>

      <h2 style={{ fontSize: 17, marginTop: 20 }}>8. Changes and contact</h2>
      <p>We may update these terms and will post the updated version here. Questions? Contact us at
        support@rydafirst.com.</p>
    </main>
  );
}
