import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { startGithubLogin } from "./authApi";
import { getTokens, clearTokens, isTokenExpired } from "./authStorage";
import type { User, AuthState, AuthContextValue, AuthErrorCode } from "./types";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const tokens = getTokens();
    if (!tokens || isTokenExpired(tokens)) {
      clearTokens();
      return { user: null, isAuthenticated: false, isLoading: false, error: null };
    }
    return {
      user: { id: tokens.user_id },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    };
  });

  const login = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await startGithubLogin();
      const tokens = getTokens();
      if (tokens) {
        setState({
          user: { id: tokens.user_id },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as { code: AuthErrorCode }).code,
      }));
    }
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
  }, []);

  const value: AuthContextValue = {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function useAuthRequired(): User {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) {
    throw new Error("Authentication required");
  }
  return user;
}
