/**
 * 六爻历史列表组件（左侧）
 * 使用通用 RecordList 组件 + useListData hook
 */
import { forwardRef, useImperativeHandle } from "react";
import type { LiuyaoRecord } from "../../core/personDb";
import { listLiuyaoRecords, getAllLiuyaoTags, type LiuyaoListFilters } from "../../core/liuyaoDb";
import { formatRelativeTime } from "../../core/utils";
import { useI18n } from "../../core/i18n";
import { useListData } from "../../core/usePageInit";
import { RecordList } from "../RecordList";

/** LiuyaoList 暴露给父组件的命令式接口 */
export interface LiuyaoListHandle {
  setFilters: (filters: { searchText?: string; selectedTags?: string[]; page?: number }) => void;
}

interface LiuyaoListProps {
  personId: number;
  selectedId: number | null;
  onSelect: (record: LiuyaoRecord) => void;
  onNewClick: () => void;
  onEditClick: (record: LiuyaoRecord) => void;
  onDeleteClick: (record: LiuyaoRecord) => void;
  onViewClick?: (record: LiuyaoRecord) => void;
  /** 刷新计数器，变化时重新加载列表 */
  refreshKey?: number;
}

/** 适配 listLiuyaoRecords 的返回格式为 useListData 的统一格式 */
async function fetchLiuyaoList(
  personId: number,
  filters: { searchText?: string; tags?: string[]; page?: number; pageSize?: number },
) {
  const result = await listLiuyaoRecords(personId, filters as LiuyaoListFilters);
  return { items: result.records, total: result.total };
}

export const LiuyaoList = forwardRef<LiuyaoListHandle, LiuyaoListProps>(function LiuyaoList(
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

  const list = useListData<LiuyaoRecord>({
    personId,
    fetchFn: fetchLiuyaoList,
    fetchTagsFn: getAllLiuyaoTags,
    refreshKey,
  });

  // 暴露命令式接口：允许外部设置过滤条件
  useImperativeHandle(ref, () => ({
    setFilters: list.setFilters,
  }));

  return (
    <RecordList<LiuyaoRecord>
      list={list}
      selectedId={selectedId}
      onSelect={onSelect}
      onNewClick={onNewClick}
      newButtonText={`+ ${t("liuyao.create") || "新建起卦"}`}
      searchPlaceholder={t("liuyao.search") || "搜索占事..."}
      searchAriaLabel={t("liuyao.searchAria") || "搜索六爻记录"}
      tagFilterAriaLabel={t("liuyao.tagFilter") || "标签筛选"}
      noMatchText={t("liuyao.noMatch") || "无匹配记录"}
      noItemsText={t("liuyao.noRecords") || "暂无起卦记录"}
      pageClassName="liuyao-list"
      emptyClassName="liuyao-empty"
      dataGuide="liuyao-create"
      getItemKey={record => record.id!}
      getItemId={record => record.id}
      renderItem={(record, _index, _isSelected, _isHovered) => (
        <>
          <div className="record-list-item-main">
            <div className="record-list-item-time">{formatRelativeTime(record.savedAt)}</div>
            <div className="record-list-item-text">
              {record.question || t("liuyao.noQuestion") || "未命名占事"}
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
                title={t("liuyao.viewChart") || "查看卦象"}
                aria-label={t("liuyao.viewChart") || "查看卦象"}
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
