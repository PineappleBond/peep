import { describe, expect, it, vi, beforeEach } from "vitest";
import { isTokenExpired } from "./authStorage";
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

// 内存 sessionStorage 模拟
let sessionStore: Record<string, string> = {};
const mockSessionStorage = {
  getItem: (k: string) => (k in sessionStore ? sessionStore[k] : null),
  setItem: (k: string, v: string) => {
    sessionStore[k] = v;
  },
  removeItem: (k: string) => {
    delete sessionStore[k];
  },
  get length() {
    return Object.keys(sessionStore).length;
  },
  key: (i: number) => Object.keys(sessionStore)[i] ?? null,
  clear: () => {
    sessionStore = {};
  },
};

vi.stubGlobal("localStorage", mockLocalStorage);
vi.stubGlobal("sessionStorage", mockSessionStorage);

describe("authApi", () => {
  beforeEach(() => {
    memStore = {};
    sessionStore = {};
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
    it("调用 /oauth2/authorize 并传递 redirect_uri", async () => {
      vi.resetModules(); // 清除模块缓存

      const mockState = "backend-state-12345";
      const mockFetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({ redirect_url: "https://github.com/authorize", state: mockState }),
      });
      globalThis.fetch = mockFetch;

      const mockOpen = vi.fn();
      vi.stubGlobal("window", {
        open: mockOpen,
        location: { origin: "http://localhost:5173" },
      });

      const { startGithubLogin } = await import("./authApi");

      // 启动登录流程
      const promise = startGithubLogin();
      promise.catch(() => {});

      // 等待 fetch 完成
      await new Promise(resolve => setTimeout(resolve, 10));

      // 验证 fetch 被正确调用
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/oauth2/authorize?provider=github"),
      );
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("redirect_uri="));
    });
  });
});
