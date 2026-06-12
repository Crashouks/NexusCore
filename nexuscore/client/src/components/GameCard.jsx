import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import { useTrial } from '../context/TrialContext';
import { useToast } from './Toast';
import CloudBadge from './CloudBadge';
import TrialBadge from './TrialBadge';
import DiscountBadge, { formatGamePrice } from './DiscountBadge';
import Icon from './Icon';

export default function GameCard({ game, trialStatus }) {
  const { ownsGame, isAuth } = useAuth();
  const { toggle: toggleWishlist, isWishlisted } = useWishlist();
  const { refresh: refreshNotifications } = useNotifications();
  const { startTrial } = useTrial();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const owned = ownsGame(game.game_id);
  const trialActive = trialStatus === 'active';
  const trialUsed = trialStatus === 'completed' || trialStatus === 'purchased';
  const canTrial = game.trial_enabled !== false && !owned && !trialUsed;
  const pricing = formatGamePrice(game);

  let borderColor = 'transparent';
  if (owned) borderColor = 'var(--accent)';
  else if (trialActive || trialUsed) borderColor = 'var(--accent-trial)';

  const handleTry = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!isAuth) { navigate('/login'); return; }
    try {
      await startTrial(game.game_id);
      showToast('Trial started!', 'success');
      navigate(`/games/${game.slug || game.game_id}`);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleWishlist = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!isAuth) { navigate('/login'); return; }
    const wasListed = isWishlisted(game.game_id);
    try {
      await toggleWishlist(game.game_id);
      if (!wasListed) await refreshNotifications();
      else showToast('Removed from wishlist', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <Link to={`/games/${game.slug || game.game_id}`} className="card game-card" style={{
      borderLeft: `4px solid ${borderColor}`, display: 'block', position: 'relative',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--glow)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ position: 'relative', aspectRatio: '5/7', overflow: 'hidden' }}>
        <img src={game.cover_url || 'https://picsum.photos/400/560'} alt={game.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          {pricing.hasSale && <DiscountBadge percent={game.discount_active} small />}
        </div>
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          {game.cloud_enabled && <CloudBadge small />}
          {canTrial && <TrialBadge small />}
        </div>
        {owned && (
          <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.8)', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>Owned</div>
        )}
        <div className="game-card-overlay">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>{game.short_desc}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {canTrial && <button className="btn btn-trial" style={{ padding: '6px 10px', fontSize: 12 }} onClick={handleTry}>Try</button>}
            <button
              className={`btn btn-ghost wishlist-btn ${isWishlisted(game.game_id) ? 'active' : ''}`}
              style={{ padding: '6px 10px', fontSize: 12 }}
              onClick={handleWishlist}
              aria-label={isWishlisted(game.game_id) ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Icon name="heart" size={16} filled={isWishlisted(game.game_id)} />
            </button>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <h3 className="font-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{game.name}</h3>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {game.genre && <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: 4 }}>{game.genre}</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: canTrial && !game.is_free && !pricing.hasSale ? 'var(--accent-trial)' : game.is_free ? 'var(--success)' : pricing.hasSale ? 'var(--danger)' : 'var(--text)' }}>
            {game.is_free ? 'Free' : canTrial && !pricing.hasSale ? 'Free Trial' : pricing.label}
          </span>
          {!game.is_free && (canTrial || pricing.hasSale) && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: pricing.hasSale ? 'line-through' : 'none' }}>
              ${parseFloat(game.price).toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
