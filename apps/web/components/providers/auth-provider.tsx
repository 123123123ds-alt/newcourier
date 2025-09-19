'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

export type AuthUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  name?: string | null;
};

export type AuthState = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

interface AuthContextValue {
  auth: AuthState | null;
  loading: boolean;
  login: (state: AuthState) => void;
  logout: () => void;
  setAuth: (state: AuthState | null) => void;
  refreshTokens: () => Promise<AuthState | null>;
}

const STORAGE_KEY = 'newcourier.auth';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredAuth(): AuthState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthState;
  } catch (error) {
    console.warn('Failed to parse stored auth state', error);
    return null;
  }
}

function persistAuth(state: AuthState | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({
  children
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthState(readStoredAuth());
    setLoading(false);
  }, []);

  const setAuth = useCallback((state: AuthState | null) => {
    setAuthState(state);
    persistAuth(state);
  }, []);

  const login = useCallback((state: AuthState) => {
    setAuth(state);
  }, [setAuth]);

  const logout = useCallback(() => {
    setAuth(null);
  }, [setAuth]);

  const refreshTokens = useCallback(async () => {
    if (!auth?.refreshToken) {
      setAuth(null);
      return null;
    }

    try {
      const baseUrl = (
        process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
      ).replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: auth.refreshToken })
      });

      if (!response.ok) {
        setAuth(null);
        return null;
      }

      const refreshed = (await response.json()) as AuthState;
      setAuth(refreshed);
      return refreshed;
    } catch (error) {
      console.warn('Failed to refresh auth tokens', error);
      setAuth(null);
      return null;
    }
  }, [auth?.refreshToken, setAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({ auth, loading, login, logout, setAuth, refreshTokens }),
    [auth, loading, login, logout, setAuth, refreshTokens]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
