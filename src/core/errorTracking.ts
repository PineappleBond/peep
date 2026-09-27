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
  /** 错误上下文（开发环境下提供额外调试信息） */
  context?: ErrorContext;
  /** 修复建议（开发环境下根据错误类型给出） */
  suggestion?: string;
}

/**
 * 错误上下文信息——开发环境下帮助快速定位问题来源。
 * 生产环境不记录这些字段（减少体积与隐私风险）。
 */
export interface ErrorContext {
  /** 错误发生时所在的页面路由 */
  route?: string;
  /** 错误发生时的网络状态 */
  online?: boolean;
  /** 最近的用户操作（如 "点击了排盘按钮"） */
  lastAction?: string;
  /** 关联的组件名（如 "ZiweiPage"、"DaLiuRenEditor"） */
  component?: string;
  /** 关联的人物 ID（便于复现） */
  personId?: number;
  /** 自定义扩展字段 */
  extra?: Record<string, string | number | boolean>;
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

/* ===================== 错误修复建议生成 ===================== */

/**
 * 根据错误消息和类型生成修复建议（仅开发环境使用）。
 * 生产环境不会调用此函数（被 tree-shaken）。
 */
function generateSuggestion(report: {
  message: string;
  type: "js" | "promise" | "resource";
  tagName?: string;
}): string | undefined {
  if (!import.meta.env.DEV) return undefined;

  const msg = report.message.toLowerCase();

  // 资源加载错误
  if (report.type === "resource") {
    if (report.tagName === "script" || report.tagName === "link") {
      return `检查 ${report.tagName} 资源路径是否正确；可能是 CDN 不可达或文件未部署。运行 \`npm run dev\` 重启 dev server 试试。`;
    }
    if (report.tagName === "img") {
      return "图片资源加载失败：检查图片路径、网络状况或 CSP 策略。";
    }
    return `${report.tagName ?? "资源"} 加载失败：检查资源路径与网络状况。`;
  }

  // Promise 未处理拒绝
  if (report.type === "promise") {
    if (msg.includes("fetch") || msg.includes("network")) {
      return "网络请求失败：检查后端服务是否可用、CORS 配置、以及网络连接。";
    }
    if (msg.includes("timeout")) {
      return "异步操作超时：考虑增加超时阈值或检查上游服务响应速度。";
    }
    if (msg.includes("indexeddb") || msg.includes("idb")) {
      return "IndexedDB 操作失败：可能是隐私模式、存储已满或数据库版本冲突。尝试清除站点数据。";
    }
    return "未处理的 Promise 拒绝：在 async 函数中添加 try/catch，或在 .then() 链末尾加 .catch()。";
  }

  // JS 运行时错误
  if (msg.includes("cannot read propert") || msg.includes("undefined") || msg.includes("null")) {
    return "空指针/undefined 访问：检查数据是否已加载，条件渲染是否完整，可选链操作符（?.）是否遗漏。";
  }
  if (msg.includes("is not a function")) {
    return "函数调用错误：检查导入/导出是否正确、函数名拼写、以及依赖是否已初始化。";
  }
  if (msg.includes("minified react") || msg.includes("react #")) {
    return "React 内部错误：通常是 Hook 规则违反（条件调用 Hook）或 React 版本冲突。检查组件是否在条件语句中调用了 Hook。";
  }
  if (msg.includes("hydra") || msg.includes("hydration")) {
    return "SSR Hydration 不匹配：服务端与客户端渲染的 HTML 不一致。检查是否使用了浏览器独有 API（如 Date、Math.random）而未加条件判断。";
  }
  if (msg.includes("chunk") || msg.includes("loading chunk") || msg.includes("dynamic import")) {
    return "代码分块加载失败：可能是部署后旧版 HTML 引用了已删除的 chunk。强制刷新页面（Ctrl+Shift+R）。";
  }
  if (msg.includes("quota") || msg.includes("storage")) {
    return "存储空间不足：浏览器存储达到上限。清理 IndexedDB/localStorage 数据，或增加浏览器配额。";
  }
  if (msg.includes("permission") || msg.includes("denied")) {
    return "权限被拒绝：检查浏览器权限（地理位置、通知等）或 CSP 策略限制。";
  }

  return undefined;
}

/* ===================== 上下文收集 ===================== */

/**
 * 收集错误发生时的上下文信息（仅开发环境）。
 * 帮助快速定位问题发生的环境与场景。
 */
function collectErrorContext(): ErrorContext | undefined {
  if (!import.meta.env.DEV) return undefined;

  const ctx: ErrorContext = {
    route: window.location.pathname,
    online: navigator.onLine,
  };

  // 从 window 读取最近用户操作（如果 setLastAction 被调用过）
  const lastAction = (window as unknown as { __peepLastAction?: string }).__peepLastAction;
  if (lastAction) ctx.lastAction = lastAction;

  return ctx;
}

/**
 * 设置最近用户操作（供错误上下文使用）。
 * 在关键用户操作（点击、导航、提交等）时调用。
 *
 * @example
 * ```ts
 * setLastAction("点击排盘按钮");
 * ```
 */
export function setLastAction(action: string): void {
  if (!import.meta.env.DEV) return;
  (window as unknown as { __peepLastAction?: string }).__peepLastAction = action;
  // 5 秒后自动清除，避免污染后续错误
  setTimeout(() => {
    if ((window as unknown as { __peepLastAction?: string }).__peepLastAction === action) {
      (window as unknown as { __peepLastAction?: string }).__peepLastAction = undefined;
    }
  }, 5000);
}

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
    // 开发环境：附加上下文与修复建议
    context: collectErrorContext(),
    suggestion: generateSuggestion({
      message: report.message,
      type: report.type,
      tagName: report.tagName,
    }),
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
    if (fullReport.suggestion) {
      // eslint-disable-next-line no-console
      console.log("%c[修复建议]%c " + fullReport.suggestion, "color:#4caf50;font-weight:bold", "");
    }
    if (fullReport.context) {
      // eslint-disable-next-line no-console
      console.log("%c[上下文]%c", "color:#ff9800;font-weight:bold", "", fullReport.context);
    }
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
