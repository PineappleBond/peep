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
