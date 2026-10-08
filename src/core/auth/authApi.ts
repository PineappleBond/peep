import type { TokenStorage, AuthErrorCode } from "./types";
import { saveTokens, getTokens, clearTokens, isTokenExpired } from "./authStorage";

const API_BASE = "https://rtc-agent.cherish.chat";

const DEVICE_ID_KEY = "peep_device_id";
let deviceIdPromise: Promise<string> | null = null;

/**
 * 生成 PKCE code_verifier（RFC 7636）
 *
 * 生成 43-128 字符的随机字符串，使用 URL 安全的字符集：
 * [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  // 将随机字节转为 base64url 编码（去掉 padding，替换 + → - / → _）
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * 根据 code_verifier 生成 code_challenge（S256 方法）
 *
 * 算法：SHA-256(verifier) → base64url 编码
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  // 将 ArrayBuffer 转为 base64url 编码
  const bytes = new Uint8Array(hash);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

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

  // 生成 PKCE 对（RFC 7636）
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // 调用后端获取授权 URL 和 state（携带 PKCE code_challenge）
  const authorizeUrl =
    `${API_BASE}/oauth2/authorize?provider=github` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256`;
  const { redirect_url, state } = await fetch(authorizeUrl).then(r => r.json());

  // 使用后端返回的 state（而不是自己生成）
  sessionStorage.setItem("oauth_state", state);
  // 存储 PKCE verifier，token 交换时使用
  sessionStorage.setItem("pkce_verifier", codeVerifier);

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
  const codeVerifier = sessionStorage.getItem("pkce_verifier") || undefined;
  const response = await fetch(`${API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      state,
      redirect_uri: `${window.location.origin}/peep/auth/callback.html`,
      device_id: deviceId,
      device_name: navigator.userAgent,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
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
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[auth] 调用刷新接口", {
      refreshTokenLength: refreshToken?.length,
      refreshTokenPreview: refreshToken?.substring(0, 20) + "...",
    });
  }

  const response = await fetch(`${API_BASE}/oauth2/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[auth] 刷新接口响应", {
      status: response.status,
      ok: response.ok,
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (import.meta.env.DEV) {
       
      console.error("[auth] 刷新接口失败", { status: response.status, error: errorText });
    }
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  // 从 localStorage 获取当前 tokens 以保留 user_id 和 refresh_token
  const currentTokens = getTokens();
  if (!currentTokens) {
    throw new Error("No tokens found");
  }
  return {
    ...currentTokens,
    access_token: data.access_token,
    // 如果后端返回了新的 refresh_token，则更新；否则保留原有的
    refresh_token: data.refresh_token || currentTokens.refresh_token,
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
