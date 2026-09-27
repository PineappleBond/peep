/**
 * 全局应用上下文：在 Layout 子树中共享主题、语言、人物、对话框等全局状态，
 * 避免 Layout → Header → PersonSelector 的深层 prop drilling。
 *
 * 设计要点：
 * - AppProvider 由 Layout 挂载，接收状态作为 props（Layout 保留 reducer 所有权以便渲染对话框）
 * - Header/PersonSelector/CommandPalette 等深层子组件通过 useAppContext() 直接读取状态
 * - 使用 useAppSelector() 订阅特定切片，减少不必要的重渲染
 * - 语言（locale/i18n）已在 I18nContext 中管理，此处不再重复
 * - 保留组件原有 prop 接口（向后兼容）：prop 显式传入时优先使用 prop
 */
import { createContext, useContext, useMemo, type Dispatch, type ReactNode } from "react";
import type { Theme } from "./theme";
import type { Person } from "./personDb";
import type { PluginExtensionsView } from "./pluginTypes";

/**
 * 对话框状态聚合类型：将多个独立的对话框开关状态合并管理
 * 使用 useReducer 避免多个 useState 导致的重复渲染
 */
export interface DialogState {
  importOpen: boolean;
  syncOpen: boolean;
  paletteOpen: boolean;
  themeEditorOpen: boolean;
}

export type DialogAction =
  | { type: "OPEN_IMPORT" }
  | { type: "CLOSE_IMPORT" }
  | { type: "OPEN_SYNC" }
  | { type: "CLOSE_SYNC" }
  | { type: "OPEN_PALETTE" }
  | { type: "CLOSE_PALETTE" }
  | { type: "TOGGLE_PALETTE" }
  | { type: "OPEN_THEME_EDITOR" }
  | { type: "CLOSE_THEME_EDITOR" };

export function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "OPEN_IMPORT":
      return { ...state, importOpen: true };
    case "CLOSE_IMPORT":
      return { ...state, importOpen: false };
    case "OPEN_SYNC":
      return { ...state, syncOpen: true };
    case "CLOSE_SYNC":
      return { ...state, syncOpen: false };
    case "OPEN_PALETTE":
      return { ...state, paletteOpen: true };
    case "CLOSE_PALETTE":
      return { ...state, paletteOpen: false };
    case "TOGGLE_PALETTE":
      return { ...state, paletteOpen: !state.paletteOpen };
    case "OPEN_THEME_EDITOR":
      return { ...state, themeEditorOpen: true };
    case "CLOSE_THEME_EDITOR":
      return { ...state, themeEditorOpen: false };
    default:
      return state;
  }
}

/** 全局应用上下文值类型 */
export interface AppContextValue {
  /** 当前主题 */
  theme: Theme;
  /** 循环切换主题 */
  onCycleTheme: () => void;
  /** 打开主题编辑器 */
  onOpenThemeEditor: () => void;
  /** 当前选中人物 ID */
  currentPersonId: number | null;
  /** 选择人物回调 */
  onSelectPerson: (person: Person) => void;
  /** 打开导入对话框 */
  onOpenImport: () => void;
  /** 打开同步对话框 */
  onOpenSync: () => void;
  /** 对话框状态 */
  dialogState: DialogState;
  /** 对话框 dispatch */
  dialogDispatch: Dispatch<DialogAction>;
  /** 插件注册的菜单扩展 */
  pluginMenus: PluginExtensionsView["menus"];
}

const AppContext = createContext<AppContextValue | null>(null);

/**
 * AppProvider 属性：由 Layout 传入初始状态与回调
 * Layout 保留 reducer 所有权（需要读取 dialogState 渲染对话框），
 * AppProvider 只负责把状态广播给更深层的子组件。
 */
export type AppProviderProps = {
  children: ReactNode;
  theme: Theme;
  onCycleTheme: () => void;
  onOpenThemeEditor: () => void;
  currentPersonId: number | null;
  onSelectPerson: (person: Person) => void;
  onOpenImport: () => void;
  onOpenSync: () => void;
  dialogState: DialogState;
  dialogDispatch: Dispatch<DialogAction>;
  pluginMenus: PluginExtensionsView["menus"];
};

/**
 * 全局应用上下文提供者：由 Layout 挂载，包裹所有子路由
 */
export function AppProvider({
  children,
  theme,
  onCycleTheme,
  onOpenThemeEditor,
  currentPersonId,
  onSelectPerson,
  onOpenImport,
  onOpenSync,
  dialogState,
  dialogDispatch,
  pluginMenus,
}: AppProviderProps) {
  const value = useMemo<AppContextValue>(
    () => ({
      theme,
      onCycleTheme,
      onOpenThemeEditor,
      currentPersonId,
      onSelectPerson,
      onOpenImport,
      onOpenSync,
      dialogState,
      dialogDispatch,
      pluginMenus,
    }),
    [
      theme,
      onCycleTheme,
      onOpenThemeEditor,
      currentPersonId,
      onSelectPerson,
      onOpenImport,
      onOpenSync,
      dialogState,
      dialogDispatch,
      pluginMenus,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/**
 * 获取完整的应用上下文（必须在 AppProvider 内使用）
 */
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext 必须在 <AppProvider> 内部使用");
  }
  return ctx;
}

/**
 * 可选地获取应用上下文：不在 Provider 内时返回 null（不抛错）。
 * 用于 prop 回退场景。
 */
export function useAppContextOptional(): AppContextValue | null {
  return useContext(AppContext);
}

/**
 * 应用上下文选择器 hook：只订阅特定切片，减少不必要的重渲染。
 * 选择器应返回稳定的原始值或引用。
 *
 * 注意：由于 AppContextValue 对象每次 state 变化都会生成新引用，
 * selector 的相等性依赖 React 的引用比较。对于原始值（number/string/boolean）
 * 这很有效——selector 返回原语时，只有该原语实际变化才会触发重渲染。
 */
export function useAppSelector<T>(selector: (ctx: AppContextValue) => T): T {
  const ctx = useAppContext();
  return selector(ctx);
}
