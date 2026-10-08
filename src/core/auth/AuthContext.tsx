import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
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

  // 防止 React 18 StrictMode 导致 useEffect 重复执行
  const validationStartedRef = useRef(false);
  // 定时器引用，用于清理
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 异步验证 token 有效性：尝试刷新以确保 access token 有效
  // 仅在组件首次挂载时执行一次
  useEffect(() => {
    // 防止 StrictMode 重复执行
    if (validationStartedRef.current) return;
    validationStartedRef.current = true;

    const validateToken = async () => {
      const tokens = getTokens();
      if (!tokens) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // 调试日志：查看当前 token 状态
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("[auth] 开始验证 token", {
          hasAccessToken: !!tokens.access_token,
          accessTokenLength: tokens.access_token?.length,
          hasRefreshToken: !!tokens.refresh_token,
          expiresIn: Math.max(0, Math.floor((tokens.expires_at - Date.now()) / 1000)),
        });
      }

      try {
        // 尝试刷新 token
        const newTokens = await refreshAccessToken(tokens.refresh_token);
        saveTokens(newTokens);

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log("[auth] token 刷新成功", {
            newAccessTokenLength: newTokens.access_token?.length,
            expiresIn: Math.max(0, Math.floor((newTokens.expires_at - Date.now()) / 1000)),
          });
        }

        setState({
          user: { id: newTokens.user_id },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        // 启动定时刷新检查
        startRefreshTimer();
      } catch (error) {
        // 调试日志：查看刷新失败原因
        if (import.meta.env.DEV) {
           
          console.error("[auth] token 刷新失败", error);
        }

        // 刷新失败，清除 token
        clearTokens();
        setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
      }
    };

    // 定时刷新：每 5 分钟检查一次，如果 token 即将过期（< 10 分钟）则刷新
    const startRefreshTimer = () => {
      // 清除已有的定时器
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }

      // 每 5 分钟检查一次
      refreshTimerRef.current = setInterval(
        () => {
          const tokens = getTokens();
          if (!tokens) {
            // token 已清除，停止定时器
            if (refreshTimerRef.current) {
              clearInterval(refreshTimerRef.current);
              refreshTimerRef.current = null;
            }
            return;
          }

          const expiresIn = tokens.expires_at - Date.now();
          const tenMinutes = 10 * 60 * 1000;

          // 如果距离过期时间不足 10 分钟，主动刷新
          if (expiresIn < tenMinutes && expiresIn > 0) {
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.log("[auth] 定时检查：token 即将过期，主动刷新", {
                expiresIn: Math.floor(expiresIn / 1000),
              });
            }

            refreshAccessToken(tokens.refresh_token)
              .then(newTokens => {
                saveTokens(newTokens);
                if (import.meta.env.DEV) {
                  // eslint-disable-next-line no-console
                  console.log("[auth] 定时刷新成功", {
                    expiresIn: Math.floor((newTokens.expires_at - Date.now()) / 1000),
                  });
                }
              })
              .catch(error => {
                if (import.meta.env.DEV) {
                   
                  console.error("[auth] 定时刷新失败", error);
                }
                // 刷新失败，清除 token 并跳转登录
                clearTokens();
                setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
                // 清除定时器
                if (refreshTimerRef.current) {
                  clearInterval(refreshTimerRef.current);
                  refreshTimerRef.current = null;
                }
              });
          }
        },
        5 * 60 * 1000,
      ); // 5 分钟
    };

    // 只在初始加载状态下执行验证
    if (state.isLoading) {
      validateToken();
    }

    // 清理函数：组件卸载时清除定时器
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依赖数组，只在挂载时执行一次

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
