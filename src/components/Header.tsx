/**
 * Header 组件 - 全局共用
 * 包含标题、SVG Icon 导航、PersonSelector
 */
import { useEffect } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { PersonSelector } from "./PersonSelector";
import { ZiweiIcon } from "./icons/ZiweiIcon";
import { LiurenIcon } from "./icons/LiurenIcon";
import { WikiIcon } from "./icons/WikiIcon";
import type { Person } from "../core/personDb";
import { useI18n, type Locale } from "../core/i18n";
import type { Theme } from "../core/theme";
import { registerShortcut } from "../core/shortcuts";

type HeaderProps = {
  /** 当前选中人物 ID */
  currentPersonId: number | null;
  /** 选择人物回调 */
  onSelectPerson: (person: Person) => void;
  /** 打开导入对话框 */
  onOpenImport?: () => void;
  /** 当前主题 */
  theme: Theme;
  /** 循环切换主题 */
  onCycleTheme: () => void;
  /** 当前语言 */
  locale: Locale;
  /** 切换语言 */
  onToggleLocale: () => void;
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

export function Header({
  currentPersonId,
  onSelectPerson,
  onOpenImport,
  theme,
  onCycleTheme,
  locale,
  onToggleLocale,
}: HeaderProps) {
  const location = useLocation();
  const { t } = useI18n();
  const titleKey = getTitleKeyByPath(location.pathname);
  const subtitleKey = getSubtitleKeyByPath(location.pathname);

  /** 主题按钮显示文本 */
  const themeLabel = theme === "system" ? "⚙" : theme === "light" ? "☀" : "☾";
  const themeTitle = theme === "system" ? "跟随系统" : theme === "light" ? "亮色主题" : "暗色主题";

  // ── 主题切换快捷键 T ────────────────────────────
  useEffect(() => {
    return registerShortcut({
      key: "T",
      description: t("shortcut.toggleTheme"),
      group: "shortcut.group.general",
      handler: onCycleTheme,
    });
  }, [onCycleTheme, t]);

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
          onClick={onCycleTheme}
          title={themeTitle}
          aria-label={themeTitle}
        >
          {themeLabel}
        </button>
        <button
          className="lang-toggle"
          onClick={onToggleLocale}
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
