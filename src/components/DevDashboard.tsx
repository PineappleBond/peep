/**
 * 开发者性能仪表板
 *
 * 仅在开发环境可用，通过 Ctrl+Shift+D / Cmd+Shift+D 唤起。
 * 聚合 performance.ts 与 errorTracking.ts 的数据，并实时展示内存、DOM、IndexedDB 等指标。
 * 生产环境下组件渲染为空，避免被误引入。
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCurrentVitals,
  getCustomMeasures,
  rateVitals,
  type WebVitals,
} from "../core/performance";
import { getRecordedErrors, type ErrorReport } from "../core/errorTracking";
import { registerShortcut } from "../core/shortcuts";

/** 仪表板可见性变更的监听器（供外部模块在快捷键触发时响应） */
type VisibilityListener = (visible: boolean) => void;
const visibilityListeners = new Set<VisibilityListener>();
let dashVisible = false;

function setDashVisible(v: boolean) {
  dashVisible = v;
  visibilityListeners.forEach(fn => {
    try {
      fn(v);
    } catch (err) {
      console.error("[DevDashboard] 可见性监听器执行失败", err);
    }
  });
}

export function onDevDashboardVisibility(fn: VisibilityListener): () => void {
  visibilityListeners.add(fn);
  return () => {
    visibilityListeners.delete(fn);
  };
}

export function toggleDevDashboard() {
  setDashVisible(!dashVisible);
}

export function isDevDashboardVisible() {
  return dashVisible;
}

/* ===================== 类型与常量 ===================== */

interface SystemInfo {
  /** 已用 JS 堆内存（MB，仅 Chrome） */
  usedJSHeapMB?: number;
  /** 总 JS 堆内存（MB，仅 Chrome） */
  totalJSHeapMB?: number;
  /** DOM 节点数 */
  domNodeCount: number;
  /** IndexedDB 已用字节 */
  idbUsage?: number;
  /** IndexedDB 配额字节 */
  idbQuota?: number;
  /** Service Worker 是否受控 */
  swControlled: boolean;
}

interface SnapshotRecord {
  ts: number;
  vitals: WebVitals;
}

const REFRESH_INTERVAL_MS = 1000;
const MAX_SNAPSHOTS = 30;
const MAX_ERRORS = 50;

/* ===================== 工具函数 ===================== */

/** 指标评级对应的颜色 token */
function rateColor(rate: string): string {
  switch (rate) {
    case "good":
      return "var(--dev-rate-good, #16a34a)";
    case "needs-improvement":
      return "var(--dev-rate-warn, #d97706)";
    case "poor":
      return "var(--dev-rate-bad, #dc2626)";
    default:
      return "var(--dev-rate-unknown, #6b7280)";
  }
}

/** 数值格式化（毫秒保留 1 位小数，CLS 保留 3 位） */
function fmtMs(v: number | undefined): string {
  if (v === undefined || Number.isNaN(v)) return "-";
  return `${v.toFixed(1)} ms`;
}

function fmtBytes(bytes: number | undefined): string {
  if (bytes === undefined || Number.isNaN(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

/* ===================== 数据 Hook ===================== */

function useSystemInfo(tick: number): SystemInfo {
  const info: SystemInfo = {
    domNodeCount: 0,
    swControlled: !!navigator.serviceWorker?.controller,
  };

  // 内存（仅 Chrome）
  const perfMemory = (
    performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }
  ).memory;
  if (perfMemory) {
    info.usedJSHeapMB = perfMemory.usedJSHeapSize / 1024 / 1024;
    info.totalJSHeapMB = perfMemory.totalJSHeapSize / 1024 / 1024;
  }

  // DOM 节点数
  try {
    info.domNodeCount = document.querySelectorAll("*").length;
  } catch {
    info.domNodeCount = -1;
  }

  // IndexedDB 使用量
  if (navigator.storage?.estimate) {
    navigator.storage
      .estimate()
      .then(est => {
        // 通过 setState 触发一次额外更新（此处仅作为异步补充，主渲染使用上一次缓存值）
        // 简单处理：把结果存到 window 上供下次 tick 读取
        (
          window as unknown as { __idbEstimate?: { usage?: number; quota?: number } }
        ).__idbEstimate = {
          usage: est.usage,
          quota: est.quota,
        };
      })
      .catch(() => {
        /* 忽略 */
      });
    const cached = (window as unknown as { __idbEstimate?: { usage?: number; quota?: number } })
      .__idbEstimate;
    if (cached) {
      info.idbUsage = cached.usage;
      info.idbQuota = cached.quota;
    }
  }

  // 避免 lint 报未使用参数（tick 用于触发重渲染）
  void tick;

  return info;
}

/* ===================== 子组件 ===================== */

/** 指标卡片：使用 memo 避免每秒刷新时不必要的重渲染 */
const VitalCard = memo(function VitalCard({
  label,
  value,
  rate,
}: {
  label: string;
  value: string;
  rate: string;
}) {
  return (
    <div className="dev-dash-card" style={{ borderLeftColor: rateColor(rate) }}>
      <div className="dev-dash-card-label">{label}</div>
      <div className="dev-dash-card-value">{value}</div>
      <div className="dev-dash-card-rate" style={{ color: rateColor(rate) }}>
        {rate}
      </div>
    </div>
  );
});

/** 迷你趋势图：使用 memo 避免每秒刷新时不必要的重渲染 */
const Sparkline = memo(function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <div className="dev-dash-sparkline dev-dash-empty">尚无历史数据</div>;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 180;
  const h = 36;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="dev-dash-sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
});

/* ===================== 主组件 ===================== */

export function DevDashboard() {
  const [visible, setVisible] = useState(dashVisible);
  const [tick, setTick] = useState(0);
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const historyRef = useRef<SnapshotRecord[]>([]);

  // 订阅可见性变化（快捷键触发时由外部切换）
  useEffect(() => {
    const unsub = onDevDashboardVisibility(v => setVisible(v));
    return unsub;
  }, []);

  // 注册快捷键
  useEffect(() => {
    const unreg = registerShortcut({
      key: "Ctrl+Shift+D",
      handler: () => toggleDevDashboard(),
      description: "开发者性能仪表板",
      group: "开发者",
    });
    return unreg;
  }, []);

  // 定时刷新数据
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setTick(t => t + 1), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [visible]);

  // 拉取各项数据
  const vitals = useMemo(() => getCurrentVitals(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const rating = useMemo(() => rateVitals(vitals), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const measures = useMemo(() => getCustomMeasures(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const sysInfo = useSystemInfo(tick);

  useEffect(() => {
    setErrors(getRecordedErrors().slice(-MAX_ERRORS).reverse());
  }, [tick]);

  // 记录历史（每秒一次，保留 MAX_SNAPSHOTS 条，用于趋势）
  useEffect(() => {
    if (!visible) return;
    historyRef.current = [
      ...historyRef.current,
      { ts: performance.now(), vitals: { ...vitals } },
    ].slice(-MAX_SNAPSHOTS);
  }, [tick, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = useCallback(() => {
    const report = {
      exportedAt: new Date().toISOString(),
      vitals,
      rating,
      system: sysInfo,
      measures,
      errors,
      history: historyRef.current,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `perf-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [vitals, rating, sysInfo, measures, errors]);

  const handleClose = useCallback(() => {
    setDashVisible(false);
  }, []);

  // 生产环境完全不渲染
  if (!import.meta.env.DEV) return null;
  if (!visible) return null;

  const trendFCP = historyRef.current.map(h => h.vitals.fcp ?? 0).filter(v => v > 0);
  const trendLCP = historyRef.current.map(h => h.vitals.lcp ?? 0).filter(v => v > 0);
  const trendCLS = historyRef.current.map(h => h.vitals.cls ?? 0);

  const idbPercent =
    sysInfo.idbQuota && sysInfo.idbUsage
      ? Math.min(100, (sysInfo.idbUsage / sysInfo.idbQuota) * 100)
      : 0;

  return (
    <div
      className="dev-dash-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-dash-title"
    >
      <div className="dev-dash-panel">
        <header className="dev-dash-header">
          <div className="dev-dash-title">
            <span id="dev-dash-title">开发者性能仪表板</span>
            <span className="dev-dash-env">DEV</span>
          </div>
          <div className="dev-dash-actions">
            <button
              type="button"
              className="dev-dash-btn"
              onClick={handleExport}
              title="导出 JSON 报告"
              aria-label="导出 JSON 报告"
            >
              导出
            </button>
            <button
              type="button"
              className="dev-dash-btn dev-dash-close"
              onClick={handleClose}
              title="关闭（Ctrl+Shift+D）"
              aria-label="关闭开发者仪表板"
            >
              ×
            </button>
          </div>
        </header>

        <section className="dev-dash-section">
          <h3>Web Vitals</h3>
          <div className="dev-dash-grid">
            <VitalCard label="FCP" value={fmtMs(vitals.fcp)} rate={rating.fcp ?? "unknown"} />
            <VitalCard label="LCP" value={fmtMs(vitals.lcp)} rate={rating.lcp ?? "unknown"} />
            <VitalCard label="FID" value={fmtMs(vitals.fid)} rate={rating.fid ?? "unknown"} />
            <VitalCard
              label="CLS"
              value={vitals.cls !== undefined ? vitals.cls.toFixed(3) : "-"}
              rate={rating.cls ?? "unknown"}
            />
            <VitalCard label="TTFB" value={fmtMs(vitals.ttfb)} rate={rating.ttfb ?? "unknown"} />
          </div>
          <div className="dev-dash-trends">
            <div>
              <span className="dev-dash-trend-label">FCP 趋势</span>
              <Sparkline values={trendFCP} color="#16a34a" />
            </div>
            <div>
              <span className="dev-dash-trend-label">LCP 趋势</span>
              <Sparkline values={trendLCP} color="#d97706" />
            </div>
            <div>
              <span className="dev-dash-trend-label">CLS 趋势</span>
              <Sparkline values={trendCLS} color="#6366f1" />
            </div>
          </div>
        </section>

        <section className="dev-dash-section">
          <h3>系统信息</h3>
          <ul className="dev-dash-kv">
            <li>
              <span>DOM 节点数</span>
              <strong>{sysInfo.domNodeCount}</strong>
            </li>
            <li>
              <span>JS 堆内存</span>
              <strong>
                {sysInfo.usedJSHeapMB !== undefined
                  ? `${sysInfo.usedJSHeapMB.toFixed(1)} / ${sysInfo.totalJSHeapMB?.toFixed(1)} MB`
                  : "当前浏览器不支持"}
              </strong>
            </li>
            <li>
              <span>IndexedDB 占用</span>
              <strong>
                {sysInfo.idbUsage !== undefined
                  ? `${fmtBytes(sysInfo.idbUsage)} / ${fmtBytes(sysInfo.idbQuota)}（${idbPercent.toFixed(1)}%）`
                  : "-"}
              </strong>
            </li>
            <li>
              <span>Service Worker</span>
              <strong>{sysInfo.swControlled ? "已激活" : "未激活"}</strong>
            </li>
          </ul>
        </section>

        <section className="dev-dash-section">
          <h3>自定义计时（performance.measure）</h3>
          {measures.length === 0 ? (
            <div className="dev-dash-empty">暂无自定义计时</div>
          ) : (
            <table className="dev-dash-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>耗时</th>
                </tr>
              </thead>
              <tbody>
                {measures.map(m => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td>{m.duration.toFixed(2)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="dev-dash-section">
          <h3>错误日志（最近 {errors.length} 条）</h3>
          {errors.length === 0 ? (
            <div className="dev-dash-empty">暂无错误记录</div>
          ) : (
            <ul className="dev-dash-errors">
              {errors.map(e => (
                <li key={e.fingerprint} className={`dev-dash-error dev-dash-error-${e.type}`}>
                  <button
                    type="button"
                    className="dev-dash-error-head"
                    onClick={() =>
                      setExpandedError(expandedError === e.fingerprint ? null : e.fingerprint)
                    }
                  >
                    <span className="dev-dash-error-type">{e.type}</span>
                    <span className="dev-dash-error-msg">{e.message}</span>
                    <span className="dev-dash-error-meta">
                      ×{e.count} · {formatTime(e.timestamp)}
                    </span>
                  </button>
                  {expandedError === e.fingerprint && (
                    <div className="dev-dash-error-detail">
                      <div>
                        <em>URL:</em> {e.url}
                      </div>
                      {e.lineno !== undefined && (
                        <div>
                          <em>位置:</em> {e.lineno}:{e.colno}
                        </div>
                      )}
                      {e.resourceUrl && (
                        <div>
                          <em>资源:</em> {e.resourceUrl}
                        </div>
                      )}
                      {e.stack && <pre>{e.stack}</pre>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="dev-dash-footer">每秒刷新 · 数据仅存于本地 · 快捷键 Ctrl+Shift+D</footer>
      </div>
    </div>
  );
}
