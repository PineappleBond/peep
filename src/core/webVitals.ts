/**
 * Web Vitals 监控模块
 *
 * 职责：
 *  1. 提供 INP（Interaction to Next Paint）指标的增强监控
 *  2. 提供 Web Vitals 指标的便捷查询与分析 API
 *  3. 支持性能等级分类（good / needs-improvement / poor）
 *  4. 与 performance.ts 的领域指标系统协作，将 Web Vitals 事件也纳入领域指标记录
 *
 * 设计原则：
 *  - 与 performance.ts 协同，不重复采集
 *  - 提供比 performance.ts 更面向业务的高层 API
 *  - 所有方法均为安全降级：浏览器不支持时返回空/默认值
 */

import { getCurrentVitals, rateVitals, recordDomainMetric, type WebVitals } from "./performance";

/* ===================== 类型定义 ===================== */

/** 性能等级 */
export type PerfRating = "good" | "needs-improvement" | "poor" | "unknown";

/** 单个 Web Vital 的完整信息 */
export interface VitalInfo {
  /** 指标名称 */
  name: string;
  /** 当前值（ms 或 CLS 无单位） */
  value: number | undefined;
  /** 性能等级 */
  rating: PerfRating;
  /** 良好阈值 */
  goodThreshold: number;
  /** 需改进阈值 */
  needsImprovementThreshold: number;
  /** 单位说明 */
  unit: string;
}

/** Web Vitals 综合报告 */
export interface WebVitalsReport {
  /** 各指标详情 */
  vitals: VitalInfo[];
  /** 整体评级（取最差指标等级） */
  overallRating: PerfRating;
  /** 采集时间戳 */
  timestamp: number;
  /** 优化建议 */
  suggestions: string[];
}

/* ===================== 指标阈值定义 ===================== */

interface VitalThreshold {
  name: string;
  key: keyof WebVitals;
  good: number;
  needsImprovement: number;
  unit: string;
}

const VITAL_THRESHOLDS: VitalThreshold[] = [
  { name: "LCP", key: "lcp", good: 2500, needsImprovement: 4000, unit: "ms" },
  { name: "FID", key: "fid", good: 100, needsImprovement: 300, unit: "ms" },
  { name: "INP", key: "inp", good: 200, needsImprovement: 500, unit: "ms" },
  { name: "CLS", key: "cls", good: 0.1, needsImprovement: 0.25, unit: "" },
  { name: "FCP", key: "fcp", good: 1800, needsImprovement: 3000, unit: "ms" },
  { name: "TTFB", key: "ttfb", good: 800, needsImprovement: 1800, unit: "ms" },
];

/* ===================== INP 增强监控 ===================== */

/**
 * INP 事件跟踪器：记录每次交互的耗时到领域指标
 * 通过 PerformanceObserver 监听 event 类型，将每次交互记录到领域指标
 * 便于在 DevDashboard 中查看交互性能分布
 */
let inpTrackingEnabled = false;

/**
 * 启用 INP 事件跟踪
 * 每次交互（click/key down/pointer down）的耗时会记录到 "inp.event" 领域指标
 */
export function enableINPTracking() {
  if (inpTrackingEnabled) return;
  if (typeof PerformanceObserver === "undefined") return;
  if (!PerformanceObserver.supportedEntryTypes?.includes("event")) return;

  inpTrackingEnabled = true;

  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      const evt = entry as PerformanceEventTiming;
      if (evt.duration <= 0) continue;

      // 记录交互耗时到领域指标
      recordDomainMetric("inp.event", evt.duration, {
        tags: [evt.name || "unknown"],
        context: {
          eventType: evt.name,
          // 不记录具体坐标等隐私数据
        },
      });
    }
  });

  observer.observe({
    type: "event",
    buffered: true,
    durationThreshold: 16,
  } as PerformanceObserverInit);
}

/* ===================== 高层 API ===================== */

/**
 * 获取 Web Vitals 综合报告
 * 包含各指标详情、整体评级、优化建议
 */
export function getWebVitalsReport(): WebVitalsReport {
  const vitals = getCurrentVitals();
  const ratings = rateVitals(vitals);

  const vitalInfos: VitalInfo[] = VITAL_THRESHOLDS.map(threshold => {
    const value = vitals[threshold.key];
    const rating = (ratings[threshold.key] as PerfRating) ?? "unknown";

    return {
      name: threshold.name,
      value,
      rating,
      goodThreshold: threshold.good,
      needsImprovementThreshold: threshold.needsImprovement,
      unit: threshold.unit,
    };
  });

  // 整体评级：取最差（已采集的指标中）
  const ratingOrder: Record<PerfRating, number> = {
    good: 0,
    "needs-improvement": 1,
    poor: 2,
    unknown: -1,
  };
  const knownRatings = vitalInfos.map(v => v.rating).filter(r => r !== "unknown");
  let overallRating: PerfRating = "unknown";
  if (knownRatings.length > 0) {
    overallRating = knownRatings.reduce((worst, current) =>
      ratingOrder[current] > ratingOrder[worst] ? current : worst,
    );
  }

  // 生成优化建议
  const suggestions: string[] = [];
  for (const v of vitalInfos) {
    if (v.rating === "poor") {
      suggestions.push(getSuggestion(v.name, v.value, "poor"));
    } else if (v.rating === "needs-improvement") {
      suggestions.push(getSuggestion(v.name, v.value, "needs-improvement"));
    }
  }

  return {
    vitals: vitalInfos,
    overallRating,
    timestamp: Date.now(),
    suggestions,
  };
}

/**
 * 格式化指标值
 */
export function formatVitalValue(name: string, value: number | undefined): string {
  if (value === undefined) return "-";
  if (name === "CLS") return value.toFixed(3);
  return `${value.toFixed(1)} ms`;
}

/**
 * 根据指标名称和等级生成优化建议
 */
function getSuggestion(name: string, value: number | undefined, rating: PerfRating): string {
  const threshold = VITAL_THRESHOLDS.find(t => t.name === name);
  if (!threshold) return "";

  const formattedValue = formatVitalValue(name, value);
  const goodThreshold = threshold.unit
    ? `${threshold.good} ${threshold.unit}`
    : `${threshold.good}`;

  const suggestions: Record<string, string> = {
    LCP: `LCP ${formattedValue} 偏高，考虑优化图片加载、预加载关键资源、减少渲染阻塞`,
    FID: `FID ${formattedValue} 偏高，考虑减少主线程长任务、代码拆分`,
    INP: `INP ${formattedValue} 偏高，考虑优化事件处理函数性能、避免同步 DOM 操作`,
    CLS: `CLS ${formattedValue} 偏高，为图片/广告预留空间、避免动态注入内容`,
    FCP: `FCP ${formattedValue} 偏高，考虑内联关键 CSS、减少首次渲染依赖`,
    TTFB: `TTFB ${formattedValue} 偏高，考虑优化服务器响应时间、使用 CDN`,
  };

  const prefix = rating === "poor" ? "[差]" : "[需改进]";
  return `${prefix} ${suggestions[name] ?? ""}（目标: ≤ ${goodThreshold}）`;
}

/**
 * 检查指定指标是否达标
 */
export function isVitalGood(name: string): boolean {
  const vitals = getCurrentVitals();
  const ratings = rateVitals(vitals);
  const threshold = VITAL_THRESHOLDS.find(t => t.name === name);
  if (!threshold) return false;
  return ratings[threshold.key] === "good";
}
