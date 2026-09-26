/**
 * 大六壬图标 - 天地盘
 * 使用玄空霓虹主题色彩
 */
import type { SVGAttributes } from "react";

export function LiurenIcon(props: SVGAttributes<SVGSVGElement>) {
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
      {/* 地盘（外圈，固定） */}
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      {/* 天盘（内圈，旋转） */}
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.2" opacity="0.9" />
      {/* 十二地支方位标记（简化） */}
      <circle cx="12" cy="3" r="0.8" fill="currentColor" opacity="0.7" />
      <circle cx="19.5" cy="7.5" r="0.8" fill="currentColor" opacity="0.7" />
      <circle cx="21" cy="12" r="0.8" fill="currentColor" opacity="0.7" />
      <circle cx="19.5" cy="16.5" r="0.8" fill="currentColor" opacity="0.7" />
      <circle cx="12" cy="21" r="0.8" fill="currentColor" opacity="0.7" />
      <circle cx="4.5" cy="16.5" r="0.8" fill="currentColor" opacity="0.7" />
      <circle cx="3" cy="12" r="0.8" fill="currentColor" opacity="0.7" />
      <circle cx="4.5" cy="7.5" r="0.8" fill="currentColor" opacity="0.7" />
      {/* 中心点 */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      {/* 天地盘连线（表示旋转关系） */}
      <path
        d="M12 6 L12 3"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.5"
      />
      <path
        d="M12 18 L12 21"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.5"
      />
    </svg>
  );
}
