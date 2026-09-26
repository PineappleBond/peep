/**
 * 性能监控悬浮组件
 *
 * 轻量级悬浮面板，显示实时性能指标摘要（FPS、核心 Web Vitals、领域指标）。
 * 与 DevDashboard 互补：
 * - DevDashboard：全屏面板，详细数据，Ctrl+Shift+D 唤起
 * - PerformanceMonitor：悬浮指示器，实时 FPS 和核心指标，适合开发时持续观察
 *
 * 通过 window.peep.togglePerfMonitor() 或快捷键 Ctrl+Shift+P 切换可见性。
 * 仅开发环境渲染。
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { getCurrentVitals, rateVitals, getDomainMetricSummary } from "../core/performance";
import { registerShortcut } from "../core/shortcuts";

/* ===================== 状态管理 ===================== */

let monitorVisible = false;
type VisibilityListener = (visible: boolean) => void;
const visibilityListeners = new Set<VisibilityListener>();

function setMonitorVisible(v: boolean) {
  monitorVisible = v;
  visibilityListeners.forEach(fn => {
    try {
      fn(v);
    } catch {
      /* 忽略 */
    }
  });
}

export function togglePerformanceMonitor() {
  setMonitorVisible(!monitorVisible);
}

export function isPerformanceMonitorVisible() {
  return monitorVisible;
}

/* ===================== FPS 计数器 ===================== */

/**
 * 实时 FPS 计算：基于 requestAnimationFrame 间隔
 */
function useFPS(enabled: boolean): number {
  const [fps, setFps] = useState(0);
  const framesRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    if (!enabled) return;

    let rafId: number;
    const tick = (now: number) => {
      framesRef.current++;
      if (now - lastTimeRef.current >= 1000) {
        setFps(framesRef.current);
        framesRef.current = 0;
        lastTimeRef.current = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  return fps;
}

/* ===================== 指标评级颜色 ===================== */

function ratingColor(rate: string): string {
  switch (rate) {
    case "good":
      return "var(--perf-good, #16a34a)";
    case "needs-improvement":
      return "var(--perf-warn, #d97706)";
    case "poor":
      return "var(--perf-bad, #dc2626)";
    default:
      return "var(--perf-unknown, #6b7280)";
  }
}

function fpsColor(fps: number): string {
  if (fps >= 55) return "var(--perf-good, #16a34a)";
  if (fps >= 30) return "var(--perf-warn, #d97706)";
  return "var(--perf-bad, #dc2626)";
}

/* ===================== 主组件 ===================== */

export const PerformanceMonitor = memo(function PerformanceMonitor() {
  const [visible, setVisible] = useState(monitorVisible);
  const [tick, setTick] = useState(0);

  // 订阅可见性变化
  useEffect(() => {
    const listener: VisibilityListener = v => setVisible(v);
    visibilityListeners.add(listener);
    return () => {
      visibilityListeners.delete(listener);
    };
  }, []);

  // 注册快捷键
  useEffect(() => {
    const unreg = registerShortcut({
      key: "Ctrl+Shift+P",
      handler: () => togglePerformanceMonitor(),
      description: "性能监控悬浮窗",
      group: "开发者",
    });
    return unreg;
  }, []);

  // 定时刷新（2 秒间隔，比 DevDashboard 低频率）
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setTick(t => t + 1), 2000);
    return () => window.clearInterval(id);
  }, [visible]);

  const fps = useFPS(visible);

  const handleClose = useCallback(() => {
    setMonitorVisible(false);
  }, []);

  // 生产环境或不可见时不渲染
  if (!import.meta.env.DEV) return null;
  if (!visible) return null;

  const vitals = getCurrentVitals();
  const ratings = rateVitals(vitals);
  const domainSummary = getDomainMetricSummary();

  // 找出最慢的领域指标
  const slowestDomain = Object.entries(domainSummary)
    .sort((a, b) => b[1].avg - a[1].avg)
    .slice(0, 3);

  return (
    <div className="perf-monitor" role="status" aria-label="性能监控">
      <div className="perf-monitor-header">
        <span className="perf-monitor-title">性能</span>
        <button
          type="button"
          className="perf-monitor-close"
          onClick={handleClose}
          aria-label="关闭性能监控"
        >
          &times;
        </button>
      </div>

      <div className="perf-monitor-body">
        {/* FPS */}
        <div className="perf-monitor-row">
          <span className="perf-monitor-label">FPS</span>
          <span className="perf-monitor-value" style={{ color: fpsColor(fps) }}>
            {fps}
          </span>
        </div>

        {/* 核心 Web Vitals */}
        <div className="perf-monitor-row">
          <span className="perf-monitor-label">LCP</span>
          <span
            className="perf-monitor-value"
            style={{ color: ratingColor(ratings.lcp ?? "unknown") }}
          >
            {vitals.lcp !== undefined ? `${vitals.lcp.toFixed(0)}ms` : "-"}
          </span>
        </div>
        <div className="perf-monitor-row">
          <span className="perf-monitor-label">INP</span>
          <span
            className="perf-monitor-value"
            style={{ color: ratingColor(ratings.inp ?? "unknown") }}
          >
            {vitals.inp !== undefined ? `${vitals.inp.toFixed(0)}ms` : "-"}
          </span>
        </div>
        <div className="perf-monitor-row">
          <span className="perf-monitor-label">CLS</span>
          <span
            className="perf-monitor-value"
            style={{ color: ratingColor(ratings.cls ?? "unknown") }}
          >
            {vitals.cls !== undefined ? vitals.cls.toFixed(3) : "-"}
          </span>
        </div>

        {/* 最慢的领域指标 */}
        {slowestDomain.length > 0 && (
          <>
            <div className="perf-monitor-divider" />
            {slowestDomain.map(([name, stats]) => (
              <div className="perf-monitor-row" key={name}>
                <span className="perf-monitor-label" title={name}>
                  {name.length > 18 ? `${name.slice(0, 16)}...` : name}
                </span>
                <span className="perf-monitor-value perf-monitor-domain">
                  {stats.avg.toFixed(0)}ms
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 避免 lint 报未使用参数（tick 用于触发重渲染） */}
      <span hidden>{tick}</span>
    </div>
  );
});
