/**
 * Wiki 文档列表组件（左侧）
 * 使用通用 RecordList 组件 + useListData hook
 */
import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import type { WikiDocument } from "../../core/personDb";
import { getPerson } from "../../core/personDb";
import { listWikiDocs, getAllWikiTags, type WikiListFilters } from "../../core/wikiDb";
import { formatRelativeTime } from "../../core/utils";
import { useI18n } from "../../core/i18n";
import { useListData } from "../../core/usePageInit";
import { RecordList } from "../RecordList";

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

  // 暴露命令式接口：允许外部设置过滤条件
  useImperativeHandle(
    ref,
    () => ({
      setFilters: list.setFilters,
    }),
    [list.setFilters],
  );

  return (
    <RecordList<WikiDocument>
      list={list}
      selectedId={selectedId}
      onSelect={onSelect}
      onNewClick={onNewClick}
      newButtonText={`+ ${t("wiki.createDoc")}`}
      searchPlaceholder={t("wiki.search")}
      searchAriaLabel={t("wiki.searchAria")}
      tagFilterAriaLabel={t("wiki.tagFilter")}
      noMatchText={t("wiki.noMatch")}
      noItemsText={t("wiki.noDocs")}
      pageClassName="wiki-list"
      emptyClassName="wiki-empty"
      dataGuide="wiki-create"
      getItemKey={doc => doc.id!}
      getItemId={doc => doc.id}
      renderItem={(doc, _index, _isSelected, isHovered) => (
        <>
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
          <div className={`record-list-item-actions${isHovered ? " visible" : ""}`}>
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
        </>
      )}
    />
  );
});
