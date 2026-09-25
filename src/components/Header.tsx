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

type HeaderProps = {
  /** 当前选中人物 ID */
  currentPersonId: number | null;
  /** 选择人物回调 */
  onSelectPerson: (person: Person) => void;
};

/** 根据路由获取标题 */
function getTitleByPath(pathname: string): string {
  if (pathname.startsWith("/wiki")) {
    return "知识库";
  }
  if (pathname.startsWith("/liuren")) {
    return "大六壬";
  }
  return "紫微斗数";
}

/** 根据路由获取副标题 */
function getSubtitleByPath(pathname: string): string {
  if (pathname.startsWith("/wiki")) {
    return "LLM 知识底座 · Markdown · 实体关联";
  }
  if (pathname.startsWith("/liuren")) {
    return "古法占课 · 天地盘 · 四课三传";
  }
  return "玄机排盘 · iztro 引擎 · 自研盘面";
}

export function Header({ currentPersonId, onSelectPerson }: HeaderProps) {
  const location = useLocation();
  const title = getTitleByPath(location.pathname);
  const subtitle = getSubtitleByPath(location.pathname);

  return (
    <header className="top">
      <h1>{title}</h1>
      <span className="top-sub">{subtitle}</span>
      <nav className="top-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => (isActive ? "nav-icon active" : "nav-icon")}
          title="紫微斗数"
        >
          <ZiweiIcon />
        </NavLink>
        <NavLink
          to="/liuren"
          className={({ isActive }) => (isActive ? "nav-icon active" : "nav-icon")}
          title="大六壬"
        >
          <LiurenIcon />
        </NavLink>
        <NavLink
          to="/wiki"
          className={({ isActive }) => (isActive ? "nav-icon active" : "nav-icon")}
          title="知识库"
        >
          <WikiIcon />
        </NavLink>
      </nav>
      <div className="top-actions">
        <PersonSelector currentId={currentPersonId} onSelect={onSelectPerson} />
      </div>
    </header>
  );
}
