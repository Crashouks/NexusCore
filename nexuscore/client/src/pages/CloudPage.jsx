import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useCloud } from '../context/CloudContext';
import { useToast } from '../components/Toast';
import QueueChat from '../components/QueueChat';
import CloudPlayer from '../components/CloudPlayer';
import CloudStreamSettings, { getPlanStreamLimits } from '../components/CloudStreamSettings';
import ServerPicker, { ServerConnectModal, getPreferredServerId } from '../components/ServerPicker';
import Modal from '../components/Modal';

const PLAN_LABELS = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  ultimate_rtx: 'Ultimate RTX',
};

export default function CloudPage() {
  const [elapsed, setElapsed] = useState(0);
  const [quality, setQuality] = useState(() => localStorage.getItem('nc_stream_quality') || '1080p');
  const [fps, setFps] = useState(() => parseInt(localStorage.getItem('nc_stream_fps') || '60', 10));
  const [statsLocked, setStatsLocked] = useState(() => localStorage.getItem('nc_stats_locked') === 'true');
  const [preferredServerId, setPreferredServerIdState] = useState(() => {
    const v = localStorage.getItem('nc_preferred_server_id');
    return v ? parseInt(v, 10) : null;
  });
  const [streamServerOpen, setStreamServerOpen] = useState(false);
  const [connectServer, setConnectServer] = useState(null);
  const [pendingStream, setPendingStream] = useState(null);
  const [lobbyChatId, setLobbyChatId] = useState(1);
  const [queueChatId, setQueueChatId] = useState(null);
  const { profile } = useAuth();
  const { session, queue, endSession, refreshSession, refreshQueue, startSession, setQueue } = useCloud();
  const { showToast } = useToast();

  const currentPlan = profile?.cloud_plan || 'free';
  const planLabel = PLAN_LABELS[currentPlan] || currentPlan;
  const limits = getPlanStreamLimits(currentPlan);

  useEffect(() => { refreshSession(); refreshQueue(); }, [refreshSession, refreshQueue]);
  useEffect(() => { localStorage.setItem('nc_stream_quality', quality); }, [quality]);
  useEffect(() => { localStorage.setItem('nc_stream_fps', String(fps)); }, [fps]);
  useEffect(() => { localStorage.setItem('nc_stats_locked', statsLocked ? 'true' : 'false'); }, [statsLocked]);

  useEffect(() => {
    const l = getPlanStreamLimits(currentPlan);
    setQuality(q => (l.qualities.includes(q) ? q : l.qualities[l.qualities.length - 1]));
    setFps(f => (l.fps.includes(f) ? f : l.fps[l.fps.length - 1]));
  }, [currentPlan]);

  useEffect(() => {
    const iv = setInterval(refreshQueue, 15000);
    return () => clearInterval(iv);
  }, [refreshQueue]);

  useEffect(() => {
    api.chat.queueLobby().then((data) => {
      setLobbyChatId(data.global_lobby_id || 1);
      setQueueChatId(data.game_chat_id || null);
    }).catch(() => {});
  }, [queue?.game_id]);

  useEffect(() => {
    if (window.location.hash === '#settings') {
      document.getElementById('settings')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const start = new Date(session.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [session]);

  const formatElapsed = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleEnd = async () => {
    await endSession();
    showToast('Session ended', 'success');
  };

  const handleGameClosed = useCallback(() => {
    refreshSession();
    showToast('Game closed — cloud session ended', 'success');
  }, [refreshSession, showToast]);

  const handleLeaveQueue = async () => {
    await api.cloud.queueLeave();
    setQueue(null);
    showToast('Left queue', 'success');
  };

  const confirmStreamServer = async (server, password) => {
    setStreamServerOpen(false);
    if (!server || !pendingStream?.gameId) return;
    try {
      await startSession(pendingStream.gameId, pendingStream.billingMode || 'free', server.server_id, password);
      setQueue(null);
      setPendingStream(null);
      showToast('Session started!', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleConnect = async () => {
    if (!queue?.game_id) return;
    setPendingStream({ billingMode: 'free', gameId: queue.game_id });
    setStreamServerOpen(true);
  };

  const toggleStatsLock = () => setStatsLocked(v => !v);

  const activeChatId = queue ? (queueChatId || lobbyChatId) : lobbyChatId;
  const activeChatTitle = queue && queueChatId ? 'Game Queue Chat' : 'GeForce NOW Queue Lobby';

  return (
    <div className="page">
      <section id="play" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h1 className="font-display gradient-text" style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>
            GeForce NOW — {planLabel} Plan
          </h1>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            <Link to="/profile#cloud-plans" style={{ color: 'var(--accent-glow)' }}>Change plan</Link>
            {' · '}
            <Link to="/profile#cloud-sessions" style={{ color: 'var(--accent-glow)' }}>Session history</Link>
          </span>
        </div>

        <CloudPlayer
          session={session}
          elapsed={elapsed}
          formatElapsed={formatElapsed}
          displayQuality={quality}
          targetFps={fps}
          planLabel={planLabel}
          statsLocked={statsLocked}
          onToggleStatsLock={toggleStatsLock}
          onEnd={handleEnd}
          onGameClosed={handleGameClosed}
        />
      </section>

      {queue && (
        <section id="queue" style={{ marginBottom: 24 }}>
          <h2 className="section-title" style={{ color: 'var(--accent-glow)', fontSize: 22 }}>Queue Status</h2>
          <div className="card" style={{ padding: 24 }}>
            {queue.status === 'ready' ? (
              <>
                <p className="font-display" style={{ fontSize: 22, color: 'var(--neon)', marginBottom: 8 }}>Your slot is ready!</p>
                <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Connect now before your spot expires.</p>
                <button className="btn btn-neon" onClick={handleConnect}>Connect Now</button>
              </>
            ) : (
              <>
                <p className="font-display" style={{ fontSize: 36, color: 'var(--accent-glow)', marginBottom: 8 }}>#{queue.position || '?'}</p>
                <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                  Estimated wait: ~{queue.estimated_wait_mins || '?'} minutes
                </p>
              </>
            )}
            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={handleLeaveQueue}>Leave Queue</button>
          </div>
        </section>
      )}

      <div className="cloud-lower-grid">
        <section id="chat" className="cloud-lower-main">
          <h2 className="section-title" style={{ fontSize: 22 }}>Queue Lobby Chat</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 14 }}>
            Chat with other players while waiting or streaming on the free tier.
          </p>
          <div className="card" style={{ padding: 24 }}>
            <QueueChat chatId={activeChatId} title={activeChatTitle} />
          </div>
        </section>

        <aside id="settings" className="cloud-settings-aside">
          <CloudStreamSettings
            plan={currentPlan}
            quality={quality}
            fps={fps}
            statsLocked={statsLocked}
            onQualityChange={setQuality}
            onFpsChange={setFps}
            onToggleStatsLock={toggleStatsLock}
            preferredServerId={preferredServerId}
            onPreferredServerChange={(id) => {
              setPreferredServerIdState(id);
              localStorage.setItem('nc_preferred_server_id', String(id));
            }}
          />
        </aside>
      </div>

      <Modal open={streamServerOpen} onClose={() => { setStreamServerOpen(false); setPendingStream(null); }} title="Choose streaming server" wide>
        <ServerPicker
          gameId={pendingStream?.gameId}
          selectedId={preferredServerId ?? getPreferredServerId()}
          onSelect={(s) => {
            if (s.requires_player_password || s.availability === 'password_required') {
              setConnectServer(s);
              setStreamServerOpen(false);
            } else confirmStreamServer(s, null);
          }}
        />
      </Modal>
      <ServerConnectModal
        open={!!connectServer}
        onClose={() => setConnectServer(null)}
        server={connectServer}
        onConfirm={(pw) => { confirmStreamServer(connectServer, pw); setConnectServer(null); }}
      />
    </div>
  );
}
