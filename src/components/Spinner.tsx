/**
 * 通用加载指示器
 *
 * 设计：
 * - 轻量 SVG 圆环旋转动画
 * - 支持三种尺寸：sm（行内）/ md（列表）/ lg（页面级）
 * - 可附带文字标签（aria-live polite，屏幕阅读器可读）
 * - 颜色跟随主题（--cyan 青蓝辉光）
 */

type SpinnerSize = "sm" | "md" | "lg";

type SpinnerProps = {
  /** 尺寸 */
  size?: SpinnerSize;
  /** 可访问标签（屏幕阅读器） */
  label?: string;
  /** 附加文字（显示在 spinner 下方） */
  text?: string;
  /** 自定义 class */
  className?: string;
};

const SIZE_MAP: Record<SpinnerSize, number> = {
  sm: 14,
  md: 22,
  lg: 36,
};

export function Spinner({ size = "md", label, text, className = "" }: SpinnerProps) {
  const px = SIZE_MAP[size];
  return (
    <span className={`spinner-wrap spinner-${size} ${className}`.trim()}>
      <svg
        className="spinner-ring"
        width={px}
        height={px}
        viewBox="0 0 24 24"
        role={label ? "status" : "presentation"}
        aria-label={label}
        aria-live={label ? "polite" : undefined}
      >
        <circle className="spinner-track" cx="12" cy="12" r="10" fill="none" strokeWidth="2.5" />
        <circle
          className="spinner-arc"
          cx="12"
          cy="12"
          r="10"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="31.4 31.4"
        />
      </svg>
      {text && <span className="spinner-text">{text}</span>}
    </span>
  );
}
