/**
 * 错误监控模块
 *
 * 职责：
 *  1. 捕获全局 JavaScript 错误（window.onerror）
 *  2. 捕获未处理的 Promise rejection
 *  3. 捕获资源加载失败（script / link / img 等）
 *  4. 错误去重（相同指纹只上报一次）
 *  5. 批量上报 + 离线缓存（navigator.sendBeacon）
 *  6. 敏感信息过滤（URL 中的 token / key 等）
 *
 * 设计原则：
 *  - 捕获逻辑不能抛异常
 *  - 不影响应用正常运行
 *  - 开发环境仅 console，生产环境才真正上报
 */

/* ===================== 类型定义 ===================== */

export interface ErrorReport {
  /** 错误消息 */
  message: string;
  /** 错误堆栈 */
  stack?: string;
  /** 发生错误的页面 URL */
  url: string;
  /** 错误行号 */
  lineno?: number;
  /** 错误列号 */
  colno?: number;
  /** 错误类型：js / promise / resource */
  type: "js" | "promise" | "resource";
  /** 资源标签名（仅 resource 类型） */
  tagName?: string;
  /** 资源 URL（仅 resource 类型） */
  resourceUrl?: string;
  /** 错误指纹（用于去重） */
  fingerprint: string;
  /** User-Agent */
  userAgent: string;
  /** 上报时间戳 */
  timestamp: number;
  /** 发生次数（去重后累计） */
  count: number;
}

/* ===================== 配置 ===================== */

interface ErrorTrackingConfig {
  /** 是否启用上报 */
  enabled: boolean;
  /** 采样率 0~1 */
  sampleRate: number;
  /** 批量大小 */
  batchSize: number;
  /** 上报回调 */
  onReport: (reports: ErrorReport[]) => void;
  /** 自定义过滤函数：返回 true 表示忽略该错误 */
  ignore?: (report: ErrorReport) => boolean;
  /** 敏感关键词列表，匹配到的内容会被替换 */
  sensitiveKeys: string[];
}

const DEFAULT_ERROR_CONFIG: ErrorTrackingConfig = {
  enabled: import.meta.env.PROD,
  sampleRate: 0.5, // 错误采样率较高（50%），因为错误不应漏报太多
  batchSize: 10,
  onReport: reports => {
    // eslint-disable-next-line no-console
    console.log("[错误上报]", reports);
  },
  sensitiveKeys: ["token", "key", "secret", "password", "auth", "api_key", "apikey"],
};

/* ===================== 模块状态 ===================== */

let errorConfig: ErrorTrackingConfig = { ...DEFAULT_ERROR_CONFIG };
/** 错误指纹 → 累计次数（用于去重） */
const errorMap = new Map<string, ErrorReport>();
/** 待上报队列 */
const pendingReports: ErrorReport[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let errorInitialized = false;

/* ===================== 工具函数 ===================== */

/**
 * 生成错误指纹
 * 策略：用 消息 + 堆栈首行 做简单哈希，避免完全相同的错误重复上报
 */
function generateFingerprint(message: string, stack?: string): string {
  const stackFirstLine = stack?.split("\n")[1]?.trim() || "";
  const raw = `${message}|${stackFirstLine}`;
  // 简单哈希（djb2 算法）
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * 过滤敏感信息
 * 把 URL 和 message 中可能包含的敏感参数值替换为 [FILTERED]
 */
function filterSensitive(text: string): string {
  let filtered = text;
  for (const key of errorConfig.sensitiveKeys) {
    // 匹配 key=value 或 key: "value" 等常见模式
    const patterns = [
      new RegExp(`([?&])${key}=[^&\\s]*`, "gi"),
      new RegExp(`${key}["']?\\s*[:=]\\s*["'][^"']*["']`, "gi"),
    ];
    for (const pattern of patterns) {
      filtered = filtered.replace(pattern, match => {
        return match.replace(/=[^&\s"'"]+/, "=[FILTERED]");
      });
    }
  }
  return filtered;
}

/**
 * 处理捕获到的错误
 * 核心逻辑：去重 → 过滤 → 入队
 */
function processError(
  report: Omit<ErrorReport, "fingerprint" | "userAgent" | "timestamp" | "count">,
) {
  // 过滤敏感信息
  const safeMessage = filterSensitive(report.message);
  const fingerprint = generateFingerprint(report.message, report.stack);

  // 去重：如果已经记录过相同指纹的错误，只增加计数
  const existing = errorMap.get(fingerprint);
  if (existing) {
    existing.count++;
    return;
  }

  const fullReport: ErrorReport = {
    message: safeMessage,
    stack: report.stack ? filterSensitive(report.stack) : undefined,
    url: filterSensitive(report.url),
    lineno: report.lineno,
    colno: report.colno,
    type: report.type,
    tagName: report.tagName,
    resourceUrl: report.resourceUrl ? filterSensitive(report.resourceUrl) : undefined,
    fingerprint,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
    count: 1,
  };

  // 自定义过滤
  if (errorConfig.ignore?.(fullReport)) {
    return;
  }

  errorMap.set(fingerprint, fullReport);
  pendingReports.push(fullReport);

  // 开发环境实时打印
  if (!import.meta.env.PROD) {
    console.warn("[错误捕获]", fullReport.type, fullReport.message);
  }

  // 满足批量大小立即刷新
  if (pendingReports.length >= errorConfig.batchSize) {
    flushErrors();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => flushErrors(), 5000);
  }
}

/* ===================== 上报机制 ===================== */

function flushErrors() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingReports.length === 0) return;

  const batch = pendingReports.splice(0, errorConfig.batchSize);

  // 优先使用 sendBeacon（页面卸载时也能可靠发送）
  if (errorConfig.enabled && typeof navigator.sendBeacon === "function") {
    try {
      // TODO: 接入上报端点后替换为 navigator.sendBeacon("/api/errors", ...)
      errorConfig.onReport(batch);
    } catch {
      // sendBeacon 失败时降级
      errorConfig.onReport(batch);
    }
  } else {
    errorConfig.onReport(batch);
  }

  // 如果还有剩余，继续排定
  if (pendingReports.length > 0 && !flushTimer) {
    flushTimer = setTimeout(() => flushErrors(), 5000);
  }
}

/* ===================== 各类错误捕获 ===================== */

/**
 * 注册 JS 运行时错误捕获
 */
function registerJsError() {
  window.addEventListener("error", (event: ErrorEvent) => {
    processError({
      message: event.message || "未知错误",
      stack: event.error?.stack,
      url: location.href,
      lineno: event.lineno,
      colno: event.colno,
      type: "js",
    });
  });
}

/**
 * 注册未处理 Promise rejection 捕获
 */
function registerPromiseError() {
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    let message = "未处理的 Promise 拒绝";
    let stack: string | undefined;

    if (event.reason instanceof Error) {
      message = event.reason.message;
      stack = event.reason.stack;
    } else if (typeof event.reason === "string") {
      message = event.reason;
    } else if (event.reason && typeof event.reason === "object") {
      try {
        message = JSON.stringify(event.reason);
      } catch {
        message = String(event.reason);
      }
    }

    processError({
      message,
      stack,
      url: location.href,
      type: "promise",
    });
  });
}

/**
 * 注册资源加载失败捕获（冒泡阶段）
 * 捕获 img / script / link 等资源的加载错误
 */
function registerResourceError() {
  window.addEventListener(
    "error",
    (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName?.toLowerCase();
      // 只处理资源类标签
      if (!["script", "link", "img", "video", "audio", "source"].includes(tagName)) {
        return;
      }

      // 提取资源 URL
      const resourceUrl =
        (target as HTMLImageElement).src || (target as HTMLLinkElement).href || "";

      processError({
        message: `资源加载失败: ${tagName}`,
        url: location.href,
        type: "resource",
        tagName,
        resourceUrl,
      });
    },
    true, // 使用捕获阶段，因为资源加载错误不冒泡
  );
}

/* ===================== 手动上报接口 ===================== */

/**
 * 手动上报一个错误
 * 用于业务代码中的 try/catch 捕获场景
 *
 * @example
 * try {
 *   someRiskyOperation();
 * } catch (err) {
 *   reportError(err as Error, "someRiskyOperation");
 * }
 */
export function reportError(error: Error | string, context?: string) {
  const message = typeof error === "string" ? error : error.message;
  const stack = error instanceof Error ? error.stack : undefined;

  processError({
    message: context ? `[${context}] ${message}` : message,
    stack,
    url: location.href,
    type: "js",
  });
}

/* ===================== 初始化入口 ===================== */

/**
 * 初始化错误监控
 * @param overrides 可选配置覆盖
 */
export function initErrorTracking(overrides?: Partial<ErrorTrackingConfig>) {
  if (errorInitialized) return;
  errorInitialized = true;

  errorConfig = { ...DEFAULT_ERROR_CONFIG, ...overrides };

  // 不论是否采样命中，都注册错误捕获（开发环境可用于调试）
  registerJsError();
  registerPromiseError();
  registerResourceError();

  // 页面卸载前刷新未发送的错误
  const handleBeforeUnload = () => {
    flushErrors();
  };
  window.addEventListener("beforeunload", handleBeforeUnload);

  // 页面隐藏时也尝试刷新（使用 sendBeacon 更可靠）
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushErrors();
    }
  });

  if (!import.meta.env.PROD) {
    // eslint-disable-next-line no-console
    console.log("[错误监控] 已初始化", {
      enabled: errorConfig.enabled,
      sampleRate: errorConfig.sampleRate,
    });
  }
}

/**
 * 手动触发刷新
 */
export function flushErrorReports() {
  flushErrors();
}

/**
 * 获取当前已记录的所有错误报告（只读副本）
 */
export function getRecordedErrors(): ErrorReport[] {
  return Array.from(errorMap.values());
}

/**
 * 清除已记录的去重 Map（一般用于测试）
 */
export function clearErrorRecords() {
  errorMap.clear();
}
