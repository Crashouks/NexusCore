import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/api';
import { useAuth } from './AuthContext';

const CloudContext = createContext(null);

export function CloudProvider({ children }) {
  const { isAuth, profile } = useAuth();
  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState(null);
  const userId = profile?.user_id;

  const refreshSession = useCallback(async () => {
    if (!isAuth) { setSession(null); return; }
    try {
      const s = await api.cloud.sessionActive();
      setSession(s);
    } catch { setSession(null); }
  }, [isAuth]);

  const refreshQueue = useCallback(async () => {
    if (!isAuth) { setQueue(null); return; }
    try {
      const q = await api.cloud.queueStatus();
      setQueue(q.in_queue ? q : null);
    } catch { setQueue(null); }
  }, [isAuth]);

  useEffect(() => {
    setSession(null);
    setQueue(null);
    refreshSession();
    refreshQueue();
  }, [refreshSession, refreshQueue, userId]);

  useEffect(() => {
    if (!session) return;
    const iv = setInterval(async () => {
      try {
        const hb = await api.cloud.sessionHeartbeat();
        if (hb.auto_ended) { setSession(null); return; }
        refreshSession();
      } catch { setSession(null); }
    }, 60000);
    return () => clearInterval(iv);
  }, [session, refreshSession]);

  const startSession = async (gameId, billingMode) => {
    const data = await api.cloud.sessionStart(gameId, billingMode);
    await refreshSession();
    return data;
  };

  const endSession = async () => {
    await api.cloud.sessionEnd();
    setSession(null);
    await refreshQueue();
  };

  return (
    <CloudContext.Provider value={{
      session, queue, refreshSession, refreshQueue, startSession, endSession, setQueue,
    }}>
      {children}
    </CloudContext.Provider>
  );
}

export const useCloud = () => useContext(CloudContext);
