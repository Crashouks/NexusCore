import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

const CURSOR_HIDE_MS = 2800;
const LEFT_EDGE_PX = 56;

function useTelemetry(active, targetFps) {
  const [stats, setStats] = useState({
    latency: 14, jitter: 2, bitrate: 24.5, packetLoss: 0.0, fps: targetFps, gpu: 42,
  });

  useEffect(() => {
    setStats(s => ({ ...s, fps: targetFps }));
  }, [targetFps]);

  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      const variance = targetFps >= 120 ? 4 : 2;
      setStats({
        latency: 11 + Math.floor(Math.random() * 8),
        jitter: 1 + Math.floor(Math.random() * 4),
        bitrate: 22 + Math.random() * 6,
        packetLoss: Math.random() > 0.92 ? 0.1 : 0,
        fps: targetFps - variance + Math.floor(Math.random() * (variance * 2 + 1)),
        gpu: 38 + Math.floor(Math.random() * 18),
      });
    }, 1800);
    return () => clearInterval(iv);
  }, [active, targetFps]);

  return stats;
}

function StatChip({ label, value, accent }) {
  return (
    <div className="cloud-stat-chip">
      <span className="cloud-stat-label">{label}</span>
      <span className="cloud-stat-value" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

function NetworkBars({ quality }) {
  const bars = quality === '4K' ? 5 : quality === '1080p' ? 4 : 3;
  return (
    <div className="cloud-net-bars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= bars ? 'active' : ''} style={{ height: 4 + i * 3 }} />
      ))}
    </div>
  );
}

export default function CloudPlayer({
  session,
  elapsed,
  formatElapsed,
  displayQuality,
  targetFps,
  planLabel,
  statsLocked,
  onToggleStatsLock,
  onEnd,
}) {
  const containerRef = useRef(null);
  const lastMoveRef = useRef(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [leftEdgeHover, setLeftEdgeHover] = useState(false);
  const [muted, setMuted] = useState(false);
  const stats = useTelemetry(!!session, targetFps);

  const active = !!session;
  const showStatsPanel = statsLocked || (leftEdgeHover && cursorVisible);
  const showBottomBar = statsLocked || cursorVisible;

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* unsupported */ }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen]);

  useEffect(() => {
    if (!active) {
      setCursorVisible(true);
      setLeftEdgeHover(false);
      return;
    }
    const markMove = () => {
      lastMoveRef.current = Date.now();
      setCursorVisible(true);
    };
    const iv = setInterval(() => {
      if (Date.now() - lastMoveRef.current > CURSOR_HIDE_MS) setCursorVisible(false);
    }, 400);
    window.addEventListener('mousemove', markMove);
    return () => {
      window.removeEventListener('mousemove', markMove);
      clearInterval(iv);
    };
  }, [active]);

  const handlePlayerMouseMove = (e) => {
    if (!active || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setLeftEdgeHover(x <= LEFT_EDGE_PX);
    lastMoveRef.current = Date.now();
    setCursorVisible(true);
  };

  const handlePlayerMouseLeave = () => {
    if (!statsLocked) setLeftEdgeHover(false);
  };

  return (
    <div
      ref={containerRef}
      className={`cloud-player ${isFullscreen ? 'cloud-player-fs' : ''} ${active && !cursorVisible ? 'cloud-cursor-hidden' : ''}`}
      onMouseMove={handlePlayerMouseMove}
      onMouseLeave={handlePlayerMouseLeave}
    >
      <div className="cloud-player-frame">
        <div className="cloud-player-corners" aria-hidden="true">
          <span /><span /><span /><span />
        </div>

        {active ? (
          <div className="cloud-player-viewport" style={{ backgroundImage: `url(${session.cover_url})` }}>
            <div className="cloud-player-backdrop" />
            <div className="cloud-scanlines" aria-hidden="true" />

            <div className={`cloud-left-edge-zone ${cursorVisible ? '' : 'disabled'}`} aria-hidden="true" />

            {!cursorVisible && !statsLocked && (
              <div className="cloud-cursor-hidden-badge">Gameplay mode — move mouse to show cursor</div>
            )}

            <div className={`cloud-stats-drawer ${showStatsPanel ? 'open' : ''}`}>
              <div className="cloud-stats-drawer-head">
                <p className="cloud-panel-title">Stream Telemetry</p>
                <button
                  type="button"
                  className={`cloud-ctrl-btn ${statsLocked ? 'active' : ''}`}
                  onClick={onToggleStatsLock}
                  title={statsLocked ? 'Unlock HUD' : 'Lock HUD on screen'}
                >
                  <Icon name={statsLocked ? 'lock' : 'unlock'} size={14} />
                </button>
              </div>
              <div className="cloud-telemetry-grid">
                <StatChip label="Latency" value={`${stats.latency} ms`} accent="var(--neon)" />
                <StatChip label="Jitter" value={`${stats.jitter} ms`} />
                <StatChip label="Bitrate" value={`${stats.bitrate.toFixed(1)} Mbps`} />
                <StatChip label="Loss" value={`${stats.packetLoss.toFixed(1)}%`} accent={stats.packetLoss > 0 ? 'var(--danger)' : undefined} />
                <StatChip label="Render" value={`${stats.fps} FPS`} />
                <StatChip label="GPU Load" value={`${stats.gpu}%`} />
              </div>
              <div className="cloud-waveform" aria-hidden="true">
                {Array.from({ length: 20 }, (_, i) => (
                  <span key={i} style={{ height: `${22 + Math.sin(i * 0.7 + elapsed * 0.15) * 18}%` }} />
                ))}
              </div>
              <div className="cloud-drawer-meta">
                <StatChip label="ENC" value="H.265" />
                <StatChip label="SERVER" value="EU-Central" />
                <NetworkBars quality={displayQuality} />
              </div>
            </div>

            {showStatsPanel && (
              <div className="cloud-player-topbar compact">
                <span className="cloud-live-badge"><span className="live-dot" /> LIVE</span>
                <span className="cloud-game-title">{session.name}</span>
              </div>
            )}

            <div className={`cloud-player-center minimal ${showStatsPanel ? 'dimmed' : ''}`}>
              <img src={session.cover_url} alt="" className="cloud-poster" />
              <p className="font-display cloud-center-title">{session.name}</p>
              <div className="cloud-timer-row">
                <span className="cloud-elapsed">{formatElapsed(elapsed)}</span>
                {session.minutes_remaining != null && (
                  <span className="cloud-remaining">{session.minutes_remaining} min left</span>
                )}
              </div>
            </div>

            <div className={`cloud-player-bottombar ${showBottomBar ? 'visible' : ''}`}>
              <div className="cloud-bottom-left">
                <span className="cloud-quality-pill">{displayQuality}</span>
                <span className="cloud-quality-pill">{targetFps} FPS</span>
                {!statsLocked && <span className="cloud-hint">← edge · F11</span>}
              </div>
              <div className="cloud-bottom-controls">
                <button type="button" className={`cloud-ctrl-btn ${statsLocked ? 'active' : ''}`} onClick={onToggleStatsLock} title="Lock stats HUD">
                  <Icon name={statsLocked ? 'lock' : 'unlock'} size={16} />
                </button>
                <button type="button" className="cloud-ctrl-btn" onClick={() => setMuted(m => !m)} title={muted ? 'Unmute' : 'Mute'}>
                  <Icon name={muted ? 'volumeOff' : 'volume'} size={16} />
                </button>
                <button type="button" className="cloud-ctrl-btn" onClick={toggleFullscreen} title="Fullscreen (F11)">
                  <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={16} />
                </button>
                <button type="button" className="btn btn-danger cloud-end-btn" onClick={onEnd}>End Session</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="cloud-player-viewport cloud-player-idle">
            <div className="cloud-idle-grid" aria-hidden="true" />
            <div className="cloud-idle-content">
              <div className="cloud-idle-rings">
                <Icon name="cloud" size={40} />
              </div>
              <p className="font-display cloud-idle-title">GeForce NOW Stream Deck</p>
              <p className="cloud-idle-sub">
                No active session · <strong>{planLabel}</strong> plan ready
              </p>
              <div className="cloud-idle-status-row">
                <StatChip label="Status" value="Standby" accent="var(--accent-glow)" />
                <StatChip label="Region" value="EU-Central" />
                <StatChip label="Queue" value={planLabel === 'Free' ? 'Enabled' : 'Bypass'} />
              </div>
              <p className="cloud-idle-hint">
                Launch a cloud-ready title from your library, then select <strong>Stream Now</strong>.
              </p>
              <div className="cloud-idle-actions">
                <Link to="/library?tab=cloud" className="btn btn-neon">Browse Cloud Games</Link>
                <Link to="/store?cloud=1" className="btn btn-ghost">Cloud Store</Link>
              </div>
            </div>
            <div className="cloud-player-bottombar cloud-idle-bar visible">
              <span className="cloud-hint">Press F11 for fullscreen stream view</span>
              <button type="button" className="cloud-ctrl-btn" onClick={toggleFullscreen} title="Fullscreen (F11)">
                <Icon name="maximize" size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
