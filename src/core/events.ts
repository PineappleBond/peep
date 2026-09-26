/**
 * 全局事件发射器 - 用于跨组件通信
 * 主要用于 Layout 与页面组件之间的人物选择状态同步
 *
 * 使用类型安全的事件映射，避免 any 类型。
 */
import type { Person } from "./personDb";

/** 事件名称 → 参数签名映射 */
interface EventMap {
  "person.changed": (person: Person) => void;
}

type EventName = keyof EventMap;
type Listener<E extends EventName> = EventMap[E];

class EventEmitter {
  private listeners = new Map<EventName, Set<(...args: unknown[]) => void>>();

  on<E extends EventName>(event: E, listener: Listener<E>) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as (...args: unknown[]) => void);
  }

  off<E extends EventName>(event: E, listener: Listener<E>) {
    this.listeners.get(event)?.delete(listener as (...args: unknown[]) => void);
  }

  emit<E extends EventName>(event: E, ...args: Parameters<EventMap[E]>) {
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (err) {
        // 单个监听器失败不影响其他监听器执行
        console.error(`[events] 事件 "${event}" 监听器执行失败`, err);
      }
    });
  }
}

export const globalEvents = new EventEmitter();
