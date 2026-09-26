/**
 * 大六壬历史列表组件（左侧）
 * 使用通用 RecordList 组件 + useListData hook
 */
import { forwardRef, useImperativeHandle } from "react";
import type { LiurenRecord } from "../../core/personDb";
import { listLiurenRecords, getAllLiurenTags, type LiurenListFilters } from "../../core/daliurenDb";
import { formatRelativeTime } from "../../core/utils";
import { useI18n } from "../../core/i18n";
import { useListData } from "../../core/usePageInit";
import { RecordList } from "../RecordList";

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

  // 暴露命令式接口：允许外部设置过滤条件
  useImperativeHandle(ref, () => ({
    setFilters: list.setFilters,
  }));

  return (
    <RecordList<LiurenRecord>
      list={list}
      selectedId={selectedId}
      onSelect={onSelect}
      onNewClick={onNewClick}
      newButtonText={`+ ${t("daliuren.create")}`}
      searchPlaceholder={t("daliuren.search")}
      searchAriaLabel={t("daliuren.searchAria")}
      tagFilterAriaLabel={t("daliuren.tagFilter")}
      noMatchText={t("daliuren.noMatch")}
      noItemsText={t("daliuren.noRecords")}
      pageClassName="liuren-list"
      emptyClassName="liuren-empty"
      dataGuide="liuren-create"
      getItemKey={record => record.id!}
      getItemId={record => record.id}
      renderItem={(record, _index, _isSelected, _isHovered) => (
        <>
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
        </>
      )}
    />
  );
});
