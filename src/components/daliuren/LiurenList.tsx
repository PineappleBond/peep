/**
 * 大六壬历史列表组件（左侧）
 */
import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import type { LiurenRecord } from "../../core/personDb";
import { listLiurenRecords, getAllLiurenTags, type LiurenListFilters } from "../../core/daliurenDb";
import { formatRelativeTime } from "../../core/utils";
import { useI18n } from "../../core/i18n";
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
  const [records, setRecords] = useState<LiurenRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  /** 防抖后的搜索文本（实际用于查询） */
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  /** 列表数据加载中 */
  const [loading, setLoading] = useState(true);
  /** 是否首次加载（首次加载时清空旧数据，后续加载保留旧数据避免闪烁） */
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  /** 加载错误信息 */
  const [loadError, setLoadError] = useState<string | null>(null);
  const pageSize = 20;

  // 搜索防抖（300ms）
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
      // 搜索文本变化时重置到第一页
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // 暴露命令式接口：允许外部设置过滤条件
  useImperativeHandle(ref, () => ({
    setFilters: (filters: { searchText?: string; selectedTags?: string[]; page?: number }) => {
      if (filters.searchText !== undefined) {
        setSearchText(filters.searchText);
      }
      if (filters.selectedTags !== undefined) {
        setSelectedTags(filters.selectedTags);
      }
      if (filters.page !== undefined) {
        setPage(filters.page);
      }
    },
  }));

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const filters: LiurenListFilters = {
        searchText: debouncedSearchText,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        page,
        pageSize,
      };
      const result = await listLiurenRecords(personId, filters);
      setRecords(result.records);
      setTotal(result.total);
    } catch (err) {
      console.error("[LiurenList] 加载记录失败", err);
      setLoadError(t("daliuren.loadFailed"));
    } finally {
      setLoading(false);
      setIsFirstLoad(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, debouncedSearchText, selectedTags, page, refreshKey]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    getAllLiurenTags(personId)
      .then(setAllTags)
      .catch(err => {
        console.error("[LiurenList] 加载标签失败", err);
      });
  }, [personId, records.length, refreshKey]); // 记录变化时刷新标签

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(item => item !== tag) : [...prev, tag],
    );
    setPage(1); // 切换筛选时重置到第一页
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    // 搜索文本变化时由防抖 effect 统一处理 setPage(1)
  };

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
          value={searchText}
          onChange={e => handleSearchChange(e.target.value)}
          aria-label={t("daliuren.searchAria")}
        />
      </div>

      {/* Tag 筛选 */}
      {allTags.length > 0 && (
        <div className="record-list-tags" role="group" aria-label={t("daliuren.tagFilter")}>
          {allTags.map(tag => (
            <button
              key={tag}
              className={`record-tag-filter ${selectedTags.includes(tag) ? "active" : ""}`}
              onClick={() => handleTagToggle(tag)}
              aria-pressed={selectedTags.includes(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 列表区 */}
      <div className="record-list-items">
        {isFirstLoad && loading ? (
          <div className="record-list-empty liuren-empty">
            <Spinner size="sm" label={t("common.loading")} />
          </div>
        ) : loadError ? (
          <div className="record-list-empty liuren-empty err-box" role="alert">
            {loadError}
          </div>
        ) : records.length === 0 ? (
          <div className="record-list-empty liuren-empty">
            {debouncedSearchText || selectedTags.length > 0
              ? t("daliuren.noMatch")
              : t("daliuren.noRecords")}
          </div>
        ) : (
          <>
            {records.map(record => (
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
            {loading && (
              <div className="record-list-loading-bar" role="status" aria-live="polite">
                <Spinner size="sm" label={t("common.loading")} />
              </div>
            )}
          </>
        )}
      </div>

      {/* 分页 */}
      {total > pageSize && (
        <div className="record-list-pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            aria-label={t("common.prev")}
          >
            ‹
          </button>
          <span className="record-pagination-info">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            aria-label={t("common.next")}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
});
