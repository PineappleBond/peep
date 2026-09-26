/**
 * Wiki 文档阅读组件（右侧展示区）
 *
 * 展示文档标题、元信息、Markdown 正文、关联文档面板。
 * 空状态时引导用户选择或新建文档。
 */
import { useState, useEffect } from "react";
import type { WikiDocument } from "../../core/personDb";
import { getWikiLinks, getWikiBacklinks, getWikiDoc } from "../../core/wikiDb";
import { renderMarkdown } from "../../core/markdown";
import { formatDateTime } from "../../core/utils";
import { useI18n } from "../../core/i18n";

interface WikiReaderProps {
  doc: WikiDocument | null;
  personName: string;
  onEditClick: () => void;
  onDocClick: (docId: number) => void;
}

/** 关联文档项（ID + 标题） */
interface RelatedDoc {
  id: number;
  title: string;
}

export function WikiReader({ doc, personName, onEditClick, onDocClick }: WikiReaderProps) {
  const { t } = useI18n();
  const [relatedDocs, setRelatedDocs] = useState<RelatedDoc[]>([]);

  // 加载关联文档（正向链接 + 反向链接）
  useEffect(() => {
    if (!doc?.id) {
      setRelatedDocs([]);
      return;
    }
    let cancelled = false;

    async function loadRelated() {
      if (!doc?.id) return;
      try {
        const docId = doc.id;
        const [forwardIds, backIds] = await Promise.all([
          getWikiLinks(docId),
          getWikiBacklinks(docId),
        ]);
        // 合并去重
        const idSet = new Set<number>([...forwardIds, ...backIds]);
        // 过滤掉自身
        idSet.delete(docId);
        // 批量查询标题
        const docs = await Promise.all(
          Array.from(idSet).map((id) => getWikiDoc(id))
        );
        if (cancelled) return;
        const items: RelatedDoc[] = docs
          .filter((d): d is WikiDocument => !!d && d.id != null)
          .map((d) => ({ id: d.id!, title: d.title }));
        setRelatedDocs(items);
      } catch (err) {
        console.error("[WikiReader] 加载关联文档失败", err);
        if (!cancelled) setRelatedDocs([]);
      }
    }

    loadRelated();
    return () => { cancelled = true; };
  }, [doc?.id]);

  // 空状态
  if (!doc) {
    return (
      <div className="wiki-reader wiki-reader-empty">
        <div className="wiki-empty-hint">
          {t("wiki.readerEmpty")}
        </div>
      </div>
    );
  }

  const htmlContent = renderMarkdown(doc.content || "");

  return (
    <div className="wiki-reader">
      {/* 文档头部 */}
      <div className="wiki-reader-header">
        <div className="wiki-reader-header-main">
          <h1 className="wiki-reader-title">{doc.title || t("wiki.noTitle")}</h1>
          <div className="wiki-reader-meta">
            <span className="wiki-meta-person">{personName}</span>
            <span className="wiki-meta-time">{formatDateTime(doc.updatedAt)}</span>
            {doc.tags.length > 0 && (
              <span className="wiki-meta-tags">
                {doc.tags.map((tag) => (
                  <span key={tag} className="wiki-tag-chip">{tag}</span>
                ))}
              </span>
            )}
          </div>
        </div>
        <button className="wiki-edit-btn" onClick={onEditClick}>
          {t("common.edit")}
        </button>
      </div>

      {/* 正文区 */}
      <div
        className="wiki-reader-content"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        aria-live="polite"
      />

      {/* 关联文档面板 */}
      {relatedDocs.length > 0 && (
        <div className="wiki-related-panel">
          <h3 className="wiki-related-title">{t("wiki.relatedDocs")}</h3>
          <ul className="wiki-related-list">
            {relatedDocs.map((rd) => (
              <li key={rd.id} className="wiki-related-item">
                <button
                  type="button"
                  className="wiki-related-link"
                  onClick={() => onDocClick(rd.id)}
                >
                  {rd.title || t("wiki.noTitle")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
