import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

/** 复制文本到剪贴板，成功返回 true */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * 程序化导航到指定路径（用于 Agent API）
 *
 * 通过 pushState + popstate 事件触发 React Router 重新匹配路由。
 * 注意：这是一个 hack，理想情况下应使用 React Router 的 navigate()，
 * 但 Agent API 运行在 React 组件树之外，无法直接使用 hooks。
 *
 * @param pathname - 目标路径（如 "/documents/edit/123"，相对于 base）
 * @param search - 查询参数对象（可选）
 * @param waitForRender - 是否等待 UI 渲染完成（默认 100ms，用于 Agent 时序）
 */
export async function navigateTo(
  pathname: string,
  search?: Record<string, string | number | undefined>,
  waitForRender = false
): Promise<void> {
  const url = new URL(window.location.href);
  // 拼接 base path，确保在 GitHub Pages 等子路径部署时路由正确
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  url.pathname = base + pathname;

  if (search) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }
    url.search = params.toString();
  } else {
    url.search = "";
  }

  try {
    window.history.pushState({}, "", url.toString());
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch (e) {
    // pushState 可能在 iframe 沙箱或安全限制环境中失败
    console.error("[navigateTo] Navigation failed:", e);
    throw new Error(`Navigation to ${pathname} failed`);
  }

  if (waitForRender) {
    // 100ms 是经验值，等待 React Router 完成路由匹配和组件渲染
    // TODO: 理想方案是使用 MutationObserver 或 React 的 useLayoutEffect 精确等待
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/* ── localStorage 安全读写 ────────────────────────── */

/**
 * 安全读取 localStorage，解析失败或不可用时返回 fallback。
 */
export function lsGet<T = string>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    // 尝试 JSON 解析；若原始值就是纯字符串，直接返回
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  } catch {
    return fallback;
  }
}

/**
 * 安全写入 localStorage。
 */
export function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch (e) {
    // 隐私模式、存储已满等场景 —— 记录警告以便排查偏好丢失问题
    console.warn(`[lsSet] Failed to write key "${key}":`, e);
  }
}

/**
 * 安全删除 localStorage 条目。
 */
export function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/* ── 日期格式化 ────────────────────────────────────── */

/**
 * 格式化日期为本地化短日期（不含时间）。
 *
 * 与 `formatDateTime` 的区别：此函数只输出日期部分，
 * 适用于列表项、卡片底部等空间受限的场景。
 */
export function formatDateShort(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 格式化为相对时间（如"3 天前"）。
 *
 * 默认使用中文 locale 并添加"前/后"后缀。
 */
export function formatRelativeTime(ts: number): string {
  try {
    return formatDistanceToNow(new Date(ts), {
      addSuffix: true,
      locale: zhCN,
    });
  } catch {
    return "";
  }
}

/* ── 集中管理的 localStorage key ───────────────────── */

/**
 * 项目级 localStorage key 常量。
 *
 * 统一管理避免散落在各模块中导致 key 冲突或遗漏清理。
 * 新增 key 时请在此处注册，并附上用途说明。
 */
export const STORAGE_KEYS = {
  /** 工作台当前激活的 Tab（bazi | ziwei | liuyao） */
  WORKBENCH_TAB: "peep-workbench-tab",
  /** 运限选择器的持久化状态 */
  HOROSCOPE_STORE: "peep-horoscope-store",
  /** 运限选择器折叠/展开状态 */
  HOROSCOPE_COLLAPSED: "peep-horoscope-collapsed",
  /** 当前选中的人物 ID */
  SELECTED_PERSON: "peep-selected-person-id",
  /** 用户选择的主题（light | dark | system） */
  THEME: "peep-theme",
} as const;
