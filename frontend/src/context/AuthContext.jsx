'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentUserApi, logoutUserApi } from '@/lib/api';

const AuthContext = createContext({
  currentUser: null,
  authLoading: true,
  checkAuth: async () => null,
  setCurrentUser: () => {},
  logout: async () => {},
});

/**
 * Global authentication state provider for the matrimonial application.
 * Manages in-memory session representation derived strictly from HttpOnly cookies.
 * Does NOT store credentials or tokens in localStorage or sessionStorage.
 */
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await getCurrentUserApi();
      if (res && res.success && res.data) {
        setCurrentUser(res.data);
        return res.data;
      } else {
        setCurrentUser(null);
        return null;
      }
    } catch (err) {
      setCurrentUser(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUserApi();
    } catch (err) {
      // Ignore network errors during logout teardown
    } finally {
      setCurrentUser(null);
      setAuthLoading(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('matrimony-auth-changed', { detail: { user: null } }));
      }
    }
  }, []);

  const setAuthenticatedUser = useCallback((user) => {
    setCurrentUser(user);
    setAuthLoading(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matrimony-auth-changed', { detail: { user } }));
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const res = await getCurrentUserApi();
        if (isMounted) {
          if (res && res.success && res.data) {
            setCurrentUser(res.data);
          } else {
            setCurrentUser(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    initAuth();

    const handleAuthEvent = (e) => {
      if (e && e.detail && e.detail.user !== undefined) {
        setCurrentUser(e.detail.user);
        setAuthLoading(false);
      } else {
        initAuth();
      }
    };

    window.addEventListener('matrimony-auth-changed', handleAuthEvent);

    return () => {
      isMounted = false;
      window.removeEventListener('matrimony-auth-changed', handleAuthEvent);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        authLoading,
        checkAuth,
        logout,
        setCurrentUser: setAuthenticatedUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
