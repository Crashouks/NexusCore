import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { downloadDurationSec } from '../utils/download';

const DownloadContext = createContext(null);

export function DownloadProvider({ children }) {
  const { isAuth, refreshLibrary } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const [active, setActive] = useState({});
  const timersRef = useRef({});

  const clearTimer = (gameId) => {
    if (timersRef.current[gameId]) {
      clearInterval(timersRef.current[gameId]);
      delete timersRef.current[gameId];
    }
  };

  const finishDownload = useCallback(async (gameId) => {
    clearTimer(gameId);
    try {
      await api.downloads.complete(gameId);
      await refreshLibrary();
      await refreshNotifications();
    } catch { /* ignore */ }
    setActive(prev => {
      const next = { ...prev };
      delete next[gameId];
      return next;
    });
  }, [refreshLibrary, refreshNotifications]);

  const startDownload = useCallback(async (game) => {
    const gameId = game.game_id;
    if (active[gameId]) return active[gameId];

    const data = await api.downloads.start(gameId);
    const durationMs = (data.duration_seconds || downloadDurationSec(data.download_size_gb)) * 1000;
    const startedAt = Date.now();

    setActive(prev => ({
      ...prev,
      [gameId]: { progress: 0, startedAt, durationMs, sizeGb: data.download_size_gb },
    }));

    await refreshLibrary();

    clearTimer(gameId);
    timersRef.current[gameId] = setInterval(async () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(100, Math.floor((elapsed / durationMs) * 100));
      setActive(prev => ({
        ...prev,
        [gameId]: { ...prev[gameId], progress },
      }));
      if (progress >= 100) {
        await finishDownload(gameId);
      }
    }, 100);

    return data;
  }, [active, finishDownload, refreshLibrary]);

  useEffect(() => {
    if (!isAuth) {
      Object.keys(timersRef.current).forEach(clearTimer);
      setActive({});
    }
  }, [isAuth]);

  useEffect(() => () => Object.keys(timersRef.current).forEach(clearTimer), []);

  const getProgress = (gameId) => active[gameId]?.progress ?? null;

  return (
    <DownloadContext.Provider value={{ startDownload, getProgress, activeDownloads: active }}>
      {children}
    </DownloadContext.Provider>
  );
}

export const useDownloads = () => useContext(DownloadContext);
