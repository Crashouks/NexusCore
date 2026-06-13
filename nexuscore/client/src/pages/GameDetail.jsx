import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useCloud } from '../context/CloudContext';
import { useTrial } from '../context/TrialContext';
import { useToast } from '../components/Toast';
import BuyModal from '../components/BuyModal';
import QueueModal from '../components/QueueModal';
import CloudBadge from '../components/CloudBadge';
import ServerPicker, { ServerConnectModal, getPreferredServerId } from '../components/ServerPicker';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import DiscountBadge, { formatGamePrice } from '../components/DiscountBadge';
import { useDownloads } from '../context/DownloadContext';
import { useNotifications } from '../context/NotificationContext';
import { isInstalled, formatSizeGb } from '../utils/download';

export default function GameDetail() {
  const { slug } = useParams();
  const [game, setGame] = useState(null);
  const [trialInfo, setTrialInfo] = useState(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [streamServerOpen, setStreamServerOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [pendingStream, setPendingStream] = useState(null);
  const [connectServer, setConnectServer] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 8, review_text: '', is_recommended: true });
  const [lightbox, setLightbox] = useState(null);
  const { isAuth, ownsGame, profile, refreshLibrary, library } = useAuth();
  const { startDownload } = useDownloads();
  const { startSession, refreshQueue } = useCloud();
  const { startTrial, activeTrial, expiredGame, setExpiredGame } = useTrial();
  const { showToast } = useToast();
  const { refresh: refreshNotifications } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    api.games.detail(slug).then(setGame).catch(() => navigate('/'));
  }, [slug, navigate]);

  useEffect(() => {
    if (isAuth && game) api.trials.status(game.game_id).then(setTrialInfo).catch(() => {});
  }, [isAuth, game]);

  useEffect(() => {
    if (!game || expiredGame?.game_id !== game.game_id) return;
    if (ownsGame(game.game_id)) {
      setBuyOpen(false);
      setExpiredGame(null);
    } else {
      setBuyOpen(true);
    }
  }, [expiredGame, game, library, ownsGame, setExpiredGame]);

  if (!game) return <div className="page"><div className="skeleton" style={{ height: 400 }} /></div>;

  const owned = ownsGame(game.game_id);
  const libEntry = library.find(g => g.game_id === game.game_id);
  const installed = libEntry ? isInstalled(libEntry) : false;
  const sizeGb = libEntry?.download_size_gb ?? game.download_size_gb ?? 25;
  const trialActive = trialInfo?.trialStatus === 'active';
  const trialUsed = trialInfo?.trialUsed && trialInfo?.trialStatus !== 'active';
  const canTrialGame = game.trial_enabled !== false && !owned && !trialUsed && !trialActive;
  const canReview = owned || trialInfo?.trialStatus === 'completed' || trialInfo?.trialStatus === 'purchased';
  const trialMins = game.trial_duration_mins || trialInfo?.trialDuration || 30;

  const handlePurchase = () => setBuyOpen(true);

  const handleAddFree = async () => {
    try {
      await api.users.purchase(profile.user_id, game.game_id);
      await refreshLibrary();
      await refreshNotifications();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleTrial = async () => {
    try {
      await startTrial(game.game_id);
      setTrialInfo({ trialUsed: true, trialStatus: 'active', minutesRemaining: trialMins });
      showToast(`Trial started! ${trialMins} minutes.`, 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const beginStream = (billingMode) => {
    setPendingStream({ billingMode });
    setStreamServerOpen(true);
  };

  const confirmStreamServer = async (server, password) => {
    setStreamServerOpen(false);
    if (!server) return;
    const billingMode = pendingStream?.billingMode || 'subscription';
    const needsPassword = server.requires_player_password || server.availability === 'password_required';
    if (needsPassword && !password) {
      setConnectServer(server);
      return;
    }
    try {
      if (billingMode === 'free') {
        const q = await api.cloud.queueJoin(game.game_id);
        if (!q.skip_queue) {
          await refreshQueue();
          setQueueOpen(true);
          return;
        }
      }
      await startSession(game.game_id, billingMode, server.server_id, password);
      navigate('/cloud');
    } catch (err) {
      if (err.code === 'QUEUE_REQUIRED') setQueueOpen(true);
      else showToast(err.message, 'error');
    }
    setPendingStream(null);
  };

  const handleStream = async (billingMode = 'subscription') => {
    beginStream(billingMode);
  };

  const handleDownload = async () => {
    try {
      const g = libEntry || { ...game, game_id: game.game_id };
      await startDownload(g);
      navigate('/library?tab=downloads');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handlePlayLocal = () => {
    if (!installed) {
      showToast('Download the game first to play locally.', 'error');
      return;
    }
    showToast(`Launching ${game.name}…`, 'success');
  };

  const handleReview = async (e) => {
    e.preventDefault();
    try {
      await api.games.userReview(game.game_id, reviewForm);
      showToast('Review submitted!', 'success');
      const updated = await api.games.detail(slug);
      setGame(updated);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const pricing = formatGamePrice(game);
  const priceLabel = pricing.hasSale ? pricing.label : `$${parseFloat(game.price).toFixed(2)}`;

  const renderActions = () => {
    if (!isAuth) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link to="/login" className="btn btn-primary">Login to Buy</Link>
        <Link to="/login" className="btn btn-trial">Login to Try Free</Link>
      </div>
    );
    if (owned) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {installed ? (
          <button className="btn btn-success" onClick={handlePlayLocal}><Icon name="play" size={16} /> Play</button>
        ) : (
          <button className="btn btn-primary" onClick={handleDownload}>
            <Icon name="download" size={16} /> Download — {formatSizeGb(sizeGb)}
          </button>
        )}
        {game.cloud_enabled && (
          <button className="btn btn-neon" onClick={() => handleStream(profile.cloud_plan === 'free' ? 'free' : 'subscription')}>
            <Icon name="cloud" size={16} /> Stream Now (no download)
          </button>
        )}
        {!installed && (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>
            Local play requires download. Cloud stream skips install.
          </p>
        )}
      </div>
    );
    if (game.is_free) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn btn-success" onClick={handleAddFree}>Add to Library — Free</button>
        {game.cloud_enabled && (
          <button className="btn btn-neon" onClick={() => handleStream('free')}>
            <Icon name="cloud" size={16} /> Stream Free
          </button>
        )}
      </div>
    );
    if (trialActive) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn btn-trial"><Icon name="clock" size={16} /> Continue Trial — {trialInfo.minutesRemaining} min left</button>
        <button className="btn btn-primary" onClick={handlePurchase}>Buy Now — {priceLabel}</button>
      </div>
    );
    if (trialUsed) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn" disabled style={{ background: 'var(--bg-elevated)', color: 'var(--text-dim)' }}>Trial Ended</button>
        <button className="btn btn-primary" onClick={handlePurchase}>Buy Now — {priceLabel}</button>
      </div>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          {pricing.hasSale && <DiscountBadge percent={game.discount_active} />}
          {pricing.hasSale && <span style={{ textDecoration: 'line-through', color: 'var(--text-dim)', fontSize: 20 }}>${pricing.base.toFixed(2)}</span>}
          {priceLabel}
        </div>
        <button className="btn btn-primary" onClick={handlePurchase}>Buy Now — {priceLabel}</button>
        {canTrialGame && (
          <>
            <button className="btn btn-trial" onClick={handleTrial}><Icon name="clock" size={16} /> Try Free — {trialMins} min</button>
            {game.cloud_enabled && (
              <button className="btn btn-neon" onClick={handleTrial}>
                <Icon name="cloud" size={16} /> GFN Preview — {trialMins} min
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 60%', minWidth: 300 }}>
          <div style={{ aspectRatio: '16/9', marginBottom: 20, borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--bg-hover)' }}>
            <img src={game.cover_url} alt={game.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
            {(game.media?.length ? game.media : [{ url: game.cover_url }]).map((m, i) => (
              <img key={i} src={m.url} alt="" onClick={() => setLightbox(m.url)}
                style={{ height: 100, borderRadius: 8, cursor: 'pointer', objectFit: 'cover' }} />
            ))}
          </div>
          {lightbox && (
            <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={lightbox} alt="" style={{ maxWidth: '90%', maxHeight: '90%' }} />
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 35%', minWidth: 280 }}>
          <img src={game.cover_url} alt={game.name} style={{ width: '100%', borderRadius: 'var(--radius-lg)', marginBottom: 16 }} />
          <h1 className="font-display" style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>{game.name}</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{game.developer_name}</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ background: 'var(--accent-dim)', padding: '4px 10px', borderRadius: 6, fontSize: 13 }}>{game.genre}</span>
            {game.cloud_enabled && <CloudBadge />}
            {game.tags?.split(',').map(t => (
              <span key={t} style={{ background: 'var(--bg-elevated)', padding: '4px 10px', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)' }}>{t.trim()}</span>
            ))}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>
            ⭐ {parseFloat(game.avg_rating || 0).toFixed(1)} ({game.review_count || 0} reviews)
          </p>
          <div style={{ marginBottom: 24 }}>{renderActions()}</div>

          {game.cloud_enabled && (
            <div className="glass" style={{ padding: 16, marginBottom: 20 }}>
              <h3 className="font-display" style={{ color: 'var(--accent-cloud)', marginBottom: 8 }}>GeForce Now</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Stream this game instantly via GeForce Now. Free: 1080p/60fps, 1hr/day. Paid plans skip the queue.
              </p>
              <p style={{ fontSize: 13, marginTop: 8 }}>
                Current plan: <strong>{profile?.cloud_plan || 'Guest'}</strong>
                {profile?.cloud_plan === 'free' && ' (queue required)'}
              </p>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <h3 className="font-display" style={{ marginBottom: 8 }}>About</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: 14 }}>{game.description || game.short_desc}</p>
          </div>
          {game.requirements && (
            <div>
              <h3 className="font-display" style={{ marginBottom: 8 }}>System Requirements</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, whiteSpace: 'pre-wrap' }}>{game.requirements}</p>
            </div>
          )}
        </div>
      </div>

      <section style={{ marginTop: 48 }}>
        <h2 className="section-title">Reviews</h2>
        {canReview && (
          <form onSubmit={handleReview} className="card" style={{ padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <label>Rating (1-10): <input type="number" min="1" max="10" value={reviewForm.rating}
                onChange={e => setReviewForm({ ...reviewForm, rating: +e.target.value })}
                style={{ width: 60, marginLeft: 8, padding: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4 }} /></label>
              <label><input type="checkbox" checked={reviewForm.is_recommended}
                onChange={e => setReviewForm({ ...reviewForm, is_recommended: e.target.checked })} /> Recommended</label>
            </div>
            <textarea value={reviewForm.review_text} onChange={e => setReviewForm({ ...reviewForm, review_text: e.target.value })}
              placeholder="Write your review..." rows={3}
              style={{ width: '100%', padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', marginBottom: 12 }} />
            <button type="submit" className="btn btn-primary">Submit Review</button>
          </form>
        )}
        {game.reviews?.length ? game.reviews.map(r => (
          <div key={r.review_id} className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong>{r.username}</strong>
              <span style={{ color: 'var(--trial)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="star" size={14} filled /> {r.rating}/10
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{r.review_text}</p>
          </div>
        )) : <p style={{ color: 'var(--text-muted)' }}>No reviews yet.</p>}
      </section>

      <BuyModal open={buyOpen} onClose={() => { setBuyOpen(false); setExpiredGame(null); }} game={game} />
      <Modal open={streamServerOpen} onClose={() => { setStreamServerOpen(false); setPendingStream(null); }} title="Choose streaming server" wide>
        <ServerPicker
          gameId={game?.game_id}
          selectedId={getPreferredServerId()}
          onSelect={(s) => {
            if (s.requires_player_password || s.availability === 'password_required') {
              setConnectServer(s);
              setStreamServerOpen(false);
            } else {
              confirmStreamServer(s, null);
            }
          }}
        />
      </Modal>
      <ServerConnectModal
        open={!!connectServer}
        onClose={() => setConnectServer(null)}
        server={connectServer}
        onConfirm={(pw) => { confirmStreamServer(connectServer, pw); setConnectServer(null); }}
      />
      {queueOpen && <QueueModal game={game} onClose={() => setQueueOpen(false)}
        onConnect={() => { setQueueOpen(false); beginStream('free'); }} />}
    </div>
  );
}
