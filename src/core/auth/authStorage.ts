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
