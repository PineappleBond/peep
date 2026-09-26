/**
 * Toast 宿主组件：渲染 Toast 通知队列
 *
 * 设计：
 * - 挂载在 Layout 内，全局唯一
 * - 右上角浮动定位，不影响页面布局
 * - 使用 useSyncExternalStore 订阅 toast 状态
 * - 每条 Toast 带有入场/离场动画
 * - 无障碍：
 *   - 宿主容器 role="status" + aria-live="polite"（普通通知不中断用户）
 *   - error 类型的 Toast 使用 role="alert"（立即播报）
 *   - info/success/warn 使用 role="status"（温和播报）
 */
import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot, toast, type ToastItem } from "../core/toast";
import { useI18n } from "../core/i18n";

/** 各类型对应的图标（纯文本，避免依赖图标库） */
const TYPE_ICON: Record<ToastItem["type"], string> = {
  success: "✓",
  error: "✕",
  info: "ⓘ",
  warn: "⚠",
};

export function ToastHost() {
  const items = useSyncExternalStore(subscribe, getSnapshot);
  const { t } = useI18n();

  if (items.length === 0) return null;

  return (
    <div className="toast-host" role="status" aria-live="polite" aria-atomic="false">
      {items.map(item => (
        <div
          key={item.id}
          className={`toast-item toast-${item.type}${item.dismissing ? " toast-out" : ""}`}
          role={item.type === "error" ? "alert" : "status"}
        >
          <span className="toast-icon" aria-hidden="true">
            {TYPE_ICON[item.type]}
          </span>
          <span className="toast-msg">{item.message}</span>
          {item.closable && (
            <button
              className="toast-close"
              onClick={() => toast.dismiss(item.id)}
              aria-label={t("common.close")}
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
