/**
 * Wiki 文档列表组件（左侧）
 * 使用 useListData hook 统一数据获取逻辑
 */
import { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import type { WikiDocument } from "../../core/personDb";
import { getPerson } from "../../core/personDb";
import { listWikiDocs, getAllWikiTags, type WikiListFilters } from "../../core/wikiDb";
import { formatRelativeTime } from "../../core/utils";
import { useI18n } from "../../core/i18n";
import { useListData } from "../../core/usePageInit";
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
  /** 关联人物名称（可选），未传时自动查询 */
  personName?: string;
}

/** 适配 listWikiDocs 的返回格式为 useListData 的统一格式 */
async function fetchWikiList(
  personId: number,
  filters: { searchText?: string; tags?: string[]; page?: number; pageSize?: number },
) {
  const result = await listWikiDocs(personId, filters as WikiListFilters);
  return { items: result.docs, total: result.total };
}

export const WikiList = forwardRef<WikiListHandle, WikiListProps>(function WikiList(
  {
    personId,
    selectedId,
    onSelect,
    onNewClick,
    onEditClick,
    onDeleteClick,
    refreshKey = 0,
    personName: personNameProp,
  },
  ref,
) {
  const { t } = useI18n();

  const list = useListData<WikiDocument>({
    personId,
    fetchFn: fetchWikiList,
    fetchTagsFn: getAllWikiTags,
    refreshKey,
  });

  // personName：优先使用 prop，未传时自动查询
  const [queriedName, setQueriedName] = useState("");
  const personName = personNameProp ?? queriedName;

  useEffect(() => {
    // 如果 prop 已提供，无需查询
    if (personNameProp !== undefined) return;
    getPerson(personId)
      .then(p => {
        if (p) setQueriedName(p.name);
      })
      .catch(err => {
        console.error("[WikiList] 加载人物信息失败", err);
      });
  }, [personId, personNameProp]);

  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // 暴露命令式接口：允许外部设置过滤条件
  useImperativeHandle(
    ref,
    () => ({
      setFilters: list.setFilters,
    }),
    [list.setFilters],
  );

  return (
    <div className="record-list">
      {/* 顶部操作区 */}
      <div className="record-list-header">
        <button className="record-new-btn" onClick={onNewClick} data-guide="wiki-create">
          + {t("wiki.createDoc")}
        </button>
      </div>

      {/* 搜索区 */}
      <div className="record-list-search">
        <input
          type="text"
          className="record-search-input"
          placeholder={t("wiki.search")}
          value={list.searchText}
          onChange={e => list.setSearchText(e.target.value)}
          aria-label={t("wiki.searchAria")}
        />
      </div>

      {/* Tag 筛选 */}
      {list.allTags.length > 0 && (
        <div className="record-list-tags" role="group" aria-label={t("wiki.tagFilter")}>
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
          <div className="record-list-empty wiki-empty">
            <Spinner size="sm" label={t("common.loading")} />
          </div>
        ) : list.loadError ? (
          <div className="record-list-empty wiki-empty err-box" role="alert">
            {list.loadError}
          </div>
        ) : list.items.length === 0 ? (
          <div className="record-list-empty wiki-empty">
            {list.debouncedSearchText || list.selectedTags.length > 0
              ? t("wiki.noMatch")
              : t("wiki.noDocs")}
          </div>
        ) : (
          <>
            {list.items.map(doc => (
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
                <div
                  className={`record-list-item-actions${hoveredId === doc.id ? " visible" : ""}`}
                >
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
            &lt;
          </button>
          <span className="record-pagination-info">
            {list.page} / {list.totalPages}
          </span>
          <button
            disabled={list.page >= list.totalPages}
            onClick={list.nextPage}
            aria-label={t("common.next")}
          >
            &gt;
          </button>
        </div>
      )}
    </div>
  );
});
