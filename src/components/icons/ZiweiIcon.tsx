/**
 * 紫微斗数图标 - 北斗七星
 * 使用玄空霓虹主题色彩
 */
import type { SVGAttributes } from "react";

export function ZiweiIcon(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="紫微斗数"
      {...props}
    >
      {/* 北斗七星 - 简化版 */}
      <circle cx="5" cy="8" r="1.2" fill="currentColor" opacity="0.9" />
      <circle cx="8" cy="6" r="1.2" fill="currentColor" opacity="0.9" />
      <circle cx="11" cy="7" r="1.2" fill="currentColor" opacity="0.9" />
      <circle cx="13" cy="10" r="1.2" fill="currentColor" opacity="0.9" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" opacity="0.9" />
      <circle cx="17" cy="16" r="1.2" fill="currentColor" opacity="0.9" />
      <circle cx="19" cy="18" r="1.2" fill="currentColor" opacity="0.9" />
      {/* 连接线 */}
      <path
        d="M5 8 L8 6 L11 7 L13 10 L15 13 L17 16 L19 18"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* 紫微星（中心大星） */}
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
    </svg>
  );
}
