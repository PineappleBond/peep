/**
 * 大六壬历史列表组件（左侧）
 * 使用 useListData hook 统一数据获取逻辑
 */
import { useState, forwardRef, useImperativeHandle } from "react";
import type { LiurenRecord } from "../../core/personDb";
import { listLiurenRecords, getAllLiurenTags, type LiurenListFilters } from "../../core/daliurenDb";
import { formatRelativeTime } from "../../core/utils";
import { useI18n } from "../../core/i18n";
import { useListData } from "../../core/usePageInit";
import { Spinner } from "../Spinner";

/** LiurenList 暴露给父组件的命令式接口 */
export interface LiurenListHandle {
  setFilters: (filters: { searchText?: string; selectedTags?: string[]; page?: number }) => void;
}

interface LiurenListProps {
  personId: number;
  selectedId: number | null;
  onSelect: (record: LiurenRecord) => void;
  onNewClick: () => void;
  onEditClick: (record: LiurenRecord) => void;
  onDeleteClick: (record: LiurenRecord) => void;
  onViewClick?: (record: LiurenRecord) => void;
  /** 刷新计数器，变化时重新加载列表 */
  refreshKey?: number;
}

/** 适配 listLiurenRecords 的返回格式为 useListData 的统一格式 */
async function fetchLiurenList(
  personId: number,
  filters: { searchText?: string; tags?: string[]; page?: number; pageSize?: number },
) {
  const result = await listLiurenRecords(personId, filters as LiurenListFilters);
  return { items: result.records, total: result.total };
}

export const LiurenList = forwardRef<LiurenListHandle, LiurenListProps>(function LiurenList(
  {
    personId,
    selectedId,
    onSelect,
    onNewClick,
    onEditClick,
    onDeleteClick,
    onViewClick,
    refreshKey = 0,
  },
  ref,
) {
  const { t } = useI18n();

  const list = useListData<LiurenRecord>({
    personId,
    fetchFn: fetchLiurenList,
    fetchTagsFn: getAllLiurenTags,
    refreshKey,
  });

  const [hoveredId, setHoveredId] = useHoverState();

  // 暴露命令式接口：允许外部设置过滤条件
  useImperativeHandle(ref, () => ({
    setFilters: list.setFilters,
  }));

  return (
    <div className="record-list">
      {/* 顶部操作区 */}
      <div className="record-list-header">
        <button className="record-new-btn" onClick={onNewClick} data-guide="liuren-create">
          + {t("daliuren.create")}
        </button>
      </div>

      {/* 搜索区 */}
      <div className="record-list-search">
        <input
          type="text"
          className="record-search-input"
          placeholder={t("daliuren.search")}
          value={list.searchText}
          onChange={e => list.setSearchText(e.target.value)}
          aria-label={t("daliuren.searchAria")}
        />
      </div>

      {/* Tag 筛选 */}
      {list.allTags.length > 0 && (
        <div className="record-list-tags" role="group" aria-label={t("daliuren.tagFilter")}>
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
          <div className="record-list-empty liuren-empty">
            <Spinner size="sm" label={t("common.loading")} />
          </div>
        ) : list.loadError ? (
          <div className="record-list-empty liuren-empty err-box" role="alert">
            {list.loadError}
          </div>
        ) : list.items.length === 0 ? (
          <div className="record-list-empty liuren-empty">
            {list.debouncedSearchText || list.selectedTags.length > 0
              ? t("daliuren.noMatch")
              : t("daliuren.noRecords")}
          </div>
        ) : (
          <>
            {list.items.map(record => (
              <div
                key={record.id}
                className={`record-list-item ${selectedId === record.id ? "active" : ""} ${hoveredId === record.id ? "hovered" : ""}`}
                onClick={() => onSelect(record)}
                onMouseEnter={() => setHoveredId(record.id ?? null)}
                onMouseLeave={() => setHoveredId(null)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(record);
                  }
                }}
              >
                <div className="record-list-item-main">
                  <div className="record-list-item-time">{formatRelativeTime(record.savedAt)}</div>
                  <div className="record-list-item-text">
                    {record.question || t("daliuren.noQuestion")}
                  </div>
                  {record.tags.length > 0 && (
                    <div className="record-list-item-tags">
                      {record.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="record-list-item-tag">
                          {tag}
                        </span>
                      ))}
                      {record.tags.length > 3 && (
                        <span className="record-list-item-tag-more">+{record.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="record-list-item-actions">
                  {onViewClick && (
                    <button
                      className="record-action-btn"
                      onClick={e => {
                        e.stopPropagation();
                        onViewClick(record);
                      }}
                      title={t("daliuren.viewChart")}
                      aria-label={t("daliuren.viewChart")}
                    >
                      ⚏
                    </button>
                  )}
                  <button
                    className="record-action-btn"
                    onClick={e => {
                      e.stopPropagation();
                      onEditClick(record);
                    }}
                    title={t("common.edit")}
                    aria-label={t("common.edit")}
                  >
                    ✎
                  </button>
                  <button
                    className="record-action-btn record-action-delete"
                    onClick={e => {
                      e.stopPropagation();
                      onDeleteClick(record);
                    }}
                    title={t("common.delete")}
                    aria-label={t("common.delete")}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {/* 非首次加载时的轻量加载指示器（覆盖在列表顶部） */}
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
});

/**
 * 列表项 hover 状态 hook
 * 提取 hover 状态管理，避免每个列表组件重复实现
 */
function useHoverState(): [number | null, (id: number | null) => void] {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  return [hoveredId, setHoveredId];
}
