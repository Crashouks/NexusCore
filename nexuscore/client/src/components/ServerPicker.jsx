import { useState, useEffect } from 'react';
import Modal from './Modal';
import Icon from './Icon';

const TIER_LABELS = {
  free_fake: { label: 'Free', color: 'var(--neon)' },
  paid_fake: { label: 'Pro', color: 'var(--accent-cloud)' },
  real: { label: 'Private PC', color: 'var(--warning)' },
};

const AVAIL_LABELS = {
  available: 'Available',
  plan_required: 'Paid plan required',
  password_required: 'Password required',
  maintenance: 'Maintenance',
  offline: 'Offline',
  full: 'Full',
  no_game: 'Game not installed',
};

export function getPreferredServerId() {
  const v = localStorage.getItem('nc_preferred_server_id');
  return v ? parseInt(v, 10) : null;
}

export function setPreferredServerId(id) {
  if (id) localStorage.setItem('nc_preferred_server_id', String(id));
  else localStorage.removeItem('nc_preferred_server_id');
}

export default function ServerPicker({ gameId, selectedId, onSelect, compact }) {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('../api/api').then(({ api }) => {
      const q = gameId ? `?game_id=${gameId}` : '';
      api.get(`/cloud/servers${q}`).then(data => {
        setServers(data.servers || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, [gameId]);

  if (loading) return <div className="skeleton" style={{ height: compact ? 80 : 120 }} />;

  return (
    <div className="cloud-server-picker">
      {!compact && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Choose where to stream. Free & Pro servers use simulated datacenter streams. Private PC runs the real game on a host machine.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {servers.map(s => {
          const tier = TIER_LABELS[s.server_tier] || TIER_LABELS.real;
          const selectable = s.availability === 'available' || s.availability === 'password_required';
          const selected = selectedId === s.server_id;
          return (
            <button
              key={s.server_id}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && onSelect(s)}
              className={`cloud-server-option ${selected ? 'selected' : ''}`}
              style={{
                textAlign: 'left', padding: 12, borderRadius: 'var(--radius)',
                border: `1px solid ${selected ? 'var(--neon)' : 'var(--border)'}`,
                background: selected ? 'var(--neon-dim)' : 'var(--bg-surface)',
                opacity: selectable ? 1 : 0.55,
                cursor: selectable ? 'pointer' : 'not-allowed',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <strong>{s.name}</strong>
                <span style={{ fontSize: 11, color: tier.color }}>{tier.label}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {s.region} · {s.gpu_model || 'GPU'} · {AVAIL_LABELS[s.availability] || s.availability}
                {s.requires_player_password && ' · 🔒'}
                {s.status === 'maintenance' && ' · 🛠 Maintenance'}
              </div>
            </button>
          );
        })}
        {!servers.length && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No servers configured.</p>
        )}
      </div>
    </div>
  );
}

export function ServerConnectModal({ open, onClose, server, onConfirm }) {
  const [password, setPassword] = useState('');
  const needsPassword = server?.requires_player_password || server?.availability === 'password_required';

  useEffect(() => { if (open) setPassword(''); }, [open, server?.server_id]);

  if (!server) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Connect — ${server.name}`}>
      {server.status === 'maintenance' && (
        <p style={{ color: 'var(--warning)', fontSize: 13, marginBottom: 12 }}>
          This machine is in maintenance mode. Enter the server password to connect.
        </p>
      )}
      {server.is_real && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Real stream from a private PC — live video and remote control.
        </p>
      )}
      {needsPassword && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Server password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Enter server password"
            style={{ width: '100%', padding: 10, marginTop: 4, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>
      )}
      <button type="button" className="btn btn-neon" style={{ width: '100%' }}
        onClick={() => onConfirm(needsPassword ? password : null)}>
        <Icon name="play" size={16} /> Start Stream
      </button>
    </Modal>
  );
}
