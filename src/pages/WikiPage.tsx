/**
 * Wiki 知识库页面
 * 左侧文档列表 + 右侧阅读/编辑区，支持新建、编辑、删除、关联跳转
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "../core/i18n";
import type { Person, WikiDocument } from "../core/personDb";
import {
  saveWikiDoc,
  deleteWikiDoc,
  saveWikiLinks,
  getWikiDoc,
  getAllWikiTags,
  listWikiDocs,
  type WikiListFilters,
} from "../core/wikiDb";
import { registerWikiCallbacks } from "../core/debugApi";
import { WikiList, type WikiListHandle } from "../components/wiki/WikiList";
import { WikiReader } from "../components/wiki/WikiReader";
import { WikiEditor } from "../components/wiki/WikiEditor";
import { Dialog } from "../components/Dialog";
import { useDefaultPerson, useRefreshKey } from "../core/usePageInit";

export function WikiPage() {
  const { t } = useI18n();
  const { refreshKey: listRefreshKey, refresh: refreshList } = useRefreshKey();
  const [selectedDoc, setSelectedDoc] = useState<WikiDocument | null>(null);
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [editingDoc, setEditingDoc] = useState<WikiDocument | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<WikiDocument | null>(null);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const wikiListRef = useRef<WikiListHandle>(null);
  const selectedDocRef = useRef<WikiDocument | null>(null);

  // 默认人物加载 + 切换监听（切换后清空选中、刷新列表、切回阅读模式）
  const { person, initError } = useDefaultPerson(() => {
    setSelectedDoc(null);
    setMode("read");
    refreshList();
  });

  // 同步 selectedDoc 到 ref，避免闭包过时
  useEffect(() => {
    selectedDocRef.current = selectedDoc;
  }, [selectedDoc]);

  // 注册调试 API 回调
  useEffect(() => {
    if (!person?.id) return;
    registerWikiCallbacks({
      getWikiList: async (filters: WikiListFilters) => {
        if (!person?.id) throw new Error(t("daliuren.personNotSelected"));
        return listWikiDocs(person.id, filters);
      },
      setWikiListFilters: filters => {
        wikiListRef.current?.setFilters({
          searchText: filters.searchText,
          selectedTags: filters.tags,
          page: filters.page,
        });
      },
      openWikiEditor: () => {
        setEditingDoc(undefined);
        setMode("edit");
      },
      saveWikiDoc: async (doc: WikiDocument, linkTargetIds: number[]) => {
        const savedId = await saveWikiDoc(doc);
        await saveWikiLinks(savedId, linkTargetIds);
        refreshList();
        const refreshed = await getWikiDoc(savedId);
        if (refreshed) {
          setSelectedDoc(refreshed);
          setMode("read");
          return refreshed;
        }
        throw new Error(`保存后未找到文档 #${savedId}`);
      },
      selectWikiDoc: async (docId: number) => {
        const doc = await getWikiDoc(docId);
        if (doc) {
          setSelectedDoc(doc);
          setMode("read");
          return doc;
        }
        return null;
      },
      getSelectedWikiDoc: () => selectedDocRef.current,
    });
  }, [person, refreshList]);

  // 刷新已有标签列表
  useEffect(() => {
    if (!person?.id) return;
    getAllWikiTags(person.id)
      .then(setExistingTags)
      .catch(err => {
        console.error("[WikiPage] 加载标签列表失败", err);
      });
  }, [person?.id, listRefreshKey]);

  // 列表选中：加载文档详情，切换到 read 模式
  const handleSelect = useCallback(async (doc: WikiDocument) => {
    if (doc.id == null) return;
    try {
      const full = await getWikiDoc(doc.id);
      setSelectedDoc(full || doc);
      setMode("read");
    } catch (err) {
      console.error("[WikiPage] 加载文档详情失败", err);
      alert(t("wiki.loadDocFailed"));
    }
  }, []);

  // 新建：清空 editingDoc，切换到 edit 模式
  const handleNewClick = useCallback(() => {
    setEditingDoc(undefined);
    setMode("edit");
  }, []);

  // 编辑：设置 editingDoc，切换到 edit 模式
  const handleEditClick = useCallback((doc: WikiDocument) => {
    setEditingDoc(doc);
    setMode("edit");
  }, []);

  // 删除：打开确认 Dialog
  const handleDeleteClick = useCallback((doc: WikiDocument) => {
    setDeletingDoc(doc);
    setDeleteDialogOpen(true);
  }, []);

  // 确认删除
  const handleConfirmDelete = useCallback(async () => {
    if (!deletingDoc?.id) return;
    try {
      await deleteWikiDoc(deletingDoc.id);
      setDeleteDialogOpen(false);
      setDeletingDoc(null);
      // 如果删除的是当前选中的文档，清空右侧
      if (selectedDoc?.id === deletingDoc.id) {
        setSelectedDoc(null);
      }
      refreshList();
    } catch (err) {
      console.error("[WikiPage] 删除文档失败", err);
      alert(err instanceof Error ? err.message : t("wiki.deleteFailed"));
    }
  }, [deletingDoc, selectedDoc, refreshList]);

  // 编辑保存
  const handleSave = useCallback(async (doc: WikiDocument, linkTargetIds: number[]) => {
    try {
      // 保存文档
      const savedId = await saveWikiDoc(doc);
      // 保存链接关系
      await saveWikiLinks(savedId, linkTargetIds);
      // 刷新列表
      refreshList();
      // 切换到 read 模式，选中新/更新的文档
      const refreshed = await getWikiDoc(savedId);
      if (refreshed) {
        setSelectedDoc(refreshed);
      }
      setMode("read");
    } catch (err) {
      console.error("[WikiPage] 保存文档失败", err);
      alert(err instanceof Error ? err.message : t("wiki.saveFailed"));
    }
  }, []);

  // 取消编辑
  const handleCancel = useCallback(() => {
    setMode("read");
    setEditingDoc(undefined);
  }, []);

  // 导出 llms.txt
  const handleExport = useCallback(async () => {
    if (!person?.id) return;
    try {
      const result = await listWikiDocs(person.id, { pageSize: 9999 });
      const docs = result.docs;

      if (docs.length === 0) {
        alert(t("wiki.noDocsToExport"));
        return;
      }

      // 按标签分组
      const tagMap = new Map<string, WikiDocument[]>();
      const untagged: WikiDocument[] = [];
      for (const doc of docs) {
        if (doc.tags.length === 0) {
          untagged.push(doc);
        } else {
          for (const tag of doc.tags) {
            if (!tagMap.has(tag)) tagMap.set(tag, []);
            tagMap.get(tag)?.push(doc);
          }
        }
      }

      let md = `# ${t("wiki.knowledgeBase", { name: person.name || t("common.unnamed") })}\n\n`;
      md += `> ${t("wiki.knowledgeBaseDesc", { name: person.name || t("common.unnamed") })}\n\n`;

      const renderDocs = (list: WikiDocument[]) =>
        list
          .map(d => {
            const preview = d.content.split("\n")[0].slice(0, 100) || t("wiki.noContent");
            return `- [${d.title || t("wiki.noTitle")}](#doc-${d.id}): ${preview}`;
          })
          .join("\n");

      for (const [tag, list] of Array.from(tagMap.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      )) {
        md += `## ${tag}\n\n${renderDocs(list)}\n\n`;
      }
      if (untagged.length > 0) {
        md += `## ${t("wiki.uncategorized")}\n\n${renderDocs(untagged)}\n\n`;
      }

      const blob = new Blob([md], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `llms-${person.name || "wiki"}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[WikiPage] 导出失败", err);
      alert(t("wiki.exportFailed"));
    }
  }, [person]);

  // 关联文档跳转：加载目标文档，显示在右侧
  const handleDocClick = useCallback(async (docId: number) => {
    try {
      const doc = await getWikiDoc(docId);
      if (doc) {
        setSelectedDoc(doc);
        setMode("read");
      } else {
        alert(t("wiki.docNotFound"));
      }
    } catch (err) {
      console.error("[WikiPage] 加载关联文档失败", err);
      alert(t("wiki.loadRelatedFailed"));
    }
  }, []);

  // 加载中状态
  if (person === null) {
    if (initError) {
      return (
        <div className="wiki-page">
          <div className="err-box" role="alert">
            {initError}
          </div>
        </div>
      );
    }
    return (
      <div className="wiki-page">
        <div className="wiki-loading" role="status" aria-live="polite">
          {t("wiki.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="wiki-page">
      <div className="wiki-header">
        <h2 className="wiki-title">{t("wiki.title")}</h2>
        <button className="wiki-export-btn" onClick={handleExport} title={t("wiki.exportTitle")}>
          {t("wiki.export")}
        </button>
      </div>
      <div className="wiki-layout">
        <div className="wiki-left">
          <WikiList
            ref={wikiListRef}
            personId={person.id!}
            selectedId={selectedDoc?.id ?? null}
            onSelect={handleSelect}
            onNewClick={handleNewClick}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
            refreshKey={listRefreshKey}
          />
        </div>
        <div className="wiki-right">
          {mode === "read" ? (
            <WikiReader
              doc={selectedDoc}
              personName={person.name || ""}
              onEditClick={() => selectedDoc && handleEditClick(selectedDoc)}
              onDocClick={handleDocClick}
            />
          ) : (
            <WikiEditor
              doc={editingDoc}
              personId={person.id!}
              existingTags={existingTags}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          )}
        </div>
      </div>

      {/* 删除确认 Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title={t("wiki.confirmDeleteTitle")}
        footer={
          <div className="dlg-buttons">
            <button className="btn-cancel" onClick={() => setDeleteDialogOpen(false)}>
              {t("common.cancel")}
            </button>
            <button className="btn-danger" onClick={handleConfirmDelete}>
              {t("common.delete")}
            </button>
          </div>
        }
      >
        <p>{t("wiki.confirmDeleteMessage")}</p>
        {deletingDoc && (
          <p className="dlg-hint">
            {t("common.labelValue", {
              label: t("wiki.docLabel"),
              value: deletingDoc.title || t("wiki.noTitle"),
            })}
          </p>
        )}
      </Dialog>
    </div>
  );
}
