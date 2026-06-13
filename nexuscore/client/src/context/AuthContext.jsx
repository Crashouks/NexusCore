import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/api';

const AuthContext = createContext(null);

function userFromProfile(p) {
  if (!p) return null;
  return {
    userId: p.user_id,
    username: p.username,
    role: p.role,
    cloudPlan: p.cloud_plan,
  };
}

function userFromAuthResponse(u) {
  if (!u) return null;
  return {
    userId: u.userId,
    username: u.username,
    role: u.role,
    cloudPlan: u.cloudPlan,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const p = await api.users.me();
      setProfile(p);
      setUser(userFromProfile(p));
      const lib = await api.users.library(p.user_id);
      setLibrary(lib);
    } catch {
      setProfile(null);
      setLibrary([]);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    loadProfile().finally(() => setLoading(false));
    localStorage.removeItem('nc_token');
  }, [loadProfile]);

  const login = async (email, password) => {
    const data = await api.auth.login(email, password);
    localStorage.removeItem('nc_token');
    localStorage.removeItem('nv_user');
    setUser(userFromAuthResponse(data.user));
    await loadProfile();
    return data;
  };

  const register = async (username, email, password) => {
    const data = await api.auth.register(username, email, password);
    localStorage.removeItem('nc_token');
    localStorage.removeItem('nv_user');
    setUser(userFromAuthResponse(data.user));
    await loadProfile();
    return data;
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch { /* ignore */ }
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
