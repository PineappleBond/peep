# GitHub 登录功能设计文档

## 概述

为 peep-v2 项目接入 GitHub OAuth2 登录功能，实现用户身份认证。采用纯 React Context + Hook 方案，支持双主题（亮色/暗色）和国际化（中/英文）。

## 需求总结

1. **登录必需**：必须登录后才能使用应用
2. **单一 Provider**：仅接入 GitHub 登录
3. **用户信息**：不显示头像、昵称，但需要退出登录功能
4. **Token 存储**：localStorage
5. **Token 刷新**：请求拦截模式（每次 API 调用前检查），提前 60 秒刷新
6. **多标签页**：不同步，各自独立（一个标签页登出后，其他标签页因 token 失效自动退出）
7. **国际化**：所有错误提示和用户可见文本支持中英文
8. **主题适配**：支持亮色/暗色双主题

## 技术设计

### 1. 模块架构

```
src/core/auth/
├── types.ts              # 类型定义（User, Tokens, AuthState, AuthErrorCode）
├── authApi.ts            # OAuth2 API 封装（3 个端点）
│   ├── startGithubLogin()      # 发起 GitHub 登录
│   ├── exchangeToken()         # 授权码换取 token
│   ├── refreshAccessToken()    # 刷新 access_token
│   └── fetchWithAuth()         # 带认证的 fetch 封装
├── authStorage.ts        # Token 存储与读取（localStorage）
│   ├── saveTokens()
│   ├── getTokens()
│   ├── clearTokens()
│   └── isTokenExpired()
├── AuthContext.tsx        # React Context + Provider
│   ├── AuthProvider
│   ├── useAuth()
│   └── useAuthRequired()
└── authGuard.tsx          # 路由守卫（可选，当前在 App.tsx 直接判断）

src/components/
├── LoginPage.tsx          # 登录页面（GitHub 登录按钮 + 预留截图/介绍位置）
├── LogoutButton.tsx       # 退出登录按钮（Header 右上角）
└── icons/
    └── GitHubIcon.tsx     # GitHub 图标 SVG

public/auth/
└── callback.html          # 已有，OAuth 回调页面（postMessage 通知主窗口）

src/locales/
├── zh-CN.ts               # 新增 login.* 键值
└── en-US.ts               # 新增 login.* 键值

src/styles/
└── login.css              # 登录页样式（支持双主题）
```

### 2. 核心数据结构

```typescript
// types.ts
export interface User {
  id: string; // user_id from backend
}

export interface TokenStorage {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix 时间戳（毫秒）
  user_id: string;
}

export type AuthErrorCode =
  "OAUTH_FAILED" | "OAUTH_TIMEOUT" | "STATE_MISMATCH" | "TOKEN_EXPIRED" | "TOKEN_REVOKED";

export interface AuthError {
  code: AuthErrorCode;
  message: string; // 原始错误消息（用于调试）
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean; // 正在处理 OAuth 回调
  error: AuthErrorCode | null;
}

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthErrorCode | null;
  login: () => Promise<void>;
  logout: () => void;
}
```

### 3. 认证流程

#### 3.1 登录流程（OAuth2 授权码模式）

```
用户点击"GitHub 登录"
  ↓
生成随机 state（CSRF 防护）→ sessionStorage
  ↓
调用 GET /oauth2/authorize?provider=github
  ↓
获取 redirect_url + state
  ↓
打开 popup 窗口 → GitHub 授权页
  ↓
用户同意授权 → GitHub 回调 callback.html
  ↓
callback.html 通过 postMessage 通知主窗口（code + state）
  ↓
验证 state 一致
  ↓
调用 POST /oauth2/token（code, state, device_id）
  ↓
获取 access_token + refresh_token + expires_in + user_id
  ↓
存储 tokens 到 localStorage
  ↓
更新 AuthState → isAuthenticated = true
  ↓
关闭 popup，跳转到原页面
```

#### 3.2 Token 刷新流程（请求拦截模式）

```
发起 API 请求（fetchWithAuth）
  ↓
检查 tokens 是否存在
  ├─ 不存在 → 抛出 NOT_AUTHENTICATED 错误
  └─ 存在 → 检查是否过期（提前 60 秒）
      ├─ 已过期 → 调用 POST /oauth2/refresh
      │   ├─ 成功 → 更新 tokens，继续请求
      │   └─ 失败 → 清除 tokens，抛出 TOKEN_EXPIRED 错误
      └─ 未过期 → 携带 token 发起请求
          ↓
      检查响应状态
      ├─ 200 → 返回响应
      └─ 401 → 清除 tokens，抛出 TOKEN_REVOKED 错误
```

#### 3.3 登出流程

```
用户点击"退出登录"
  ↓
清除 localStorage 中的 tokens
  ↓
更新 AuthState → isAuthenticated = false
  ↓
路由守卫自动跳转到登录页
```

#### 3.4 初始化流程（应用启动时）

```
应用启动 → AuthProvider 初始化
  ↓
从 localStorage 读取 tokens
  ├─ 不存在 → isAuthenticated = false
  └─ 存在 → 检查是否过期
      ├─ 已过期 → 清除 tokens，isAuthenticated = false
      └─ 未过期 → isAuthenticated = true
```

### 4. API 封装

```typescript
// authApi.ts
const API_BASE = "https://rtc-agent.cherish.chat";

export async function startGithubLogin(): Promise<void> {
  const state = crypto.randomUUID();
  sessionStorage.setItem("oauth_state", state);

  const { redirect_url } = await fetch(
    `${API_BASE}/oauth2/authorize?provider=github&state=${state}`,
  ).then(r => r.json());

  const popup = window.open(redirect_url, "github-oauth", "width=600,height=700");

  return new Promise((resolve, reject) => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type !== "oauth-callback") return;

      const { code, state: receivedState } = event.data;

      // 验证 state
      if (receivedState !== state) {
        cleanup();
        reject({ code: "STATE_MISMATCH", message: "State 验证失败" });
        return;
      }

      try {
        const tokens = await exchangeToken(code, state);
        saveTokens(tokens);
        cleanup();
        resolve();
      } catch (error) {
        cleanup();
        reject({ code: "OAUTH_FAILED", message: error.message });
      }
    };

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      popup?.close();
    };

    window.addEventListener("message", handleMessage);

    // 超时处理（5 分钟）
    setTimeout(
      () => {
        cleanup();
        reject({ code: "OAUTH_TIMEOUT", message: "登录超时" });
      },
      5 * 60 * 1000,
    );
  });
}

async function exchangeToken(code: string, state: string): Promise<TokenStorage> {
  const response = await fetch(`${API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      state,
      redirect_uri: `${window.location.origin}/peep/auth/callback.html`,
      device_id: crypto.randomUUID(),
      device_name: navigator.userAgent,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    user_id: data.user_id,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<TokenStorage> {
  const response = await fetch(`${API_BASE}/oauth2/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  const tokens = getTokens();
  return {
    ...tokens,
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const tokens = getTokens();
  if (!tokens) {
    throw { code: "NOT_AUTHENTICATED", message: "未登录" };
  }

  // 提前 60 秒刷新
  if (isTokenExpired(tokens, 60_000)) {
    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      saveTokens(newTokens);
      tokens.access_token = newTokens.access_token;
      tokens.expires_at = newTokens.expires_at;
    } catch {
      clearTokens();
      throw { code: "TOKEN_EXPIRED", message: "登录已过期" };
    }
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  if (response.status === 401) {
    clearTokens();
    throw { code: "TOKEN_REVOKED", message: "登录已被撤销" };
  }

  return response;
}
```

### 5. AuthContext

```typescript
// AuthContext.tsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { startGithubLogin, type AuthErrorCode } from './authApi';
import { getTokens, saveTokens, clearTokens, isTokenExpired } from './authStorage';
import type { User, AuthState, AuthContextValue } from './types';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
        error: error.code as AuthErrorCode,
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
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function useAuthRequired(): User {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) {
    throw new Error('Authentication required');
  }
  return user;
}
```

### 6. 路由守卫

```typescript
// App.tsx
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoginPage loading />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="rtc-layout">
      {/* 原有布局 */}
    </div>
  );
}
```

### 7. LoginPage 设计

```typescript
// LoginPage.tsx
export function LoginPage({ loading }: { loading?: boolean }) {
  const { t } = useI18n();
  const { login, error } = useAuth();

  return (
    <div className="login-page">
      <div className="login-container">
        {/* 左侧：品牌 + 登录 */}
        <div className="login-brand">
          <div className="login-header">
            <div className="login-logo">窥</div>
            <h1>{t('app.title')}</h1>
            <p className="login-subtitle">{t('login.subtitle')}</p>
          </div>

          <button className="login-button github" onClick={login} disabled={loading}>
            <GitHubIcon />
            <span>{t('login.github')}</span>
          </button>

          {error && (
            <div className="login-error" role="alert">
              {t(`login.error.${error.toLowerCase()}`)}
            </div>
          )}

          {loading && (
            <div className="login-loading">
              <Spinner size="sm" />
              <span>{t('login.processing')}</span>
            </div>
          )}

          <p className="login-footer">{t('login.privacy')}</p>
        </div>

        {/* 右侧：截图 + 应用介绍（预留） */}
        <div className="login-showcase">
          <div className="login-screenshot">
            {/* 预留：应用截图 */}
          </div>

          <div className="login-intro">
            {/* 预留：应用介绍 */}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 8. 国际化键值

```typescript
// locales/zh-CN.ts
export const zhCN = {
  // ... 现有键值
  login: {
    subtitle: "紫微斗数 · 大六壬 · 六爻 · 命理 AI 助手",
    github: "使用 GitHub 登录",
    logout: "退出登录",
    processing: "正在完成授权...",
    privacy: "登录即表示同意使用 GitHub 账号信息",
    error: {
      oauth_failed: "登录失败，请重试",
      oauth_timeout: "登录超时，请重试",
      state_mismatch: "安全验证失败，请重试",
      token_expired: "登录已过期，请重新登录",
      token_revoked: "登录已被撤销，请重新登录",
    },
    features: {
      title: "功能特色",
      items: [
        "紫微斗数排盘与运限分析",
        "大六壬起课占卜",
        "六爻起卦断事",
        "命理知识库管理",
        "AI 助手实时对话",
      ],
    },
  },
};

// locales/en-US.ts
export const enUS = {
  // ... 现有键值
  login: {
    subtitle: "Ziwei Doushu · Da Liu Ren · Liu Yao · Destiny AI Assistant",
    github: "Sign in with GitHub",
    logout: "Sign out",
    processing: "Processing authorization...",
    privacy: "By signing in, you agree to use GitHub account information",
    error: {
      oauth_failed: "Login failed, please try again",
      oauth_timeout: "Login timeout, please try again",
      state_mismatch: "Security verification failed, please try again",
      token_expired: "Login expired, please sign in again",
      token_revoked: "Login revoked, please sign in again",
    },
    features: {
      title: "Features",
      items: [
        "Ziwei Doushu charting and scope analysis",
        "Da Liu Ren divination",
        "Liu Yao hexagram reading",
        "Destiny knowledge base management",
        "AI assistant real-time chat",
      ],
    },
  },
};
```

### 9. 样式设计（双主题支持）

```css
/* styles/login.css */

/* 登录页容器 */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: var(--space-md);
}

.login-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2xl);
  max-width: 900px;
  width: 100%;
  padding: var(--space-2xl);
  background: var(--glass-bg-panel);
  backdrop-filter: blur(var(--blur-xl));
  border: 1px solid var(--line);
  border-radius: 16px;
}

/* 左侧：品牌 + 登录 */
.login-brand {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-lg);
}

.login-logo {
  width: 80px;
  height: 80px;
  margin: 0 auto var(--space-lg);
  background: linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 600;
  color: var(--text-on-accent);
}

.login-header h1 {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text);
  text-align: center;
  margin-bottom: var(--space-sm);
}

.login-subtitle {
  font-size: var(--text-md);
  color: var(--dim);
  text-align: center;
}

/* GitHub 登录按钮 */
.login-button.github {
  width: 100%;
  padding: var(--space-md);
  background: #24292e;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: var(--text-md);
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  transition: background 0.2s;
}

.login-button.github:hover {
  background: #2f363d;
}

.login-button.github:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 错误提示 */
.login-error {
  padding: var(--space-sm) var(--space-md);
  background: var(--danger-soft);
  color: var(--text-on-accent);
  border-radius: 6px;
  font-size: var(--text-sm);
}

/* 加载状态 */
.login-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  color: var(--dim);
  font-size: var(--text-sm);
}

/* 底部说明 */
.login-footer {
  font-size: var(--text-xs);
  color: var(--faint);
  text-align: center;
}

/* 右侧：截图 + 介绍 */
.login-showcase {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-lg);
}

.login-screenshot {
  aspect-ratio: 16 / 10;
  background: var(--glass-bg-card);
  border: 1px dashed var(--line);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--faint);
  font-size: var(--text-sm);
}

.login-intro {
  padding: var(--space-md);
  background: var(--glass-bg-card);
  border-radius: 8px;
  min-height: 120px;
}

/* 移动端：单列布局 */
@media (max-width: 768px) {
  .login-container {
    grid-template-columns: 1fr;
  }

  .login-showcase {
    display: none;
  }
}
```

### 10. 测试策略

#### 单元测试

```typescript
// authStorage.test.ts
describe('authStorage', () => {
  test('saveTokens 存储到 localStorage', () => {
    const tokens = { access_token: 'xxx', refresh_token: 'yyy', expires_at: 123, user_id: 'u1' };
    saveTokens(tokens);
    expect(localStorage.getItem('auth_tokens')).toBe(JSON.stringify(tokens));
  });

  test('getTokens 读取 localStorage', () => {
    localStorage.setItem('auth_tokens', JSON.stringify({ ... }));
    const tokens = getTokens();
    expect(tokens).toEqual({ ... });
  });

  test('isTokenExpired 判断过期', () => {
    const tokens = { expires_at: Date.now() - 1000 };
    expect(isTokenExpired(tokens)).toBe(true);

    tokens.expires_at = Date.now() + 60_000;
    expect(isTokenExpired(tokens)).toBe(false);
  });

  test('isTokenExpired 提前 60 秒判断', () => {
    const tokens = { expires_at: Date.now() + 30_000 };
    expect(isTokenExpired(tokens, 60_000)).toBe(true);
  });
});

// AuthContext.test.tsx
describe('AuthContext', () => {
  test('初始化时从 localStorage 读取 tokens', () => {
    localStorage.setItem('auth_tokens', JSON.stringify({ ... }));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.isAuthenticated).toBe(true);
  });

  test('logout 清除 tokens 和状态', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    act(() => result.current.logout());
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('auth_tokens')).toBeNull();
  });
});
```

#### 集成测试

```typescript
// LoginPage.test.tsx
describe('LoginPage', () => {
  test('点击登录按钮调用 login()', () => {
    const login = vi.fn();
    render(<LoginPage />, { wrapper: MockAuthProvider({ login }) });
    fireEvent.click(screen.getByText('使用 GitHub 登录'));
    expect(login).toHaveBeenCalled();
  });

  test('显示错误消息', () => {
    render(<LoginPage />, { wrapper: MockAuthProvider({ error: 'OAUTH_FAILED' }) });
    expect(screen.getByText('登录失败，请重试')).toBeInTheDocument();
  });

  test('国际化支持', () => {
    render(<LoginPage />, { wrapper: MockAuthProvider({ locale: 'en-US' }) });
    expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
  });
});
```

## 实现要点

### 关键设计决策

1. **纯 React Context + Hook**：符合项目现有架构，无额外依赖
2. **请求拦截模式**：每次 API 调用前检查 token，提前 60 秒刷新
3. **双主题支持**：复用现有 CSS 变量系统，GitHub 按钮使用官方品牌色
4. **国际化**：所有错误提示和用户可见文本支持中英文
5. **预留扩展**：LoginPage 预留截图和应用介绍位置

### 注意事项

1. **Token 存储**：使用 localStorage，key 为 `auth_tokens`
2. **State 验证**：使用 sessionStorage 存储 OAuth state，防止 CSRF 攻击
3. **多标签页**：不同步，各自独立（一个标签页登出后，其他标签页因 token 失效自动退出）
4. **RTC Agent 集成**：后续处理（需要调研 `@rtc-agent/component` 是否支持传入自定义 token）

## 后续工作

1. 实现 `src/core/auth/` 模块
2. 实现 `LoginPage` 和 `LogoutButton` 组件
3. 集成到 `App.tsx` 和 `Header.tsx`
4. 添加国际化键值
5. 编写单元测试和集成测试
6. 调研 RTC Agent 集成方案
