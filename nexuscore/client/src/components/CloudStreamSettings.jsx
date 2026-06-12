import { Link } from 'react-router-dom';
import Icon from './Icon';

export function getPlanStreamLimits(plan) {
  switch (plan) {
    case 'ultimate_rtx':
      return { qualities: ['720p', '1080p', '4K'], fps: [60, 120, 144], label: 'Ultimate RTX' };
    case 'pro':
      return { qualities: ['720p', '1080p', '4K'], fps: [60, 120], label: 'Pro' };
    case 'starter':
      return { qualities: ['720p', '1080p'], fps: [60], label: 'Starter' };
    default:
      return { qualities: ['720p', '1080p'], fps: [60], label: 'Free' };
  }
}

export default function CloudStreamSettings({
  plan,
  quality,
  fps,
  statsLocked,
  onQualityChange,
  onFpsChange,
  onToggleStatsLock,
}) {
  const limits = getPlanStreamLimits(plan);
  const canChangeFps = limits.fps.length > 1;
  const canChangeQuality = limits.qualities.length > 1;

  return (
    <div className="cloud-settings-card glass">
      <h2 className="font-display cloud-settings-title">Streaming Settings</h2>

      <div className="cloud-settings-block">
        <label className="cloud-settings-label">Stream Quality</label>
        <div className="cloud-settings-row">
          {['720p', '1080p', '4K'].map(q => {
            const allowed = limits.qualities.includes(q);
            return (
              <button
                key={q}
                type="button"
                disabled={!allowed}
                className={`btn ${quality === q ? 'btn-primary' : 'btn-ghost'} cloud-settings-btn`}
                onClick={() => allowed && onQualityChange(q)}
                title={!allowed ? `Requires a higher plan than ${limits.label}` : undefined}
              >
                {q}
              </button>
            );
          })}
        </div>
        {!canChangeQuality && (
          <p className="cloud-settings-hint">Upgrade your plan in <Link to="/profile#cloud-plans">Profile</Link> for higher resolution.</p>
        )}
      </div>

      <div className="cloud-settings-block">
        <label className="cloud-settings-label">Target FPS</label>
        <div className="cloud-settings-row">
          {[60, 120, 144].map(f => {
            const allowed = limits.fps.includes(f);
            return (
              <button
                key={f}
                type="button"
                disabled={!allowed}
                className={`btn ${fps === f ? 'btn-primary' : 'btn-ghost'} cloud-settings-btn`}
                onClick={() => allowed && onFpsChange(f)}
                title={!allowed ? `Requires Pro or Ultimate plan` : undefined}
              >
                {f}
              </button>
            );
          })}
        </div>
        {!canChangeFps && (
          <p className="cloud-settings-hint">FPS options unlock on Pro and Ultimate RTX plans.</p>
        )}
      </div>

      <div className="cloud-settings-block cloud-settings-lock">
        <div>
          <label className="cloud-settings-label">Stats overlay</label>
          <p className="cloud-settings-hint" style={{ marginTop: 4 }}>
            {statsLocked
              ? 'Telemetry stays visible on the stream deck.'
              : 'Hover the left edge while your cursor is visible to peek stats.'}
          </p>
        </div>
        <button
          type="button"
          className={`btn ${statsLocked ? 'btn-primary' : 'btn-ghost'} cloud-lock-btn`}
          onClick={onToggleStatsLock}
          title={statsLocked ? 'Unlock stats overlay' : 'Lock stats overlay on screen'}
        >
          <Icon name={statsLocked ? 'lock' : 'unlock'} size={16} />
          {statsLocked ? 'Locked' : 'Lock HUD'}
        </button>
      </div>

      <p className="cloud-settings-foot">
        Current plan: <strong>{limits.label}</strong>
      </p>
    </div>
  );
}
