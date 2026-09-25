/**
 * Wiki 文档列表组件（左侧）
 */
import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import type { WikiDocument } from "../../core/personDb";
import { getPerson } from "../../core/personDb";
import {
  listWikiDocs,
  getAllWikiTags,
  type WikiListFilters,
} from "../../core/wikiDb";

/** WikiList 暴露给父组件的命令式接口 */
export interface WikiListHandle {
  setFilters: (filters: { searchText?: string; selectedTags?: string[]; page?: number }) => void;
}

interface WikiListProps {
  personId: number;
  selectedId: number | null;
  onSelect: (doc: WikiDocument) => void;
  onNewClick: () => void;
  onEditClick: (doc: WikiDocument) => void;
  onDeleteClick: (doc: WikiDocument) => void;
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

export const WikiList = forwardRef<WikiListHandle, WikiListProps>(function WikiList({
  personId,
  selectedId,
  onSelect,
  onNewClick,
  onEditClick,
  onDeleteClick,
  refreshKey = 0,
}, ref) {
  const [docs, setDocs] = useState<WikiDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [personName, setPersonName] = useState<string>("");
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

  const loadDocs = useCallback(async () => {
    const filters: WikiListFilters = {
      searchText,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      page,
      pageSize,
    };
    const result = await listWikiDocs(personId, filters);
    setDocs(result.docs);
    setTotal(result.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, searchText, selectedTags, page, refreshKey]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    getAllWikiTags(personId).then(setAllTags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, docs.length, refreshKey]); // 记录变化时刷新标签

  // 查询关联人物名称
  useEffect(() => {
    getPerson(personId).then((p) => {
      if (p) setPersonName(p.name);
    });
  }, [personId]);

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
    <div className="wiki-list">
      {/* 顶部操作区 */}
      <div className="wiki-list-header">
        <button className="wiki-new-btn" onClick={onNewClick}>
          + 新建文档
        </button>
      </div>

      {/* 搜索区 */}
      <div className="wiki-list-search">
        <input
          type="text"
          className="wiki-search-input"
          placeholder="搜索标题、内容..."
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Tag 筛选 */}
      {allTags.length > 0 && (
        <div className="wiki-list-tags">
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`wiki-tag-filter ${selectedTags.includes(tag) ? "active" : ""}`}
              onClick={() => handleTagToggle(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 列表区 */}
      <div className="wiki-list-items">
        {docs.length === 0 ? (
          <div className="wiki-list-empty">
            {searchText || selectedTags.length > 0
              ? "未找到匹配的文档"
              : "暂无文档"}
          </div>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              className={`wiki-list-item ${selectedId === doc.id ? "active" : ""}`}
              onClick={() => onSelect(doc)}
              onMouseEnter={() => setHoveredId(doc.id ?? null)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="wiki-list-item-main">
                <div className="wiki-list-item-time">
                  {formatRelativeTime(doc.updatedAt)}
                </div>
                <div className="wiki-list-item-title">
                  {doc.title || "（无标题）"}
                </div>
                {personName && (
                  <div className="wiki-list-item-person">{personName}</div>
                )}
                {doc.tags.length > 0 && (
                  <div className="wiki-list-item-tags">
                    {doc.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="wiki-list-item-tag">
                        {tag}
                      </span>
                    ))}
                    {doc.tags.length > 3 && (
                      <span className="wiki-list-item-tag-more">
                        +{doc.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {hoveredId === doc.id && (
                <div className="wiki-list-item-actions">
                  <button
                    className="wiki-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditClick(doc);
                    }}
                    title="编辑"
                  >
                    ✎
                  </button>
                  <button
                    className="wiki-action-btn wiki-action-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(doc);
                    }}
                    title="删除"
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 分页 */}
      {total > pageSize && (
        <div className="wiki-list-pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            &lt;
          </button>
          <span className="wiki-pagination-info">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            &gt;
          </button>
        </div>
      )}
    </div>
  );
});
