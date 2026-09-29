import type { TokenStorage, AuthErrorCode } from "./types";
import { saveTokens, getTokens, clearTokens, isTokenExpired } from "./authStorage";

const API_BASE = "https://rtc-agent.cherish.chat";

const DEVICE_ID_KEY = "peep_device_id";
let deviceIdPromise: Promise<string> | null = null;

/**
 * 获取或创建设备 ID（单例模式，避免并发）
 *
 * 设备 ID 用于标识当前浏览器/设备，与后端 JWT 中的 device_id 保持一致。
 * 使用 localStorage 持久化，确保刷新页面后仍然有效。
 */
export async function getOrCreateDeviceId(): Promise<string> {
  // 如果已经有正在进行的 Promise，直接返回（避免并发）
  if (deviceIdPromise) {
    return deviceIdPromise;
  }

  deviceIdPromise = (async () => {
    try {
      // 先检查 localStorage 中是否已有 device ID
      const existing = localStorage.getItem(DEVICE_ID_KEY);
      if (existing) {
        return existing;
      }

      // 生成新的 device ID
      const newDeviceId = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, newDeviceId);
      return newDeviceId;
    } finally {
      // 无论成功失败，都要清除 Promise，允许下次重试
      deviceIdPromise = null;
    }
  })();

  return deviceIdPromise;
}

/**
 * 同步获取设备 ID（如果不存在则返回 null）
 */
export function getDeviceIdSync(): string | null {
  return localStorage.getItem(DEVICE_ID_KEY);
}

/**
 * 同步获取或创建设备 ID（用于初始化阶段）
 *
 * 注意：此方法是同步的，适用于应用启动时确保设备 ID 存在。
 * 对于登录流程，请使用异步的 getOrCreateDeviceId() 以避免并发问题。
 */
export function getOrCreateDeviceIdSync(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const newDeviceId = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, newDeviceId);
  return newDeviceId;
}

export async function startGithubLogin(): Promise<void> {
  // 动态获取当前域名作为回调地址
  const redirectUri = `${window.location.origin}/peep/auth/callback.html`;

  // 调用后端获取授权 URL 和 state
  const { redirect_url, state } = await fetch(
    `${API_BASE}/oauth2/authorize?provider=github&redirect_uri=${encodeURIComponent(redirectUri)}`,
  ).then(r => r.json());

  // 使用后端返回的 state（而不是自己生成）
  sessionStorage.setItem("oauth_state", state);

  const popup = window.open(redirect_url, "github-oauth", "width=600,height=700");

  return new Promise((resolve, reject) => {
    const handleMessage = async (event: MessageEvent) => {
      // 验证 origin 必须与当前窗口一致
      if (event.origin !== window.location.origin) {
        console.warn("[auth] postMessage origin mismatch:", event.origin, window.location.origin);
        return;
      }

      if (event.data.type !== "oauth-callback") return;

      const { code, state: receivedState } = event.data;

      // 调试日志
      if (import.meta.env.DEV) {
        console.log("[auth] OAuth callback received:", { receivedState, expectedState: state });
      }

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
  const deviceId = await getOrCreateDeviceId();
  const response = await fetch(`${API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      state,
      redirect_uri: `${window.location.origin}/peep/auth/callback.html`,
      device_id: deviceId,
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

export async function refreshAccessToken(refreshToken: string): Promise<TokenStorage> {
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
