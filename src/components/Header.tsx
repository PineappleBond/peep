/**
 * Header 组件 - 全局共用
 * 包含标题、SVG Icon 导航、PersonSelector
 */
import { useLocation, NavLink } from "react-router-dom";
import { PersonSelector } from "./PersonSelector";
import { ZiweiIcon } from "./icons/ZiweiIcon";
import { LiurenIcon } from "./icons/LiurenIcon";
import { WikiIcon } from "./icons/WikiIcon";
import type { Person } from "../core/personDb";
import { useI18n, type Locale } from "../core/i18n";

type HeaderProps = {
  /** 当前选中人物 ID */
  currentPersonId: number | null;
  /** 选择人物回调 */
  onSelectPerson: (person: Person) => void;
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

export function Header({ currentPersonId, onSelectPerson }: HeaderProps) {
  const location = useLocation();
  const { t, locale, setLocale } = useI18n();
  const titleKey = getTitleKeyByPath(location.pathname);
  const subtitleKey = getSubtitleKeyByPath(location.pathname);

  /** 切换语言 */
  const toggleLocale = () => {
    const next: Locale = locale === "zh-CN" ? "en-US" : "zh-CN";
    setLocale(next);
  };

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
          className="lang-toggle"
          onClick={toggleLocale}
          title={locale === "zh-CN" ? t("common.switchToEnglish") : t("common.switchToChinese")}
          aria-label={locale === "zh-CN" ? t("common.switchToEnglish") : t("common.switchToChinese")}
        >
          {locale === "zh-CN" ? "EN" : "中"}
        </button>
        <PersonSelector currentId={currentPersonId} onSelect={onSelectPerson} />
      </div>
    </header>
  );
}
