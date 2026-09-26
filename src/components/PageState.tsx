/**
 * 页面级加载/错误状态组件
 * 统一 DaLiuRenPage、WikiPage 等页面的初始化和错误展示
 *
 * 设计：
 * - 封装页面级的 loading spinner 和 error alert
 * - 使用 role="status" / role="alert" 确保无障碍
 * - 支持自定义页面容器 className
 */
import type { ReactNode } from "react";
import { Spinner } from "./Spinner";
import { useI18n } from "../core/i18n";

interface PageStateProps {
  /** 当前人物是否加载完成（false 时展示 loading） */
  ready: boolean;
  /** 初始化错误信息（非 null 时展示 error） */
  error: string | null;
  /** 加载中的提示文本 */
  loadingText?: string;
  /** 页面容器 className */
  className?: string;
  /** 子组件（ready && !error 时渲染） */
  children: ReactNode;
}

/**
 * 页面状态容器
 *
 * - ready=false 且 error=null：展示 loading spinner
 * - error 非 null：展示错误提示
 * - ready=true 且 error=null：渲染 children
 *
 * 优先级：error > loading > children
 */
export function PageState({ ready, error, loadingText, className = "", children }: PageStateProps) {
  const { t } = useI18n();

  // 错误状态
  if (error) {
    return (
      <div className={className}>
        <div className="err-box" role="alert">
          {error}
        </div>
      </div>
    );
  }

  // 加载状态
  if (!ready) {
    return (
      <div className={className}>
        <div className="page-loading" role="status" aria-live="polite">
          <Spinner size="md" text={loadingText ?? t("common.loading")} />
        </div>
      </div>
    );
  }

  // 正常渲染
  return <>{children}</>;
}
