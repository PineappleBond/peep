/**
 * 知识库图标 - 展开书卷 / 多层文档
 * 使用 currentColor 适配主题，与 ZiweiIcon、LiurenIcon 风格一致
 */
import type { SVGAttributes } from "react";

export function WikiIcon(props: SVGAttributes<SVGSVGElement>) {
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
      {/* 后层文档（偏移，营造层次感） */}
      <rect
        x="6"
        y="3"
        width="13"
        height="16"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.35"
      />
      {/* 前层文档 */}
      <rect
        x="3"
        y="5"
        width="13"
        height="16"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.9"
      />
      {/* 文档内文字行（知识条目） */}
      <line x1="6" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="0.8" opacity="0.6" strokeLinecap="round" />
      <line x1="6" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.6" strokeLinecap="round" />
      <line x1="6" y1="15" x2="11" y2="15" stroke="currentColor" strokeWidth="0.8" opacity="0.6" strokeLinecap="round" />
      {/* 关联节点（实体关联概念） */}
      <circle cx="18" cy="17" r="2" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
      <circle cx="20" cy="12" r="1.2" fill="currentColor" opacity="0.5" />
      <path
        d="M18 15 L19.5 13"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.5"
      />
    </svg>
  );
}
