import { useState, useEffect, useRef } from 'react';
import { api } from '../api/api';
import { useToast } from '../components/Toast';
import ImageInput from '../components/ImageInput';

export default function DeveloperPanel() {
  const [myGames, setMyGames] = useState([]);
  const imageRef = useRef(null);
  const [form, setForm] = useState({
    name: '', genre: '', short_desc: '', description: '', tags: '',
    price: '', is_free: false, requirements: '', trailer_url: '', cover_url: '',
    cloud_enabled: false, trial_enabled: true, trial_duration_mins: 30, trial_discount_percent: 10,
  });
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const load = () => api.games.my().then(setMyGames).catch(() => {});
  useEffect(() => { load(); }, []);

  const totals = myGames.reduce((acc, g) => ({
    owners: acc.owners + (g.owners_count || 0),
    trials: acc.trials + (g.trial_starts || 0),
    purchases: acc.purchases + (g.trial_purchases || 0),
  }), { owners: 0, trials: 0, purchases: 0 });

  const conversion = totals.trials > 0 ? ((totals.purchases / totals.trials) * 100).toFixed(1) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const hasFile = imageRef.current?.hasPendingFile?.();
      let coverUrl = form.cover_url;
      const result = await api.games.submit({
        ...form,
        cover_url: hasFile ? '' : coverUrl,
        price: form.is_free ? 0 : parseFloat(form.price) || 0,
        trial_duration_mins: parseInt(form.trial_duration_mins, 10) || 30,
        trial_discount_percent: parseInt(form.trial_discount_percent, 10) || 10,
      });
      if (hasFile && result.game_id) {
        coverUrl = await imageRef.current.resolveUrl(result.game_id);
      }
      showToast('Game submitted for review!', 'success');
      setForm({
        name: '', genre: '', short_desc: '', description: '', tags: '', price: '', is_free: false,
        requirements: '', trailer_url: '', cover_url: '', cloud_enabled: false,
        trial_enabled: true, trial_duration_mins: 30, trial_discount_percent: 10,
      });
      load();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="page">
      <h1 className="font-display gradient-text" style={{ fontSize: 32, marginBottom: 32 }}>Developer Panel</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 40 }}>
        {[['Total Owners', totals.owners], ['Trial Starts', totals.trials], ['Trial Purchases', totals.purchases], ['Conversion Rate', `${conversion}%`]].map(([l, v]) => (
          <div key={l} className="glass" style={{ padding: 20, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>{l}</p>
            <p className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <form onSubmit={handleSubmit} className="card" style={{ padding: 24 }}>
          <h2 className="font-display" style={{ fontSize: 22, marginBottom: 20 }}>Submit New Game</h2>
          {[
            ['name', 'Game Name', 'text'], ['genre', 'Genre', 'text'],
            ['short_desc', 'Short Description', 'text'], ['description', 'Full Description', 'textarea'],
            ['tags', 'Tags (comma-separated)', 'text'], ['price', 'Price ($)', 'number'],
            ['requirements', 'System Requirements', 'textarea'],
            ['trailer_url', 'Trailer URL (YouTube embed)', 'text'],
          ].map(([key, label, type]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
              {type === 'textarea' ? (
                <textarea value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} rows={3}
                  style={{ width: '100%', padding: 8, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              ) : (
                <input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                  disabled={key === 'price' && form.is_free}
                  style={{ width: '100%', padding: 8, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              )}
            </div>
          ))}
          <ImageInput ref={imageRef} value={form.cover_url} onChange={url => setForm({ ...form, cover_url: url })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_free} onChange={e => setForm({ ...form, is_free: e.target.checked })} /> Free Game
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.cloud_enabled} onChange={e => setForm({ ...form, cloud_enabled: e.target.checked })} /> GeForce Now Ready
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.trial_enabled} onChange={e => setForm({ ...form, trial_enabled: e.target.checked })} /> Enable Free Trial
          </label>
          {form.trial_enabled && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Trial Duration (min)</label>
                <input type="number" value={form.trial_duration_mins} onChange={e => setForm({ ...form, trial_duration_mins: e.target.value })}
                  style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Expiry Discount (%)</label>
                <input type="number" value={form.trial_discount_percent} onChange={e => setForm({ ...form, trial_discount_percent: e.target.value })}
                  style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </button>
        </form>

        <div>
          <h2 className="font-display" style={{ fontSize: 22, marginBottom: 20 }}>My Games</h2>
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {['Name', 'Genre', 'Price', 'GFN', 'Trial', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myGames.map(g => (
                  <tr key={g.game_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>{g.name}</td>
                    <td style={{ padding: '10px 12px' }}>{g.genre}</td>
                    <td style={{ padding: '10px 12px' }}>{g.is_free ? 'Free' : `$${g.price}`}</td>
                    <td style={{ padding: '10px 12px' }}>{g.cloud_enabled ? '✓' : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{g.trial_enabled !== false ? `${g.trial_duration_mins || 30}m` : '—'}</td>
                    <td style={{ padding: '10px 12px', textTransform: 'capitalize', color: g.status === 'approved' ? 'var(--accent-trial)' : g.status === 'pending' ? 'var(--accent)' : 'var(--danger)' }}>{g.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!myGames.length && <p style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No games submitted yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
