import { describe, expect, it, beforeEach, vi } from "vitest";
import { saveTokens, getTokens, clearTokens, isTokenExpired } from "./authStorage";
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

describe("authStorage", () => {
  beforeEach(() => {
    memStore = {};
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
