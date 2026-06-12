export default function CloudBadge({ small }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'rgba(168,85,247,0.15)', color: 'var(--accent-cloud)',
      padding: small ? '2px 6px' : '4px 10px', borderRadius: 6,
      fontSize: small ? 11 : 12, fontWeight: 600,
    }}>
      GFN Ready
    </span>
  );
}
