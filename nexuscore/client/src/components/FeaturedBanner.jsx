import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function FeaturedBanner({ games }) {
  const [idx, setIdx] = useState(0);
  const game = games[idx];

  useEffect(() => {
    if (games.length <= 1) return;
    const iv = setInterval(() => setIdx(i => (i + 1) % games.length), 6000);
    return () => clearInterval(iv);
  }, [games.length]);

  if (!game) return null;

  return (
    <section style={{
      position: 'relative', minHeight: '85vh', display: 'flex', alignItems: 'center',
      overflow: 'hidden', margin: '-24px -20px 40px',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${game.cover_url})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(20px) brightness(0.3)', transform: 'scale(1.1)',
      }} />
      <div className="page" style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 48, alignItems: 'center', width: '100%' }}>
        <div style={{ flex: 1 }}>
          <span style={{
            background: 'var(--accent-dim)', color: 'var(--accent-glow)',
            padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
          }}>{game.genre}</span>
          <h1 className="font-display" style={{ fontSize: 'clamp(48px, 8vw, 72px)', fontWeight: 700, margin: '16px 0', lineHeight: 1 }}>
            {game.name}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 18, maxWidth: 500, marginBottom: 28, lineHeight: 1.6 }}>
            {game.short_desc}
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              background: 'var(--bg-elevated)', padding: '8px 16px', borderRadius: 'var(--radius)',
              fontWeight: 600, fontSize: 18,
            }}>
              {game.is_free ? 'Free' : `$${parseFloat(game.price).toFixed(2)}`}
            </span>
            <Link to={`/games/${game.slug || game.game_id}`} className="btn btn-primary">View Game</Link>
            {game.cloud_enabled && (
              <Link to={`/games/${game.slug || game.game_id}`} className="btn btn-neon">☁ Stream Now</Link>
            )}
          </div>
        </div>
        <div className="conic-border featured-thumb" style={{ flexShrink: 0 }}>
          <img src={game.cover_url} alt={game.name}
            style={{ width: 280, height: 392, objectFit: 'cover', display: 'block' }} />
        </div>
      </div>

      {games.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + games.length) % games.length)}
            style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
              background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', width: 44, height: 44, borderRadius: '50%', fontSize: 20 }}>
            ‹
          </button>
          <button onClick={() => setIdx(i => (i + 1) % games.length)}
            style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
              background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', width: 44, height: 44, borderRadius: '50%', fontSize: 20 }}>
            ›
          </button>
          <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 2 }}>
            {games.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} style={{
                width: i === idx ? 24 : 8, height: 8, borderRadius: 4, border: 'none',
                background: i === idx ? 'var(--accent)' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s',
              }} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
