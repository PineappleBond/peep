# GitHub 登录功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 peep-v2 项目接入 GitHub OAuth2 登录功能，实现用户身份认证，支持双主题和国际化。

**Architecture:** 采用纯 React Context + Hook 方案，OAuth2 授权码流程。Token 存储在 localStorage，请求拦截模式自动刷新。整个应用需要登录，未登录时显示 LoginPage。

**Tech Stack:** React 18, TypeScript, Vite, CSS Variables (双主题), i18n (JSON)

**Spec:** `docs/plans/2026-09-29-github-auth-design.md`

## Global Constraints

- 登录必需：必须登录后才能使用应用
- 仅接入 GitHub 登录（单一 Provider）
- Token 存储：localStorage，key 为 `auth_tokens`
- Token 刷新：请求拦截模式，提前 60 秒刷新
- 多标签页：不同步，各自独立
- 国际化：所有错误提示和用户可见文本支持中英文
- 主题适配：支持亮色/暗色双主题，GitHub 按钮使用官方品牌色 (#24292e)
- 后端 API：`https://rtc-agent.cherish.chat`

## Review Focus

1. **Token 过期处理**：当 access_token 过期时，是否正确触发刷新？刷新失败时是否清除 token 并跳转登录页？
2. **State 验证**：OAuth state 是否正确生成和验证，防止 CSRF 攻击？
3. **双主题适配**：LoginPage 在亮色/暗色主题下是否正确显示？GitHub 按钮是否使用官方品牌色？
4. **国际化完整性**：所有错误提示和用户可见文本是否支持中英文？
5. **错误边界**：登录失败、超时、token 撤销等异常场景是否正确处理并显示友好提示？

---

### Task 1: 类型定义

**Files:**

- Create: `src/core/auth/types.ts`

**Interfaces:**

- Produces: `User`, `TokenStorage`, `AuthErrorCode`, `AuthError`, `AuthState`, `AuthContextValue`

- [ ] **Step 1: Write the failing test**

```typescript
// src/core/auth/types.test.ts
import { describe, expect, it } from "vitest";
import type { User, TokenStorage, AuthErrorCode } from "./types";

describe("types", () => {
  it("User 类型包含 id 字段", () => {
    const user: User = { id: "user-123" };
    expect(user.id).toBe("user-123");
  });

  it("TokenStorage 类型包含所有必需字段", () => {
    const tokens: TokenStorage = {
      access_token: "access-xxx",
      refresh_token: "refresh-yyy",
      expires_at: Date.now() + 3600_000,
      user_id: "user-123",
    };
    expect(tokens.access_token).toBe("access-xxx");
    expect(tokens.refresh_token).toBe("refresh-yyy");
    expect(tokens.expires_at).toBeGreaterThan(Date.now());
    expect(tokens.user_id).toBe("user-123");
  });

  it("AuthErrorCode 包含所有错误类型", () => {
    const codes: AuthErrorCode[] = [
      "OAUTH_FAILED",
      "OAUTH_TIMEOUT",
      "STATE_MISMATCH",
      "TOKEN_EXPIRED",
      "TOKEN_REVOKED",
    ];
    expect(codes).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/core/auth/types.test.ts`
Expected: FAIL with "Cannot find module './types'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/auth/types.ts
export interface User {
  id: string;
}

export interface TokenStorage {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
}

export type AuthErrorCode =
  "OAUTH_FAILED" | "OAUTH_TIMEOUT" | "STATE_MISMATCH" | "TOKEN_EXPIRED" | "TOKEN_REVOKED";

export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/core/auth/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/auth/types.ts src/core/auth/types.test.ts
git commit -m "功能：GitHub 登录类型定义——User, TokenStorage, AuthErrorCode"
```

---

### Task 2: Token 存储

**Files:**

- Create: `src/core/auth/authStorage.ts`
- Create: `src/core/auth/authStorage.test.ts`

**Interfaces:**

- Consumes: `TokenStorage` from `./types`
- Produces: `saveTokens`, `getTokens`, `clearTokens`, `isTokenExpired`

- [ ] **Step 1: Write the failing test**

```typescript
// src/core/auth/authStorage.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { saveTokens, getTokens, clearTokens, isTokenExpired } from "./authStorage";
import type { TokenStorage } from "./types";

describe("authStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockTokens: TokenStorage = {
    access_token: "access-xxx",
    refresh_token: "refresh-yyy",
    expires_at: Date.now() + 3600_000,
    user_id: "user-123",
  };

  it("saveTokens 存储到 localStorage", () => {
    saveTokens(mockTokens);
    const stored = localStorage.getItem("auth_tokens");
    expect(stored).toBe(JSON.stringify(mockTokens));
  });

  it("getTokens 读取 localStorage", () => {
    localStorage.setItem("auth_tokens", JSON.stringify(mockTokens));
    const tokens = getTokens();
    expect(tokens).toEqual(mockTokens);
  });

  it("getTokens 返回 null 当不存在", () => {
    const tokens = getTokens();
    expect(tokens).toBeNull();
  });

  it("clearTokens 清除 localStorage", () => {
    localStorage.setItem("auth_tokens", JSON.stringify(mockTokens));
    clearTokens();
    expect(localStorage.getItem("auth_tokens")).toBeNull();
  });

  it("isTokenExpired 判断已过期", () => {
    const expiredTokens: TokenStorage = {
      ...mockTokens,
      expires_at: Date.now() - 1000,
    };
    expect(isTokenExpired(expiredTokens)).toBe(true);
  });

  it("isTokenExpired 判断未过期", () => {
    const validTokens: TokenStorage = {
      ...mockTokens,
      expires_at: Date.now() + 60_000,
    };
    expect(isTokenExpired(validTokens)).toBe(false);
  });

  it("isTokenExpired 提前 60 秒判断", () => {
    const almostExpiredTokens: TokenStorage = {
      ...mockTokens,
      expires_at: Date.now() + 30_000,
    };
    expect(isTokenExpired(almostExpiredTokens, 60_000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/core/auth/authStorage.test.ts`
Expected: FAIL with "Cannot find module './authStorage'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/auth/authStorage.ts
import type { TokenStorage } from "./types";

const STORAGE_KEY = "auth_tokens";

export function saveTokens(tokens: TokenStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function getTokens(): TokenStorage | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as TokenStorage;
  } catch {
    return null;
  }
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isTokenExpired(tokens: TokenStorage, bufferMs = 0): boolean {
  return Date.now() + bufferMs >= tokens.expires_at;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/core/auth/authStorage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/auth/authStorage.ts src/core/auth/authStorage.test.ts
git commit -m "功能：Token 存储与刷新逻辑——saveTokens, getTokens, isTokenExpired"
```

---

### Task 3: OAuth API 封装

**Files:**

- Create: `src/core/auth/authApi.ts`
- Create: `src/core/auth/authApi.test.ts`

**Interfaces:**

- Consumes: `TokenStorage` from `./types`, `saveTokens`, `getTokens`, `clearTokens`, `isTokenExpired` from `./authStorage`
- Produces: `startGithubLogin`, `exchangeToken`, `refreshAccessToken`, `fetchWithAuth`

- [ ] **Step 1: Write the failing test**

```typescript
// src/core/auth/authApi.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { isTokenExpired } from "./authStorage";
import type { TokenStorage } from "./types";

describe("authApi", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe("isTokenExpired (helper)", () => {
    it("提前 60 秒判断过期", () => {
      const tokens: TokenStorage = {
        access_token: "xxx",
        refresh_token: "yyy",
        expires_at: Date.now() + 30_000,
        user_id: "u1",
      };
      expect(isTokenExpired(tokens, 60_000)).toBe(true);
    });

    it("未过期", () => {
      const tokens: TokenStorage = {
        access_token: "xxx",
        refresh_token: "yyy",
        expires_at: Date.now() + 120_000,
        user_id: "u1",
      };
      expect(isTokenExpired(tokens, 60_000)).toBe(false);
    });
  });

  describe("startGithubLogin", () => {
    it("生成 state 并存储到 sessionStorage", async () => {
      globalThis.crypto.randomUUID = vi.fn(() => "test-state-uuid");
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ redirect_url: "https://github.com/authorize" }),
      });
      window.open = vi.fn();

      const { startGithubLogin } = await import("./authApi");
      startGithubLogin().catch(() => {});

      expect(sessionStorage.getItem("oauth_state")).toBe("test-state-uuid");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/core/auth/authApi.test.ts`
Expected: FAIL with "Cannot find module './authApi'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/auth/authApi.ts
import type { TokenStorage, AuthErrorCode } from "./types";
import { saveTokens, getTokens, clearTokens, isTokenExpired } from "./authStorage";

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

      if (receivedState !== state) {
        cleanup();
        reject({ code: "STATE_MISMATCH" as AuthErrorCode, message: "State 验证失败" });
        return;
      }

      try {
        const tokens = await exchangeToken(code, state);
        saveTokens(tokens);
        cleanup();
        resolve();
      } catch (error) {
        cleanup();
        reject({ code: "OAUTH_FAILED" as AuthErrorCode, message: error.message });
      }
    };

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      popup?.close();
    };

    window.addEventListener("message", handleMessage);

    setTimeout(
      () => {
        cleanup();
        reject({ code: "OAUTH_TIMEOUT" as AuthErrorCode, message: "登录超时" });
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
  if (!tokens) {
    throw new Error("No tokens found");
  }
  return {
    ...tokens,
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const tokens = getTokens();
  if (!tokens) {
    throw { code: "NOT_AUTHENTICATED" as AuthErrorCode, message: "未登录" };
  }

  if (isTokenExpired(tokens, 60_000)) {
    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      saveTokens(newTokens);
      tokens.access_token = newTokens.access_token;
      tokens.expires_at = newTokens.expires_at;
    } catch {
      clearTokens();
      throw { code: "TOKEN_EXPIRED" as AuthErrorCode, message: "登录已过期" };
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
    throw { code: "TOKEN_REVOKED" as AuthErrorCode, message: "登录已被撤销" };
  }

  return response;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/core/auth/authApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/auth/authApi.ts src/core/auth/authApi.test.ts
git commit -m "功能：OAuth2 API 封装——startGithubLogin, exchangeToken, fetchWithAuth"
```

---

### Task 4: AuthContext

**Files:**

- Create: `src/core/auth/AuthContext.tsx`
- Create: `src/core/auth/AuthContext.test.tsx`

**Interfaces:**

- Consumes: `startGithubLogin` from `./authApi`, `getTokens`, `clearTokens`, `isTokenExpired` from `./authStorage`, types from `./types`
- Produces: `AuthProvider`, `useAuth`, `useAuthRequired`

- [ ] **Step 1: Write the failing test**

```typescript
// src/core/auth/AuthContext.test.tsx
import { describe, expect, it, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { AuthProvider, useAuth } from "./AuthContext";
import { saveTokens } from "./authStorage";
import type { TokenStorage } from "./types";

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("初始化时未登录", () => {
    function Consumer() {
      const { isAuthenticated } = useAuth();
      return <div>{isAuthenticated ? "logged-in" : "logged-out"}</div>;
    }
    const html = renderToString(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    expect(html).toContain("logged-out");
  });

  it("初始化时从 localStorage 读取 tokens", () => {
    const tokens: TokenStorage = {
      access_token: "xxx",
      refresh_token: "yyy",
      expires_at: Date.now() + 3600_000,
      user_id: "user-123",
    };
    saveTokens(tokens);

    function Consumer() {
      const { isAuthenticated, user } = useAuth();
      return <div>{isAuthenticated ? `logged-in-${user?.id}` : "logged-out"}</div>;
    }
    const html = renderToString(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    expect(html).toContain("logged-in-user-123");
  });

  it("logout 清除 tokens 和状态", () => {
    const tokens: TokenStorage = {
      access_token: "xxx",
      refresh_token: "yyy",
      expires_at: Date.now() + 3600_000,
      user_id: "user-123",
    };
    saveTokens(tokens);

    function Consumer() {
      const { isAuthenticated, logout } = useAuth();
      if (isAuthenticated) {
        logout();
        return <div>logging-out</div>;
      }
      return <div>logged-out</div>;
    }
    const html = renderToString(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    expect(html).toContain("logged-out");
    expect(localStorage.getItem("auth_tokens")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/core/auth/AuthContext.test.tsx`
Expected: FAIL with "Cannot find module './AuthContext'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/auth/AuthContext.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { startGithubLogin } from "./authApi";
import { getTokens, saveTokens, clearTokens, isTokenExpired } from "./authStorage";
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/core/auth/AuthContext.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/auth/AuthContext.tsx src/core/auth/AuthContext.test.tsx
git commit -m "功能：AuthContext——AuthProvider, useAuth, useAuthRequired"
```

---

### Task 5: GitHub 图标组件

**Files:**

- Create: `src/components/icons/GitHubIcon.tsx`

**Interfaces:**

- Consumes: None
- Produces: `GitHubIcon`

- [ ] **Step 1: Write the implementation**

```typescript
// src/components/icons/GitHubIcon.tsx
/**
 * GitHub 图标
 * 使用当前颜色（currentColor），支持主题适配
 */
import type { SVGAttributes } from "react";

export function GitHubIcon(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      {...props}
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/icons/GitHubIcon.tsx
git commit -m "功能：GitHub 图标组件——SVG，支持 currentColor"
```

---

### Task 6: 国际化键值

**Files:**

- Modify: `src/locales/zh-CN.json`
- Modify: `src/locales/en-US.json`

**Interfaces:**

- Consumes: None
- Produces: `login.*` 键值

- [ ] **Step 1: Add Chinese translations**

```json
// src/locales/zh-CN.json (在文件末尾添加)
{
  "login.subtitle": "紫微斗数 · 大六壬 · 六爻 · 命理 AI 助手",
  "login.github": "使用 GitHub 登录",
  "login.logout": "退出登录",
  "login.processing": "正在完成授权...",
  "login.privacy": "登录即表示同意使用 GitHub 账号信息",
  "login.error.oauth_failed": "登录失败，请重试",
  "login.error.oauth_timeout": "登录超时，请重试",
  "login.error.state_mismatch": "安全验证失败，请重试",
  "login.error.token_expired": "登录已过期，请重新登录",
  "login.error.token_revoked": "登录已被撤销，请重新登录",
  "login.features.title": "功能特色",
  "login.features.item1": "紫微斗数排盘与运限分析",
  "login.features.item2": "大六壬起课占卜",
  "login.features.item3": "六爻起卦断事",
  "login.features.item4": "命理知识库管理",
  "login.features.item5": "AI 助手实时对话"
}
```

- [ ] **Step 2: Add English translations**

```json
// src/locales/en-US.json (在文件末尾添加)
{
  "login.subtitle": "Ziwei Doushu · Da Liu Ren · Liu Yao · Destiny AI Assistant",
  "login.github": "Sign in with GitHub",
  "login.logout": "Sign out",
  "login.processing": "Processing authorization...",
  "login.privacy": "By signing in, you agree to use GitHub account information",
  "login.error.oauth_failed": "Login failed, please try again",
  "login.error.oauth_timeout": "Login timeout, please try again",
  "login.error.state_mismatch": "Security verification failed, please try again",
  "login.error.token_expired": "Login expired, please sign in again",
  "login.error.token_revoked": "Login revoked, please sign in again",
  "login.features.title": "Features",
  "login.features.item1": "Ziwei Doushu charting and scope analysis",
  "login.features.item2": "Da Liu Ren divination",
  "login.features.item3": "Liu Yao hexagram reading",
  "login.features.item4": "Destiny knowledge base management",
  "login.features.item5": "AI assistant real-time chat"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/zh-CN.json src/locales/en-US.json
git commit -m "功能：GitHub 登录国际化键值——中/英文错误提示和功能介绍"
```

---

### Task 7: LoginPage 组件

**Files:**

- Create: `src/components/LoginPage.tsx`
- Create: `src/styles/login.css`
- Modify: `src/index.css`

**Interfaces:**

- Consumes: `useAuth` from `../core/auth/AuthContext`, `useI18n` from `../core/i18n`, `GitHubIcon` from `./icons/GitHubIcon`, `Spinner` from `./Spinner`
- Produces: `LoginPage`

- [ ] **Step 1: Write the implementation**

```typescript
// src/components/LoginPage.tsx
/**
 * LoginPage 组件 - GitHub 登录页面
 * 支持双主题，预留截图和应用介绍位置
 */
import { useAuth } from "../core/auth/AuthContext";
import { useI18n } from "../core/i18n";
import { GitHubIcon } from "./icons/GitHubIcon";
import { Spinner } from "./Spinner";

interface LoginPageProps {
  loading?: boolean;
}

export function LoginPage({ loading }: LoginPageProps) {
  const { t } = useI18n();
  const { login, error } = useAuth();

  return (
    <div className="login-page">
      <div className="login-container">
        {/* 左侧：品牌 + 登录 */}
        <div className="login-brand">
          <div className="login-header">
            <div className="login-logo">窥</div>
            <h1>{t("app.title")}</h1>
            <p className="login-subtitle">{t("login.subtitle")}</p>
          </div>

          <button className="login-button github" onClick={login} disabled={loading}>
            <GitHubIcon />
            <span>{t("login.github")}</span>
          </button>

          {error && (
            <div className="login-error" role="alert">
              {t(`login.error.${error.toLowerCase()}`)}
            </div>
          )}

          {loading && (
            <div className="login-loading">
              <Spinner size="sm" />
              <span>{t("login.processing")}</span>
            </div>
          )}

          <p className="login-footer">{t("login.privacy")}</p>
        </div>

        {/* 右侧：截图 + 应用介绍（预留） */}
        <div className="login-showcase">
          <div className="login-screenshot">
            {/* 预留：应用截图 */}
          </div>

          <div className="login-intro">
            <h2>{t("login.features.title")}</h2>
            <ul>
              <li>{t("login.features.item1")}</li>
              <li>{t("login.features.item2")}</li>
              <li>{t("login.features.item3")}</li>
              <li>{t("login.features.item4")}</li>
              <li>{t("login.features.item5")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
```

```css
/* src/styles/login.css */
/* ════════════════════════════════════════════════════
   login.css — 登录页样式（支持双主题）
   ════════════════════════════════════════════════════ */

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

.login-error {
  padding: var(--space-sm) var(--space-md);
  background: var(--danger-soft);
  color: var(--text-on-accent);
  border-radius: 6px;
  font-size: var(--text-sm);
}

.login-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  color: var(--dim);
  font-size: var(--text-sm);
}

.login-footer {
  font-size: var(--text-xs);
  color: var(--faint);
  text-align: center;
}

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

.login-intro h2 {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-sm);
}

.login-intro ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.login-intro li {
  font-size: var(--text-sm);
  color: var(--dim);
  padding: var(--space-xs) 0;
  padding-left: var(--space-md);
  position: relative;
}

.login-intro li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--gold);
}

@media (max-width: 768px) {
  .login-container {
    grid-template-columns: 1fr;
  }

  .login-showcase {
    display: none;
  }
}
```

```css
/* src/index.css (添加) */
@import "./styles/login.css";
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LoginPage.tsx src/styles/login.css src/index.css
git commit -m "功能：LoginPage 组件——GitHub 登录按钮，双主题支持，预留截图位置"
```

---

### Task 8: LogoutButton 组件

**Files:**

- Create: `src/components/LogoutButton.tsx`
- Create: `src/components/icons/LogoutIcon.tsx`

**Interfaces:**

- Consumes: `useAuth` from `../core/auth/AuthContext`, `useI18n` from `../core/i18n`
- Produces: `LogoutButton`

- [ ] **Step 1: Write LogoutIcon**

```typescript
// src/components/icons/LogoutIcon.tsx
/**
 * 退出登录图标
 * 使用当前颜色（currentColor），支持主题适配
 */
import type { SVGAttributes } from "react";

export function LogoutIcon(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      {...props}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
```

- [ ] **Step 2: Write LogoutButton**

```typescript
// src/components/LogoutButton.tsx
/**
 * LogoutButton 组件 - 退出登录按钮
 * 位于 Header 右上角，图标按钮，悬停提示
 */
import { useAuth } from "../core/auth/AuthContext";
import { useI18n } from "../core/i18n";
import { LogoutIcon } from "./icons/LogoutIcon";

export function LogoutButton() {
  const { t } = useI18n();
  const { logout } = useAuth();

  return (
    <button
      className="header-icon-button"
      onClick={logout}
      title={t("login.logout")}
      aria-label={t("login.logout")}
    >
      <LogoutIcon />
    </button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/LogoutButton.tsx src/components/icons/LogoutIcon.tsx
git commit -m "功能：LogoutButton 组件——退出登录图标按钮"
```

---

### Task 9: 集成到 App.tsx

**Files:**

- Modify: `src/App.tsx`

**Interfaces:**

- Consumes: `AuthProvider` from `./core/auth/AuthContext`, `LoginPage` from `./components/LoginPage`, `useAuth` from `./core/auth/AuthContext`
- Produces: 整个应用需要登录

- [ ] **Step 1: Modify App.tsx**

在 `src/App.tsx` 中添加：

```typescript
// 导入
import { AuthProvider, useAuth } from "./core/auth/AuthContext";
import { LoginPage } from "./components/LoginPage";

// 修改 App 组件
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
    // 原有的 rtc-layout 内容
    <div className="rtc-layout">
      {/* ... */}
    </div>
  );
}
```

- [ ] **Step 2: Test manually**

Run: `npm run dev`
Expected:

- 未登录时显示 LoginPage
- 点击"使用 GitHub 登录"按钮，打开 popup 窗口
- 登录成功后跳转到主页面

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "功能：集成 AuthProvider 到 App——未登录时显示 LoginPage"
```

---

### Task 10: 集成到 Header

**Files:**

- Modify: `src/components/Header.tsx`

**Interfaces:**

- Consumes: `LogoutButton` from `./LogoutButton`
- Produces: Header 右上角显示退出登录按钮

- [ ] **Step 1: Modify Header.tsx**

在 `src/components/Header.tsx` 的 `header-toolbar` 中添加：

```typescript
// 导入
import { LogoutButton } from "./LogoutButton";

// 在 header-toolbar 中添加
<div className="header-toolbar">
  <ThemeSwitcher />
  <LanguageSwitcher />
  <LogoutButton />
</div>
```

- [ ] **Step 2: Test manually**

Run: `npm run dev`
Expected:

- 登录后，Header 右上角显示退出登录按钮
- 点击退出登录按钮，跳转回 LoginPage

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.tsx
git commit -m "功能：Header 添加 LogoutButton——右上角退出登录"
```

---

### Task 11: 最终测试与清理

**Files:**

- None

**Interfaces:**

- Consumes: All previous tasks
- Produces: 完整功能验证

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Build project**

Run: `npm run build`
Expected: Build successful

- [ ] **Step 3: Manual testing**

Run: `npm run dev`
Test scenarios:

1. 未登录时显示 LoginPage
2. 点击"使用 GitHub 登录"按钮
3. 完成 OAuth 流程
4. 登录成功后跳转到主页面
5. Header 右上角显示退出登录按钮
6. 点击退出登录按钮，跳转回 LoginPage
7. 切换亮色/暗色主题，LoginPage 正确显示
8. 切换中英文，LoginPage 正确显示

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

- [ ] **Step 5: Summary**

功能已完成：

- ✅ OAuth2 授权码流程
- ✅ Token 存储与自动刷新
- ✅ 双主题支持
- ✅ 国际化支持
- ✅ LoginPage + LogoutButton
- ✅ 集成到 App.tsx 和 Header.tsx
- ✅ 单元测试
