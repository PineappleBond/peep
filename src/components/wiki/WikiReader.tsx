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

interface WikiReaderProps {
  doc: WikiDocument | null;
  personName: string;
  onEditClick: () => void;
  onDocClick: (docId: number) => void;
}

/** 格式化时间戳为 YYYY-MM-DD HH:mm */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${M}-${D} ${h}:${m}`;
}

/** 关联文档项（ID + 标题） */
interface RelatedDoc {
  id: number;
  title: string;
}

export function WikiReader({ doc, personName, onEditClick, onDocClick }: WikiReaderProps) {
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
    }

    loadRelated();
    return () => { cancelled = true; };
  }, [doc?.id]);

  // 空状态
  if (!doc) {
    return (
      <div className="wiki-reader wiki-reader-empty">
        <div className="wiki-empty-hint">
          请选择左侧文档查看，或点击【新建文档】开始撰写
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
          <h1 className="wiki-reader-title">{doc.title || "（无标题）"}</h1>
          <div className="wiki-reader-meta">
            <span className="wiki-meta-person">{personName}</span>
            <span className="wiki-meta-time">{formatTime(doc.updatedAt)}</span>
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
          编辑
        </button>
      </div>

      {/* 正文区 */}
      <div
        className="wiki-reader-content"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {/* 关联文档面板 */}
      {relatedDocs.length > 0 && (
        <div className="wiki-related-panel">
          <h3 className="wiki-related-title">关联文档</h3>
          <ul className="wiki-related-list">
            {relatedDocs.map((rd) => (
              <li key={rd.id} className="wiki-related-item">
                <a
                  className="wiki-related-link"
                  onClick={() => onDocClick(rd.id)}
                >
                  {rd.title || "（无标题）"}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
