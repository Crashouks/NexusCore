export default function PlanCard({ plan, isFree, onSubscribe, currentPlan }) {
  const isCurrent = isFree ? currentPlan === 'free' : currentPlan === plan.name;

  return (
    <div
      className="glass profile-plan-card"
      style={{ border: isCurrent ? '2px solid var(--neon)' : '1px solid var(--border)' }}
    >
      <h3 className="font-display" style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        {isFree ? 'Free' : plan.display_name}
      </h3>
      <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 16, color: isFree ? 'var(--neon)' : 'var(--accent-glow)' }}>
        {isFree ? 'Free' : `$${parseFloat(plan.price_monthly).toFixed(2)}`}
        {!isFree && <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/mo</span>}
      </div>
      <ul style={{ listStyle: 'none', marginBottom: 16, fontSize: 14, color: 'var(--text-muted)', lineHeight: 2 }}>
        <li>{isFree ? '1080p' : plan.max_res} resolution</li>
        <li>{isFree ? '60' : plan.max_fps} FPS</li>
        <li>Ray Tracing: {isFree ? '✗' : plan.ray_tracing ? '✓' : '✗'}</li>
        <li>Queue: {isFree ? 'Yes' : 'Skip'}</li>
        <li>{isFree ? '1 hr/day' : 'Unlimited'}</li>
      </ul>
      <div className="profile-plan-card__footer">
        {isCurrent ? (
          <span style={{ color: 'var(--neon)', fontWeight: 600 }}>Current Plan ✓</span>
        ) : isFree ? (
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Your Current Tier</span>
        ) : (
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => onSubscribe(plan)}>
            Subscribe — ${parseFloat(plan.price_monthly).toFixed(2)}/mo
          </button>
        )}
      </div>
    </div>
  );
}
