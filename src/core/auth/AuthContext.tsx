import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { startGithubLogin, refreshAccessToken } from "./authApi";
import { getTokens, clearTokens, isTokenExpired, saveTokens } from "./authStorage";
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
      isLoading: true, // 初始为 true，等待异步验证完成
      error: null,
    };
  });

  // 异步验证 token 有效性：尝试刷新以确保 access token 有效
  useEffect(() => {
    const validateToken = async () => {
      const tokens = getTokens();
      if (!tokens) {
        setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
        return;
      }

      try {
        // 尝试刷新 token
        const newTokens = await refreshAccessToken(tokens.refresh_token);
        saveTokens(newTokens);
        setState({
          user: { id: newTokens.user_id },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch {
        // 刷新失败，清除 token
        clearTokens();
        setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
      }
    };

    if (state.isLoading && state.isAuthenticated) {
      validateToken();
    }
  }, [state.isLoading, state.isAuthenticated]);

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
