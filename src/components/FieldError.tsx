/**
 * 字段级错误提示组件
 *
 * 在表单字段下方显示错误信息。仅当 shouldShow 为 true 时渲染，
 * 配合 useFormValidation 的 shouldShowError 使用。
 */
import type { ReactNode } from "react";

interface FieldErrorProps {
  /** 是否显示错误 */
  shouldShow: boolean;
  /** 错误信息（已翻译的文本） */
  message?: string | null;
  /** 自定义 className */
  className?: string;
}

/**
 * 字段错误提示
 *
 * - shouldShow=false 时不渲染任何内容（不占空间）
 * - shouldShow=true 且 message 有值时显示错误文字
 * - role="alert" 方便屏幕阅读器读取
 */
export function FieldError({ shouldShow, message, className = "" }: FieldErrorProps): ReactNode {
  if (!shouldShow || !message) return null;
  return (
    <span className={`field-error ${className}`} role="alert">
      {message}
    </span>
  );
}
