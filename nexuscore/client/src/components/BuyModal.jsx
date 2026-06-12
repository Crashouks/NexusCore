import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from './Toast';
import { api } from '../api/api';

export default function BuyModal({ open, onClose, game, trialExpired }) {
  const { profile, refreshLibrary, refreshProfile, ownsGame } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const alreadyOwned = game ? ownsGame(game.game_id) : false;

  useEffect(() => {
    if (open && alreadyOwned) onClose();
  }, [open, alreadyOwned, onClose]);

  if (!game || alreadyOwned) return null;

  const basePrice = parseFloat(game.price || 0);
  const storeDiscount = game.discount_active || 0;
  const trialDiscount = trialExpired ? (game.trial_discount_percent || 10) : 0;
  const discount = storeDiscount || trialDiscount;
  const price = storeDiscount > 0
    ? game.sale_price
    : trialDiscount > 0
      ? basePrice * (1 - trialDiscount / 100)
      : basePrice;
  const balance = parseFloat(profile?.balance || 0);
  const after = balance - price;
  const insufficient = !game.is_free && price > 0 && after < 0;

  const handlePurchase = async () => {
    if (ownsGame(game.game_id)) {
      onClose();
      return;
    }
    setLoading(true);
    try {
      await api.users.purchase(profile.user_id, game.game_id, discount > 0);
      await refreshLibrary();
      await refreshProfile();
      await refreshNotifications();
      onClose();
      navigate('/library?tab=downloads');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={trialExpired ? 'Your trial has ended' : 'Confirm Purchase'}>
      {(trialExpired || storeDiscount > 0) && discount > 0 && (
        <div style={{ background: 'var(--trial-dim)', border: '1px solid var(--accent-trial)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 16, textAlign: 'center' }}>
          <p style={{ color: 'var(--accent-trial)', fontWeight: 600 }}>
            {storeDiscount > 0 ? 'Store sale' : 'Trial offer'} — {discount}% off!
          </p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
        <img src={game.cover_url} alt={game.name} style={{ width: 100, borderRadius: 8, objectFit: 'cover' }} />
        <div>
          <h3 className="font-display" style={{ fontSize: 20 }}>{game.name}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{game.genre}</p>
        </div>
      </div>
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>Game Price</span>
          <span style={{ fontWeight: 600 }}>
            {discount > 0 && <span style={{ textDecoration: 'line-through', color: 'var(--text-dim)', marginRight: 8 }}>${basePrice.toFixed(2)}</span>}
            {game.is_free ? 'Free' : `$${price.toFixed(2)}`}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>Your Balance</span><span>${balance.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 8, fontWeight: 600 }}>
          <span>After Purchase</span>
          <span style={{ color: insufficient ? 'var(--danger)' : 'var(--accent-trial)' }}>
            {game.is_free ? `$${balance.toFixed(2)}` : `$${after.toFixed(2)}`}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {insufficient ? (
          <button className="btn btn-trial" style={{ flex: 1 }} onClick={() => { onClose(); navigate('/profile'); }}>Add Funds First</button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePurchase} disabled={loading}>
            {loading ? 'Processing...' : trialExpired ? `Buy Now — $${price.toFixed(2)}` : 'Confirm Purchase'}
          </button>
        )}
        {trialExpired && <button className="btn btn-ghost" onClick={onClose}>Maybe Later</button>}
        {!trialExpired && <button className="btn btn-ghost" onClick={onClose}>Cancel</button>}
      </div>
    </Modal>
  );
}
