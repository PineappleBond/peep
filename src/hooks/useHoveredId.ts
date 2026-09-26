/**
 * 列表项 hover 状态管理 hook
 * 跟踪当前悬停的列表项 ID，用于控制操作按钮显示等交互
 *
 * 设计：
 * - 返回 [hoveredId, setHoveredId] 格式，与 useState 保持一致
 * - 泛型支持，可用于任意类型的 ID（number / string）
 */
import { useState } from "react";

/**
 * 列表项 hover 状态
 * @returns [hoveredId, setHoveredId]
 *   - hoveredId：当前悬停项的 ID，无悬停时为 null
 *   - setHoveredId：设置悬停项 ID
 */
export function useHoveredId<T extends number | string>(): [T | null, (id: T | null) => void] {
  const [hoveredId, setHoveredId] = useState<T | null>(null);
  return [hoveredId, setHoveredId];
}
