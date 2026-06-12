import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import BuyModal from '../components/BuyModal';
import PlanCard from '../components/PlanCard';
import Icon from '../components/Icon';

export default function Profile() {
  const { profile, refreshProfile, library } = useAuth();
  const [trials, setTrials] = useState([]);
  const [activeTrials, setActiveTrials] = useState([]);
  const [friends, setFriends] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ bio: '', country: '' });
  const [countries, setCountries] = useState([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);
  const [buyGame, setBuyGame] = useState(null);
  const [plansData, setPlansData] = useState(null);
  const [subscribePlan, setSubscribePlan] = useState(null);
  const [cloudHistory, setCloudHistory] = useState({ sessions: [], total: 0 });
  const [cloudHistoryPage, setCloudHistoryPage] = useState(1);
  const { showToast } = useToast();

  useEffect(() => {
    if (!profile) return;
    api.trials.history().then(setTrials);
    api.trials.active().then(setActiveTrials).catch(() => {});
    api.users.friends(profile.user_id).then(setFriends);
    setEditForm({ bio: profile.bio || '', country: profile.country || '' });
  }, [profile]);

  useEffect(() => {
    api.cloud.plans().then(setPlansData).catch(() => {});
    api.users.countries().then(setCountries).catch(() => []);
  }, []);

  useEffect(() => {
    api.cloud.sessionHistory(cloudHistoryPage).then(setCloudHistory).catch(() => {});
  }, [cloudHistoryPage]);

  useEffect(() => {
    if (window.location.hash === '#cloud-plans') {
      document.getElementById('cloud-plans')?.scrollIntoView({ behavior: 'smooth' });
    }
    if (window.location.hash === '#cloud-sessions') {
      document.getElementById('cloud-sessions')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [profile]);

  const handleTopup = async (amount) => {
    try {
      const r = await api.users.topup(profile.user_id, amount);
      showToast(`Added $${amount}! Balance: $${parseFloat(r.balance).toFixed(2)}`, 'success');
      await refreshProfile();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleSave = async () => {
    try {
      await api.users.update(profile.user_id, {
        bio: editForm.bio,
        country: editForm.country,
        avatar_url: profile.avatar_url,
      });
      await refreshProfile();
      setEditOpen(false);
      showToast('Profile updated', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Avatar must be 10 MB or smaller', 'error');
      return;
    }
    setAvatarUploading(true);
    try {
      await api.media.uploadAvatar(file);
      await refreshProfile();
      showToast('Avatar updated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSubscribe = async () => {
    try {
      await api.cloud.subscribe(subscribePlan.name);
      await refreshProfile();
      showToast(`Subscribed to ${subscribePlan.display_name}!`, 'success');
      setSubscribePlan(null);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDevRequest = async () => {
    const company = prompt('Company name:');
    if (!company) return;
    try {
      await api.users.requestDeveloper(company);
      showToast('Application submitted!', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  if (!profile) return <div className="page">Loading...</div>;

  const currentPlan = profile.cloud_plan || 'free';

  const statusBadge = (s) => {
    const colors = { active: 'var(--trial)', completed: 'var(--text-muted)', purchased: 'var(--neon)' };
    return <span style={{ color: colors[s] || 'var(--text)', fontWeight: 600, textTransform: 'capitalize' }}>{s}</span>;
  };

  return (
    <div className="page">
      <div className="profile-dashboard">
        <div className="card profile-dash-card profile-dash-card--profile">
          <div className="profile-dash-card__body">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} />
                ) : (
                  profile.username[0].toUpperCase()
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost profile-avatar-upload"
                title="Upload avatar (max 10 MB)"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Icon name="upload" size={14} />
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            </div>
            {avatarUploading && <p className="profile-dash-meta">Uploading…</p>}
            <h1 className="profile-dash-username">{profile.username}</h1>
            <p className="profile-dash-bio">{profile.bio || 'No bio yet'}</p>
            <p className="profile-dash-country">{profile.country || 'Earth'}</p>
          </div>
          <div className="profile-dash-card__footer">
            <button className="btn btn-ghost" onClick={() => setEditOpen(true)}>Edit Profile</button>
            {profile.role === 'user' && !profile.is_developer_approved && (
              <button className="btn btn-primary" onClick={handleDevRequest}>Apply as Developer</button>
            )}
          </div>
        </div>

        <div className="card profile-dash-card">
          <h3 className="profile-dash-card__head profile-dash-card__head--neon">
            <Icon name="cloud" size={18} /> Cloud Plan
          </h3>
          <div className="profile-dash-card__body">
            <p className="profile-dash-value">{currentPlan}</p>
            <p className="profile-dash-meta">
              {currentPlan === 'free' ? 'Free tier — 1 hr/day with queue' :
                profile.cloud_plan_expires ? `Expires: ${new Date(profile.cloud_plan_expires).toLocaleDateString()}` : 'Active subscription'}
            </p>
          </div>
          <div className="profile-dash-card__footer">
            <a href="#cloud-plans" className="btn btn-neon" style={{ fontSize: 13 }}>Change Plan</a>
            <a href="#cloud-sessions" className="btn btn-ghost" style={{ fontSize: 13 }}>Session History</a>
            <Link to="/cloud" className="btn btn-ghost" style={{ fontSize: 13 }}>Go to Cloud Play</Link>
          </div>
        </div>

        <div className="card profile-dash-card">
          <h3 className="profile-dash-card__head">Wallet</h3>
          <div className="profile-dash-card__body">
            <p className="profile-dash-value profile-dash-value--balance">${parseFloat(profile.balance).toFixed(2)}</p>
            <p className="profile-dash-meta">Add funds to your balance</p>
          </div>
          <div className="profile-dash-card__footer">
            <div className="profile-topup-row">
              {[5, 10, 50, 100].map(a => (
                <button key={a} className="btn btn-ghost" onClick={() => handleTopup(a)}>+${a}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="card profile-dash-card">
          <h3 className="profile-dash-card__head">Stats</h3>
          <div className="profile-dash-card__body">
            {[
              ['Games Owned', library.length],
              ['Friends', friends.length],
              ['Trials Used', trials.length],
            ].map(([l, v]) => (
              <div key={l} className="profile-stat-row">
                <span>{l}</span><strong>{v}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section id="cloud-plans" className="profile-section">
        <h2 className="section-title" style={{ color: 'var(--accent-cloud)' }}>GeForce NOW Plans</h2>
        <p className="profile-section-desc">
          Upgrade your cloud streaming tier. Paid plans skip the queue and unlock higher quality.
        </p>
        <div className="profile-plans-grid">
          <PlanCard isFree currentPlan={currentPlan} />
          {plansData?.plans?.map(p => (
            <PlanCard key={p.plan_id} plan={p} currentPlan={currentPlan} onSubscribe={setSubscribePlan} />
          ))}
        </div>
      </section>

      <section id="cloud-sessions" className="profile-section">
        <h2 className="section-title">Cloud Play History</h2>
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {['Game', 'Plan', 'Date', 'Duration', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cloudHistory.sessions.length ? cloudHistory.sessions.map(s => (
                <tr key={s.session_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px' }}>{s.name}</td>
                  <td style={{ padding: '12px 16px' }}>{s.plan}</td>
                  <td style={{ padding: '12px 16px' }}>{new Date(s.started_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px' }}>{s.duration_mins} min</td>
                  <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{s.status}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No cloud sessions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {Math.ceil(cloudHistory.total / 10) > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {Array.from({ length: Math.ceil(cloudHistory.total / 10) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`btn ${p === cloudHistoryPage ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setCloudHistoryPage(p)}>{p}</button>
            ))}
          </div>
        )}
      </section>

      {activeTrials.length > 0 && (
        <section className="profile-section">
          <h2 className="section-title" style={{ color: 'var(--accent-trial)' }}>Currently Trying</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeTrials.map(t => (
              <div key={t.trial_id} className="card" style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                <img src={t.cover_url} alt={t.name} style={{ width: 48, height: 68, objectFit: 'cover', borderRadius: 6 }} />
                <div style={{ flex: 1 }}>
                  <Link to={`/games/${t.slug || t.game_id}`} style={{ fontWeight: 600 }}>{t.name}</Link>
                  <div className="progress-bar" style={{ marginTop: 8, maxWidth: 300 }}>
                    <div className="progress-bar-fill" style={{ width: `${t.progressPercent || 0}%` }} />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t.minutesRemaining} min remaining</p>
                </div>
                <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setBuyGame(t)}>Buy — ${parseFloat(t.price).toFixed(2)}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="profile-section">
        <h2 className="section-title">Trial History</h2>
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {['Game', 'Date', 'Duration', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trials.length ? trials.map(t => (
                <tr key={t.trial_id} style={{ borderBottom: '1px solid var(--border)', cursor: t.status === 'completed' ? 'pointer' : 'default' }}
                  onClick={() => t.status === 'completed' && setBuyGame(t)}>
                  <td style={{ padding: '12px 16px' }}>{t.name}</td>
                  <td style={{ padding: '12px 16px' }}>{new Date(t.started_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px' }}>{t.duration_mins} min</td>
                  <td style={{ padding: '12px 16px' }}>{statusBadge(t.status)}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No trials yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="profile-section">
        <h2 className="section-title">Friends ({friends.length})</h2>
        {friends.length ? (
          <div className="profile-friends-grid">
            {friends.map(f => (
              <div key={f.user_id} className="card profile-friend-chip">
                <div className="profile-avatar">
                  {f.avatar_url ? (
                    <img src={f.avatar_url} alt={f.username} />
                  ) : (
                    f.username[0].toUpperCase()
                  )}
                </div>
                <span style={{ fontWeight: 600 }}>{f.username}</span>
              </div>
            ))}
          </div>
        ) : <p style={{ color: 'var(--text-muted)' }}>No friends yet. <Link to="/community?tab=friends" style={{ color: 'var(--accent-glow)' }}>Find friends</Link></p>}
      </section>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile">
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Bio</label>
          <textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} rows={3}
            style={{ width: '100%', padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Country</label>
          <select
            value={editForm.country}
            onChange={e => setEditForm({ ...editForm, country: e.target.value })}
            style={{ width: '100%', padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="">Select country…</option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
            {editForm.country && !countries.includes(editForm.country) && (
              <option value={editForm.country}>{editForm.country}</option>
            )}
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>Save</button>
      </Modal>

      <BuyModal open={!!buyGame} onClose={() => setBuyGame(null)} game={buyGame} />

      <Modal open={!!subscribePlan} onClose={() => setSubscribePlan(null)} title="Confirm Subscription">
        {subscribePlan && (
          <>
            <p style={{ marginBottom: 16 }}>Subscribe to <strong>{subscribePlan.display_name}</strong> for ${parseFloat(subscribePlan.price_monthly).toFixed(2)}/mo?</p>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Balance: ${parseFloat(profile.balance || 0).toFixed(2)}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubscribe}>Confirm</button>
              <button className="btn btn-ghost" onClick={() => setSubscribePlan(null)}>Cancel</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
