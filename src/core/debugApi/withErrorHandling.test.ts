/**
 * withErrorHandling / withErrorHandlingSync 辅助函数单元测试
 *
 * 验证统一的错误处理包装器：
 * - 正常返回值透传
 * - 指定错误类子类直接抛出（不包装）
 * - 其他错误统一用 wrapError 包装
 * - 计时器正确启动/停止
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { withErrorHandling, withErrorHandlingSync } from "./helpers";
import { ZiWeiError, DaLiuRenError, ApiErrorCode } from "./errors";

/* ── mock logger ── */
vi.mock("./logger", () => ({
  log: vi.fn(),
  timer: vi.fn(() => vi.fn()),
}));

describe("withErrorHandling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常同步返回值透传", async () => {
    const result = await withErrorHandling("test", ZiWeiError, () => 42);
    expect(result).toBe(42);
  });

  it("正常异步返回值透传", async () => {
    const result = await withErrorHandling("test", ZiWeiError, async () => {
      return "hello";
    });
    expect(result).toBe("hello");
  });

  it("返回对象值透传", async () => {
    const obj = { id: 1, name: "test" };
    const result = await withErrorHandling("test", ZiWeiError, () => obj);
    expect(result).toEqual(obj);
  });

  it("指定错误类子类直接抛出，不包装", async () => {
    const originalError = new ZiWeiError("原始错误", "inner", {
      errorCode: ApiErrorCode.NOT_FOUND,
    });

    await expect(
      withErrorHandling("outer", ZiWeiError, () => {
        throw originalError;
      }),
    ).rejects.toBe(originalError);
  });

  it("非指定错误类的 Error 被 wrapError 包装", async () => {
    await expect(
      withErrorHandling("test", ZiWeiError, () => {
        throw new Error("原生错误");
      }),
    ).rejects.toThrow();

    try {
      await withErrorHandling("test", ZiWeiError, () => {
        throw new Error("原生错误");
      });
    } catch (err) {
      // wrapError 对原生 Error 附加 [label] 前缀，不改变类型
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("[test]");
      expect((err as Error).message).toContain("原生错误");
    }
  });

  it("非 Error 值（string）被包装为指定错误类", async () => {
    try {
      await withErrorHandling("test", DaLiuRenError, () => {
        throw "字符串错误";
      });
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(DaLiuRenError);
      expect((err as DaLiuRenError).source).toBe("test");
    }
  });

  it("调用 timer 进行计时", async () => {
    const { timer } = await import("./logger");
    const stopFn = vi.fn();
    (timer as ReturnType<typeof vi.fn>).mockReturnValue(stopFn);

    await withErrorHandling("testLabel", ZiWeiError, () => "ok");

    expect(timer).toHaveBeenCalledWith("testLabel");
    expect(stopFn).toHaveBeenCalled();
  });

  it("异常时也调用 stop 停止计时", async () => {
    const { timer } = await import("./logger");
    const stopFn = vi.fn();
    (timer as ReturnType<typeof vi.fn>).mockReturnValue(stopFn);

    try {
      await withErrorHandling("testLabel", ZiWeiError, () => {
        throw new Error("boom");
      });
    } catch {
      // 预期抛出
    }

    expect(stopFn).toHaveBeenCalled();
  });

  it("void 返回值正常处理", async () => {
    const result = await withErrorHandling("test", ZiWeiError, () => {
      // 无返回值（void）
    });
    expect(result).toBeUndefined();
  });
});

/* ─────────────── withErrorHandlingSync ─────────────── */

describe("withErrorHandlingSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常同步返回值透传", () => {
    const result = withErrorHandlingSync("test", ZiWeiError, () => 42);
    expect(result).toBe(42);
  });

  it("返回对象值透传", () => {
    const obj = { id: 1, name: "test" };
    const result = withErrorHandlingSync("test", ZiWeiError, () => obj);
    expect(result).toEqual(obj);
  });

  it("返回数组值透传", () => {
    const arr = [1, 2, 3];
    const result = withErrorHandlingSync("test", ZiWeiError, () => arr);
    expect(result).toEqual(arr);
  });

  it("指定错误类子类直接抛出，不包装", () => {
    const originalError = new ZiWeiError("原始错误", "inner", {
      errorCode: ApiErrorCode.NOT_FOUND,
    });

    expect(() =>
      withErrorHandlingSync("outer", ZiWeiError, () => {
        throw originalError;
      }),
    ).toThrow(originalError);
  });

  it("非指定错误类的 Error 被 wrapError 包装", () => {
    try {
      withErrorHandlingSync("test", ZiWeiError, () => {
        throw new Error("原生错误");
      });
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("[test]");
      expect((err as Error).message).toContain("原生错误");
    }
  });

  it("非 Error 值（string）被包装为指定错误类", () => {
    try {
      withErrorHandlingSync("test", DaLiuRenError, () => {
        throw "字符串错误";
      });
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(DaLiuRenError);
      expect((err as DaLiuRenError).source).toBe("test");
    }
  });

  it("调用 timer 进行计时", async () => {
    const { timer } = await import("./logger");
    const stopFn = vi.fn();
    (timer as ReturnType<typeof vi.fn>).mockReturnValue(stopFn);

    withErrorHandlingSync("syncLabel", ZiWeiError, () => "ok");

    expect(timer).toHaveBeenCalledWith("syncLabel");
    expect(stopFn).toHaveBeenCalled();
  });

  it("异常时也调用 stop 停止计时", async () => {
    const { timer } = await import("./logger");
    const stopFn = vi.fn();
    (timer as ReturnType<typeof vi.fn>).mockReturnValue(stopFn);

    try {
      withErrorHandlingSync("syncLabel", ZiWeiError, () => {
        throw new Error("boom");
      });
    } catch {
      // 预期抛出
    }

    expect(stopFn).toHaveBeenCalled();
  });

  it("void 返回值正常处理", () => {
    const result = withErrorHandlingSync("test", ZiWeiError, () => {
      // 无返回值（void）
    });
    expect(result).toBeUndefined();
  });

  it("保持同步——返回非 Promise", () => {
    const result = withErrorHandlingSync("test", ZiWeiError, () => 42);
    // 同步函数返回普通值，不是 Promise
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe("number");
  });
});
