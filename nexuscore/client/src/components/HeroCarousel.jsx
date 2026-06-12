import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTrial } from '../context/TrialContext';
import BuyModal from './BuyModal';
import Icon from './Icon';
import DiscountBadge, { formatGamePrice } from './DiscountBadge';

const INTERVAL_MS = 5000;

export default function HeroCarousel({ games }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [buyGame, setBuyGame] = useState(null);
  const { isAuth } = useAuth();
  const { startTrial } = useTrial();
  const navigate = useNavigate();

  useEffect(() => {
    if (games.length <= 1 || paused) return;
    const iv = setInterval(() => setIdx(i => (i + 1) % games.length), INTERVAL_MS);
    return () => clearInterval(iv);
  }, [games.length, paused]);

  if (!games.length) return null;

  const goTo = (i) => setIdx((i + games.length) % games.length);

  const handleTry = async (e, game) => {
    e.preventDefault();
    if (!isAuth) { navigate('/login'); return; }
    if (game.trial_enabled === false) return;
    try {
      await startTrial(game.game_id);
      navigate(`/games/${game.slug || game.game_id}`);
    } catch (err) { alert(err.message); }
  };

  return (
    <>
      <section
        className="hero-carousel"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {games.map((g, i) => (
          <div
            key={g.game_id}
            className={`hero-carousel-bg ${i === idx ? 'active' : ''}`}
            style={{ backgroundImage: `url(${g.cover_url})` }}
            aria-hidden={i !== idx}
          />
        ))}
        <div className="hero-carousel-overlay" />

        <div className="page hero-carousel-inner">
          {games.map((g, i) => (
            <div
              key={g.game_id}
              className={`hero-carousel-content ${i === idx ? 'active' : ''}`}
              aria-hidden={i !== idx}
            >
              <span className="hero-genre">{g.genre}</span>
              <h1 className="font-display hero-title">{g.name}</h1>
              <p className="hero-desc">{g.short_desc}</p>
              <div className="hero-actions">
                {(() => {
                  const pricing = formatGamePrice(g);
                  return (
                    <>
                      {pricing.hasSale && <DiscountBadge percent={g.discount_active} />}
                      <span className="hero-price">
                        {pricing.hasSale && (
                          <span style={{ textDecoration: 'line-through', color: 'var(--text-dim)', fontSize: 18, marginRight: 8 }}>
                            ${pricing.base.toFixed(2)}
                          </span>
                        )}
                        {g.is_free ? 'Free' : pricing.label}
                      </span>
                    </>
                  );
                })()}
                {g.trial_enabled !== false && (
                  <button type="button" className="btn btn-trial" onClick={e => handleTry(e, g)}>Try Free</button>
                )}
                <button type="button" className="btn btn-primary" onClick={() => isAuth ? setBuyGame(g) : navigate('/login')}>Buy Now</button>
                <Link to={`/games/${g.slug || g.game_id}`} className="btn btn-ghost">View Details</Link>
              </div>
            </div>
          ))}
        </div>

        {games.length > 1 && (
          <>
            <button type="button" className="carousel-arrow carousel-arrow-left" onClick={() => goTo(idx - 1)} aria-label="Previous slide">
              <Icon name="chevronLeft" size={22} />
            </button>
            <button type="button" className="carousel-arrow carousel-arrow-right" onClick={() => goTo(idx + 1)} aria-label="Next slide">
              <Icon name="chevronRight" size={22} />
            </button>
            <div className="carousel-dots">
              {games.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`carousel-dot ${i === idx ? 'active' : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </section>
      <BuyModal open={!!buyGame} onClose={() => setBuyGame(null)} game={buyGame} />
    </>
  );
}
