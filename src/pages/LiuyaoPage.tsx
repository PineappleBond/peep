/**
 * 六爻页面 - 左右分区布局
 * 左侧：历史列表区（30%宽度）
 * 右侧：hbar + 卦象区（70%宽度）
 */
import "../styles/liuyao.css";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "../core/i18n";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { LiuyaoList, type LiuyaoListHandle } from "../components/liuyao/LiuyaoList";
import { LiuyaoChart } from "../components/liuyao/LiuyaoChart";
import { LiuyaoHbar } from "../components/liuyao/LiuyaoHbar";
import { LiuyaoCreateDialog } from "../components/liuyao/LiuyaoCreateDialog";
import { LiuyaoViewDialog } from "../components/liuyao/LiuyaoViewDialog";
import { LiuyaoEditDialog } from "../components/liuyao/LiuyaoEditDialog";
import { LiuyaoDeleteDialog } from "../components/liuyao/LiuyaoDeleteDialog";
import { PageState } from "../components/PageState";
import { ErrorBoundary } from "../components/ErrorBoundary";
import type { LiuyaoRecord, Person } from "../core/personDb";
import { getLiuyaoRecord, listLiuyaoRecords, type LiuyaoListFilters } from "../core/liuyaoDb";
import { useDefaultPerson, useRefreshKey } from "../core/usePageInit";
import { registerShortcut } from "../core/shortcuts";
import {
  buildLiuyaoHbarData,
  type LiuyaoHbarVisible,
  type LiuyaoHbarPick,
  type LiuyaoHbarState,
} from "../core/liuyao/hbar";
import { computeVigorColumns } from "../core/liuyao/vigorColumns";
import { registerLiuyaoCallbacks, unregisterPageCallbacks } from "../core/debugApi/callbacks";
import type { SixLines, YongTarget } from "../core/liuyao/core/types";

export function LiuyaoPage() {
  const { t } = useI18n();
  useDocumentTitle(t("liuyao.page") || "六爻");

  const {
    refreshKey: listRefreshKey,
    refresh: refreshList,
    refreshRef: listRefreshKeyRef,
  } = useRefreshKey();

  const { person, initError } = useDefaultPerson((_newPerson: Person) => {
    setSelectedRecord(null);
    refreshList();
  });

  const [selectedRecord, setSelectedRecord] = useState<LiuyaoRecord | null>(null);

  // Dialog 状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dialogRecord, setDialogRecord] = useState<LiuyaoRecord | null>(null);

  // hbar 状态
  const [hbarVisible, setHbarVisible] = useState<LiuyaoHbarVisible>({
    yearly: true,
    monthly: true,
    daily: true,
    hourly: true,
  });
  const [hbarPick, setHbarPick] = useState<LiuyaoHbarPick>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    hour: 0,
  });

  const liuyaoListRef = useRef<LiuyaoListHandle>(null);
  const createFormInitialDataRef = useRef<{
    question: string;
    note: string;
    background: string;
    tags: string[];
    lines?: SixLines;
    yongTarget?: YongTarget;
  } | null>(null);
  const [createSubmitTrigger, setCreateSubmitTrigger] = useState(0);
  const selectedRecordRef = useRef<LiuyaoRecord | null>(null);
  const submitPollRef = useRef<{
    interval: ReturnType<typeof setInterval>;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);

  // 清理 submitPollRef
  useEffect(() => {
    return () => {
      if (submitPollRef.current) {
        clearInterval(submitPollRef.current.interval);
        clearTimeout(submitPollRef.current.timeout);
        submitPollRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    selectedRecordRef.current = selectedRecord;
  }, [selectedRecord]);

  // 注册六爻调试 API 回调
  useEffect(() => {
    registerLiuyaoCallbacks({
      getLiuyaoList: async (filters: LiuyaoListFilters) => {
        if (!person?.id) {
          throw new Error(t("liuyao.personNotSelected") || "未选择人物");
        }
        return listLiuyaoRecords(person.id, filters);
      },
      setListFilters: (filters: { searchText?: string; tags?: string[]; page?: number }) => {
        liuyaoListRef.current?.setFilters({
          searchText: filters.searchText,
          selectedTags: filters.tags,
          page: filters.page,
        });
      },
      openCreateDialog: () => {
        setCreateDialogOpen(true);
      },
      fillCreateForm: data => {
        createFormInitialDataRef.current = {
          question: data.question,
          note: data.note || "",
          background: data.background || "",
          tags: data.tags || [],
          lines: data.lines,
          yongTarget: data.yongTarget,
        };
      },
      submitCreateForm: async () => {
        // 触发 Dialog 的提交
        return new Promise<LiuyaoRecord>((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (submitPollRef.current) {
              clearInterval(submitPollRef.current.interval);
              submitPollRef.current = null;
            }
            reject(new Error(t("liuyao.submitTimeout") || "提交超时"));
          }, 5000);

          // 触发提交（通过递增 submitTrigger）
          setCreateSubmitTrigger(tr => tr + 1);

          // 监听 listRefreshKey 变化（表示保存成功）
          const originalRefreshKey = listRefreshKeyRef.current;
          const checkInterval = setInterval(() => {
            if (listRefreshKeyRef.current > originalRefreshKey) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              submitPollRef.current = null;
              // 获取最新记录（刚刚创建的）
              if (person?.id) {
                listLiuyaoRecords(person.id, { page: 1, pageSize: 1 })
                  .then(result => {
                    if (result.records.length > 0) {
                      resolve(result.records[0]);
                    } else {
                      reject(new Error(t("liuyao.recordNotFound") || "记录不存在"));
                    }
                  })
                  .catch(err => reject(err));
              } else {
                reject(new Error(t("liuyao.personNotSelected") || "未选择人物"));
              }
            }
          }, 100);

          // 记录定时器引用，供组件卸载时清理
          submitPollRef.current = { interval: checkInterval, timeout };
        });
      },
      selectRecord: async (recordId: number) => {
        const record = await getLiuyaoRecord(recordId);
        if (record) {
          setSelectedRecord(record);
          return record;
        }
        return null;
      },
      getSelectedRecord: () => selectedRecordRef.current,
      setHbarVisibility: (level: keyof LiuyaoHbarVisible, visible: boolean) => {
        setHbarVisible(prev => {
          if (prev[level] === visible) return prev; // 无变化不更新
          return { ...prev, [level]: visible };
        });
      },
      pickTime: (level: keyof LiuyaoHbarPick, value: number) => {
        setHbarPick(prev => ({ ...prev, [level]: value }));
      },
      getHbarState: (): LiuyaoHbarState => ({
        visible: hbarVisible,
        pick: hbarPick,
      }),
    });
    return () => {
      unregisterPageCallbacks("liuyao");
    };
  }, [person, t, listRefreshKeyRef, hbarVisible, hbarPick]);

  // 选中记录变化时，重置 hbar pick
  useEffect(() => {
    if (selectedRecord) {
      const dt = new Date(selectedRecord.divinationTime);
      setHbarPick({
        year: dt.getFullYear(),
        month: dt.getMonth() + 1,
        day: dt.getDate(),
        hour: 0,
      });
    }
  }, [selectedRecord]);

  // 派生数据：hbar 和旺衰列
  const hbarData = useMemo(() => {
    if (!selectedRecord) return null;
    return buildLiuyaoHbarData(selectedRecord.divinationTime, hbarPick);
  }, [selectedRecord?.divinationTime, hbarPick]);

  const vigorColumns = useMemo(() => {
    if (!selectedRecord) return null;
    return computeVigorColumns(selectedRecord.chart, hbarVisible, hbarPick);
  }, [selectedRecord?.chart, hbarVisible, hbarPick]);

  // hbar 回调
  const toggleYearly = useCallback(() => setHbarVisible(v => ({ ...v, yearly: !v.yearly })), []);
  const toggleMonthly = useCallback(() => setHbarVisible(v => ({ ...v, monthly: !v.monthly })), []);
  const toggleDaily = useCallback(() => setHbarVisible(v => ({ ...v, daily: !v.daily })), []);
  const toggleHourly = useCallback(() => setHbarVisible(v => ({ ...v, hourly: !v.hourly })), []);

  const pickYear = useCallback((year: number) => setHbarPick(p => ({ ...p, year })), []);
  const pickMonth = useCallback((month: number) => setHbarPick(p => ({ ...p, month })), []);
  const pickDay = useCallback((day: number) => setHbarPick(p => ({ ...p, day })), []);
  const pickHour = useCallback((hour: number) => setHbarPick(p => ({ ...p, hour })), []);

  const handleToggleVisible = useCallback(
    (level: keyof LiuyaoHbarVisible) => {
      switch (level) {
        case "yearly":
          toggleYearly();
          break;
        case "monthly":
          toggleMonthly();
          break;
        case "daily":
          toggleDaily();
          break;
        case "hourly":
          toggleHourly();
          break;
      }
    },
    [toggleYearly, toggleMonthly, toggleDaily, toggleHourly],
  );

  const handlePick = useCallback(
    (level: keyof LiuyaoHbarPick, value: number) => {
      switch (level) {
        case "year":
          pickYear(value);
          break;
        case "month":
          pickMonth(value);
          break;
        case "day":
          pickDay(value);
          break;
        case "hour":
          pickHour(value);
          break;
      }
    },
    [pickYear, pickMonth, pickDay, pickHour],
  );

  // 事件处理
  const handleSelect = useCallback(async (record: LiuyaoRecord) => {
    try {
      const full = await getLiuyaoRecord(record.id!);
      if (full) setSelectedRecord(full);
    } catch (err) {
      console.error("[LiuyaoPage] 加载记录失败", err);
    }
  }, []);

  const handleNewClick = useCallback(() => setCreateDialogOpen(true), []);
  const handleEditClick = useCallback((record: LiuyaoRecord) => {
    setDialogRecord(record);
    setEditDialogOpen(true);
  }, []);
  const handleDeleteClick = useCallback((record: LiuyaoRecord) => {
    setDialogRecord(record);
    setDeleteDialogOpen(true);
  }, []);
  const handleViewClick = useCallback((record: LiuyaoRecord) => {
    setDialogRecord(record);
    setViewDialogOpen(true);
  }, []);

  const handleSaved = useCallback(() => {
    refreshList();
    setSelectedRecord(null);
  }, [refreshList]);

  // 快捷键
  useEffect(() => {
    return registerShortcut({
      key: "n",
      description: t("liuyao.create") || "新建起卦",
      group: "shortcut.group.liuyao",
      handler: () => {
        if (!createDialogOpen) handleNewClick();
      },
    });
  }, [createDialogOpen, handleNewClick, t]);

  if (initError) {
    return (
      <PageState ready={false} error={initError}>
        <div />
      </PageState>
    );
  }

  if (!person) {
    return (
      <PageState ready={false} error={null}>
        <div />
      </PageState>
    );
  }

  return (
    <div className="liuyao-page">
      <ErrorBoundary name="LiuyaoPage" maxAutoRetries={1}>
        <div className="liuyao-layout">
          <div className="liuyao-left">
            <LiuyaoList
              ref={liuyaoListRef}
              personId={person?.id ?? 0}
              selectedId={selectedRecord?.id ?? null}
              onSelect={handleSelect}
              onNewClick={handleNewClick}
              onEditClick={handleEditClick}
              onDeleteClick={handleDeleteClick}
              onViewClick={handleViewClick}
              refreshKey={listRefreshKey}
            />
          </div>
          <div className="liuyao-right">
            <LiuyaoHbar
              hbarData={hbarData}
              visible={hbarVisible}
              pick={hbarPick}
              onToggleVisible={handleToggleVisible}
              onPick={handlePick}
            />
            <LiuyaoChart record={selectedRecord} vigorColumns={vigorColumns} />
          </div>
        </div>
      </ErrorBoundary>

      {/* Dialogs */}
      <LiuyaoCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        person={person}
        onSaved={handleSaved}
        initialData={createFormInitialDataRef.current ?? undefined}
        submitTrigger={createSubmitTrigger}
      />
      <LiuyaoViewDialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        record={dialogRecord}
      />
      <LiuyaoEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        record={dialogRecord}
        onSaved={handleSaved}
      />
      <LiuyaoDeleteDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        record={dialogRecord}
        onDeleted={handleSaved}
      />
    </div>
  );
}
