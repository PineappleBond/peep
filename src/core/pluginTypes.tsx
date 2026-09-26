/**
 * 插件系统类型定义
 *
 * 设计原则：
 * - 轻量级：基于事件与组件注入，不引入重型沙箱
 * - 类型安全：所有扩展点都有完整的 TypeScript 类型约束
 * - 可选集成：插件系统完全可选，不影响核心功能
 *
 * 扩展点：
 * - menus: Header 导航菜单项
 * - routes: 路由/页面扩展
 * - components: 在预定义插槽（slot）注入自定义 React 组件
 */
import type { ComponentType, ReactNode } from "react";

/**
 * 插件元数据描述
 */
export interface PluginManifest {
  /** 插件唯一标识，建议使用 kebab-case，如 "my-plugin" */
  id: string;
  /** 插件显示名称 */
  name: string;
  /** 插件版本（语义化版本） */
  version: string;
  /** 作者 */
  author?: string;
  /** 简介 */
  description?: string;
}

/**
 * 插件生命周期状态
 */
export type PluginStatus = "installed" | "enabled" | "disabled" | "error";

/**
 * 菜单扩展 —— 在 Header 导航区添加一个入口
 */
export interface MenuExtension {
  /** 路由路径，用于 NavLink 跳转 */
  path: string;
  /** 显示标签（国际化键或纯文本） */
  label: string;
  /** 图标组件，建议为 24x24 SVG 风格与现有图标保持一致 */
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** 仅当路由完全匹配时高亮（默认 false，前缀匹配） */
  end?: boolean;
  /** 排序权重，越小越靠前（默认 100） */
  order?: number;
}

/**
 * 路由扩展 —— 注册额外的路由条目
 */
export interface RouteExtension {
  /** 路由路径，如 "/my-plugin" */
  path: string;
  /** 渲染组件 */
  element: ComponentType;
  /** 是否懒加载（默认 false，插件注册时如使用 React.lazy 则设为 true） */
  lazy?: boolean;
}

/**
 * 组件插槽名称 —— 宿主预留的可注入位置
 *
 * 新增插槽请在该联合类型中追加字面量，并在对应宿主组件中
 * 调用 PluginManager.getSlotComponents(slotName) 渲染。
 */
export type ComponentSlot =
  /** 页面底部 footer 区 */
  | "layout.footer"
  /** 人物选择器旁 */
  | "header.actions"
  /** 首页盘面侧边栏 */
  | "ziwei.sidebar";

/**
 * 组件扩展 —— 在宿主插槽注入自定义 React 节点
 */
export interface ComponentExtension {
  /** 目标插槽 */
  slot: ComponentSlot;
  /** 渲染组件 */
  component: ComponentType;
  /** 排序权重，越小越靠前（默认 100） */
  order?: number;
}

/**
 * 插件上下文 —— 宿主向插件暴露的受控 API
 *
 * 说明：
 * - 不提供全局 DOM / 文件系统访问，前端环境天然沙箱
 * - 事件系统使用命名空间避免冲突（ctx.events.emit(`${pluginId}:xxx`)）
 */
export interface PluginContext {
  /** 插件自身元数据（只读） */
  readonly manifest: PluginManifest;
  /** 命名空间化的事件总线（自动加 pluginId 前缀） */
  events: PluginEventBus;
  /** 轻量级 toast 提示 */
  toast: {
    show(message: string, type?: "info" | "success" | "error"): void;
  };
  /** 持久化 KV 存储（按插件 id 隔离） */
  storage: PluginStorage;
  /** 注册扩展的便捷方法（也可在 manifest 中静态声明） */
  registerMenu(menu: MenuExtension): void;
  registerRoute(route: RouteExtension): void;
  registerComponent(component: ComponentExtension): void;
}

/**
 * 插件事件总线
 */
export interface PluginEventBus {
  /**
   * 触发本插件命名空间事件
   * 实际事件名为 `${pluginId}:${event}`
   */
  emit(event: string, ...args: unknown[]): void;
  /** 监听本插件命名空间事件 */
  on(event: string, listener: (...args: unknown[]) => void): void;
  /** 取消监听 */
  off(event: string, listener: (...args: unknown[]) => void): void;
  /**
   * 监听全局事件（跨插件通信）
   * 注意：请谨慎使用，避免耦合
   */
  onGlobal(event: string, listener: (...args: unknown[]) => void): void;
  offGlobal(event: string, listener: (...args: unknown[]) => void): void;
}

/**
 * 插件专属持久化存储（基于 localStorage，按 id 隔离键前缀）
 */
export interface PluginStorage {
  get<T>(key: string, fallback?: T): T | undefined;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

/**
 * 插件定义 —— 第三方开发者实现此接口
 */
export interface Plugin {
  /** 元数据 */
  manifest: PluginManifest;

  /* ── 生命周期钩子（可选） ─────────────── */
  /** 安装时调用，可执行异步初始化（如拉取远端配置） */
  install?(ctx: PluginContext): void | Promise<void>;
  /** 卸载前调用，用于清理资源 */
  uninstall?(): void | Promise<void>;
  /** 启用时调用 */
  enable?(): void;
  /** 禁用时调用（应停止定时器、取消订阅等） */
  disable?(): void;

  /* ── 静态声明式扩展（可选） ─────────────── */
  menus?: MenuExtension[];
  routes?: RouteExtension[];
  components?: ComponentExtension[];
}

/**
 * 已注册插件的内部运行时记录
 */
export interface PluginRecord {
  manifest: PluginManifest;
  status: PluginStatus;
  /** 插件实例 */
  plugin: Plugin;
  /** 插件上下文（install 时传入同一个引用） */
  ctx: PluginContext;
  /** 该插件注册的菜单（动态 + 静态合并） */
  menus: MenuExtension[];
  /** 该插件注册的路由 */
  routes: RouteExtension[];
  /** 该插件注册的组件 */
  components: ComponentExtension[];
  /** install 是否已调用 */
  installed: boolean;
  /** 上次错误信息 */
  error?: string;
}

/**
 * 宿主渲染所需的插件扩展聚合视图
 */
export interface PluginExtensionsView {
  menus: Array<MenuExtension & { pluginId: string }>;
  routes: Array<RouteExtension & { pluginId: string }>;
  slotComponents: Record<
    ComponentSlot,
    Array<{ pluginId: string; component: ComponentType; order: number }>
  >;
}

/**
 * 供 React 组件消费的插件系统状态快照
 */
export interface PluginSystemSnapshot {
  plugins: Array<{
    manifest: PluginManifest;
    status: PluginStatus;
    error?: string;
  }>;
  extensions: PluginExtensionsView;
}

/**
 * 辅助：构造空的插槽聚合
 */
export function createEmptyExtensionsView(): PluginExtensionsView {
  return {
    menus: [],
    routes: [],
    slotComponents: {
      "layout.footer": [],
      "header.actions": [],
      "ziwei.sidebar": [],
    },
  };
}

/**
 * 辅助：渲染插槽组件
 */
export function renderSlotChildren(
  slot: ComponentSlot,
  extensions: PluginExtensionsView,
): ReactNode[] {
  const items = extensions.slotComponents[slot] ?? [];
  const sorted = [...items].sort((a, b) => a.order - b.order);
  return sorted.map((item, idx) => {
    const Comp = item.component;
    return <Comp key={`${item.pluginId}-${idx}`} />;
  });
}
