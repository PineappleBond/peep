/**
 * 自定义主题编辑器模块
 *
 * 提供主题的保存、加载、应用、导出、导入功能。
 * 自定义主题存储在 localStorage("custom-theme")。
 * 应用自定义主题时，通过 CSS 变量注入 :root。
 */

/** 主题颜色变量（可被自定义的颜色键） */
export type ThemeColors = {
  /** 背景色 */
  bg: string;
  /** 面板背景 */
  panel: string;
  /** 边框线 */
  line: string;
  /** 强调边框 */
  "line-strong": string;
  /** 正文文字 */
  text: string;
  /** 次要文字 */
  dim: string;
  /** 弱化文字 */
  faint: string;
  /** 金色（主星） */
  gold: string;
  /** 深金色 */
  "gold-deep": string;
  /** 青蓝（辉光） */
  cyan: string;
  /** 危险色 */
  danger: string;
  /** 玫瑰色 */
  rose: string;
};

/** 自定义主题结构 */
export interface CustomTheme {
  /** 主题名称 */
  name: string;
  /** 颜色变量 */
  colors: ThemeColors;
}

const STORAGE_KEY = "custom-theme";

/** 默认可编辑的颜色键（在编辑器中显示） */
export const EDITABLE_COLOR_KEYS: { key: keyof ThemeColors; label: string }[] = [
  { key: "bg", label: "themeEditor.color.bg" },
  { key: "panel", label: "themeEditor.color.panel" },
  { key: "line", label: "themeEditor.color.line" },
  { key: "line-strong", label: "themeEditor.color.lineStrong" },
  { key: "text", label: "themeEditor.color.text" },
  { key: "dim", label: "themeEditor.color.dim" },
  { key: "faint", label: "themeEditor.color.faint" },
  { key: "gold", label: "themeEditor.color.gold" },
  { key: "gold-deep", label: "themeEditor.color.goldDeep" },
  { key: "cyan", label: "themeEditor.color.cyan" },
  { key: "danger", label: "themeEditor.color.danger" },
  { key: "rose", label: "themeEditor.color.rose" },
];

/** 预设主题列表 */
export const PRESET_THEMES: CustomTheme[] = [
  {
    name: "玄空霓虹",
    colors: {
      bg: "#04060d",
      panel: "rgba(13, 20, 40, 0.72)",
      line: "rgba(96, 165, 250, 0.14)",
      "line-strong": "rgba(125, 211, 252, 0.42)",
      text: "#d9e4ff",
      dim: "#7787a8",
      faint: "#586888",
      gold: "#f3c96b",
      "gold-deep": "#c9992e",
      cyan: "#55d7ff",
      danger: "#f87171",
      rose: "#ff4d6d",
    },
  },
  {
    name: "宣纸素白",
    colors: {
      bg: "#f5f7fa",
      panel: "rgba(255, 255, 255, 0.85)",
      line: "rgba(0, 0, 0, 0.1)",
      "line-strong": "rgba(0, 0, 0, 0.25)",
      text: "#1a202c",
      dim: "#4a5568",
      faint: "#a0aec0",
      gold: "#b7791f",
      "gold-deep": "#975a16",
      cyan: "#2b6cb0",
      danger: "#c53030",
      rose: "#d53f8c",
    },
  },
  {
    name: "墨夜高对比",
    colors: {
      bg: "#000000",
      panel: "rgba(20, 20, 20, 0.95)",
      line: "rgba(255, 255, 255, 0.2)",
      "line-strong": "rgba(255, 255, 255, 0.5)",
      text: "#ffffff",
      dim: "#cccccc",
      faint: "#999999",
      gold: "#ffd700",
      "gold-deep": "#e6ac00",
      cyan: "#00ffff",
      danger: "#ff5252",
      rose: "#ff4081",
    },
  },
  {
    name: "护眼暖秋",
    colors: {
      bg: "#1a1510",
      panel: "rgba(40, 30, 20, 0.8)",
      line: "rgba(200, 160, 100, 0.15)",
      "line-strong": "rgba(220, 180, 120, 0.4)",
      text: "#e8d9c0",
      dim: "#a89070",
      faint: "#786048",
      gold: "#e6b350",
      "gold-deep": "#b8862e",
      cyan: "#7ac0b0",
      danger: "#e06050",
      rose: "#d06080",
    },
  },
];

/** 获取当前保存的自定义主题（若无则返回 null） */
export function getCustomTheme(): CustomTheme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CustomTheme;
  } catch {
    return null;
  }
}

/** 保存自定义主题并立即应用 */
export function saveCustomTheme(theme: CustomTheme): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  applyCustomTheme(theme);
}

/** 应用自定义主题到 DOM（覆盖 CSS 变量） */
export function applyCustomTheme(theme: CustomTheme): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--${key}`, value);
  }
}

/** 清除自定义主题（恢复默认） */
export function clearCustomTheme(): void {
  localStorage.removeItem(STORAGE_KEY);
  // 移除所有自定义 CSS 变量
  const root = document.documentElement;
  for (const { key } of EDITABLE_COLOR_KEYS) {
    root.style.removeProperty(`--${key}`);
  }
}

/** 导出当前自定义主题为 JSON 字符串 */
export function exportTheme(): string {
  const theme = getCustomTheme();
  if (!theme) return "";
  return JSON.stringify(theme, null, 2);
}

/** 从 JSON 字符串导入主题并应用 */
export function importTheme(json: string): CustomTheme {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("无效的主题 JSON");
  }
  if (!parsed.name || typeof parsed.name !== "string") {
    throw new Error("主题缺少 name 字段");
  }
  if (!parsed.colors || typeof parsed.colors !== "object") {
    throw new Error("主题缺少 colors 字段");
  }
  const theme: CustomTheme = {
    name: parsed.name,
    colors: { ...parsed.colors },
  };
  saveCustomTheme(theme);
  return theme;
}

/** 从预设主题创建自定义主题（复制一份） */
export function themeFromPreset(preset: CustomTheme): CustomTheme {
  return {
    name: preset.name,
    colors: { ...preset.colors },
  };
}

/** 初始化自定义主题：应用启动时调用 */
export function initCustomTheme(): void {
  const theme = getCustomTheme();
  if (theme) {
    applyCustomTheme(theme);
  }
}
