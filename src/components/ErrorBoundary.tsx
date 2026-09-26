/**
 * 盘面/页面渲染兜底：单处异常不拖垮整页
 *
 * 安全要求：
 * - 仅展示通用错误提示，不向用户暴露 error.message 内部细节
 *   （原始消息可能包含内部路径、堆栈信息、依赖版本等）
 * - 详细错误仅输出到 console.error，供开发者排查
 */
import { Component, ReactNode } from "react";
import { t } from "../core/i18n";

type Props = {
  children: ReactNode;
  /** 可选：自定义降级 UI（仅接收 reset 回调，不暴露原始 Error 对象） */
  fallback?: (reset: () => void) => ReactNode;
};

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 详细错误仅输出到控制台，不暴露给 UI
    console.error("[ErrorBoundary] 渲染异常", error, info.componentStack);
  }

  /** 重置错误状态，允许用户重试 */
  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      // 允许外部传入自定义降级 UI（不传递 Error 对象，仅传递 reset 回调）
      if (this.props.fallback) {
        return this.props.fallback(this.reset);
      }
      return (
        <div className="err-box" role="alert" aria-live="assertive">
          {/* 通用提示文案，不泄露内部实现 */}
          <div>{t("errorBoundary.title")}</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            {t("errorBoundary.hint")}
          </div>
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
