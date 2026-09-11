import { useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type DocumentRecord } from "@/lib/db";
import type { DocumentType } from "../types";

export function useDocuments(
  type?: DocumentType,
  personId?: number | null,
  folderId?: number | null,
  showDeleted: boolean = false
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const documents = useLiveQuery(
    async () => {
      // 利用 Dexie 复合索引 [type+updatedAt] 进行范围查询，减少内存加载量
      let collection;
      if (type) {
        // 有复合索引 [type+updatedAt]，可直接按 type 过滤
        collection = db.documents.where("type").equals(type);
      } else {
        collection = db.documents.toCollection();
      }

      let docs = await collection.reverse().sortBy("updatedAt");

      // 过滤删除状态
      docs = docs.filter((doc) =>
        showDeleted ? doc.deletedAt != null : !doc.deletedAt
      );

      // 按人物过滤
      if (personId !== undefined && personId !== null) {
        docs = docs.filter((doc) => doc.personId === personId);
      }

      // 按文件夹过滤：null 表示"未分类"（无文件夹），number 表示指定文件夹
      if (folderId !== undefined) {
        if (folderId === null) {
          docs = docs.filter((doc) => !doc.folderId);
        } else {
          docs = docs.filter((doc) => doc.folderId === folderId);
        }
      }

      // 搜索过滤
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        docs = docs.filter(
          (doc) =>
            doc.title.toLowerCase().includes(query) ||
            doc.content.toLowerCase().includes(query)
        );
      }

      // 标签过滤
      if (selectedTags.length > 0) {
        docs = docs.filter((doc) =>
          selectedTags.some((tag) => doc.tags.includes(tag))
        );
      }

      return docs;
    },
    [type, personId, folderId, searchQuery, selectedTags, showDeleted],
    []
  );

  const createDocument = useCallback(
    async (
      doc: Omit<DocumentRecord, "id" | "createdAt" | "updatedAt">
    ) => {
      const now = Date.now();
      const newDoc: DocumentRecord = {
        ...doc,
        createdAt: now,
        updatedAt: now,
      };
      const id = await db.documents.add(newDoc);
      return id;
    },
    []
  );

  const updateDocument = useCallback(
    async (id: number, changes: Partial<DocumentRecord>) => {
      await db.documents.update(id, {
        ...changes,
        updatedAt: Date.now(),
      });
    },
    []
  );

  const deleteDocument = useCallback(async (id: number) => {
    await db.documents.update(id, { deletedAt: Date.now() });
  }, []);

  const restoreDocument = useCallback(async (id: number) => {
    await db.documents.update(id, { deletedAt: null });
  }, []);

  const permanentlyDeleteDocument = useCallback(async (id: number) => {
    await db.documents.delete(id);
  }, []);

  const getDocument = useCallback(async (id: number) => {
    return db.documents.get(id);
  }, []);

  return {
    documents,
    searchQuery,
    setSearchQuery,
    selectedTags,
    setSelectedTags,
    createDocument,
    updateDocument,
    deleteDocument,
    getDocument,
    restoreDocument,
    permanentlyDeleteDocument,
  };
}
