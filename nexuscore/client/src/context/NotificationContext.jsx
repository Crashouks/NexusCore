import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuth } = useAuth();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isAuth) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    try {
      const [list, countData] = await Promise.all([
        api.notifications.list(),
        api.notifications.unreadCount(),
      ]);
      setItems(list);
      setUnreadCount(countData.count || 0);
    } catch {
      setItems([]);
      setUnreadCount(0);
    }
  }, [isAuth]);

  useEffect(() => {
    refresh();
    if (!isAuth) return undefined;
    const iv = setInterval(refresh, 10000);
    return () => clearInterval(iv);
  }, [refresh, isAuth]);

  const markRead = useCallback(async (id) => {
    try {
      await api.notifications.markRead(id);
      setItems(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch { /* ignore */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.notifications.markAllRead();
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }, []);

  return (
    <NotificationContext.Provider value={{ items, unreadCount, refresh, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
