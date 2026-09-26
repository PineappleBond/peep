/**
 * Toast 通知系统
 *
 * 设计：
 * - 轻量发布/订阅：允许在非 React 上下文（异步回调、工具函数）触发通知
 * - 自动堆叠：多个通知同时出现时从右上往下叠放
 * - 类型：success（成功）/ error（失败）/ info（信息）/ warn（警告）
 * - 默认 3 秒后自动消失；error 类型 5 秒（给用户更多时间阅读）
 * - 支持手动关闭
 *
 * 使用：
 *   import { toast } from "../core/toast";
 *   toast.success("保存成功");
 *   toast.error("保存失败，请重试");
 *   toast.info("已为您切换到英文");
 *   toast.warn("夏令时期间请减 1 小时");
 */

/** 单条 Toast 数据结构 */
export type ToastItem = {
  id: number;
  type: "success" | "error" | "info" | "warn";
  message: string;
  /** 是否显示关闭按钮（始终允许手动关闭，此字段仅控制视觉呈现） */
  closable: boolean;
  /** 自动关闭时长（毫秒），0 表示不自动关闭 */
  duration: number;
};

/** 监听器类型 */
type Listener = (items: ToastItem[]) => void;

/** 当前 Toast 队列 */
let items: ToastItem[] = [];
/** 监听器集合 */
const listeners = new Set<Listener>();
/** id 生成器 */
let idSeq = 0;

/** 默认显示时长（毫秒） */
const DEFAULT_DURATION = 3000;
const ERROR_DURATION = 5000;

/** 通知所有监听器 */
function emit() {
  const snapshot = items.slice();
  for (const l of listeners) {
    try {
      l(snapshot);
    } catch (err) {
      console.error("[toast] 监听器异常", err);
    }
  }
}

/** 移除指定 id 的 Toast */
function remove(id: number) {
  items = items.filter(it => it.id !== id);
  emit();
}

/** 添加一条 Toast */
function add(type: ToastItem["type"], message: string, duration?: number): number {
  const id = ++idSeq;
  const dur = duration ?? (type === "error" ? ERROR_DURATION : DEFAULT_DURATION);
  const item: ToastItem = {
    id,
    type,
    message,
    closable: true,
    duration: dur,
  };
  // 新消息插入到队尾（视觉上位于顶部，通过 flex-direction: column-reverse 实现）
  items.push(item);
  emit();
  // 自动关闭
  if (dur > 0) {
    setTimeout(() => remove(id), dur);
  }
  return id;
}

/** 订阅 Toast 变化（React 组件内使用） */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 获取当前快照 */
export function getSnapshot(): ToastItem[] {
  return items.slice();
}

/** Toast API：对外暴露 */
export const toast = {
  success: (msg: string, duration?: number) => add("success", msg, duration),
  error: (msg: string, duration?: number) => add("error", msg, duration),
  info: (msg: string, duration?: number) => add("info", msg, duration),
  warn: (msg: string, duration?: number) => add("warn", msg, duration),
  /** 关闭指定 Toast；不传 id 则关闭全部 */
  dismiss: (id?: number) => {
    if (id === undefined) {
      items = [];
      emit();
    } else {
      remove(id);
    }
  },
};
