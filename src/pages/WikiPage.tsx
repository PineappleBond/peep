/**
 * Wiki 知识库页面
 * 左侧文档列表 + 右侧阅读/编辑区，支持新建、编辑、删除、关联跳转
 */
import { useState, useEffect, useCallback, useRef } from "react";
import type { Person, WikiDocument } from "../core/personDb";
import { getDefaultPerson } from "../core/personDb";
import { saveWikiDoc, deleteWikiDoc, saveWikiLinks, getWikiDoc, getAllWikiTags, listWikiDocs, type WikiListFilters } from "../core/wikiDb";
import { globalEvents } from "../core/events";
import { registerWikiCallbacks } from "../core/debugApi";
import { WikiList, type WikiListHandle } from "../components/wiki/WikiList";
import { WikiReader } from "../components/wiki/WikiReader";
import { WikiEditor } from "../components/wiki/WikiEditor";
import { Dialog } from "../components/Dialog";

export function WikiPage() {
  const [person, setPerson] = useState<Person | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<WikiDocument | null>(null);
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [editingDoc, setEditingDoc] = useState<WikiDocument | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<WikiDocument | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const wikiListRef = useRef<WikiListHandle>(null);
  const selectedDocRef = useRef<WikiDocument | null>(null);

  // 初始化：获取默认人物
  useEffect(() => {
    getDefaultPerson()
      .then((p) => {
        if (p.id != null) setPerson(p);
      })
      .catch((err) => {
        console.error("[WikiPage] 加载默认人物失败", err);
      });
  }, []);

  // 同步 selectedDoc 到 ref，避免闭包过时
  useEffect(() => {
    selectedDocRef.current = selectedDoc;
  }, [selectedDoc]);

  // 注册调试 API 回调
  useEffect(() => {
    if (!person?.id) return;
    registerWikiCallbacks({
      getWikiList: async (filters: WikiListFilters) => {
        if (!person?.id) throw new Error("人物未选择");
        return listWikiDocs(person.id, filters);
      },
      setWikiListFilters: (filters) => {
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
        setListRefreshKey((k) => k + 1);
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
  }, [person]);

  // 监听人物切换事件——切换后刷新列表、清空选中
  useEffect(() => {
    const handlePersonChanged = (newPerson: Person) => {
      if (newPerson.id == null) return;
      setPerson(newPerson);
      setSelectedDoc(null);
      setMode("read");
      setListRefreshKey((k) => k + 1);
    };
    globalEvents.on("person.changed", handlePersonChanged);
    return () => {
      globalEvents.off("person.changed", handlePersonChanged);
    };
  }, []);

  // 刷新已有标签列表
  useEffect(() => {
    if (!person?.id) return;
    getAllWikiTags(person.id)
      .then(setExistingTags)
      .catch((err) => {
        console.error("[WikiPage] 加载标签列表失败", err);
      });
  }, [person?.id, listRefreshKey]);

  // 列表选中：加载文档详情，切换到 read 模式
  const handleSelect = useCallback(async (doc: WikiDocument) => {
    if (doc.id == null) return;
    const full = await getWikiDoc(doc.id);
    setSelectedDoc(full || doc);
    setMode("read");
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
    await deleteWikiDoc(deletingDoc.id);
    setDeleteDialogOpen(false);
    setDeletingDoc(null);
    // 如果删除的是当前选中的文档，清空右侧
    if (selectedDoc?.id === deletingDoc.id) {
      setSelectedDoc(null);
    }
    setListRefreshKey((k) => k + 1);
  }, [deletingDoc, selectedDoc]);

  // 编辑保存
  const handleSave = useCallback(async (doc: WikiDocument, linkTargetIds: number[]) => {
    // 保存文档
    const savedId = await saveWikiDoc(doc);
    // 保存链接关系
    await saveWikiLinks(savedId, linkTargetIds);
    // 刷新列表
    setListRefreshKey((k) => k + 1);
    // 切换到 read 模式，选中新/更新的文档
    const refreshed = await getWikiDoc(savedId);
    if (refreshed) {
      setSelectedDoc(refreshed);
    }
    setMode("read");
  }, []);

  // 取消编辑
  const handleCancel = useCallback(() => {
    setMode("read");
    setEditingDoc(undefined);
  }, []);

  // 导出 llms.txt
  const handleExport = useCallback(async () => {
    if (!person?.id) return;
    const result = await listWikiDocs(person.id, { pageSize: 9999 });
    const docs = result.docs;

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

    let md = `# 知识库 — ${person.name || "未命名"}\n\n`;
    md += `> ${person.name || "未命名"} 的紫微斗数知识库\n\n`;

    const renderDocs = (list: WikiDocument[]) =>
      list
        .map((d) => {
          const preview = d.content.split("\n")[0].slice(0, 100) || "（无内容）";
          return `- [${d.title || "（无标题）"}](#doc-${d.id}): ${preview}`;
        })
        .join("\n");

    for (const [tag, list] of Array.from(tagMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      md += `## ${tag}\n\n${renderDocs(list)}\n\n`;
    }
    if (untagged.length > 0) {
      md += `## 未分类\n\n${renderDocs(untagged)}\n\n`;
    }

    const blob = new Blob([md], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llms-${person.name || "wiki"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [person]);

  // 关联文档跳转：加载目标文档，显示在右侧
  const handleDocClick = useCallback(async (docId: number) => {
    const doc = await getWikiDoc(docId);
    if (doc) {
      setSelectedDoc(doc);
      setMode("read");
    }
  }, []);

  // 加载中状态
  if (person === null) {
    return (
      <div className="wiki-page">
        <div className="wiki-loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="wiki-page">
      <div className="wiki-header">
        <h2 className="wiki-title">知识库</h2>
        <button className="wiki-export-btn" onClick={handleExport} title="导出为 llms.txt">
          导出
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
        title="确认删除"
        footer={
          <div className="dlg-buttons">
            <button className="btn-cancel" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </button>
            <button className="btn-danger" onClick={handleConfirmDelete}>
              删除
            </button>
          </div>
        }
      >
        <p>确定要删除这篇文档吗？此操作不可恢复。</p>
        {deletingDoc && (
          <p className="dlg-hint">文档：{deletingDoc.title || "（无标题）"}</p>
        )}
      </Dialog>
    </div>
  );
}
