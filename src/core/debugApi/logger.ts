/**
 * 调试 API 日志和计时工具
 *
 * 结构化日志：分级、带分类标签、带时间戳。
 * 相比直接 console.*，调试时更容易按类别过滤/定位问题。
 */

import { recordDomainMetric } from "../performance";

/** 日志级别 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** 日志级别阈值（数值越大越严格） */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** 当前日志级别——开发环境默认 info，可通过 window.peep.setLogLevel 调整 */
let currentLogLevel: LogLevel = "info";

/** ANSI-free 颜色标记：让分类标签在控制台更醒目 */
const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: "color:#888",
  info: "color:#2196f3",
  warn: "color:#ff9800",
  error: "color:#f44336",
};

/** 日志级别到 console 方法的映射 */
const LOG_METHODS: Record<LogLevel, keyof Console> = {
  debug: "debug",
  info: "log",
  warn: "warn",
  error: "error",
};

/**
 * 核心日志函数——仅在 import.meta.env.DEV 下输出。
 * 生产构建会被 tree-shaken 掉，零运行时开销。
 */
export function log(level: LogLevel, category: string, message: string, data?: unknown): void {
  if (!import.meta.env.DEV) return;
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLogLevel]) return;

  const ts = new Date().toLocaleTimeString();
  const prefix = `[peep ${ts}][${category}]`;
  const method = LOG_METHODS[level];

  // 带 CSS 样式的 console 输出（浏览器支持 %c 占位符）
  const args =
    data !== undefined
      ? [`%c${prefix}%c ${message}`, LEVEL_STYLES[level], "", data]
      : [`%c${prefix}%c ${message}`, LEVEL_STYLES[level], ""];
  // eslint-disable-next-line no-console
  (console[method] as (...a: unknown[]) => void)(...args);
}

/** 设置当前日志级别 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
  log("info", "logger", `日志级别调整为 ${level}`);
}

/** 获取当前日志级别 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/** 重置日志级别为默认值 */
export function resetLogLevel(): void {
  currentLogLevel = "info";
}

/**
 * 静态空函数引用：生产环境下 timer 直接返回此引用，
 * 避免每次 timer() 调用都创建新的空闭包，减少内存分配与 GC 压力。
 */
const NOOP = () => {};

/**
 * 性能计时工具——返回一个 stop 函数，调用时打印耗时并记录领域指标。
 * 用法：const stop = timer("ZiWei"); ... stop(); // "ZiWei 耗时 23ms"
 *
 * 生产环境直接返回共享的 NOOP 引用（无闭包分配）；
 * 开发环境才创建 start 变量与闭包用于计时，并同时记录到领域指标供仪表板展示。
 */
export function timer(category: string): () => void {
  if (!import.meta.env.DEV) return NOOP;
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    log("debug", category, `耗时 ${duration.toFixed(1)}ms`);
    // 记录到领域指标（供 DevDashboard 性能监控面板展示）
    recordDomainMetric(category, duration);
  };
}
