/**
 * 主题管理模块
 *
 * 支持三种模式：
 * - "light"：强制亮色主题
 * - "dark"：强制暗色主题
 * - "system"：跟随系统偏好（默认）
 *
 * 用户偏好存储在 localStorage("theme")，通过 data-theme 属性应用到 :root。
 */

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

/** 获取当前主题偏好 */
export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

/** 设置主题并持久化 */
export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

/** 将主题应用到 DOM */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

/** 初始化主题：在应用启动时调用 */
export function initTheme(): void {
  applyTheme(getTheme());
}

/** 监听系统主题变化，仅在 system 模式下自动切换 */
const mql = window.matchMedia("(prefers-color-scheme: dark)");
mql.addEventListener("change", () => {
  if (getTheme() === "system") {
    // system 模式下移除 data-theme，让 @media 查询生效
    applyTheme("system");
  }
});
