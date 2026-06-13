import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import HeroCarousel from '../components/HeroCarousel';
import SearchBar from '../components/SearchBar';
import GameCard from '../components/GameCard';

function Section({ title, titleColor, children, emptyText }) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <section className="shop-section">
      <h2 className="section-title" style={titleColor ? { color: titleColor } : {}}>{title}</h2>
      <div className="scroll-row">
        {isEmpty ? <p style={{ color: 'var(--text-muted)', padding: '8px 4px' }}>{emptyText}</p> : children}
      </div>
    </section>
  );
}

async function loadShopData() {
  const errors = [];
  const pick = async (fn, fallback = null) => {
    try {
      return await fn();
    } catch (err) {
      errors.push(err.message);
      return fallback;
    }
  };

  const list = await pick(() => api.games.list('limit=20'), { games: [] });
  const allGames = list?.games || [];

  let carousel = await pick(() => api.games.carousel(), []);
  if (!carousel?.length) carousel = await pick(() => api.games.featured(), []);
  if (!carousel?.length) carousel = allGames.slice(0, 5);

  const onSale = await pick(() => api.games.onSale(), []);
  let newReleases = await pick(() => api.games.newReleases(), []);
  if (!newReleases?.length) newReleases = allGames;

  let trialGames = (await pick(() => api.games.list('trial=1&limit=10'), { games: [] }))?.games || [];
  if (!trialGames.length) {
    trialGames = allGames.filter(g => g.trial_enabled !== false && !g.is_free);
  }

  let cloudGames = (await pick(() => api.games.list('cloud=1&limit=10'), { games: [] }))?.games || [];
  if (!cloudGames.length) {
    cloudGames = allGames.filter(g => g.cloud_enabled);
  }

  const apiDown = errors.length >= 4 && !allGames.length;

  return { carousel, onSale, newReleases, trialGames, cloudGames, apiDown };
}

export default function ShopPage() {
  const [carousel, setCarousel] = useState([]);
  const [onSale, setOnSale] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [trialGames, setTrialGames] = useState([]);
  const [cloudGames, setCloudGames] = useState([]);
  const [trials, setTrials] = useState({});
  const [apiDown, setApiDown] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isAuth } = useAuth();

  useEffect(() => {
    loadShopData().then(data => {
      setCarousel(data.carousel);
      setOnSale(data.onSale);
      setNewReleases(data.newReleases);
      setTrialGames(data.trialGames);
      setCloudGames(data.cloudGames);
      setApiDown(data.apiDown);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!isAuth) return;
    api.trials.history().then(h => {
      const m = {}; h.forEach(t => { m[t.game_id] = t.status; }); setTrials(m);
    }).catch(() => {});
  }, [isAuth]);

  const cardWrap = (g) => (
    <div key={g.game_id} className="scroll-row-item">
      <GameCard game={g} trialStatus={trials[g.game_id]} />
    </div>
  );

  return (
    <div>
      {apiDown && (
        <div style={{
          background: 'rgba(255,77,106,0.15)', borderBottom: '1px solid var(--danger)',
          padding: '12px 20px', textAlign: 'center', fontSize: 14, color: 'var(--danger)',
        }}>
          Cannot reach the game server. Start the API from the server folder with npm run dev,
          make sure MySQL is running, then refresh.
        </div>
      )}
      {!loading && carousel.length > 0 && <HeroCarousel games={carousel} />}
      <SearchBar />
      <div className="page">
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 32, fontSize: 15 }}>
          Own it. Try it. Stream it. — Your next-gen game storefront.
        </p>

        {loading && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 48 }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton scroll-row-item" style={{ height: 280, borderRadius: 12 }} />)}
          </div>
        )}

        {!loading && onSale.length > 0 && (
          <Section title="Deals & Discounts" titleColor="var(--danger)">
            {onSale.map(cardWrap)}
          </Section>
        )}

        <Section title="New & Trending" emptyText={loading ? '' : 'No games yet — run node seed.js to populate the store.'}>
          {!loading && newReleases.slice(0, 8).map(cardWrap)}
        </Section>

        <Section title="Free to Try" titleColor="var(--accent-trial)" emptyText={loading ? '' : 'No trial games available.'}>
          {!loading && trialGames.map(cardWrap)}
        </Section>

        <Section title="Cloud Ready — GeForce Now" titleColor="var(--accent-cloud)" emptyText={loading ? '' : 'No cloud-ready games yet.'}>
          {!loading && cloudGames.map(cardWrap)}
        </Section>
      </div>
    </div>
  );
}
