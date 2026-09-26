/**
 * Wiki 文档列表组件（左侧）
 */
import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import type { WikiDocument } from "../../core/personDb";
import { getPerson } from "../../core/personDb";
import { listWikiDocs, getAllWikiTags, type WikiListFilters } from "../../core/wikiDb";
import { formatRelativeTime } from "../../core/utils";
import { useI18n } from "../../core/i18n";
import { Spinner } from "../Spinner";

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

export const WikiList = forwardRef<WikiListHandle, WikiListProps>(function WikiList(
  { personId, selectedId, onSelect, onNewClick, onEditClick, onDeleteClick, refreshKey = 0 },
  ref,
) {
  const { t } = useI18n();
  const [docs, setDocs] = useState<WikiDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [personName, setPersonName] = useState<string>("");
  /** 列表数据加载中 */
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    try {
      const filters: WikiListFilters = {
        searchText,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        page,
        pageSize,
      };
      const result = await listWikiDocs(personId, filters);
      setDocs(result.docs);
      setTotal(result.total);
    } catch (err) {
      console.error("[WikiList] 加载文档失败", err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, searchText, selectedTags, page, refreshKey]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    getAllWikiTags(personId)
      .then(setAllTags)
      .catch(err => {
        console.error("[WikiList] 加载标签失败", err);
      });
  }, [personId, docs.length, refreshKey]); // 记录变化时刷新标签

  // 查询关联人物名称
  useEffect(() => {
    getPerson(personId)
      .then(p => {
        if (p) setPersonName(p.name);
      })
      .catch(err => {
        console.error("[WikiList] 加载人物信息失败", err);
      });
  }, [personId]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
    setPage(1); // 切换筛选时重置到第一页
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    setPage(1);
  };

  return (
    <div className="record-list">
      {/* 顶部操作区 */}
      <div className="record-list-header">
        <button className="record-new-btn" onClick={onNewClick}>
          + {t("wiki.createDoc")}
        </button>
      </div>

      {/* 搜索区 */}
      <div className="record-list-search">
        <input
          type="text"
          className="record-search-input"
          placeholder={t("wiki.search")}
          value={searchText}
          onChange={e => handleSearchChange(e.target.value)}
          aria-label={t("wiki.searchAria")}
        />
      </div>

      {/* Tag 筛选 */}
      {allTags.length > 0 && (
        <div className="record-list-tags">
          {allTags.map(tag => (
            <button
              key={tag}
              className={`record-tag-filter ${selectedTags.includes(tag) ? "active" : ""}`}
              onClick={() => handleTagToggle(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 列表区 */}
      <div className="record-list-items">
        {loading ? (
          <div className="record-list-empty wiki-empty">
            <Spinner size="sm" label={t("common.loading")} />
          </div>
        ) : docs.length === 0 ? (
          <div className="record-list-empty wiki-empty">
            {searchText || selectedTags.length > 0 ? t("wiki.noMatch") : t("wiki.noDocs")}
          </div>
        ) : (
          docs.map(doc => (
            <div
              key={doc.id}
              className={`record-list-item ${selectedId === doc.id ? "active" : ""}`}
              onClick={() => onSelect(doc)}
              onMouseEnter={() => setHoveredId(doc.id ?? null)}
              onMouseLeave={() => setHoveredId(null)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(doc);
                }
              }}
            >
              <div className="record-list-item-main">
                <div className="record-list-item-time">{formatRelativeTime(doc.updatedAt)}</div>
                <div className="record-list-item-text">{doc.title || t("wiki.noTitle")}</div>
                {personName && <div className="record-list-item-person">{personName}</div>}
                {doc.tags.length > 0 && (
                  <div className="record-list-item-tags">
                    {doc.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="record-list-item-tag">
                        {tag}
                      </span>
                    ))}
                    {doc.tags.length > 3 && (
                      <span className="record-list-item-tag-more">+{doc.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
              <div className={`record-list-item-actions${hoveredId === doc.id ? " visible" : ""}`}>
                <button
                  className="record-action-btn"
                  onClick={e => {
                    e.stopPropagation();
                    onEditClick(doc);
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
                    onDeleteClick(doc);
                  }}
                  title={t("common.delete")}
                  aria-label={t("common.delete")}
                >
                  🗑
                </button>
              </div>
            </div>
          ))
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
            &lt;
          </button>
          <span className="record-pagination-info">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            aria-label={t("common.next")}
          >
            &gt;
          </button>
        </div>
      )}
    </div>
  );
});
