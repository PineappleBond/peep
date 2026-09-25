/**
 * Wiki 文档编辑组件
 * 支持新建和编辑两种模式，提供标题、正文、标签、关联文档输入
 */
import { useState, useEffect, useRef } from "react";
import type { WikiDocument } from "../../core/personDb";
import { listWikiDocs, getWikiLinks, getWikiDoc } from "../../core/wikiDb";

export interface WikiEditorProps {
  /** 文档数据，undefined 表示新建模式 */
  doc?: WikiDocument;
  /** 关联人物 ID */
  personId: number;
  /** 已有标签列表（用于自动补全） */
  existingTags: string[];
  /** 保存回调 */
  onSave: (doc: WikiDocument, linkTargetIds: number[]) => Promise<void>;
  /** 取消回调 */
  onCancel: () => void;
}

export function WikiEditor({
  doc,
  personId,
  existingTags,
  onSave,
  onCancel,
}: WikiEditorProps) {
  // 表单状态
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [linkTargetIds, setLinkTargetIds] = useState<number[]>([]);
  const [linkSearchText, setLinkSearchText] = useState("");
  const [linkSearchResults, setLinkSearchResults] = useState<WikiDocument[]>([]);
  /** 已关联文档的标题映射（id -> title） */
  const [linkTargetTitles, setLinkTargetTitles] = useState<Record<number, string>>({});

  // UI 状态
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [tagInput, setTagInput] = useState("");

  // Refs
  const tagInputRef = useRef<HTMLInputElement>(null);
  const linkSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始化：编辑模式加载数据（含已关联文档及标题），新建模式清空
  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setContent(doc.content);
      setTags(doc.tags);
      // 加载已关联的文档 ID 及其标题
      (async () => {
        if (doc.id == null) return;
        const targetIds = await getWikiLinks(doc.id);
        setLinkTargetIds(targetIds);
        // 批量查询标题
        const docs = await Promise.all(targetIds.map((id) => getWikiDoc(id)));
        const titles: Record<number, string> = {};
        docs.forEach((d, i) => {
          if (d) titles[targetIds[i]] = d.title;
        });
        setLinkTargetTitles(titles);
      })();
    } else {
      setTitle("");
      setContent("");
      setTags([]);
      setLinkTargetIds([]);
      setLinkTargetTitles({});
    }
  }, [doc]);

  // 标签输入变化时显示建议
  useEffect(() => {
    if (tagInput.trim()) {
      const filtered = existingTags.filter(
        (t) => t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t)
      );
      setShowTagSuggestions(filtered.length > 0);
    } else {
      setShowTagSuggestions(false);
    }
  }, [tagInput, existingTags, tags]);

  // 关联文档搜索（防抖）
  useEffect(() => {
    if (linkSearchTimeoutRef.current) {
      clearTimeout(linkSearchTimeoutRef.current);
    }

    if (!linkSearchText.trim()) {
      setLinkSearchResults([]);
      return;
    }

    linkSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await listWikiDocs(personId, {
          searchText: linkSearchText,
          pageSize: 10,
        });
        // 排除当前文档（编辑模式）和已选择的文档
        const filtered = result.docs.filter(
          (d) => d.id !== doc?.id && !linkTargetIds.includes(d.id!)
        );
        setLinkSearchResults(filtered);
      } catch (e) {
        console.error("搜索文档失败", e);
        setLinkSearchResults([]);
      }
    }, 300);

    return () => {
      if (linkSearchTimeoutRef.current) {
        clearTimeout(linkSearchTimeoutRef.current);
      }
    };
  }, [linkSearchText, personId, doc?.id, linkTargetIds]);

  // 添加标签
  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
    setShowTagSuggestions(false);
    tagInputRef.current?.focus();
  };

  // 删除标签
  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // 标签输入按键处理
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      // 删除最后一个标签
      removeTag(tags[tags.length - 1]);
    }
  };

  // 添加关联文档
  const addLinkTarget = async (targetId: number) => {
    if (!linkTargetIds.includes(targetId)) {
      setLinkTargetIds([...linkTargetIds, targetId]);
      // 查询标题并缓存
      const targetDoc = await getWikiDoc(targetId);
      if (targetDoc) {
        setLinkTargetTitles((prev) => ({ ...prev, [targetId]: targetDoc.title }));
      }
    }
    setLinkSearchText("");
    setLinkSearchResults([]);
  };

  // 移除关联文档
  const removeLinkTarget = (targetId: number) => {
    setLinkTargetIds(linkTargetIds.filter((id) => id !== targetId));
  };

  // 保存
  const handleSave = async () => {
    if (!title.trim()) {
      setError("标题不能为空");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const now = Date.now();
      const wikiDoc: WikiDocument = {
        ...(doc?.id != null ? { id: doc.id } : {}),
        personId,
        title: title.trim(),
        content: content.trim(),
        tags,
        savedAt: doc?.savedAt ?? now,
        updatedAt: now,
      };

      await onSave(wikiDoc, linkTargetIds);
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  // 取消
  const handleCancel = () => {
    onCancel();
  };

  return (
    <div className="wiki-editor">
      {/* 错误提示 */}
      {error && <div className="wiki-editor-error">{error}</div>}

      {/* 标题输入 */}
      <div className="wiki-editor-field">
        <input
          type="text"
          className="wiki-editor-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="文档标题"
          autoFocus
        />
      </div>

      {/* 正文编辑 */}
      <div className="wiki-editor-field">
        <textarea
          className="wiki-editor-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="使用 Markdown 格式撰写..."
          rows={20}
        />
      </div>

      {/* 标签输入 */}
      <div className="wiki-editor-field">
        <label>标签</label>
        <div className="wiki-editor-tags">
          {/* 已添加的标签 chips */}
          {tags.map((tag) => (
            <div key={tag} className="wiki-tag-chip">
              <span>{tag}</span>
              <button
                type="button"
                className="wiki-tag-remove"
                onClick={() => removeTag(tag)}
                aria-label={`删除标签 ${tag}`}
              >
                ×
              </button>
            </div>
          ))}

          {/* 标签输入框 */}
          <input
            ref={tagInputRef}
            type="text"
            className="wiki-tag-input"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
            placeholder={tags.length === 0 ? "输入标签后按回车..." : ""}
          />

          {/* 标签建议下拉 */}
          {showTagSuggestions && (
            <div className="wiki-tag-suggestions">
              {existingTags
                .filter(
                  (t) =>
                    t.toLowerCase().includes(tagInput.toLowerCase()) &&
                    !tags.includes(t)
                )
                .slice(0, 10)
                .map((t) => (
                  <div
                    key={t}
                    className="wiki-tag-suggestion-item"
                    onClick={() => addTag(t)}
                  >
                    {t}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* 关联文档选择 */}
      <div className="wiki-editor-field">
        <label>关联文档</label>
        <div className="wiki-editor-link-section">
          {/* 搜索框 */}
          <input
            type="text"
            className="wiki-editor-link-search"
            value={linkSearchText}
            onChange={(e) => setLinkSearchText(e.target.value)}
            placeholder="搜索其他文档..."
          />

          {/* 搜索结果列表 */}
          {linkSearchResults.length > 0 && (
            <div className="wiki-link-search-results">
              {linkSearchResults.map((result) => (
                <div
                  key={result.id}
                  className="wiki-link-search-item"
                  onClick={() => addLinkTarget(result.id!)}
                >
                  <span className="wiki-link-title">{result.title}</span>
                  <span className="wiki-link-tags">
                    {result.tags.slice(0, 3).join(", ")}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 已关联文档列表 */}
          {linkTargetIds.length > 0 && (
            <div className="wiki-link-selected">
              {linkTargetIds.map((id) => (
                <div key={id} className="wiki-link-selected-item">
                  <span>{linkTargetTitles[id] || `文档 #${id}`}</span>
                  <button
                    type="button"
                    className="wiki-link-remove"
                    onClick={() => removeLinkTarget(id)}
                    aria-label="移除关联"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="wiki-editor-footer">
        <button
          className="btn-cancel"
          onClick={handleCancel}
          disabled={saving}
        >
          取消
        </button>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
