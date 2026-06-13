import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import GameCard from '../components/GameCard';

const GENRES = ['Action', 'RPG', 'Racing', 'Strategy', 'Adventure'];
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
  { value: 'az', label: 'A–Z' },
  { value: 'rating', label: 'Rating' },
];

export default function Store() {
  const [params, setParams] = useSearchParams();
  const [games, setGames] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [trials, setTrials] = useState({});
  const { isAuth } = useAuth();

  const search = params.get('search') || '';
  const genre = params.get('genre') || '';
  const priceFilter = params.get('price') || 'all';
  const cloudOnly = params.get('cloud') === '1';
  const trialOnly = params.get('trial') === '1';
  const upcomingOnly = params.get('upcoming') === '1';
  const sort = params.get('sort') || 'newest';
  const page = parseInt(params.get('page') || '1', 10);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (genre) q.set('genre', genre);
    if (cloudOnly) q.set('cloud', '1');
    if (trialOnly) q.set('trial', '1');
    if (upcomingOnly) q.set('upcoming', '1');
    if (priceFilter === 'free') q.set('free', '1');
    q.set('sort', sort);
    q.set('page', page);
    q.set('limit', '20');

    api.games.list(q.toString()).then(d => {
      let filtered = d.games;
      if (priceFilter === 'under10') filtered = filtered.filter(g => parseFloat(g.price) < 10);
      if (priceFilter === 'under25') filtered = filtered.filter(g => parseFloat(g.price) < 25);
      setGames(filtered);
      setTotal(d.total);
    }).finally(() => setLoading(false));
  }, [search, genre, priceFilter, cloudOnly, trialOnly, upcomingOnly, sort, page]);

  useEffect(() => {
    if (!isAuth) return;
    api.trials.history().then(h => {
      const m = {}; h.forEach(t => { m[t.game_id] = t.status; }); setTrials(m);
    });
  }, [isAuth]);

  const update = (key, val) => {
    const p = new URLSearchParams(params);
    if (val) p.set(key, val); else p.delete(key);
    p.delete('page');
    setParams(p);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="page store-layout">
      <aside className="store-filters">
        <h2 className="font-display" style={{ fontSize: 22, marginBottom: 20 }}>Filters</h2>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Search</label>
          <input value={search} onChange={e => update('search', e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Genre</label>
          {GENRES.map(g => (
            <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={genre === g} onChange={() => update('genre', genre === g ? '' : g)} />
              {g}
            </label>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Price</label>
          {[{ v: 'all', l: 'All' }, { v: 'free', l: 'Free' }, { v: 'under10', l: 'Under $10' }, { v: 'under25', l: 'Under $25' }].map(p => (
            <label key={p.v} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 14, cursor: 'pointer' }}>
              <input type="radio" name="price" checked={priceFilter === p.v} onChange={() => update('price', p.v === 'all' ? '' : p.v)} />
              {p.l}
            </label>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" checked={trialOnly} onChange={() => update('trial', trialOnly ? '' : '1')} />
          Free to Try
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" checked={upcomingOnly} onChange={() => update('upcoming', upcomingOnly ? '' : '1')} />
          Upcoming
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', marginBottom: 20 }}>
          <input type="checkbox" checked={cloudOnly} onChange={() => update('cloud', cloudOnly ? '' : '1')} />
          GeForce Now Ready
        </label>
        <div>
          <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Sort</label>
          <select value={sort} onChange={e => update('sort', e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </aside>

      <main className="store-main">
        <h1 className="font-display page-heading">Store</h1>
        {loading ? (
          <div className="game-grid">
            {Array(8).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 280 }} />)}
          </div>
        ) : games.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 60 }}>No games found.</p>
        ) : (
          <>
            <div className="game-grid">
              {games.map(g => <GameCard key={g.game_id} game={g} trialStatus={trials[g.game_id]} />)}
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`btn ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ padding: '6px 14px' }}
                    onClick={() => { const np = new URLSearchParams(params); np.set('page', p); setParams(np); }}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
