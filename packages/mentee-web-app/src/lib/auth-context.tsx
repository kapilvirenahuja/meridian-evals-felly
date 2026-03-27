'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiClient } from './api-client';
import { setTokens, clearTokens, getAccessToken } from './auth';

interface User {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: (refreshToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      const response = await apiClient.get<User>('/auth/me');
      setUser(response.data);
    } catch {
      setUser(null);
      clearTokens();
    }
  }, []);

  // Rehydrate auth state on mount if a token exists
  useEffect(() => {
    if (getAccessToken()) {
      void fetchMe();
    }
  }, [fetchMe]);

  const login = useCallback(
    async (accessToken: string, refreshToken: string) => {
      setTokens(accessToken, refreshToken);
      await fetchMe();
    },
    [fetchMe],
  );

  const logout = useCallback(async (refreshToken: string) => {
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } catch {
      // Best-effort logout — clear local state regardless
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
