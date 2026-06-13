import { useState, useEffect } from 'react';
import { api } from '../api/api';
import Icon from './Icon';

export default function LiveStreamsPanel({ onWatch, watchSessionId }) {
  const [data, setData] = useState({ streams: [], viewer_queue: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.cloud.liveStreams()
        .then((res) => { if (!cancelled) setData(res); })
        .catch(() => { if (!cancelled) setData({ streams: [], viewer_queue: null }); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 12000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const streams = (data.streams || []).filter(s => !s.is_own);

  if (loading) {
    return (
      <section style={{ marginBottom: 24 }}>
        <h2 className="section-title" style={{ fontSize: 22 }}>Live Now</h2>
        <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius)' }} />
      </section>
    );
  }

  if (!streams.length) return null;

  return (
    <section style={{ marginBottom: 24 }}>
      <h2 className="section-title" style={{ fontSize: 22 }}>Live Now</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
        Streams are private by default. You only see gameplay when the player allows spectators in stream settings.
      </p>
      <div className="cloud-live-streams-grid">
        {streams.map((stream) => {
          const watching = watchSessionId === stream.session_id;
          return (
            <div key={stream.session_id} className={`cloud-live-stream-card ${watching ? 'active' : ''}`}>
              <div className="cloud-live-stream-preview">
                {stream.can_view && stream.cover_url ? (
                  <img src={stream.cover_url} alt="" />
                ) : (
                  <div className="cloud-live-stream-private">
                    <Icon name="lock" size={28} />
                    <span>Private session</span>
                  </div>
                )}
              </div>
              <div className="cloud-live-stream-meta">
                <strong>{stream.player_username || 'Player'}</strong>
                <span>{stream.server_name || stream.server_region || 'Cloud server'}</span>
                {stream.can_view && stream.game_name && (
                  <span className="cloud-live-stream-game">{stream.game_name}</span>
                )}
                {!stream.can_view && (
                  <span className="cloud-live-stream-private-hint">Gameplay hidden</span>
                )}
              </div>
              <button
                type="button"
                className={`btn ${watching ? 'btn-ghost' : 'btn-neon'}`}
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => onWatch(watching ? null : stream)}
              >
                {watching ? 'Stop watching' : 'Watch'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
