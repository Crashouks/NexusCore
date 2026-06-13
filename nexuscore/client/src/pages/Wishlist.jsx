import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useWishlist } from '../context/WishlistContext';
import BuyModal from '../components/BuyModal';
import GameCard from '../components/GameCard';

export default function Wishlist() {
  const [games, setGames] = useState([]);
  const [buyGame, setBuyGame] = useState(null);
  const { refresh } = useWishlist();

  useEffect(() => {
    api.wishlist.list().then(setGames).catch(() => {});
  }, []);

  const handleRemove = async (gameId) => {
    await api.wishlist.remove(gameId);
    await refresh();
    setGames(g => g.filter(x => x.game_id !== gameId));
  };

  return (
    <div className="page">
      <h1 className="font-display" style={{ fontSize: 32, marginBottom: 24 }}>Wishlist</h1>
      {games.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 60 }}>No games in your wishlist yet.</p>
      ) : (
        <div className="game-grid">
          {games.map(g => (
            <div key={g.game_id} style={{ position: 'relative' }}>
              <GameCard game={g} />
              <div style={{ display: 'flex', gap: 8, padding: '0 4px 8px' }}>
                <button className="btn btn-primary" style={{ flex: 1, fontSize: 12, padding: '6px' }} onClick={() => setBuyGame(g)}>Buy</button>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => handleRemove(g.game_id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <BuyModal open={!!buyGame} onClose={() => setBuyGame(null)} game={buyGame} />
    </div>
  );
}
