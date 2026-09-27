/**
 * 组件渲染追踪工具（仅开发环境）
 *
 * 提供 `useRenderTracker` Hook 追踪组件渲染次数、耗时与 props 变更，
 * 便于在 DevDashboard 或控制台排查重渲染性能问题。
 *
 * 设计原则：
 *  - 生产环境完全禁用（所有导出为空操作）
 *  - 记录采用环形缓冲，避免内存无限增长
 *  - 不干扰 React 渲染流程（在 useEffect 中测量，不使用 useLayoutEffect）
 */

import { useEffect, useRef, useId } from "react";
import { recordDomainMetric } from "./performance";

/* ── 类型定义 ── */

/** 单条渲染记录 */
export interface RenderRecord {
  /** 组件标识（由用户传入或使用自动生成的 id） */
  component: string;
  /** 渲染次数（累计） */
  renderCount: number;
  /** 本次渲染耗时（ms） */
  duration: number;
  /** 时间戳 */
  timestamp: number;
  /** props 是否发生变化（与上次比较） */
  propsChanged: boolean;
  /** props 变更摘要（仅当 propsChanged=true 时有值） */
  propsDiff?: string;
}

/* ── 模块状态 ── */

/** 环形缓冲：最大保留记录条数 */
const MAX_RECORDS = 200;
const records: RenderRecord[] = [];

/** 组件累计渲染计数 */
const renderCounts = new Map<string, number>();

/** 上次 props 引用（用于比较） */
const lastPropsRef = new Map<string, unknown>();

/** 是否启用渲染追踪（默认关闭，通过 enableRenderTracker 开启） */
let enabled = false;

/** 渲染耗时阈值（ms），超过时自动在控制台警告 */
let slowRenderThreshold = 16; // 一帧 16ms

/* ── 公开 API ── */

/**
 * 启用/禁用渲染追踪。
 * 默认关闭（减少性能开销），开发调试时通过 `peep.enableRenderTracker(true)` 开启。
 */
export function enableRenderTracker(value: boolean): void {
  if (!import.meta.env.DEV) return;
  enabled = value;
  // eslint-disable-next-line no-console
  console.log(
    `%c[peep]%c 渲染追踪${value ? "已启用" : "已禁用"}`,
    "color:#2196f3;font-weight:bold",
    "",
  );
}

/** 设置慢渲染警告阈值（ms） */
export function setSlowRenderThreshold(ms: number): void {
  if (!import.meta.env.DEV) return;
  slowRenderThreshold = ms;
}

/**
 * 组件渲染追踪 Hook。
 * 在组件中使用：每次渲染后记录耗时、props 变更，并累计渲染次数。
 *
 * @param name 组件名称（建议传组件 displayName 或固定字符串）
 * @param props 需要追踪的 props（可选；传入后会自动做浅比较）
 *
 * @example
 * ```tsx
 * function MyComponent(props) {
 *   useRenderTracker("MyComponent", props);
 *   // ...
 * }
 * ```
 */
export function useRenderTracker(name: string, props?: unknown): void {
  // 生产环境直接返回，Hook 规则要求无条件调用
  const startRef = useRef<number>(0);
  const autoId = useId();
  const key = name || autoId;

  // 记录渲染开始时间（在 render 阶段，同步）
  startRef.current = performance.now();

  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return;

    const duration = performance.now() - startRef.current;
    const count = (renderCounts.get(key) ?? 0) + 1;
    renderCounts.set(key, count);

    // props 浅比较
    let propsChanged = false;
    let propsDiff: string | undefined;
    if (props !== undefined) {
      const last = lastPropsRef.get(key);
      if (last !== props) {
        propsChanged = true;
        propsDiff = describePropsDiff(last, props);
      }
      lastPropsRef.set(key, props);
    }

    // 记录
    const record: RenderRecord = {
      component: key,
      renderCount: count,
      duration,
      timestamp: Date.now(),
      propsChanged,
      propsDiff,
    };

    if (records.length >= MAX_RECORDS) {
      records.shift();
    }
    records.push(record);

    // 记录到领域指标（供 DevDashboard 展示）
    recordDomainMetric(`render.${key}`, duration);

    // 慢渲染警告
    if (duration > slowRenderThreshold) {
      console.warn(
        `[渲染追踪] ${key} 渲染耗时 ${duration.toFixed(1)}ms（阈值 ${slowRenderThreshold}ms）` +
          (propsChanged ? ` — props 已变更: ${propsDiff}` : ""),
      );
    }
  });
}

/**
 * 获取所有渲染记录（只读副本）
 */
export function getRenderRecords(): RenderRecord[] {
  if (!import.meta.env.DEV) return [];
  return [...records];
}

/**
 * 获取每个组件的渲染统计摘要
 */
export function getRenderSummary(): Record<
  string,
  { count: number; avgDuration: number; maxDuration: number; lastRender: number }
> {
  if (!import.meta.env.DEV) return {};

  // 按组件分组
  const groups = new Map<string, number[]>();
  for (const r of records) {
    let arr = groups.get(r.component);
    if (!arr) {
      arr = [];
      groups.set(r.component, arr);
    }
    arr.push(r.duration);
  }

  const result: Record<
    string,
    { count: number; avgDuration: number; maxDuration: number; lastRender: number }
  > = {};

  for (const [name, durations] of groups) {
    const sum = durations.reduce((a, b) => a + b, 0);
    result[name] = {
      count: renderCounts.get(name) ?? durations.length,
      avgDuration: sum / durations.length,
      maxDuration: Math.max(...durations),
      lastRender: records[records.length - 1]?.timestamp ?? 0,
    };
  }

  return result;
}

/**
 * 清除所有渲染记录（测试用）
 */
export function clearRenderRecords(): void {
  records.length = 0;
  renderCounts.clear();
  lastPropsRef.clear();
}

/**
 * 检查渲染追踪是否启用
 */
export function isRenderTrackerEnabled(): boolean {
  return enabled;
}

/* ── 工具函数 ── */

/**
 * 描述 props 差异（浅比较）
 * 返回一个字符串摘要，说明哪些字段发生了变化
 */
function describePropsDiff(oldProps: unknown, newProps: unknown): string {
  if (oldProps === null || oldProps === undefined) return "(初始)";
  if (typeof oldProps !== "object" || typeof newProps !== "object") return "(类型变更)";

  const oldObj = oldProps as Record<string, unknown>;
  const newObj = newProps as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const changes: string[] = [];

  for (const key of allKeys) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];
    if (oldVal !== newVal) {
      if (oldVal === undefined) {
        changes.push(`+${key}`);
      } else if (newVal === undefined) {
        changes.push(`-${key}`);
      } else {
        changes.push(`~${key}`);
      }
    }
  }

  return changes.length > 0 ? changes.join(", ") : "(引用变化，值相同)";
}
