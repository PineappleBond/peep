/**
 * 性能监控模块
 *
 * 职责：
 *  1. 通过 PerformanceObserver 采集 Web Vitals（FCP / LCP / FID / CLS / TTFB）
 *  2. 记录长任务（Long Tasks > 50ms）
 *  3. 采集 Navigation Timing 与 Resource Timing 关键数据
 *  4. 支持批量上报、采样率控制、开发/生产环境切换
 *
 * 设计原则：
 *  - 监控代码本身不阻塞主线程，所有 Observer 均为异步回调
 *  - 不上报任何用户隐私数据
 *  - 开发环境仅 console.log，生产环境预留上报接口
 */

/* ===================== 类型定义 ===================== */

/** Web Vitals 指标 */
export interface WebVitals {
  fcp?: number; // First Contentful Paint（ms）
  lcp?: number; // Largest Contentful Paint（ms）
  fid?: number; // First Input Delay（ms）
  cls?: number; // Cumulative Layout Shift（累计值，无单位）
  ttfb?: number; // Time to First Byte（ms）
}

/** 长任务记录 */
export interface LongTaskEntry {
  startTime: number; // 任务开始时间（ms）
  duration: number; // 任务持续时间（ms）
  name: string; // 任务名称（通常为 "self" 或归因信息）
}

/** Navigation Timing 摘要 */
export interface NavigationTimingSummary {
  /** DNS 查询耗时 */
  dns: number;
  /** TCP 连接耗时 */
  tcp: number;
  /** TLS 握手耗时（HTTPS 下才有） */
  tls: number;
  /** 首字节时间（TTFB） */
  ttfb: number;
  /** 响应下载耗时 */
  response: number;
  /** DOM 解析耗时（从开始到 DOMContentLoaded） */
  domInteractive: number;
  /** 页面完全加载耗时 */
  domComplete: number;
  /** 总耗时（从 navigationStart 到 loadEventEnd） */
  total: number;
}

/** 资源加载记录 */
export interface ResourceTimingEntry {
  name: string; // 资源 URL
  initiatorType: string; // 发起类型（script / link / img …）
  duration: number; // 总耗时（ms）
  transferSize: number; // 传输大小（bytes）
  /** 是否命中缓存 */
  fromCache: boolean;
}

/** 完整的性能快照 */
export interface PerformanceSnapshot {
  url: string;
  userAgent: string;
  timestamp: number;
  vitals: WebVitals;
  longTasks: LongTaskEntry[];
  navigation?: NavigationTimingSummary;
  slowResources: ResourceTimingEntry[]; // 只记录耗时 > 300ms 的资源
}

/* ===================== 配置 ===================== */

interface PerformanceConfig {
  /** 是否启用（生产环境才真正上报） */
  enabled: boolean;
  /** 采样率 0~1，1 表示 100% 上报 */
  sampleRate: number;
  /** 批量上报的最大条数 */
  batchSize: number;
  /** 批量上报的延迟（ms） */
  flushInterval: number;
  /** 上报回调（默认 console.log，生产可替换为 fetch） */
  onReport: (snapshot: PerformanceSnapshot) => void;
}

const DEFAULT_CONFIG: PerformanceConfig = {
  enabled: import.meta.env.PROD,
  sampleRate: 0.1, // 默认 10% 采样
  batchSize: 5,
  flushInterval: 10_000, // 10 秒
  onReport: snapshot => {
    // eslint-disable-next-line no-console
    console.log("[性能上报]", snapshot);
  },
};

/* ===================== 模块状态 ===================== */

let config: PerformanceConfig = { ...DEFAULT_CONFIG };
const vitals: WebVitals = {};
const longTasks: LongTaskEntry[] = [];
const pendingSnapshots: PerformanceSnapshot[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

/* ===================== 工具函数 ===================== */

/** 判断是否命中采样 */
function shouldSample(): boolean {
  return Math.random() < config.sampleRate;
}

/** 判断 PerformanceObserver 是否可用 */
function isObserverSupported(type: string): boolean {
  return (
    typeof PerformanceObserver !== "undefined" &&
    PerformanceObserver.supportedEntryTypes?.includes(type)
  );
}

/* ===================== Web Vitals 采集 ===================== */

/** FCP — 首次内容绘制 */
function observeFCP() {
  if (!isObserverSupported("paint")) return;
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (entry.name === "first-contentful-paint") {
        vitals.fcp = entry.startTime;
      }
    }
  });
  observer.observe({ type: "paint", buffered: true });
}

/** LCP — 最大内容绘制 */
function observeLCP() {
  if (!isObserverSupported("largest-contentful-paint")) return;
  const observer = new PerformanceObserver(list => {
    const entries = list.getEntries();
    if (entries.length > 0) {
      // LCP 可能在页面生命周期中多次变化，取最后一个
      vitals.lcp = entries[entries.length - 1].startTime;
    }
  });
  observer.observe({ type: "largest-contentful-paint", buffered: true });
}

/** FID — 首次输入延迟 */
function observeFID() {
  if (!isObserverSupported("first-input")) return;
  const observer = new PerformanceObserver(list => {
    const entries = list.getEntries();
    if (entries.length > 0) {
      const firstInput = entries[0] as PerformanceEventTiming;
      // FID = 用户首次交互到浏览器实际响应的时间差
      vitals.fid = firstInput.processingStart - firstInput.startTime;
    }
  });
  observer.observe({ type: "first-input", buffered: true });
}

/** CLS — 累积布局偏移 */
function observeCLS() {
  if (!isObserverSupported("layout-shift")) return;
  let clsValue = 0;
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      // 只统计"无预期"的布局偏移（entry 没有 wasFulfilled 属性时为 true）
      if (!(entry as unknown as { hadRecentInput?: boolean }).hadRecentInput) {
        clsValue += (entry as unknown as { value: number }).value;
      }
    }
    vitals.cls = clsValue;
  });
  observer.observe({ type: "layout-shift", buffered: true });
}

/** TTFB — 首字节时间（从 Navigation Timing 获取） */
function collectTTFB() {
  if (typeof performance === "undefined") return;
  const nav = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  if (nav.length > 0) {
    vitals.ttfb = nav[0].responseStart;
  }
}

/* ===================== 长任务监控 ===================== */

function observeLongTasks() {
  if (!isObserverSupported("longtask")) return;
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      longTasks.push({
        startTime: entry.startTime,
        duration: entry.duration,
        name: entry.name,
      });
    }
  });
  observer.observe({ type: "longtask", buffered: true });
}

/* ===================== Navigation & Resource Timing ===================== */

/** 采集 Navigation Timing 摘要 */
function getNavigationTiming(): NavigationTimingSummary | undefined {
  if (typeof performance === "undefined") return undefined;
  const nav = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  if (nav.length === 0) return undefined;
  const t = nav[0];
  return {
    dns: t.domainLookupEnd - t.domainLookupStart,
    tcp: t.connectEnd - t.connectStart,
    tls: t.secureConnectionStart > 0 ? t.connectEnd - t.secureConnectionStart : 0,
    ttfb: t.responseStart - t.requestStart,
    response: t.responseEnd - t.responseStart,
    domInteractive: t.domInteractive - t.startTime,
    domComplete: t.domComplete - t.startTime,
    total: t.loadEventEnd - t.startTime,
  };
}

/** 采集慢资源（耗时 > 300ms） */
function getSlowResources(threshold = 300): ResourceTimingEntry[] {
  if (typeof performance === "undefined") return [];
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  return resources
    .filter(r => r.duration > threshold)
    .map(r => ({
      name: r.name,
      initiatorType: r.initiatorType,
      duration: r.duration,
      transferSize: r.transferSize,
      fromCache: r.transferSize === 0,
    }));
}

/* ===================== 上报机制 ===================== */

/** 构建当前性能快照 */
function buildSnapshot(): PerformanceSnapshot {
  return {
    url: location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
    vitals: { ...vitals },
    longTasks: [...longTasks],
    navigation: getNavigationTiming(),
    slowResources: getSlowResources(),
  };
}

/** 将快照放入待上报队列，满足条件时批量刷新 */
function enqueueSnapshot() {
  const snapshot = buildSnapshot();
  pendingSnapshots.push(snapshot);

  if (pendingSnapshots.length >= config.batchSize) {
    flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flush();
    }, config.flushInterval);
  }
}

/** 立即刷新待上报队列 */
function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingSnapshots.length === 0) return;

  const batch = pendingSnapshots.splice(0, config.batchSize);
  for (const snapshot of batch) {
    try {
      config.onReport(snapshot);
    } catch {
      // 上报失败不应影响应用运行
    }
  }

  // 如果还有剩余，继续排定下次刷新
  if (pendingSnapshots.length > 0 && !flushTimer) {
    flushTimer = setTimeout(() => flush(), config.flushInterval);
  }
}

/* ===================== 自定义打点（User Timing） ===================== */

/**
 * 开始一个自定义计时标记
 * @example markStart("排盘计算")
 */
export function markStart(name: string) {
  if (typeof performance !== "undefined" && performance.mark) {
    performance.mark(`${name}:start`);
  }
}

/**
 * 结束一个自定义计时标记并记录 measure
 * @example markEnd("排盘计算")
 */
export function markEnd(name: string) {
  if (typeof performance === "undefined" || !performance.mark) return;
  performance.mark(`${name}:end`);
  try {
    performance.measure(name, `${name}:start`, `${name}:end`);
  } catch {
    // start 标记可能不存在，忽略
  }
}

/**
 * 读取所有自定义 measure 的结果
 */
export function getCustomMeasures(): { name: string; duration: number }[] {
  if (typeof performance === "undefined") return [];
  return performance.getEntriesByType("measure").map(e => ({ name: e.name, duration: e.duration }));
}

/* ===================== 指标评级 ===================== */

/** 根据 Google Web Vitals 标准评定指标等级 */
export function rateVitals(
  v: WebVitals,
): Record<string, "good" | "needs-improvement" | "poor" | "unknown"> {
  const result: Record<string, "good" | "needs-improvement" | "poor" | "unknown"> = {};

  if (v.lcp !== undefined) {
    result.lcp = v.lcp <= 2500 ? "good" : v.lcp <= 4000 ? "needs-improvement" : "poor";
  } else {
    result.lcp = "unknown";
  }

  if (v.fid !== undefined) {
    result.fid = v.fid <= 100 ? "good" : v.fid <= 300 ? "needs-improvement" : "poor";
  } else {
    result.fid = "unknown";
  }

  if (v.cls !== undefined) {
    result.cls = v.cls <= 0.1 ? "good" : v.cls <= 0.25 ? "needs-improvement" : "poor";
  } else {
    result.cls = "unknown";
  }

  if (v.fcp !== undefined) {
    result.fcp = v.fcp <= 1800 ? "good" : v.fcp <= 3000 ? "needs-improvement" : "poor";
  } else {
    result.fcp = "unknown";
  }

  if (v.ttfb !== undefined) {
    result.ttfb = v.ttfb <= 800 ? "good" : v.ttfb <= 1800 ? "needs-improvement" : "poor";
  } else {
    result.ttfb = "unknown";
  }

  return result;
}

/* ===================== 初始化入口 ===================== */

/**
 * 初始化性能监控
 * 在应用启动时调用一次即可
 */
export function initPerformanceMonitoring(overrides?: Partial<PerformanceConfig>) {
  if (initialized) return;
  initialized = true;

  config = { ...DEFAULT_CONFIG, ...overrides };

  // 未启用时仅保留 mark/measure 能力，不注册 Observer
  if (!config.enabled) {
    return;
  }

  // 采样判定——未命中则不上报，但仍然采集指标供本地查看
  const sampled = shouldSample();

  // 注册各类 Observer
  observeFCP();
  observeLCP();
  observeFID();
  observeCLS();
  observeLongTasks();
  collectTTFB();

  // 页面隐藏或卸载时上报剩余数据
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      enqueueSnapshot();
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // 仅在采样命中时实际入队上报
  if (sampled) {
    // 页面加载完成后延迟上报（等待 LCP 等延迟指标稳定）
    if (document.readyState === "complete") {
      setTimeout(() => enqueueSnapshot(), 5000);
    } else {
      window.addEventListener("load", () => {
        setTimeout(() => enqueueSnapshot(), 5000);
      });
    }
  }

  // 开发环境：页面加载后在控制台打印指标摘要
  if (!import.meta.env.PROD) {
    window.addEventListener("load", () => {
      setTimeout(() => {
        const snapshot = buildSnapshot();
        const rating = rateVitals(snapshot.vitals);
        // eslint-disable-next-line no-console
        console.groupCollapsed("[性能指标]", rating);
        // eslint-disable-next-line no-console
        console.table(snapshot.vitals);
        // eslint-disable-next-line no-console
        console.table(rating);
        if (snapshot.longTasks.length > 0) {
          // eslint-disable-next-line no-console
          console.log("长任务数量:", snapshot.longTasks.length);
        }
        if (snapshot.slowResources.length > 0) {
          // eslint-disable-next-line no-console
          console.log("慢资源:", snapshot.slowResources);
        }
        // eslint-disable-next-line no-console
        console.groupEnd();
      }, 3000);
    });
  }
}

/**
 * 手动触发上报刷新
 */
export function flushPerformanceReports() {
  flush();
}

/**
 * 获取当前已采集的 Web Vitals（只读副本）
 */
export function getCurrentVitals(): WebVitals {
  return { ...vitals };
}
