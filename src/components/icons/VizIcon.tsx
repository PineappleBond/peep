/**
 * 可视化图标 - 导航用（柱状图+折线）
 */
import type { SVGAttributes } from "react";

export function VizIcon(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      {...props}
    >
      {/* 柱状图 + 折线 */}
      <rect x="3" y="12" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.6" />
      <rect x="8" y="8" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.8" />
      <rect x="13" y="4" width="3" height="16" rx="0.5" fill="currentColor" />
      <path
        d="M3 14 L8 10 L13 6 L18 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="3" cy="14" r="1.5" fill="currentColor" />
      <circle cx="8" cy="10" r="1.5" fill="currentColor" />
      <circle cx="13" cy="6" r="1.5" fill="currentColor" />
      <circle cx="18" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}
