import { Component, ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** 可选：自定义降级提示（默认提供重试按钮） */
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

/** 盘面/页面渲染兜底：单处异常不拖垮整页 */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 记录详细错误信息到控制台，便于排查
    console.error("[ErrorBoundary] 渲染异常", error, info.componentStack);
  }

  /** 重置错误状态，允许用户重试 */
  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      // 允许外部传入自定义降级 UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="err-box" role="alert" aria-live="assertive">
          <div>盘面渲染异常：{String(this.state.error.message || this.state.error)}</div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            请调整参数或点击下方按钮重试；若持续异常请刷新页面。
          </div>
          <button
            type="button"
            className="btn-cancel"
            style={{ marginTop: 8 }}
            onClick={this.reset}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
