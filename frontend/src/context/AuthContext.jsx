import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('eledrive_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('eledrive_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authAPI
        .getMe()
        .then((res) => {
          if (res.data) {
            setUser(res.data);
            localStorage.setItem('eledrive_user', JSON.stringify(res.data));
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (emailOrUsername, password) => {
    const res = await authAPI.login({ email_or_username: emailOrUsername, password });
    if (res.data && res.data.token) {
      localStorage.setItem('eledrive_token', res.data.token);
      localStorage.setItem('eledrive_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      return res.data.user;
    }
  };

  const register = async (name, username, email, password) => {
    const res = await authAPI.register({ name, username, email, password });
    if (res.data && res.data.token) {
      localStorage.setItem('eledrive_token', res.data.token);
      localStorage.setItem('eledrive_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
    }
    return res.data;
  };

  const logout = () => {
    if (window.__eledriveTransferActive) {
      const confirmLeave = window.confirm(
        'Upload or download is currently in progress. If you sign out now, active transfers will be cancelled. Do you want to continue?'
      );
      if (!confirmLeave) return;
    }
    localStorage.removeItem('eledrive_token');
    localStorage.removeItem('eledrive_user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await authAPI.getMe();
      if (res.data) {
        setUser(res.data);
        localStorage.setItem('eledrive_user', JSON.stringify(res.data));
      }
    } catch (e) {
      console.error('Failed to refresh user', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
