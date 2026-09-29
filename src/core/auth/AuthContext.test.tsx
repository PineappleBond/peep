import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { AuthProvider, useAuth } from "./AuthContext";
import { saveTokens } from "./authStorage";
import type { TokenStorage } from "./types";

// 内存 localStorage 模拟
let memStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => (k in memStore ? memStore[k] : null),
  setItem: (k: string, v: string) => {
    memStore[k] = v;
  },
  removeItem: (k: string) => {
    delete memStore[k];
  },
  get length() {
    return Object.keys(memStore).length;
  },
  key: (i: number) => Object.keys(memStore)[i] ?? null,
  clear: () => {
    memStore = {};
  },
};

vi.stubGlobal("localStorage", mockLocalStorage);

describe("AuthContext", () => {
  beforeEach(() => {
    memStore = {};
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
    expect(html).toContain("logging-out");
    expect(localStorage.getItem("auth_tokens")).toBeNull();
  });
});
