/**
 * 性能监控模块
 *
 * 职责：
 *  1. 通过 PerformanceObserver 采集 Web Vitals（FCP / LCP / FID / INP / CLS / TTFB）
 *  2. 记录长任务（Long Tasks > 50ms）
 *  3. 采集 Navigation Timing 与 Resource Timing 关键数据
 *  4. 支持批量上报、采样率控制、开发/生产环境切换
 *  5. 领域指标记录（排盘计算、数据库操作等自定义打点）
 *  6. 指标持久化（IndexedDB）与趋势查询
 *  7. 性能预算检查
 *
 * 设计原则：
 *  - 监控代码本身不阻塞主线程，所有 Observer 均为异步回调
 *  - 不上报任何用户隐私数据
 *  - 开发环境仅 console.log，生产环境预留上报接口
 *  - 领域指标只保留最近 N 条（环形缓冲），避免无限增长
 */

/* ===================== 类型定义 ===================== */

/** Web Vitals 指标 */
export interface WebVitals {
  fcp?: number; // First Contentful Paint（ms）
  lcp?: number; // Largest Contentful Paint（ms）
  fid?: number; // First Input Delay（ms）
  inp?: number; // Interaction to Next Paint（ms）
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

/** 性能预算定义 */
export interface PerformanceBudget {
  /** 预算名称 */
  name: string;
  /** 指标类型 */
  metric: "lcp" | "fcp" | "fid" | "inp" | "cls" | "ttfb" | "domain";
  /** 阈值（ms 或 CLS 无单位值） */
  threshold: number;
  /** 领域指标名称（metric 为 "domain" 时必填） */
  domainName?: string;
}

/** 领域指标记录：排盘计算、数据库操作、缓存命中等自定义打点 */
export interface DomainMetric {
  /** 指标名称（如 "computeScopeData"、"db.listPersons"） */
  name: string;
  /** 耗时（ms） */
  duration: number;
  /** 标签（如 "cold-cache" / "hot-cache" / "error"） */
  tags?: string[];
  /** 时间戳 */
  timestamp: number;
  /** 额外上下文（可选，如人物 ID、日期等；不含敏感数据） */
  context?: Record<string, string | number | boolean>;
}

/** 缓存统计快照 */
export interface CacheSnapshot {
  /** 缓存名称 */
  name: string;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 淘汰次数 */
  evictions: number;
  /** 当前大小 */
  size: number;
  /** 命中率（0-1） */
  hitRate: number;
  /** 采集时间戳 */
  timestamp: number;
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

/* ── 领域指标环形缓冲（内存态） ── */

/** 领域指标最大保留条数（环形缓冲，避免内存无限增长） */
const MAX_DOMAIN_METRICS = 500;
const domainMetrics: DomainMetric[] = [];

/* ── 性能预算 ── */

const defaultBudgets: PerformanceBudget[] = [
  { name: "LCP 良好", metric: "lcp", threshold: 2500 },
  { name: "FID 良好", metric: "fid", threshold: 100 },
  { name: "CLS 良好", metric: "cls", threshold: 0.1 },
  { name: "FCP 良好", metric: "fcp", threshold: 1800 },
  { name: "TTFB 良好", metric: "ttfb", threshold: 800 },
];
let budgets: PerformanceBudget[] = [...defaultBudgets];

/* ── 指标持久化（IndexedDB） ── */

let metricsDB: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;
const METRICS_DB_NAME = "peep-perf-metrics";
const METRICS_STORE = "metrics";
const METRICS_DB_VERSION = 1;

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

/**
 * INP — Interaction to Next Paint（替代 FID 的新指标）
 * 取所有交互中第 p98 百分位的延迟（简化实现：保留所有交互 duration，取排序后 98% 位置）
 * 仅记录 duration（含渲染延迟），不单独区分 processingStart。
 */
function observeINP() {
  if (!isObserverSupported("event")) return;
  const durations: number[] = [];
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      const evt = entry as PerformanceEventTiming;
      // 跳过 duration=0 的事件（通常是首次输入或无效事件）
      if (evt.duration > 0) {
        durations.push(evt.duration);
      }
    }
    // 实时更新 INP：按 p98 计算
    if (durations.length > 0) {
      durations.sort((a, b) => a - b);
      const idx = Math.min(durations.length - 1, Math.floor(durations.length * 0.98));
      vitals.inp = durations[idx];
    }
  });
  observer.observe({
    type: "event",
    buffered: true,
    durationThreshold: 40,
  } as PerformanceObserverInit);
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

  if (v.inp !== undefined) {
    result.inp = v.inp <= 200 ? "good" : v.inp <= 500 ? "needs-improvement" : "poor";
  } else {
    result.inp = "unknown";
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

/* ===================== 领域指标记录 ===================== */

/**
 * 记录一条领域指标（排盘计算耗时、数据库操作耗时等）
 * 自动追加到环形缓冲，超过上限时淘汰最早的记录。
 *
 * @example
 * recordDomainMetric("computeScopeData", 23.5, { tags: ["cold-cache"] });
 * recordDomainMetric("db.listPersons", 5.2, { context: { count: 3 } });
 */
export function recordDomainMetric(
  name: string,
  duration: number,
  options?: { tags?: string[]; context?: Record<string, string | number | boolean> },
) {
  const metric: DomainMetric = {
    name,
    duration,
    tags: options?.tags,
    timestamp: Date.now(),
    context: options?.context,
  };

  // 环形缓冲：超过上限时淘汰最早的记录
  if (domainMetrics.length >= MAX_DOMAIN_METRICS) {
    domainMetrics.shift();
  }
  domainMetrics.push(metric);

  // 异步持久化到 IndexedDB（不阻塞主线程）
  persistMetric(metric);

  // 开发环境：超过性能预算阈值时打印警告
  if (import.meta.env.DEV) {
    checkDomainBudget(name, duration);
  }
}

/**
 * 获取领域指标（内存态）
 * @param name 可选过滤：只返回指定名称的指标
 * @param limit 最多返回条数（默认 100）
 */
export function getDomainMetrics(name?: string, limit = 100): DomainMetric[] {
  const source = name ? domainMetrics.filter(m => m.name === name) : domainMetrics;
  return source.slice(-limit);
}

/**
 * 获取领域指标统计摘要（按名称分组）
 * 返回每个指标的计数、平均耗时、最大/最小耗时、P95
 */
export function getDomainMetricSummary(): Record<
  string,
  { count: number; avg: number; min: number; max: number; p95: number }
> {
  const groups = new Map<string, number[]>();
  for (const m of domainMetrics) {
    let arr = groups.get(m.name);
    if (!arr) {
      arr = [];
      groups.set(m.name, arr);
    }
    arr.push(m.duration);
  }

  const result: Record<
    string,
    { count: number; avg: number; min: number; max: number; p95: number }
  > = {};

  for (const [name, values] of groups) {
    values.sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const p95Idx = Math.min(count - 1, Math.floor(count * 0.95));

    result[name] = {
      count,
      avg: sum / count,
      min: values[0],
      max: values[count - 1],
      p95: values[p95Idx],
    };
  }

  return result;
}

/** 清除所有领域指标（测试用） */
export function clearDomainMetrics() {
  domainMetrics.length = 0;
}

/**
 * 测量函数执行耗时并记录领域指标
 * 便捷包装：自动调用 recordDomainMetric
 *
 * @example
 * const result = measureSync("computeScopeData", () => computeScopeData(person, date));
 */
export function measureSync<T>(
  name: string,
  fn: () => T,
  options?: { tags?: string[]; context?: Record<string, string | number | boolean> },
): T {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    recordDomainMetric(name, duration, { ...options, tags: [...(options?.tags ?? []), "success"] });
    return result;
  } catch (err) {
    const duration = performance.now() - start;
    recordDomainMetric(name, duration, { ...options, tags: [...(options?.tags ?? []), "error"] });
    throw err;
  }
}

/**
 * 异步版 measureSync：测量异步函数执行耗时并记录领域指标
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  options?: { tags?: string[]; context?: Record<string, string | number | boolean> },
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    recordDomainMetric(name, duration, { ...options, tags: [...(options?.tags ?? []), "success"] });
    return result;
  } catch (err) {
    const duration = performance.now() - start;
    recordDomainMetric(name, duration, { ...options, tags: [...(options?.tags ?? []), "error"] });
    throw err;
  }
}

/* ===================== 性能预算检查 ===================== */

/** 设置自定义性能预算 */
export function setPerformanceBudgets(customBudgets: PerformanceBudget[]) {
  budgets = [...defaultBudgets, ...customBudgets];
}

/** 检查当前 Web Vitals 是否超出预算，返回超标项 */
export function checkPerformanceBudgets(): {
  budget: PerformanceBudget;
  actual: number;
  overage: number;
}[] {
  const violations: { budget: PerformanceBudget; actual: number; overage: number }[] = [];

  for (const b of budgets) {
    if (b.metric === "domain") {
      // 领域指标预算：检查最近一次同名指标是否超标
      if (b.domainName) {
        const recent = domainMetrics.filter(m => m.name === b.domainName);
        if (recent.length > 0) {
          const last = recent[recent.length - 1];
          if (last.duration > b.threshold) {
            violations.push({
              budget: b,
              actual: last.duration,
              overage: last.duration - b.threshold,
            });
          }
        }
      }
    } else {
      const actual = vitals[b.metric];
      if (actual !== undefined && actual > b.threshold) {
        violations.push({ budget: b, actual, overage: actual - b.threshold });
      }
    }
  }

  return violations;
}

/** 开发环境：检查领域指标预算，超标时打印警告 */
function checkDomainBudget(name: string, duration: number) {
  for (const b of budgets) {
    if (b.metric === "domain" && b.domainName === name && duration > b.threshold) {
       
      console.warn(
        `[性能预算] ${name} 耗时 ${duration.toFixed(1)}ms 超出预算 ${b.threshold}ms（超标 ${(duration - b.threshold).toFixed(1)}ms）`,
      );
    }
  }
}

/* ===================== 指标持久化（IndexedDB） ===================== */

/** 初始化指标数据库 */
function initMetricsDB(): Promise<IDBDatabase> {
  if (metricsDB) return Promise.resolve(metricsDB);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB 不可用"));
      return;
    }

    const request = indexedDB.open(METRICS_DB_NAME, METRICS_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(METRICS_STORE)) {
        const store = db.createObjectStore(METRICS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("name", "name", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("name_timestamp", ["name", "timestamp"], { unique: false });
      }
    };

    request.onsuccess = () => {
      metricsDB = request.result;
      metricsDB.onclose = () => {
        metricsDB = null;
        dbInitPromise = null;
      };
      resolve(metricsDB);
    };

    request.onerror = () => {
      dbInitPromise = null;
      reject(request.error);
    };
  });

  return dbInitPromise;
}

/** 异步持久化单条指标到 IndexedDB */
function persistMetric(metric: DomainMetric) {
  initMetricsDB()
    .then(db => {
      const tx = db.transaction(METRICS_STORE, "readwrite");
      tx.objectStore(METRICS_STORE).add(metric);
    })
    .catch(() => {
      /* 持久化失败不应影响应用运行 */
    });
}

/**
 * 从 IndexedDB 查询领域指标（持久化数据）
 * @param name 按名称过滤（可选）
 * @param limit 最多返回条数（默认 100）
 * @param since 起始时间戳（可选）
 */
export async function queryPersistedMetrics(
  name?: string,
  limit = 100,
  since?: number,
): Promise<DomainMetric[]> {
  try {
    const db = await initMetricsDB();
    const tx = db.transaction(METRICS_STORE, "readonly");
    const store = tx.objectStore(METRICS_STORE);

    return new Promise<DomainMetric[]>((resolve, reject) => {
      let request: IDBRequest<DomainMetric[]>;

      if (name && since) {
        const range = IDBKeyRange.bound([name, since], [name, Date.now()], true, true);
        request = store.index("name_timestamp").getAll(range, limit);
      } else if (name) {
        request = store.index("name").getAll(name, limit);
      } else if (since) {
        const range = IDBKeyRange.lowerBound(since);
        request = store.index("timestamp").getAll(range, limit);
      } else {
        request = store.getAll(undefined, limit);
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/** 清除 IndexedDB 中的持久化指标 */
export async function clearPersistedMetrics(): Promise<void> {
  try {
    const db = await initMetricsDB();
    const tx = db.transaction(METRICS_STORE, "readwrite");
    tx.objectStore(METRICS_STORE).clear();
  } catch {
    /* 忽略 */
  }
}

/* ===================== 缓存统计集成 ===================== */

/**
 * 获取缓存统计快照
 * 从缓存注册表读取各缓存实例的统计信息
 */
export function getCacheSnapshots(): CacheSnapshot[] {
  // 延迟导入以避免循环依赖
  // 使用动态 import 会在编译时产生 Promise，这里用同步访问 window 上的调试 API
  try {
    const peep = (
      window as unknown as {
        peep?: {
          getAllCacheStats?: () => Record<
            string,
            { hits: number; misses: number; evictions: number; size: number }
          >;
        };
      }
    ).peep;
    if (!peep?.getAllCacheStats) return [];

    const stats = peep.getAllCacheStats();
    return Object.entries(stats).map(([name, s]) => ({
      name,
      hits: s.hits,
      misses: s.misses,
      evictions: s.evictions,
      size: s.size,
      hitRate: s.hits + s.misses > 0 ? s.hits / (s.hits + s.misses) : 0,
      timestamp: Date.now(),
    }));
  } catch {
    return [];
  }
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
  observeINP();
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
        // 性能预算检查
        const violations = checkPerformanceBudgets();
        if (violations.length > 0) {
           
          console.warn("性能预算超标:", violations);
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
