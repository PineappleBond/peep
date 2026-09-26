/**
 * useFocusTrap - 焦点陷阱自定义 hook
 *
 * 将焦点限制在指定容器内（Tab/Shift+Tab 循环），
 * 支持自动聚焦首个可交互元素，符合 WCAG 2.1 模态对话框要求。
 *
 * 使用场景：Dialog、ShortcutHelp、PalaceDetail 等模态弹层
 */
import { useEffect, useRef } from "react";

/** 可聚焦元素选择器（符合 WCAG 标准） */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 焦点陷阱 hook
 * @param active - 是否激活焦点陷阱
 * @param options - 配置项
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  options: {
    /** 是否自动聚焦容器内第一个可交互元素（默认 true） */
    autoFocus?: boolean;
    /** 关闭时焦点返回的触发元素（默认记录 document.activeElement） */
    returnFocus?: boolean;
  } = {},
): React.RefObject<T> {
  const { autoFocus = true, returnFocus = true } = options;
  const ref = useRef<T>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // 记录触发弹窗的元素，关闭后恢复焦点
  useEffect(() => {
    if (active && returnFocus) {
      triggerRef.current = document.activeElement as HTMLElement;
    }
  }, [active, returnFocus]);

  // 打开后自动聚焦容器内第一个可交互元素
  useEffect(() => {
    if (!active || !autoFocus || !ref.current) return;
    requestAnimationFrame(() => {
      const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (first) {
        first.focus();
      } else {
        ref.current?.focus();
      }
    });
  }, [active, autoFocus]);

  // 关闭后焦点返回触发元素
  useEffect(() => {
    if (!active && returnFocus && triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [active, returnFocus]);

  // 焦点陷阱：Tab/Shift+Tab 在容器内循环
  useEffect(() => {
    if (!active || !ref.current) return;
    const container = ref.current;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable: HTMLElement[] = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el: HTMLElement) => el.offsetParent !== null); // 仅可见元素
      if (focusable.length === 0) return;
      const first: HTMLElement = focusable[0];
      const last: HTMLElement = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === container) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [active]);

  return ref;
}
