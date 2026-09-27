/**
 * 六爻图标 - 卦象符号（六条横线，阴阳爻）
 */
import type { SVGAttributes } from "react";

export function LiuyaoIcon(props: SVGAttributes<SVGSVGElement>) {
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
      {/* 六爻：从上到下，阳爻———，阴爻— — */}
      {/* 上爻（阳） */}
      <rect x="5" y="3" width="14" height="1.5" rx="0.5" fill="currentColor" opacity="0.9" />
      {/* 五爻（阴） */}
      <rect x="5" y="6.5" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.8" />
      <rect x="13" y="6.5" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.8" />
      {/* 四爻（阳） */}
      <rect x="5" y="10" width="14" height="1.5" rx="0.5" fill="currentColor" opacity="0.9" />
      {/* 三爻（阴） */}
      <rect x="5" y="13.5" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.8" />
      <rect x="13" y="13.5" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.8" />
      {/* 二爻（阳） */}
      <rect x="5" y="17" width="14" height="1.5" rx="0.5" fill="currentColor" opacity="0.9" />
      {/* 初爻（阴） */}
      <rect x="5" y="20.5" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.8" />
      <rect x="13" y="20.5" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.8" />
      {/* 动爻标记（小圆点） */}
      <circle cx="20" cy="14.25" r="1" fill="currentColor" />
    </svg>
  );
}
