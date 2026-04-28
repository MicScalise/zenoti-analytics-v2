// =============================================================================
// useAuth.ts — Authentication hook for React components
// Implements: REQ-SEC-02 (auth state management), REQ-UI-01
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { getAuthToken, login as apiLogin, logout as apiLogout } from '../services/auth.js';

/** Current auth state exposed by the hook. */
interface AuthState {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether an auth operation is in progress */
  isLoading: boolean;
  /** Last auth error message, if any */
  error: string | undefined;
}

/**
 * Hook providing authentication state and actions.
 * Checks localStorage for existing token on mount.
 * Provides login/logout functions that update state.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: !!getAuthToken(),
    isLoading: false,
    error: undefined,
  });

  // Sync auth state when storage changes (e.g., 401 interceptor clears token)
  useEffect(() => {
    const onStorage = () => {
      setState((prev) => ({
        ...prev,
        isAuthenticated: !!getAuthToken(),
      }));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /** Log in with email and password. Updates auth state on success. */
  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: undefined }));
    try {
      await apiLogin(email, password);
      setState({ isAuthenticated: true, isLoading: false, error: undefined });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, []);

  /** Log out. Clears session and updates auth state. */
  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setState({ isAuthenticated: false, isLoading: false, error: undefined });
    }
  }, []);

  return { ...state, login, logout };
}
