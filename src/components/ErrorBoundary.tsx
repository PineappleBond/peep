/**
 * 盘面/页面渲染兜底：单处异常不拖垮整页
 *
 * 安全要求：
 * - 仅展示通用错误提示，不向用户暴露 error.message 内部细节
 *   （原始消息可能包含内部路径、堆栈信息、依赖版本等）
 * - 详细错误仅输出到 console.error，供开发者排查
 *
 * 开发者体验改进（仅 DEV 环境）：
 * - 显示错误消息、组件栈摘要、发生时间
 * - 提供"复制错误"和"查看堆栈"按钮
 * - 在控制台输出结构化错误信息（便于搜索）
 */
import type { ReactNode } from "react";
import { Component } from "react";
import { t } from "../core/i18n";

type Props = {
  children: ReactNode;
  /** 可选：自定义降级 UI（仅接收 reset 回调，不暴露原始 Error 对象） */
  fallback?: (reset: () => void) => ReactNode;
};

/** 开发模式下展示的详细错误信息 */
type ErrorState = {
  error: Error | null;
  componentStack: string | null | undefined;
  timestamp: number;
};

export class ErrorBoundary extends Component<Props, ErrorState> {
  state: ErrorState = { error: null, componentStack: null, timestamp: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error, timestamp: Date.now() };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 详细错误仅输出到控制台，不暴露给 UI
    console.error("[ErrorBoundary] 渲染异常", error, info.componentStack);

    // 开发环境：输出结构化信息便于调试
    if (import.meta.env.DEV) {
      this.setState({ componentStack: info.componentStack });

      // 结构化输出：便于在 DevTools 中搜索和复制
      // eslint-disable-next-line no-console
      console.group("%c[ErrorBoundary] 渲染异常详情", "color:#f44336;font-weight:bold");
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
  }

  /** 重置错误状态，允许用户重试 */
  reset = () => {
    this.setState({ error: null, componentStack: null, timestamp: 0 });
  };

  /** 开发模式：复制错误信息到剪贴板 */
  copyError = () => {
    if (!this.state.error) return;
    const { error, componentStack, timestamp } = this.state;
    const text = [
      `错误: ${error.message}`,
      `类型: ${error.name}`,
      `时间: ${new Date(timestamp).toLocaleString()}`,
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
      // 允许外部传入自定义降级 UI（不传递 Error 对象，仅传递 reset 回调）
      if (this.props.fallback) {
        return this.props.fallback(this.reset);
      }

      // 开发模式：显示更详细的错误信息（带复制按钮）
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
            </div>
            <div style={{ marginBottom: 8, color: "#ff9800" }}>
              <strong>{t("errorBoundary.errorLabel")}</strong>
              {this.state.error.message}
            </div>
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
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
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
            </div>
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
              {t("errorBoundary.devHint")}
            </div>
          </div>
        );
      }

      // 生产模式：通用错误提示，不泄露内部信息
      return (
        <div className="err-box" role="alert" aria-live="assertive">
          {/* 通用提示文案，不泄露内部实现 */}
          <div>{t("errorBoundary.title")}</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>{t("errorBoundary.hint")}</div>
          <button
            type="button"
            className="btn-cancel"
            style={{ marginTop: 8 }}
            onClick={this.reset}
          >
            {t("errorBoundary.retry")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
