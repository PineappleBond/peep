/**
 * 通用记录列表组件
 *
 * 设计：
 * - 封装 header + 搜索 + 标签筛选 + 列表 + 分页 的完整 UI 结构
 * - 通过 renderItem render prop 实现列表项自定义渲染
 * - 与 useListData hook 配合使用
 *
 * 消除的重复：
 * LiurenList 与 WikiList 曾有 90%+ 相同的 UI 结构。
 * 本组件将公共的容器逻辑（搜索、标签、分页、加载/错误/空状态）提取为通用组件，
 * 各业务列表仅需提供 renderItem 渲染函数即可复用。
 */
import { useState, type ReactNode } from "react";
import { useI18n } from "../core/i18n";
import { Spinner } from "./Spinner";
import type { UseListDataResult } from "../core/usePageInit";

interface RecordListProps<T> {
  /** useListData 返回值 */
  list: UseListDataResult<T>;
  /** 当前选中项 ID */
  selectedId: number | null;
  /** 选中项回调 */
  onSelect: (item: T) => void;
  /** 新建按钮点击回调 */
  onNewClick: () => void;
  /** 新建按钮文本 */
  newButtonText: string;
  /** 搜索框 placeholder */
  searchPlaceholder: string;
  /** 搜索框 aria-label */
  searchAriaLabel: string;
  /** 标签筛选区 aria-label */
  tagFilterAriaLabel: string;
  /** 无匹配时的提示文本 */
  noMatchText: string;
  /** 无记录时的提示文本 */
  noItemsText: string;
  /** 渲染单个列表项 */
  renderItem: (item: T, index: number, isSelected: boolean, isHovered: boolean) => ReactNode;
  /** 获取列表项 key */
  getItemKey: (item: T) => number | string;
  /** 获取列表项 ID（用于 hover/选中判断） */
  getItemId: (item: T) => number | null | undefined;
  /** 页面级容器 className（附加在 .record-list 上） */
  pageClassName?: string;
  /** 空状态区 className */
  emptyClassName?: string;
  /** 自定义引导 data-guide 属性 */
  dataGuide?: string;
}

/**
 * 通用记录列表
 *
 * 结构：
 * 1. 顶部操作区（新建按钮）
 * 2. 搜索框
 * 3. 标签筛选（可选，仅当有标签时显示）
 * 4. 列表区（含 loading / error / empty / 数据）
 * 5. 分页（仅当总条数 > 每页条数时显示）
 *
 * 交互：
 * - 列表项 hover 状态由组件内部维护（通过 hoverHandlers 暴露给 renderItem）
 * - 选中状态由 selectedId + getItemId 判断
 */
export function RecordList<T>({
  list,
  selectedId,
  onSelect,
  onNewClick,
  newButtonText,
  searchPlaceholder,
  searchAriaLabel,
  tagFilterAriaLabel,
  noMatchText,
  noItemsText,
  renderItem,
  getItemKey,
  getItemId,
  pageClassName = "",
  emptyClassName = "",
  dataGuide,
}: RecordListProps<T>) {
  const { t } = useI18n();

  /* ── hover 状态 ── */
  const hoveredHandler = useHoverHandler<T>(getItemId);

  return (
    <div className={`record-list ${pageClassName}`.trim()}>
      {/* 顶部操作区 */}
      <div className="record-list-header">
        <button className="record-new-btn" onClick={onNewClick} data-guide={dataGuide}>
          {newButtonText}
        </button>
      </div>

      {/* 搜索区 */}
      <div className="record-list-search">
        <input
          type="text"
          className="record-search-input"
          placeholder={searchPlaceholder}
          value={list.searchText}
          onChange={e => list.setSearchText(e.target.value)}
          aria-label={searchAriaLabel}
        />
      </div>

      {/* 标签筛选 */}
      {list.allTags.length > 0 && (
        <div className="record-list-tags" role="group" aria-label={tagFilterAriaLabel}>
          {list.allTags.map(tag => (
            <button
              key={tag}
              className={`record-tag-filter ${list.selectedTags.includes(tag) ? "active" : ""}`}
              onClick={() => list.toggleTag(tag)}
              aria-pressed={list.selectedTags.includes(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 列表区 */}
      <div className="record-list-items">
        {list.isFirstLoad && list.loading ? (
          <div className={`record-list-empty ${emptyClassName}`.trim()}>
            <Spinner size="sm" label={t("common.loading")} />
          </div>
        ) : list.loadError ? (
          <div className={`record-list-empty ${emptyClassName}`.trim()} role="alert">
            {list.loadError}
          </div>
        ) : list.items.length === 0 ? (
          <div className={`record-list-empty ${emptyClassName}`.trim()}>
            {list.debouncedSearchText || list.selectedTags.length > 0 ? noMatchText : noItemsText}
          </div>
        ) : (
          <>
            {list.items.map((item, index) => {
              const itemId = getItemId(item);
              const isSelected = selectedId === itemId;
              const isHovered = hoveredHandler.hoveredId === itemId;
              return (
                <div
                  key={getItemKey(item)}
                  className={[
                    "record-list-item",
                    isSelected ? "active" : "",
                    isHovered ? "hovered" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onSelect(item)}
                  onMouseEnter={() => hoveredHandler.setHoveredId(itemId ?? null)}
                  onMouseLeave={() => hoveredHandler.setHoveredId(null)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(item);
                    }
                  }}
                >
                  {renderItem(item, index, isSelected, isHovered)}
                </div>
              );
            })}
            {/* 非首次加载时的轻量加载指示器 */}
            {list.loading && (
              <div className="record-list-loading-bar" role="status" aria-live="polite">
                <Spinner size="sm" label={t("common.loading")} />
              </div>
            )}
          </>
        )}
      </div>

      {/* 分页 */}
      {list.total > list.pageSize && (
        <div className="record-list-pagination">
          <button disabled={list.page <= 1} onClick={list.prevPage} aria-label={t("common.prev")}>
            ‹
          </button>
          <span className="record-pagination-info">
            {list.page} / {list.totalPages}
          </span>
          <button
            disabled={list.page >= list.totalPages}
            onClick={list.nextPage}
            aria-label={t("common.next")}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────── */
/*  内部 hover 状态 hook                       */
/* ────────────────────────────────────────── */

interface HoverHandler<T> {
  hoveredId: number | string | null;
  setHoveredId: (id: number | string | null) => void;
}

function useHoverHandler<T>(getId: (item: T) => number | null | undefined): HoverHandler<T> {
  const [hoveredId, setHoveredId] = useState<number | string | null>(null);
  return { hoveredId, setHoveredId };
}
