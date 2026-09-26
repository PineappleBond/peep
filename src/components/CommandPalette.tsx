/**
 * Command Palette 组件 - 全局快速搜索
 *
 * 设计：
 * - 按 Ctrl/Cmd+K 打开
 * - 实时搜索（模糊匹配）
 * - 分类显示结果（操作 / 人物 / 记录 / 文档）
 * - 键盘导航（↑↓ 选择，Enter 确认，Esc 关闭）
 * - 最近使用记录（由 globalSearch 模块持久化，空查询时优先展示）
 * - 关键词高亮
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../core/i18n";
import {
  searchAll,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type SearchResultItem,
  type SearchResultType,
  type SearchContext,
} from "../core/globalSearch";
/* SearchContext 已经包含 onSelectPerson(person: Person) 的签名 */

type CommandPaletteProps = {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 搜索上下文（导航、人物选择等） */
  context: SearchContext;
};

/** 搜索去抖延迟（毫秒） */
const DEBOUNCE_MS = 120;

/** 结果类型标签映射（内部使用，避免重复创建对象） */
const TYPE_ICON: Record<SearchResultType, string> = {
  action: "⚡",
  person: "👤",
  liuren: "☰",
  wiki: "📖",
};

/**
 * 高亮匹配关键词
 * 将 text 中匹配 query 的部分用 <mark> 包裹
 */
function highlightText(text: string, query: string): (string | JSX.Element)[] {
  if (!query) return [text];
  const q = query.trim();
  if (!q) return [text];
  const result: (string | JSX.Element)[] = [];
  let remaining = text;
  let keyIdx = 0;
  while (remaining.length > 0) {
    const idx = remaining.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) {
      result.push(remaining);
      break;
    }
    if (idx > 0) result.push(remaining.slice(0, idx));
    result.push(
      <mark key={`m${keyIdx++}`} className="cp-highlight">
        {remaining.slice(idx, idx + q.length)}
      </mark>,
    );
    remaining = remaining.slice(idx + q.length);
  }
  return result;
}

/** 按类别分组结果 */
function groupByType(items: SearchResultItem[]): Map<SearchResultType, SearchResultItem[]> {
  const groups = new Map<SearchResultType, SearchResultItem[]>();
  for (const item of items) {
    if (!groups.has(item.type)) groups.set(item.type, []);
    groups.get(item.type)!.push(item);
  }
  return groups;
}

export function CommandPalette({ open, onClose, context }: CommandPaletteProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<number | null>(null);

  // 打开时聚焦输入框并重置状态
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open]);

  // 搜索（带去抖）
  useEffect(() => {
    if (!open) return;
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const items = await searchAll(query, context);
        setResults(items);
        setActiveIndex(0);
      } catch (err) {
        console.error("[CommandPalette] 搜索失败", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [query, open, context]);

  // 按类别分组的结果（保持固定顺序）
  const grouped = useMemo(() => groupByType(results), [results]);

  // 扁平化列表（用于键盘导航索引）
  const flatList = useMemo(() => {
    const list: SearchResultItem[] = [];
    for (const type of CATEGORY_ORDER) {
      const group = grouped.get(type);
      if (group) list.push(...group);
    }
    return list;
  }, [grouped]);

  // 当前活跃项
  const activeItem = flatList[activeIndex] || null;

  // 活跃项滚动到可见
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-cp-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex(i => Math.min(i + 1, flatList.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex(i => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (activeItem) {
            try {
              activeItem.action();
            } catch (err) {
              console.error("[CommandPalette] 执行动作失败", err);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatList.length, activeItem, onClose],
  );

  // 点击结果项
  const handleItemClick = useCallback((item: SearchResultItem) => {
    try {
      item.action();
    } catch (err) {
      console.error("[CommandPalette] 执行动作失败", err);
    }
  }, []);

  // 鼠标悬停更新活跃索引
  const handleItemHover = useCallback((idx: number) => {
    setActiveIndex(idx);
  }, []);

  if (!open) return null;

  // 计算每个结果在扁平列表中的索引
  let flatIdx = 0;

  return (
    <div className="cp-mask" onClick={onClose}>
      <div
        className="cp-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t("search.title")}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="cp-head">
          <span className="cp-icon" aria-hidden="true">
            🔍
          </span>
          <input
            ref={inputRef}
            className="cp-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.title")}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {loading && (
            <span className="cp-loading" aria-hidden="true">
              ⋯
            </span>
          )}
          <kbd className="cp-esc" title={t("common.close")}>
            Esc
          </kbd>
        </div>
        <div className="cp-body" ref={listRef}>
          {flatList.length === 0 && !loading && (
            <div className="cp-empty">{query ? t("search.noResult") : t("search.empty")}</div>
          )}
          {CATEGORY_ORDER.map(type => {
            const group = grouped.get(type);
            if (!group || group.length === 0) return null;
            const groupLabel = t(CATEGORY_LABELS[type]);
            return (
              <div key={type} className="cp-group">
                <div className="cp-group-label">{groupLabel}</div>
                <ul className="cp-list" role="listbox">
                  {group.map(item => {
                    const idx = flatIdx++;
                    const isActive = idx === activeIndex;
                    const icon = item.icon || TYPE_ICON[item.type];
                    return (
                      <li
                        key={item.id}
                        data-cp-idx={idx}
                        role="option"
                        aria-selected={isActive}
                        className={`cp-item${isActive ? " active" : ""}`}
                        onClick={() => handleItemClick(item)}
                        onMouseEnter={() => handleItemHover(idx)}
                      >
                        <span className="cp-item-icon" aria-hidden="true">
                          {icon}
                        </span>
                        <span className="cp-item-text">
                          <span className="cp-item-title">{highlightText(item.title, query)}</span>
                          {item.subtitle && (
                            <span className="cp-item-sub">
                              {highlightText(item.subtitle, query)}
                            </span>
                          )}
                        </span>
                        {item.type === "action" && <span className="cp-item-badge">↵</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="cp-foot">
          <span className="cp-foot-hint">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            {t("search.hintNavigate")}
          </span>
          <span className="cp-foot-hint">
            <kbd>↵</kbd>
            {t("search.hintSelect")}
          </span>
          <span className="cp-foot-hint">
            <kbd>Esc</kbd>
            {t("search.hintClose")}
          </span>
        </div>
      </div>
    </div>
  );
}
