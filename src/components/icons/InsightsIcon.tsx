/**
 * 洞察图标 - 导航用（灯泡 + 闪光）
 */
import type { SVGAttributes } from "react";

export function InsightsIcon(props: SVGAttributes<SVGSVGElement>) {
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
      {/* 灯泡主体 */}
      <path
        d="M12 3C8.5 3 6 5.5 6 9c0 2 1 3.5 2.5 4.5V16c0 .5.5 1 1 1h5c.5 0 1-.5 1-1v-2.5C17 12.5 18 11 18 9c0-3.5-2.5-6-6-6z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* 灯座 */}
      <rect x="9" y="18" width="6" height="1.5" rx="0.5" fill="currentColor" />
      <rect x="10" y="20" width="4" height="1" rx="0.5" fill="currentColor" opacity="0.7" />
      {/* 闪光 */}
      <circle cx="19" cy="5" r="0.8" fill="currentColor" opacity="0.6" />
      <circle cx="5" cy="6" r="0.6" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
