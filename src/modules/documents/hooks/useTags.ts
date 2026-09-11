import { useCallback } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";

export function useTags() {
  const allTags = useLiveQuery(async () => {
    const docs = await db.documents.toArray();
    const tagMap = new Map<string, number>();
    docs.forEach((doc) => {
      // 排除软删除的文档
      if (doc.deletedAt) return;
      doc.tags.forEach((tag) => {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      });
    });
    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const addTagToDocument = useCallback(
    async (docId: number, tag: string) => {
      const doc = await db.documents.get(docId);
      if (!doc) return;
      if (!doc.tags.includes(tag)) {
        await db.documents.update(docId, {
          tags: [...doc.tags, tag],
          updatedAt: Date.now(),
        });
      }
    },
    []
  );

  const removeTagFromDocument = useCallback(
    async (docId: number, tag: string) => {
      const doc = await db.documents.get(docId);
      if (!doc) return;
      await db.documents.update(docId, {
        tags: doc.tags.filter((t) => t !== tag),
        updatedAt: Date.now(),
      });
    },
    []
  );

  return {
    allTags: allTags ?? [],
    addTagToDocument,
    removeTagFromDocument,
  };
}
