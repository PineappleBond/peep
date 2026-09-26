/**
 * 通用事件监听器 hook
 * 封装 addEventListener/removeEventListener 的注册和清理
 *
 * 设计：
 * - 自动处理组件卸载时的清理
 * - 支持通过 enabled 参数动态启用/禁用
 * - handler 使用 useRef 保持最新引用，避免闭包陷阱
 */
import { useEffect, useRef } from "react";

/**
 * 通用事件监听器
 * @param eventName 事件名称（如 "mousedown"、"keydown"）
 * @param handler 事件处理函数
 * @param element 目标元素（默认 document）
 * @param enabled 是否启用监听（默认 true）
 */
export function useEventListener<K extends keyof DocumentEventMap>(
  eventName: K,
  handler: (event: DocumentEventMap[K]) => void,
  element: Document | Window | HTMLElement | null = document,
  enabled = true,
): void {
  // 用 ref 保持 handler 最新引用，避免 useEffect 依赖变化
  const savedHandler = useRef(handler);
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled || !element) return;

    const eventListener = (event: Event) => {
      savedHandler.current(event as DocumentEventMap[K]);
    };
    element.addEventListener(eventName, eventListener);

    return () => {
      element.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element, enabled]);
}
