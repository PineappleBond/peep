/**
 * retry 工具单元测试
 * 覆盖：基础重试、指数退避、取消、错误分类、不可重试错误
 */
import { describe, it, expect, vi } from "vitest";
import { withRetry, isIndexedDBTransientError, isNetworkTransientError } from "./retry";

describe("withRetry", () => {
  it("成功时直接返回结果，不重试", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("首次失败后重试一次成功", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("临时失败")).mockResolvedValueOnce("ok");
    const onRetry = vi.fn();

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 1, // 极短延迟便于测试
        jitter: false,
        onRetry,
      }),
    ).resolves.toBe("ok");

    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number));
  });

  it("所有重试均失败时抛出最后一次错误", async () => {
    const err = new Error("持续失败");
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 1,
        jitter: false,
      }),
    ).rejects.toThrow("持续失败");

    expect(fn).toHaveBeenCalledTimes(3); // 1 + 2 重试
  });

  it("isRetryable 返回 false 时立即抛出不重试", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("永久错误"));
    const isRetryable = vi.fn().mockReturnValue(false);
    const onRetry = vi.fn();

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 1,
        isRetryable,
        onRetry,
      }),
    ).rejects.toThrow("永久错误");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("支持通过 AbortSignal 取消（在等待阶段）", async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error("失败"));

    const promise = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 10000, // 长延迟，便于在等待期间取消
      jitter: false,
      signal: controller.signal,
    });

    // 立即取消（第一次尝试失败后进入长延迟等待）
    // 使用微任务让第一次 fn 调用先完成（触发 rejected）
    queueMicrotask(() => controller.abort());

    await expect(promise).rejects.toThrow();
    // fn 被调用一次；abort 触发在第一次失败后的等待期间
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("指数退避：onRetry 收到的延迟按 backoffFactor 递增", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockResolvedValueOnce("ok");
    const onRetry = vi.fn();

    await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 1,
      backoffFactor: 10,
      jitter: false,
      onRetry,
    });

    // 第一次重试延迟 ≈ 1ms，第二次 ≈ 10ms
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1, 1);
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2, 10);
  });

  it("延迟不超过 maxDelayMs 上限", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("1")).mockResolvedValueOnce("ok");
    const onRetry = vi.fn();

    await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 5,
      backoffFactor: 10,
      jitter: false,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 5);
  });

  it("同步函数也能重试", async () => {
    let count = 0;
    await expect(
      withRetry(
        () => {
          count++;
          if (count < 2) throw new Error("sync fail");
          return "sync ok";
        },
        { maxRetries: 2, baseDelayMs: 1, jitter: false },
      ),
    ).resolves.toBe("sync ok");
    expect(count).toBe(2);
  });

  it("maxRetries=0 时不重试", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("失败"));
    await expect(withRetry(fn, { maxRetries: 0 })).rejects.toThrow("失败");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("isIndexedDBTransientError", () => {
  it("识别 TransactionInactiveError", () => {
    const err = new DOMException("tx inactive", "TransactionInactiveError");
    expect(isIndexedDBTransientError(err)).toBe(true);
  });

  it("识别 AbortError", () => {
    const err = new DOMException("aborted", "AbortError");
    expect(isIndexedDBTransientError(err)).toBe(true);
  });

  it("不识别普通 Error", () => {
    const err = new Error("普通错误");
    expect(isIndexedDBTransientError(err)).toBe(false);
  });

  it("识别 message 关键字", () => {
    const err = new Error("transaction inactive");
    expect(isIndexedDBTransientError(err)).toBe(true);
  });
});

describe("isNetworkTransientError", () => {
  it("识别 TypeError（fetch 网络错误）", () => {
    expect(isNetworkTransientError(new TypeError("network"))).toBe(true);
  });

  it("识别超时错误", () => {
    expect(isNetworkTransientError(new Error("request timeout"))).toBe(true);
  });

  it("识别 5xx 错误", () => {
    expect(isNetworkTransientError(new Error("HTTP 503"))).toBe(true);
  });

  it("不识别 4xx 错误", () => {
    expect(isNetworkTransientError(new Error("404 not found"))).toBe(false);
  });

  it("识别 failed to fetch", () => {
    expect(isNetworkTransientError(new Error("Failed to fetch"))).toBe(true);
  });
});
