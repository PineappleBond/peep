/**
 * 全局键盘快捷键系统
 *
 * 设计：
 * - 注册/注销模式：组件挂载时注册、卸载时自动注销
 * - 后注册的快捷键优先匹配（页面快捷键优先于全局快捷键）
 * - 输入框（input/textarea/select/contenteditable）中的按键不触发
 * - 无修饰键的定义自动允许 Shift（因 Shift 只改变字符大小写/符号）
 */

/** 快捷键处理函数 */
export type ShortcutHandler = (e: KeyboardEvent) => void;

/** 快捷键定义 */
export interface ShortcutDef {
  /** 按键组合，如 "1"、"Ctrl+S"、"Escape"、"?" */
  key: string;
  /** 触发时的回调 */
  handler: ShortcutHandler;
  /** 描述文本（用于帮助弹窗展示） */
  description: string;
  /** 分组标签（帮助弹窗中按组展示） */
  group?: string;
}

/** 已注册快捷键的内部包装（保留注册顺序） */
interface ShortcutEntry {
  def: ShortcutDef;
  /** 唯一标识，用于注销 */
  id: number;
}

/** 全局快捷键列表（后注册的在前面，优先匹配） */
const entries: ShortcutEntry[] = [];
let nextId = 0;

/** 帮助弹窗可见性监听器 */
type HelpVisibilityListener = (visible: boolean) => void;
const helpListeners: Set<HelpVisibilityListener> = new Set();
let helpVisible = false;

/** 设置帮助弹窗可见性 */
function setHelpVisible(visible: boolean) {
  helpVisible = visible;
  helpListeners.forEach(fn => {
    try {
      fn(visible);
    } catch (err) {
      console.error("[shortcuts] 帮助弹窗监听器执行失败", err);
    }
  });
}

/** 监听帮助弹窗可见性变化 */
export function onHelpVisibility(fn: HelpVisibilityListener): () => void {
  helpListeners.add(fn);
  return () => {
    helpListeners.delete(fn);
  };
}

/** 获取帮助弹窗当前可见性 */
export function isHelpVisible(): boolean {
  return helpVisible;
}

/** 切换帮助弹窗可见性 */
export function toggleHelp(): void {
  setHelpVisible(!helpVisible);
}

/**
 * 规范化键名：单字符取大写，多字符保持原样（如 Escape、Enter）
 */
function normalizeKey(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key;
}

/**
 * 从 KeyboardEvent 构建组合键字符串
 * 格式：Ctrl+Shift+Alt+Key（按固定顺序）
 */
function buildCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  parts.push(normalizeKey(e.key));
  return parts.join("+");
}

/**
 * 判断快捷键定义是否匹配当前按键事件
 * - 定义含修饰键（含 "+"）：精确匹配
 * - 定义不含修饰键：允许 Shift（因 Shift 影响字符），但不允许 Ctrl/Alt/Meta
 */
function matches(def: ShortcutDef, e: KeyboardEvent): boolean {
  const defHasModifier = def.key.includes("+");

  if (defHasModifier) {
    // 精确匹配
    return def.key === buildCombo(e);
  }

  // 无修饰键定义：不允许 Ctrl/Alt/Meta，允许 Shift
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return normalizeKey(e.key) === normalizeKey(def.key);
}

/**
 * 注册快捷键
 * @returns 注销函数（调用后移除该快捷键）
 */
export function registerShortcut(def: ShortcutDef): () => void {
  const id = nextId++;
  // 后注册的插到前面，优先匹配
  entries.unshift({ def, id });
  return () => {
    const idx = entries.findIndex(e => e.id === id);
    if (idx >= 0) entries.splice(idx, 1);
  };
}

/**
 * 批量注册快捷键
 * @returns 注销函数（一次性移除所有注册的快捷键）
 */
export function registerShortcuts(defs: ShortcutDef[]): () => void {
  const unregistrars = defs.map(def => registerShortcut(def));
  return () => unregistrars.forEach(unreg => unreg());
}

/**
 * 获取所有已注册的快捷键（供帮助弹窗展示）
 * 按注册顺序返回（先去重：同一 key 只展示优先级最高的）
 */
export function getRegisteredShortcuts(): ShortcutDef[] {
  const seen = new Set<string>();
  const result: ShortcutDef[] = [];
  for (const entry of entries) {
    if (!seen.has(entry.def.key)) {
      seen.add(entry.def.key);
      result.push(entry.def);
    }
  }
  return result;
}

/**
 * 初始化全局快捷键监听
 * 应在应用启动时调用一次
 * @returns 清理函数（移除监听器）
 */
export function initShortcuts(): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    // 忽略输入框中的按键
    const target = e.target as HTMLElement;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable
    ) {
      return;
    }

    // 遍历注册列表（后注册的在前面，优先匹配）
    for (const entry of entries) {
      if (matches(entry.def, e)) {
        e.preventDefault();
        try {
          entry.def.handler(e);
        } catch (err) {
          console.error(`[shortcuts] 快捷键 "${entry.def.key}" 执行失败`, err);
        }
        return; // 只触发第一个匹配的快捷键
      }
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}
