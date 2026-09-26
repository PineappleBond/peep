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

/** 预设主题结构：分为亮色组和暗色组 */
export interface PresetTheme {
  /** 主题名称 */
  name: string;
  /** 主题分组：light 或 dark */
  group: "light" | "dark";
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

/**
 * 预设主题列表（8 个主题，分为亮色组和暗色组）
 */
export const PRESET_THEMES: PresetTheme[] = [
  // ═══ 亮色组 ═══
  {
    name: "晨曦蓝",
    group: "light",
    colors: {
      bg: "#eef2f9",
      panel: "rgba(255, 255, 255, 0.92)",
      line: "rgba(37, 99, 235, 0.22)",
      "line-strong": "rgba(37, 99, 235, 0.55)",
      text: "#0f172a",
      dim: "#334155",
      faint: "#64748b",
      gold: "#92400e",
      "gold-deep": "#78350f",
      cyan: "#0c4a6e",
      danger: "#b91c1c",
      rose: "#9d174d",
    },
  },
  {
    name: "宣纸素白",
    group: "light",
    colors: {
      bg: "#faf8f3",
      panel: "rgba(255, 253, 248, 0.95)",
      line: "rgba(120, 100, 60, 0.15)",
      "line-strong": "rgba(120, 100, 60, 0.35)",
      text: "#1a1612",
      dim: "#44403c",
      faint: "#78716c",
      gold: "#854d0e",
      "gold-deep": "#713f12",
      cyan: "#164e63",
      danger: "#991b1b",
      rose: "#9f1239",
    },
  },
  {
    name: "纯白高对比",
    group: "light",
    colors: {
      bg: "#ffffff",
      panel: "rgba(255, 255, 255, 0.98)",
      line: "rgba(0, 0, 0, 0.18)",
      "line-strong": "rgba(0, 0, 0, 0.5)",
      text: "#000000",
      dim: "#1f1f1f",
      faint: "#525252",
      gold: "#854d0e",
      "gold-deep": "#713f12",
      cyan: "#0e7490",
      danger: "#991b1b",
      rose: "#9f1239",
    },
  },
  {
    name: "暖秋护眼",
    group: "light",
    colors: {
      bg: "#f5f0e6",
      panel: "rgba(255, 250, 240, 0.95)",
      line: "rgba(146, 108, 46, 0.18)",
      "line-strong": "rgba(146, 108, 46, 0.45)",
      text: "#1c1508",
      dim: "#3d3522",
      faint: "#6b5d45",
      gold: "#854d0e",
      "gold-deep": "#713f12",
      cyan: "#155e4e",
      danger: "#9a2a1e",
      rose: "#8b1a4a",
    },
  },
  // ═══ 暗色组 ═══
  {
    name: "玄空霓虹",
    group: "dark",
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
    name: "宣纸暖棕",
    group: "dark",
    colors: {
      bg: "#2a2520",
      panel: "rgba(60, 50, 40, 0.85)",
      line: "rgba(200, 180, 140, 0.15)",
      "line-strong": "rgba(200, 180, 140, 0.35)",
      text: "#f0ebe3",
      dim: "#b8b0a3",
      faint: "#8a8070",
      gold: "#d4a855",
      "gold-deep": "#b89040",
      cyan: "#7ab8a8",
      danger: "#e87070",
      rose: "#d87098",
    },
  },
  {
    name: "墨夜高对比",
    group: "dark",
    colors: {
      bg: "#000000",
      panel: "rgba(20, 20, 20, 0.95)",
      line: "rgba(255, 255, 255, 0.2)",
      "line-strong": "rgba(255, 255, 255, 0.5)",
      text: "#ffffff",
      dim: "#e5e5e5",
      faint: "#a3a3a3",
      gold: "#ffd700",
      "gold-deep": "#e6ac00",
      cyan: "#00ffff",
      danger: "#ff5252",
      rose: "#ff4081",
    },
  },
  {
    name: "护眼暖秋",
    group: "dark",
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

/** 获取当前模式的预设主题（根据当前亮暗模式过滤） */
export function getPresetThemesForCurrentMode(): PresetTheme[] {
  const root = document.documentElement;
  const dataTheme = root.getAttribute("data-theme");
  const isDark =
    dataTheme === "dark" ||
    (dataTheme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return PRESET_THEMES.filter(t => t.group === (isDark ? "dark" : "light"));
}

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

/** 从预设主题创建自定义主题（复制颜色值） */
export function themeFromPreset(preset: PresetTheme): CustomTheme {
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
