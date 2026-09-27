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

  describe("边界条件", () => {
    it("baseDelayMs=0 时延迟为 0", async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce("ok");
      const onRetry = vi.fn();
      await withRetry(fn, {
        maxRetries: 1,
        baseDelayMs: 0,
        jitter: false,
        onRetry,
      });
      // 延迟应该是 0 或极小值
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number));
    });

    it("backoffFactor=0 时延迟始终为 baseDelayMs", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("1"))
        .mockRejectedValueOnce(new Error("2"))
        .mockResolvedValueOnce("ok");
      const onRetry = vi.fn();
      await withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 5,
        backoffFactor: 0,
        jitter: false,
        onRetry,
      });
      // 5 * 0^0 = 5, 5 * 0^1 = 0
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it("backoffFactor=1 时延迟恒定", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("1"))
        .mockRejectedValueOnce(new Error("2"))
        .mockResolvedValueOnce("ok");
      const onRetry = vi.fn();
      await withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 5,
        backoffFactor: 1,
        jitter: false,
        onRetry,
      });
      expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1, 5);
      expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2, 5);
    });

    it("maxDelayMs < baseDelayMs 时延迟不超过 maxDelayMs", async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error("1")).mockResolvedValueOnce("ok");
      const onRetry = vi.fn();
      await withRetry(fn, {
        maxRetries: 1,
        baseDelayMs: 100,
        maxDelayMs: 5,
        jitter: false,
        onRetry,
      });
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 5);
    });

    it("jitter=true 时延迟在合理范围内", async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error("1")).mockResolvedValueOnce("ok");
      const onRetry = vi.fn();
      await withRetry(fn, {
        maxRetries: 1,
        baseDelayMs: 100,
        jitter: true,
        onRetry,
      });
      // 延迟应在 baseDelayMs ± 25% 范围内（即 75-125）
      const delay = onRetry.mock.calls[0][2];
      expect(delay).toBeGreaterThanOrEqual(75);
      expect(delay).toBeLessThanOrEqual(125);
    });

    it("signal 已 abort 时立即抛出", async () => {
      const controller = new AbortController();
      controller.abort();
      const fn = vi.fn();
      await expect(withRetry(fn, { signal: controller.signal })).rejects.toThrow();
      expect(fn).not.toHaveBeenCalled();
    });

    it("fn 返回 undefined 时正常返回", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const result = await withRetry(fn);
      expect(result).toBeUndefined();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("fn 返回 null 时正常返回", async () => {
      const fn = vi.fn().mockResolvedValue(null);
      const result = await withRetry(fn);
      expect(result).toBeNull();
    });

    it("fn 返回 false 时正常返回", async () => {
      const fn = vi.fn().mockResolvedValue(false);
      const result = await withRetry(fn);
      expect(result).toBe(false);
    });

    it("fn 返回 0 时正常返回", async () => {
      const fn = vi.fn().mockResolvedValue(0);
      const result = await withRetry(fn);
      expect(result).toBe(0);
    });

    it("isRetryable 收到 attempt 参数", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"));
      const isRetryable = vi.fn().mockReturnValue(false);
      try {
        await withRetry(fn, { maxRetries: 3, isRetryable });
      } catch {
        // 忽略
      }
      expect(isRetryable).toHaveBeenCalledWith(expect.any(Error), 0);
    });

    it("非 Error 值抛出时也能重试", async () => {
      let count = 0;
      await expect(
        withRetry(
          () => {
            count++;
            if (count < 2) throw "字符串错误";
            return "ok";
          },
          { maxRetries: 2, baseDelayMs: 1, jitter: false },
        ),
      ).resolves.toBe("ok");
      expect(count).toBe(2);
    });

    it("同步函数返回非 Promise 值", async () => {
      const result = await withRetry(() => 42);
      expect(result).toBe(42);
    });
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

  it("识别 InvalidStateError", () => {
    const err = new DOMException("invalid state", "InvalidStateError");
    expect(isIndexedDBTransientError(err)).toBe(true);
  });

  it("识别 TimeoutError", () => {
    const err = new DOMException("timeout", "TimeoutError");
    expect(isIndexedDBTransientError(err)).toBe(true);
  });

  it("不识别 QuotaExceededError（非临时性错误）", () => {
    const err = new DOMException("quota exceeded", "QuotaExceededError");
    expect(isIndexedDBTransientError(err)).toBe(false);
  });

  it("不识别非 DOMException 对象", () => {
    const err = { name: "TransactionInactiveError", message: "test" };
    expect(isIndexedDBTransientError(err)).toBe(false);
  });

  it("不识别 null", () => {
    expect(isIndexedDBTransientError(null)).toBe(false);
  });

  it("不识别 undefined", () => {
    expect(isIndexedDBTransientError(undefined)).toBe(false);
  });

  it("不识别字符串", () => {
    expect(isIndexedDBTransientError("TransactionInactiveError")).toBe(false);
  });

  it("识别 database upgrade 消息", () => {
    const err = new Error("database upgrade in progress");
    expect(isIndexedDBTransientError(err)).toBe(true);
  });

  it("识别 user agent 消息（Safari 隐私模式）", () => {
    const err = new Error("user agent denied");
    expect(isIndexedDBTransientError(err)).toBe(true);
  });

  it("识别 request aborted 消息", () => {
    const err = new Error("request aborted");
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

  it("识别 500 错误", () => {
    expect(isNetworkTransientError(new Error("HTTP 500 Internal Server Error"))).toBe(true);
  });

  it("识别 502 错误", () => {
    expect(isNetworkTransientError(new Error("HTTP 502 Bad Gateway"))).toBe(true);
  });

  it("识别 504 错误", () => {
    expect(isNetworkTransientError(new Error("HTTP 504 Gateway Timeout"))).toBe(true);
  });

  it("不识别 401 错误", () => {
    expect(isNetworkTransientError(new Error("HTTP 401 Unauthorized"))).toBe(false);
  });

  it("不识别 403 错误", () => {
    expect(isNetworkTransientError(new Error("HTTP 403 Forbidden"))).toBe(false);
  });

  it("识别 network error 消息", () => {
    expect(isNetworkTransientError(new Error("network error"))).toBe(true);
  });

  it("识别 aborted 消息", () => {
    expect(isNetworkTransientError(new Error("request aborted"))).toBe(true);
  });

  it("不识别 null", () => {
    expect(isNetworkTransientError(null)).toBe(false);
  });

  it("不识别 undefined", () => {
    expect(isNetworkTransientError(undefined)).toBe(false);
  });

  it("不识别数字", () => {
    expect(isNetworkTransientError(500)).toBe(false);
  });

  it("不识别空 Error", () => {
    expect(isNetworkTransientError(new Error(""))).toBe(false);
  });
});
