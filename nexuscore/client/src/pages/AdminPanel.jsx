import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api/api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import Icon from '../components/Icon';

const TABS = ['Dashboard', 'Users', 'Games', 'Storefront', 'Moderation', 'Cloud', 'Trials', 'Forums', 'Purchases'];

const STAT_LABELS = {
  users: 'Total Users',
  games: 'Approved Games',
  pending_games: 'Pending Review',
  dev_requests: 'Dev Requests',
  active_cloud_sessions: 'Live Streams',
  queue_waiting: 'Queue Waiting',
  active_trials: 'Active Trials',
  trials_today: 'Trials Today',
  total_revenue: 'Store Revenue',
  total_purchases: 'Total Purchases',
  wishlist_items: 'Wishlist Items',
  installed_games: 'Installed Games',
  forum_topics: 'Forum Topics',
  pending_friend_requests: 'Friend Requests',
};

function formatStat(key, value) {
  if (key === 'total_revenue') return `$${parseFloat(value || 0).toFixed(2)}`;
  return value ?? 0;
}

export default function AdminPanel() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [games, setGames] = useState([]);
  const [pending, setPending] = useState([]);
  const [devRequests, setDevRequests] = useState([]);
  const [cloudData, setCloudData] = useState({ sessions: [], queue: [] });
  const [trialData, setTrialData] = useState({ trials: [], stats: {} });
  const [purchases, setPurchases] = useState([]);
  const [forums, setForums] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [gameFilter, setGameFilter] = useState('all');
  const [editGame, setEditGame] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [carouselDraft, setCarouselDraft] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const { showToast } = useToast();

  const approvedGames = useMemo(() => games.filter(g => g.status === 'approved'), [games]);

  useEffect(() => {
    setCarouselDraft(
      approvedGames
        .map(g => ({
          game_id: g.game_id,
          name: g.name,
          inCarousel: !!g.is_carousel,
          order: g.carousel_order ?? 0,
        }))
        .sort((a, b) => a.order - b.order)
    );
  }, [approvedGames]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.allSettled([
        api.admin.stats(),
        api.admin.users(),
        api.admin.games(),
        api.games.pending(),
        api.admin.devRequests(),
        api.cloud.sessionsAll(),
        api.trials.all(),
        api.admin.purchases(),
        api.admin.forums(),
      ]);
      const pick = (i, fallback) => results[i].status === 'fulfilled' ? results[i].value : fallback;
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length) {
        const msg = failed[0].reason?.message || 'Some admin data failed to load';
        setLoadError(msg);
        if (failed.some(r => r.reason?.status === 403)) {
          setLoadError('Admin access denied — log out and log in again, then restart the API.');
        }
      }
      setStats(pick(0, null));
      setUsers(pick(1, []));
      setGames(pick(2, []));
      setPending(pick(3, []));
      setDevRequests(pick(4, []));
      setCloudData(pick(5, { sessions: [], queue: [] }));
      setTrialData(pick(6, { trials: [], stats: {} }));
      setPurchases(pick(7, []));
      setForums(pick(8, []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAction = async (fn, successMsg) => {
    try {
      await fn();
      if (successMsg) showToast(successMsg, 'success');
      await load();
    } catch (err) {
      showToast(err.message || 'Action failed', 'error');
    }
  };

  const filteredUsers = users.filter(u =>
    !userSearch.trim() ||
    u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredGames = games.filter(g => gameFilter === 'all' || g.status === gameFilter);

  const trialStats = trialData.stats || {};
  const convRate = trialStats.total > 0
    ? ((Number(trialStats.purchased || 0) / Number(trialStats.total)) * 100).toFixed(1)
    : 0;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="font-display" style={{ fontSize: 32, color: 'var(--danger)', margin: 0 }}>Admin Panel</h1>
        <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loadError && (
        <div className="card" style={{ padding: 16, marginBottom: 20, borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          {loadError}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 32, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        {TABS.map((t, i) => (
          <button key={t} type="button" onClick={() => setTab(i)} style={{
            padding: '10px 16px', background: 'none', border: 'none',
            borderBottom: tab === i ? '2px solid var(--danger)' : '2px solid transparent',
            color: tab === i ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600, fontSize: 14,
          }}>{t}</button>
        ))}
      </div>

      {loading && tab === 0 && !stats && (
        <div className="skeleton" style={{ height: 120 }} />
      )}

      {tab === 0 && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="glass" style={{ padding: 20, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>
                {STAT_LABELS[k] || k.replace(/_/g, ' ')}
              </p>
              <p className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>{formatStat(k, v)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 1 && !users.length && !loading && (
        <p style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>
          {loadError ? 'Could not load users.' : 'No users found.'}
        </p>
      )}

      {tab === 1 && !!users.length && (
        <>
          <input
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            placeholder="Search users…"
            style={{ width: '100%', maxWidth: 360, padding: 10, marginBottom: 16, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {['ID', 'Username', 'Email', 'Role', 'Cloud', 'Balance', 'Library', 'Friends', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.user_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>{u.user_id}</td>
                    <td style={{ padding: '10px 12px' }}>{u.username}</td>
                    <td style={{ padding: '10px 12px' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>{u.role}</td>
                    <td style={{ padding: '10px 12px' }}>{u.cloud_plan}</td>
                    <td style={{ padding: '10px 12px' }}>${parseFloat(u.balance || 0).toFixed(2)}</td>
                    <td style={{ padding: '10px 12px' }}>{u.library_count ?? 0}</td>
                    <td style={{ padding: '10px 12px' }}>{u.friend_count ?? 0}</td>
                    <td style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setEditUser({ ...u, balanceDelta: '' })}>Edit</button>
                      {u.role !== 'admin' && (
                        <button type="button" className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => {
                            if (!confirm(`Delete user ${u.username}?`)) return;
                            runAction(() => api.admin.deleteUser(u.user_id), 'User deleted');
                          }}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 2 && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['all', 'approved', 'pending', 'rejected'].map(f => (
              <button key={f} type="button" className={`btn ${gameFilter === f ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 14px', fontSize: 13, textTransform: 'capitalize' }}
                onClick={() => setGameFilter(f)}>{f}</button>
            ))}
          </div>
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {['Name', 'Genre', 'Price', 'Owners', 'Wishlist', 'Cloud', 'Size GB', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredGames.map(g => (
                  <tr key={g.game_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>{g.name}</td>
                    <td style={{ padding: '10px 12px' }}>{g.genre}</td>
                    <td style={{ padding: '10px 12px' }}>{g.is_free ? 'Free' : `$${g.price}`}</td>
                    <td style={{ padding: '10px 12px' }}>{g.owners_count ?? 0}</td>
                    <td style={{ padding: '10px 12px' }}>{g.wishlist_count ?? 0}</td>
                    <td style={{ padding: '10px 12px' }}>{g.cloud_enabled ? <Icon name="cloud" size={16} /> : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{g.download_size_gb ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{g.status}</td>
                    <td style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setEditGame({ ...g })}>Edit</button>
                      {g.status === 'pending' && (
                        <>
                          <button type="button" className="btn btn-success" style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => runAction(() => api.games.review(g.game_id, 'approve'), 'Approved')}>Approve</button>
                          <button type="button" className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => {
                              const reason = prompt('Rejection reason:');
                              if (!reason) return;
                              runAction(() => api.games.review(g.game_id, 'reject', reason), 'Rejected');
                            }}>Reject</button>
                        </>
                      )}
                      <button type="button" className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={() => {
                          if (!confirm('Delete this game?')) return;
                          runAction(() => api.games.delete(g.game_id), 'Game deleted');
                        }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 3 && (
        <div style={{ display: 'grid', gap: 32 }}>
          <div className="glass" style={{ padding: 24 }}>
            <h3 className="font-display" style={{ marginBottom: 8 }}>Hero Carousel</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
              Choose homepage hero slides and their order.
            </p>
            <div className="card" style={{ overflow: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    {['In Carousel', 'Order', 'Game'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {carouselDraft.map(g => (
                    <tr key={g.game_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <input type="checkbox" checked={g.inCarousel}
                          onChange={e => setCarouselDraft(prev => prev.map(x => x.game_id === g.game_id
                            ? { ...x, inCarousel: e.target.checked, order: e.target.checked ? prev.filter(y => y.inCarousel).length : 0 }
                            : x))} />
                      </td>
                      <td style={{ padding: '10px 12px', width: 80 }}>
                        <input type="number" min="0" value={g.order} disabled={!g.inCarousel}
                          onChange={e => setCarouselDraft(prev => prev.map(x => x.game_id === g.game_id ? { ...x, order: parseInt(e.target.value, 10) || 0 } : x))}
                          style={{ width: 60, padding: 6, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                      </td>
                      <td style={{ padding: '10px 12px' }}>{g.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => runAction(async () => {
              const items = carouselDraft.filter(g => g.inCarousel).sort((a, b) => a.order - b.order)
                .map((g, i) => ({ game_id: g.game_id, carousel_order: i }));
              await api.games.updateCarousel(items);
            }, 'Carousel updated')}>Save Carousel</button>
          </div>

          <div className="glass" style={{ padding: 24 }}>
            <h3 className="font-display" style={{ marginBottom: 8 }}>Store Discounts</h3>
            <div className="card" style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    {['Game', 'Price', 'Discount %', 'Expires', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {approvedGames.filter(g => !g.is_free).map(g => (
                    <tr key={g.game_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px' }}>{g.name}</td>
                      <td style={{ padding: '10px 12px' }}>${parseFloat(g.price).toFixed(2)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <input type="number" min="0" max="90" defaultValue={g.discount_percent ?? ''} placeholder="0"
                          onChange={e => { g._discountDraft = e.target.value; }}
                          style={{ width: 70, padding: 6, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <input type="datetime-local" defaultValue={g.discount_expires_at ? String(g.discount_expires_at).slice(0, 16) : ''}
                          onChange={e => { g._expiresDraft = e.target.value || null; }}
                          style={{ padding: 6, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => runAction(async () => {
                            const pct = g._discountDraft === '' ? null : parseInt(g._discountDraft, 10);
                            const expires = g._expiresDraft || null;
                            await api.games.update(g.game_id, { discount_percent: pct, discount_expires_at: expires });
                          }, `Discount saved for ${g.name}`)}>Save</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 4 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <div>
            <h3 className="font-display" style={{ marginBottom: 16 }}>Pending Games ({pending.length})</h3>
            {pending.map(g => (
              <div key={g.game_id} className="card" style={{ padding: 16, marginBottom: 12 }}>
                <strong>{g.name}</strong>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{g.genre} · {g.developer_name}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn btn-success" style={{ padding: '4px 12px', fontSize: 13 }}
                    onClick={() => runAction(() => api.games.review(g.game_id, 'approve'), 'Approved')}>Approve</button>
                  <button type="button" className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 13 }}
                    onClick={() => {
                      const reason = prompt('Rejection reason:');
                      if (!reason) return;
                      runAction(() => api.games.review(g.game_id, 'reject', reason), 'Rejected');
                    }}>Reject</button>
                </div>
              </div>
            ))}
            {!pending.length && <p style={{ color: 'var(--text-muted)' }}>No pending games</p>}
          </div>
          <div>
            <h3 className="font-display" style={{ marginBottom: 16 }}>Developer Requests ({devRequests.length})</h3>
            {devRequests.map(d => (
              <div key={d.user_id} className="card" style={{ padding: 16, marginBottom: 12 }}>
                <strong>{d.username}</strong> — {d.developer_company}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn btn-success" style={{ padding: '4px 12px', fontSize: 13 }}
                    onClick={() => runAction(() => api.admin.approveDev(d.user_id), 'Developer approved')}>Approve</button>
                  <button type="button" className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 13 }}
                    onClick={() => runAction(() => api.admin.rejectDev(d.user_id), 'Developer rejected')}>Reject</button>
                </div>
              </div>
            ))}
            {!devRequests.length && <p style={{ color: 'var(--text-muted)' }}>No pending requests</p>}
          </div>
        </div>
      )}

      {tab === 5 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="font-display" style={{ margin: 0 }}>Active Cloud Sessions</h3>
            <button type="button" className="btn btn-danger" style={{ fontSize: 13 }}
              onClick={() => {
                if (!confirm('Clear entire cloud queue?')) return;
                runAction(() => api.admin.clearQueue(), 'Queue cleared');
              }}>Clear Queue ({cloudData.queue?.length || 0})</button>
          </div>
          <div className="card" style={{ overflow: 'auto', marginBottom: 32 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {['User', 'Game', 'Plan', 'Started', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(cloudData.sessions || []).filter(s => s.status === 'active').map(s => (
                  <tr key={s.session_id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--neon-dim)' }}>
                    <td style={{ padding: '10px 12px' }}>{s.username}</td>
                    <td style={{ padding: '10px 12px' }}>{s.game_name}</td>
                    <td style={{ padding: '10px 12px' }}>{s.plan}</td>
                    <td style={{ padding: '10px 12px' }}>{new Date(s.started_at).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>{s.status}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button type="button" className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => runAction(() => api.cloud.forceEnd(s.session_id), 'Session ended')}>Force End</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="font-display" style={{ marginBottom: 16 }}>Queue</h3>
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {['User', 'Game', 'Status', 'Joined'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(cloudData.queue || []).map(q => (
                  <tr key={q.queue_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>{q.username}</td>
                    <td style={{ padding: '10px 12px' }}>{q.game_name}</td>
                    <td style={{ padding: '10px 12px' }}>{q.status}</td>
                    <td style={{ padding: '10px 12px' }}>{new Date(q.joined_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 6 && (
        <>
          <div className="glass" style={{ padding: 20, marginBottom: 24, textAlign: 'center' }}>
            <p className="font-display" style={{ fontSize: 18 }}>
              {trialStats.total || 0} started → {trialStats.completed || 0} completed → {trialStats.purchased || 0} purchased ({convRate}%)
            </p>
          </div>
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {['User', 'Game', 'Started', 'Duration', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(trialData.trials || []).map(t => (
                  <tr key={t.trial_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>{t.username}</td>
                    <td style={{ padding: '10px 12px' }}>{t.game_name}</td>
                    <td style={{ padding: '10px 12px' }}>{new Date(t.started_at).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>{t.duration_mins} min</td>
                    <td style={{ padding: '10px 12px' }}>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 7 && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {['Topic', 'Author', 'Posts', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forums.map(f => (
                <tr key={f.topic_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>{f.title}</td>
                  <td style={{ padding: '10px 12px' }}>{f.author}</td>
                  <td style={{ padding: '10px 12px' }}>{f.post_count}</td>
                  <td style={{ padding: '10px 12px' }}>{new Date(f.created_at).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button type="button" className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => {
                        if (!confirm(`Delete forum topic "${f.title}"?`)) return;
                        runAction(() => api.admin.deleteForumTopic(f.topic_id), 'Topic deleted');
                      }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!forums.length && <p style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>No forum topics</p>}
        </div>
      )}

      {tab === 8 && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {['User', 'Game', 'Price', 'Download', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.map((p, i) => (
                <tr key={`${p.user_id}-${p.game_id}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>{p.username}</td>
                  <td style={{ padding: '10px 12px' }}>{p.game_name}</td>
                  <td style={{ padding: '10px 12px' }}>${parseFloat(p.purchase_price || 0).toFixed(2)}</td>
                  <td style={{ padding: '10px 12px' }}>{p.download_status || 'none'}</td>
                  <td style={{ padding: '10px 12px' }}>{new Date(p.purchase_date).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!purchases.length && <p style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>No purchases yet</p>}
        </div>
      )}

      <Modal open={!!editGame} onClose={() => setEditGame(null)} title="Edit Game" wide>
        {editGame && (
          <>
            {['name', 'genre', 'price', 'short_desc', 'download_size_gb'].map(f => (
              <div key={f} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>{f.replace(/_/g, ' ')}</label>
                <input value={editGame[f] ?? ''} onChange={e => setEditGame({ ...editGame, [f]: e.target.value })}
                  style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
            ))}
            <label style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <label><input type="checkbox" checked={!!editGame.is_carousel} onChange={e => setEditGame({ ...editGame, is_carousel: e.target.checked })} /> Hero Carousel</label>
              <label><input type="checkbox" checked={!!editGame.cloud_enabled} onChange={e => setEditGame({ ...editGame, cloud_enabled: e.target.checked })} /> Cloud</label>
              <label><input type="checkbox" checked={!!editGame.is_featured} onChange={e => setEditGame({ ...editGame, is_featured: e.target.checked })} /> Featured</label>
              <label><input type="checkbox" checked={!!editGame.is_free} onChange={e => setEditGame({ ...editGame, is_free: e.target.checked })} /> Free</label>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Status</label>
                <select value={editGame.status || 'approved'} onChange={e => setEditGame({ ...editGame, status: e.target.value })}
                  style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <option value="approved">approved</option>
                  <option value="pending">pending</option>
                  <option value="rejected">rejected</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Carousel order</label>
                <input type="number" min="0" value={editGame.carousel_order ?? 0}
                  onChange={e => setEditGame({ ...editGame, carousel_order: parseInt(e.target.value, 10) || 0 })}
                  style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => runAction(async () => {
              const payload = { ...editGame };
              if (payload.discount_expires_at === '') payload.discount_expires_at = null;
              if (payload.discount_percent === '' || payload.discount_percent == null) payload.discount_percent = null;
              else payload.discount_percent = parseInt(payload.discount_percent, 10) || null;
              await api.games.update(editGame.game_id, payload);
              setEditGame(null);
            }, 'Game updated')}>Save</button>
          </>
        )}
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit User — ${editUser?.username}`}>
        {editUser && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Role</label>
              <select value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })}
                style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                <option value="user">user</option>
                <option value="developer">developer</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cloud plan</label>
              <select value={editUser.cloud_plan || 'free'} onChange={e => setEditUser({ ...editUser, cloud_plan: e.target.value })}
                style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                {['free', 'starter', 'pro', 'ultimate'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Set balance ($)</label>
              <input type="number" step="0.01" value={editUser.balance ?? 0} onChange={e => setEditUser({ ...editUser, balance: e.target.value })}
                style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Add funds ($)</label>
              <input type="number" step="0.01" placeholder="e.g. 50" value={editUser.balanceDelta}
                onChange={e => setEditUser({ ...editUser, balanceDelta: e.target.value })}
                style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>
            <button type="button" className="btn btn-primary" onClick={() => runAction(async () => {
              const payload = { role: editUser.role, cloud_plan: editUser.cloud_plan };
              if (editUser.balance !== '' && editUser.balance != null) payload.balance = parseFloat(editUser.balance);
              if (editUser.balanceDelta) payload.balance_delta = parseFloat(editUser.balanceDelta);
              await api.admin.updateUser(editUser.user_id, payload);
              setEditUser(null);
            }, 'User updated')}>Save</button>
          </>
        )}
      </Modal>
    </div>
  );
}
