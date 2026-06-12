import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/api';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { isAuth } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const [ids, setIds] = useState([]);

  const refresh = useCallback(async () => {
    if (!isAuth) { setIds([]); return; }
    try {
      const data = await api.wishlist.ids();
      setIds(data);
    } catch { setIds([]); }
  }, [isAuth]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (gameId) => {
    if (ids.includes(gameId)) {
      await api.wishlist.remove(gameId);
    } else {
      await api.wishlist.add(gameId);
      await refreshNotifications();
    }
    await refresh();
  };

  const isWishlisted = (gameId) => ids.includes(gameId);

  return (
    <WishlistContext.Provider value={{ ids, refresh, toggle, isWishlisted }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
