/**
 * Header 组件 - 全局共用
 * 包含标题、SVG Icon 导航、PersonSelector
 */
import { useEffect, useMemo, memo } from "react";
import { NavLink } from "react-router-dom";
import { PersonSelector } from "./PersonSelector";
import { ZiweiIcon } from "./icons/ZiweiIcon";
import { LiurenIcon } from "./icons/LiurenIcon";
import { WikiIcon } from "./icons/WikiIcon";
import type { Person } from "../core/personDb";
import { useI18n, type Locale } from "../core/i18n";
import type { Theme } from "../core/theme";
import { registerShortcut } from "../core/shortcuts";
import type { PluginExtensionsView } from "../core/pluginTypes";

type HeaderProps = {
  /** 当前选中人物 ID */
  currentPersonId: number | null;
  /** 选择人物回调 */
  onSelectPerson: (person: Person) => void;
  /** 打开导入对话框 */
  onOpenImport?: () => void;
  /** 打开同步对话框 */
  onOpenSync?: () => void;
  /** 当前主题 */
  theme: Theme;
  /** 循环切换主题 */
  onCycleTheme: () => void;
  /** 打开主题编辑器 */
  onOpenThemeEditor?: () => void;
  /** 当前语言 */
  locale: Locale;
  /** 切换语言 */
  onToggleLocale: () => void;
  /** 插件注册的菜单扩展 */
  pluginMenus?: PluginExtensionsView["menus"];
};

/**
 * Header 组件 - 全局共用
 * 包含标题、SVG Icon 导航、PersonSelector
 * 使用 memo 优化避免父组件重渲染时的不必要更新
 */
export const Header = memo(function Header({
  currentPersonId,
  onSelectPerson,
  onOpenImport,
  onOpenSync,
  theme,
  onCycleTheme,
  onOpenThemeEditor,
  locale,
  onToggleLocale,
  pluginMenus,
}: HeaderProps) {
  const { t } = useI18n();

  /** 主题按钮显示文本（使用 useMemo 避免每次渲染重新计算） */
  const themeLabel = useMemo(
    () => (theme === "system" ? "⚙" : theme === "light" ? "☀" : "☾"),
    [theme],
  );
  const themeTitle = useMemo(
    () =>
      theme === "system"
        ? t("theme.system")
        : theme === "light"
          ? t("theme.light")
          : t("theme.dark"),
    [theme, t],
  );

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
      <h1>窥见人生</h1>
      <nav className="top-nav" aria-label={t("nav.mainNav")} data-guide="nav">
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
        {/* 插件注册的菜单扩展 */}
        {pluginMenus?.map(menu => {
          const Icon = menu.icon;
          const label = t(menu.label) || menu.label;
          return (
            <NavLink
              key={`plugin-menu:${menu.pluginId}:${menu.path}`}
              to={menu.path}
              end={menu.end}
              className={({ isActive }) => (isActive ? "nav-icon active" : "nav-icon")}
              aria-label={label}
              title={label}
            >
              {Icon ? <Icon aria-hidden={true} /> : null}
            </NavLink>
          );
        })}
      </nav>
      <div className="top-actions">
        <button
          className="theme-toggle"
          data-guide="theme"
          onClick={onCycleTheme}
          title={themeTitle}
          aria-label={themeTitle}
        >
          {themeLabel}
        </button>
        {onOpenThemeEditor && (
          <button
            className="theme-editor-toggle"
            onClick={onOpenThemeEditor}
            title={t("themeEditor.openEditor")}
            aria-label={t("themeEditor.openEditor")}
          >
            🎨
          </button>
        )}
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
        {onOpenSync && (
          <button
            className="sync-toggle"
            onClick={onOpenSync}
            title={t("sync.title")}
            aria-label={t("sync.title")}
          >
            🔗
          </button>
        )}
        <PersonSelector currentId={currentPersonId} onSelect={onSelectPerson} />
      </div>
    </header>
  );
});
