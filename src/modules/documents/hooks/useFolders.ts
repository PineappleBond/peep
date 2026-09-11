import { useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Folder } from "@/lib/db";

/**
 * 文件夹树节点
 */
export interface FolderNode {
  id: number;
  title: string;
  parentId: number | null;
  children: FolderNode[];
  /** 该文件夹下的文档数量（不含子文件夹） */
  documentCount: number;
}

/**
 * 将平铺的文件夹列表构建为树形结构
 */
export function buildTree(folders: Folder[], docCounts: Map<number, number>): FolderNode[] {
  const folderMap = new Map<number, FolderNode>();

  for (const f of folders) {
    folderMap.set(f.id!, {
      id: f.id!,
      title: f.title,
      parentId: f.parentId,
      children: [],
      documentCount: docCounts.get(f.id!) ?? 0,
    });
  }

  // 构建父子关系
  const roots: FolderNode[] = [];
  for (const node of folderMap.values()) {
    if (node.parentId && folderMap.has(node.parentId)) {
      folderMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 排序：按标题
  const sortNodes = (nodes: FolderNode[]): FolderNode[] => {
    nodes.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "zh-CN"));
    nodes.forEach((n) => sortNodes(n.children));
    return nodes;
  };

  return sortNodes(roots);
}

export function useFolders() {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<number | "__uncategorized__" | null>(null);

  // 查询所有文件夹
  const folders = useLiveQuery(() => db.folders.toArray(), [], []);

  // 查询所有文档，统计每个文件夹下的文档数（排除软删除）
  // NOTE: Dexie 对 undefined 值的索引查询支持有限，故仍使用 toArray() + 内存过滤
  const docCounts = useLiveQuery(async () => {
    const docs = await db.documents.toArray();
    const counts = new Map<number, number>();
    for (const doc of docs) {
      if (doc.folderId && !doc.deletedAt) {
        counts.set(doc.folderId, (counts.get(doc.folderId) ?? 0) + 1);
      }
    }
    return counts;
  }, [], new Map<number, number>());

  // 构建树
  const tree = buildTree(folders, docCounts);

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectFolder = useCallback((id: number | "__uncategorized__" | null) => {
    setSelectedFolderId(id);
  }, []);

  const createFolder = useCallback(
    async (title: string, parentId: number | null = null) => {
      const now = Date.now();
      const folder: Folder = {
        title,
        parentId,
        createdAt: now,
        updatedAt: now,
      };
      const id = await db.folders.add(folder);
      // 自动展开父文件夹
      if (parentId) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.add(parentId);
          return next;
        });
      }
      return id;
    },
    []
  );

  const renameFolder = useCallback(async (id: number, title: string) => {
    await db.folders.update(id, {
      title,
      updatedAt: Date.now(),
    });
  }, []);

  const deleteFolder = useCallback(
    async (id: number) => {
      // 收集该文件夹及所有子文件夹的 ID
      const idsToDelete = new Set<number>();

      const collectIds = (folderId: number) => {
        idsToDelete.add(folderId);
        const children = folders.filter((f) => f.parentId === folderId);
        children.forEach((c) => collectIds(c.id!));
      };

      collectIds(id);

      // 将待删除文件夹内的文档移到根级（folderId = null）
      const docsToUpdate = await db.documents
        .where("folderId")
        .anyOf(Array.from(idsToDelete))
        .toArray();

      await db.transaction("rw", db.folders, db.documents, async () => {
        for (const doc of docsToUpdate) {
          await db.documents.update(doc.id!, { folderId: null, updatedAt: Date.now() });
        }
        await db.folders.bulkDelete(Array.from(idsToDelete));
      });

      // 如果当前选中的文件夹被删除，清除选择
      if (selectedFolderId && typeof selectedFolderId === "number" && idsToDelete.has(selectedFolderId)) {
        setSelectedFolderId(null);
      }
    },
    [folders, selectedFolderId]
  );

  return {
    folders,
    tree,
    expandedIds,
    selectedFolderId,
    toggleExpand,
    selectFolder,
    createFolder,
    renameFolder,
    deleteFolder,
  };
}
