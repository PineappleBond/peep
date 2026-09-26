/**
 * 插件系统核心 —— PluginManager
 *
 * 单例实现，负责：
 * - 注册/注销插件
 * - 生命周期调度（install/enable/disable/uninstall）
 * - 维护扩展点聚合视图（menus / routes / slot components）
 * - 提供 React 订阅机制（usePluginSystem）
 *
 * 轻量级设计：
 * - 插件以 TypeScript 模块形式静态注册（非动态代码加载），
 *   构建时受 tsc 类型检查，无运行时沙箱开销
 * - 前端环境天然沙箱（无文件/网络特权），权限控制交给浏览器
 * - 事件系统与宿主 globalEvents 解耦，使用命名空间避免冲突
 */
import { useCallback, useSyncExternalStore } from "react";
import type {
  ComponentSlot,
  ComponentExtension,
  MenuExtension,
  Plugin,
  PluginContext,
  PluginEventBus,
  PluginExtensionsView,
  PluginManifest,
  PluginRecord,
  PluginStorage,
  PluginStatus,
  PluginSystemSnapshot,
  RouteExtension,
} from "./pluginTypes";
import { createEmptyExtensionsView } from "./pluginTypes";
import { toast } from "./toast";

/** localStorage 插件存储键前缀 */
const STORAGE_PREFIX = "zwds-plugin:";

/**
 * 内部：全局事件总线（跨插件通信）
 * 使用简单的 Map<event, Set<listener>> 实现，与宿主 globalEvents 同构但独立
 */
class GlobalEventBus {
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  on(event: string, listener: (...args: unknown[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: (...args: unknown[]) => void) {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, ...args: unknown[]) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach(fn => {
      try {
        fn(...args);
      } catch (err) {
        console.error(`[plugin] 全局事件 "${event}" 监听器失败`, err);
      }
    });
  }
}

const globalBus = new GlobalEventBus();

/**
 * 构造插件专属存储（基于 localStorage，按 id 隔离）
 */
function createStorage(pluginId: string): PluginStorage {
  const prefix = `${STORAGE_PREFIX}${pluginId}:`;
  return {
    get<T>(key: string, fallback?: T): T | undefined {
      try {
        const raw = localStorage.getItem(prefix + key);
        if (raw == null) return fallback;
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    set<T>(key: string, value: T): void {
      try {
        localStorage.setItem(prefix + key, JSON.stringify(value));
      } catch (err) {
        console.warn(`[plugin:${pluginId}] storage.set 失败`, err);
      }
    },
    remove(key: string): void {
      try {
        localStorage.removeItem(prefix + key);
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * 构造插件专属事件总线（命名空间化）
 */
function createEventBus(pluginId: string): PluginEventBus {
  const nsListeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const nsEmit = (event: string, ...args: unknown[]) => {
    const set = nsListeners.get(event);
    if (!set) return;
    set.forEach(fn => {
      try {
        fn(...args);
      } catch (err) {
        console.error(`[plugin:${pluginId}] 事件 "${event}" 监听器失败`, err);
      }
    });
  };
  return {
    emit(event: string, ...args: unknown[]) {
      // 同时触发命名空间事件与全局事件（带 pluginId 前缀的全局事件）
      nsEmit(event, ...args);
      globalBus.emit(`${pluginId}:${event}`, ...args);
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      if (!nsListeners.has(event)) nsListeners.set(event, new Set());
      nsListeners.get(event)!.add(listener);
    },
    off(event: string, listener: (...args: unknown[]) => void) {
      nsListeners.get(event)?.delete(listener);
    },
    onGlobal(event: string, listener: (...args: unknown[]) => void) {
      globalBus.on(event, listener);
    },
    offGlobal(event: string, listener: (...args: unknown[]) => void) {
      globalBus.off(event, listener);
    },
  };
}

/**
 * 插件管理器单例
 */
class PluginManagerImpl {
  private plugins = new Map<string, PluginRecord>();
  /** 外部订阅者（useSyncExternalStore） */
  private listeners = new Set<() => void>();
  /** 缓存的快照，避免每次渲染都重新计算 */
  private snapshotCache: PluginSystemSnapshot | null = null;

  /**
   * 注册插件（不立即安装）
   * 重复注册同一 id 会抛出错误
   */
  register(plugin: Plugin): void {
    const id = plugin.manifest.id;
    if (!id) {
      throw new Error("[plugin] 插件缺少 id");
    }
    if (this.plugins.has(id)) {
      throw new Error(`[plugin] 插件 "${id}" 已注册`);
    }
    const ctx = this.buildContext(plugin.manifest);
    const record: PluginRecord = {
      manifest: plugin.manifest,
      status: "installed",
      plugin,
      ctx,
      menus: [...(plugin.menus ?? [])],
      routes: [...(plugin.routes ?? [])],
      components: [...(plugin.components ?? [])],
      installed: false,
    };
    this.plugins.set(id, record);
    this.invalidate();
  }

  /**
   * 卸载插件
   */
  async unregister(pluginId: string): Promise<void> {
    const record = this.plugins.get(pluginId);
    if (!record) return;
    try {
      if (record.status === "enabled") await this.disable(pluginId);
      if (record.installed) {
        await record.plugin.uninstall?.();
      }
    } catch (err) {
      console.error(`[plugin:${pluginId}] uninstall 失败`, err);
    }
    this.plugins.delete(pluginId);
    this.invalidate();
  }

  /**
   * 安装并启用插件
   */
  async install(pluginId: string): Promise<void> {
    const record = this.plugins.get(pluginId);
    if (!record) throw new Error(`[plugin] 未知插件 "${pluginId}"`);
    if (record.installed) return;
    try {
      await record.plugin.install?.(record.ctx);
      record.installed = true;
      record.status = "installed";
      record.error = undefined;
    } catch (err) {
      record.status = "error";
      record.error = (err as Error).message;
      console.error(`[plugin:${pluginId}] install 失败`, err);
    }
    this.invalidate();
  }

  /**
   * 启用已安装的插件
   */
  async enable(pluginId: string): Promise<void> {
    const record = this.plugins.get(pluginId);
    if (!record) return;
    if (!record.installed) await this.install(pluginId);
    if (record.status === "enabled") return;
    try {
      record.plugin.enable?.();
      record.status = "enabled";
      record.error = undefined;
    } catch (err) {
      record.status = "error";
      record.error = (err as Error).message;
    }
    this.invalidate();
  }

  /**
   * 禁用插件
   */
  async disable(pluginId: string): Promise<void> {
    const record = this.plugins.get(pluginId);
    if (!record) return;
    if (record.status !== "enabled") return;
    try {
      record.plugin.disable?.();
      record.status = "disabled";
    } catch (err) {
      record.status = "error";
      record.error = (err as Error).message;
    }
    this.invalidate();
  }

  /**
   * 列出所有插件（按注册顺序）
   */
  list(): PluginRecord[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取单个插件
   */
  get(pluginId: string): PluginRecord | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * 动态注册菜单项（供 PluginContext 调用）
   */
  addMenu(pluginId: string, menu: MenuExtension): void {
    const r = this.plugins.get(pluginId);
    if (!r) return;
    r.menus.push(menu);
    this.invalidate();
  }

  /**
   * 动态注册路由
   */
  addRoute(pluginId: string, route: RouteExtension): void {
    const r = this.plugins.get(pluginId);
    if (!r) return;
    r.routes.push(route);
    this.invalidate();
  }

  /**
   * 动态注册组件
   */
  addComponent(pluginId: string, ext: ComponentExtension): void {
    const r = this.plugins.get(pluginId);
    if (!r) return;
    r.components.push(ext);
    this.invalidate();
  }

  /**
   * 计算聚合视图（菜单 / 路由 / 插槽）
   * 仅包含已启用的插件
   */
  getExtensions(): PluginExtensionsView {
    const view = createEmptyExtensionsView();
    for (const record of this.plugins.values()) {
      if (record.status !== "enabled") continue;
      const pid = record.manifest.id;
      for (const m of record.menus) {
        view.menus.push({ ...m, pluginId: pid });
      }
      for (const r of record.routes) {
        view.routes.push({ ...r, pluginId: pid });
      }
      for (const c of record.components) {
        const slot = c.slot;
        if (!view.slotComponents[slot]) {
          (view.slotComponents as Record<string, unknown[]>)[slot] = [];
        }
        view.slotComponents[slot].push({
          pluginId: pid,
          component: c.component,
          order: c.order ?? 100,
        });
      }
    }
    // 菜单按 order 排序
    view.menus.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    // 插槽内组件按 order 排序
    for (const slot of Object.keys(view.slotComponents) as ComponentSlot[]) {
      view.slotComponents[slot].sort((a, b) => a.order - b.order);
    }
    return view;
  }

  /**
   * 返回当前快照（供 useSyncExternalStore 使用）
   */
  getSnapshot(): PluginSystemSnapshot {
    if (this.snapshotCache) return this.snapshotCache;
    const snap: PluginSystemSnapshot = {
      plugins: this.list().map(r => ({
        manifest: r.manifest,
        status: r.status,
        error: r.error,
      })),
      extensions: this.getExtensions(),
    };
    this.snapshotCache = snap;
    return snap;
  }

  /**
   * 订阅状态变化
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /* ── 内部方法 ──────────────────── */

  private buildContext(manifest: PluginManifest): PluginContext {
    const id = manifest.id;
    const events = createEventBus(id);
    const storage = createStorage(id);
    // 通过 bind 避免 ESLint no-this-alias 报错
    const addMenu = this.addMenu.bind(this);
    const addRoute = this.addRoute.bind(this);
    const addComponent = this.addComponent.bind(this);
    return {
      manifest,
      events,
      storage,
      toast: {
        show(message: string, type: "info" | "success" | "error" = "info") {
          if (type === "success") toast.success(message);
          else if (type === "error") toast.error(message);
          else toast.info(message);
        },
      },
      registerMenu(menu: MenuExtension) {
        addMenu(id, menu);
      },
      registerRoute(route: RouteExtension) {
        addRoute(id, route);
      },
      registerComponent(component: ComponentExtension) {
        addComponent(id, component);
      },
    };
  }

  private invalidate() {
    this.snapshotCache = null;
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (err) {
        console.error("[plugin] 订阅者通知失败", err);
      }
    });
  }
}

/** 全局单例 */
export const pluginManager = new PluginManagerImpl();

/**
 * React Hook：订阅插件系统快照
 *
 * 使用 useSyncExternalStore 与 React 18 并发模式兼容，
 * 仅当插件列表或扩展聚合变化时触发重渲染。
 */
export function usePluginSystem(): PluginSystemSnapshot {
  const getSnapshot = useCallback(() => pluginManager.getSnapshot(), []);
  const subscribe = useCallback((l: () => void) => pluginManager.subscribe(l), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * React Hook：只订阅扩展聚合视图（菜单/路由/插槽）
 * 当只关心扩展点而不关心插件列表状态时使用
 */
export function usePluginExtensions(): PluginExtensionsView {
  const snap = usePluginSystem();
  return snap.extensions;
}

/**
 * 便捷方法：一次性注册并启用插件
 */
export async function registerAndEnable(plugin: Plugin): Promise<void> {
  pluginManager.register(plugin);
  await pluginManager.install(plugin.manifest.id);
  await pluginManager.enable(plugin.manifest.id);
}

/**
 * 便捷方法：获取指定插槽的渲染项（已排序）
 */
export function getSlotComponents(
  extensions: PluginExtensionsView,
  slot: ComponentSlot,
): Array<{ pluginId: string; component: React.ComponentType; order: number }> {
  return extensions.slotComponents[slot] ?? [];
}

/** 暴露内部状态便于调试 */
export const __pluginDebug = {
  /** 当前已注册插件数量 */
  get count() {
    return pluginManager.list().length;
  },
  /** 触发全局事件（仅调试用） */
  emitGlobal: (event: string, ...args: unknown[]) => globalBus.emit(event, ...args),
  /** 查看某插件的存储内容 */
  dumpStorage(pluginId: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const prefix = `${STORAGE_PREFIX}${pluginId}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        try {
          result[k.slice(prefix.length)] = JSON.parse(localStorage.getItem(k) ?? "null");
        } catch {
          result[k.slice(prefix.length)] = localStorage.getItem(k);
        }
      }
    }
    return result;
  },
  /** 列出所有启用的插件 */
  enabled(): string[] {
    return pluginManager
      .list()
      .filter(r => r.status === "enabled")
      .map(r => r.manifest.id);
  },
  /** 列出所有插件状态 */
  status(): Array<{ id: string; status: PluginStatus; error?: string }> {
    return pluginManager.list().map(r => ({
      id: r.manifest.id,
      status: r.status,
      error: r.error,
    }));
  },
};

// 把调试对象挂到 window，方便在控制台排查
if (typeof window !== "undefined") {
  (window as unknown as { __zwdsPlugins: unknown }).__zwdsPlugins = __pluginDebug;
}
