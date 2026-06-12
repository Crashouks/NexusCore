import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useCloud } from '../context/CloudContext';
import { useToast } from '../components/Toast';
import PlanCard from '../components/PlanCard';
import Modal from '../components/Modal';

export default function CloudPlay() {
  const [plansData, setPlansData] = useState(null);
  const [history, setHistory] = useState({ sessions: [], total: 0 });
  const [historyPage, setHistoryPage] = useState(1);
  const [subscribePlan, setSubscribePlan] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const { profile, refreshProfile } = useAuth();
  const { session, endSession, refreshSession } = useCloud();
  const { showToast } = useToast();

  useEffect(() => { api.cloud.plans().then(setPlansData).catch(() => {}); }, []);
  useEffect(() => { api.cloud.sessionHistory(historyPage).then(setHistory).catch(() => {}); }, [historyPage]);
  useEffect(() => { refreshSession(); }, [refreshSession]);

  useEffect(() => {
    if (!session) return;
    const start = new Date(session.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [session]);

  const formatElapsed = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleSubscribe = async () => {
    try {
      await api.cloud.subscribe(subscribePlan.name);
      await refreshProfile();
      showToast(`Subscribed to ${subscribePlan.display_name}!`, 'success');
      setSubscribePlan(null);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleEnd = async () => {
    await endSession();
    showToast('Session ended', 'success');
    api.cloud.sessionHistory(historyPage).then(setHistory);
  };

  const currentPlan = profile?.cloud_plan || 'free';

  return (
    <div className="page">
      <section style={{ textAlign: 'center', padding: '40px 0 60px' }}>
        <h1 className="font-display gradient-text" style={{ fontSize: 48, fontWeight: 700, marginBottom: 12 }}>
          Play anywhere. No GPU required.
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 18, maxWidth: 600, margin: '0 auto' }}>
          Stream any cloud-enabled game directly in your browser. Free users get 1 hour per day — upgrade for unlimited access.
        </p>
      </section>

      <section style={{ marginBottom: 60 }}>
        <h2 className="section-title" style={{ textAlign: 'center' }}>Choose Your Plan</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <PlanCard isFree currentPlan={currentPlan} />
          {plansData?.plans?.map(p => (
            <PlanCard key={p.plan_id} plan={p} currentPlan={currentPlan}
              onSubscribe={setSubscribePlan} />
          ))}
        </div>
      </section>

      <section className="glass" style={{ padding: 28, marginBottom: 48 }}>
        <h3 className="font-display" style={{ marginBottom: 16 }}>How the free tier works</h3>
        <ul style={{ color: 'var(--text-muted)', lineHeight: 2, paddingLeft: 20 }}>
          <li>Join the queue for any cloud-enabled game</li>
          <li>When a slot opens (up to 3 simultaneous free users), you're notified</li>
          <li>Your slot is held for 5 minutes — connect or lose your spot</li>
          <li>Stream for up to 1 hour per day</li>
        </ul>
      </section>

      {session && (
        <section style={{ marginBottom: 48 }}>
          <h2 className="section-title" style={{ color: 'var(--neon)' }}>Active Session</h2>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{
              position: 'relative', aspectRatio: '16/9',
              backgroundImage: `url(${session.cover_url})`, backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}>
              <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.5)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="stream-hud">
                  <span className="live-dot" /> LIVE
                  <span>| {session.name}</span>
                  <span>| {session.resolution || '1080p'} / {session.fps || 60}fps</span>
                  <span>| EU-Central</span>
                  <span>| Latency: 14ms</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 16 }}>
                  <img src={session.cover_url} alt="" style={{ width: 120, borderRadius: 12, opacity: 0.8 }} />
                  <p className="font-display" style={{ fontSize: 24 }}>{session.name}</p>
                  <p style={{ color: 'var(--text-muted)' }}>Elapsed: {formatElapsed(elapsed)}</p>
                  {session.minutesRemaining != null && (
                    <p style={{ color: 'var(--trial)', fontWeight: 600, fontSize: 18 }}>
                      {session.minutesRemaining} min remaining
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Plan: <strong>{session.plan}</strong></span>
              <button className="btn btn-danger" onClick={handleEnd}>End Session</button>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Session History</h2>
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {['Game', 'Plan', 'Date', 'Duration', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.sessions.length ? history.sessions.map(s => (
                <tr key={s.session_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px' }}>{s.name}</td>
                  <td style={{ padding: '12px 16px' }}>{s.plan}</td>
                  <td style={{ padding: '12px 16px' }}>{new Date(s.started_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px' }}>{s.duration_mins} min</td>
                  <td style={{ padding: '12px 16px' }}>{s.status}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No sessions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {Math.ceil(history.total / 10) > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {Array.from({ length: Math.ceil(history.total / 10) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`btn ${p === historyPage ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setHistoryPage(p)}>{p}</button>
            ))}
          </div>
        )}
      </section>

      <Modal open={!!subscribePlan} onClose={() => setSubscribePlan(null)} title="Confirm Subscription">
        {subscribePlan && (
          <>
            <p style={{ marginBottom: 16 }}>Subscribe to <strong>{subscribePlan.display_name}</strong> for ${parseFloat(subscribePlan.price_monthly).toFixed(2)}/mo?</p>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Balance: ${parseFloat(profile?.balance || 0).toFixed(2)}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubscribe}>Confirm</button>
              <button className="btn btn-ghost" onClick={() => setSubscribePlan(null)}>Cancel</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
