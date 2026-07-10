type Kind = 'paid' | 'transit' | 'waiting' | 'dispute';
const LABEL: Record<Kind, string> = { paid: 'PAID', transit: 'IN TRANSIT', waiting: 'WAITING', dispute: 'DISPUTE' };
export function StatusPill({ kind, label }: { kind: Kind; label?: string }) {
  return <span className={`rf-pill rf-pill--${kind}`}>{label ?? LABEL[kind]}</span>;
}
