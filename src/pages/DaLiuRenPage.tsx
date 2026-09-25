/**
 * 大六壬页面 - 左右分区布局
 * 左侧：历史列表区（30%宽度）
 * 右侧：盘面区（70%宽度）
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { LiurenList, type LiurenListHandle } from "../components/daliuren/LiurenList";
import { LiurenChart } from "../components/daliuren/LiurenChart";
import { LiurenCreateDialog } from "../components/daliuren/LiurenCreateDialog";
import { LiurenViewDialog } from "../components/daliuren/LiurenViewDialog";
import { LiurenEditDialog } from "../components/daliuren/LiurenEditDialog";
import { LiurenDeleteDialog } from "../components/daliuren/LiurenDeleteDialog";
import type { LiurenRecord, Person } from "../core/personDb";
import { getDefaultPerson } from "../core/personDb";
import { getLiurenRecord, listLiurenRecords, type LiurenListFilters } from "../core/daliurenDb";
import { globalEvents } from "../core/events";
import { registerDaLiuRenCallbacks } from "../core/debugApi";

export function DaLiuRenPage() {
  const [person, setPerson] = useState<Person | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<LiurenRecord | null>(null);

  // Dialog 状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dialogRecord, setDialogRecord] = useState<LiurenRecord | null>(null);

  // 列表刷新计数器（用于在 Dialog 操作后触发刷新）
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const listRefreshKeyRef = useRef(0);
  listRefreshKeyRef.current = listRefreshKey;

  // LiurenList 组件 ref（用于调试 API 设置过滤条件）
  const liurenListRef = useRef<LiurenListHandle>(null);

  // 调试 API：用于预填充新建 Dialog 的表单数据
  const createFormInitialDataRef = useRef<{ question: string; note: string; background: string; tags: string[] } | null>(null);
  // 调试 API：提交触发计数器
  const [createSubmitTrigger, setCreateSubmitTrigger] = useState(0);

  // 获取当前人物（默认人物）
  useEffect(() => {
    getDefaultPerson().then((p) => {
      if (p.id != null) setPerson(p);
    });
  }, []);

  // 监听人物切换事件——切换后刷新列表、清空右侧盘面
  useEffect(() => {
    const handlePersonChanged = (newPerson: Person) => {
      if (newPerson.id == null) return;
      setPerson(newPerson);
      setSelectedRecord(null);
      setListRefreshKey((k) => k + 1);
    };
    globalEvents.on("person.changed", handlePersonChanged);
    return () => {
      globalEvents.off("person.changed", handlePersonChanged);
    };
  }, []);

  // 注册大六壬调试 API 回调
  useEffect(() => {
    registerDaLiuRenCallbacks({
      getDaLiuRenList: async (filters: LiurenListFilters) => {
        if (!person?.id) {
          throw new Error("人物未选择");
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
      fillCreateForm: (data) => {
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
            reject(new Error("提交超时"));
          }, 5000);

          // 触发提交（通过递增 submitTrigger）
          setCreateSubmitTrigger((t) => t + 1);

          // 监听 listRefreshKey 变化（表示保存成功）
          const originalRefreshKey = listRefreshKeyRef.current;
          const checkInterval = setInterval(() => {
            if (listRefreshKeyRef.current > originalRefreshKey) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              // 获取最新记录（刚刚创建的）
              if (person?.id) {
                listLiurenRecords(person.id, { page: 1, pageSize: 1 }).then((result) => {
                  if (result.records.length > 0) {
                    resolve(result.records[0]);
                  } else {
                    reject(new Error("未找到新创建的记录"));
                  }
                });
              } else {
                reject(new Error("人物未选择"));
              }
            }
          }, 100);
        });
      },
      selectRecord: async (recordId: number) => {
        const record = await getLiurenRecord(recordId);
        if (record) {
          setSelectedRecord(record);
        }
      },
      getSelectedRecord: () => selectedRecord,
    });
  }, [person, selectedRecord]);

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

  // Dialog 保存/删除后刷新列表，同步右侧盘面
  const refreshList = useCallback(() => {
    setListRefreshKey((k) => k + 1);
  }, []);

  const handleCreateSaved = useCallback(() => {
    refreshList();
    // 新建后清空右侧盘面（让用户自行点击新记录查看）
    setSelectedRecord(null);
  }, [refreshList]);

  const handleEditSaved = useCallback(() => {
    refreshList();
    // 编辑保存后，如果编辑的是当前选中的记录，更新右侧盘面
    if (dialogRecord && selectedRecord?.id === dialogRecord.id) {
      // 重新加载该记录
      if (dialogRecord.id) {
        getLiurenRecord(dialogRecord.id).then((r) => {
          if (r) setSelectedRecord(r);
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
    return (
      <div className="liuren-page">
        <div className="liuren-loading">加载中...</div>
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
