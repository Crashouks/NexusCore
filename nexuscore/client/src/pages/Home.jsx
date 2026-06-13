import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import FeaturedBanner from '../components/FeaturedBanner';
import GameCard from '../components/GameCard';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [cloudGames, setCloudGames] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [genres, setGenres] = useState([]);
  const [trials, setTrials] = useState({});
  const { isAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.games.featured().then(setFeatured).catch(() => {});
    api.games.newReleases().then(setNewReleases).catch(() => {});
    api.games.list('cloud=1&limit=8').then(d => setCloudGames(d.games)).catch(() => {});
    api.games.list('limit=20').then(d => {
      setAllGames(d.games);
      const g = [...new Set(d.games.map(x => x.genre).filter(Boolean))];
      setGenres(g);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuth) return;
    api.trials.history().then(history => {
      const map = {};
      history.forEach(t => { map[t.game_id] = t.status; });
      setTrials(map);
    }).catch(() => {});
  }, [isAuth]);

  const scrollRow = (children) => (
    <div className="scroll-row">
      {children}
    </div>
  );

  return (
    <div>
      <FeaturedBanner games={featured} />

      <div className="page">
        <div className="feature-grid">
          {[
            { icon: '🎮', title: 'Massive Catalog', desc: 'Hundreds of games, buy once, own forever.' },
            { icon: '☁', title: 'Cloud Play', desc: 'Stream in 4K. No hardware required.', color: 'var(--neon)' },
            { icon: '⏱', title: 'Free Trials', desc: '30 minutes free. No credit card.', color: 'var(--trial)' },
          ].map(f => (
            <div key={f.title} style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 'clamp(28px, 6vw, 36px)', marginBottom: 8 }}>{f.icon}</div>
              <h3 className="font-display" style={{ fontSize: 'clamp(16px, 3vw, 20px)', fontWeight: 700, color: f.color || 'var(--accent-glow)', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        <section className="shop-section">
          <h2 className="section-title">New Releases</h2>
          {scrollRow(newReleases.slice(0, 6).map(g => (
            <div key={g.game_id} className="scroll-row-item">
              <GameCard game={g} trialStatus={trials[g.game_id]} />
            </div>
          )))}
        </section>

        <section className="shop-section">
          <h2 className="section-title" style={{ color: 'var(--neon)' }}>☁ Cloud Play Ready</h2>
          {scrollRow(cloudGames.map(g => (
            <div key={g.game_id} className="scroll-row-item">
              <GameCard game={g} trialStatus={trials[g.game_id]} />
            </div>
          )))}
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 className="section-title">Browse by Genre</h2>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
            {genres.map(g => (
              <button key={g} className="btn btn-ghost" style={{ flexShrink: 0 }}
                onClick={() => navigate(`/store?genre=${encodeURIComponent(g)}`)}>
                {g}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="section-title">All Games</h2>
          <div className="game-grid">
            {allGames.map(g => (
              <GameCard key={g.game_id} game={g} trialStatus={trials[g.game_id]} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
