/**
 * 大六壬历史列表组件（左侧）
 */
import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import type { LiurenRecord } from "../../core/personDb";
import {
  listLiurenRecords,
  getAllLiurenTags,
  type LiurenListFilters,
} from "../../core/daliurenDb";

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

/** 相对时间格式化 */
function formatRelativeTime(savedAt: number): string {
  const now = Date.now();
  const diff = now - savedAt;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 2) return "昨天";
  if (days < 30) return `${days}天前`;
  const date = new Date(savedAt);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const LiurenList = forwardRef<LiurenListHandle, LiurenListProps>(function LiurenList({
  personId,
  selectedId,
  onSelect,
  onNewClick,
  onEditClick,
  onDeleteClick,
  onViewClick,
  refreshKey = 0,
}, ref) {
  const [records, setRecords] = useState<LiurenRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const pageSize = 20;

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
    try {
      const filters: LiurenListFilters = {
        searchText,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        page,
        pageSize,
      };
      const result = await listLiurenRecords(personId, filters);
      setRecords(result.records);
      setTotal(result.total);
    } catch (err) {
      console.error("[LiurenList] 加载记录失败", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, searchText, selectedTags, page, refreshKey]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    getAllLiurenTags(personId)
      .then(setAllTags)
      .catch((err) => {
        console.error("[LiurenList] 加载标签失败", err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, records.length, refreshKey]); // 记录变化时刷新标签

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setPage(1); // 切换筛选时重置到第一页
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    setPage(1);
  };

  return (
    <div className="liuren-list">
      {/* 顶部操作区 */}
      <div className="liuren-list-header">
        <button className="liuren-new-btn" onClick={onNewClick}>
          + 新建起课
        </button>
      </div>

      {/* 搜索区 */}
      <div className="liuren-list-search">
        <input
          type="text"
          className="liuren-search-input"
          placeholder="搜索占事、备注..."
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Tag 筛选 */}
      {allTags.length > 0 && (
        <div className="liuren-list-tags">
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`liuren-tag-filter ${selectedTags.includes(tag) ? "active" : ""}`}
              onClick={() => handleTagToggle(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 列表区 */}
      <div className="liuren-list-items">
        {records.length === 0 ? (
          <div className="liuren-list-empty">
            {searchText || selectedTags.length > 0
              ? "未找到匹配的记录"
              : "暂无起课记录"}
          </div>
        ) : (
          records.map((record) => (
            <div
              key={record.id}
              className={`liuren-list-item ${selectedId === record.id ? "active" : ""}`}
              onClick={() => onSelect(record)}
              onMouseEnter={() => setHoveredId(record.id ?? null)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="liuren-list-item-main">
                <div className="liuren-list-item-time">
                  {formatRelativeTime(record.savedAt)}
                </div>
                <div className="liuren-list-item-question">
                  {record.question || "（无占事）"}
                </div>
                {record.tags.length > 0 && (
                  <div className="liuren-list-item-tags">
                    {record.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="liuren-list-item-tag">
                        {tag}
                      </span>
                    ))}
                    {record.tags.length > 3 && (
                      <span className="liuren-list-item-tag-more">
                        +{record.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {hoveredId === record.id && (
                <div className="liuren-list-item-actions">
                  {onViewClick && (
                    <button
                      className="liuren-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewClick(record);
                      }}
                      title="查看盘面"
                    >
                      ⚏
                    </button>
                  )}
                  <button
                    className="liuren-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditClick(record);
                    }}
                    title="编辑"
                  >
                    ✎
                  </button>
                  <button
                    className="liuren-action-btn liuren-action-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(record);
                    }}
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 分页 */}
      {total > pageSize && (
        <div className="liuren-list-pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹
          </button>
          <span className="liuren-pagination-info">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
});
