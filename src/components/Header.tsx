/**
 * Header 组件 - 全局共用
 * 包含标题、SVG Icon 导航、PersonSelector
 */
import { useState, useCallback, useEffect } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { PersonSelector } from "./PersonSelector";
import { ZiweiIcon } from "./icons/ZiweiIcon";
import { LiurenIcon } from "./icons/LiurenIcon";
import { WikiIcon } from "./icons/WikiIcon";
import type { Person } from "../core/personDb";
import { useI18n, type Locale } from "../core/i18n";
import { getTheme, setTheme, type Theme } from "../core/theme";
import { registerShortcut } from "../core/shortcuts";

type HeaderProps = {
  /** 当前选中人物 ID */
  currentPersonId: number | null;
  /** 选择人物回调 */
  onSelectPerson: (person: Person) => void;
  /** 打开导入对话框 */
  onOpenImport?: () => void;
};

/** 根据路由获取标题键名 */
function getTitleKeyByPath(pathname: string): string {
  if (pathname.startsWith("/wiki")) return "nav.wiki";
  if (pathname.startsWith("/liuren")) return "nav.daliuren";
  return "nav.ziwei";
}

/** 根据路由获取副标题键名 */
function getSubtitleKeyByPath(pathname: string): string {
  if (pathname.startsWith("/wiki")) return "header.wiki.subtitle";
  if (pathname.startsWith("/liuren")) return "header.daliuren.subtitle";
  return "header.ziwei.subtitle";
}

export function Header({ currentPersonId, onSelectPerson, onOpenImport }: HeaderProps) {
  const location = useLocation();
  const { t, locale, setLocale } = useI18n();
  const titleKey = getTitleKeyByPath(location.pathname);
  const subtitleKey = getSubtitleKeyByPath(location.pathname);
  const [theme, setThemeState] = useState<Theme>(getTheme);

  /** 切换语言 */
  const toggleLocale = () => {
    const next: Locale = locale === "zh-CN" ? "en-US" : "zh-CN";
    setLocale(next);
  };

  /** 循环切换主题：system → light → dark → system */
  const cycleTheme = useCallback(() => {
    const order: Theme[] = ["system", "light", "dark"];
    const idx = order.indexOf(theme);
    const next = order[(idx + 1) % order.length];
    setThemeState(next);
    setTheme(next);
  }, [theme]);

  /** 主题按钮显示文本 */
  const themeLabel = theme === "system" ? "⚙" : theme === "light" ? "☀" : "☾";
  const themeTitle = theme === "system" ? "跟随系统" : theme === "light" ? "亮色主题" : "暗色主题";

  // ── 主题切换快捷键 T ────────────────────────────
  useEffect(() => {
    return registerShortcut({
      key: "T",
      description: t("shortcut.toggleTheme"),
      group: "shortcut.group.general",
      handler: cycleTheme,
    });
  }, [cycleTheme, t]);

  return (
    <header className="top">
      <h1>{t(titleKey)}</h1>
      <span className="top-sub">{t(subtitleKey)}</span>
      <nav className="top-nav" aria-label={t("nav.mainNav")}>
        <NavLink
          to="/"
          end
          className={({ isActive }) => (isActive ? "nav-icon active" : "nav-icon")}
          aria-label={t("nav.ziwei")}
        >
          <ZiweiIcon aria-hidden="true" />
        </NavLink>
        <NavLink
          to="/liuren"
          className={({ isActive }) => (isActive ? "nav-icon active" : "nav-icon")}
          aria-label={t("nav.daliuren")}
        >
          <LiurenIcon aria-hidden="true" />
        </NavLink>
        <NavLink
          to="/wiki"
          className={({ isActive }) => (isActive ? "nav-icon active" : "nav-icon")}
          aria-label={t("nav.wiki")}
        >
          <WikiIcon aria-hidden="true" />
        </NavLink>
      </nav>
      <div className="top-actions">
        <button
          className="theme-toggle"
          onClick={cycleTheme}
          title={themeTitle}
          aria-label={themeTitle}
        >
          {themeLabel}
        </button>
        <button
          className="lang-toggle"
          onClick={toggleLocale}
          title={locale === "zh-CN" ? t("common.switchToEnglish") : t("common.switchToChinese")}
          aria-label={
            locale === "zh-CN" ? t("common.switchToEnglish") : t("common.switchToChinese")
          }
        >
          {locale === "zh-CN" ? "EN" : "中"}
        </button>
        {onOpenImport && (
          <button
            className="import-toggle"
            onClick={onOpenImport}
            title={t("import.title")}
            aria-label={t("import.title")}
          >
            📥
          </button>
        )}
        <PersonSelector currentId={currentPersonId} onSelect={onSelectPerson} />
      </div>
    </header>
  );
}
