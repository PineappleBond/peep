/**
 * 国际化（i18n）核心模块
 *
 * 设计：
 * - React Context 管理当前语言
 * - 翻译键采用点号分隔的扁平结构（如 "common.cancel"）
 * - 支持参数插值：t("key", { name: "某人" })
 * - 默认语言为 zh-CN
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import zhCN from "../locales/zh-CN.json";
import enUS from "../locales/en-US.json";

/** 支持的语言列表 */
export type Locale = "zh-CN" | "en-US";

/** 所有翻译资源的类型 */
export type TranslationResources = Record<Locale, Record<string, string>>;

/** 翻译资源注册表 */
const resources: TranslationResources = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

/** localStorage 中保存语言偏好的键名 */
const LOCALE_STORAGE_KEY = "peep-locale";

/**
 * 按点号路径在扁平字典中查找翻译值
 * 支持参数插值：{name} 会被替换为对应值
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = params[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

/**
 * 翻译函数
 * @param key 翻译键（点号分隔）
 * @param params 插值参数
 * @param locale 当前语言
 * @returns 翻译后的文本
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
  locale: Locale = "zh-CN"
): string {
  const dict = resources[locale] || resources["zh-CN"];
  const value = dict[key];
  if (value !== undefined) {
    return interpolate(value, params);
  }
  // 降级：尝试 zh-CN
  if (locale !== "zh-CN") {
    const fallback = resources["zh-CN"][key];
    if (fallback !== undefined) {
      return interpolate(fallback, params);
    }
  }
  // 找不到翻译，返回键本身（开发时容易发现）
  return key;
}

/** 从 localStorage 恢复语言偏好 */
function loadSavedLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === "zh-CN" || saved === "en-US") return saved;
  } catch {
    // localStorage 不可用时忽略
  }
  return "zh-CN";
}

/** Context 值类型 */
interface I18nContextValue {
  /** 当前语言 */
  locale: Locale;
  /** 切换语言 */
  setLocale: (locale: Locale) => void;
  /** 翻译函数 */
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** i18n 提供者：包裹在应用根部 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(loadSavedLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    } catch {
      // 忽略存储错误
    }
  }, []);

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => t(key, params, locale),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t: translate }),
    [locale, setLocale, translate]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** 获取 i18n 上下文（必须在 I18nProvider 内使用） */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n 必须在 <I18nProvider> 内部使用");
  }
  return ctx;
}
