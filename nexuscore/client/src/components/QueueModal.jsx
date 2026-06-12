import { useEffect, useState } from 'react';
import { useCloud } from '../context/CloudContext';
import { api } from '../api/api';
import QueueChat from './QueueChat';

export default function QueueModal({ game, onConnect, onClose }) {
  const { queue, refreshQueue, setQueue } = useCloud();
  const [countdown, setCountdown] = useState(null);
  const [chatIds, setChatIds] = useState({ global: 1, game: null });

  useEffect(() => {
    const iv = setInterval(refreshQueue, 15000);
    return () => clearInterval(iv);
  }, [refreshQueue]);

  useEffect(() => {
    api.chat.queueLobby().then((data) => {
      setChatIds({
        global: data.global_lobby_id || 1,
        game: data.game_chat_id || null,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (queue?.status !== 'ready' || !queue.expires_at) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(queue.expires_at) - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) refreshQueue();
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [queue, refreshQueue]);

  const handleLeave = async () => {
    await api.cloud.queueLeave();
    setQueue(null);
    onClose();
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (!queue && !game) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 480, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        {queue?.status === 'ready' ? (
          <>
            <h2 className="font-display" style={{ fontSize: 28, color: 'var(--neon)', marginBottom: 16 }}>
              Your slot is ready!
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
              Connecting in {countdown != null ? formatTime(countdown) : '5:00'}...
            </p>
            <button className="btn btn-neon" style={{ marginTop: 20, width: '100%' }} onClick={onConnect}>
              Connect Now
            </button>
          </>
        ) : (
          <>
            <div className="queue-rings">
              <span className="font-display" style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent-glow)', zIndex: 1 }}>
                #{queue?.position || '?'}
              </span>
            </div>
            <h2 className="font-display" style={{ fontSize: 24, margin: '24px 0 8px' }}>You're in the queue</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              Estimated wait: ~{queue?.estimated_wait_mins || '?'} minutes
            </p>
            {game && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', marginBottom: 24 }}>
                <img src={game.cover_url} alt={game.name} style={{ width: 60, borderRadius: 8 }} />
                <span className="font-display" style={{ fontSize: 18 }}>{game.name}</span>
              </div>
            )}
          </>
        )}
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={handleLeave}>Leave Queue</button>

        <QueueChat
          chatId={chatIds.game || chatIds.global}
          title={chatIds.game ? 'Game Queue Chat' : 'GeForce NOW Queue Lobby'}
        />
      </div>
    </div>
  );
}
