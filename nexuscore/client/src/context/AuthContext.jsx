import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const p = await api.users.me();
      setProfile(p);
      const lib = await api.users.library(p.user_id);
      setLibrary(lib);
    } catch { setProfile(null); setLibrary([]); }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('nc_token');
    const saved = localStorage.getItem('nv_user');
    if (token && saved) {
      setUser(JSON.parse(saved));
      loadProfile().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loadProfile]);

  const login = async (email, password) => {
    const data = await api.auth.login(email, password);
    localStorage.setItem('nc_token', data.token);
    localStorage.setItem('nv_user', JSON.stringify(data.user));
    setUser(data.user);
    await loadProfile();
    return data;
  };

  const register = async (username, email, password) => {
    const data = await api.auth.register(username, email, password);
    localStorage.setItem('nc_token', data.token);
    localStorage.setItem('nv_user', JSON.stringify(data.user));
    setUser(data.user);
    await loadProfile();
    return data;
  };

  const logout = () => {
    localStorage.removeItem('nc_token');
    localStorage.removeItem('nv_user');
    setUser(null);
    setProfile(null);
    setLibrary([]);
  };

  const refreshLibrary = async () => {
    if (profile) {
      const lib = await api.users.library(profile.user_id);
      setLibrary(lib);
    }
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  const ownsGame = (gameId) => library.some(g => g.game_id === gameId);

  return (
    <AuthContext.Provider value={{
      user, profile, library, loading, login, register, logout,
      refreshLibrary, refreshProfile, ownsGame, isAuth: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
