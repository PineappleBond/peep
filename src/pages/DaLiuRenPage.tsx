/**
 * 大六壬页面 - 左右分区布局
 * 左侧：历史列表区（30%宽度）
 * 右侧：盘面区（70%宽度）
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "../core/i18n";
import { LiurenList, type LiurenListHandle } from "../components/daliuren/LiurenList";
import { LiurenChart } from "../components/daliuren/LiurenChart";
import { LiurenCreateDialog } from "../components/daliuren/LiurenCreateDialog";
import { LiurenViewDialog } from "../components/daliuren/LiurenViewDialog";
import { LiurenEditDialog } from "../components/daliuren/LiurenEditDialog";
import { LiurenDeleteDialog } from "../components/daliuren/LiurenDeleteDialog";
import type { LiurenRecord, Person } from "../core/personDb";
import { getLiurenRecord, listLiurenRecords, type LiurenListFilters } from "../core/daliurenDb";
import { registerDaLiuRenCallbacks } from "../core/debugApi";
import { useDefaultPerson, useRefreshKey } from "../core/usePageInit";

export function DaLiuRenPage() {
  const { t } = useI18n();
  // 列表刷新计数器（用于在 Dialog 操作后触发刷新）
  const {
    refreshKey: listRefreshKey,
    refresh: refreshList,
    refreshRef: listRefreshKeyRef,
  } = useRefreshKey();

  // 默认人物加载 + 切换监听（切换后清空选中、刷新列表）
  const { person, initError } = useDefaultPerson((_newPerson: Person) => {
    setSelectedRecord(null);
    refreshList();
  });

  const [selectedRecord, setSelectedRecord] = useState<LiurenRecord | null>(null);

  // Dialog 状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dialogRecord, setDialogRecord] = useState<LiurenRecord | null>(null);

  // LiurenList 组件 ref（用于调试 API 设置过滤条件）
  const liurenListRef = useRef<LiurenListHandle>(null);

  // 调试 API：用于预填充新建 Dialog 的表单数据
  const createFormInitialDataRef = useRef<{
    question: string;
    note: string;
    background: string;
    tags: string[];
  } | null>(null);
  // 调试 API：提交触发计数器
  const [createSubmitTrigger, setCreateSubmitTrigger] = useState(0);
  // 调试 API：selectedRecord 的 ref 镜像，避免 getSelectedRecord 回调的闭包过时问题
  const selectedRecordRef = useRef<LiurenRecord | null>(null);
  // 调试 API：submitCreateForm 轮询定时器（组件卸载时清理，防止泄漏）
  const submitPollRef = useRef<{
    interval: ReturnType<typeof setInterval>;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);

  // 同步 selectedRecord 到 ref（供调试 API 的 getSelectedRecord 回调读取最新值）
  useEffect(() => {
    selectedRecordRef.current = selectedRecord;
  }, [selectedRecord]);

  // 组件卸载时清理 submitCreateForm 的轮询定时器
  useEffect(() => {
    return () => {
      if (submitPollRef.current) {
        clearInterval(submitPollRef.current.interval);
        clearTimeout(submitPollRef.current.timeout);
        submitPollRef.current = null;
      }
    };
  }, []);

  // 注册大六壬调试 API 回调
  useEffect(() => {
    registerDaLiuRenCallbacks({
      getDaLiuRenList: async (filters: LiurenListFilters) => {
        if (!person?.id) {
          throw new Error(t("daliuren.personNotSelected"));
        }
        return listLiurenRecords(person.id, filters);
      },
      setListFilters: (filters: { searchText?: string; tags?: string[]; page?: number }) => {
        liurenListRef.current?.setFilters({
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
        };
      },
      submitCreateForm: async () => {
        // 触发 Dialog 的提交
        return new Promise<LiurenRecord>((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (submitPollRef.current) {
              clearInterval(submitPollRef.current.interval);
              submitPollRef.current = null;
            }
            reject(new Error(t("daliuren.submitTimeout")));
          }, 5000);

          // 触发提交（通过递增 submitTrigger）
          setCreateSubmitTrigger(t => t + 1);

          // 监听 listRefreshKey 变化（表示保存成功）
          const originalRefreshKey = listRefreshKeyRef.current;
          const checkInterval = setInterval(() => {
            if (listRefreshKeyRef.current > originalRefreshKey) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              submitPollRef.current = null;
              // 获取最新记录（刚刚创建的）
              if (person?.id) {
                listLiurenRecords(person.id, { page: 1, pageSize: 1 })
                  .then(result => {
                    if (result.records.length > 0) {
                      resolve(result.records[0]);
                    } else {
                      reject(new Error(t("daliuren.recordNotFound")));
                    }
                  })
                  .catch(err => reject(err));
              } else {
                reject(new Error(t("daliuren.personNotSelected")));
              }
            }
          }, 100);

          // 记录定时器引用，供组件卸载时清理
          submitPollRef.current = { interval: checkInterval, timeout };
        });
      },
      selectRecord: async (recordId: number) => {
        const record = await getLiurenRecord(recordId);
        if (record) {
          setSelectedRecord(record);
          return record;
        }
        return null;
      },
      getSelectedRecord: () => selectedRecordRef.current,
    });
  }, [person]);

  // 当列表选中变化时，如果当前选中记录被删除/改变，需同步
  const handleSelect = useCallback((record: LiurenRecord) => {
    setSelectedRecord(record);
  }, []);

  const handleNewClick = () => {
    setCreateDialogOpen(true);
  };

  const handleEditClick = (record: LiurenRecord) => {
    setDialogRecord(record);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (record: LiurenRecord) => {
    setDialogRecord(record);
    setDeleteDialogOpen(true);
  };

  const handleViewClick = (record: LiurenRecord) => {
    setDialogRecord(record);
    setViewDialogOpen(true);
  };

  const handleCreateSaved = useCallback(() => {
    refreshList();
    // 新建后清空右侧盘面（让用户自行点击新记录查看）
    setSelectedRecord(null);
    // 清空调试 API 预填充数据，避免下次手动打开 Dialog 时残留旧数据
    createFormInitialDataRef.current = null;
  }, [refreshList]);

  const handleEditSaved = useCallback(() => {
    refreshList();
    // 编辑保存后，如果编辑的是当前选中的记录，更新右侧盘面
    if (dialogRecord && selectedRecord?.id === dialogRecord.id) {
      // 重新加载该记录
      if (dialogRecord.id) {
        getLiurenRecord(dialogRecord.id)
          .then(r => {
            if (r) setSelectedRecord(r);
          })
          .catch(err => {
            console.error("[DaLiuRenPage] 重新加载记录失败", err);
          });
      }
    }
  }, [refreshList, dialogRecord, selectedRecord]);

  const handleDeleted = useCallback(() => {
    refreshList();
    // 删除的是当前选中记录，清空右侧盘面
    if (dialogRecord && selectedRecord?.id === dialogRecord.id) {
      setSelectedRecord(null);
    }
  }, [refreshList, dialogRecord, selectedRecord]);

  if (person === null) {
    if (initError) {
      return (
        <div className="liuren-page">
          <div className="err-box" role="alert">
            {initError}
          </div>
        </div>
      );
    }
    return (
      <div className="liuren-page">
        <div className="liuren-loading" role="status" aria-live="polite">
          {t("daliuren.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="liuren-page">
      <div className="liuren-layout">
        <div className="liuren-left">
          <LiurenList
            ref={liurenListRef}
            personId={person.id!}
            selectedId={selectedRecord?.id ?? null}
            onSelect={handleSelect}
            onNewClick={handleNewClick}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
            onViewClick={handleViewClick}
            refreshKey={listRefreshKey}
          />
        </div>
        <div className="liuren-right">
          <LiurenChart record={selectedRecord} />
        </div>
      </div>

      {/* Dialogs */}
      <LiurenCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        person={person}
        onSaved={handleCreateSaved}
        initialData={createFormInitialDataRef.current ?? undefined}
        submitTrigger={createSubmitTrigger}
      />
      <LiurenViewDialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        record={dialogRecord}
      />
      <LiurenEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        record={dialogRecord}
        onSaved={handleEditSaved}
      />
      <LiurenDeleteDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        record={dialogRecord}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
