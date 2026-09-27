/**
 * 错误边界——细粒度的 React 渲染错误捕获与自动恢复
 *
 * 安全要求：
 * - 生产环境：仅展示通用错误提示，不向用户暴露 error.message 内部细节
 *   （原始消息可能包含内部路径、堆栈信息、依赖版本等）
 * - 详细错误仅输出到 console.error / errorTracking，供开发者排查
 *
 * 核心改进（相比初版）：
 * - 自动重试：捕获错误后自动尝试 reset 并重新渲染（最多 maxAutoRetries 次）
 * - 错误标识：name 属性标识边界来源，错误报告中包含该信息
 * - 集成 errorTracking：错误自动进入错误监控系统
 * - 自动重置：路由切换时自动清理错误状态（配合 useLocation）
 * - 报告错误：生产环境也提供"报告错误"按钮（复制 JSON 格式错误信息）
 * - 错误上下文：自动收集 URL / User-Agent / 组件名等信息
 *
 * 开发者体验改进（仅 DEV 环境）：
 * - 显示错误消息、组件栈摘要、发生时间、重试次数
 * - 提供"复制错误"和"查看堆栈"按钮
 * - 在控制台输出结构化错误信息（便于搜索）
 */
import type { ReactNode } from "react";
import { Component } from "react";
import { t } from "../core/i18n";
import { reportError } from "../core/errorTracking";

type Props = {
  children: ReactNode;
  /** 边界名称——用于错误报告标识（如 "ZiweiPage"、"DaLiuRenPage"、"Layout.Dialogs"） */
  name?: string;
  /** 可选：自定义降级 UI（仅接收 reset 回调，不暴露原始 Error 对象） */
  fallback?: (reset: () => void, errorInfo: ErrorReportInfo) => ReactNode;
  /** 自动重试的最大次数（捕获错误后自动 reset 并重新渲染），默认 0 表示不自动重试 */
  maxAutoRetries?: number;
  /** 错误发生回调（仅用于监控，不能阻止错误边界捕获） */
  onError?: (error: Error, info: React.ErrorInfo, context: ErrorReportInfo) => void;
};

/** 错误报告信息（供 fallback 和 onError 使用，不含原始 Error） */
export type ErrorReportInfo = {
  /** 错误名称（ErrorBoundary 的 name 属性） */
  boundaryName: string;
  /** 错误消息（DEV 模式才有详情） */
  safeMessage: string;
  /** 发生时间戳 */
  timestamp: number;
  /** 自动重试次数 */
  retryCount: number;
};

/** 开发模式下展示的详细错误信息 */
type ErrorState = {
  error: Error | null;
  componentStack: string | null | undefined;
  timestamp: number;
  /** 已执行的自动重试次数 */
  autoRetryCount: number;
};

/** 自动重试的最大次数默认值 */
const DEFAULT_MAX_AUTO_RETRIES = 0;

/**
 * 自动重试的延迟间隔（毫秒）
 * 采用指数退避：100ms, 300ms, 900ms...
 */
function getAutoRetryDelay(attempt: number): number {
  return Math.min(100 * Math.pow(3, attempt), 2000);
}

/**
 * 生成错误报告的 JSON 字符串——用于"报告错误"按钮
 * 仅包含安全信息，不泄露敏感数据
 */
function buildErrorReport(
  error: Error | null,
  componentStack: string | null | undefined,
  boundaryName: string,
  timestamp: number,
  autoRetryCount: number,
): string {
  const report = {
    boundary: boundaryName || "Unknown",
    error: error
      ? {
          name: error.name,
          message: import.meta.env.DEV ? error.message : "[生产环境已隐藏]",
          stack: import.meta.env.DEV ? error.stack : undefined,
        }
      : null,
    componentStack: import.meta.env.DEV ? componentStack : undefined,
    timestamp: new Date(timestamp).toISOString(),
    url: typeof location !== "undefined" ? location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    autoRetries: autoRetryCount,
    appVersion: typeof __PEEP_VERSION__ !== "undefined" ? String(__PEEP_VERSION__) : undefined,
  };
  // 移除 undefined 字段
  return JSON.stringify(report, null, 2);
}

export class ErrorBoundary extends Component<Props, ErrorState> {
  state: ErrorState = {
    error: null,
    componentStack: null,
    timestamp: 0,
    autoRetryCount: 0,
  };

  /** 自动重试定时器引用（用于卸载时清理） */
  private _autoRetryTimer: ReturnType<typeof setTimeout> | null = null;
  /** 组件是否已卸载（防止 setState on unmounted component） */
  private _unmounted = false;

  static getDerivedStateFromError(error: Error) {
    return { error, timestamp: Date.now() };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const boundaryName = this.props.name || "ErrorBoundary";

    // 1. 控制台输出（结构化，便于搜索）

    console.error(`[${boundaryName}] 渲染异常`, error, info.componentStack);

    // 2. 集成错误监控：上报到 errorTracking 系统
    reportError(error, boundaryName);

    // 3. 调用外部 onError 回调（自定义监控）
    const safeMessage = import.meta.env.DEV ? error.message : `${boundaryName} 渲染异常`;
    const errorInfo: ErrorReportInfo = {
      boundaryName,
      safeMessage,
      timestamp: this.state.timestamp || Date.now(),
      retryCount: this.state.autoRetryCount,
    };
    this.props.onError?.(error, info, errorInfo);

    // 4. 开发环境：输出结构化详情并保存组件栈
    if (import.meta.env.DEV) {
      this.setState({ componentStack: info.componentStack });

      // eslint-disable-next-line no-console
      console.group(`%c[${boundaryName}] 渲染异常详情`, "color:#f44336;font-weight:bold");
      // eslint-disable-next-line no-console
      console.log("%c错误消息:", "color:#ff9800;font-weight:bold", error.message);
      // eslint-disable-next-line no-console
      console.log("%c错误类型:", "color:#ff9800;font-weight:bold", error.name);
      // eslint-disable-next-line no-console
      console.log("%c发生时间:", "color:#ff9800;font-weight:bold", new Date().toLocaleString());
      if (info.componentStack) {
        // eslint-disable-next-line no-console
        console.log("%c组件栈:", "color:#ff9800;font-weight:bold", info.componentStack);
      }
      // eslint-disable-next-line no-console
      console.log(
        "%c建议:",
        "color:#2196f3;font-weight:bold",
        "1. 检查上方堆栈定位出错组件  2. 尝试点击「重试」按钮  3. 查看浏览器控制台完整错误",
      );
      // eslint-disable-next-line no-console
      console.groupEnd();
    }

    // 5. 自动重试机制：捕获错误后自动 reset，尝试重新渲染
    this.scheduleAutoRetry();
  }

  componentDidMount() {
    // 路由切换时自动重置错误状态（避免一个页面的错误卡住另一个页面）
    this._setupRouteResetListener();
  }

  componentWillUnmount() {
    this._unmounted = true;
    if (this._autoRetryTimer) {
      clearTimeout(this._autoRetryTimer);
      this._autoRetryTimer = null;
    }
    this._removeRouteResetListener();
  }

  /** hashchange 监听器引用（用于卸载时清理） */
  private _routeResetHandler: (() => void) | null = null;

  /** 监听路由变化：路由切换时自动重置错误状态 */
  private _setupRouteResetListener() {
    if (typeof window === "undefined") return;
    this._routeResetHandler = () => {
      // 仅当处于错误状态时才重置（避免不必要的 setState）
      if (this.state.error && !this._unmounted) {
        if (import.meta.env.DEV) {
          console.log(
            `%c[${this.props.name || "ErrorBoundary"}]%c 路由切换，自动重置错误状态`,
            "color:#2196f3",
            "",
          );
        }
        this.reset();
      }
    };
    window.addEventListener("popstate", this._routeResetHandler);
    window.addEventListener("hashchange", this._routeResetHandler);
  }

  /** 移除路由监听 */
  private _removeRouteResetListener() {
    if (typeof window === "undefined" || !this._routeResetHandler) return;
    window.removeEventListener("popstate", this._routeResetHandler);
    window.removeEventListener("hashchange", this._routeResetHandler);
    this._routeResetHandler = null;
  }

  /**
   * 自动重试：捕获错误后延迟一段时间自动 reset，触发重新渲染
   * 采用指数退避策略，最多 maxAutoRetries 次
   */
  private scheduleAutoRetry() {
    const maxRetries = this.props.maxAutoRetries ?? DEFAULT_MAX_AUTO_RETRIES;
    const currentRetryCount = this.state.autoRetryCount;

    if (currentRetryCount >= maxRetries) {
      // 已达最大自动重试次数，停止重试
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log(
          `%c[${this.props.name || "ErrorBoundary"}]%c 已达最大自动重试次数 (${maxRetries})，停止自动重试`,
          "color:#ff9800",
          "",
        );
      }
      return;
    }

    const delay = getAutoRetryDelay(currentRetryCount);

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(
        `%c[${this.props.name || "ErrorBoundary"}]%c ${delay}ms 后将自动重试（${currentRetryCount + 1}/${maxRetries}）`,
        "color:#ff9800",
        "",
      );
    }

    this._autoRetryTimer = setTimeout(() => {
      this._autoRetryTimer = null;
      if (!this._unmounted) {
        this.setState(state => ({
          error: null,
          componentStack: null,
          timestamp: 0,
          autoRetryCount: state.autoRetryCount + 1,
        }));
      }
    }, delay);
  }

  /** 重置错误状态，允许用户重试 */
  reset = () => {
    if (this._autoRetryTimer) {
      clearTimeout(this._autoRetryTimer);
      this._autoRetryTimer = null;
    }
    if (!this._unmounted) {
      this.setState({
        error: null,
        componentStack: null,
        timestamp: 0,
        autoRetryCount: 0,
      });
    }
  };

  /** 复制错误报告到剪贴板（生产/开发都可用） */
  copyErrorReport = () => {
    const { error, componentStack, timestamp, autoRetryCount } = this.state;
    const boundaryName = this.props.name || "ErrorBoundary";

    const report = buildErrorReport(error, componentStack, boundaryName, timestamp, autoRetryCount);

    navigator.clipboard
      .writeText(report)
      .then(() => {
        // eslint-disable-next-line no-console
        console.log(
          `%c[${boundaryName}]%c 错误报告已复制到剪贴板`,
          "color:#4caf50;font-weight:bold",
          "",
        );
      })
      .catch(err => {
        console.error(`[${boundaryName}] 复制失败`, err);
      });
  };

  /** 开发模式专用：复制纯文本错误（包含完整堆栈） */
  copyError = () => {
    if (!this.state.error) return;
    const { error, componentStack, timestamp } = this.state;
    const text = [
      `边界: ${this.props.name || "ErrorBoundary"}`,
      `错误: ${error.message}`,
      `类型: ${error.name}`,
      `时间: ${new Date(timestamp).toLocaleString()}`,
      `自动重试次数: ${this.state.autoRetryCount}`,
      componentStack ? `组件栈:\n${componentStack}` : "",
      error.stack ? `堆栈:\n${error.stack}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    navigator.clipboard
      .writeText(text)
      .then(() => {
        // eslint-disable-next-line no-console
        console.log("%c[ErrorBoundary] 错误信息已复制到剪贴板", "color:#4caf50");
      })
      .catch(err => {
        console.error("[ErrorBoundary] 复制失败", err);
      });
  };

  render() {
    if (this.state.error) {
      const boundaryName = this.props.name || "ErrorBoundary";
      const errorInfo: ErrorReportInfo = {
        boundaryName,
        safeMessage: import.meta.env.DEV ? this.state.error.message : `${boundaryName} 渲染异常`,
        timestamp: this.state.timestamp,
        retryCount: this.state.autoRetryCount,
      };

      // 允许外部传入自定义降级 UI
      if (this.props.fallback) {
        return this.props.fallback(this.reset, errorInfo);
      }

      // 自动重试中提示（不显示完整错误界面）
      const maxRetries = this.props.maxAutoRetries ?? DEFAULT_MAX_AUTO_RETRIES;
      const isAutoRetrying =
        maxRetries > 0 && this.state.autoRetryCount < maxRetries && this.state.autoRetryCount > 0;

      // 开发模式：显示详细的错误信息
      if (import.meta.env.DEV) {
        return (
          <div
            className="err-box"
            role="alert"
            aria-live="assertive"
            style={{
              padding: 16,
              border: "1px solid #f44336",
              borderRadius: 8,
              backgroundColor: "rgba(244, 67, 54, 0.05)",
              maxWidth: 600,
              margin: "20px auto",
              fontFamily: "monospace",
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: "bold", color: "#f44336", marginBottom: 8 }}>
              {t("errorBoundary.devTitle")}
              {boundaryName !== "ErrorBoundary" && (
                <span style={{ opacity: 0.7, fontWeight: "normal", marginLeft: 8 }}>
                  [{boundaryName}]
                </span>
              )}
            </div>
            <div style={{ marginBottom: 8, color: "#ff9800" }}>
              <strong>{t("errorBoundary.errorLabel")}</strong>
              {this.state.error.message}
            </div>
            {isAutoRetrying && (
              <div
                style={{
                  marginBottom: 8,
                  color: "#2196f3",
                  fontSize: 12,
                  padding: "4px 8px",
                  backgroundColor: "rgba(33, 150, 243, 0.1)",
                  borderRadius: 4,
                }}
              >
                {t("errorBoundary.autoRetrying", {
                  current: String(this.state.autoRetryCount),
                  max: String(maxRetries),
                })}
              </div>
            )}
            {this.state.componentStack && (
              <details style={{ marginBottom: 8 }}>
                <summary style={{ cursor: "pointer", color: "#2196f3" }}>
                  {t("errorBoundary.viewStack")}
                </summary>
                <pre
                  style={{
                    marginTop: 8,
                    padding: 8,
                    backgroundColor: "rgba(0,0,0,0.05)",
                    borderRadius: 4,
                    overflow: "auto",
                    maxHeight: 200,
                    fontSize: 11,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {this.state.componentStack}
                </pre>
              </details>
            )}
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>
              {t("errorBoundary.occurredAt")}
              {new Date(this.state.timestamp).toLocaleString()}
              {this.state.autoRetryCount > 0 && ` · 自动重试 ${this.state.autoRetryCount} 次`}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" className="btn-cancel" onClick={this.reset}>
                {t("errorBoundary.retry")}
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={this.copyError}
                title={t("errorBoundary.copyErrorTitle")}
              >
                {t("errorBoundary.copyError")}
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={this.copyErrorReport}
                title={t("errorBoundary.reportErrorTitle")}
              >
                {t("errorBoundary.reportError")}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
              {t("errorBoundary.devHint")}
            </div>
          </div>
        );
      }

      // 生产模式：通用错误提示 + 报告错误按钮
      return (
        <div className="err-box" role="alert" aria-live="assertive">
          {/* 通用提示文案，不泄露内部实现 */}
          <div style={{ fontWeight: 500 }}>{t("errorBoundary.title")}</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>{t("errorBoundary.hint")}</div>
          {this.state.autoRetryCount > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>
              {t("errorBoundary.autoRetried", { count: String(this.state.autoRetryCount) })}
            </div>
          )}
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button type="button" className="btn-cancel" onClick={this.reset}>
              {t("errorBoundary.retry")}
            </button>
            <button
              type="button"
              className="btn-cancel"
              onClick={this.copyErrorReport}
              title={t("errorBoundary.reportErrorTitle")}
            >
              {t("errorBoundary.reportError")}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
