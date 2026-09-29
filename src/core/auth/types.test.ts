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
