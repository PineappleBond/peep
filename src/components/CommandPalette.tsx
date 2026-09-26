/**
 * Command Palette 组件 - 全局快速搜索（增强版）
 *
 * 设计：
 * - 按 Ctrl/Cmd+K 打开
 * - 实时搜索（模糊匹配 + 拼音 + 正则）
 * - 搜索语法：type:X / tag:X / after:YYYY-MM-DD / -keyword / /regex/flags
 * - 分类显示结果（操作 / 人物 / 记录 / 文档）
 * - 键盘导航（↑↓ 选择，Enter 确认，Esc 关闭）
 * - 最近使用记录（由 globalSearch 模块持久化，空查询时优先展示）
 * - 搜索历史（Ctrl/Cmd+R 切换显示最近查询，可删除）
 * - 过滤 chip 展示当前生效的语法过滤
 * - 关键词高亮（支持拼音/正则命中区间）
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../core/i18n";
import { useFocusTrap } from "../core/useFocusTrap";
import {
  searchAll,
  parseQuery,
  addSearchHistory,
  getSearchHistory,
  removeSearchHistory,
  clearSearchHistory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type SearchResultItem,
  type SearchResultType,
  type SearchContext,
  type ParsedQuery,
} from "../core/globalSearch";

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

/** 结果类型图标 */
const TYPE_ICON: Record<SearchResultType, string> = {
  action: "⚡",
  person: "👤",
  liuren: "☰",
  wiki: "📖",
};

/**
 * 高亮匹配区间
 * 根据匹配区间列表对文本进行 <mark> 包裹
 * 当无区间但存在普通查询时，退化为子串高亮（兼容拼音模式下的回退展示）
 */
function highlightRanges(
  text: string,
  ranges: Array<[number, number]> | undefined,
  fallbackQuery: string,
): (string | JSX.Element)[] {
  if (!text) return [text];
  if (ranges && ranges.length > 0) {
    // 排序并合并重叠
    const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const r of sorted) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    }
    const result: (string | JSX.Element)[] = [];
    let cursor = 0;
    let keyIdx = 0;
    for (const [s, e] of merged) {
      const start = Math.max(cursor, s);
      const end = Math.min(text.length, e);
      if (start > cursor) result.push(text.slice(cursor, start));
      if (start < end) {
        result.push(
          <mark key={`m${keyIdx++}`} className="cp-highlight">
            {text.slice(start, end)}
          </mark>,
        );
      }
      cursor = end;
    }
    if (cursor < text.length) result.push(text.slice(cursor));
    return result;
  }
  // 退化：按子串高亮（兼容原行为）
  if (!fallbackQuery) return [text];
  const q = fallbackQuery.trim();
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

/** 过滤 chip：显示当前生效的过滤条件。使用 memo 避免每次输入变化时重渲染 */
const FilterChips = memo(function FilterChips({
  parsed,
  t,
}: {
  parsed: ParsedQuery;
  t: (k: string) => string;
}) {
  const chips: Array<{ label: string; kind: string }> = [];
  for (const ty of parsed.types) {
    chips.push({ label: `${t("search.filter.type")}:${t(CATEGORY_LABELS[ty])}`, kind: "type" });
  }
  for (const tag of parsed.tags) {
    chips.push({ label: `${t("search.filter.tag")}:${tag}`, kind: "tag" });
  }
  if (parsed.after) {
    chips.push({ label: `${t("search.filter.after")}:${parsed.after}`, kind: "after" });
  }
  if (parsed.before) {
    chips.push({ label: `${t("search.filter.before")}:${parsed.before}`, kind: "before" });
  }
  for (const ex of parsed.excludes) {
    chips.push({ label: `-${ex}`, kind: "exclude" });
  }
  if (parsed.regex) {
    chips.push({
      label: `${t("search.filter.regex")}:/${parsed.regex.source}/${parsed.regex.flags}`,
      kind: "regex",
    });
  }
  if (chips.length === 0) return null;
  return (
    <div className="cp-chips" aria-label={t("search.filter.active")}>
      {chips.map((c, i) => (
        <span key={i} className={`cp-chip cp-chip-${c.kind}`}>
          {c.label}
        </span>
      ))}
    </div>
  );
});

/** 搜索历史视图。使用 memo 避免每次输入变化时重渲染 */
const HistoryList = memo(function HistoryList({
  history,
  onSelect,
  onDelete,
  onClear,
  t,
}: {
  history: string[];
  onSelect: (q: string) => void;
  onDelete: (q: string) => void;
  onClear: () => void;
  t: (k: string) => string;
}) {
  if (history.length === 0) {
    return <div className="cp-empty">{t("search.historyEmpty")}</div>;
  }
  return (
    <div className="cp-history">
      <div className="cp-history-head">
        <span>{t("search.history")}</span>
        <button
          type="button"
          className="cp-history-clear"
          onClick={onClear}
          title={t("search.historyClear")}
        >
          {t("search.historyClear")}
        </button>
      </div>
      <ul className="cp-history-list" role="listbox">
        {history.map((q, i) => (
          <li
            key={`${i}:${q}`}
            className="cp-history-item"
            role="option"
            aria-selected={false}
            tabIndex={0}
            onClick={() => onSelect(q)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(q);
              }
            }}
          >
            <span className="cp-history-icon" aria-hidden="true">
              🕘
            </span>
            <span className="cp-history-text">{q}</span>
            <button
              type="button"
              className="cp-history-del"
              onClick={e => {
                e.stopPropagation();
                onDelete(q);
              }}
              aria-label={t("search.historyDelete")}
              title={t("search.historyDelete")}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});

export function CommandPalette({ open, onClose, context }: CommandPaletteProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 无障碍：焦点陷阱，防止 Tab 逃逸到面板背后
  const panelRef = useFocusTrap<HTMLDivElement>(open, {
    autoFocus: false, // 由下方 useEffect 手动聚焦输入框
    returnFocus: true,
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [parsed, setParsed] = useState<ParsedQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const debounceTimer = useRef<number | null>(null);

  // 打开时聚焦输入框并重置状态
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setParsed(null);
      setActiveIndex(0);
      setShowHistory(false);
      setHistory(getSearchHistory());
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
        const { items, parsed } = await searchAll(query, context);
        setResults(items);
        setParsed(parsed);
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

  // 按类别分组的结果
  const grouped = useMemo(() => groupByType(results), [results]);

  // 扁平化列表
  const flatList = useMemo(() => {
    const list: SearchResultItem[] = [];
    for (const type of CATEGORY_ORDER) {
      const group = grouped.get(type);
      if (group) list.push(...group);
    }
    return list;
  }, [grouped]);

  const activeItem = flatList[activeIndex] || null;

  // 活跃项滚动到可见
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-cp-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // 把当前查询推入历史（用户按下 Enter 且存在结果或查询非空时）
  const commitHistory = useCallback(() => {
    const q = query.trim();
    if (q) addSearchHistory(q);
    setHistory(getSearchHistory());
  }, [query]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl/Cmd+R 切换历史视图
      if ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        setShowHistory(v => !v);
        return;
      }
      if (showHistory) {
        // 历史视图下的键盘：Enter 选中当前高亮历史
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          // 简单处理：不实现历史项索引，依赖鼠标/Tab
        }
        if (e.key === "Escape") {
          e.preventDefault();
          if (query) {
            setShowHistory(false);
          } else {
            onClose();
          }
        }
        return;
      }
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
            commitHistory();
            try {
              activeItem.action();
            } catch (err) {
              console.error("[CommandPalette] 执行动作失败", err);
            }
          } else if (query.trim()) {
            // 无结果但用户明确回车：记入历史
            commitHistory();
          }
          break;
        case "Escape":
          e.preventDefault();
          if (query) {
            setQuery("");
          } else {
            onClose();
          }
          break;
      }
    },
    [flatList.length, activeItem, onClose, query, showHistory, commitHistory],
  );

  const handleItemClick = useCallback(
    (item: SearchResultItem) => {
      commitHistory();
      try {
        item.action();
      } catch (err) {
        console.error("[CommandPalette] 执行动作失败", err);
      }
    },
    [commitHistory],
  );

  const handleItemHover = useCallback((idx: number) => {
    setActiveIndex(idx);
  }, []);

  // 选择一条历史
  const handleHistorySelect = useCallback((q: string) => {
    setQuery(q);
    setShowHistory(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // 删除一条历史
  const handleHistoryDelete = useCallback((q: string) => {
    removeSearchHistory(q);
    setHistory(getSearchHistory());
  }, []);

  const handleHistoryClear = useCallback(() => {
    clearSearchHistory();
    setHistory([]);
  }, []);

  if (!open) return null;

  // 计算当前查询的 ParsedQuery（用于高亮 fallback；若 parsed 已生成则用最新的）
  const currentParsed = parsed || parseQuery(query);
  const highlightQuery = currentParsed.main;

  // 计算每个结果在扁平列表中的索引
  let flatIdx = 0;

  return (
    <div className="cp-mask" onClick={onClose}>
      <div
        ref={panelRef}
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
            onChange={e => {
              setQuery(e.target.value);
              if (showHistory) setShowHistory(false);
            }}
            placeholder={t("search.placeholderAdvanced")}
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
          <button
            type="button"
            className={`cp-history-btn${showHistory ? " active" : ""}`}
            onClick={() => setShowHistory(v => !v)}
            title={`${t("search.history")} (Ctrl+R)`}
            aria-label={t("search.history")}
            aria-expanded={showHistory}
          >
            🕘
          </button>
          <kbd className="cp-esc" title={t("common.close")}>
            Esc
          </kbd>
        </div>
        {parsed && !showHistory && <FilterChips parsed={parsed} t={t} />}
        <div className="cp-body" ref={listRef}>
          {showHistory ? (
            <HistoryList
              history={history}
              onSelect={handleHistorySelect}
              onDelete={handleHistoryDelete}
              onClear={handleHistoryClear}
              t={t}
            />
          ) : (
            <>
              {flatList.length === 0 && !loading && (
                <div className="cp-empty">
                  {query.trim() ? t("search.noResult") : t("search.empty")}
                </div>
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
                              <span className="cp-item-title">
                                {highlightRanges(item.title, item.titleMatches, highlightQuery)}
                              </span>
                              {item.subtitle && (
                                <span className="cp-item-sub">
                                  {highlightRanges(
                                    item.subtitle,
                                    item.subtitleMatches,
                                    highlightQuery,
                                  )}
                                </span>
                              )}
                            </span>
                            {item.type === "action" && <span className="cp-item-badge">↵</span>}
                            {item.tags && item.tags.length > 0 && (
                              <span className="cp-item-tags" aria-hidden="true">
                                {item.tags.slice(0, 3).map((tag, i) => (
                                  <span key={i} className="cp-tag">
                                    {tag}
                                  </span>
                                ))}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </>
          )}
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
            <kbd>Ctrl+R</kbd>
            {t("search.hintHistory")}
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
