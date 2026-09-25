/**
 * 全局事件发射器 - 用于跨组件通信
 * 主要用于 Layout 与页面组件之间的人物选择状态同步
 */
type Listener = (...args: any[]) => void;

class EventEmitter {
  private listeners: Map<string, Set<Listener>> = new Map();

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((listener) => listener(...args));
  }
}

export const globalEvents = new EventEmitter();
