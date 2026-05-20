import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { user: u } = await api.auth.me();
      setUser(u);
    } catch {
      localStorage.removeItem('casino_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('casino_token')) fetchMe();
    else setLoading(false);
  }, [fetchMe]);

  async function login(username, password) {
    const { token, user: u } = await api.auth.login(username, password);
    localStorage.setItem('casino_token', token);
    setUser(u);
  }

  async function register(username, password) {
    const { token, user: u } = await api.auth.register(username, password);
    localStorage.setItem('casino_token', token);
    setUser(u);
  }

  function logout() {
    localStorage.removeItem('casino_token');
    setUser(null);
  }

  const updateBalance = useCallback((balance) => {
    setUser(u => u ? { ...u, balance } : u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateBalance, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
