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
        reject({ code: "OAUTH_FAILED" as AuthErrorCode, message: (error as Error).message });
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
