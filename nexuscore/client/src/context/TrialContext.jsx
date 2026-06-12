import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/api';
import { useAuth } from './AuthContext';

const TrialContext = createContext(null);

export function TrialProvider({ children }) {
  const { isAuth } = useAuth();
  const [activeTrial, setActiveTrial] = useState(null);
  const [expiredGame, setExpiredGame] = useState(null);

  const refreshTrial = useCallback(async () => {
    if (!isAuth) { setActiveTrial(null); return; }
    try {
      const history = await api.trials.history();
      const active = history.find(t => t.status === 'active');
      if (active) {
        const status = await api.trials.status(active.game_id);
        setActiveTrial({ ...active, ...status });
      } else {
        setActiveTrial(null);
      }
    } catch { setActiveTrial(null); }
  }, [isAuth]);

  useEffect(() => { refreshTrial(); }, [refreshTrial]);

  useEffect(() => {
    if (!activeTrial?.trialId) return;
    const iv = setInterval(async () => {
      try {
        const hb = await api.trials.heartbeat(activeTrial.trialId);
        if (hb.trialExpired) {
          setActiveTrial(null);
          setExpiredGame(hb.game || {
            name: activeTrial.name, cover_url: activeTrial.cover_url, price: activeTrial.price,
            game_id: activeTrial.game_id, trial_discount_percent: activeTrial.trial_discount_percent,
          });
        } else {
          setActiveTrial(prev => ({ ...prev, minutesRemaining: hb.minutesRemaining }));
        }
      } catch { setActiveTrial(null); }
    }, 60000);
    return () => clearInterval(iv);
  }, [activeTrial?.trialId]);

  const startTrial = async (gameId) => {
    const data = await api.trials.start(gameId);
    await refreshTrial();
    return data;
  };

  const endTrial = async () => {
    if (activeTrial) {
      const result = await api.trials.end(activeTrial.trialId);
      setActiveTrial(null);
      if (result.trialExpired) {
        setExpiredGame({
          name: activeTrial.name, cover_url: activeTrial.cover_url, price: activeTrial.price,
          game_id: activeTrial.game_id, trial_discount_percent: activeTrial.trial_discount_percent,
        });
      }
    }
  };

  return (
    <TrialContext.Provider value={{
      activeTrial, expiredGame, setExpiredGame, refreshTrial, startTrial, endTrial,
    }}>
      {children}
    </TrialContext.Provider>
  );
}

export const useTrial = () => useContext(TrialContext);
