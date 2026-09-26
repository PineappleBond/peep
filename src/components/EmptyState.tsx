/**
 * 通用空状态组件
 * 用于列表、页面等场景的占位提示
 *
 * 设计：
 * - 图标 + 标题 + 描述的经典布局
 * - 支持自定义 className 适配不同场景
 * - 图标使用 emoji 或文字，避免额外依赖
 */
import type { ReactNode } from "react";

interface EmptyStateProps {
  /** 图标（emoji 或文字） */
  icon: ReactNode;
  /** 标题 */
  title: string;
  /** 描述（可选） */
  description?: string;
  /** 自定义 className */
  className?: string;
}

/**
 * 空状态组件
 *
 * - icon/title 必填，description 可选
 * - 使用 flex 列布局，居中对齐
 */
export function EmptyState({ icon, title, description, className = "" }: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      <div className="empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
    </div>
  );
}
