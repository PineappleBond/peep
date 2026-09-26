/**
 * 通用模态弹窗：遮罩 + 面板 + 标题 + 关闭
 * 视觉风格匹配项目主题（深空黑蓝底、青蓝辉光、backdrop blur）
 *
 * 无障碍支持：
 * - role="dialog" + aria-modal="true"（屏幕阅读器识别为模态对话框）
 * - aria-labelledby 关联标题
 * - 焦点陷阱（Tab/Shift+Tab 不会逃逸到弹窗背后）
 * - Escape 关闭
 * - 关闭后焦点返回触发元素
 *
 * 动画支持：
 * - 入场/离场均使用 CSS animation（GPU 加速的 transform + opacity）
 * - 关闭时先播放离场动画（0.25s），再卸载 DOM
 */
import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useI18n } from "../core/i18n";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 面板宽度，默认 480px */
  width?: number;
  /** 底部按钮区（可选） */
  footer?: ReactNode;
};

/** 标题 id 生成器（确保 aria-labelledby 唯一） */
let dialogCounter = 0;

/** 离场动画时长（毫秒），与 CSS --dur-component 保持一致 */
const CLOSE_DURATION = 250;

export function Dialog({ open, onClose, title, children, width = 480, footer }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useRef(`dlg-title-${++dialogCounter}`);
  const { t } = useI18n();

  /* 离场动画状态：true 表示正在播放离场动画 */
  const [isClosing, setIsClosing] = useState(false);
  /* 是否在 DOM 中渲染（入场时 true，离场动画结束后 false） */
  const [mounted, setMounted] = useState(false);

  /* 监听 open 变化：打开时挂载，关闭时先播离场动画再卸载 */
  useEffect(() => {
    if (open) {
      setMounted(true);
      setIsClosing(false);
    } else if (mounted) {
      /* 触发离场动画 */
      setIsClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setIsClosing(false);
      }, CLOSE_DURATION);
      return () => clearTimeout(timer);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 包装 onClose：先触发动画，动画结束后由父级处理 open 状态变化 */
  const handleClose = useCallback(() => {
    if (isClosing) return;
    onClose();
  }, [isClosing, onClose]);

  /* 记录触发弹窗的元素，关闭后恢复焦点 */
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
    }
  }, [open]);

  /* 打开弹窗后自动聚焦到面板（面板 tabIndex=-1 使其可聚焦） */
  useEffect(() => {
    if (open && panelRef.current) {
      // 延迟一帧确保 DOM 已渲染
      requestAnimationFrame(() => {
        // 优先聚焦面板内的第一个可交互元素
        const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          panelRef.current?.focus();
        }
      });
    }
  }, [open]);

  /* 关闭后焦点返回触发元素 */
  useEffect(() => {
    if (!open && triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  /* Escape 关闭 + 焦点陷阱 */
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }

      /* 焦点陷阱：Tab 循环限制在弹窗内 */
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === panelRef.current) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, handleClose]);

  /* 离场动画中或未挂载时不渲染 */
  if (!mounted) return null;

  return (
    <div className={`dlg-mask${isClosing ? " closing" : ""}`} onClick={handleClose}>
      <div
        ref={panelRef}
        className="dlg-panel"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className="dlg-head">
          <h2 className="dlg-title" id={titleId.current}>
            {title}
          </h2>
          <button className="dlg-close" onClick={handleClose} aria-label={t("dialog.close")}>
            ✕
          </button>
        </div>
        <div className="dlg-body">{children}</div>
        {footer && <div className="dlg-foot">{footer}</div>}
      </div>
    </div>
  );
}
