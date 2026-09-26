/**
 * 重试工具——为异步操作提供可配置的自动重试机制
 *
 * 适用场景：
 * - IndexedDB 操作失败（锁冲突、事务中断）
 * - 网络请求失败（临时性连接问题）
 * - RTC Agent 通信失败（WebSocket 瞬时断连）
 * - 资源加载失败（CDN 抖动）
 *
 * 设计原则：
 * - 仅对"可重试"错误进行重试（由 isRetryable 判定函数决定）
 * - 默认采用指数退避 + 抖动，避免重试风暴
 * - 支持取消（AbortSignal）
 * - 每次重试通过 onRetry 回调上报进度（可用于日志/监控）
 * - 不吞错误：所有重试均失败后抛出最后一次错误
 */

/** 重试配置 */
export interface RetryOptions {
  /** 最大重试次数（不含首次尝试），默认 2 */
  maxRetries?: number;
  /** 基础延迟（毫秒），默认 100 */
  baseDelayMs?: number;
  /** 最大延迟上限（毫秒），默认 2000 */
  maxDelayMs?: number;
  /** 退避因子，默认 2（指数退避） */
  backoffFactor?: number;
  /** 是否添加抖动（防止多个重试同步），默认 true */
  jitter?: boolean;
  /**
   * 判断错误是否可重试：返回 true 才重试，否则立即抛出。
   * 默认：所有错误都可重试。
   * 建议：区分临时性错误（网络/锁）vs 永久性错误（数据损坏）。
   */
  isRetryable?: (error: unknown, attempt: number) => boolean;
  /** 重试前回调（可用于日志/监控/显示进度） */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** 取消信号：触发后不再重试 */
  signal?: AbortSignal;
}

/**
 * 带重试的异步操作执行器
 *
 * @param fn 要执行的异步函数，接收当前尝试次数（0 起始）
 * @param options 重试配置
 * @returns fn 的返回值
 * @throws 所有重试均失败时抛出最后一次错误
 *
 * @example
 * ```typescript
 * // IndexedDB 操作重试
 * const data = await withRetry(() => db.get('key'), {
 *   maxRetries: 3,
 *   isRetryable: (err) => err instanceof DOMException && err.name === 'TransactionInactiveError',
 *   onRetry: (err, attempt) => console.warn(`IndexedDB 第 ${attempt} 次重试`, err),
 * });
 *
 * // 网络请求重试
 * const response = await withRetry(() => fetch('/api/data'), {
 *   maxRetries: 2,
 *   isRetryable: (err) => err instanceof TypeError, // 网络错误
 * });
 * ```
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T> | T,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 2,
    baseDelayMs = 100,
    maxDelayMs = 2000,
    backoffFactor = 2,
    jitter = true,
    isRetryable = () => true,
    onRetry,
    signal,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 检查是否被取消
    if (signal?.aborted) {
      throw new DOMException("重试已被取消", "AbortError");
    }

    try {
      const result = await fn(attempt);
      return result;
    } catch (err) {
      lastError = err;

      // 已达最大重试次数，或错误不可重试：直接抛出
      if (attempt >= maxRetries || !isRetryable(err, attempt)) {
        throw err;
      }

      // 计算本次退避延迟
      const exponentialDelay = baseDelayMs * Math.pow(backoffFactor, attempt);
      const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
      // 抖动：±25% 随机偏移，防止多个重试操作同步重试造成新的冲突
      const jitterAmount = jitter ? cappedDelay * 0.25 * (Math.random() * 2 - 1) : 0;
      const delayMs = Math.max(0, Math.round(cappedDelay + jitterAmount));

      // 上报重试进度
      onRetry?.(err, attempt + 1, delayMs);

      // 等待退避延迟（期间持续监听取消信号）
      await sleepWithAbort(delayMs, signal);
    }
  }

  // 防御性代码：理论上不会走到这里（循环内已抛出）
  throw lastError;
}

/**
 * 带取消支持的 sleep
 * 使用 Promise + setTimeout，期间如 signal 被触发则立即 reject
 */
function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (ms <= 0) {
      resolve();
      return;
    }

    // 已经取消
    if (signal?.aborted) {
      reject(new DOMException("重试已被取消", "AbortError"));
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(new DOMException("重试已被取消", "AbortError"));
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * IndexedDB 操作专用重试包装
 *
 * 预设了 IndexedDB 临时性错误的识别规则，默认 3 次重试、指数退避。
 * 适用于 Dexie 事务、直接 IDB 操作等场景。
 *
 * @example
 * ```typescript
 * // Dexie 事务重试
 * await withDbRetry(() => db.transaction('rw', db.persons, async () => {
 *   await db.persons.add(person);
 * }));
 * ```
 */
export function withDbRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: Omit<RetryOptions, "isRetryable"> = {},
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 3,
    baseDelayMs: 50,
    maxDelayMs: 1000,
    isRetryable: isIndexedDBTransientError,
    ...options,
  });
}

/**
 * 网络请求专用重试包装
 *
 * 预设了网络临时性错误的识别规则（TypeError / 5xx / 超时），默认 2 次重试。
 * 适用于 fetch / XHR 等场景。
 *
 * @example
 * ```typescript
 * const response = await withNetworkRetry(() => fetch('/api/data'));
 * ```
 */
export function withNetworkRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: Omit<RetryOptions, "isRetryable"> = {},
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 2,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    isRetryable: isNetworkTransientError,
    ...options,
  });
}

/**
 * 判断错误是否属于 IndexedDB 临时性错误（可重试）
 *
 * 包括：
 * - TransactionInactiveError（事务已失效，常见于并发操作）
 * - AbortError（事务被中止，常见于页面卸载/版本升级）
 * - InvalidStateError（数据库正在升级）
 * - QuotaExceededError（存储已满——重试无意义但通常会自动恢复）
 */
export function isIndexedDBTransientError(err: unknown): boolean {
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    const transientNames = [
      "TransactionInactiveError",
      "AbortError",
      "InvalidStateError",
      "TimeoutError",
    ];
    if (transientNames.includes(err.name)) return true;
  }
  // 部分浏览器抛普通 Error，用 message 兜底
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("transaction inactive") ||
      msg.includes("database upgrade") ||
      msg.includes("request aborted") ||
      msg.includes("user agent") // Safari 的隐私模式错误
    );
  }
  return false;
}

/**
 * 判断错误是否属于网络临时性错误（可重试）
 *
 * 包括：
 * - TypeError（fetch 网络错误）
 * - 5xx 响应（服务端临时问题）
 * - 超时错误
 *
 * 不包括：
 * - 4xx 响应（客户端错误，重试无意义）
 */
export function isNetworkTransientError(err: unknown): boolean {
  // fetch TypeError（网络不通/DNS 失败）
  if (err instanceof TypeError) return true;

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    // 超时
    if (msg.includes("timeout") || msg.includes("aborted")) return true;
    // 服务端错误（5xx）
    if (/5\d{2}/.test(msg)) return true;
    // fetch 通用失败
    if (msg.includes("failed to fetch") || msg.includes("network error")) return true;
  }
  return false;
}
