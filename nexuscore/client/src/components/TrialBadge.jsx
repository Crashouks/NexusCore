export default function TrialBadge({ active, small }) {
  return (
    <span className={active ? 'pulse-trial' : ''} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'var(--trial-dim)', color: 'var(--accent-trial)',
      padding: small ? '2px 6px' : '4px 10px', borderRadius: 6,
      fontSize: small ? 11 : 12, fontWeight: 600,
    }}>
      {active ? 'Trial Active' : 'Free Trial'}
    </span>
  );
}
